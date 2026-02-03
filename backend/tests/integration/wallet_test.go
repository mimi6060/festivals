package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/wallet"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
	"github.com/mimi6060/festivals/backend/tests/helpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// Create Wallet Tests
// ============================================================================

func TestWalletCreateFlow(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Create wallet for user in festival", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/me/wallets/"+testFestival.ID.String(), nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.NotEmpty(t, data["id"])
		assert.Equal(t, testUser.ID.String(), data["userId"])
		assert.Equal(t, testFestival.ID.String(), data["festivalId"])
		assert.Equal(t, float64(0), data["balance"])
		assert.Equal(t, "ACTIVE", data["status"])
	})

	t.Run("Get or create wallet returns existing wallet", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)

		// Create wallet first
		existingWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)

		// Try to create again (should return existing)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/me/wallets/"+testFestival.ID.String(), nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, existingWallet.ID.String(), data["id"])
		assert.Equal(t, float64(5000), data["balance"])
	})

	t.Run("Create wallet without user ID fails", func(t *testing.T) {
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/me/wallets/"+testFestival.ID.String(), nil)
		// No X-Test-User-ID header

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("Create wallet with invalid festival ID fails", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/me/wallets/invalid-uuid", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

// ============================================================================
// Top Up Tests
// ============================================================================

func TestWalletTopUpFlow(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Top up wallet with card payment", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 0)
		staff := helpers.CreateTestStaff(t, suite.DB)

		topUpReq := wallet.TopUpRequest{
			Amount:        1000, // 10 EUR
			PaymentMethod: "card",
			Reference:     "stripe_payment_123",
		}

		body, err := json.Marshal(topUpReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/wallets/"+testWallet.ID.String()+"/topup", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err = json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, "TOP_UP", data["type"])
		assert.Equal(t, float64(1000), data["amount"])
		assert.Equal(t, float64(0), data["balanceBefore"])
		assert.Equal(t, float64(1000), data["balanceAfter"])
		assert.Equal(t, "stripe_payment_123", data["reference"])
		assert.Equal(t, "COMPLETED", data["status"])
	})

	t.Run("Top up wallet with cash payment", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 500)
		staff := helpers.CreateTestStaff(t, suite.DB)

		topUpReq := wallet.TopUpRequest{
			Amount:        2000, // 20 EUR
			PaymentMethod: "cash",
		}

		body, err := json.Marshal(topUpReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/wallets/"+testWallet.ID.String()+"/topup", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err = json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, "CASH_IN", data["type"])
		assert.Equal(t, float64(2000), data["amount"])
		assert.Equal(t, float64(500), data["balanceBefore"])
		assert.Equal(t, float64(2500), data["balanceAfter"])
		assert.NotNil(t, data["staffId"])
	})

	t.Run("Top up frozen wallet fails", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		frozenStatus := wallet.WalletStatusFrozen
		testWallet := helpers.CreateTestWallet(t, suite.DB, testUser.ID, testFestival.ID, &helpers.WalletOptions{
			Balance: helpers.Int64Ptr(1000),
			Status:  &frozenStatus,
		})
		staff := helpers.CreateTestStaff(t, suite.DB)

		topUpReq := wallet.TopUpRequest{
			Amount:        500,
			PaymentMethod: "card",
		}

		body, err := json.Marshal(topUpReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/wallets/"+testWallet.ID.String()+"/topup", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})

	t.Run("Top up with invalid amount fails", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 0)
		staff := helpers.CreateTestStaff(t, suite.DB)

		topUpReq := map[string]interface{}{
			"amount":        50, // Less than minimum (100 cents)
			"paymentMethod": "card",
		}

		body, err := json.Marshal(topUpReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/wallets/"+testWallet.ID.String()+"/topup", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Top up non-existent wallet fails", func(t *testing.T) {
		staff := helpers.CreateTestStaff(t, suite.DB)
		nonExistentID := uuid.New()

		topUpReq := wallet.TopUpRequest{
			Amount:        1000,
			PaymentMethod: "card",
		}

		body, err := json.Marshal(topUpReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/wallets/"+nonExistentID.String()+"/topup", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})
}

// ============================================================================
// Payment Tests
// ============================================================================

func TestWalletPaymentFlow(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Process payment with sufficient balance", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)
		staff := helpers.CreateTestStaff(t, suite.DB)

		paymentReq := wallet.PaymentRequest{
			WalletID:   testWallet.ID,
			Amount:     1000, // 10 EUR
			StandID:    testStand.ID,
			ProductIDs: []string{"product1", "product2"},
		}

		body, err := json.Marshal(paymentReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/payments", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err = json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, "PURCHASE", data["type"])
		assert.Equal(t, float64(-1000), data["amount"]) // Negative for debit
		assert.Equal(t, float64(5000), data["balanceBefore"])
		assert.Equal(t, float64(4000), data["balanceAfter"])
		assert.Equal(t, "COMPLETED", data["status"])
		assert.Equal(t, testStand.ID.String(), data["standId"])
	})

	t.Run("Process payment with insufficient balance fails", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 500)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)
		staff := helpers.CreateTestStaff(t, suite.DB)

		paymentReq := wallet.PaymentRequest{
			WalletID: testWallet.ID,
			Amount:   5000, // More than balance
			StandID:  testStand.ID,
		}

		body, err := json.Marshal(paymentReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/payments", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		errData := resp["error"].(map[string]interface{})
		assert.Equal(t, "INSUFFICIENT_BALANCE", errData["code"])
	})

	t.Run("Process payment on frozen wallet fails", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		frozenStatus := wallet.WalletStatusFrozen
		testWallet := helpers.CreateTestWallet(t, suite.DB, testUser.ID, testFestival.ID, &helpers.WalletOptions{
			Balance: helpers.Int64Ptr(5000),
			Status:  &frozenStatus,
		})
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)
		staff := helpers.CreateTestStaff(t, suite.DB)

		paymentReq := wallet.PaymentRequest{
			WalletID: testWallet.ID,
			Amount:   500,
			StandID:  testStand.ID,
		}

		body, err := json.Marshal(paymentReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/payments", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		errData := resp["error"].(map[string]interface{})
		assert.Equal(t, "WALLET_FROZEN", errData["code"])
	})

	t.Run("Process payment without staff auth fails", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)

		paymentReq := wallet.PaymentRequest{
			WalletID: testWallet.ID,
			Amount:   500,
			StandID:  testStand.ID,
		}

		body, err := json.Marshal(paymentReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/payments", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		// No X-Test-User-ID or X-Test-Staff-ID

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})
}

// ============================================================================
// Refund Tests
// ============================================================================

func TestWalletRefundFlow(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Refund completed transaction", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 4000)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Create a purchase transaction to refund
		purchaseType := wallet.TransactionTypePurchase
		originalTx := helpers.CreateTestTransaction(t, suite.DB, testWallet.ID, 5000, 4000, &helpers.TransactionOptions{
			Type:    &purchaseType,
			Amount:  helpers.Int64Ptr(-1000),
			StandID: &testStand.ID,
		})

		refundReq := wallet.RefundRequest{
			TransactionID: originalTx.ID,
			Reason:        "Customer complaint",
		}

		body, err := json.Marshal(refundReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/payments/refund", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err = json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, "REFUND", data["type"])
		assert.Equal(t, float64(1000), data["amount"]) // Positive for credit
		assert.Equal(t, "COMPLETED", data["status"])
	})

	t.Run("Refund top-up transaction fails", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 1000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Create a top-up transaction (cannot be refunded via this endpoint)
		topUpType := wallet.TransactionTypeTopUp
		topUpTx := helpers.CreateTestTransaction(t, suite.DB, testWallet.ID, 0, 1000, &helpers.TransactionOptions{
			Type:   &topUpType,
			Amount: helpers.Int64Ptr(1000),
		})

		refundReq := wallet.RefundRequest{
			TransactionID: topUpTx.ID,
			Reason:        "Test refund",
		}

		body, err := json.Marshal(refundReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/payments/refund", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})

	t.Run("Refund already refunded transaction fails", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Create a refunded transaction
		purchaseType := wallet.TransactionTypePurchase
		refundedStatus := wallet.TransactionStatusRefunded
		refundedTx := helpers.CreateTestTransaction(t, suite.DB, testWallet.ID, 6000, 5000, &helpers.TransactionOptions{
			Type:    &purchaseType,
			Amount:  helpers.Int64Ptr(-1000),
			StandID: &testStand.ID,
			Status:  &refundedStatus,
		})

		refundReq := wallet.RefundRequest{
			TransactionID: refundedTx.ID,
			Reason:        "Try refund again",
		}

		body, err := json.Marshal(refundReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/payments/refund", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})

	t.Run("Refund non-existent transaction fails", func(t *testing.T) {
		staff := helpers.CreateTestStaff(t, suite.DB)
		nonExistentID := uuid.New()

		refundReq := wallet.RefundRequest{
			TransactionID: nonExistentID,
			Reason:        "Test refund",
		}

		body, err := json.Marshal(refundReq)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/payments/refund", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", staff.ID.String())
		req.Header.Set("X-Test-Staff-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

// ============================================================================
// Wallet Status Tests
// ============================================================================

func TestWalletStatusFlow(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Freeze wallet", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/wallets/"+testWallet.ID.String()+"/freeze", nil)
		req.Header.Set("X-Test-User-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, "FROZEN", data["status"])
		assert.Equal(t, float64(5000), data["balance"]) // Balance unchanged
	})

	t.Run("Unfreeze wallet", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		frozenStatus := wallet.WalletStatusFrozen
		testWallet := helpers.CreateTestWallet(t, suite.DB, testUser.ID, testFestival.ID, &helpers.WalletOptions{
			Balance: helpers.Int64Ptr(3000),
			Status:  &frozenStatus,
		})
		staff := helpers.CreateTestStaff(t, suite.DB)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/wallets/"+testWallet.ID.String()+"/unfreeze", nil)
		req.Header.Set("X-Test-User-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, "ACTIVE", data["status"])
	})
}

// ============================================================================
// QR Code Tests
// ============================================================================

func TestWalletQRFlow(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Generate QR code for wallet", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/me/wallets/"+testFestival.ID.String()+"/qr", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.NotEmpty(t, data["qrCode"])
		assert.Equal(t, float64(5000), data["balance"])
	})

	t.Run("Validate QR code", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// First generate QR
		genReq := httptest.NewRequest(http.MethodGet, "/api/v1/me/wallets/"+testFestival.ID.String()+"/qr", nil)
		genReq.Header.Set("X-Test-User-ID", testUser.ID.String())

		genW := httptest.NewRecorder()
		suite.Router.ServeHTTP(genW, genReq)

		require.Equal(t, http.StatusOK, genW.Code)

		var genResp response.Response
		json.Unmarshal(genW.Body.Bytes(), &genResp)
		qrData := genResp.Data.(map[string]interface{})
		qrCode := qrData["qrCode"].(string)

		// Now validate QR
		validateReq := map[string]string{"qrCode": qrCode}
		body, _ := json.Marshal(validateReq)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/payments/validate-qr", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.(map[string]interface{})
		require.True(t, ok)

		assert.Equal(t, float64(5000), data["balance"])
		assert.Equal(t, "ACTIVE", data["status"])
	})

	t.Run("Invalid QR code fails validation", func(t *testing.T) {
		staff := helpers.CreateTestStaff(t, suite.DB)

		validateReq := map[string]string{"qrCode": "invalid-qr-code"}
		body, _ := json.Marshal(validateReq)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/payments/validate-qr", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User-ID", staff.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

// ============================================================================
// Transaction History Tests
// ============================================================================

func TestWalletTransactionHistory(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Get wallet transactions with pagination", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateTestFestival(t, suite.DB, nil)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)

		// Create multiple transactions
		for i := 0; i < 25; i++ {
			balance := int64(1000 + (i * 100))
			newBalance := balance + 100
			helpers.CreateTestTransaction(t, suite.DB, testWallet.ID, balance, newBalance, nil)
		}

		// Get first page
		req := httptest.NewRequest(http.MethodGet, "/api/v1/me/wallets/"+testFestival.ID.String()+"/transactions?page=1&per_page=10", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.([]interface{})
		require.True(t, ok)
		assert.Len(t, data, 10)

		require.NotNil(t, resp.Meta)
		assert.GreaterOrEqual(t, resp.Meta.Total, 25)
		assert.Equal(t, 1, resp.Meta.Page)
		assert.Equal(t, 10, resp.Meta.PerPage)
	})

	t.Run("Get user wallets list", func(t *testing.T) {
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Create multiple wallets in different festivals
		for i := 0; i < 3; i++ {
			fest := helpers.CreateTestFestival(t, suite.DB, &helpers.FestivalOptions{
				Name: helpers.StringPtr("Festival " + string(rune('A'+i))),
			})
			helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, fest.ID, int64(1000*(i+1)))
		}

		req := httptest.NewRequest(http.MethodGet, "/api/v1/me/wallets", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())

		w := httptest.NewRecorder()
		suite.Router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp response.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		data, ok := resp.Data.([]interface{})
		require.True(t, ok)
		assert.Len(t, data, 3)
	})
}
