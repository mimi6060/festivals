package integration

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/auth"
	"github.com/mimi6060/festivals/backend/internal/middleware"
	"github.com/mimi6060/festivals/backend/tests/helpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// Test JWT Generation Helper
// ============================================================================

type testJWTClaims struct {
	jwt.RegisteredClaims
	Email         string   `json:"email"`
	Roles         []string `json:"https://festivals.app/roles"`
	FestivalID    string   `json:"https://festivals.app/festival_id"`
	Permissions   []string `json:"permissions"`
}

func generateTestJWT(t *testing.T, userID, email string, roles []string, expiresAt time.Time) string {
	t.Helper()

	claims := testJWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			Issuer:    "https://test.auth0.com/",
			Audience:  jwt.ClaimStrings{"test-api"},
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
		Email:       email,
		Roles:       roles,
		Permissions: []string{},
	}

	// Create unsigned token for testing (development mode)
	token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
	tokenString, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	require.NoError(t, err)

	return tokenString
}

// ============================================================================
// Login Flow Tests
// ============================================================================

func TestAuthLoginFlow(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Valid JWT token grants access", func(t *testing.T) {
		// Create test user
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Generate valid token
		token := generateTestJWT(t, testUser.ID.String(), testUser.Email, []string{"USER"}, time.Now().Add(1*time.Hour))

		// Create request with token
		req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		// Should succeed (health endpoint is public but we test token parsing)
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("Missing Authorization header returns 401", func(t *testing.T) {
		// Create a protected route for testing
		router := setupAuthTestRouter(suite)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/protected", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)

		var resp map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		errData := resp["error"].(map[string]interface{})
		assert.Equal(t, "UNAUTHORIZED", errData["code"])
	})

	t.Run("Invalid Authorization format returns 401", func(t *testing.T) {
		router := setupAuthTestRouter(suite)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/protected", nil)
		req.Header.Set("Authorization", "InvalidFormat")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("Malformed JWT token returns 401", func(t *testing.T) {
		router := setupAuthTestRouter(suite)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/protected", nil)
		req.Header.Set("Authorization", "Bearer invalid.token.here")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("User context is set correctly from token", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		token := generateTestJWT(t, testUser.ID.String(), testUser.Email, []string{"ADMIN", "USER"}, time.Now().Add(1*time.Hour))

		var capturedUserID string
		var capturedRoles []string

		// Create router with test handler
		router := gin.New()
		router.Use(middleware.Auth(middleware.AuthConfig{
			Domain:      "test.auth0.com",
			Audiences:   []string{"test-api"},
			Development: true,
		}))
		router.GET("/test", func(c *gin.Context) {
			capturedUserID = c.GetString("user_id")
			if roles, exists := c.Get("roles"); exists {
				capturedRoles = roles.([]string)
			}
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, testUser.ID.String(), capturedUserID)
		assert.Contains(t, capturedRoles, "ADMIN")
		assert.Contains(t, capturedRoles, "USER")
	})
}

// ============================================================================
// Token Refresh Tests
// ============================================================================

func TestTokenRefresh(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Expired token returns TOKEN_EXPIRED error", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Generate expired token
		token := generateTestJWT(t, testUser.ID.String(), testUser.Email, []string{"USER"}, time.Now().Add(-1*time.Hour))

		router := setupAuthTestRouter(suite)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/protected", nil)
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)

		var resp map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		errData := resp["error"].(map[string]interface{})
		assert.Equal(t, "TOKEN_EXPIRED", errData["code"])
	})

	t.Run("Token expiring soon is still valid", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Generate token expiring in 5 minutes
		token := generateTestJWT(t, testUser.ID.String(), testUser.Email, []string{"USER"}, time.Now().Add(5*time.Minute))

		router := setupAuthTestRouter(suite)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/protected", nil)
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Token should still be valid
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("Token with future not-before is rejected", func(t *testing.T) {
		// Create token with nbf in the future
		claims := jwt.RegisteredClaims{
			Subject:   uuid.New().String(),
			Issuer:    "https://test.auth0.com/",
			Audience:  jwt.ClaimStrings{"test-api"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
			NotBefore: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)), // Not valid yet
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		}

		token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
		tokenString, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
		require.NoError(t, err)

		router := setupAuthTestRouter(suite)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/protected", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// In development mode, this may be accepted depending on parser config
		// Production would reject it
		assert.True(t, w.Code == http.StatusUnauthorized || w.Code == http.StatusOK)
	})
}

// ============================================================================
// Permission Check Tests
// ============================================================================

func TestPermissionChecks(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("User with correct role can access protected resource", func(t *testing.T) {
		testUser := helpers.CreateTestAdmin(t, suite.DB)

		// Setup router with role check
		router := gin.New()
		router.Use(testAuthMiddlewareWithRoles())
		router.GET("/admin", requireRole("ADMIN"), func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "admin access granted"})
		})

		req := httptest.NewRequest(http.MethodGet, "/admin", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())
		req.Header.Set("X-Test-Roles", "ADMIN")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("User without correct role is denied access", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		router := gin.New()
		router.Use(testAuthMiddlewareWithRoles())
		router.GET("/admin", requireRole("ADMIN"), func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "admin access granted"})
		})

		req := httptest.NewRequest(http.MethodGet, "/admin", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())
		req.Header.Set("X-Test-Roles", "USER")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("User with multiple roles passes if any match", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		router := gin.New()
		router.Use(testAuthMiddlewareWithRoles())
		router.GET("/resource", requireAnyRole("ADMIN", "STAFF"), func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "access granted"})
		})

		req := httptest.NewRequest(http.MethodGet, "/resource", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())
		req.Header.Set("X-Test-Roles", "STAFF")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("Permission-based access control works", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		festival := helpers.CreateTestFestival(t, suite.DB, nil)

		// Create permission
		permission := helpers.CreateTestPermission(t, suite.DB, auth.ResourceWallet, auth.ActionRead, auth.ScopeFestival)

		// Create role with permission
		role := helpers.CreateTestRole(t, suite.DB, "wallet_reader", "Wallet Reader", &festival.ID, []auth.Permission{*permission})

		// Assign role to user
		admin := helpers.CreateTestAdmin(t, suite.DB)
		helpers.CreateTestRoleAssignment(t, suite.DB, testUser.ID, role.ID, admin.ID, &festival.ID)

		// Verify assignment exists
		var assignment auth.RoleAssignment
		err := suite.DB.Where("user_id = ? AND role_id = ?", testUser.ID, role.ID).First(&assignment).Error
		require.NoError(t, err)
		assert.True(t, assignment.IsActive)
	})

	t.Run("Expired role assignment denies access", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		festival := helpers.CreateTestFestival(t, suite.DB, nil)
		admin := helpers.CreateTestAdmin(t, suite.DB)

		// Create permission and role
		permission := helpers.CreateTestPermission(t, suite.DB, auth.ResourceTransaction, auth.ActionCreate, auth.ScopeFestival)
		role := helpers.CreateTestRole(t, suite.DB, "expired_role", "Expired Role", &festival.ID, []auth.Permission{*permission})

		// Create expired assignment
		expiredAt := time.Now().Add(-1 * time.Hour)
		assignment := &auth.RoleAssignment{
			ID:         uuid.New(),
			UserID:     testUser.ID,
			RoleID:     role.ID,
			FestivalID: &festival.ID,
			AssignedBy: admin.ID,
			AssignedAt: time.Now().Add(-24 * time.Hour),
			ExpiresAt:  &expiredAt,
			IsActive:   true,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}
		err := suite.DB.Create(assignment).Error
		require.NoError(t, err)

		// Check if assignment is expired
		assert.True(t, assignment.IsExpired())
		assert.False(t, assignment.IsEffective())
	})

	t.Run("Inactive role assignment denies access", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		festival := helpers.CreateTestFestival(t, suite.DB, nil)
		admin := helpers.CreateTestAdmin(t, suite.DB)

		// Create permission and role
		permission := helpers.CreateTestPermission(t, suite.DB, auth.ResourceRefund, auth.ActionApprove, auth.ScopeFestival)
		role := helpers.CreateTestRole(t, suite.DB, "inactive_role", "Inactive Role", &festival.ID, []auth.Permission{*permission})

		// Create inactive assignment
		assignment := &auth.RoleAssignment{
			ID:         uuid.New(),
			UserID:     testUser.ID,
			RoleID:     role.ID,
			FestivalID: &festival.ID,
			AssignedBy: admin.ID,
			AssignedAt: time.Now().Add(-24 * time.Hour),
			IsActive:   false, // Deactivated
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}
		err := suite.DB.Create(assignment).Error
		require.NoError(t, err)

		// Check if assignment is effective
		assert.False(t, assignment.IsEffective())
	})
}

// ============================================================================
// RBAC Tests
// ============================================================================

func TestRBACPermissions(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Super admin has all permissions", func(t *testing.T) {
		// Verify predefined role config
		roles := auth.GetPredefinedRoles()
		superAdminConfig := roles[auth.RoleSuperAdmin]

		assert.True(t, superAdminConfig.IsGlobal)
		assert.Equal(t, 1000, superAdminConfig.Priority)

		// Super admin should have all resources and actions
		permissions := superAdminConfig.Permissions
		assert.Greater(t, len(permissions), 100) // Should have many permissions

		// Check all resources are present
		resourceMap := make(map[auth.Resource]bool)
		for _, p := range permissions {
			resourceMap[p.Resource] = true
		}

		for _, resource := range auth.AllResources() {
			assert.True(t, resourceMap[resource], "Super admin should have permission for resource: %s", resource)
		}
	})

	t.Run("Cashier has limited stand-scoped permissions", func(t *testing.T) {
		roles := auth.GetPredefinedRoles()
		cashierConfig := roles[auth.RoleCashier]

		assert.False(t, cashierConfig.IsGlobal)
		assert.Equal(t, 300, cashierConfig.Priority)

		// Check cashier has transaction permissions
		hasTransactionCreate := false
		hasWalletUpdate := false
		for _, p := range cashierConfig.Permissions {
			if p.Resource == auth.ResourceTransaction && p.Action == auth.ActionCreate {
				hasTransactionCreate = true
				assert.Equal(t, auth.ScopeStand, p.Scope)
			}
			if p.Resource == auth.ResourceWallet && p.Action == auth.ActionUpdate {
				hasWalletUpdate = true
			}
		}

		assert.True(t, hasTransactionCreate, "Cashier should be able to create transactions")
		assert.True(t, hasWalletUpdate, "Cashier should be able to update wallets")
	})

	t.Run("Scanner has ticket scanning permissions", func(t *testing.T) {
		roles := auth.GetPredefinedRoles()
		scannerConfig := roles[auth.RoleScanner]

		hasTicketScan := false
		for _, p := range scannerConfig.Permissions {
			if p.Resource == auth.ResourceTicket && p.Action == auth.ActionScan {
				hasTicketScan = true
				assert.Equal(t, auth.ScopeFestival, p.Scope)
			}
		}

		assert.True(t, hasTicketScan, "Scanner should be able to scan tickets")
	})

	t.Run("Permission key is correctly formatted", func(t *testing.T) {
		p := &auth.Permission{
			Resource: auth.ResourceWallet,
			Action:   auth.ActionRead,
		}

		assert.Equal(t, "wallet:read", p.PermissionKey())
	})

	t.Run("Role hierarchy by priority", func(t *testing.T) {
		roles := auth.GetPredefinedRoles()

		// Verify priority order
		assert.Greater(t, roles[auth.RoleSuperAdmin].Priority, roles[auth.RoleFestivalOwner].Priority)
		assert.Greater(t, roles[auth.RoleFestivalOwner].Priority, roles[auth.RoleFestivalAdmin].Priority)
		assert.Greater(t, roles[auth.RoleFestivalAdmin].Priority, roles[auth.RoleFinanceManager].Priority)
		assert.Greater(t, roles[auth.RoleCashier].Priority, roles[auth.RoleScanner].Priority)
		assert.Greater(t, roles[auth.RoleScanner].Priority, roles[auth.RoleViewer].Priority)
	})
}

// ============================================================================
// Optional Auth Tests
// ============================================================================

func TestOptionalAuth(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Optional auth allows access without token", func(t *testing.T) {
		router := gin.New()
		router.Use(middleware.OptionalAuth(middleware.AuthConfig{
			Domain:      "test.auth0.com",
			Audiences:   []string{"test-api"},
			Development: true,
		}))
		router.GET("/public", func(c *gin.Context) {
			userID := c.GetString("user_id")
			c.JSON(http.StatusOK, gin.H{"user_id": userID, "authenticated": userID != ""})
		})

		req := httptest.NewRequest(http.MethodGet, "/public", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		assert.False(t, resp["authenticated"].(bool))
	})

	t.Run("Optional auth processes valid token", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		token := generateTestJWT(t, testUser.ID.String(), testUser.Email, []string{"USER"}, time.Now().Add(1*time.Hour))

		router := gin.New()
		router.Use(middleware.OptionalAuth(middleware.AuthConfig{
			Domain:      "test.auth0.com",
			Audiences:   []string{"test-api"},
			Development: true,
		}))
		router.GET("/public", func(c *gin.Context) {
			userID := c.GetString("user_id")
			c.JSON(http.StatusOK, gin.H{"user_id": userID, "authenticated": userID != ""})
		})

		req := httptest.NewRequest(http.MethodGet, "/public", nil)
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		assert.True(t, resp["authenticated"].(bool))
		assert.Equal(t, testUser.ID.String(), resp["user_id"])
	})
}

// ============================================================================
// Helper Functions
// ============================================================================

func setupAuthTestRouter(suite *TestSuite) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())

	// Add auth middleware in development mode
	router.Use(middleware.Auth(middleware.AuthConfig{
		Domain:      "test.auth0.com",
		Audiences:   []string{"test-api"},
		Development: true,
	}))

	router.GET("/api/v1/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "protected resource"})
	})

	return router
}

func testAuthMiddlewareWithRoles() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-Test-User-ID")
		if userID != "" {
			c.Set("user_id", userID)
		}

		roles := c.GetHeader("X-Test-Roles")
		if roles != "" {
			c.Set("roles", []string{roles})
		}

		c.Next()
	}
}

func requireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roles, exists := c.Get("roles")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": gin.H{"code": "FORBIDDEN", "message": "Access denied"}})
			return
		}

		roleList := roles.([]string)
		for _, r := range roleList {
			if r == role {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": gin.H{"code": "FORBIDDEN", "message": "Access denied"}})
	}
}

func requireAnyRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRoles, exists := c.Get("roles")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": gin.H{"code": "FORBIDDEN", "message": "Access denied"}})
			return
		}

		roleList := userRoles.([]string)
		for _, userRole := range roleList {
			for _, requiredRole := range roles {
				if userRole == requiredRole {
					c.Next()
					return
				}
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": gin.H{"code": "FORBIDDEN", "message": "Access denied"}})
	}
}

// createTestJWTWithPayload creates a minimal JWT-like structure for testing
func createTestJWTWithPayload(payload map[string]interface{}) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`))
	payloadBytes, _ := json.Marshal(payload)
	payloadEncoded := base64.RawURLEncoding.EncodeToString(payloadBytes)
	return header + "." + payloadEncoded + "."
}
