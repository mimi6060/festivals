package middleware

import (
	"context"
	"crypto/rsa"
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
