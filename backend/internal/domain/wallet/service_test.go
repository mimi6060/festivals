package wallet

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// testSecretKey is a 32+ character secret key used ONLY for unit tests.
// DO NOT use this in production. Production secrets must be set via environment variables.
const testSecretKey = "TEST_ONLY_not_for_production_use_32chars_min_secret_key_abc123"

// TestService_GetOrCreateWallet tests the GetOrCreateWallet method
func TestService_GetOrCreateWallet(t *testing.T) {
	tests := []struct {
		name       string
		userID     uuid.UUID
		festivalID uuid.UUID
		setupMock  func(*MockRepository, uuid.UUID, uuid.UUID)
		wantErr    bool
		wantNew    bool
	}{
		{
			name:       "get existing wallet",
			userID:     uuid.New(),
			festivalID: uuid.New(),
			setupMock: func(m *MockRepository, userID, festivalID uuid.UUID) {
				existingWallet := &Wallet{
					ID:         uuid.New(),
					UserID:     userID,
					FestivalID: festivalID,
					Balance:    5000,
					Status:     WalletStatusActive,
					CreatedAt:  time.Now().Add(-24 * time.Hour),
					UpdatedAt:  time.Now().Add(-24 * time.Hour),
				}
				m.On("GetWalletByUserAndFestival", mock.Anything, userID, festivalID).Return(existingWallet, nil)
			},
			wantErr: false,
			wantNew: false,
		},
		{
			name:       "create new wallet when not exists",
			userID:     uuid.New(),
			festivalID: uuid.New(),
			setupMock: func(m *MockRepository, userID, festivalID uuid.UUID) {
				m.On("GetWalletByUserAndFestival", mock.Anything, userID, festivalID).Return(nil, nil)
				m.On("CreateWallet", mock.Anything, mock.AnythingOfType("*wallet.Wallet")).Return(nil)
			},
			wantErr: false,
			wantNew: true,
		},
		{
			name:       "error on repository failure",
			userID:     uuid.New(),
			festivalID: uuid.New(),
			setupMock: func(m *MockRepository, userID, festivalID uuid.UUID) {
				m.On("GetWalletByUserAndFestival", mock.Anything, userID, festivalID).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.userID, tt.festivalID)

			service := NewService(mockRepo, testSecretKey)

			wallet, err := service.GetOrCreateWallet(context.Background(), tt.userID, tt.festivalID)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, wallet)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, wallet)
				assert.Equal(t, tt.userID, wallet.UserID)
				assert.Equal(t, tt.festivalID, wallet.FestivalID)

				if tt.wantNew {
					assert.Equal(t, int64(0), wallet.Balance)
					assert.Equal(t, WalletStatusActive, wallet.Status)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_TopUp tests the TopUp method
func TestService_TopUp(t *testing.T) {
	tests := []struct {
		name      string
		walletID  uuid.UUID
		req       TopUpRequest
		staffID   *uuid.UUID
		setupMock func(*MockRepository, uuid.UUID)
		wantErr   bool
		validate  func(*testing.T, *Transaction, *MockRepository)
	}{
		{
			name:     "top up with card payment",
			walletID: uuid.New(),
			req: TopUpRequest{
				Amount:        1000, // 10 EUR in cents
				PaymentMethod: "card",
				Reference:     "stripe_payment_123",
			},
			staffID: nil,
			setupMock: func(m *MockRepository, walletID uuid.UUID) {
				wallet := &Wallet{
					ID:        walletID,
					UserID:    uuid.New(),
					Balance:   5000,
					Status:    WalletStatusActive,
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}
				m.On("GetWalletByID", mock.Anything, walletID).Return(wallet, nil)
				m.On("UpdateWallet", mock.Anything, mock.AnythingOfType("*wallet.Wallet")).Return(nil)
				m.On("CreateTransaction", mock.Anything, mock.AnythingOfType("*wallet.Transaction")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, tx *Transaction, m *MockRepository) {
				assert.Equal(t, TransactionTypeTopUp, tx.Type)
				assert.Equal(t, int64(1000), tx.Amount)
				assert.Equal(t, "stripe_payment_123", tx.Reference)
				assert.Equal(t, TransactionStatusCompleted, tx.Status)
			},
		},
		{
			name:     "top up with cash payment",
			walletID: uuid.New(),
			req: TopUpRequest{
				Amount:        2000, // 20 EUR in cents
				PaymentMethod: "cash",
			},
			staffID: func() *uuid.UUID { id := uuid.New(); return &id }(),
			setupMock: func(m *MockRepository, walletID uuid.UUID) {
				wallet := &Wallet{
					ID:        walletID,
					UserID:    uuid.New(),
					Balance:   0,
					Status:    WalletStatusActive,
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}
				m.On("GetWalletByID", mock.Anything, walletID).Return(wallet, nil)
				m.On("UpdateWallet", mock.Anything, mock.AnythingOfType("*wallet.Wallet")).Return(nil)
				m.On("CreateTransaction", mock.Anything, mock.AnythingOfType("*wallet.Transaction")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, tx *Transaction, m *MockRepository) {
				assert.Equal(t, TransactionTypeCashIn, tx.Type)
				assert.Equal(t, int64(2000), tx.Amount)
				assert.NotNil(t, tx.StaffID)
			},
		},
		{
			name:     "top up frozen wallet fails",
			walletID: uuid.New(),
			req: TopUpRequest{
				Amount:        500,
				PaymentMethod: "card",
			},
			setupMock: func(m *MockRepository, walletID uuid.UUID) {
				wallet := &Wallet{
					ID:        walletID,
					UserID:    uuid.New(),
					Balance:   1000,
					Status:    WalletStatusFrozen,
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}
				m.On("GetWalletByID", mock.Anything, walletID).Return(wallet, nil)
			},
			wantErr: true,
		},
		{
			name:     "top up non-existent wallet fails",
			walletID: uuid.New(),
			req: TopUpRequest{
				Amount:        500,
				PaymentMethod: "card",
			},
			setupMock: func(m *MockRepository, walletID uuid.UUID) {
				m.On("GetWalletByID", mock.Anything, walletID).Return(nil, nil)
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.walletID)

			service := NewService(mockRepo, testSecretKey)

			tx, err := service.TopUp(context.Background(), tt.walletID, tt.req, tt.staffID)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, tx)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, tx)
				if tt.validate != nil {
					tt.validate(t, tx, mockRepo)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_ProcessPayment tests the ProcessPayment method
func TestService_ProcessPayment(t *testing.T) {
	tests := []struct {
		name      string
		req       PaymentRequest
		staffID   uuid.UUID
		setupMock func(*MockRepository)
		wantErr   bool
		validate  func(*testing.T, *Transaction)
	}{
		{
			name: "process payment with sufficient balance",
			req: PaymentRequest{
				WalletID:   uuid.New(),
				Amount:     500,
				StandID:    uuid.New(),
				ProductIDs: []string{"product1", "product2"},
			},
			staffID: uuid.New(),
			setupMock: func(m *MockRepository) {
				m.On("ProcessPayment", mock.Anything, mock.AnythingOfType("uuid.UUID"), int64(500), mock.AnythingOfType("*wallet.Transaction")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, tx *Transaction) {
				assert.Equal(t, TransactionTypePurchase, tx.Type)
				assert.NotNil(t, tx.StandID)
				assert.NotNil(t, tx.StaffID)
				assert.Equal(t, TransactionStatusCompleted, tx.Status)
				assert.Equal(t, []string{"product1", "product2"}, tx.Metadata.ProductIDs)
			},
		},
		{
			name: "process payment with insufficient balance",
			req: PaymentRequest{
				WalletID: uuid.New(),
				Amount:   5000,
				StandID:  uuid.New(),
			},
			staffID: uuid.New(),
			setupMock: func(m *MockRepository) {
				m.On("ProcessPayment", mock.Anything, mock.AnythingOfType("uuid.UUID"), int64(5000), mock.AnythingOfType("*wallet.Transaction")).Return(errors.New("insufficient balance"))
			},
			wantErr: true,
		},
		{
			name: "process payment with frozen wallet",
			req: PaymentRequest{
				WalletID: uuid.New(),
				Amount:   100,
				StandID:  uuid.New(),
			},
			staffID: uuid.New(),
			setupMock: func(m *MockRepository) {
				m.On("ProcessPayment", mock.Anything, mock.AnythingOfType("uuid.UUID"), int64(100), mock.AnythingOfType("*wallet.Transaction")).Return(errors.New("wallet is not active"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo)

			service := NewService(mockRepo, testSecretKey)

			tx, err := service.ProcessPayment(context.Background(), tt.req, tt.staffID)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, tx)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, tx)
				if tt.validate != nil {
					tt.validate(t, tx)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_QRPayload tests QR code generation and validation
func TestService_QRPayload(t *testing.T) {
	mockRepo := NewMockRepository()
	walletID := uuid.New()
	festivalID := uuid.New()

	wallet := &Wallet{
		ID:         walletID,
		UserID:     uuid.New(),
		FestivalID: festivalID,
		Balance:    5000,
		Status:     WalletStatusActive,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	mockRepo.On("GetWalletByID", mock.Anything, walletID).Return(wallet, nil)

	service := NewService(mockRepo, testSecretKey)

	// Generate QR payload
	encoded, err := service.GenerateQRPayload(context.Background(), walletID)
	assert.NoError(t, err)
	assert.NotEmpty(t, encoded)

	// Validate the generated payload
	payload, err := service.ValidateQRPayload(context.Background(), encoded)
	assert.NoError(t, err)
	assert.NotNil(t, payload)
	assert.Equal(t, walletID, payload.WalletID)
	assert.Equal(t, festivalID, payload.FestivalID)

	mockRepo.AssertExpectations(t)
}

// TestService_QRPayload_Expired tests QR code expiration
func TestService_QRPayload_Expired(t *testing.T) {
	service := NewService(nil, testSecretKey)

	// Create an expired payload (timestamp 10 minutes ago)
	expiredPayload := QRCodePayload{
		WalletID:   uuid.New(),
		FestivalID: uuid.New(),
		Timestamp:  time.Now().Add(-10 * time.Minute).Unix(),
	}

	// Sign it properly
	expiredPayload.Signature = service.signPayload(QRCodePayload{
		WalletID:   expiredPayload.WalletID,
		FestivalID: expiredPayload.FestivalID,
		Timestamp:  expiredPayload.Timestamp,
	})

	// Encode to base64
	data, _ := json.Marshal(expiredPayload)
	encoded := base64.StdEncoding.EncodeToString(data)

	// Try to validate - should fail due to expiration
	_, err := service.ValidateQRPayload(context.Background(), encoded)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "expired")
}

// TestService_QRPayload_InvalidSignature tests QR code with invalid signature
func TestService_QRPayload_InvalidSignature(t *testing.T) {
	service := NewService(nil, testSecretKey)

	// Create a payload with an invalid signature
	payload := QRCodePayload{
		WalletID:   uuid.New(),
		FestivalID: uuid.New(),
		Timestamp:  time.Now().Unix(),
		Signature:  "invalid-signature",
	}

	// Encode to base64
	data, _ := json.Marshal(payload)
	encoded := base64.StdEncoding.EncodeToString(data)

	// Try to validate - should fail due to invalid signature
	_, err := service.ValidateQRPayload(context.Background(), encoded)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid QR code signature")
}

// TestService_QRPayload_InvalidFormat tests QR code with invalid format
func TestService_QRPayload_InvalidFormat(t *testing.T) {
	service := NewService(nil, testSecretKey)

	tests := []struct {
		name    string
		encoded string
		errMsg  string
	}{
		{
			name:    "invalid base64",
			encoded: "not-valid-base64!!!",
			errMsg:  "invalid QR code format",
		},
		{
			name:    "invalid json",
			encoded: base64.StdEncoding.EncodeToString([]byte("not-json")),
			errMsg:  "invalid QR code data",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.ValidateQRPayload(context.Background(), tt.encoded)
			assert.Error(t, err)
			assert.Contains(t, err.Error(), tt.errMsg)
		})
	}
}

// TestService_FreezeWallet tests freezing a wallet
func TestService_FreezeWallet(t *testing.T) {
	mockRepo := NewMockRepository()
	walletID := uuid.New()

	wallet := &Wallet{
		ID:        walletID,
		UserID:    uuid.New(),
		Balance:   5000,
		Status:    WalletStatusActive,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	mockRepo.On("GetWalletByID", mock.Anything, walletID).Return(wallet, nil)
	mockRepo.On("UpdateWallet", mock.Anything, mock.MatchedBy(func(w *Wallet) bool {
		return w.Status == WalletStatusFrozen
	})).Return(nil)

	service := NewService(mockRepo, testSecretKey)

	frozenWallet, err := service.FreezeWallet(context.Background(), walletID)

	assert.NoError(t, err)
	assert.NotNil(t, frozenWallet)
	assert.Equal(t, WalletStatusFrozen, frozenWallet.Status)

	mockRepo.AssertExpectations(t)
}

// TestService_UnfreezeWallet tests unfreezing a wallet
func TestService_UnfreezeWallet(t *testing.T) {
	mockRepo := NewMockRepository()
	walletID := uuid.New()

	wallet := &Wallet{
		ID:        walletID,
		UserID:    uuid.New(),
		Balance:   5000,
		Status:    WalletStatusFrozen,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	mockRepo.On("GetWalletByID", mock.Anything, walletID).Return(wallet, nil)
	mockRepo.On("UpdateWallet", mock.Anything, mock.MatchedBy(func(w *Wallet) bool {
		return w.Status == WalletStatusActive
	})).Return(nil)

	service := NewService(mockRepo, testSecretKey)

	activeWallet, err := service.UnfreezeWallet(context.Background(), walletID)

	assert.NoError(t, err)
	assert.NotNil(t, activeWallet)
	assert.Equal(t, WalletStatusActive, activeWallet.Status)

	mockRepo.AssertExpectations(t)
}

// TestService_GetTransactions tests getting transactions with pagination
func TestService_GetTransactions(t *testing.T) {
	tests := []struct {
		name           string
		walletID       uuid.UUID
		page           int
		perPage        int
		expectedOffset int
		expectedLimit  int
		setupMock      func(*MockRepository, uuid.UUID)
	}{
		{
			name:           "first page default per page",
			walletID:       uuid.New(),
			page:           1,
			perPage:        20,
			expectedOffset: 0,
			expectedLimit:  20,
			setupMock: func(m *MockRepository, walletID uuid.UUID) {
				m.On("GetTransactionsByWallet", mock.Anything, walletID, 0, 20).Return([]Transaction{}, int64(0), nil)
			},
		},
		{
			name:           "second page",
			walletID:       uuid.New(),
			page:           2,
			perPage:        20,
			expectedOffset: 20,
			expectedLimit:  20,
			setupMock: func(m *MockRepository, walletID uuid.UUID) {
				m.On("GetTransactionsByWallet", mock.Anything, walletID, 20, 20).Return([]Transaction{}, int64(0), nil)
			},
		},
		{
			name:           "invalid page defaults to 1",
			walletID:       uuid.New(),
			page:           0,
			perPage:        20,
			expectedOffset: 0,
			expectedLimit:  20,
			setupMock: func(m *MockRepository, walletID uuid.UUID) {
				m.On("GetTransactionsByWallet", mock.Anything, walletID, 0, 20).Return([]Transaction{}, int64(0), nil)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.walletID)

			service := NewService(mockRepo, testSecretKey)

			_, _, err := service.GetTransactions(context.Background(), tt.walletID, tt.page, tt.perPage)
			assert.NoError(t, err)

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_RefundTransaction tests refunding a transaction
func TestService_RefundTransaction(t *testing.T) {
	tests := []struct {
		name          string
		transactionID uuid.UUID
		reason        string
		setupMock     func(*MockRepository, uuid.UUID)
		wantErr       bool
	}{
		{
			name:          "successful refund",
			transactionID: uuid.New(),
			reason:        "Customer request",
			setupMock: func(m *MockRepository, txID uuid.UUID) {
				walletID := uuid.New()
				originalTx := &Transaction{
					ID:       txID,
					WalletID: walletID,
					Type:     TransactionTypePurchase,
					Amount:   -500,
					Status:   TransactionStatusCompleted,
				}
				wallet := &Wallet{
					ID:      walletID,
					Balance: 1000,
					Status:  WalletStatusActive,
				}
				m.On("GetTransactionByID", mock.Anything, txID).Return(originalTx, nil)
				m.On("GetWalletByID", mock.Anything, walletID).Return(wallet, nil)
				m.On("UpdateWallet", mock.Anything, mock.AnythingOfType("*wallet.Wallet")).Return(nil)
				m.On("CreateTransaction", mock.Anything, mock.AnythingOfType("*wallet.Transaction")).Return(nil)
				m.On("UpdateTransaction", mock.Anything, mock.AnythingOfType("*wallet.Transaction")).Return(nil)
			},
			wantErr: false,
		},
		{
			name:          "refund non-purchase transaction fails",
			transactionID: uuid.New(),
			reason:        "Test",
			setupMock: func(m *MockRepository, txID uuid.UUID) {
				originalTx := &Transaction{
					ID:     txID,
					Type:   TransactionTypeTopUp,
					Status: TransactionStatusCompleted,
				}
				m.On("GetTransactionByID", mock.Anything, txID).Return(originalTx, nil)
			},
			wantErr: true,
		},
		{
			name:          "refund already refunded transaction fails",
			transactionID: uuid.New(),
			reason:        "Test",
			setupMock: func(m *MockRepository, txID uuid.UUID) {
				originalTx := &Transaction{
					ID:     txID,
					Type:   TransactionTypePurchase,
					Status: TransactionStatusRefunded,
				}
				m.On("GetTransactionByID", mock.Anything, txID).Return(originalTx, nil)
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.transactionID)

			service := NewService(mockRepo, testSecretKey)

			refundTx, err := service.RefundTransaction(context.Background(), tt.transactionID, tt.reason, nil)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, refundTx)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, refundTx)
				assert.Equal(t, TransactionTypeRefund, refundTx.Type)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
