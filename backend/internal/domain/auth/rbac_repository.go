package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RBACRepository defines the interface for RBAC data access
type RBACRepository interface {
	// Permission operations
	CreatePermission(ctx context.Context, permission *Permission) error
	GetPermissionByID(ctx context.Context, id uuid.UUID) (*Permission, error)
	GetPermissionByKey(ctx context.Context, resource Resource, action Action) (*Permission, error)
	ListPermissions(ctx context.Context) ([]Permission, error)
	ListPermissionsByResource(ctx context.Context, resource Resource) ([]Permission, error)
	DeletePermission(ctx context.Context, id uuid.UUID) error

	// Role operations
	CreateRole(ctx context.Context, role *Role) error
	GetRoleByID(ctx context.Context, id uuid.UUID) (*Role, error)
	GetRoleByName(ctx context.Context, name string, festivalID *uuid.UUID) (*Role, error)
	ListRoles(ctx context.Context, festivalID *uuid.UUID) ([]Role, error)
	ListSystemRoles(ctx context.Context) ([]Role, error)
	ListCustomRoles(ctx context.Context, festivalID uuid.UUID) ([]Role, error)
	UpdateRole(ctx context.Context, role *Role) error
	DeleteRole(ctx context.Context, id uuid.UUID) error

	// Role-Permission operations
	AddPermissionToRole(ctx context.Context, roleID, permissionID uuid.UUID) error
	RemovePermissionFromRole(ctx context.Context, roleID, permissionID uuid.UUID) error
	SetRolePermissions(ctx context.Context, roleID uuid.UUID, permissionIDs []uuid.UUID) error
	GetRolePermissions(ctx context.Context, roleID uuid.UUID) ([]Permission, error)

	// Role Assignment operations
	CreateRoleAssignment(ctx context.Context, assignment *RoleAssignment) error
	GetRoleAssignment(ctx context.Context, userID, roleID uuid.UUID, festivalID *uuid.UUID) (*RoleAssignment, error)
	GetRoleAssignmentByID(ctx context.Context, id uuid.UUID) (*RoleAssignment, error)
	ListUserRoleAssignments(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) ([]RoleAssignment, error)
	ListRoleAssignmentsByRole(ctx context.Context, roleID uuid.UUID) ([]RoleAssignment, error)
	ListFestivalRoleAssignments(ctx context.Context, festivalID uuid.UUID) ([]RoleAssignment, error)
	UpdateRoleAssignment(ctx context.Context, assignment *RoleAssignment) error
	DeleteRoleAssignment(ctx context.Context, id uuid.UUID) error
	DeactivateRoleAssignment(ctx context.Context, userID, roleID uuid.UUID, festivalID *uuid.UUID) error

	// Permission check operations
	GetUserPermissions(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) ([]Permission, error)
	GetUserRoles(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) ([]Role, error)
	HasPermission(ctx context.Context, userID uuid.UUID, resource Resource, action Action, festivalID *uuid.UUID, standID *uuid.UUID) (bool, error)

	// Audit operations
	CreateAuditLog(ctx context.Context, log *RBACAuditLog) error
	ListAuditLogs(ctx context.Context, filter AuditLogFilter, offset, limit int) ([]RBACAuditLog, int64, error)

	// Bulk operations
	SeedPredefinedRoles(ctx context.Context) error
	SeedPermissions(ctx context.Context) error
}

// AuditLogFilter represents filters for audit log queries
type AuditLogFilter struct {
	ActorID      *uuid.UUID
	TargetUserID *uuid.UUID
	FestivalID   *uuid.UUID
	Action       *AuditAction
	Resource     *Resource
	StartDate    *time.Time
	EndDate      *time.Time
}

type rbacRepository struct {
	db *gorm.DB
}

// NewRBACRepository creates a new RBAC repository
func NewRBACRepository(db *gorm.DB) RBACRepository {
	return &rbacRepository{db: db}
}

// ============================================================================
// Permission Operations
// ============================================================================

func (r *rbacRepository) CreatePermission(ctx context.Context, permission *Permission) error {
	return r.db.WithContext(ctx).Create(permission).Error
}

func (r *rbacRepository) GetPermissionByID(ctx context.Context, id uuid.UUID) (*Permission, error) {
	var permission Permission
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&permission).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get permission: %w", err)
	}
	return &permission, nil
}

func (r *rbacRepository) GetPermissionByKey(ctx context.Context, resource Resource, action Action) (*Permission, error) {
	var permission Permission
	err := r.db.WithContext(ctx).
		Where("resource = ? AND action = ?", resource, action).
		First(&permission).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get permission by key: %w", err)
	}
	return &permission, nil
}

func (r *rbacRepository) ListPermissions(ctx context.Context) ([]Permission, error) {
	var permissions []Permission
	err := r.db.WithContext(ctx).Order("resource, action").Find(&permissions).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list permissions: %w", err)
	}
	return permissions, nil
}

func (r *rbacRepository) ListPermissionsByResource(ctx context.Context, resource Resource) ([]Permission, error) {
	var permissions []Permission
	err := r.db.WithContext(ctx).
		Where("resource = ?", resource).
		Order("action").
		Find(&permissions).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list permissions by resource: %w", err)
	}
	return permissions, nil
}

func (r *rbacRepository) DeletePermission(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&Permission{}).Error
}

// ============================================================================
// Role Operations
// ============================================================================

func (r *rbacRepository) CreateRole(ctx context.Context, role *Role) error {
	return r.db.WithContext(ctx).Create(role).Error
}

func (r *rbacRepository) GetRoleByID(ctx context.Context, id uuid.UUID) (*Role, error) {
	var role Role
	err := r.db.WithContext(ctx).
		Preload("Permissions").
		Where("id = ?", id).
		First(&role).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get role: %w", err)
	}
	return &role, nil
}

func (r *rbacRepository) GetRoleByName(ctx context.Context, name string, festivalID *uuid.UUID) (*Role, error) {
	var role Role
	query := r.db.WithContext(ctx).Preload("Permissions").Where("name = ?", name)
	if festivalID != nil {
		query = query.Where("festival_id = ?", *festivalID)
	} else {
		query = query.Where("festival_id IS NULL")
	}
	err := query.First(&role).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get role by name: %w", err)
	}
	return &role, nil
}

func (r *rbacRepository) ListRoles(ctx context.Context, festivalID *uuid.UUID) ([]Role, error) {
	var roles []Role
	query := r.db.WithContext(ctx).Preload("Permissions").Order("priority DESC, name")
	if festivalID != nil {
		// Include both festival-specific and global roles
		query = query.Where("festival_id = ? OR festival_id IS NULL", *festivalID)
	} else {
		// Global roles only
		query = query.Where("festival_id IS NULL")
	}
	err := query.Find(&roles).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list roles: %w", err)
	}
	return roles, nil
}

func (r *rbacRepository) ListSystemRoles(ctx context.Context) ([]Role, error) {
	var roles []Role
	err := r.db.WithContext(ctx).
		Preload("Permissions").
		Where("type = ?", RoleTypeSystem).
		Order("priority DESC").
		Find(&roles).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list system roles: %w", err)
	}
	return roles, nil
}

func (r *rbacRepository) ListCustomRoles(ctx context.Context, festivalID uuid.UUID) ([]Role, error) {
	var roles []Role
	err := r.db.WithContext(ctx).
		Preload("Permissions").
		Where("type = ? AND festival_id = ?", RoleTypeCustom, festivalID).
		Order("priority DESC, name").
		Find(&roles).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list custom roles: %w", err)
	}
	return roles, nil
}

func (r *rbacRepository) UpdateRole(ctx context.Context, role *Role) error {
	return r.db.WithContext(ctx).Save(role).Error
}

func (r *rbacRepository) DeleteRole(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Delete role-permission associations
		if err := tx.Where("role_id = ?", id).Delete(&RolePermission{}).Error; err != nil {
			return fmt.Errorf("failed to delete role permissions: %w", err)
		}
		// Delete role assignments
		if err := tx.Where("role_id = ?", id).Delete(&RoleAssignment{}).Error; err != nil {
			return fmt.Errorf("failed to delete role assignments: %w", err)
		}
		// Delete role
		if err := tx.Where("id = ?", id).Delete(&Role{}).Error; err != nil {
			return fmt.Errorf("failed to delete role: %w", err)
		}
		return nil
	})
}

// ============================================================================
// Role-Permission Operations
// ============================================================================

func (r *rbacRepository) AddPermissionToRole(ctx context.Context, roleID, permissionID uuid.UUID) error {
	rp := RolePermission{
		RoleID:       roleID,
		PermissionID: permissionID,
		CreatedAt:    time.Now(),
	}
	return r.db.WithContext(ctx).Create(&rp).Error
}

func (r *rbacRepository) RemovePermissionFromRole(ctx context.Context, roleID, permissionID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("role_id = ? AND permission_id = ?", roleID, permissionID).
		Delete(&RolePermission{}).Error
}

func (r *rbacRepository) SetRolePermissions(ctx context.Context, roleID uuid.UUID, permissionIDs []uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Remove existing permissions
		if err := tx.Where("role_id = ?", roleID).Delete(&RolePermission{}).Error; err != nil {
			return fmt.Errorf("failed to remove existing permissions: %w", err)
		}
		// Add new permissions
		for _, permID := range permissionIDs {
			rp := RolePermission{
				RoleID:       roleID,
				PermissionID: permID,
				CreatedAt:    time.Now(),
			}
			if err := tx.Create(&rp).Error; err != nil {
				return fmt.Errorf("failed to add permission to role: %w", err)
			}
		}
		return nil
	})
}

func (r *rbacRepository) GetRolePermissions(ctx context.Context, roleID uuid.UUID) ([]Permission, error) {
	var permissions []Permission
	err := r.db.WithContext(ctx).
		Joins("JOIN role_permissions ON role_permissions.permission_id = permissions.id").
		Where("role_permissions.role_id = ?", roleID).
		Order("permissions.resource, permissions.action").
		Find(&permissions).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get role permissions: %w", err)
	}
	return permissions, nil
}

// ============================================================================
// Role Assignment Operations
// ============================================================================

func (r *rbacRepository) CreateRoleAssignment(ctx context.Context, assignment *RoleAssignment) error {
	return r.db.WithContext(ctx).Create(assignment).Error
}

func (r *rbacRepository) GetRoleAssignment(ctx context.Context, userID, roleID uuid.UUID, festivalID *uuid.UUID) (*RoleAssignment, error) {
	var assignment RoleAssignment
	query := r.db.WithContext(ctx).
		Preload("Role").
		Preload("Role.Permissions").
		Where("user_id = ? AND role_id = ?", userID, roleID)
	if festivalID != nil {
		query = query.Where("festival_id = ?", *festivalID)
	} else {
		query = query.Where("festival_id IS NULL")
	}
	err := query.First(&assignment).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get role assignment: %w", err)
	}
	return &assignment, nil
}

func (r *rbacRepository) GetRoleAssignmentByID(ctx context.Context, id uuid.UUID) (*RoleAssignment, error) {
	var assignment RoleAssignment
	err := r.db.WithContext(ctx).
		Preload("Role").
		Preload("Role.Permissions").
		Where("id = ?", id).
		First(&assignment).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get role assignment by ID: %w", err)
	}
	return &assignment, nil
}

func (r *rbacRepository) ListUserRoleAssignments(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) ([]RoleAssignment, error) {
	var assignments []RoleAssignment
	query := r.db.WithContext(ctx).
		Preload("Role").
		Preload("Role.Permissions").
		Where("user_id = ? AND is_active = ?", userID, true)
	if festivalID != nil {
		// Include both festival-specific and global assignments
		query = query.Where("festival_id = ? OR festival_id IS NULL", *festivalID)
	}
	err := query.Order("assigned_at DESC").Find(&assignments).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list user role assignments: %w", err)
	}
	return assignments, nil
}

func (r *rbacRepository) ListRoleAssignmentsByRole(ctx context.Context, roleID uuid.UUID) ([]RoleAssignment, error) {
	var assignments []RoleAssignment
	err := r.db.WithContext(ctx).
		Preload("Role").
		Where("role_id = ? AND is_active = ?", roleID, true).
		Order("assigned_at DESC").
		Find(&assignments).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list role assignments by role: %w", err)
	}
	return assignments, nil
}

func (r *rbacRepository) ListFestivalRoleAssignments(ctx context.Context, festivalID uuid.UUID) ([]RoleAssignment, error) {
	var assignments []RoleAssignment
	err := r.db.WithContext(ctx).
		Preload("Role").
		Preload("Role.Permissions").
		Where("festival_id = ? AND is_active = ?", festivalID, true).
		Order("assigned_at DESC").
		Find(&assignments).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list festival role assignments: %w", err)
	}
	return assignments, nil
}

func (r *rbacRepository) UpdateRoleAssignment(ctx context.Context, assignment *RoleAssignment) error {
	return r.db.WithContext(ctx).Save(assignment).Error
}

func (r *rbacRepository) DeleteRoleAssignment(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&RoleAssignment{}).Error
}

func (r *rbacRepository) DeactivateRoleAssignment(ctx context.Context, userID, roleID uuid.UUID, festivalID *uuid.UUID) error {
	query := r.db.WithContext(ctx).
		Model(&RoleAssignment{}).
		Where("user_id = ? AND role_id = ?", userID, roleID)
	if festivalID != nil {
		query = query.Where("festival_id = ?", *festivalID)
	} else {
		query = query.Where("festival_id IS NULL")
	}
	return query.Update("is_active", false).Error
}

// ============================================================================
// Permission Check Operations
// ============================================================================

func (r *rbacRepository) GetUserPermissions(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) ([]Permission, error) {
	var permissions []Permission

	// Build subquery for active role assignments
	subQuery := r.db.WithContext(ctx).
		Table("role_assignments").
		Select("role_id").
		Where("user_id = ? AND is_active = ?", userID, true).
		Where("expires_at IS NULL OR expires_at > ?", time.Now())

	if festivalID != nil {
		subQuery = subQuery.Where("festival_id = ? OR festival_id IS NULL", *festivalID)
	}

	// Get permissions from assigned roles
	err := r.db.WithContext(ctx).
		Distinct().
		Joins("JOIN role_permissions ON role_permissions.permission_id = permissions.id").
		Where("role_permissions.role_id IN (?)", subQuery).
		Order("permissions.resource, permissions.action").
		Find(&permissions).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get user permissions: %w", err)
	}
	return permissions, nil
}

func (r *rbacRepository) GetUserRoles(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) ([]Role, error) {
	var roles []Role

	query := r.db.WithContext(ctx).
		Preload("Permissions").
		Joins("JOIN role_assignments ON role_assignments.role_id = roles.id").
		Where("role_assignments.user_id = ? AND role_assignments.is_active = ?", userID, true).
		Where("role_assignments.expires_at IS NULL OR role_assignments.expires_at > ?", time.Now())

	if festivalID != nil {
		query = query.Where("role_assignments.festival_id = ? OR role_assignments.festival_id IS NULL", *festivalID)
	}

	err := query.Order("roles.priority DESC").Find(&roles).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get user roles: %w", err)
	}
	return roles, nil
}

func (r *rbacRepository) HasPermission(ctx context.Context, userID uuid.UUID, resource Resource, action Action, festivalID *uuid.UUID, standID *uuid.UUID) (bool, error) {
	var count int64

	// Build query to check if user has the permission through any of their active roles
	subQuery := r.db.WithContext(ctx).
		Table("role_assignments").
		Select("role_id").
		Where("user_id = ? AND is_active = ?", userID, true).
		Where("expires_at IS NULL OR expires_at > ?", time.Now())

	if festivalID != nil {
		subQuery = subQuery.Where("festival_id = ? OR festival_id IS NULL", *festivalID)
	}

	if standID != nil {
		subQuery = subQuery.Where("stand_id = ? OR stand_id IS NULL", *standID)
	}

	// Check for permission
	err := r.db.WithContext(ctx).
		Table("permissions").
		Joins("JOIN role_permissions ON role_permissions.permission_id = permissions.id").
		Where("role_permissions.role_id IN (?)", subQuery).
		Where("permissions.resource = ? AND permissions.action = ?", resource, action).
		Count(&count).Error

	if err != nil {
		return false, fmt.Errorf("failed to check permission: %w", err)
	}

	return count > 0, nil
}

// ============================================================================
// Audit Operations
// ============================================================================

func (r *rbacRepository) CreateAuditLog(ctx context.Context, log *RBACAuditLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *rbacRepository) ListAuditLogs(ctx context.Context, filter AuditLogFilter, offset, limit int) ([]RBACAuditLog, int64, error) {
	var logs []RBACAuditLog
	var total int64

	query := r.db.WithContext(ctx).Model(&RBACAuditLog{})

	if filter.ActorID != nil {
		query = query.Where("actor_id = ?", *filter.ActorID)
	}
	if filter.TargetUserID != nil {
		query = query.Where("target_user_id = ?", *filter.TargetUserID)
	}
	if filter.FestivalID != nil {
		query = query.Where("festival_id = ?", *filter.FestivalID)
	}
	if filter.Action != nil {
		query = query.Where("action = ?", *filter.Action)
	}
	if filter.Resource != nil {
		query = query.Where("resource = ?", *filter.Resource)
	}
	if filter.StartDate != nil {
		query = query.Where("created_at >= ?", *filter.StartDate)
	}
	if filter.EndDate != nil {
		query = query.Where("created_at <= ?", *filter.EndDate)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count audit logs: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&logs).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list audit logs: %w", err)
	}

	return logs, total, nil
}

// ============================================================================
// Seed Operations
// ============================================================================

func (r *rbacRepository) SeedPermissions(ctx context.Context) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, resource := range AllResources() {
			for _, action := range AllActions() {
				// Check if permission already exists
				var count int64
				err := tx.Model(&Permission{}).
					Where("resource = ? AND action = ?", resource, action).
					Count(&count).Error
				if err != nil {
					return fmt.Errorf("failed to check existing permission: %w", err)
				}
				if count > 0 {
					continue
				}

				// Create permission
				permission := Permission{
					Resource:    resource,
					Action:      action,
					Scope:       ScopeFestival,
					Description: fmt.Sprintf("Can %s %s", action, resource),
				}
				if err := tx.Create(&permission).Error; err != nil {
					return fmt.Errorf("failed to create permission: %w", err)
				}
			}
		}
		return nil
	})
}

func (r *rbacRepository) SeedPredefinedRoles(ctx context.Context) error {
	predefinedRoles := GetPredefinedRoles()

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for roleName, config := range predefinedRoles {
			// Check if role already exists
			var existingRole Role
			var festivalID *uuid.UUID = nil
			err := tx.Where("name = ? AND festival_id IS NULL", roleName).First(&existingRole).Error
			if err == nil {
				// Role exists, skip
				continue
			}
			if err != gorm.ErrRecordNotFound {
				return fmt.Errorf("failed to check existing role: %w", err)
			}

			// Create role
			role := Role{
				Name:        string(roleName),
				DisplayName: config.DisplayName,
				Description: config.Description,
				Type:        RoleTypeSystem,
				FestivalID:  festivalID,
				Priority:    config.Priority,
				IsActive:    true,
			}
			if err := tx.Create(&role).Error; err != nil {
				return fmt.Errorf("failed to create role %s: %w", roleName, err)
			}

			// Add permissions to role
			for _, permConfig := range config.Permissions {
				var permission Permission
				err := tx.Where("resource = ? AND action = ?", permConfig.Resource, permConfig.Action).
					First(&permission).Error
				if err != nil {
					if err == gorm.ErrRecordNotFound {
						// Create permission if it doesn't exist
						permission = Permission{
							Resource:    permConfig.Resource,
							Action:      permConfig.Action,
							Scope:       permConfig.Scope,
							Description: fmt.Sprintf("Can %s %s", permConfig.Action, permConfig.Resource),
						}
						if err := tx.Create(&permission).Error; err != nil {
							return fmt.Errorf("failed to create permission: %w", err)
						}
					} else {
						return fmt.Errorf("failed to get permission: %w", err)
					}
				}

				// Create role-permission association
				rp := RolePermission{
					RoleID:       role.ID,
					PermissionID: permission.ID,
					CreatedAt:    time.Now(),
				}
				if err := tx.Create(&rp).Error; err != nil {
					return fmt.Errorf("failed to associate permission with role: %w", err)
				}
			}
		}
		return nil
	})
}
