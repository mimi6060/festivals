package user

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

// Service handles user business logic
type Service struct {
	repo Repository
}

// NewService creates a new user service
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// GetOrCreateFromAuth0 retrieves a user by Auth0 ID or creates a new one from the Auth0 profile
func (s *Service) GetOrCreateFromAuth0(ctx context.Context, profile Auth0Profile) (*User, error) {
	// Try to find existing user by Auth0 ID
	existingUser, err := s.repo.GetByAuth0ID(ctx, profile.Sub)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup user by auth0 ID: %w", err)
	}

	if existingUser != nil {
		// Update user profile from Auth0 if needed
		updated := false
		if existingUser.Email != profile.Email && profile.Email != "" {
			existingUser.Email = profile.Email
			updated = true
		}
		if existingUser.Name != profile.Name && profile.Name != "" {
			existingUser.Name = profile.Name
			updated = true
		}
		if existingUser.Avatar != profile.Picture && profile.Picture != "" {
			existingUser.Avatar = profile.Picture
			updated = true
		}

		if updated {
			existingUser.UpdatedAt = time.Now()
			if err := s.repo.Update(ctx, existingUser); err != nil {
				return nil, fmt.Errorf("failed to update user from auth0 profile: %w", err)
			}
		}

		return existingUser, nil
	}

	// Check if email already exists (user might have been created differently)
	existingByEmail, err := s.repo.GetByEmail(ctx, profile.Email)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup user by email: %w", err)
	}

	if existingByEmail != nil {
		// Link Auth0 ID to existing user
		existingByEmail.Auth0ID = profile.Sub
		if profile.Picture != "" {
			existingByEmail.Avatar = profile.Picture
		}
		existingByEmail.UpdatedAt = time.Now()

		if err := s.repo.Update(ctx, existingByEmail); err != nil {
			return nil, fmt.Errorf("failed to link auth0 ID to existing user: %w", err)
		}

		return existingByEmail, nil
	}

	// Create new user from Auth0 profile
	name := profile.Name
	if name == "" {
		name = profile.Nickname
	}
	if name == "" {
		name = profile.Email
	}

	newUser := &User{
		ID:        uuid.New(),
		Email:     profile.Email,
		Name:      name,
		Avatar:    profile.Picture,
		Role:      UserRoleUser,
		Auth0ID:   profile.Sub,
		Status:    UserStatusActive,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.repo.Create(ctx, newUser); err != nil {
		return nil, fmt.Errorf("failed to create user from auth0 profile: %w", err)
	}

	return newUser, nil
}

// GetByID retrieves a user by ID
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.ErrNotFound
	}
	return user, nil
}

// GetByAuth0ID retrieves a user by Auth0 ID
func (s *Service) GetByAuth0ID(ctx context.Context, auth0ID string) (*User, error) {
	user, err := s.repo.GetByAuth0ID(ctx, auth0ID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.ErrNotFound
	}
	return user, nil
}

// GetByEmail retrieves a user by email
func (s *Service) GetByEmail(ctx context.Context, email string) (*User, error) {
	user, err := s.repo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.ErrNotFound
	}
	return user, nil
}

// UpdateProfile updates a user's profile information
func (s *Service) UpdateProfile(ctx context.Context, id uuid.UUID, req UpdateUserRequest) (*User, error) {
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.Name != nil {
		user.Name = *req.Name
	}
	if req.Phone != nil {
		user.Phone = *req.Phone
	}
	if req.Avatar != nil {
		user.Avatar = *req.Avatar
	}

	user.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to update user profile: %w", err)
	}

	return user, nil
}

// List retrieves a paginated list of users
func (s *Service) List(ctx context.Context, page, perPage int) ([]User, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.List(ctx, offset, perPage)
}

// ListByRole retrieves a paginated list of users filtered by role
func (s *Service) ListByRole(ctx context.Context, role UserRole, page, perPage int) ([]User, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListByRole(ctx, role, offset, perPage)
}

// Search searches for users by name or email
func (s *Service) Search(ctx context.Context, query string, page, perPage int) ([]User, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.Search(ctx, query, offset, perPage)
}

// UpdateRole updates a user's role (admin function)
func (s *Service) UpdateRole(ctx context.Context, id uuid.UUID, role UserRole) (*User, error) {
	if !role.IsValid() {
		return nil, errors.ErrValidation
	}

	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.ErrNotFound
	}

	user.Role = role
	user.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to update user role: %w", err)
	}

	return user, nil
}

// BanUser bans a user (admin function)
func (s *Service) BanUser(ctx context.Context, id uuid.UUID, reason string) (*User, error) {
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.ErrNotFound
	}

	// Prevent banning admins
	if user.Role == UserRoleAdmin {
		return nil, errors.ErrForbidden
	}

	user.Status = UserStatusBanned
	user.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to ban user: %w", err)
	}

	return user, nil
}

// UnbanUser unbans a user (admin function)
func (s *Service) UnbanUser(ctx context.Context, id uuid.UUID) (*User, error) {
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.ErrNotFound
	}

	if user.Status != UserStatusBanned {
		return nil, errors.ErrBadRequest
	}

	user.Status = UserStatusActive
	user.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to unban user: %w", err)
	}

	return user, nil
}

// Delete deletes a user (admin function)
func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.ErrNotFound
	}

	// Prevent deleting admins
	if user.Role == UserRoleAdmin {
		return errors.ErrForbidden
	}

	return s.repo.Delete(ctx, id)
}
