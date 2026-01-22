package festival

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

func (m *MockRepository) Create(ctx context.Context, festival *Festival) error {
	args := m.Called(ctx, festival)
	return args.Error(0)
}

func (m *MockRepository) GetByID(ctx context.Context, id uuid.UUID) (*Festival, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Festival), args.Error(1)
}

func (m *MockRepository) GetBySlug(ctx context.Context, slug string) (*Festival, error) {
	args := m.Called(ctx, slug)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Festival), args.Error(1)
}

func (m *MockRepository) List(ctx context.Context, offset, limit int) ([]Festival, int64, error) {
	args := m.Called(ctx, offset, limit)
	return args.Get(0).([]Festival), args.Get(1).(int64), args.Error(2)
}

func (m *MockRepository) Update(ctx context.Context, festival *Festival) error {
	args := m.Called(ctx, festival)
	return args.Error(0)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) ExistsBySlug(ctx context.Context, slug string) (bool, error) {
	args := m.Called(ctx, slug)
	return args.Bool(0), args.Error(1)
}
