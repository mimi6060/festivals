package middleware

import (
	"context"
	cryptoRand "crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// Role constants
const (
	RoleAdmin     = "ADMIN"
	RoleOrganizer = "ORGANIZER"
	RoleStaff     = "STAFF"
	RoleUser      = "USER"
)

// Context keys
type contextKey string

const (
	ContextKeyUserID      contextKey = "user_id"
	ContextKeyEmail       contextKey = "email"
	ContextKeyRoles       contextKey = "roles"
	ContextKeyPermissions contextKey = "permissions"
	ContextKeyFestivalID  contextKey = "festival_id"
	ContextKeyClaims      contextKey = "claims"
)

// Claims represents the JWT claims from Auth0
type Claims struct {
	jwt.RegisteredClaims
	Scope       string   `json:"scope"`
	Permissions []string `json:"permissions"`
	Email       string   `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name        string   `json:"name"`
	Picture     string   `json:"picture"`
	// Custom claims with namespace
	Roles      []string `json:"https://festivals.app/roles"`
	FestivalID string   `json:"https://festivals.app/festival_id"`
	StandIDs   []string `json:"https://festivals.app/stand_ids"`
	OrganizerFor []string `json:"https://festivals.app/organizer_for"`
}

// AuthConfig holds configuration for the Auth middleware
type AuthConfig struct {
	Domain       string
	Audiences    []string // Support multiple audiences
	Issuer       string
	CacheTTL     time.Duration
	RedisClient  *redis.Client
	Development  bool // Skip verification in development
}

// JWKSCache handles caching of JWKS keys
type JWKSCache struct {
	mu          sync.RWMutex
	keys        jwk.Set
	lastFetch   time.Time
	ttl         time.Duration
	domain      string
	redisClient *redis.Client
}

var (
	jwksCache     *JWKSCache
	jwksCacheLock sync.Mutex
)

// NewJWKSCache creates a new JWKS cache
func NewJWKSCache(domain string, ttl time.Duration, redisClient *redis.Client) *JWKSCache {
	return &JWKSCache{
		domain:      domain,
		ttl:         ttl,
		redisClient: redisClient,
	}
}

// GetKey retrieves a key from the JWKS cache
func (c *JWKSCache) GetKey(kid string) (*rsa.PublicKey, error) {
	c.mu.RLock()
	keys := c.keys
	lastFetch := c.lastFetch
	c.mu.RUnlock()

	// Check if cache needs refresh
	if keys == nil || time.Since(lastFetch) > c.ttl {
		if err := c.refresh(); err != nil {
			// If we have cached keys, use them even if refresh fails
			if keys != nil {
				log.Warn().Err(err).Msg("Failed to refresh JWKS, using cached keys")
			} else {
				return nil, fmt.Errorf("failed to fetch JWKS: %w", err)
			}
		}
		c.mu.RLock()
		keys = c.keys
		c.mu.RUnlock()
	}

	// Find key by kid
	key, found := keys.LookupKeyID(kid)
	if !found {
		// Try refreshing in case new keys were added
		if err := c.refresh(); err != nil {
			return nil, fmt.Errorf("key not found and refresh failed: %w", err)
		}
		c.mu.RLock()
		keys = c.keys
		c.mu.RUnlock()
		key, found = keys.LookupKeyID(kid)
		if !found {
			return nil, fmt.Errorf("key with kid %s not found", kid)
		}
	}

	// Convert to RSA public key
	var rawKey interface{}
	if err := key.Raw(&rawKey); err != nil {
		return nil, fmt.Errorf("failed to get raw key: %w", err)
	}

	rsaKey, ok := rawKey.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("key is not an RSA public key")
	}

	return rsaKey, nil
}

// refresh fetches new keys from the JWKS endpoint
func (c *JWKSCache) refresh() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Double-check after acquiring lock
	if c.keys != nil && time.Since(c.lastFetch) < c.ttl/2 {
		return nil
	}

	// Try to get from Redis first (for distributed caching)
	if c.redisClient != nil {
		cached, err := c.redisClient.Get(context.Background(), "jwks:"+c.domain).Result()
		if err == nil && cached != "" {
			keys, err := jwk.Parse([]byte(cached))
			if err == nil {
				c.keys = keys
				c.lastFetch = time.Now()
				return nil
			}
		}
	}

	// Fetch from Auth0
	jwksURL := fmt.Sprintf("https://%s/.well-known/jwks.json", c.domain)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	keys, err := jwk.Fetch(ctx, jwksURL)
	if err != nil {
		return fmt.Errorf("failed to fetch JWKS from %s: %w", jwksURL, err)
	}

	c.keys = keys
	c.lastFetch = time.Now()

	// Cache in Redis
	if c.redisClient != nil {
		jwksJSON, _ := json.Marshal(keys)
		c.redisClient.Set(context.Background(), "jwks:"+c.domain, string(jwksJSON), c.ttl)
	}

	log.Info().Str("domain", c.domain).Msg("JWKS cache refreshed")
	return nil
}

// Auth creates the authentication middleware
func Auth(cfg AuthConfig) gin.HandlerFunc {
	// Initialize JWKS cache
	jwksCacheLock.Lock()
	if jwksCache == nil || jwksCache.domain != cfg.Domain {
		cacheTTL := cfg.CacheTTL
		if cacheTTL == 0 {
			cacheTTL = 1 * time.Hour
		}
		jwksCache = NewJWKSCache(cfg.Domain, cacheTTL, cfg.RedisClient)
	}
	jwksCacheLock.Unlock()

	// Build issuer URL
	issuer := cfg.Issuer
	if issuer == "" {
		issuer = fmt.Sprintf("https://%s/", cfg.Domain)
	}

	return func(c *gin.Context) {
		// Extract token from header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			respondUnauthorized(c, "Authorization header required")
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			respondUnauthorized(c, "Invalid authorization header format. Expected: Bearer <token>")
			return
		}

		tokenString := parts[1]

		// Parse token without verification first to get the header
		unverifiedToken, _, err := jwt.NewParser().ParseUnverified(tokenString, &Claims{})
		if err != nil {
			respondUnauthorized(c, "Invalid token format")
			return
		}

		// Get kid from header
		kid, ok := unverifiedToken.Header["kid"].(string)
		if !ok && !cfg.Development {
			respondUnauthorized(c, "Token missing key ID")
			return
		}

		var token *jwt.Token

		if cfg.Development {
			// Development mode: parse without signature verification
			parser := jwt.NewParser(
				jwt.WithIssuer(issuer),
				jwt.WithExpirationRequired(),
			)
			token, err = parser.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
				// Accept any key in development
				return jwt.UnsafeAllowNoneSignatureType, nil
			})
			if err != nil {
				// Try without any validation for local development tokens
				parser := jwt.NewParser(jwt.WithoutClaimsValidation())
				token, _, err = parser.ParseUnverified(tokenString, &Claims{})
				if err != nil {
					respondUnauthorized(c, "Invalid token")
					return
				}
			}
		} else {
			// Production mode: full verification
			// Get public key from JWKS
			publicKey, err := jwksCache.GetKey(kid)
			if err != nil {
				log.Error().Err(err).Str("kid", kid).Msg("Failed to get signing key")
				respondUnauthorized(c, "Invalid token signing key")
				return
			}

			// Parse and validate token
			parser := jwt.NewParser(
				jwt.WithIssuer(issuer),
				jwt.WithExpirationRequired(),
			)

			token, err = parser.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
				// Verify signing method
				if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				return publicKey, nil
			})

			if err != nil {
				handleTokenError(c, err)
				return
			}
		}

		// Extract claims
		claims, ok := token.Claims.(*Claims)
		if !ok {
			respondUnauthorized(c, "Invalid token claims")
			return
		}

		// Validate audience (support multiple audiences)
		if len(cfg.Audiences) > 0 && !cfg.Development {
			validAudience := false
			for _, aud := range cfg.Audiences {
				for _, tokenAud := range claims.Audience {
					if tokenAud == aud {
						validAudience = true
						break
					}
				}
				if validAudience {
					break
				}
			}
			if !validAudience {
				respondUnauthorized(c, "Invalid token audience")
				return
			}
		}

		// Check expiration (extra safety check)
		if claims.ExpiresAt != nil && claims.ExpiresAt.Before(time.Now()) {
			respondTokenExpired(c)
			return
		}

		// Set user info in context
		c.Set(string(ContextKeyUserID), claims.Subject)
		c.Set(string(ContextKeyEmail), claims.Email)
		c.Set(string(ContextKeyRoles), claims.Roles)
		c.Set(string(ContextKeyPermissions), claims.Permissions)
		c.Set(string(ContextKeyFestivalID), claims.FestivalID)
		c.Set(string(ContextKeyClaims), claims)

		// Also set for backwards compatibility
		c.Set("user_id", claims.Subject)
		c.Set("email", claims.Email)
		c.Set("roles", claims.Roles)
		c.Set("permissions", claims.Permissions)
		c.Set("festival_id", claims.FestivalID)

		c.Next()
	}
}

// AuthWithSimpleConfig creates auth middleware with simple string configuration (backwards compatible)
func AuthWithSimpleConfig(auth0Domain, auth0Audience string) gin.HandlerFunc {
	audiences := []string{}
	if auth0Audience != "" {
		audiences = append(audiences, auth0Audience)
	}
	return Auth(AuthConfig{
		Domain:      auth0Domain,
		Audiences:   audiences,
		Development: auth0Domain == "" || auth0Domain == "localhost",
	})
}

// OptionalAuth is like Auth but doesn't fail if no token is provided
func OptionalAuth(cfg AuthConfig) gin.HandlerFunc {
	authMiddleware := Auth(cfg)
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}
		authMiddleware(c)
	}
}

// handleTokenError handles different JWT validation errors
func handleTokenError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, jwt.ErrTokenExpired):
		respondTokenExpired(c)
	case errors.Is(err, jwt.ErrTokenNotValidYet):
		respondUnauthorized(c, "Token not yet valid")
	case errors.Is(err, jwt.ErrTokenMalformed):
		respondUnauthorized(c, "Malformed token")
	case errors.Is(err, jwt.ErrSignatureInvalid):
		respondUnauthorized(c, "Invalid token signature")
	default:
		log.Error().Err(err).Msg("Token validation error")
		respondUnauthorized(c, "Invalid token")
	}
}

// respondUnauthorized sends an unauthorized response
func respondUnauthorized(c *gin.Context, message string) {
	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
		"error": gin.H{
			"code":    "UNAUTHORIZED",
			"message": message,
		},
	})
}

// respondTokenExpired sends a token expired response with specific error code
func respondTokenExpired(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
		"error": gin.H{
			"code":    "TOKEN_EXPIRED",
			"message": "Token has expired. Please refresh your authentication.",
		},
	})
}

// Helper functions to extract user info from context

// GetUserID extracts user ID from context
func GetUserID(ctx context.Context) string {
	if ginCtx, ok := ctx.(*gin.Context); ok {
		if userID, exists := ginCtx.Get(string(ContextKeyUserID)); exists {
			if id, ok := userID.(string); ok {
				return id
			}
		}
		// Fallback to old key
		return ginCtx.GetString("user_id")
	}
	return ""
}

// GetEmail extracts email from context
func GetEmail(ctx context.Context) string {
	if ginCtx, ok := ctx.(*gin.Context); ok {
		if email, exists := ginCtx.Get(string(ContextKeyEmail)); exists {
			if e, ok := email.(string); ok {
				return e
			}
		}
		return ginCtx.GetString("email")
	}
	return ""
}

// GetRoles extracts roles from context
func GetRoles(ctx context.Context) []string {
	if ginCtx, ok := ctx.(*gin.Context); ok {
		if roles, exists := ginCtx.Get(string(ContextKeyRoles)); exists {
			if r, ok := roles.([]string); ok {
				return r
			}
		}
		// Fallback
		if roles, exists := ginCtx.Get("roles"); exists {
			if r, ok := roles.([]string); ok {
				return r
			}
		}
	}
	return nil
}

// GetPermissions extracts permissions from context
func GetPermissions(ctx context.Context) []string {
	if ginCtx, ok := ctx.(*gin.Context); ok {
		if perms, exists := ginCtx.Get(string(ContextKeyPermissions)); exists {
			if p, ok := perms.([]string); ok {
				return p
			}
		}
		if perms, exists := ginCtx.Get("permissions"); exists {
			if p, ok := perms.([]string); ok {
				return p
			}
		}
	}
	return nil
}

// GetFestivalID extracts festival ID from context
func GetFestivalID(ctx context.Context) string {
	if ginCtx, ok := ctx.(*gin.Context); ok {
		if festivalID, exists := ginCtx.Get(string(ContextKeyFestivalID)); exists {
			if id, ok := festivalID.(string); ok {
				return id
			}
		}
		return ginCtx.GetString("festival_id")
	}
	return ""
}

// GetClaims extracts full claims from context
func GetClaims(ctx context.Context) *Claims {
	if ginCtx, ok := ctx.(*gin.Context); ok {
		if claims, exists := ginCtx.Get(string(ContextKeyClaims)); exists {
			if c, ok := claims.(*Claims); ok {
				return c
			}
		}
	}
	return nil
}

// HasRole checks if the user has a specific role
func HasRole(ctx context.Context, role string) bool {
	roles := GetRoles(ctx)
	for _, r := range roles {
		if r == role {
			return true
		}
	}
	return false
}

// HasAnyRole checks if the user has any of the specified roles
func HasAnyRole(ctx context.Context, roles ...string) bool {
	userRoles := GetRoles(ctx)
	for _, userRole := range userRoles {
		for _, role := range roles {
			if userRole == role {
				return true
			}
		}
	}
	return false
}

// HasPermission checks if the user has a specific permission
func HasPermission(ctx context.Context, permission string) bool {
	permissions := GetPermissions(ctx)
	for _, p := range permissions {
		if p == permission {
			return true
		}
	}
	return false
}

// BuildJWKSURL builds the JWKS URL for an Auth0 domain
func BuildJWKSURL(domain string) string {
	return fmt.Sprintf("https://%s/.well-known/jwks.json", domain)
}

// BuildIssuerURL builds the issuer URL for an Auth0 domain
func BuildIssuerURL(domain string) string {
	u := &url.URL{
		Scheme: "https",
		Host:   domain,
		Path:   "/",
	}
	return u.String()
}

// ============================================================================
// Brute Force Protection
// ============================================================================

// BruteForceConfig holds configuration for brute force protection
type BruteForceConfig struct {
	RedisClient        *redis.Client
	MaxAttempts        int           // Maximum failed attempts before lockout
	LockoutDuration    time.Duration // How long to lock out after max attempts
	AttemptWindow      time.Duration // Time window for counting attempts
	KeyPrefix          string        // Redis key prefix
	EnableIPBlocking   bool          // Block by IP address
	EnableUserBlocking bool          // Block by username/email
	ProgressiveLockout bool          // Increase lockout duration with each violation
}

// DefaultBruteForceConfig returns default configuration
func DefaultBruteForceConfig() BruteForceConfig {
	return BruteForceConfig{
		MaxAttempts:        5,
		LockoutDuration:    15 * time.Minute,
		AttemptWindow:      15 * time.Minute,
		KeyPrefix:          "bruteforce:",
		EnableIPBlocking:   true,
		EnableUserBlocking: true,
		ProgressiveLockout: true,
	}
}

// BruteForceProtector handles brute force protection
type BruteForceProtector struct {
	config BruteForceConfig
}

// NewBruteForceProtector creates a new brute force protector
func NewBruteForceProtector(cfg BruteForceConfig) *BruteForceProtector {
	return &BruteForceProtector{config: cfg}
}

// CheckAndRecord checks if an attempt is allowed and records the attempt
func (b *BruteForceProtector) CheckAndRecord(ctx context.Context, identifier string, isIP bool) (bool, time.Duration, error) {
	if b.config.RedisClient == nil {
		return true, 0, nil
	}

	var keyType string
	if isIP {
		if !b.config.EnableIPBlocking {
			return true, 0, nil
		}
		keyType = "ip"
	} else {
		if !b.config.EnableUserBlocking {
			return true, 0, nil
		}
		keyType = "user"
	}

	lockoutKey := fmt.Sprintf("%slockout:%s:%s", b.config.KeyPrefix, keyType, identifier)
	attemptsKey := fmt.Sprintf("%sattempts:%s:%s", b.config.KeyPrefix, keyType, identifier)

	// Check if currently locked out
	ttl, err := b.config.RedisClient.TTL(ctx, lockoutKey).Result()
	if err == nil && ttl > 0 {
		return false, ttl, nil
	}

	// Increment attempts
	count, err := b.config.RedisClient.Incr(ctx, attemptsKey).Result()
	if err != nil {
		log.Error().Err(err).Msg("Failed to increment brute force attempt counter")
		return true, 0, nil // Fail open
	}

	// Set expiry on first attempt
	if count == 1 {
		b.config.RedisClient.Expire(ctx, attemptsKey, b.config.AttemptWindow)
	}

	// Check if max attempts exceeded
	if count >= int64(b.config.MaxAttempts) {
		lockoutDuration := b.config.LockoutDuration

		// Progressive lockout: double duration for each subsequent lockout
		if b.config.ProgressiveLockout {
			lockoutCountKey := fmt.Sprintf("%slockout_count:%s:%s", b.config.KeyPrefix, keyType, identifier)
			lockoutCount, _ := b.config.RedisClient.Incr(ctx, lockoutCountKey).Result()
			b.config.RedisClient.Expire(ctx, lockoutCountKey, 24*time.Hour)

			// Cap at 24 hours
			multiplier := int64(1) << (lockoutCount - 1) // 2^(n-1)
			if multiplier > 96 {
				multiplier = 96 // Max 24 hours
			}
			lockoutDuration = time.Duration(multiplier) * b.config.LockoutDuration
		}

		// Set lockout
		b.config.RedisClient.Set(ctx, lockoutKey, "1", lockoutDuration)
		b.config.RedisClient.Del(ctx, attemptsKey)

		log.Warn().
			Str("identifier", identifier).
			Str("type", keyType).
			Dur("lockout_duration", lockoutDuration).
			Msg("Brute force lockout triggered")

		return false, lockoutDuration, nil
	}

	return true, 0, nil
}

// RecordSuccess clears failed attempts on successful authentication
func (b *BruteForceProtector) RecordSuccess(ctx context.Context, identifier string, isIP bool) {
	if b.config.RedisClient == nil {
		return
	}

	var keyType string
	if isIP {
		keyType = "ip"
	} else {
		keyType = "user"
	}

	attemptsKey := fmt.Sprintf("%sattempts:%s:%s", b.config.KeyPrefix, keyType, identifier)
	lockoutCountKey := fmt.Sprintf("%slockout_count:%s:%s", b.config.KeyPrefix, keyType, identifier)

	b.config.RedisClient.Del(ctx, attemptsKey, lockoutCountKey)
}

// IsLocked checks if an identifier is currently locked out
func (b *BruteForceProtector) IsLocked(ctx context.Context, identifier string, isIP bool) (bool, time.Duration) {
	if b.config.RedisClient == nil {
		return false, 0
	}

	var keyType string
	if isIP {
		keyType = "ip"
	} else {
		keyType = "user"
	}

	lockoutKey := fmt.Sprintf("%slockout:%s:%s", b.config.KeyPrefix, keyType, identifier)
	ttl, err := b.config.RedisClient.TTL(ctx, lockoutKey).Result()
	if err != nil || ttl <= 0 {
		return false, 0
	}
	return true, ttl
}

// BruteForceProtection creates middleware for brute force protection
func BruteForceProtection(cfg BruteForceConfig) gin.HandlerFunc {
	protector := NewBruteForceProtector(cfg)

	return func(c *gin.Context) {
		clientIP := c.ClientIP()

		// Check IP lockout
		if locked, ttl := protector.IsLocked(c.Request.Context(), clientIP, true); locked {
			respondLocked(c, ttl)
			return
		}

		c.Set("brute_force_protector", protector)
		c.Next()
	}
}

// respondLocked sends a locked out response
func respondLocked(c *gin.Context, retryAfter time.Duration) {
	c.Header("Retry-After", fmt.Sprintf("%d", int(retryAfter.Seconds())))
	c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
		"error": gin.H{
			"code":        "ACCOUNT_LOCKED",
			"message":     "Too many failed attempts. Please try again later.",
			"retry_after": int(retryAfter.Seconds()),
		},
	})
}

// ============================================================================
// Session Management
// ============================================================================

// SessionConfig holds configuration for session management
type SessionConfig struct {
	RedisClient       *redis.Client
	SessionDuration   time.Duration
	MaxSessions       int    // Maximum concurrent sessions per user
	EnableRotation    bool   // Rotate session ID on privilege change
	CookieName        string
	CookieSecure      bool
	CookieHTTPOnly    bool
	CookieSameSite    http.SameSite
	KeyPrefix         string
}

// DefaultSessionConfig returns default session configuration
func DefaultSessionConfig() SessionConfig {
	return SessionConfig{
		SessionDuration: 24 * time.Hour,
		MaxSessions:     5,
		EnableRotation:  true,
		CookieName:      "session_id",
		CookieSecure:    true,
		CookieHTTPOnly:  true,
		CookieSameSite:  http.SameSiteStrictMode,
		KeyPrefix:       "session:",
	}
}

// SessionData represents session information
type SessionData struct {
	ID           string            `json:"id"`
	UserID       string            `json:"user_id"`
	CreatedAt    time.Time         `json:"created_at"`
	LastActivity time.Time         `json:"last_activity"`
	IPAddress    string            `json:"ip_address"`
	UserAgent    string            `json:"user_agent"`
	Fingerprint  string            `json:"fingerprint"`
	Data         map[string]string `json:"data,omitempty"`
}

// SessionManager handles session management
type SessionManager struct {
	config SessionConfig
}

// NewSessionManager creates a new session manager
func NewSessionManager(cfg SessionConfig) *SessionManager {
	return &SessionManager{config: cfg}
}

// CreateSession creates a new session
func (s *SessionManager) CreateSession(ctx context.Context, userID, ipAddress, userAgent string) (*SessionData, error) {
	if s.config.RedisClient == nil {
		return nil, errors.New("redis client not configured")
	}

	// Generate session ID
	sessionID, err := generateSecureToken(32)
	if err != nil {
		return nil, fmt.Errorf("failed to generate session ID: %w", err)
	}

	// Generate fingerprint from IP and User-Agent
	fingerprint := generateFingerprint(ipAddress, userAgent)

	session := &SessionData{
		ID:           sessionID,
		UserID:       userID,
		CreatedAt:    time.Now(),
		LastActivity: time.Now(),
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
		Fingerprint:  fingerprint,
		Data:         make(map[string]string),
	}

	// Store session
	sessionKey := s.config.KeyPrefix + sessionID
	data, _ := json.Marshal(session)
	if err := s.config.RedisClient.Set(ctx, sessionKey, data, s.config.SessionDuration).Err(); err != nil {
		return nil, fmt.Errorf("failed to store session: %w", err)
	}

	// Add to user's session list
	userSessionsKey := s.config.KeyPrefix + "user:" + userID
	s.config.RedisClient.SAdd(ctx, userSessionsKey, sessionID)
	s.config.RedisClient.Expire(ctx, userSessionsKey, s.config.SessionDuration)

	// Enforce max sessions
	if s.config.MaxSessions > 0 {
		s.enforceMaxSessions(ctx, userID)
	}

	return session, nil
}

// GetSession retrieves a session
func (s *SessionManager) GetSession(ctx context.Context, sessionID string) (*SessionData, error) {
	if s.config.RedisClient == nil {
		return nil, errors.New("redis client not configured")
	}

	sessionKey := s.config.KeyPrefix + sessionID
	data, err := s.config.RedisClient.Get(ctx, sessionKey).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	var session SessionData
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, fmt.Errorf("failed to unmarshal session: %w", err)
	}

	return &session, nil
}

// ValidateSession validates a session and checks for fixation
func (s *SessionManager) ValidateSession(ctx context.Context, sessionID, ipAddress, userAgent string) (*SessionData, bool, error) {
	session, err := s.GetSession(ctx, sessionID)
	if err != nil {
		return nil, false, err
	}
	if session == nil {
		return nil, false, nil
	}

	// Check for session fixation (fingerprint mismatch)
	currentFingerprint := generateFingerprint(ipAddress, userAgent)
	if session.Fingerprint != currentFingerprint {
		log.Warn().
			Str("session_id", sessionID).
			Str("original_ip", session.IPAddress).
			Str("current_ip", ipAddress).
			Msg("Potential session fixation detected")

		// Invalidate the session
		s.DestroySession(ctx, sessionID)
		return nil, false, nil
	}

	// Update last activity
	session.LastActivity = time.Now()
	sessionKey := s.config.KeyPrefix + sessionID
	data, _ := json.Marshal(session)
	s.config.RedisClient.Set(ctx, sessionKey, data, s.config.SessionDuration)

	return session, true, nil
}

// RotateSession creates a new session ID while preserving session data
func (s *SessionManager) RotateSession(ctx context.Context, oldSessionID string) (*SessionData, error) {
	session, err := s.GetSession(ctx, oldSessionID)
	if err != nil || session == nil {
		return nil, errors.New("session not found")
	}

	// Generate new session ID
	newSessionID, err := generateSecureToken(32)
	if err != nil {
		return nil, fmt.Errorf("failed to generate new session ID: %w", err)
	}

	// Update session with new ID
	oldID := session.ID
	session.ID = newSessionID

	// Store new session
	newSessionKey := s.config.KeyPrefix + newSessionID
	data, _ := json.Marshal(session)
	if err := s.config.RedisClient.Set(ctx, newSessionKey, data, s.config.SessionDuration).Err(); err != nil {
		return nil, fmt.Errorf("failed to store rotated session: %w", err)
	}

	// Update user's session list
	userSessionsKey := s.config.KeyPrefix + "user:" + session.UserID
	s.config.RedisClient.SRem(ctx, userSessionsKey, oldID)
	s.config.RedisClient.SAdd(ctx, userSessionsKey, newSessionID)

	// Delete old session
	oldSessionKey := s.config.KeyPrefix + oldID
	s.config.RedisClient.Del(ctx, oldSessionKey)

	log.Info().
		Str("user_id", session.UserID).
		Str("old_session", oldID[:8]+"...").
		Str("new_session", newSessionID[:8]+"...").
		Msg("Session rotated")

	return session, nil
}

// DestroySession destroys a session
func (s *SessionManager) DestroySession(ctx context.Context, sessionID string) error {
	if s.config.RedisClient == nil {
		return nil
	}

	session, err := s.GetSession(ctx, sessionID)
	if err != nil || session == nil {
		return nil
	}

	// Remove from user's session list
	userSessionsKey := s.config.KeyPrefix + "user:" + session.UserID
	s.config.RedisClient.SRem(ctx, userSessionsKey, sessionID)

	// Delete session
	sessionKey := s.config.KeyPrefix + sessionID
	return s.config.RedisClient.Del(ctx, sessionKey).Err()
}

// DestroyAllUserSessions destroys all sessions for a user
func (s *SessionManager) DestroyAllUserSessions(ctx context.Context, userID string) error {
	if s.config.RedisClient == nil {
		return nil
	}

	userSessionsKey := s.config.KeyPrefix + "user:" + userID
	sessionIDs, err := s.config.RedisClient.SMembers(ctx, userSessionsKey).Result()
	if err != nil {
		return err
	}

	for _, sessionID := range sessionIDs {
		sessionKey := s.config.KeyPrefix + sessionID
		s.config.RedisClient.Del(ctx, sessionKey)
	}

	return s.config.RedisClient.Del(ctx, userSessionsKey).Err()
}

// enforceMaxSessions removes oldest sessions if limit exceeded
func (s *SessionManager) enforceMaxSessions(ctx context.Context, userID string) {
	userSessionsKey := s.config.KeyPrefix + "user:" + userID
	sessionIDs, err := s.config.RedisClient.SMembers(ctx, userSessionsKey).Result()
	if err != nil || len(sessionIDs) <= s.config.MaxSessions {
		return
	}

	// Get all sessions with their creation time
	type sessionInfo struct {
		ID        string
		CreatedAt time.Time
	}
	var sessions []sessionInfo

	for _, sessionID := range sessionIDs {
		session, err := s.GetSession(ctx, sessionID)
		if err != nil || session == nil {
			// Remove invalid session
			s.config.RedisClient.SRem(ctx, userSessionsKey, sessionID)
			continue
		}
		sessions = append(sessions, sessionInfo{ID: sessionID, CreatedAt: session.CreatedAt})
	}

	// Sort by creation time (oldest first)
	for i := 0; i < len(sessions)-1; i++ {
		for j := i + 1; j < len(sessions); j++ {
			if sessions[i].CreatedAt.After(sessions[j].CreatedAt) {
				sessions[i], sessions[j] = sessions[j], sessions[i]
			}
		}
	}

	// Remove oldest sessions
	for i := 0; i < len(sessions)-s.config.MaxSessions; i++ {
		s.DestroySession(ctx, sessions[i].ID)
	}
}

// ============================================================================
// Refresh Token Management
// ============================================================================

// RefreshTokenConfig holds configuration for refresh token management
type RefreshTokenConfig struct {
	RedisClient        *redis.Client
	TokenDuration      time.Duration
	MaxTokensPerUser   int
	EnableRevocation   bool
	EnableRotation     bool
	KeyPrefix          string
	TokenLength        int
}

// DefaultRefreshTokenConfig returns default configuration
func DefaultRefreshTokenConfig() RefreshTokenConfig {
	return RefreshTokenConfig{
		TokenDuration:    7 * 24 * time.Hour, // 7 days
		MaxTokensPerUser: 10,
		EnableRevocation: true,
		EnableRotation:   true,
		KeyPrefix:        "refresh_token:",
		TokenLength:      64,
	}
}

// RefreshToken represents a refresh token
type RefreshToken struct {
	Token      string    `json:"token"`
	UserID     string    `json:"user_id"`
	DeviceID   string    `json:"device_id,omitempty"`
	IPAddress  string    `json:"ip_address"`
	UserAgent  string    `json:"user_agent"`
	CreatedAt  time.Time `json:"created_at"`
	ExpiresAt  time.Time `json:"expires_at"`
	LastUsedAt time.Time `json:"last_used_at"`
	Revoked    bool      `json:"revoked"`
	Family     string    `json:"family"` // Token family for rotation
}

// RefreshTokenManager handles refresh token operations
type RefreshTokenManager struct {
	config RefreshTokenConfig
}

// NewRefreshTokenManager creates a new refresh token manager
func NewRefreshTokenManager(cfg RefreshTokenConfig) *RefreshTokenManager {
	return &RefreshTokenManager{config: cfg}
}

// GenerateToken generates a new refresh token
func (r *RefreshTokenManager) GenerateToken(ctx context.Context, userID, deviceID, ipAddress, userAgent string) (*RefreshToken, error) {
	if r.config.RedisClient == nil {
		return nil, errors.New("redis client not configured")
	}

	// Generate secure token
	tokenStr, err := generateSecureToken(r.config.TokenLength)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// Generate token family
	family, err := generateSecureToken(16)
	if err != nil {
		return nil, fmt.Errorf("failed to generate family: %w", err)
	}

	token := &RefreshToken{
		Token:      tokenStr,
		UserID:     userID,
		DeviceID:   deviceID,
		IPAddress:  ipAddress,
		UserAgent:  userAgent,
		CreatedAt:  time.Now(),
		ExpiresAt:  time.Now().Add(r.config.TokenDuration),
		LastUsedAt: time.Now(),
		Revoked:    false,
		Family:     family,
	}

	// Store token
	tokenKey := r.config.KeyPrefix + tokenStr
	data, _ := json.Marshal(token)
	if err := r.config.RedisClient.Set(ctx, tokenKey, data, r.config.TokenDuration).Err(); err != nil {
		return nil, fmt.Errorf("failed to store token: %w", err)
	}

	// Add to user's token list
	userTokensKey := r.config.KeyPrefix + "user:" + userID
	r.config.RedisClient.SAdd(ctx, userTokensKey, tokenStr)
	r.config.RedisClient.Expire(ctx, userTokensKey, r.config.TokenDuration)

	// Store family mapping
	familyKey := r.config.KeyPrefix + "family:" + family
	r.config.RedisClient.Set(ctx, familyKey, tokenStr, r.config.TokenDuration)

	// Enforce max tokens per user
	if r.config.MaxTokensPerUser > 0 {
		r.enforceMaxTokens(ctx, userID)
	}

	return token, nil
}

// ValidateToken validates a refresh token
func (r *RefreshTokenManager) ValidateToken(ctx context.Context, tokenStr string) (*RefreshToken, error) {
	if r.config.RedisClient == nil {
		return nil, errors.New("redis client not configured")
	}

	tokenKey := r.config.KeyPrefix + tokenStr
	data, err := r.config.RedisClient.Get(ctx, tokenKey).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, errors.New("token not found")
		}
		return nil, fmt.Errorf("failed to get token: %w", err)
	}

	var token RefreshToken
	if err := json.Unmarshal(data, &token); err != nil {
		return nil, fmt.Errorf("failed to unmarshal token: %w", err)
	}

	// Check if revoked
	if token.Revoked {
		// Token reuse detected - revoke entire family
		if r.config.EnableRotation {
			r.RevokeFamily(ctx, token.Family)
		}
		return nil, errors.New("token has been revoked")
	}

	// Check expiration
	if time.Now().After(token.ExpiresAt) {
		return nil, errors.New("token has expired")
	}

	return &token, nil
}

// RotateToken rotates a refresh token (issues new token, revokes old)
func (r *RefreshTokenManager) RotateToken(ctx context.Context, oldTokenStr, ipAddress, userAgent string) (*RefreshToken, error) {
	oldToken, err := r.ValidateToken(ctx, oldTokenStr)
	if err != nil {
		return nil, err
	}

	// Generate new token with same family
	newTokenStr, err := generateSecureToken(r.config.TokenLength)
	if err != nil {
		return nil, fmt.Errorf("failed to generate new token: %w", err)
	}

	newToken := &RefreshToken{
		Token:      newTokenStr,
		UserID:     oldToken.UserID,
		DeviceID:   oldToken.DeviceID,
		IPAddress:  ipAddress,
		UserAgent:  userAgent,
		CreatedAt:  time.Now(),
		ExpiresAt:  time.Now().Add(r.config.TokenDuration),
		LastUsedAt: time.Now(),
		Revoked:    false,
		Family:     oldToken.Family,
	}

	// Store new token
	newTokenKey := r.config.KeyPrefix + newTokenStr
	data, _ := json.Marshal(newToken)
	if err := r.config.RedisClient.Set(ctx, newTokenKey, data, r.config.TokenDuration).Err(); err != nil {
		return nil, fmt.Errorf("failed to store new token: %w", err)
	}

	// Update user's token list
	userTokensKey := r.config.KeyPrefix + "user:" + oldToken.UserID
	r.config.RedisClient.SRem(ctx, userTokensKey, oldTokenStr)
	r.config.RedisClient.SAdd(ctx, userTokensKey, newTokenStr)

	// Update family mapping
	familyKey := r.config.KeyPrefix + "family:" + oldToken.Family
	r.config.RedisClient.Set(ctx, familyKey, newTokenStr, r.config.TokenDuration)

	// Mark old token as revoked (don't delete, for reuse detection)
	oldToken.Revoked = true
	oldTokenKey := r.config.KeyPrefix + oldTokenStr
	oldData, _ := json.Marshal(oldToken)
	r.config.RedisClient.Set(ctx, oldTokenKey, oldData, 24*time.Hour) // Keep for 24h for reuse detection

	log.Info().
		Str("user_id", oldToken.UserID).
		Str("family", oldToken.Family).
		Msg("Refresh token rotated")

	return newToken, nil
}

// RevokeToken revokes a specific token
func (r *RefreshTokenManager) RevokeToken(ctx context.Context, tokenStr string) error {
	if r.config.RedisClient == nil {
		return nil
	}

	token, err := r.ValidateToken(ctx, tokenStr)
	if err != nil {
		return err
	}

	// Mark as revoked
	token.Revoked = true
	tokenKey := r.config.KeyPrefix + tokenStr
	data, _ := json.Marshal(token)
	r.config.RedisClient.Set(ctx, tokenKey, data, 24*time.Hour)

	// Remove from user's token list
	userTokensKey := r.config.KeyPrefix + "user:" + token.UserID
	r.config.RedisClient.SRem(ctx, userTokensKey, tokenStr)

	return nil
}

// RevokeFamily revokes all tokens in a family (for security breach)
func (r *RefreshTokenManager) RevokeFamily(ctx context.Context, family string) error {
	if r.config.RedisClient == nil {
		return nil
	}

	familyKey := r.config.KeyPrefix + "family:" + family
	tokenStr, err := r.config.RedisClient.Get(ctx, familyKey).Result()
	if err != nil {
		return err
	}

	// Revoke the current token
	r.RevokeToken(ctx, tokenStr)

	// Delete family mapping
	r.config.RedisClient.Del(ctx, familyKey)

	log.Warn().
		Str("family", family).
		Msg("Token family revoked due to potential token reuse")

	return nil
}

// RevokeAllUserTokens revokes all refresh tokens for a user
func (r *RefreshTokenManager) RevokeAllUserTokens(ctx context.Context, userID string) error {
	if r.config.RedisClient == nil {
		return nil
	}

	userTokensKey := r.config.KeyPrefix + "user:" + userID
	tokenStrs, err := r.config.RedisClient.SMembers(ctx, userTokensKey).Result()
	if err != nil {
		return err
	}

	for _, tokenStr := range tokenStrs {
		r.RevokeToken(ctx, tokenStr)
	}

	return r.config.RedisClient.Del(ctx, userTokensKey).Err()
}

// enforceMaxTokens removes oldest tokens if limit exceeded
func (r *RefreshTokenManager) enforceMaxTokens(ctx context.Context, userID string) {
	userTokensKey := r.config.KeyPrefix + "user:" + userID
	tokenStrs, err := r.config.RedisClient.SMembers(ctx, userTokensKey).Result()
	if err != nil || len(tokenStrs) <= r.config.MaxTokensPerUser {
		return
	}

	// Get all tokens with their creation time
	type tokenInfo struct {
		Token     string
		CreatedAt time.Time
	}
	var tokens []tokenInfo

	for _, tokenStr := range tokenStrs {
		token, err := r.ValidateToken(ctx, tokenStr)
		if err != nil {
			// Remove invalid token
			r.config.RedisClient.SRem(ctx, userTokensKey, tokenStr)
			r.config.RedisClient.Del(ctx, r.config.KeyPrefix+tokenStr)
			continue
		}
		tokens = append(tokens, tokenInfo{Token: tokenStr, CreatedAt: token.CreatedAt})
	}

	// Sort by creation time (oldest first)
	for i := 0; i < len(tokens)-1; i++ {
		for j := i + 1; j < len(tokens); j++ {
			if tokens[i].CreatedAt.After(tokens[j].CreatedAt) {
				tokens[i], tokens[j] = tokens[j], tokens[i]
			}
		}
	}

	// Remove oldest tokens
	for i := 0; i < len(tokens)-r.config.MaxTokensPerUser; i++ {
		r.RevokeToken(ctx, tokens[i].Token)
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

// generateSecureToken generates a cryptographically secure random token
func generateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := cryptoRand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// generateFingerprint generates a fingerprint from IP and User-Agent
func generateFingerprint(ipAddress, userAgent string) string {
	data := ipAddress + "|" + userAgent
	hash := sha256.Sum256([]byte(data))
	return base64.URLEncoding.EncodeToString(hash[:16])
}
