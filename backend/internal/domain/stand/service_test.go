package stand

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// TestService_Create tests the Create method
func TestService_Create(t *testing.T) {
	tests := []struct {
		name       string
		festivalID uuid.UUID
		req        CreateStandRequest
		setupMock  func(*MockRepository)
		wantErr    bool
		validate   func(*testing.T, *Stand)
	}{
		{
			name:       "create bar stand with default settings",
			festivalID: uuid.New(),
			req: CreateStandRequest{
				Name:        "Main Bar",
				Description: "The main bar at the festival",
				Category:    StandCategoryBar,
				Location:    "Zone A",
			},
			setupMock: func(m *MockRepository) {
				m.On("Create", mock.Anything, mock.AnythingOfType("*stand.Stand")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, s *Stand) {
				assert.Equal(t, "Main Bar", s.Name)
				assert.Equal(t, "The main bar at the festival", s.Description)
				assert.Equal(t, StandCategoryBar, s.Category)
				assert.Equal(t, "Zone A", s.Location)
				assert.Equal(t, StandStatusActive, s.Status)
				assert.True(t, s.Settings.AcceptsOnlyTokens)
				assert.False(t, s.Settings.RequiresPIN)
				assert.False(t, s.Settings.PrintReceipts)
			},
		},
		{
			name:       "create food stand with custom settings",
			festivalID: uuid.New(),
			req: CreateStandRequest{
				Name:        "Food Truck",
				Description: "Gourmet burgers",
				Category:    StandCategoryFood,
				Location:    "Zone B",
				ImageURL:    "https://example.com/food.jpg",
				Settings: &StandSettings{
					AcceptsOnlyTokens: true,
					RequiresPIN:       true,
					PrintReceipts:     true,
					Color:             "#FF5733",
				},
			},
			setupMock: func(m *MockRepository) {
				m.On("Create", mock.Anything, mock.AnythingOfType("*stand.Stand")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, s *Stand) {
				assert.Equal(t, "Food Truck", s.Name)
				assert.Equal(t, StandCategoryFood, s.Category)
				assert.Equal(t, "https://example.com/food.jpg", s.ImageURL)
				assert.True(t, s.Settings.RequiresPIN)
				assert.True(t, s.Settings.PrintReceipts)
				assert.Equal(t, "#FF5733", s.Settings.Color)
			},
		},
		{
			name:       "create merchandise stand",
			festivalID: uuid.New(),
			req: CreateStandRequest{
				Name:     "Merch Booth",
				Category: StandCategoryMerchandise,
				Location: "Entrance",
			},
			setupMock: func(m *MockRepository) {
				m.On("Create", mock.Anything, mock.AnythingOfType("*stand.Stand")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, s *Stand) {
				assert.Equal(t, "Merch Booth", s.Name)
				assert.Equal(t, StandCategoryMerchandise, s.Category)
			},
		},
		{
			name:       "create top-up stand",
			festivalID: uuid.New(),
			req: CreateStandRequest{
				Name:     "Top-Up Point",
				Category: StandCategoryTopUp,
				Location: "Main Gate",
			},
			setupMock: func(m *MockRepository) {
				m.On("Create", mock.Anything, mock.AnythingOfType("*stand.Stand")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, s *Stand) {
				assert.Equal(t, "Top-Up Point", s.Name)
				assert.Equal(t, StandCategoryTopUp, s.Category)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo)

			service := NewService(mockRepo)

			stand, err := service.Create(context.Background(), tt.festivalID, tt.req)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, stand)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, stand)
				assert.Equal(t, tt.festivalID, stand.FestivalID)
				assert.NotEqual(t, uuid.Nil, stand.ID)
				if tt.validate != nil {
					tt.validate(t, stand)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_AssignStaff tests the AssignStaff method
func TestService_AssignStaff(t *testing.T) {
	tests := []struct {
		name      string
		standID   uuid.UUID
		req       AssignStaffRequest
		setupMock func(*MockRepository, uuid.UUID)
		wantErr   bool
		validate  func(*testing.T, *StandStaff)
	}{
		{
			name:    "assign manager without PIN",
			standID: uuid.New(),
			req: AssignStaffRequest{
				UserID: uuid.New(),
				Role:   StaffRoleManager,
			},
			setupMock: func(m *MockRepository, standID uuid.UUID) {
				stand := &Stand{
					ID:       standID,
					Name:     "Test Stand",
					Status:   StandStatusActive,
					Category: StandCategoryBar,
				}
				m.On("GetByID", mock.Anything, standID).Return(stand, nil)
				m.On("GetStaffMember", mock.Anything, standID, mock.AnythingOfType("uuid.UUID")).Return(nil, nil)
				m.On("AssignStaff", mock.Anything, mock.AnythingOfType("*stand.StandStaff")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, staff *StandStaff) {
				assert.Equal(t, StaffRoleManager, staff.Role)
				assert.Empty(t, staff.PIN)
			},
		},
		{
			name:    "assign cashier with PIN",
			standID: uuid.New(),
			req: AssignStaffRequest{
				UserID: uuid.New(),
				Role:   StaffRoleCashier,
				PIN:    "1234",
			},
			setupMock: func(m *MockRepository, standID uuid.UUID) {
				stand := &Stand{
					ID:       standID,
					Name:     "Test Stand",
					Status:   StandStatusActive,
					Category: StandCategoryBar,
				}
				m.On("GetByID", mock.Anything, standID).Return(stand, nil)
				m.On("GetStaffMember", mock.Anything, standID, mock.AnythingOfType("uuid.UUID")).Return(nil, nil)
				m.On("AssignStaff", mock.Anything, mock.AnythingOfType("*stand.StandStaff")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, staff *StandStaff) {
				assert.Equal(t, StaffRoleCashier, staff.Role)
				assert.NotEmpty(t, staff.PIN)
				// Verify PIN is hashed
				expectedHash := hashPIN("1234")
				assert.Equal(t, expectedHash, staff.PIN)
			},
		},
		{
			name:    "assign assistant",
			standID: uuid.New(),
			req: AssignStaffRequest{
				UserID: uuid.New(),
				Role:   StaffRoleAssistant,
			},
			setupMock: func(m *MockRepository, standID uuid.UUID) {
				stand := &Stand{
					ID:       standID,
					Name:     "Test Stand",
					Status:   StandStatusActive,
					Category: StandCategoryFood,
				}
				m.On("GetByID", mock.Anything, standID).Return(stand, nil)
				m.On("GetStaffMember", mock.Anything, standID, mock.AnythingOfType("uuid.UUID")).Return(nil, nil)
				m.On("AssignStaff", mock.Anything, mock.AnythingOfType("*stand.StandStaff")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, staff *StandStaff) {
				assert.Equal(t, StaffRoleAssistant, staff.Role)
			},
		},
		{
			name:    "assign to non-existent stand fails",
			standID: uuid.New(),
			req: AssignStaffRequest{
				UserID: uuid.New(),
				Role:   StaffRoleCashier,
			},
			setupMock: func(m *MockRepository, standID uuid.UUID) {
				m.On("GetByID", mock.Anything, standID).Return(nil, nil)
			},
			wantErr: true,
		},
		{
			name:    "assign already assigned user fails",
			standID: uuid.New(),
			req: AssignStaffRequest{
				UserID: uuid.New(),
				Role:   StaffRoleCashier,
			},
			setupMock: func(m *MockRepository, standID uuid.UUID) {
				stand := &Stand{
					ID:       standID,
					Name:     "Test Stand",
					Status:   StandStatusActive,
					Category: StandCategoryBar,
				}
				existingStaff := &StandStaff{
					ID:      uuid.New(),
					StandID: standID,
					Role:    StaffRoleManager,
				}
				m.On("GetByID", mock.Anything, standID).Return(stand, nil)
				m.On("GetStaffMember", mock.Anything, standID, mock.AnythingOfType("uuid.UUID")).Return(existingStaff, nil)
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.standID)

			service := NewService(mockRepo)

			staff, err := service.AssignStaff(context.Background(), tt.standID, tt.req)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, staff)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, staff)
				assert.Equal(t, tt.standID, staff.StandID)
				assert.Equal(t, tt.req.UserID, staff.UserID)
				if tt.validate != nil {
					tt.validate(t, staff)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_ValidatePIN tests the ValidateStaffPIN method
func TestService_ValidatePIN(t *testing.T) {
	tests := []struct {
		name      string
		standID   uuid.UUID
		userID    uuid.UUID
		pin       string
		setupMock func(*MockRepository, uuid.UUID, uuid.UUID)
		wantValid bool
		wantErr   bool
	}{
		{
			name:    "valid PIN",
			standID: uuid.New(),
			userID:  uuid.New(),
			pin:     "1234",
			setupMock: func(m *MockRepository, standID, userID uuid.UUID) {
				staff := &StandStaff{
					ID:      uuid.New(),
					StandID: standID,
					UserID:  userID,
					Role:    StaffRoleCashier,
					PIN:     hashPIN("1234"),
				}
				m.On("GetStaffMember", mock.Anything, standID, userID).Return(staff, nil)
			},
			wantValid: true,
			wantErr:   false,
		},
		{
			name:    "invalid PIN",
			standID: uuid.New(),
			userID:  uuid.New(),
			pin:     "wrong",
			setupMock: func(m *MockRepository, standID, userID uuid.UUID) {
				staff := &StandStaff{
					ID:      uuid.New(),
					StandID: standID,
					UserID:  userID,
					Role:    StaffRoleCashier,
					PIN:     hashPIN("1234"),
				}
				m.On("GetStaffMember", mock.Anything, standID, userID).Return(staff, nil)
			},
			wantValid: false,
			wantErr:   false,
		},
		{
			name:    "no PIN required returns true",
			standID: uuid.New(),
			userID:  uuid.New(),
			pin:     "",
			setupMock: func(m *MockRepository, standID, userID uuid.UUID) {
				staff := &StandStaff{
					ID:      uuid.New(),
					StandID: standID,
					UserID:  userID,
					Role:    StaffRoleManager,
					PIN:     "", // No PIN set
				}
				m.On("GetStaffMember", mock.Anything, standID, userID).Return(staff, nil)
			},
			wantValid: true,
			wantErr:   false,
		},
		{
			name:    "staff member not found",
			standID: uuid.New(),
			userID:  uuid.New(),
			pin:     "1234",
			setupMock: func(m *MockRepository, standID, userID uuid.UUID) {
				m.On("GetStaffMember", mock.Anything, standID, userID).Return(nil, nil)
			},
			wantValid: false,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.standID, tt.userID)

			service := NewService(mockRepo)

			valid, err := service.ValidateStaffPIN(context.Background(), tt.standID, tt.userID, tt.pin)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantValid, valid)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_Update tests the Update method
func TestService_Update(t *testing.T) {
	tests := []struct {
		name      string
		standID   uuid.UUID
		req       UpdateStandRequest
		setupMock func(*MockRepository, uuid.UUID)
		wantErr   bool
		validate  func(*testing.T, *Stand)
	}{
		{
			name:    "update stand name",
			standID: uuid.New(),
			req: UpdateStandRequest{
				Name: func() *string { s := "Updated Bar Name"; return &s }(),
			},
			setupMock: func(m *MockRepository, standID uuid.UUID) {
				existing := &Stand{
					ID:       standID,
					Name:     "Original Name",
					Category: StandCategoryBar,
					Status:   StandStatusActive,
					Settings: StandSettings{AcceptsOnlyTokens: true},
				}
				m.On("GetByID", mock.Anything, standID).Return(existing, nil)
				m.On("Update", mock.Anything, mock.AnythingOfType("*stand.Stand")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, s *Stand) {
				assert.Equal(t, "Updated Bar Name", s.Name)
			},
		},
		{
			name:    "update multiple fields",
			standID: uuid.New(),
			req: UpdateStandRequest{
				Name:        func() *string { s := "New Name"; return &s }(),
				Description: func() *string { s := "New Description"; return &s }(),
				Location:    func() *string { s := "New Location"; return &s }(),
			},
			setupMock: func(m *MockRepository, standID uuid.UUID) {
				existing := &Stand{
					ID:          standID,
					Name:        "Old Name",
					Description: "Old Description",
					Location:    "Old Location",
					Category:    StandCategoryFood,
					Status:      StandStatusActive,
				}
				m.On("GetByID", mock.Anything, standID).Return(existing, nil)
				m.On("Update", mock.Anything, mock.AnythingOfType("*stand.Stand")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, s *Stand) {
				assert.Equal(t, "New Name", s.Name)
				assert.Equal(t, "New Description", s.Description)
				assert.Equal(t, "New Location", s.Location)
			},
		},
		{
			name:    "update non-existent stand fails",
			standID: uuid.New(),
			req: UpdateStandRequest{
				Name: func() *string { s := "Test"; return &s }(),
			},
			setupMock: func(m *MockRepository, standID uuid.UUID) {
				m.On("GetByID", mock.Anything, standID).Return(nil, nil)
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.standID)

			service := NewService(mockRepo)

			stand, err := service.Update(context.Background(), tt.standID, tt.req)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, stand)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, stand)
				if tt.validate != nil {
					tt.validate(t, stand)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_Activate tests the Activate method
func TestService_Activate(t *testing.T) {
	mockRepo := NewMockRepository()
	standID := uuid.New()

	existing := &Stand{
		ID:        standID,
		Name:      "Test Stand",
		Category:  StandCategoryBar,
		Status:    StandStatusInactive,
		CreatedAt: time.Now().Add(-24 * time.Hour),
		UpdatedAt: time.Now().Add(-24 * time.Hour),
	}

	mockRepo.On("GetByID", mock.Anything, standID).Return(existing, nil)
	mockRepo.On("Update", mock.Anything, mock.MatchedBy(func(s *Stand) bool {
		return s.Status == StandStatusActive
	})).Return(nil)

	service := NewService(mockRepo)

	stand, err := service.Activate(context.Background(), standID)

	assert.NoError(t, err)
	assert.NotNil(t, stand)
	assert.Equal(t, StandStatusActive, stand.Status)

	mockRepo.AssertExpectations(t)
}

// TestService_Deactivate tests the Deactivate method
func TestService_Deactivate(t *testing.T) {
	mockRepo := NewMockRepository()
	standID := uuid.New()

	existing := &Stand{
		ID:        standID,
		Name:      "Test Stand",
		Category:  StandCategoryBar,
		Status:    StandStatusActive,
		CreatedAt: time.Now().Add(-24 * time.Hour),
		UpdatedAt: time.Now().Add(-24 * time.Hour),
	}

	mockRepo.On("GetByID", mock.Anything, standID).Return(existing, nil)
	mockRepo.On("Update", mock.Anything, mock.MatchedBy(func(s *Stand) bool {
		return s.Status == StandStatusInactive
	})).Return(nil)

	service := NewService(mockRepo)

	stand, err := service.Deactivate(context.Background(), standID)

	assert.NoError(t, err)
	assert.NotNil(t, stand)
	assert.Equal(t, StandStatusInactive, stand.Status)

	mockRepo.AssertExpectations(t)
}

// TestService_Delete tests the Delete method
func TestService_Delete(t *testing.T) {
	tests := []struct {
		name      string
		standID   uuid.UUID
		setupMock func(*MockRepository, uuid.UUID)
		wantErr   bool
	}{
		{
			name:    "delete existing stand",
			standID: uuid.New(),
			setupMock: func(m *MockRepository, standID uuid.UUID) {
				stand := &Stand{
					ID:       standID,
					Name:     "Test Stand",
					Status:   StandStatusActive,
					Category: StandCategoryBar,
				}
				m.On("GetByID", mock.Anything, standID).Return(stand, nil)
				m.On("Delete", mock.Anything, standID).Return(nil)
			},
			wantErr: false,
		},
		{
			name:    "delete non-existent stand fails",
			standID: uuid.New(),
			setupMock: func(m *MockRepository, standID uuid.UUID) {
				m.On("GetByID", mock.Anything, standID).Return(nil, nil)
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.standID)

			service := NewService(mockRepo)

			err := service.Delete(context.Background(), tt.standID)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_GetStaff tests the GetStaff method
func TestService_GetStaff(t *testing.T) {
	mockRepo := NewMockRepository()
	standID := uuid.New()

	staff := []StandStaff{
		{ID: uuid.New(), StandID: standID, UserID: uuid.New(), Role: StaffRoleManager},
		{ID: uuid.New(), StandID: standID, UserID: uuid.New(), Role: StaffRoleCashier},
	}

	mockRepo.On("GetStaffByStand", mock.Anything, standID).Return(staff, nil)

	service := NewService(mockRepo)

	result, err := service.GetStaff(context.Background(), standID)

	assert.NoError(t, err)
	assert.Len(t, result, 2)

	mockRepo.AssertExpectations(t)
}

// TestHashPIN tests the PIN hashing function
func TestHashPIN(t *testing.T) {
	tests := []struct {
		name string
		pin  string
	}{
		{name: "4 digit PIN", pin: "1234"},
		{name: "6 digit PIN", pin: "123456"},
		{name: "complex PIN", pin: "9999"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hash := hashPIN(tt.pin)

			// Verify it's a valid SHA256 hex string
			assert.Len(t, hash, 64) // SHA256 produces 64 hex characters

			// Verify same input produces same output
			assert.Equal(t, hash, hashPIN(tt.pin))

			// Verify it matches expected SHA256
			h := sha256.Sum256([]byte(tt.pin))
			expected := hex.EncodeToString(h[:])
			assert.Equal(t, expected, hash)
		})
	}
}
