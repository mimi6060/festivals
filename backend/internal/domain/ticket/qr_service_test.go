package ticket

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/qrcode"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockRepository is a mock implementation of Repository for testing
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) CreateTicketType(ctx context.Context, tt *TicketType) error {
	args := m.Called(ctx, tt)
	return args.Error(0)
}

func (m *MockRepository) GetTicketTypeByID(ctx context.Context, id uuid.UUID) (*TicketType, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*TicketType), args.Error(1)
}

func (m *MockRepository) UpdateTicketType(ctx context.Context, tt *TicketType) error {
	args := m.Called(ctx, tt)
	return args.Error(0)
}

func (m *MockRepository) DeleteTicketType(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) ListTicketTypesByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]TicketType, int64, error) {
	args := m.Called(ctx, festivalID, offset, limit)
	return args.Get(0).([]TicketType), args.Get(1).(int64), args.Error(2)
}

func (m *MockRepository) CreateTicket(ctx context.Context, t *Ticket) error {
	args := m.Called(ctx, t)
	return args.Error(0)
}

func (m *MockRepository) GetTicketByID(ctx context.Context, id uuid.UUID) (*Ticket, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Ticket), args.Error(1)
}

func (m *MockRepository) GetTicketByCode(ctx context.Context, code string) (*Ticket, error) {
	args := m.Called(ctx, code)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Ticket), args.Error(1)
}

func (m *MockRepository) UpdateTicket(ctx context.Context, t *Ticket) error {
	args := m.Called(ctx, t)
	return args.Error(0)
}

func (m *MockRepository) ListTicketsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Ticket, int64, error) {
	args := m.Called(ctx, festivalID, offset, limit)
	return args.Get(0).([]Ticket), args.Get(1).(int64), args.Error(2)
}

func (m *MockRepository) ListTicketsByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]Ticket, int64, error) {
	args := m.Called(ctx, userID, offset, limit)
	return args.Get(0).([]Ticket), args.Get(1).(int64), args.Error(2)
}

func (m *MockRepository) UpdateQuantitySold(ctx context.Context, ticketTypeID uuid.UUID, delta int) error {
	args := m.Called(ctx, ticketTypeID, delta)
	return args.Error(0)
}

func (m *MockRepository) CreateTicketScan(ctx context.Context, scan *TicketScan) error {
	args := m.Called(ctx, scan)
	return args.Error(0)
}

func (m *MockRepository) GetTicketScans(ctx context.Context, ticketID uuid.UUID, offset, limit int) ([]TicketScan, int64, error) {
	args := m.Called(ctx, ticketID, offset, limit)
	return args.Get(0).([]TicketScan), args.Get(1).(int64), args.Error(2)
}

func TestQRService_GenerateQRCode(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)

	generator := qrcode.NewGenerator(qrcode.Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
		QRSize:    128,
	})

	qrService := NewQRService(mockRepo, generator)

	// Setup test data
	ticketID := uuid.New()
	userID := uuid.New()
	festivalID := uuid.New()
	ticketTypeID := uuid.New()

	ticket := &Ticket{
		ID:           ticketID,
		TicketTypeID: ticketTypeID,
		FestivalID:   festivalID,
		UserID:       &userID,
		Code:         "TEST-CODE-123",
		Status:       TicketStatusValid,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	ticketType := &TicketType{
		ID:         ticketTypeID,
		FestivalID: festivalID,
		Name:       "VIP Pass",
		Price:      15000,
		ValidFrom:  time.Now().Add(-1 * time.Hour),
		ValidUntil: time.Now().Add(24 * time.Hour),
		Status:     TicketTypeStatusActive,
	}

	// Setup expectations
	mockRepo.On("GetTicketByID", ctx, ticketID).Return(ticket, nil)
	mockRepo.On("GetTicketTypeByID", ctx, ticketTypeID).Return(ticketType, nil)

	// Execute
	result, err := qrService.GenerateQRCode(ctx, ticketID)

	// Assert
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, ticketID, result.TicketID)
	assert.Equal(t, "TEST-CODE-123", result.TicketCode)
	assert.Equal(t, festivalID, result.FestivalID)
	assert.NotEmpty(t, result.QRData)
	assert.NotEmpty(t, result.QRImage)
	assert.NotEmpty(t, result.QRImageB64)

	mockRepo.AssertExpectations(t)
}

func TestQRService_GenerateQRCode_TicketNotFound(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)

	generator := qrcode.NewGenerator(qrcode.Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
	})

	qrService := NewQRService(mockRepo, generator)

	ticketID := uuid.New()

	// Setup expectations - ticket not found
	mockRepo.On("GetTicketByID", ctx, ticketID).Return(nil, nil)

	// Execute
	result, err := qrService.GenerateQRCode(ctx, ticketID)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, result)

	mockRepo.AssertExpectations(t)
}

func TestQRService_GenerateQRCode_CancelledTicket(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)

	generator := qrcode.NewGenerator(qrcode.Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
	})

	qrService := NewQRService(mockRepo, generator)

	ticketID := uuid.New()
	ticket := &Ticket{
		ID:     ticketID,
		Code:   "CANCELLED-123",
		Status: TicketStatusCancelled, // Cancelled ticket
	}

	// Setup expectations
	mockRepo.On("GetTicketByID", ctx, ticketID).Return(ticket, nil)

	// Execute
	result, err := qrService.GenerateQRCode(ctx, ticketID)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "cannot generate QR code")

	mockRepo.AssertExpectations(t)
}

func TestQRService_GenerateQRCodeByCode(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)

	generator := qrcode.NewGenerator(qrcode.Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
		QRSize:    128,
	})

	qrService := NewQRService(mockRepo, generator)

	// Setup test data
	ticketID := uuid.New()
	userID := uuid.New()
	festivalID := uuid.New()
	ticketTypeID := uuid.New()
	ticketCode := "SEARCH-CODE-456"

	ticket := &Ticket{
		ID:           ticketID,
		TicketTypeID: ticketTypeID,
		FestivalID:   festivalID,
		UserID:       &userID,
		Code:         ticketCode,
		Status:       TicketStatusValid,
	}

	ticketType := &TicketType{
		ID:         ticketTypeID,
		FestivalID: festivalID,
		Name:       "Standard",
		ValidFrom:  time.Now().Add(-1 * time.Hour),
		ValidUntil: time.Now().Add(24 * time.Hour),
	}

	// Setup expectations
	mockRepo.On("GetTicketByCode", ctx, ticketCode).Return(ticket, nil)
	mockRepo.On("GetTicketByID", ctx, ticketID).Return(ticket, nil)
	mockRepo.On("GetTicketTypeByID", ctx, ticketTypeID).Return(ticketType, nil)

	// Execute
	result, err := qrService.GenerateQRCodeByCode(ctx, ticketCode)

	// Assert
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, ticketCode, result.TicketCode)

	mockRepo.AssertExpectations(t)
}

func TestQRService_ValidateQRCode(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)

	generator := qrcode.NewGenerator(qrcode.Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
	})

	qrService := NewQRService(mockRepo, generator)

	// Setup test data
	ticketID := uuid.New()
	userID := uuid.New()
	festivalID := uuid.New()
	ticketCode := "VALIDATE-CODE-789"

	ticket := &Ticket{
		ID:         ticketID,
		FestivalID: festivalID,
		UserID:     &userID,
		Code:       ticketCode,
		Status:     TicketStatusValid,
	}

	// Generate QR data first
	validUntil := time.Now().Add(24 * time.Hour)
	qrData, err := generator.GenerateQRDataOnly(ticketID, userID, festivalID, ticketCode, validUntil)
	require.NoError(t, err)

	// Setup expectations
	mockRepo.On("GetTicketByID", ctx, ticketID).Return(ticket, nil)

	// Execute
	resultTicket, payload, err := qrService.ValidateQRCode(ctx, qrData)

	// Assert
	require.NoError(t, err)
	assert.NotNil(t, resultTicket)
	assert.NotNil(t, payload)
	assert.Equal(t, ticketID, resultTicket.ID)
	assert.Equal(t, ticketCode, payload.TicketCode)

	mockRepo.AssertExpectations(t)
}

func TestQRService_GetTicketQRInfo(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)

	generator := qrcode.NewGenerator(qrcode.Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
		QRSize:    128,
	})

	qrService := NewQRService(mockRepo, generator)

	// Setup test data
	ticketID := uuid.New()
	userID := uuid.New()
	festivalID := uuid.New()
	ticketTypeID := uuid.New()

	ticket := &Ticket{
		ID:           ticketID,
		TicketTypeID: ticketTypeID,
		FestivalID:   festivalID,
		UserID:       &userID,
		Code:         "INFO-CODE-999",
		Status:       TicketStatusValid,
	}

	ticketType := &TicketType{
		ID:         ticketTypeID,
		FestivalID: festivalID,
		Name:       "Premium Pass",
		Price:      25000,
		Benefits:   []string{"Fast Entry", "Free Parking"},
		ValidFrom:  time.Now().Add(-1 * time.Hour),
		ValidUntil: time.Now().Add(48 * time.Hour),
		Settings: TicketSettings{
			AllowReentry: true,
		},
	}

	// Setup expectations (called multiple times due to GetTicketQRInfo -> GenerateQRCode)
	mockRepo.On("GetTicketByID", ctx, ticketID).Return(ticket, nil).Times(2)
	mockRepo.On("GetTicketTypeByID", ctx, ticketTypeID).Return(ticketType, nil).Times(2)

	// Execute
	info, err := qrService.GetTicketQRInfo(ctx, ticketID)

	// Assert
	require.NoError(t, err)
	assert.NotNil(t, info)
	assert.Equal(t, ticket, info.Ticket)
	assert.Equal(t, ticketType, info.TicketType)
	assert.NotEmpty(t, info.QRCodeB64)
	assert.Contains(t, info.QRDataURI, "data:image/png;base64,")

	mockRepo.AssertExpectations(t)
}
