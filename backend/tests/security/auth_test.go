package security_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mimi6060/festivals/backend/internal/middleware"
)

// ============================================================================
// Brute Force Protection Tests
// ============================================================================

func setupBruteForceTestRedis(t *testing.T) *redis.Client {
	// Use a test Redis instance (or mock)
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15, // Use a separate DB for tests
	})

	// Check if Redis is available
	if err := client.Ping(context.Background()).Err(); err != nil {
		t.Skip("Redis not available for testing")
	}

	// Clean up test data
	client.FlushDB(context.Background())

	return client
}

func TestBruteForceProtection(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.BruteForceConfig{
		RedisClient:        redisClient,
		MaxAttempts:        3,
		LockoutDuration:    1 * time.Minute,
		AttemptWindow:      5 * time.Minute,
		KeyPrefix:          "test:bruteforce:",
		EnableIPBlocking:   true,
		EnableUserBlocking: true,
		ProgressiveLockout: false,
	}

	protector := middleware.NewBruteForceProtector(cfg)
	ctx := context.Background()
	testIP := "192.168.1.100"

	// First 3 attempts should be allowed
	for i := 0; i < 3; i++ {
		allowed, _, err := protector.CheckAndRecord(ctx, testIP, true)
		require.NoError(t, err)
		assert.True(t, allowed, "Attempt %d should be allowed", i+1)
	}

	// 4th attempt should be blocked
	allowed, lockoutDuration, err := protector.CheckAndRecord(ctx, testIP, true)
	require.NoError(t, err)
	assert.False(t, allowed, "Attempt after max should be blocked")
	assert.Greater(t, lockoutDuration, time.Duration(0), "Should have lockout duration")
}

func TestBruteForceProgressiveLockout(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.BruteForceConfig{
		RedisClient:        redisClient,
		MaxAttempts:        2,
		LockoutDuration:    1 * time.Second,
		AttemptWindow:      5 * time.Minute,
		KeyPrefix:          "test:bruteforce:progressive:",
		EnableIPBlocking:   true,
		ProgressiveLockout: true,
	}

	protector := middleware.NewBruteForceProtector(cfg)
	ctx := context.Background()
	testIP := "192.168.1.101"

	// Trigger first lockout
	for i := 0; i < 3; i++ {
		protector.CheckAndRecord(ctx, testIP, true)
	}

	// Check first lockout duration
	locked, duration1 := protector.IsLocked(ctx, testIP, true)
	assert.True(t, locked, "Should be locked after first violation")
	t.Logf("First lockout duration: %v", duration1)

	// Wait for lockout to expire
	time.Sleep(2 * time.Second)

	// Trigger second lockout
	for i := 0; i < 3; i++ {
		protector.CheckAndRecord(ctx, testIP, true)
	}

	// Second lockout should be longer (progressive)
	locked, duration2 := protector.IsLocked(ctx, testIP, true)
	assert.True(t, locked, "Should be locked after second violation")
	assert.Greater(t, duration2, duration1, "Progressive lockout should increase duration")
	t.Logf("Second lockout duration: %v", duration2)
}

func TestBruteForceSuccessReset(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.BruteForceConfig{
		RedisClient:      redisClient,
		MaxAttempts:      3,
		LockoutDuration:  1 * time.Minute,
		AttemptWindow:    5 * time.Minute,
		KeyPrefix:        "test:bruteforce:reset:",
		EnableIPBlocking: true,
	}

	protector := middleware.NewBruteForceProtector(cfg)
	ctx := context.Background()
	testIP := "192.168.1.102"

	// Make 2 failed attempts
	for i := 0; i < 2; i++ {
		protector.CheckAndRecord(ctx, testIP, true)
	}

	// Simulate successful login
	protector.RecordSuccess(ctx, testIP, true)

	// Should be able to make 3 more attempts now
	for i := 0; i < 3; i++ {
		allowed, _, err := protector.CheckAndRecord(ctx, testIP, true)
		require.NoError(t, err)
		assert.True(t, allowed, "Attempt %d after reset should be allowed", i+1)
	}
}

func TestBruteForceMiddleware(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()

	cfg := middleware.BruteForceConfig{
		RedisClient:      redisClient,
		MaxAttempts:      2,
		LockoutDuration:  1 * time.Minute,
		AttemptWindow:    5 * time.Minute,
		KeyPrefix:        "test:bruteforce:middleware:",
		EnableIPBlocking: true,
	}

	router.Use(middleware.BruteForceProtection(cfg))

	router.POST("/login", func(c *gin.Context) {
		// Get protector from context
		protectorInterface, exists := c.Get("brute_force_protector")
		if exists {
			protector := protectorInterface.(*middleware.BruteForceProtector)
			// Simulate failed login
			protector.CheckAndRecord(c.Request.Context(), c.ClientIP(), true)
		}
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
	})

	// First 2 requests should pass
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest("POST", "/login", nil)
		req.RemoteAddr = "192.168.1.103:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusUnauthorized, w.Code, "Request %d should reach handler", i+1)
	}

	// 3rd request should be blocked by middleware
	req := httptest.NewRequest("POST", "/login", nil)
	req.RemoteAddr = "192.168.1.103:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code, "Request should be blocked by brute force protection")
}

// ============================================================================
// Session Management Tests
// ============================================================================

func TestSessionCreation(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.SessionConfig{
		RedisClient:     redisClient,
		SessionDuration: 1 * time.Hour,
		MaxSessions:     5,
		EnableRotation:  true,
		KeyPrefix:       "test:session:",
	}

	manager := middleware.NewSessionManager(cfg)
	ctx := context.Background()

	session, err := manager.CreateSession(ctx, "user123", "192.168.1.1", "Mozilla/5.0")
	require.NoError(t, err)
	require.NotNil(t, session)

	assert.NotEmpty(t, session.ID)
	assert.Equal(t, "user123", session.UserID)
	assert.Equal(t, "192.168.1.1", session.IPAddress)
	assert.NotEmpty(t, session.Fingerprint)
}

func TestSessionValidation(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.SessionConfig{
		RedisClient:     redisClient,
		SessionDuration: 1 * time.Hour,
		KeyPrefix:       "test:session:validate:",
	}

	manager := middleware.NewSessionManager(cfg)
	ctx := context.Background()

	// Create session
	session, err := manager.CreateSession(ctx, "user456", "192.168.1.2", "Mozilla/5.0")
	require.NoError(t, err)

	// Validate with same fingerprint
	validatedSession, valid, err := manager.ValidateSession(ctx, session.ID, "192.168.1.2", "Mozilla/5.0")
	require.NoError(t, err)
	assert.True(t, valid)
	assert.NotNil(t, validatedSession)
}

func TestSessionFixationDetection(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.SessionConfig{
		RedisClient:     redisClient,
		SessionDuration: 1 * time.Hour,
		KeyPrefix:       "test:session:fixation:",
	}

	manager := middleware.NewSessionManager(cfg)
	ctx := context.Background()

	// Create session with one fingerprint
	session, err := manager.CreateSession(ctx, "user789", "192.168.1.3", "Mozilla/5.0")
	require.NoError(t, err)

	// Try to use session with different fingerprint (potential session fixation)
	_, valid, err := manager.ValidateSession(ctx, session.ID, "10.0.0.1", "Different Browser")
	require.NoError(t, err)
	assert.False(t, valid, "Session should be invalidated on fingerprint mismatch")

	// Original session should now be destroyed
	originalSession, err := manager.GetSession(ctx, session.ID)
	require.NoError(t, err)
	assert.Nil(t, originalSession, "Session should be destroyed after fixation attempt")
}

func TestSessionRotation(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.SessionConfig{
		RedisClient:     redisClient,
		SessionDuration: 1 * time.Hour,
		EnableRotation:  true,
		KeyPrefix:       "test:session:rotation:",
	}

	manager := middleware.NewSessionManager(cfg)
	ctx := context.Background()

	// Create original session
	originalSession, err := manager.CreateSession(ctx, "user101", "192.168.1.4", "Mozilla/5.0")
	require.NoError(t, err)
	originalID := originalSession.ID

	// Rotate session
	rotatedSession, err := manager.RotateSession(ctx, originalID)
	require.NoError(t, err)
	assert.NotEqual(t, originalID, rotatedSession.ID, "Session ID should change after rotation")
	assert.Equal(t, originalSession.UserID, rotatedSession.UserID, "User ID should be preserved")

	// Old session should be invalid
	oldSession, err := manager.GetSession(ctx, originalID)
	require.NoError(t, err)
	assert.Nil(t, oldSession, "Old session should be deleted after rotation")

	// New session should be valid
	newSession, err := manager.GetSession(ctx, rotatedSession.ID)
	require.NoError(t, err)
	assert.NotNil(t, newSession)
}

func TestMaxSessionsEnforcement(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.SessionConfig{
		RedisClient:     redisClient,
		SessionDuration: 1 * time.Hour,
		MaxSessions:     3,
		KeyPrefix:       "test:session:max:",
	}

	manager := middleware.NewSessionManager(cfg)
	ctx := context.Background()
	userID := "user_max_sessions"

	// Create more sessions than the limit
	var sessions []*middleware.SessionData
	for i := 0; i < 5; i++ {
		session, err := manager.CreateSession(ctx, userID, "192.168.1."+string(rune('0'+i)), "Mozilla/5.0")
		require.NoError(t, err)
		sessions = append(sessions, session)
		time.Sleep(10 * time.Millisecond) // Ensure different timestamps
	}

	// Check that only MaxSessions are active
	activeCount := 0
	for _, session := range sessions {
		s, err := manager.GetSession(ctx, session.ID)
		require.NoError(t, err)
		if s != nil {
			activeCount++
		}
	}

	assert.Equal(t, cfg.MaxSessions, activeCount, "Should only have MaxSessions active sessions")
}

func TestDestroyAllUserSessions(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.SessionConfig{
		RedisClient:     redisClient,
		SessionDuration: 1 * time.Hour,
		MaxSessions:     10,
		KeyPrefix:       "test:session:destroy:",
	}

	manager := middleware.NewSessionManager(cfg)
	ctx := context.Background()
	userID := "user_destroy"

	// Create multiple sessions
	var sessionIDs []string
	for i := 0; i < 3; i++ {
		session, err := manager.CreateSession(ctx, userID, "192.168.1.100", "Mozilla/5.0")
		require.NoError(t, err)
		sessionIDs = append(sessionIDs, session.ID)
	}

	// Destroy all sessions
	err := manager.DestroyAllUserSessions(ctx, userID)
	require.NoError(t, err)

	// Verify all sessions are destroyed
	for _, sessionID := range sessionIDs {
		session, err := manager.GetSession(ctx, sessionID)
		require.NoError(t, err)
		assert.Nil(t, session, "All sessions should be destroyed")
	}
}

// ============================================================================
// Refresh Token Tests
// ============================================================================

func TestRefreshTokenGeneration(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.RefreshTokenConfig{
		RedisClient:      redisClient,
		TokenDuration:    7 * 24 * time.Hour,
		MaxTokensPerUser: 10,
		EnableRevocation: true,
		EnableRotation:   true,
		KeyPrefix:        "test:refresh:",
		TokenLength:      64,
	}

	manager := middleware.NewRefreshTokenManager(cfg)
	ctx := context.Background()

	token, err := manager.GenerateToken(ctx, "user_refresh", "device1", "192.168.1.1", "Mozilla/5.0")
	require.NoError(t, err)
	require.NotNil(t, token)

	assert.NotEmpty(t, token.Token)
	assert.Equal(t, "user_refresh", token.UserID)
	assert.Equal(t, "device1", token.DeviceID)
	assert.NotEmpty(t, token.Family)
	assert.False(t, token.Revoked)
}

func TestRefreshTokenValidation(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.RefreshTokenConfig{
		RedisClient:   redisClient,
		TokenDuration: 7 * 24 * time.Hour,
		KeyPrefix:     "test:refresh:validate:",
		TokenLength:   64,
	}

	manager := middleware.NewRefreshTokenManager(cfg)
	ctx := context.Background()

	// Generate token
	token, err := manager.GenerateToken(ctx, "user_validate", "device1", "192.168.1.1", "Mozilla/5.0")
	require.NoError(t, err)

	// Validate token
	validatedToken, err := manager.ValidateToken(ctx, token.Token)
	require.NoError(t, err)
	assert.NotNil(t, validatedToken)
	assert.Equal(t, token.UserID, validatedToken.UserID)
}

func TestRefreshTokenRotation(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.RefreshTokenConfig{
		RedisClient:    redisClient,
		TokenDuration:  7 * 24 * time.Hour,
		EnableRotation: true,
		KeyPrefix:      "test:refresh:rotation:",
		TokenLength:    64,
	}

	manager := middleware.NewRefreshTokenManager(cfg)
	ctx := context.Background()

	// Generate initial token
	originalToken, err := manager.GenerateToken(ctx, "user_rotate", "device1", "192.168.1.1", "Mozilla/5.0")
	require.NoError(t, err)

	// Rotate token
	newToken, err := manager.RotateToken(ctx, originalToken.Token, "192.168.1.1", "Mozilla/5.0")
	require.NoError(t, err)
	assert.NotEqual(t, originalToken.Token, newToken.Token, "Token should change after rotation")
	assert.Equal(t, originalToken.Family, newToken.Family, "Token family should be preserved")
	assert.Equal(t, originalToken.UserID, newToken.UserID, "User ID should be preserved")

	// Old token should be revoked
	_, err = manager.ValidateToken(ctx, originalToken.Token)
	assert.Error(t, err, "Old token should be revoked")
}

func TestRefreshTokenReuseDetection(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.RefreshTokenConfig{
		RedisClient:    redisClient,
		TokenDuration:  7 * 24 * time.Hour,
		EnableRotation: true,
		KeyPrefix:      "test:refresh:reuse:",
		TokenLength:    64,
	}

	manager := middleware.NewRefreshTokenManager(cfg)
	ctx := context.Background()

	// Generate initial token
	token1, err := manager.GenerateToken(ctx, "user_reuse", "device1", "192.168.1.1", "Mozilla/5.0")
	require.NoError(t, err)

	// Rotate to get token2
	token2, err := manager.RotateToken(ctx, token1.Token, "192.168.1.1", "Mozilla/5.0")
	require.NoError(t, err)

	// Try to reuse token1 (should detect reuse and revoke family)
	_, err = manager.ValidateToken(ctx, token1.Token)
	assert.Error(t, err, "Reusing old token should be detected")

	// Token2 should also be revoked (family revocation)
	_, err = manager.ValidateToken(ctx, token2.Token)
	assert.Error(t, err, "Entire token family should be revoked on reuse detection")
}

func TestRefreshTokenRevocation(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.RefreshTokenConfig{
		RedisClient:      redisClient,
		TokenDuration:    7 * 24 * time.Hour,
		EnableRevocation: true,
		KeyPrefix:        "test:refresh:revoke:",
		TokenLength:      64,
	}

	manager := middleware.NewRefreshTokenManager(cfg)
	ctx := context.Background()

	// Generate token
	token, err := manager.GenerateToken(ctx, "user_revoke", "device1", "192.168.1.1", "Mozilla/5.0")
	require.NoError(t, err)

	// Revoke token
	err = manager.RevokeToken(ctx, token.Token)
	require.NoError(t, err)

	// Token should be invalid
	_, err = manager.ValidateToken(ctx, token.Token)
	assert.Error(t, err, "Revoked token should be invalid")
}

func TestRevokeAllUserTokens(t *testing.T) {
	redisClient := setupBruteForceTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.RefreshTokenConfig{
		RedisClient:      redisClient,
		TokenDuration:    7 * 24 * time.Hour,
		MaxTokensPerUser: 10,
		EnableRevocation: true,
		KeyPrefix:        "test:refresh:revokeall:",
		TokenLength:      64,
	}

	manager := middleware.NewRefreshTokenManager(cfg)
	ctx := context.Background()
	userID := "user_revoke_all"

	// Generate multiple tokens
	var tokens []*middleware.RefreshToken
	for i := 0; i < 3; i++ {
		token, err := manager.GenerateToken(ctx, userID, "device"+string(rune('0'+i)), "192.168.1.1", "Mozilla/5.0")
		require.NoError(t, err)
		tokens = append(tokens, token)
	}

	// Revoke all user tokens
	err := manager.RevokeAllUserTokens(ctx, userID)
	require.NoError(t, err)

	// All tokens should be invalid
	for _, token := range tokens {
		_, err := manager.ValidateToken(ctx, token.Token)
		assert.Error(t, err, "All tokens should be revoked")
	}
}

// ============================================================================
// Authentication Bypass Tests
// ============================================================================

func TestAuthBypassAttempts(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Simple auth middleware that requires Authorization header
	router.Use(func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		if auth != "Bearer valid-token" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.Next()
	})

	router.GET("/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": "secret"})
	})

	testCases := []struct {
		name           string
		authorization  string
		expectedStatus int
	}{
		{"No auth header", "", http.StatusUnauthorized},
		{"Empty bearer", "Bearer ", http.StatusUnauthorized},
		{"Invalid token", "Bearer invalid-token", http.StatusUnauthorized},
		{"Basic instead of bearer", "Basic dXNlcjpwYXNz", http.StatusUnauthorized},
		{"Malformed header", "BearerToken", http.StatusUnauthorized},
		{"SQL injection in token", "Bearer ' OR '1'='1", http.StatusUnauthorized},
		{"XSS in token", "Bearer <script>alert(1)</script>", http.StatusUnauthorized},
		{"Null byte injection", "Bearer valid-token\x00garbage", http.StatusUnauthorized},
		{"Valid token", "Bearer valid-token", http.StatusOK},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/protected", nil)
			if tc.authorization != "" {
				req.Header.Set("Authorization", tc.authorization)
			}
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			assert.Equal(t, tc.expectedStatus, w.Code)
		})
	}
}

// ============================================================================
// Benchmark Tests
// ============================================================================

func BenchmarkBruteForceCheck(b *testing.B) {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15,
	})
	if err := client.Ping(context.Background()).Err(); err != nil {
		b.Skip("Redis not available")
	}
	defer client.Close()

	cfg := middleware.BruteForceConfig{
		RedisClient:      client,
		MaxAttempts:      1000, // High limit for benchmark
		LockoutDuration:  1 * time.Minute,
		AttemptWindow:    5 * time.Minute,
		KeyPrefix:        "bench:bruteforce:",
		EnableIPBlocking: true,
	}

	protector := middleware.NewBruteForceProtector(cfg)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		protector.CheckAndRecord(ctx, "bench-ip", true)
	}
}

func BenchmarkSessionValidation(b *testing.B) {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15,
	})
	if err := client.Ping(context.Background()).Err(); err != nil {
		b.Skip("Redis not available")
	}
	defer client.Close()

	cfg := middleware.SessionConfig{
		RedisClient:     client,
		SessionDuration: 1 * time.Hour,
		KeyPrefix:       "bench:session:",
	}

	manager := middleware.NewSessionManager(cfg)
	ctx := context.Background()

	session, _ := manager.CreateSession(ctx, "bench-user", "192.168.1.1", "Mozilla/5.0")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		manager.ValidateSession(ctx, session.ID, "192.168.1.1", "Mozilla/5.0")
	}
}
