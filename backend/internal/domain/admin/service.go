package admin

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

// Service provides business logic for admin operations
type Service struct {
	repo Repository
}

// NewService creates a new admin service
func NewService(repo Repository) *Service {
	return &Service{
		repo: repo,
	}
}

// SuperAdmin Management

// CreateSuperAdmin creates a new super admin
func (s *Service) CreateSuperAdmin(ctx context.Context, req CreateSuperAdminRequest, creatorID uuid.UUID, ipAddress, userAgent string) (*SuperAdmin, error) {
	// Check if user is already a super admin
	existing, err := s.repo.GetSuperAdminByUserID(ctx, req.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing admin: %w", err)
	}
	if existing != nil {
		return nil, errors.ErrAlreadyExists
	}

	// Validate permissions
	if err := validatePermissions(req.Permissions); err != nil {
		return nil, err
	}

	admin := &SuperAdmin{
		ID:          uuid.New(),
		UserID:      req.UserID,
		Permissions: req.Permissions,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.repo.CreateSuperAdmin(ctx, admin); err != nil {
		return nil, fmt.Errorf("failed to create super admin: %w", err)
	}

	// Log the action
	s.logAction(ctx, creatorID, ActionCreate, ResourceTypeSuperAdmin, &admin.ID, AuditDetails{
		"user_id":     req.UserID.String(),
		"permissions": req.Permissions,
	}, ipAddress, userAgent)

	return admin, nil
}

// GetSuperAdmin gets a super admin by ID
func (s *Service) GetSuperAdmin(ctx context.Context, id uuid.UUID) (*SuperAdmin, error) {
	admin, err := s.repo.GetSuperAdminByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if admin == nil {
		return nil, errors.ErrNotFound
	}
	return admin, nil
}

// GetSuperAdminByUserID gets a super admin by user ID
func (s *Service) GetSuperAdminByUserID(ctx context.Context, userID uuid.UUID) (*SuperAdmin, error) {
	admin, err := s.repo.GetSuperAdminByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if admin == nil {
		return nil, errors.ErrNotFound
	}
	return admin, nil
}

// GetAllSuperAdmins gets all super admins
func (s *Service) GetAllSuperAdmins(ctx context.Context) ([]SuperAdmin, error) {
	return s.repo.GetAllSuperAdmins(ctx)
}

// UpdateSuperAdmin updates a super admin's permissions
func (s *Service) UpdateSuperAdmin(ctx context.Context, id uuid.UUID, req UpdateSuperAdminRequest, updaterID uuid.UUID, ipAddress, userAgent string) (*SuperAdmin, error) {
	admin, err := s.repo.GetSuperAdminByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if admin == nil {
		return nil, errors.ErrNotFound
	}

	// Validate permissions
	if err := validatePermissions(req.Permissions); err != nil {
		return nil, err
	}

	oldPermissions := admin.Permissions
	admin.Permissions = req.Permissions
	admin.UpdatedAt = time.Now()

	if err := s.repo.UpdateSuperAdmin(ctx, admin); err != nil {
		return nil, fmt.Errorf("failed to update super admin: %w", err)
	}

	// Log the action
	s.logAction(ctx, updaterID, ActionPermissionChange, ResourceTypeSuperAdmin, &id, AuditDetails{
		"old_permissions": oldPermissions,
		"new_permissions": req.Permissions,
	}, ipAddress, userAgent)

	return admin, nil
}

// DeleteSuperAdmin removes a super admin
func (s *Service) DeleteSuperAdmin(ctx context.Context, id uuid.UUID, deleterID uuid.UUID, ipAddress, userAgent string) error {
	admin, err := s.repo.GetSuperAdminByID(ctx, id)
	if err != nil {
		return err
	}
	if admin == nil {
		return errors.ErrNotFound
	}

	// Prevent self-deletion
	if admin.UserID == deleterID {
		return fmt.Errorf("cannot delete your own admin account")
	}

	if err := s.repo.DeleteSuperAdmin(ctx, id); err != nil {
		return fmt.Errorf("failed to delete super admin: %w", err)
	}

	// Log the action
	s.logAction(ctx, deleterID, ActionDelete, ResourceTypeSuperAdmin, &id, AuditDetails{
		"deleted_user_id": admin.UserID.String(),
	}, ipAddress, userAgent)

	return nil
}

// IsSuperAdmin checks if a user is a super admin
func (s *Service) IsSuperAdmin(ctx context.Context, userID uuid.UUID) (bool, error) {
	admin, err := s.repo.GetSuperAdminByUserID(ctx, userID)
	if err != nil {
		return false, err
	}
	return admin != nil, nil
}

// HasPermission checks if a user has a specific permission
func (s *Service) HasPermission(ctx context.Context, userID uuid.UUID, permission string) (bool, error) {
	admin, err := s.repo.GetSuperAdminByUserID(ctx, userID)
	if err != nil {
		return false, err
	}
	if admin == nil {
		return false, nil
	}
	return admin.HasPermission(permission), nil
}

// Platform Settings Management

// GetSetting gets a platform setting by key
func (s *Service) GetSetting(ctx context.Context, key string) (*PlatformSettings, error) {
	setting, err := s.repo.GetSettingByKey(ctx, key)
	if err != nil {
		return nil, err
	}
	if setting == nil {
		return nil, errors.ErrNotFound
	}
	return setting, nil
}

// GetAllSettings gets all platform settings
func (s *Service) GetAllSettings(ctx context.Context) ([]PlatformSettings, error) {
	return s.repo.GetAllSettings(ctx)
}

// UpdateSetting updates or creates a platform setting
func (s *Service) UpdateSetting(ctx context.Context, key string, req UpdateSettingRequest, updaterID uuid.UUID, ipAddress, userAgent string) (*PlatformSettings, error) {
	setting, err := s.repo.GetSettingByKey(ctx, key)
	if err != nil {
		return nil, err
	}

	var oldValue string
	if setting == nil {
		// Create new setting
		setting = &PlatformSettings{
			ID:          uuid.New(),
			Key:         key,
			Value:       req.Value,
			Description: req.Description,
			UpdatedAt:   time.Now(),
			UpdatedBy:   updaterID,
		}
		if err := s.repo.CreateSetting(ctx, setting); err != nil {
			return nil, fmt.Errorf("failed to create setting: %w", err)
		}
	} else {
		// Update existing setting
		oldValue = setting.Value
		setting.Value = req.Value
		if req.Description != "" {
			setting.Description = req.Description
		}
		setting.UpdatedAt = time.Now()
		setting.UpdatedBy = updaterID

		if err := s.repo.UpdateSetting(ctx, setting); err != nil {
			return nil, fmt.Errorf("failed to update setting: %w", err)
		}
	}

	// Log the action
	s.logAction(ctx, updaterID, ActionSettingChange, ResourceTypePlatformSetting, &setting.ID, AuditDetails{
		"key":       key,
		"old_value": oldValue,
		"new_value": req.Value,
	}, ipAddress, userAgent)

	return setting, nil
}

// System Metrics

// GetSystemOverview retrieves aggregated platform metrics
func (s *Service) GetSystemOverview(ctx context.Context) (*SystemMetrics, error) {
	return s.repo.GetSystemMetrics(ctx)
}

// Audit Trail

// GetAuditTrail retrieves audit logs with filtering
func (s *Service) GetAuditTrail(ctx context.Context, filter AuditLogFilter) ([]AuditLog, int64, error) {
	return s.repo.GetAuditLogs(ctx, filter)
}

// LogAdminAction logs an admin action (for external use)
func (s *Service) LogAdminAction(ctx context.Context, adminID uuid.UUID, action, resourceType string, resourceID *uuid.UUID, details AuditDetails, ipAddress, userAgent string) error {
	return s.logAction(ctx, adminID, action, resourceType, resourceID, details, ipAddress, userAgent)
}

// Helper functions

func (s *Service) logAction(ctx context.Context, adminID uuid.UUID, action, resourceType string, resourceID *uuid.UUID, details AuditDetails, ipAddress, userAgent string) error {
	log := &AuditLog{
		ID:           uuid.New(),
		AdminID:      adminID,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Details:      details,
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
		CreatedAt:    time.Now(),
	}

	return s.repo.CreateAuditLog(ctx, log)
}

var validPermissions = map[string]bool{
	PermissionManageAdmins:    true,
	PermissionManageSettings:  true,
	PermissionViewMetrics:     true,
	PermissionViewAuditLogs:   true,
	PermissionManageFestivals: true,
	PermissionManageUsers:     true,
	PermissionFullAccess:      true,
}

func validatePermissions(permissions []string) error {
	for _, p := range permissions {
		if !validPermissions[p] {
			return fmt.Errorf("invalid permission: %s", p)
		}
	}
	return nil
}
