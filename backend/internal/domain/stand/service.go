package stand

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Create creates a new stand
func (s *Service) Create(ctx context.Context, festivalID uuid.UUID, req CreateStandRequest) (*Stand, error) {
	settings := StandSettings{
		AcceptsOnlyTokens: true,
		RequiresPIN:       false,
		PrintReceipts:     false,
	}
	if req.Settings != nil {
		settings = *req.Settings
	}

	stand := &Stand{
		ID:          uuid.New(),
		FestivalID:  festivalID,
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Location:    req.Location,
		ImageURL:    req.ImageURL,
		Status:      StandStatusActive,
		Settings:    settings,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.repo.Create(ctx, stand); err != nil {
		return nil, fmt.Errorf("failed to create stand: %w", err)
	}

	return stand, nil
}

// GetByID gets a stand by ID
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Stand, error) {
	stand, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if stand == nil {
		return nil, errors.ErrNotFound
	}
	return stand, nil
}

// List lists stands for a festival
func (s *Service) List(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]Stand, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListByFestival(ctx, festivalID, offset, perPage)
}

// ListByCategory lists stands by category
func (s *Service) ListByCategory(ctx context.Context, festivalID uuid.UUID, category StandCategory) ([]Stand, error) {
	return s.repo.ListByCategory(ctx, festivalID, category)
}

// Update updates a stand
func (s *Service) Update(ctx context.Context, id uuid.UUID, req UpdateStandRequest) (*Stand, error) {
	stand, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if stand == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.Name != nil {
		stand.Name = *req.Name
	}
	if req.Description != nil {
		stand.Description = *req.Description
	}
	if req.Category != nil {
		stand.Category = *req.Category
	}
	if req.Location != nil {
		stand.Location = *req.Location
	}
	if req.ImageURL != nil {
		stand.ImageURL = *req.ImageURL
	}
	if req.Status != nil {
		stand.Status = *req.Status
	}
	if req.Settings != nil {
		stand.Settings = *req.Settings
	}

	stand.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, stand); err != nil {
		return nil, fmt.Errorf("failed to update stand: %w", err)
	}

	return stand, nil
}

// Delete deletes a stand
func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	stand, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if stand == nil {
		return errors.ErrNotFound
	}

	return s.repo.Delete(ctx, id)
}

// AssignStaff assigns a staff member to a stand
func (s *Service) AssignStaff(ctx context.Context, standID uuid.UUID, req AssignStaffRequest) (*StandStaff, error) {
	// Check if stand exists
	stand, err := s.repo.GetByID(ctx, standID)
	if err != nil {
		return nil, err
	}
	if stand == nil {
		return nil, errors.ErrNotFound
	}

	// Check if already assigned
	existing, err := s.repo.GetStaffMember(ctx, standID, req.UserID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("user already assigned to this stand")
	}

	staff := &StandStaff{
		ID:        uuid.New(),
		StandID:   standID,
		UserID:    req.UserID,
		Role:      req.Role,
		CreatedAt: time.Now(),
	}

	// Hash PIN if provided
	if req.PIN != "" {
		staff.PIN = hashPIN(req.PIN)
	}

	if err := s.repo.AssignStaff(ctx, staff); err != nil {
		return nil, fmt.Errorf("failed to assign staff: %w", err)
	}

	return staff, nil
}

// RemoveStaff removes a staff member from a stand
func (s *Service) RemoveStaff(ctx context.Context, standID, userID uuid.UUID) error {
	existing, err := s.repo.GetStaffMember(ctx, standID, userID)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.ErrNotFound
	}

	return s.repo.RemoveStaff(ctx, standID, userID)
}

// GetStaff gets all staff assigned to a stand
func (s *Service) GetStaff(ctx context.Context, standID uuid.UUID) ([]StandStaff, error) {
	return s.repo.GetStaffByStand(ctx, standID)
}

// GetUserStands gets all stands a user is assigned to
func (s *Service) GetUserStands(ctx context.Context, userID uuid.UUID) ([]StandStaff, error) {
	return s.repo.GetStaffByUser(ctx, userID)
}

// ValidateStaffPIN validates a staff member's PIN
func (s *Service) ValidateStaffPIN(ctx context.Context, standID, userID uuid.UUID, pin string) (bool, error) {
	staff, err := s.repo.GetStaffMember(ctx, standID, userID)
	if err != nil {
		return false, err
	}
	if staff == nil {
		return false, errors.ErrNotFound
	}

	if staff.PIN == "" {
		// No PIN required
		return true, nil
	}

	return staff.PIN == hashPIN(pin), nil
}

// Activate activates a stand
func (s *Service) Activate(ctx context.Context, id uuid.UUID) (*Stand, error) {
	status := StandStatusActive
	return s.Update(ctx, id, UpdateStandRequest{Status: &status})
}

// Deactivate deactivates a stand
func (s *Service) Deactivate(ctx context.Context, id uuid.UUID) (*Stand, error) {
	status := StandStatusInactive
	return s.Update(ctx, id, UpdateStandRequest{Status: &status})
}

func hashPIN(pin string) string {
	h := sha256.Sum256([]byte(pin))
	return hex.EncodeToString(h[:])
}
