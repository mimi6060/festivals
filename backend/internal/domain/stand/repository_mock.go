package stand

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

func (m *MockRepository) Create(ctx context.Context, stand *Stand) error {
	args := m.Called(ctx, stand)
	return args.Error(0)
}

func (m *MockRepository) GetByID(ctx context.Context, id uuid.UUID) (*Stand, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Stand), args.Error(1)
}

func (m *MockRepository) ListByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Stand, int64, error) {
	args := m.Called(ctx, festivalID, offset, limit)
	return args.Get(0).([]Stand), args.Get(1).(int64), args.Error(2)
}

func (m *MockRepository) ListByCategory(ctx context.Context, festivalID uuid.UUID, category StandCategory) ([]Stand, error) {
	args := m.Called(ctx, festivalID, category)
	return args.Get(0).([]Stand), args.Error(1)
}

func (m *MockRepository) Update(ctx context.Context, stand *Stand) error {
	args := m.Called(ctx, stand)
	return args.Error(0)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) AssignStaff(ctx context.Context, staff *StandStaff) error {
	args := m.Called(ctx, staff)
	return args.Error(0)
}

func (m *MockRepository) RemoveStaff(ctx context.Context, standID, userID uuid.UUID) error {
	args := m.Called(ctx, standID, userID)
	return args.Error(0)
}

func (m *MockRepository) GetStaffByStand(ctx context.Context, standID uuid.UUID) ([]StandStaff, error) {
	args := m.Called(ctx, standID)
	return args.Get(0).([]StandStaff), args.Error(1)
}

func (m *MockRepository) GetStaffByUser(ctx context.Context, userID uuid.UUID) ([]StandStaff, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]StandStaff), args.Error(1)
}

func (m *MockRepository) GetStaffMember(ctx context.Context, standID, userID uuid.UUID) (*StandStaff, error) {
	args := m.Called(ctx, standID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*StandStaff), args.Error(1)
}
