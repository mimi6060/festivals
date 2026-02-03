package product

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

func (m *MockRepository) Create(ctx context.Context, product *Product) error {
	args := m.Called(ctx, product)
	return args.Error(0)
}

func (m *MockRepository) CreateBulk(ctx context.Context, products []Product) error {
	args := m.Called(ctx, products)
	return args.Error(0)
}

func (m *MockRepository) GetByID(ctx context.Context, id uuid.UUID) (*Product, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Product), args.Error(1)
}

func (m *MockRepository) GetByIDs(ctx context.Context, ids []uuid.UUID) ([]Product, error) {
	args := m.Called(ctx, ids)
	return args.Get(0).([]Product), args.Error(1)
}

func (m *MockRepository) ListByStand(ctx context.Context, standID uuid.UUID, offset, limit int) ([]Product, int64, error) {
	args := m.Called(ctx, standID, offset, limit)
	return args.Get(0).([]Product), args.Get(1).(int64), args.Error(2)
}

func (m *MockRepository) ListByCategory(ctx context.Context, standID uuid.UUID, category ProductCategory) ([]Product, error) {
	args := m.Called(ctx, standID, category)
	return args.Get(0).([]Product), args.Error(1)
}

func (m *MockRepository) Update(ctx context.Context, product *Product) error {
	args := m.Called(ctx, product)
	return args.Error(0)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) UpdateStock(ctx context.Context, id uuid.UUID, delta int) error {
	args := m.Called(ctx, id, delta)
	return args.Error(0)
}

func (m *MockRepository) UpdateStockBulk(ctx context.Context, updates []StockUpdate) error {
	args := m.Called(ctx, updates)
	return args.Error(0)
}
