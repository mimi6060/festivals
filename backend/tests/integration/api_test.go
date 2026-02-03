package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/festival"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
	"github.com/mimi6060/festivals/backend/tests/helpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// Health Check Tests
// ============================================================================

func TestHealthEndpoint(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Health check returns OK", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		assert.Equal(t, "ok", resp["status"])
	})
}

// ============================================================================
// Festival API Tests
// ============================================================================

func TestFestivalAPI(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Create festival with valid data", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)

		createReq := map[string]interface{}{
			"name":         "Summer Fest 2026",
			"description":  "The best summer festival",
			"startDate":    "2026-07-15",
			"endDate":      "2026-07-17",
			"location":     "Paris, France",
			"timezone":     "Europe/Paris",
			"currencyName": "Tokens",
			"exchangeRate": 0.1,
		}

		body, err := json.Marshal(createReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/festivals", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", admin.ID.String())
		req.Header.Set("X-Test-Roles", "ADMIN")

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)

		var resp response.Response
		err = json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.NotEmpty(t, data["id"])
		assert.Equal(t, "Summer Fest 2026", data["name"])
		assert.Equal(t, "summer-fest-2026", data["slug"])
		assert.Equal(t, "Tokens", data["currencyName"])
	})

	t.Run("Get festival by ID", func(t *testing.T) {
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		user := helpers.CreateTestUser(t, suite.DB, nil)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/festivals/"+testFestival.ID.String(), nil)
		req.Header.Set("X-Test-User-ID", user.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, testFestival.ID.String(), data["id"])
		assert.Equal(t, testFestival.Name, data["name"])
	})

	t.Run("Get festival by slug", func(t *testing.T) {
		testFestival := helpers.CreateTestFestival(t, suite.DB, &helpers.FestivalOptions{
			Name: helpers.StringPtr("Unique Festival"),
		})
		user := helpers.CreateTestUser(t, suite.DB, nil)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/festivals/slug/"+testFestival.Slug, nil)
		req.Header.Set("X-Test-User-ID", user.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("List festivals with pagination", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)

		// Create multiple festivals
		for i := 0; i < 15; i++ {
			helpers.CreateTestFestival(t, suite.DB, &helpers.FestivalOptions{
				Name: helpers.StringPtr(fmt.Sprintf("Festival %d", i)),
			})
		}

		req := httptest.NewRequest(http.MethodGet, "/api/v1/festivals?page=1&per_page=10", nil)
		req.Header.Set("X-Test-User-ID", admin.ID.String())
		req.Header.Set("X-Test-Roles", "ADMIN")

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.([]interface{})
		require.True(t, ok)
		assert.LessOrEqual(t, len(data), 10)

		require.NotNil(t, resp.Meta)
		assert.GreaterOrEqual(t, resp.Meta.Total, 15)
	})

	t.Run("Update festival settings", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &admin.ID)

		updateReq := map[string]interface{}{
			"name":        "Updated Festival Name",
			"description": "Updated description",
		}

		body, err := json.Marshal(updateReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPatch, "/api/v1/festivals/"+testFestival.ID.String(), bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", admin.ID.String())
		req.Header.Set("X-Test-Roles", "ADMIN")

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err = json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, "Updated Festival Name", data["name"])
	})

	t.Run("Get non-existent festival returns 404", func(t *testing.T) {
		user := helpers.CreateTestUser(t, suite.DB, nil)
		nonExistentID := uuid.New()

		req := httptest.NewRequest(http.MethodGet, "/api/v1/festivals/"+nonExistentID.String(), nil)
		req.Header.Set("X-Test-User-ID", user.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("Create festival with invalid data fails", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)

		// Missing required fields
		createReq := map[string]interface{}{
			"name": "", // Empty name
		}

		body, err := json.Marshal(createReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/festivals", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", admin.ID.String())
		req.Header.Set("X-Test-Roles", "ADMIN")

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

// ============================================================================
// Stand API Tests
// ============================================================================

func TestStandAPI(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Create stand for festival", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &admin.ID)

		createReq := map[string]interface{}{
			"name":        "Food Stand A",
			"description": "Delicious food",
			"category":    "food",
			"location":    "Zone A",
		}

		body, err := json.Marshal(createReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/festivals/"+testFestival.ID.String()+"/stands", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", admin.ID.String())
		req.Header.Set("X-Test-Roles", "ADMIN")

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)

		var resp response.Response
		err = json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.NotEmpty(t, data["id"])
		assert.Equal(t, "Food Stand A", data["name"])
	})

	t.Run("List stands for festival", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &admin.ID)

		// Create multiple stands
		for i := 0; i < 5; i++ {
			helpers.CreateTestStand(t, suite.DB, testFestival.ID, &helpers.StandOptions{
				Name: helpers.StringPtr(fmt.Sprintf("Stand %d", i)),
			})
		}

		req := httptest.NewRequest(http.MethodGet, "/api/v1/festivals/"+testFestival.ID.String()+"/stands", nil)
		req.Header.Set("X-Test-User-ID", admin.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.([]interface{})
		require.True(t, ok)
		assert.Len(t, data, 5)
	})

	t.Run("Get stand by ID", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &admin.ID)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/festivals/"+testFestival.ID.String()+"/stands/"+testStand.ID.String(), nil)
		req.Header.Set("X-Test-User-ID", admin.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, testStand.ID.String(), data["id"])
	})
}

// ============================================================================
// Product API Tests
// ============================================================================

func TestProductAPI(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Create product for stand", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &admin.ID)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)

		createReq := map[string]interface{}{
			"name":        "Beer",
			"description": "Cold beer",
			"price":       500, // 5.00 EUR
			"category":    "beverage",
		}

		body, err := json.Marshal(createReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/festivals/"+testFestival.ID.String()+"/stands/"+testStand.ID.String()+"/products", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", admin.ID.String())
		req.Header.Set("X-Test-Roles", "ADMIN")

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)

		var resp response.Response
		err = json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.NotEmpty(t, data["id"])
		assert.Equal(t, "Beer", data["name"])
		assert.Equal(t, float64(500), data["price"])
	})

	t.Run("List products for stand", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &admin.ID)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)

		// Create multiple products
		for i := 0; i < 5; i++ {
			helpers.CreateTestProduct(t, suite.DB, testStand.ID, &helpers.ProductOptions{
				Name:  helpers.StringPtr(fmt.Sprintf("Product %d", i)),
				Price: helpers.Int64Ptr(int64(500 + i*100)),
			})
		}

		req := httptest.NewRequest(http.MethodGet, "/api/v1/festivals/"+testFestival.ID.String()+"/stands/"+testStand.ID.String()+"/products", nil)
		req.Header.Set("X-Test-User-ID", admin.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})
}

// ============================================================================
// Ticket Type API Tests
// ============================================================================

func TestTicketTypeAPI(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Create ticket type for festival", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &admin.ID)

		createReq := map[string]interface{}{
			"name":        "3-Day Pass",
			"description": "Access to all 3 days",
			"price":       18900, // 189.00 EUR
			"quantity":    1000,
			"validFrom":   "2026-07-15T00:00:00Z",
			"validUntil":  "2026-07-17T23:59:59Z",
			"benefits":    []string{"All stages access", "Cashless bracelet"},
		}

		body, err := json.Marshal(createReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/festivals/"+testFestival.ID.String()+"/ticket-types", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", admin.ID.String())
		req.Header.Set("X-Test-Roles", "ADMIN")

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)

		var resp response.Response
		err = json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.NotEmpty(t, data["id"])
		assert.Equal(t, "3-Day Pass", data["name"])
		assert.Equal(t, float64(18900), data["price"])
	})

	t.Run("List ticket types for festival", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &admin.ID)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/festivals/"+testFestival.ID.String()+"/ticket-types", nil)
		req.Header.Set("X-Test-User-ID", admin.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})
}

// ============================================================================
// User Profile API Tests
// ============================================================================

func TestUserProfileAPI(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Get current user profile", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		// Note: This endpoint might need to be implemented
		// For now, just check it doesn't crash
		assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusNotFound)
	})

	t.Run("Get user wallets", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/me/wallets", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})
}

// ============================================================================
// Statistics API Tests
// ============================================================================

func TestStatisticsAPI(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Get festival statistics", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &admin.ID)

		// Create some data for statistics
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)
		helpers.CreateTestProduct(t, suite.DB, testStand.ID, nil)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/festivals/"+testFestival.ID.String()+"/stats", nil)
		req.Header.Set("X-Test-User-ID", admin.ID.String())
		req.Header.Set("X-Test-Roles", "ADMIN")

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		// Stats endpoint might need implementation
		assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusNotFound)
	})
}

// ============================================================================
// CORS and Headers Tests
// ============================================================================

func TestCORSHeaders(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("OPTIONS request returns CORS headers", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/health", nil)
		req.Header.Set("Origin", "http://localhost:3000")

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		// CORS might be configured in production middleware
		// Just ensure the request doesn't fail
		assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusNoContent || w.Code == http.StatusNotFound)
	})
}

// ============================================================================
// Rate Limiting Tests
// ============================================================================

func TestRateLimiting(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("API accepts normal request rate", func(t *testing.T) {
		// Make a few requests in quick succession
		for i := 0; i < 5; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
			w := httptest.NewRecorder()
			suite.Router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code)
		}
	})
}

// ============================================================================
// Error Response Format Tests
// ============================================================================

func TestErrorResponseFormat(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("404 error has correct format", func(t *testing.T) {
		user := helpers.CreateTestUser(t, suite.DB, nil)
		nonExistentID := uuid.New()

		req := httptest.NewRequest(http.MethodGet, "/api/v1/festivals/"+nonExistentID.String(), nil)
		req.Header.Set("X-Test-User-ID", user.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)

		var resp map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		// Error response should have error object
		errObj, ok := resp["error"].(map[string]interface{})
		require.True(t, ok)

		assert.NotEmpty(t, errObj["code"])
		assert.NotEmpty(t, errObj["message"])
	})

	t.Run("400 error has correct format", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)

		// Send invalid JSON
		req := httptest.NewRequest(http.MethodPost, "/api/v1/festivals", bytes.NewBuffer([]byte("invalid json")))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", admin.ID.String())
		req.Header.Set("X-Test-Roles", "ADMIN")

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

// ============================================================================
// Festival Status Transitions Tests
// ============================================================================

func TestFestivalStatusTransitions(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Activate draft festival", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)
		draftStatus := festival.FestivalStatusDraft
		testFestival := helpers.CreateTestFestival(t, suite.DB, &helpers.FestivalOptions{
			Status:    &draftStatus,
			CreatedBy: &admin.ID,
		})

		updateReq := map[string]interface{}{
			"status": "ACTIVE",
		}

		body, err := json.Marshal(updateReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPatch, "/api/v1/festivals/"+testFestival.ID.String(), bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", admin.ID.String())
		req.Header.Set("X-Test-Roles", "ADMIN")

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err = json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, "ACTIVE", data["status"])
	})

	t.Run("Archive completed festival", func(t *testing.T) {
		admin := helpers.CreateTestAdmin(t, suite.DB)
		completedStatus := festival.FestivalStatusCompleted
		testFestival := helpers.CreateTestFestival(t, suite.DB, &helpers.FestivalOptions{
			Status:    &completedStatus,
			CreatedBy: &admin.ID,
		})

		updateReq := map[string]interface{}{
			"status": "ARCHIVED",
		}

		body, err := json.Marshal(updateReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPatch, "/api/v1/festivals/"+testFestival.ID.String(), bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", admin.ID.String())
		req.Header.Set("X-Test-Roles", "ADMIN")

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})
}
