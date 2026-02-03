package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/order"
	"github.com/mimi6060/festivals/backend/internal/domain/product"
	"github.com/mimi6060/festivals/backend/internal/domain/wallet"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
	"github.com/mimi6060/festivals/backend/tests/helpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// ============================================================================
// Test Suite with Order Support
// ============================================================================

// setupOrderTestRouter creates a router with order handlers for testing
func setupOrderTestRouter(suite *TestSuite) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(testAuthMiddleware())

	// Initialize repositories
	productRepo := product.NewRepository(suite.DB)
	walletRepo := wallet.NewRepository(suite.DB)
	orderRepo := order.NewRepository(suite.DB)

	// Initialize services
	walletService := wallet.NewService(walletRepo, suite.JWTSecret)
	orderService := order.NewService(orderRepo, productRepo, walletService)

	// Initialize handlers
	orderHandler := order.NewHandler(orderService)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Order routes need festival and wallet context
		v1.Use(func(c *gin.Context) {
			// Set festival and wallet from headers if provided
			if festivalID := c.GetHeader("X-Test-Festival-ID"); festivalID != "" {
				c.Set("festival_id", festivalID)
			}
			if walletID := c.GetHeader("X-Test-Wallet-ID"); walletID != "" {
				c.Set("wallet_id", walletID)
			}
			c.Next()
		})
		orderHandler.RegisterRoutes(v1)
	}

	return router
}

// ============================================================================
// Create Order Tests
// ============================================================================

func TestOrderCreateFlow(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Create order with valid items", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		createReq := order.CreateOrderRequest{
			StandID: setup.Stand.ID,
			Items: []order.OrderItemRequest{
				{
					ProductID: setup.Product.ID,
					Quantity:  2,
				},
			},
			PaymentMethod: "wallet",
		}

		body, err := json.Marshal(createReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.User.ID.String())
		req.Header.Set("X-Test-Festival-ID", setup.Festival.ID.String())
		req.Header.Set("X-Test-Wallet-ID", setup.Wallet.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)

		var resp response.Response
		err = json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.NotEmpty(t, data["id"])
		assert.Equal(t, setup.Festival.ID.String(), data["festivalId"])
		assert.Equal(t, setup.User.ID.String(), data["userId"])
		assert.Equal(t, setup.Wallet.ID.String(), data["walletId"])
		assert.Equal(t, setup.Stand.ID.String(), data["standId"])
		assert.Equal(t, "PENDING", data["status"])
		assert.Equal(t, "wallet", data["paymentMethod"])

		// Verify total amount (2 * 500 cents = 1000)
		assert.Equal(t, float64(1000), data["totalAmount"])

		// Verify items
		items := data["items"].([]interface{})
		assert.Len(t, items, 1)
		item := items[0].(map[string]interface{})
		assert.Equal(t, float64(2), item["quantity"])
		assert.Equal(t, float64(500), item["unitPrice"])
		assert.Equal(t, float64(1000), item["totalPrice"])
	})

	t.Run("Create order with multiple items", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create additional products
		product2 := helpers.CreateTestProduct(t, suite.DB, setup.Stand.ID, &helpers.ProductOptions{
			Name:  helpers.StringPtr("Product 2"),
			Price: helpers.Int64Ptr(750),
		})
		product3 := helpers.CreateTestProduct(t, suite.DB, setup.Stand.ID, &helpers.ProductOptions{
			Name:  helpers.StringPtr("Product 3"),
			Price: helpers.Int64Ptr(300),
		})

		createReq := order.CreateOrderRequest{
			StandID: setup.Stand.ID,
			Items: []order.OrderItemRequest{
				{ProductID: setup.Product.ID, Quantity: 1}, // 500
				{ProductID: product2.ID, Quantity: 2},      // 1500
				{ProductID: product3.ID, Quantity: 3},      // 900
			},
			PaymentMethod: "wallet",
			Notes:         "Test order with multiple items",
		}

		body, err := json.Marshal(createReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.User.ID.String())
		req.Header.Set("X-Test-Festival-ID", setup.Festival.ID.String())
		req.Header.Set("X-Test-Wallet-ID", setup.Wallet.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)

		var resp response.Response
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp.Data.(map[string]interface{})

		// Total: 500 + 1500 + 900 = 2900
		assert.Equal(t, float64(2900), data["totalAmount"])
		items := data["items"].([]interface{})
		assert.Len(t, items, 3)
		assert.Equal(t, "Test order with multiple items", data["notes"])
	})

	t.Run("Create order with cash payment", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		createReq := order.CreateOrderRequest{
			StandID: setup.Stand.ID,
			Items: []order.OrderItemRequest{
				{ProductID: setup.Product.ID, Quantity: 1},
			},
			PaymentMethod: "cash",
		}

		body, err := json.Marshal(createReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.User.ID.String())
		req.Header.Set("X-Test-Festival-ID", setup.Festival.ID.String())
		req.Header.Set("X-Test-Wallet-ID", setup.Wallet.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)

		var resp response.Response
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp.Data.(map[string]interface{})
		assert.Equal(t, "cash", data["paymentMethod"])
	})

	t.Run("Create order with non-existent product fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		createReq := order.CreateOrderRequest{
			StandID: setup.Stand.ID,
			Items: []order.OrderItemRequest{
				{ProductID: uuid.New(), Quantity: 1}, // Non-existent
			},
			PaymentMethod: "wallet",
		}

		body, _ := json.Marshal(createReq)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.User.ID.String())
		req.Header.Set("X-Test-Festival-ID", setup.Festival.ID.String())
		req.Header.Set("X-Test-Wallet-ID", setup.Wallet.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Create order with product from wrong stand fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create another stand with a product
		otherStand := helpers.CreateTestStand(t, suite.DB, setup.Festival.ID, &helpers.StandOptions{
			Name: helpers.StringPtr("Other Stand"),
		})
		otherProduct := helpers.CreateTestProduct(t, suite.DB, otherStand.ID, &helpers.ProductOptions{
			Name: helpers.StringPtr("Other Product"),
		})

		// Try to order product from other stand
		createReq := order.CreateOrderRequest{
			StandID: setup.Stand.ID,
			Items: []order.OrderItemRequest{
				{ProductID: otherProduct.ID, Quantity: 1}, // Wrong stand
			},
			PaymentMethod: "wallet",
		}

		body, _ := json.Marshal(createReq)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.User.ID.String())
		req.Header.Set("X-Test-Festival-ID", setup.Festival.ID.String())
		req.Header.Set("X-Test-Wallet-ID", setup.Wallet.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Create order with empty items fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		createReq := order.CreateOrderRequest{
			StandID:       setup.Stand.ID,
			Items:         []order.OrderItemRequest{}, // Empty
			PaymentMethod: "wallet",
		}

		body, _ := json.Marshal(createReq)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.User.ID.String())
		req.Header.Set("X-Test-Festival-ID", setup.Festival.ID.String())
		req.Header.Set("X-Test-Wallet-ID", setup.Wallet.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Create order without authentication fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		createReq := order.CreateOrderRequest{
			StandID: setup.Stand.ID,
			Items: []order.OrderItemRequest{
				{ProductID: setup.Product.ID, Quantity: 1},
			},
			PaymentMethod: "wallet",
		}

		body, _ := json.Marshal(createReq)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		// No user ID header

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})
}

// ============================================================================
// Process Payment Tests
// ============================================================================

func TestOrderProcessPaymentFlow(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Process wallet payment for pending order", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create a pending order
		orderItems := order.OrderItems{
			{
				ProductID:   setup.Product.ID,
				ProductName: setup.Product.Name,
				Quantity:    2,
				UnitPrice:   setup.Product.Price,
				TotalPrice:  setup.Product.Price * 2,
			},
		}
		pendingOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{
			Items:         &orderItems,
			TotalAmount:   helpers.Int64Ptr(1000),
			PaymentMethod: helpers.StringPtr("wallet"),
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+pendingOrder.ID.String()+"/pay", nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, "PAID", data["status"])
		assert.NotNil(t, data["transactionId"])
		assert.NotNil(t, data["staffId"])

		// Verify wallet balance was deducted
		var updatedWallet wallet.Wallet
		suite.DB.First(&updatedWallet, "id = ?", setup.Wallet.ID)
		assert.Equal(t, int64(9000), updatedWallet.Balance) // 10000 - 1000
	})

	t.Run("Process cash payment for pending order", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create a pending cash order
		cashStatus := order.OrderStatusPending
		cashMethod := "cash"
		cashOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{
			TotalAmount:   helpers.Int64Ptr(500),
			Status:        &cashStatus,
			PaymentMethod: &cashMethod,
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+cashOrder.ID.String()+"/pay", nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp.Data.(map[string]interface{})

		assert.Equal(t, "PAID", data["status"])
		assert.Nil(t, data["transactionId"]) // No wallet transaction for cash
	})

	t.Run("Process payment for already paid order fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create a paid order
		paidStatus := order.OrderStatusPaid
		paidOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{
			Status: &paidStatus,
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+paidOrder.ID.String()+"/pay", nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Process payment with insufficient balance fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create wallet with low balance
		lowBalanceWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, setup.User.ID, setup.Festival.ID, 100)

		// Delete the existing wallet to avoid conflict
		suite.DB.Delete(&setup.Wallet)

		// Create order with higher amount
		pendingOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, lowBalanceWallet.ID, setup.Stand.ID, &helpers.OrderOptions{
			TotalAmount:   helpers.Int64Ptr(5000),
			PaymentMethod: helpers.StringPtr("wallet"),
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+pendingOrder.ID.String()+"/pay", nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		errData := resp["error"].(map[string]interface{})
		assert.Equal(t, "INSUFFICIENT_BALANCE", errData["code"])
	})

	t.Run("Process payment without staff authentication fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		pendingOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, nil)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+pendingOrder.ID.String()+"/pay", nil)
		// No staff headers

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("Process payment for non-existent order fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		nonExistentID := uuid.New()

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+nonExistentID.String()+"/pay", nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

// ============================================================================
// Cancel Order Tests
// ============================================================================

func TestOrderCancelFlow(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Cancel pending order", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		pendingOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, nil)

		cancelReq := order.CancelOrderRequest{
			Reason: "Customer changed mind",
		}

		body, _ := json.Marshal(cancelReq)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+pendingOrder.ID.String()+"/cancel", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, "CANCELLED", data["status"])
		assert.Equal(t, "Customer changed mind", data["notes"])
	})

	t.Run("Cancel pending order without reason", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		pendingOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, nil)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+pendingOrder.ID.String()+"/cancel", nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("Cancel paid order fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		paidStatus := order.OrderStatusPaid
		paidOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{
			Status: &paidStatus,
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+paidOrder.ID.String()+"/cancel", nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Cancel already cancelled order fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		cancelledStatus := order.OrderStatusCancelled
		cancelledOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{
			Status: &cancelledStatus,
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+cancelledOrder.ID.String()+"/cancel", nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

// ============================================================================
// Refund Order Tests (as extension of cancel)
// ============================================================================

func TestOrderRefundFlow(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Refund paid wallet order", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create a transaction for the payment
		purchaseType := wallet.TransactionTypePurchase
		tx := helpers.CreateTestTransaction(t, suite.DB, setup.Wallet.ID, 10000, 9000, &helpers.TransactionOptions{
			Type:    &purchaseType,
			Amount:  helpers.Int64Ptr(-1000),
			StandID: &setup.Stand.ID,
		})

		// Update wallet balance to reflect payment
		suite.DB.Model(&wallet.Wallet{}).Where("id = ?", setup.Wallet.ID).Update("balance", 9000)

		// Create a paid order with transaction
		paidStatus := order.OrderStatusPaid
		paidOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{
			Status:        &paidStatus,
			TransactionID: &tx.ID,
			TotalAmount:   helpers.Int64Ptr(1000),
			PaymentMethod: helpers.StringPtr("wallet"),
		})

		refundReq := order.RefundOrderRequest{
			Reason: "Product was defective",
		}

		body, _ := json.Marshal(refundReq)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+paidOrder.ID.String()+"/refund", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, "REFUNDED", data["status"])
		assert.Equal(t, "Product was defective", data["notes"])

		// Verify wallet balance was restored
		var updatedWallet wallet.Wallet
		suite.DB.First(&updatedWallet, "id = ?", setup.Wallet.ID)
		assert.Equal(t, int64(10000), updatedWallet.Balance) // 9000 + 1000 refund
	})

	t.Run("Refund pending order fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		pendingOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, nil)

		refundReq := order.RefundOrderRequest{
			Reason: "Test refund",
		}

		body, _ := json.Marshal(refundReq)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+pendingOrder.ID.String()+"/refund", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Refund without reason fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		paidStatus := order.OrderStatusPaid
		paidOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{
			Status: &paidStatus,
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+paidOrder.ID.String()+"/refund", nil)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

// ============================================================================
// Get Order Tests
// ============================================================================

func TestOrderGetFlow(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Get order by ID", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		testOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, nil)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/orders/"+testOrder.ID.String(), nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp.Data.(map[string]interface{})

		assert.Equal(t, testOrder.ID.String(), data["id"])
	})

	t.Run("Get my order as owner", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		testOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, nil)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/me/orders/"+testOrder.ID.String(), nil)
		req.Header.Set("X-Test-User-ID", setup.User.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("Get another user's order as owner fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create order for setup.User
		testOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, nil)

		// Try to access as a different user
		otherUser := helpers.CreateTestUser(t, suite.DB, nil)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/me/orders/"+testOrder.ID.String(), nil)
		req.Header.Set("X-Test-User-ID", otherUser.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("Get non-existent order returns 404", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		nonExistentID := uuid.New()

		req := httptest.NewRequest(http.MethodGet, "/api/v1/orders/"+nonExistentID.String(), nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("Get order with invalid UUID returns 400", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/orders/invalid-uuid", nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

// ============================================================================
// Order List Tests
// ============================================================================

func TestOrderListFlow(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Get my orders with pagination", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create multiple orders
		for i := 0; i < 25; i++ {
			helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, nil)
		}

		req := httptest.NewRequest(http.MethodGet, "/api/v1/me/orders?festival_id="+setup.Festival.ID.String()+"&page=1&per_page=10", nil)
		req.Header.Set("X-Test-User-ID", setup.User.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		json.Unmarshal(w.Body.Bytes(), &resp)

		data := resp.Data.([]interface{})
		assert.Len(t, data, 10)

		require.NotNil(t, resp.Meta)
		assert.Equal(t, 25, resp.Meta.Total)
		assert.Equal(t, 1, resp.Meta.Page)
		assert.Equal(t, 10, resp.Meta.PerPage)
	})

	t.Run("Get stand orders", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create orders for the stand
		for i := 0; i < 5; i++ {
			helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, nil)
		}

		req := httptest.NewRequest(http.MethodGet, "/api/v1/stands/"+setup.Stand.ID.String()+"/orders", nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		json.Unmarshal(w.Body.Bytes(), &resp)

		data := resp.Data.([]interface{})
		assert.Len(t, data, 5)
	})

	t.Run("Get stand orders with status filter", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create orders with different statuses
		pendingStatus := order.OrderStatusPending
		paidStatus := order.OrderStatusPaid
		cancelledStatus := order.OrderStatusCancelled

		helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{Status: &pendingStatus})
		helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{Status: &pendingStatus})
		helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{Status: &paidStatus})
		helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{Status: &cancelledStatus})

		// Filter by PAID status
		req := httptest.NewRequest(http.MethodGet, "/api/v1/stands/"+setup.Stand.ID.String()+"/orders?status=PAID", nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		json.Unmarshal(w.Body.Bytes(), &resp)

		data := resp.Data.([]interface{})
		assert.Len(t, data, 1)
	})

	t.Run("Get festival orders", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create second stand with orders
		stand2 := helpers.CreateTestStand(t, suite.DB, setup.Festival.ID, &helpers.StandOptions{
			Name: helpers.StringPtr("Stand 2"),
		})
		wallet2 := helpers.CreateTestWalletWithBalance(t, suite.DB, setup.User.ID, setup.Festival.ID, 5000)

		// Delete the duplicate wallet constraint by using a different user
		user2 := helpers.CreateTestUser(t, suite.DB, nil)
		wallet3 := helpers.CreateTestWalletWithBalance(t, suite.DB, user2.ID, setup.Festival.ID, 5000)

		helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, nil)
		helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, wallet2.ID, stand2.ID, nil)
		helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, user2.ID, wallet3.ID, setup.Stand.ID, nil)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/festivals/"+setup.Festival.ID.String()+"/orders", nil)
		req.Header.Set("X-Test-User-ID", setup.Admin.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		json.Unmarshal(w.Body.Bytes(), &resp)

		data := resp.Data.([]interface{})
		assert.GreaterOrEqual(t, len(data), 3)
	})
}

// ============================================================================
// Stand Statistics Tests
// ============================================================================

func TestOrderStandStats(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Get stand order statistics", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create orders with different statuses and amounts
		paidStatus := order.OrderStatusPaid
		cancelledStatus := order.OrderStatusCancelled

		helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{
			Status:      &paidStatus,
			TotalAmount: helpers.Int64Ptr(1000),
		})
		helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{
			Status:      &paidStatus,
			TotalAmount: helpers.Int64Ptr(2000),
		})
		helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{
			Status:      &cancelledStatus,
			TotalAmount: helpers.Int64Ptr(500),
		})

		req := httptest.NewRequest(http.MethodGet, "/api/v1/stands/"+setup.Stand.ID.String()+"/orders/stats", nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp.Data.(map[string]interface{})

		assert.Equal(t, float64(3), data["totalOrders"])
		assert.Equal(t, float64(3000), data["totalRevenue"]) // Only paid orders
		assert.Equal(t, float64(2), data["paidOrders"])
		assert.Equal(t, float64(1), data["cancelledOrders"])
	})
}

// ============================================================================
// Product Stock Tests
// ============================================================================

func TestOrderProductStockManagement(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Create order with limited stock product", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create product with limited stock
		limitedProduct := helpers.CreateTestProduct(t, suite.DB, setup.Stand.ID, &helpers.ProductOptions{
			Name:  helpers.StringPtr("Limited Product"),
			Price: helpers.Int64Ptr(500),
			Stock: helpers.IntPtr(5),
		})

		createReq := order.CreateOrderRequest{
			StandID: setup.Stand.ID,
			Items: []order.OrderItemRequest{
				{ProductID: limitedProduct.ID, Quantity: 3},
			},
			PaymentMethod: "wallet",
		}

		body, _ := json.Marshal(createReq)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.User.ID.String())
		req.Header.Set("X-Test-Festival-ID", setup.Festival.ID.String())
		req.Header.Set("X-Test-Wallet-ID", setup.Wallet.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)
	})

	t.Run("Create order exceeding stock fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create product with limited stock
		limitedProduct := helpers.CreateTestProduct(t, suite.DB, setup.Stand.ID, &helpers.ProductOptions{
			Name:  helpers.StringPtr("Very Limited Product"),
			Price: helpers.Int64Ptr(500),
			Stock: helpers.IntPtr(2),
		})

		createReq := order.CreateOrderRequest{
			StandID: setup.Stand.ID,
			Items: []order.OrderItemRequest{
				{ProductID: limitedProduct.ID, Quantity: 5}, // Exceeds stock
			},
			PaymentMethod: "wallet",
		}

		body, _ := json.Marshal(createReq)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.User.ID.String())
		req.Header.Set("X-Test-Festival-ID", setup.Festival.ID.String())
		req.Header.Set("X-Test-Wallet-ID", setup.Wallet.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Stock is decremented after payment", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create product with stock tracking
		stockProduct := helpers.CreateTestProduct(t, suite.DB, setup.Stand.ID, &helpers.ProductOptions{
			Name:  helpers.StringPtr("Stock Tracked Product"),
			Price: helpers.Int64Ptr(500),
			Stock: helpers.IntPtr(10),
		})

		// Create order items
		orderItems := order.OrderItems{
			{
				ProductID:   stockProduct.ID,
				ProductName: stockProduct.Name,
				Quantity:    3,
				UnitPrice:   500,
				TotalPrice:  1500,
			},
		}

		// Create and pay order
		pendingOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{
			Items:         &orderItems,
			TotalAmount:   helpers.Int64Ptr(1500),
			PaymentMethod: helpers.StringPtr("wallet"),
		})

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+pendingOrder.ID.String()+"/pay", nil)
		req.Header.Set("X-Test-User-ID", setup.Staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", setup.Staff.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		// Verify stock was decremented
		var updatedProduct product.Product
		suite.DB.First(&updatedProduct, "id = ?", stockProduct.ID)
		assert.Equal(t, 7, *updatedProduct.Stock) // 10 - 3
	})
}

// ============================================================================
// Full Order Lifecycle Test
// ============================================================================

func TestOrderFullLifecycle(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Complete order lifecycle: create -> pay -> refund", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		initialBalance := setup.Wallet.Balance
		orderAmount := int64(1000)

		// Step 1: Create order
		createReq := order.CreateOrderRequest{
			StandID: setup.Stand.ID,
			Items: []order.OrderItemRequest{
				{ProductID: setup.Product.ID, Quantity: 2},
			},
			PaymentMethod: "wallet",
		}

		createBody, _ := json.Marshal(createReq)
		createReqHTTP := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(createBody))
		createReqHTTP.Header.Set("Content-Type", "application/json")
		createReqHTTP.Header.Set("X-Test-User-ID", setup.User.ID.String())
		createReqHTTP.Header.Set("X-Test-Festival-ID", setup.Festival.ID.String())
		createReqHTTP.Header.Set("X-Test-Wallet-ID", setup.Wallet.ID.String())

		createW := httptest.NewRecorder()
		router.ServeHTTP(createW, createReqHTTP)

		require.Equal(t, http.StatusCreated, createW.Code)

		var createResp response.Response
		json.Unmarshal(createW.Body.Bytes(), &createResp)
		createData := createResp.Data.(map[string]interface{})
		orderID := createData["id"].(string)

		assert.Equal(t, "PENDING", createData["status"])

		// Step 2: Process payment
		payReq := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+orderID+"/pay", nil)
		payReq.Header.Set("X-Test-User-ID", setup.Staff.ID.String())
		payReq.Header.Set("X-Test-Staff-ID", setup.Staff.ID.String())

		payW := httptest.NewRecorder()
		router.ServeHTTP(payW, payReq)

		require.Equal(t, http.StatusOK, payW.Code)

		var payResp response.Response
		json.Unmarshal(payW.Body.Bytes(), &payResp)
		payData := payResp.Data.(map[string]interface{})

		assert.Equal(t, "PAID", payData["status"])
		assert.NotNil(t, payData["transactionId"])

		// Verify balance was deducted
		var walletAfterPay wallet.Wallet
		suite.DB.First(&walletAfterPay, "id = ?", setup.Wallet.ID)
		assert.Equal(t, initialBalance-orderAmount, walletAfterPay.Balance)

		// Step 3: Refund order
		refundReq := order.RefundOrderRequest{
			Reason: "Customer complaint",
		}
		refundBody, _ := json.Marshal(refundReq)

		refundReqHTTP := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+orderID+"/refund", bytes.NewBuffer(refundBody))
		refundReqHTTP.Header.Set("Content-Type", "application/json")
		refundReqHTTP.Header.Set("X-Test-User-ID", setup.Staff.ID.String())
		refundReqHTTP.Header.Set("X-Test-Staff-ID", setup.Staff.ID.String())

		refundW := httptest.NewRecorder()
		router.ServeHTTP(refundW, refundReqHTTP)

		require.Equal(t, http.StatusOK, refundW.Code)

		var refundResp response.Response
		json.Unmarshal(refundW.Body.Bytes(), &refundResp)
		refundData := refundResp.Data.(map[string]interface{})

		assert.Equal(t, "REFUNDED", refundData["status"])

		// Verify balance was restored
		var walletAfterRefund wallet.Wallet
		suite.DB.First(&walletAfterRefund, "id = ?", setup.Wallet.ID)
		assert.Equal(t, initialBalance, walletAfterRefund.Balance)

		// Step 4: Verify order history shows all states
		historyReq := httptest.NewRequest(http.MethodGet, "/api/v1/me/orders/"+orderID, nil)
		historyReq.Header.Set("X-Test-User-ID", setup.User.ID.String())

		historyW := httptest.NewRecorder()
		router.ServeHTTP(historyW, historyReq)

		assert.Equal(t, http.StatusOK, historyW.Code)

		var historyResp response.Response
		json.Unmarshal(historyW.Body.Bytes(), &historyResp)
		historyData := historyResp.Data.(map[string]interface{})

		assert.Equal(t, "REFUNDED", historyData["status"])
		assert.Equal(t, "Customer complaint", historyData["notes"])
	})
}

// ============================================================================
// Helper to create order with products
// ============================================================================

func createTestOrderWithProducts(t *testing.T, db *gorm.DB, setup *helpers.TestSetup, status order.OrderStatus) *order.Order {
	t.Helper()

	items := order.OrderItems{
		{
			ProductID:   setup.Product.ID,
			ProductName: setup.Product.Name,
			Quantity:    2,
			UnitPrice:   setup.Product.Price,
			TotalPrice:  setup.Product.Price * 2,
		},
	}

	o := &order.Order{
		ID:            uuid.New(),
		FestivalID:    setup.Festival.ID,
		UserID:        setup.User.ID,
		WalletID:      setup.Wallet.ID,
		StandID:       setup.Stand.ID,
		Items:         items,
		TotalAmount:   setup.Product.Price * 2,
		Status:        status,
		PaymentMethod: "wallet",
	}

	if err := db.Create(o).Error; err != nil {
		t.Fatalf("Failed to create test order: %v", err)
	}

	return o
}

// Helper to log order state for debugging
func logOrderState(t *testing.T, db *gorm.DB, orderID uuid.UUID) {
	t.Helper()

	var o order.Order
	if err := db.First(&o, "id = ?", orderID).Error; err != nil {
		t.Logf("Failed to get order: %v", err)
		return
	}

	t.Logf("Order %s: Status=%s, Amount=%d, PaymentMethod=%s, TransactionID=%v",
		o.ID, o.Status, o.TotalAmount, o.PaymentMethod, o.TransactionID)
}

// Helper to verify wallet balance
func verifyWalletBalance(t *testing.T, db *gorm.DB, walletID uuid.UUID, expectedBalance int64) {
	t.Helper()

	var w wallet.Wallet
	if err := db.First(&w, "id = ?", walletID).Error; err != nil {
		t.Fatalf("Failed to get wallet: %v", err)
	}

	if w.Balance != expectedBalance {
		t.Errorf("Wallet balance mismatch: expected %d, got %d", expectedBalance, w.Balance)
	} else {
		t.Logf("Wallet balance verified: %d", w.Balance)
	}
}

// Debug helper
func debugOrderResponse(t *testing.T, w *httptest.ResponseRecorder) {
	t.Helper()
	t.Logf("Response Status: %d", w.Code)
	t.Logf("Response Body: %s", w.Body.String())
}

// Additional test for edge cases
func TestOrderEdgeCases(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Create order with inactive product fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create inactive product
		inactiveStatus := product.ProductStatusInactive
		inactiveProduct := helpers.CreateTestProduct(t, suite.DB, setup.Stand.ID, &helpers.ProductOptions{
			Name:   helpers.StringPtr("Inactive Product"),
			Status: &inactiveStatus,
		})

		createReq := order.CreateOrderRequest{
			StandID: setup.Stand.ID,
			Items: []order.OrderItemRequest{
				{ProductID: inactiveProduct.ID, Quantity: 1},
			},
			PaymentMethod: "wallet",
		}

		body, _ := json.Marshal(createReq)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.User.ID.String())
		req.Header.Set("X-Test-Festival-ID", setup.Festival.ID.String())
		req.Header.Set("X-Test-Wallet-ID", setup.Wallet.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Create order with zero quantity fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		createReq := order.CreateOrderRequest{
			StandID: setup.Stand.ID,
			Items: []order.OrderItemRequest{
				{ProductID: setup.Product.ID, Quantity: 0}, // Zero quantity
			},
			PaymentMethod: "wallet",
		}

		body, _ := json.Marshal(createReq)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.User.ID.String())
		req.Header.Set("X-Test-Festival-ID", setup.Festival.ID.String())
		req.Header.Set("X-Test-Wallet-ID", setup.Wallet.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Create order with invalid payment method fails", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		createReq := map[string]interface{}{
			"standId": setup.Stand.ID.String(),
			"items": []map[string]interface{}{
				{"productId": setup.Product.ID.String(), "quantity": 1},
			},
			"paymentMethod": "bitcoin", // Invalid
		}

		body, _ := json.Marshal(createReq)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", setup.User.ID.String())
		req.Header.Set("X-Test-Festival-ID", setup.Festival.ID.String())
		req.Header.Set("X-Test-Wallet-ID", setup.Wallet.ID.String())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Concurrent payment attempts are handled", func(t *testing.T) {
		setup := helpers.CreateFullTestSetup(t, suite.DB)
		router := setupOrderTestRouter(suite)

		// Create order
		pendingOrder := helpers.CreateTestOrder(t, suite.DB, setup.Festival.ID, setup.User.ID, setup.Wallet.ID, setup.Stand.ID, &helpers.OrderOptions{
			TotalAmount: helpers.Int64Ptr(500),
		})

		// Simulate first payment
		req1 := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+pendingOrder.ID.String()+"/pay", nil)
		req1.Header.Set("X-Test-User-ID", setup.Staff.ID.String())
		req1.Header.Set("X-Test-Staff-ID", setup.Staff.ID.String())

		w1 := httptest.NewRecorder()
		router.ServeHTTP(w1, req1)

		// First should succeed
		assert.Equal(t, http.StatusOK, w1.Code)

		// Second attempt should fail (order already paid)
		req2 := httptest.NewRequest(http.MethodPost, "/api/v1/orders/"+pendingOrder.ID.String()+"/pay", nil)
		req2.Header.Set("X-Test-User-ID", setup.Staff.ID.String())
		req2.Header.Set("X-Test-Staff-ID", setup.Staff.ID.String())

		w2 := httptest.NewRecorder()
		router.ServeHTTP(w2, req2)

		assert.Equal(t, http.StatusBadRequest, w2.Code)
	})
}

// Placeholder for the _ import
var _ = fmt.Sprintf
