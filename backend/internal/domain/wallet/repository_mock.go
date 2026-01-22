package wallet

import (
	"context"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
)

// MockRepository is a mock implementation of the Repository interface
type MockRepository struct {
	mock.Mock
}

// Ensure MockRepository implements Repository interface
var _ Repository = (*MockRepository)(nil)

func NewMockRepository() *MockRepository {
	return &MockRepository{}
}

func (m *MockRepository) CreateWallet(ctx context.Context, wallet *Wallet) error {
	args := m.Called(ctx, wallet)
	return args.Error(0)
}

func (m *MockRepository) GetWalletByID(ctx context.Context, id uuid.UUID) (*Wallet, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Wallet), args.Error(1)
}

func (m *MockRepository) GetWalletByUserAndFestival(ctx context.Context, userID, festivalID uuid.UUID) (*Wallet, error) {
	args := m.Called(ctx, userID, festivalID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Wallet), args.Error(1)
}

func (m *MockRepository) GetWalletsByUser(ctx context.Context, userID uuid.UUID) ([]Wallet, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]Wallet), args.Error(1)
}

func (m *MockRepository) UpdateWallet(ctx context.Context, wallet *Wallet) error {
	args := m.Called(ctx, wallet)
	return args.Error(0)
}

func (m *MockRepository) CreateTransaction(ctx context.Context, tx *Transaction) error {
	args := m.Called(ctx, tx)
	return args.Error(0)
}

func (m *MockRepository) GetTransactionByID(ctx context.Context, id uuid.UUID) (*Transaction, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Transaction), args.Error(1)
}

func (m *MockRepository) GetTransactionsByWallet(ctx context.Context, walletID uuid.UUID, offset, limit int) ([]Transaction, int64, error) {
	args := m.Called(ctx, walletID, offset, limit)
	return args.Get(0).([]Transaction), args.Get(1).(int64), args.Error(2)
}

func (m *MockRepository) UpdateTransaction(ctx context.Context, tx *Transaction) error {
	args := m.Called(ctx, tx)
	return args.Error(0)
}

func (m *MockRepository) ProcessPayment(ctx context.Context, walletID uuid.UUID, amount int64, txData *Transaction) error {
	args := m.Called(ctx, walletID, amount, txData)
	return args.Error(0)
}
