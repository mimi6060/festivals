package auth

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
)

// ============================================================================
// Role Assignment Service
// ============================================================================

// RoleAssignmentService handles multi-role assignment logic
type RoleAssignmentService interface {
	// Multi-role assignment
	AssignMultipleRoles(ctx context.Context, actorID uuid.UUID, userID uuid.UUID, festivalID *uuid.UUID, roleIDs []uuid.UUID, notes string) ([]RoleAssignment, error)
	RemoveMultipleRoles(ctx context.Context, actorID uuid.UUID, userID uuid.UUID, festivalID *uuid.UUID, roleIDs []uuid.UUID, reason string) error
	ReplaceUserRoles(ctx context.Context, actorID uuid.UUID, userID uuid.UUID, festivalID *uuid.UUID, roleIDs []uuid.UUID, notes string) ([]RoleAssignment, error)

	// Role inheritance
	GetEffectiveRoles(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) ([]Role, error)
	GetInheritedRoles(ctx context.Context, role Role) []PredefinedRoleName

	// Custom role operations
	CreateCustomRole(ctx context.Context, actorID uuid.UUID, festivalID uuid.UUID, req CreateCustomRoleRequest) (*Role, error)
	CloneRole(ctx context.Context, actorID uuid.UUID, sourceRoleID uuid.UUID, festivalID uuid.UUID, newName, newDisplayName string) (*Role, error)
	MergeRolePermissions(ctx context.Context, actorID uuid.UUID, targetRoleID uuid.UUID, sourceRoleIDs []uuid.UUID) error

	// Bulk operations
	BulkAssignRole(ctx context.Context, actorID uuid.UUID, roleID uuid.UUID, festivalID *uuid.UUID, userIDs []uuid.UUID, notes string) ([]RoleAssignment, []error)
	BulkRemoveRole(ctx context.Context, actorID uuid.UUID, roleID uuid.UUID, festivalID *uuid.UUID, userIDs []uuid.UUID, reason string) []error

	// Temporary role assignments
	AssignTemporaryRole(ctx context.Context, actorID uuid.UUID, req AssignRoleRequest, duration time.Duration) (*RoleAssignment, error)
	ExtendRoleExpiration(ctx context.Context, actorID uuid.UUID, assignmentID uuid.UUID, newExpiration time.Time) (*RoleAssignment, error)

	// Role validation
	CanAssignRole(ctx context.Context, actorID uuid.UUID, targetUserID uuid.UUID, roleID uuid.UUID, festivalID *uuid.UUID) (bool, string)
	CanRemoveRole(ctx context.Context, actorID uuid.UUID, targetUserID uuid.UUID, roleID uuid.UUID, festivalID *uuid.UUID) (bool, string)
	ValidateRoleAssignment(ctx context.Context, userID uuid.UUID, roleID uuid.UUID, festivalID *uuid.UUID) error

	// Role analysis
	GetUserRoleSummary(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) (*UserRoleSummary, error)
	GetConflictingRoles(ctx context.Context, roleID1, roleID2 uuid.UUID) ([]PermissionConflict, error)
}

// CreateCustomRoleRequest represents a request to create a custom role
type CreateCustomRoleRequest struct {
	Name              string             `json:"name" binding:"required"`
	DisplayName       string             `json:"displayName" binding:"required"`
	Description       string             `json:"description"`
	PermissionIDs     []uuid.UUID        `json:"permissionIds"`
	PermissionStrings []PermissionString `json:"permissionStrings"`
	InheritsFrom      *uuid.UUID         `json:"inheritsFrom,omitempty"`
	Priority          int                `json:"priority"`
}

// UserRoleSummary provides a summary of a user's roles
type UserRoleSummary struct {
	UserID              uuid.UUID            `json:"userId"`
	FestivalID          *uuid.UUID           `json:"festivalId,omitempty"`
	TotalRoles          int                  `json:"totalRoles"`
	SystemRoles         []Role               `json:"systemRoles"`
	CustomRoles         []Role               `json:"customRoles"`
	HighestPriorityRole *Role                `json:"highestPriorityRole,omitempty"`
	TotalPermissions    int                  `json:"totalPermissions"`
	PermissionGroups    []string             `json:"permissionGroups"`
	ExpiringAssignments []RoleAssignment     `json:"expiringAssignments"`
	EffectiveAt         string               `json:"effectiveAt"`
}

// PermissionConflict represents a conflict between permissions
type PermissionConflict struct {
	Permission1 Permission `json:"permission1"`
	Permission2 Permission `json:"permission2"`
	Reason      string     `json:"reason"`
}

// ============================================================================
// Role Assignment Service Implementation
// ============================================================================

type roleAssignmentService struct {
	repo        RBACRepository
	rbacService RBACService
}

// NewRoleAssignmentService creates a new role assignment service
func NewRoleAssignmentService(repo RBACRepository, rbacService RBACService) RoleAssignmentService {
	return &roleAssignmentService{
		repo:        repo,
		rbacService: rbacService,
	}
}

// ============================================================================
// Multi-Role Assignment
// ============================================================================

// AssignMultipleRoles assigns multiple roles to a user
func (s *roleAssignmentService) AssignMultipleRoles(ctx context.Context, actorID uuid.UUID, userID uuid.UUID, festivalID *uuid.UUID, roleIDs []uuid.UUID, notes string) ([]RoleAssignment, error) {
	var assignments []RoleAssignment
	var errs []error

	for _, roleID := range roleIDs {
		// Validate assignment
		if err := s.ValidateRoleAssignment(ctx, userID, roleID, festivalID); err != nil {
			errs = append(errs, fmt.Errorf("role %s: %w", roleID, err))
			continue
		}

		// Create assignment
		assignment, err := s.rbacService.AssignRole(ctx, actorID, AssignRoleRequest{
			UserID:     userID,
			RoleID:     roleID,
			FestivalID: festivalID,
			Notes:      notes,
		})
		if err != nil {
			errs = append(errs, fmt.Errorf("role %s: %w", roleID, err))
			continue
		}

		assignments = append(assignments, *assignment)
	}

	if len(errs) > 0 && len(assignments) == 0 {
		return nil, fmt.Errorf("failed to assign any roles: %v", errs)
	}

	return assignments, nil
}

// RemoveMultipleRoles removes multiple roles from a user
func (s *roleAssignmentService) RemoveMultipleRoles(ctx context.Context, actorID uuid.UUID, userID uuid.UUID, festivalID *uuid.UUID, roleIDs []uuid.UUID, reason string) error {
	var errs []error

	for _, roleID := range roleIDs {
		err := s.rbacService.RemoveRole(ctx, actorID, RemoveRoleRequest{
			UserID:     userID,
			RoleID:     roleID,
			FestivalID: festivalID,
			Reason:     reason,
		})
		if err != nil {
			errs = append(errs, fmt.Errorf("role %s: %w", roleID, err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("failed to remove some roles: %v", errs)
	}

	return nil
}

// ReplaceUserRoles replaces all user roles with new ones
func (s *roleAssignmentService) ReplaceUserRoles(ctx context.Context, actorID uuid.UUID, userID uuid.UUID, festivalID *uuid.UUID, roleIDs []uuid.UUID, notes string) ([]RoleAssignment, error) {
	// Get current assignments
	currentAssignments, err := s.repo.ListUserRoleAssignments(ctx, userID, festivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to get current assignments: %w", err)
	}

	// Remove current roles
	var currentRoleIDs []uuid.UUID
	for _, assignment := range currentAssignments {
		if assignment.IsActive {
			currentRoleIDs = append(currentRoleIDs, assignment.RoleID)
		}
	}

	if len(currentRoleIDs) > 0 {
		if err := s.RemoveMultipleRoles(ctx, actorID, userID, festivalID, currentRoleIDs, "Replaced by new role assignment"); err != nil {
			// Continue anyway to assign new roles
		}
	}

	// Assign new roles
	return s.AssignMultipleRoles(ctx, actorID, userID, festivalID, roleIDs, notes)
}

// ============================================================================
// Role Inheritance
// ============================================================================

// GetEffectiveRoles returns all roles including inherited ones
func (s *roleAssignmentService) GetEffectiveRoles(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) ([]Role, error) {
	directRoles, err := s.rbacService.GetUserRoles(ctx, userID, festivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user roles: %w", err)
	}

	roleMap := make(map[uuid.UUID]Role)
	for _, role := range directRoles {
		roleMap[role.ID] = role

		// Add inherited roles for system roles
		inheritedNames := s.GetInheritedRoles(ctx, role)
		for _, inheritedName := range inheritedNames {
			inheritedRole, err := s.repo.GetRoleByName(ctx, string(inheritedName), nil)
			if err == nil && inheritedRole != nil {
				if _, exists := roleMap[inheritedRole.ID]; !exists {
					roleMap[inheritedRole.ID] = *inheritedRole
				}
			}
		}
	}

	// Convert to slice and sort by priority
	var effectiveRoles []Role
	for _, role := range roleMap {
		effectiveRoles = append(effectiveRoles, role)
	}

	sort.Slice(effectiveRoles, func(i, j int) bool {
		return effectiveRoles[i].Priority > effectiveRoles[j].Priority
	})

	return effectiveRoles, nil
}

// GetInheritedRoles returns the roles that a role inherits from
func (s *roleAssignmentService) GetInheritedRoles(ctx context.Context, role Role) []PredefinedRoleName {
	// Only system roles have inheritance
	if role.Type != RoleTypeSystem {
		return nil
	}

	// Define inheritance hierarchy
	inheritanceMap := map[string][]PredefinedRoleName{
		string(RoleSuperAdmin): {
			RoleFestivalOwner, RoleFestivalAdmin, RoleFinanceManager,
			RoleLineupManager, RoleSecurityManager, RoleCashier, RoleScanner, RoleViewer,
		},
		string(RoleFestivalOwner): {
			RoleFestivalAdmin, RoleFinanceManager, RoleLineupManager,
			RoleSecurityManager, RoleCashier, RoleScanner, RoleViewer,
		},
		string(RoleFestivalAdmin): {
			RoleFinanceManager, RoleLineupManager, RoleSecurityManager,
			RoleCashier, RoleScanner, RoleViewer,
		},
		string(RoleFinanceManager): {RoleCashier, RoleViewer},
		string(RoleSecurityManager): {RoleScanner, RoleViewer},
		string(RoleLineupManager):   {RoleViewer},
		string(RoleCashier):         {RoleViewer},
		string(RoleScanner):         {RoleViewer},
	}

	return inheritanceMap[role.Name]
}

// ============================================================================
// Custom Role Operations
// ============================================================================

// CreateCustomRole creates a new custom role with specified permissions
func (s *roleAssignmentService) CreateCustomRole(ctx context.Context, actorID uuid.UUID, festivalID uuid.UUID, req CreateCustomRoleRequest) (*Role, error) {
	// Collect permission IDs
	var permissionIDs []uuid.UUID
	permissionIDs = append(permissionIDs, req.PermissionIDs...)

	// Convert permission strings to IDs
	for _, permStr := range req.PermissionStrings {
		resource, action := ConvertToResourceAction(permStr)
		perm, err := s.repo.GetPermissionByKey(ctx, resource, action)
		if err != nil || perm == nil {
			continue
		}
		permissionIDs = append(permissionIDs, perm.ID)
	}

	// If inheriting from another role, include its permissions
	if req.InheritsFrom != nil {
		parentRole, err := s.repo.GetRoleByID(ctx, *req.InheritsFrom)
		if err == nil && parentRole != nil {
			for _, perm := range parentRole.Permissions {
				permissionIDs = append(permissionIDs, perm.ID)
			}
		}
	}

	// Create the role
	return s.rbacService.CreateRole(ctx, actorID, CreateRoleRequest{
		Name:          req.Name,
		DisplayName:   req.DisplayName,
		Description:   req.Description,
		FestivalID:    &festivalID,
		PermissionIDs: deduplicateUUIDs(permissionIDs),
		Priority:      req.Priority,
	})
}

// CloneRole creates a copy of an existing role with a new name
func (s *roleAssignmentService) CloneRole(ctx context.Context, actorID uuid.UUID, sourceRoleID uuid.UUID, festivalID uuid.UUID, newName, newDisplayName string) (*Role, error) {
	sourceRole, err := s.repo.GetRoleByID(ctx, sourceRoleID)
	if err != nil {
		return nil, fmt.Errorf("failed to get source role: %w", err)
	}
	if sourceRole == nil {
		return nil, ErrRoleNotFound
	}

	// Get permission IDs
	var permissionIDs []uuid.UUID
	for _, perm := range sourceRole.Permissions {
		permissionIDs = append(permissionIDs, perm.ID)
	}

	// Create cloned role
	return s.rbacService.CreateRole(ctx, actorID, CreateRoleRequest{
		Name:          newName,
		DisplayName:   newDisplayName,
		Description:   fmt.Sprintf("Cloned from %s", sourceRole.DisplayName),
		FestivalID:    &festivalID,
		PermissionIDs: permissionIDs,
		Priority:      sourceRole.Priority,
	})
}

// MergeRolePermissions merges permissions from multiple roles into a target role
func (s *roleAssignmentService) MergeRolePermissions(ctx context.Context, actorID uuid.UUID, targetRoleID uuid.UUID, sourceRoleIDs []uuid.UUID) error {
	targetRole, err := s.repo.GetRoleByID(ctx, targetRoleID)
	if err != nil {
		return fmt.Errorf("failed to get target role: %w", err)
	}
	if targetRole == nil {
		return ErrRoleNotFound
	}

	if targetRole.IsSystemRole() {
		return ErrCannotModifySystemRole
	}

	// Collect all permissions
	permSet := make(map[uuid.UUID]bool)
	for _, perm := range targetRole.Permissions {
		permSet[perm.ID] = true
	}

	for _, sourceRoleID := range sourceRoleIDs {
		sourceRole, err := s.repo.GetRoleByID(ctx, sourceRoleID)
		if err != nil || sourceRole == nil {
			continue
		}
		for _, perm := range sourceRole.Permissions {
			permSet[perm.ID] = true
		}
	}

	// Convert to slice
	var permissionIDs []uuid.UUID
	for permID := range permSet {
		permissionIDs = append(permissionIDs, permID)
	}

	// Update role permissions
	_, err = s.rbacService.UpdateRole(ctx, actorID, targetRoleID, UpdateRoleRequest{
		PermissionIDs: permissionIDs,
	})
	return err
}

// ============================================================================
// Bulk Operations
// ============================================================================

// BulkAssignRole assigns a role to multiple users
func (s *roleAssignmentService) BulkAssignRole(ctx context.Context, actorID uuid.UUID, roleID uuid.UUID, festivalID *uuid.UUID, userIDs []uuid.UUID, notes string) ([]RoleAssignment, []error) {
	var assignments []RoleAssignment
	var errs []error

	for _, userID := range userIDs {
		assignment, err := s.rbacService.AssignRole(ctx, actorID, AssignRoleRequest{
			UserID:     userID,
			RoleID:     roleID,
			FestivalID: festivalID,
			Notes:      notes,
		})
		if err != nil {
			errs = append(errs, fmt.Errorf("user %s: %w", userID, err))
			continue
		}
		assignments = append(assignments, *assignment)
	}

	return assignments, errs
}

// BulkRemoveRole removes a role from multiple users
func (s *roleAssignmentService) BulkRemoveRole(ctx context.Context, actorID uuid.UUID, roleID uuid.UUID, festivalID *uuid.UUID, userIDs []uuid.UUID, reason string) []error {
	var errs []error

	for _, userID := range userIDs {
		err := s.rbacService.RemoveRole(ctx, actorID, RemoveRoleRequest{
			UserID:     userID,
			RoleID:     roleID,
			FestivalID: festivalID,
			Reason:     reason,
		})
		if err != nil {
			errs = append(errs, fmt.Errorf("user %s: %w", userID, err))
		}
	}

	return errs
}

// ============================================================================
// Temporary Role Assignments
// ============================================================================

// AssignTemporaryRole assigns a role that expires after a duration
func (s *roleAssignmentService) AssignTemporaryRole(ctx context.Context, actorID uuid.UUID, req AssignRoleRequest, duration time.Duration) (*RoleAssignment, error) {
	expiresAt := time.Now().Add(duration)
	req.ExpiresAt = &expiresAt
	return s.rbacService.AssignRole(ctx, actorID, req)
}

// ExtendRoleExpiration extends the expiration of a role assignment
func (s *roleAssignmentService) ExtendRoleExpiration(ctx context.Context, actorID uuid.UUID, assignmentID uuid.UUID, newExpiration time.Time) (*RoleAssignment, error) {
	assignment, err := s.repo.GetRoleAssignmentByID(ctx, assignmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get assignment: %w", err)
	}
	if assignment == nil {
		return nil, ErrAssignmentNotFound
	}

	assignment.ExpiresAt = &newExpiration
	if err := s.repo.UpdateRoleAssignment(ctx, assignment); err != nil {
		return nil, fmt.Errorf("failed to update assignment: %w", err)
	}

	return assignment, nil
}

// ============================================================================
// Role Validation
// ============================================================================

// CanAssignRole checks if an actor can assign a role to a user
func (s *roleAssignmentService) CanAssignRole(ctx context.Context, actorID uuid.UUID, targetUserID uuid.UUID, roleID uuid.UUID, festivalID *uuid.UUID) (bool, string) {
	// Get the role being assigned
	role, err := s.repo.GetRoleByID(ctx, roleID)
	if err != nil || role == nil {
		return false, "Role not found"
	}

	// Super admins can assign any role
	if s.rbacService.IsSuperAdmin(ctx, actorID) {
		return true, ""
	}

	// Get actor's highest priority role
	actorRoles, err := s.rbacService.GetUserRoles(ctx, actorID, festivalID)
	if err != nil {
		return false, "Failed to get actor roles"
	}

	actorMaxPriority := 0
	for _, r := range actorRoles {
		if r.Priority > actorMaxPriority {
			actorMaxPriority = r.Priority
		}
	}

	// Cannot assign roles with equal or higher priority
	if role.Priority >= actorMaxPriority {
		return false, "Cannot assign role with equal or higher priority than your own"
	}

	// Check if actor has permission to assign roles
	if !s.rbacService.HasPermission(ctx, actorID, ResourceRole, ActionCreate, festivalID) {
		return false, "No permission to assign roles"
	}

	return true, ""
}

// CanRemoveRole checks if an actor can remove a role from a user
func (s *roleAssignmentService) CanRemoveRole(ctx context.Context, actorID uuid.UUID, targetUserID uuid.UUID, roleID uuid.UUID, festivalID *uuid.UUID) (bool, string) {
	// Similar logic to CanAssignRole
	role, err := s.repo.GetRoleByID(ctx, roleID)
	if err != nil || role == nil {
		return false, "Role not found"
	}

	// Super admins can remove any role
	if s.rbacService.IsSuperAdmin(ctx, actorID) {
		return true, ""
	}

	// Get actor's highest priority role
	actorRoles, err := s.rbacService.GetUserRoles(ctx, actorID, festivalID)
	if err != nil {
		return false, "Failed to get actor roles"
	}

	actorMaxPriority := 0
	for _, r := range actorRoles {
		if r.Priority > actorMaxPriority {
			actorMaxPriority = r.Priority
		}
	}

	// Cannot remove roles with equal or higher priority
	if role.Priority >= actorMaxPriority {
		return false, "Cannot remove role with equal or higher priority than your own"
	}

	// Check if actor has permission to remove roles
	if !s.rbacService.HasPermission(ctx, actorID, ResourceRole, ActionDelete, festivalID) {
		return false, "No permission to remove roles"
	}

	return true, ""
}

// ValidateRoleAssignment validates if a role can be assigned to a user
func (s *roleAssignmentService) ValidateRoleAssignment(ctx context.Context, userID uuid.UUID, roleID uuid.UUID, festivalID *uuid.UUID) error {
	// Check if role exists
	role, err := s.repo.GetRoleByID(ctx, roleID)
	if err != nil {
		return fmt.Errorf("failed to get role: %w", err)
	}
	if role == nil {
		return ErrRoleNotFound
	}

	// Check role scope compatibility
	if role.FestivalID != nil && festivalID != nil {
		if *role.FestivalID != *festivalID {
			return ErrInvalidFestivalScope
		}
	}

	// Check for conflicting roles (optional - can be customized)
	currentRoles, err := s.repo.GetUserRoles(ctx, userID, festivalID)
	if err != nil {
		return fmt.Errorf("failed to get current roles: %w", err)
	}

	for _, currentRole := range currentRoles {
		if currentRole.ID == roleID {
			return ErrAssignmentAlreadyExists
		}
	}

	return nil
}

// ============================================================================
// Role Analysis
// ============================================================================

// GetUserRoleSummary provides a summary of a user's roles
func (s *roleAssignmentService) GetUserRoleSummary(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) (*UserRoleSummary, error) {
	roles, err := s.rbacService.GetUserRoles(ctx, userID, festivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user roles: %w", err)
	}

	assignments, err := s.repo.ListUserRoleAssignments(ctx, userID, festivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to get assignments: %w", err)
	}

	// Categorize roles
	var systemRoles, customRoles []Role
	var highestPriority *Role
	totalPermissions := make(map[string]bool)
	permissionGroupNames := make(map[string]bool)

	for _, role := range roles {
		if role.Type == RoleTypeSystem {
			systemRoles = append(systemRoles, role)
		} else {
			customRoles = append(customRoles, role)
		}

		if highestPriority == nil || role.Priority > highestPriority.Priority {
			r := role // Create copy
			highestPriority = &r
		}

		// Collect permissions
		for _, perm := range role.Permissions {
			key := fmt.Sprintf("%s:%s", perm.Resource, perm.Action)
			totalPermissions[key] = true
		}
	}

	// Find permission groups user has
	for _, group := range GetPermissionGroups() {
		hasGroup := true
		for _, perm := range group.Permissions {
			resource, action := ConvertToResourceAction(perm)
			key := fmt.Sprintf("%s:%s", resource, action)
			if !totalPermissions[key] {
				hasGroup = false
				break
			}
		}
		if hasGroup {
			permissionGroupNames[group.Name] = true
		}
	}

	// Find expiring assignments
	var expiringAssignments []RoleAssignment
	threshold := time.Now().Add(7 * 24 * time.Hour) // Within 7 days
	for _, assignment := range assignments {
		if assignment.ExpiresAt != nil && assignment.ExpiresAt.Before(threshold) && assignment.IsActive {
			expiringAssignments = append(expiringAssignments, assignment)
		}
	}

	// Convert group names to slice
	var groups []string
	for name := range permissionGroupNames {
		groups = append(groups, name)
	}

	return &UserRoleSummary{
		UserID:              userID,
		FestivalID:          festivalID,
		TotalRoles:          len(roles),
		SystemRoles:         systemRoles,
		CustomRoles:         customRoles,
		HighestPriorityRole: highestPriority,
		TotalPermissions:    len(totalPermissions),
		PermissionGroups:    groups,
		ExpiringAssignments: expiringAssignments,
		EffectiveAt:         time.Now().Format(time.RFC3339),
	}, nil
}

// GetConflictingRoles checks for permission conflicts between roles
func (s *roleAssignmentService) GetConflictingRoles(ctx context.Context, roleID1, roleID2 uuid.UUID) ([]PermissionConflict, error) {
	role1, err := s.repo.GetRoleByID(ctx, roleID1)
	if err != nil || role1 == nil {
		return nil, fmt.Errorf("role1 not found")
	}

	role2, err := s.repo.GetRoleByID(ctx, roleID2)
	if err != nil || role2 == nil {
		return nil, fmt.Errorf("role2 not found")
	}

	// Currently no automatic conflict detection - can be customized
	// based on business rules (e.g., "viewer" + "admin" might conflict)
	return nil, nil
}

// ============================================================================
// Helper Functions
// ============================================================================

func deduplicateUUIDs(ids []uuid.UUID) []uuid.UUID {
	seen := make(map[uuid.UUID]bool)
	var result []uuid.UUID
	for _, id := range ids {
		if !seen[id] {
			seen[id] = true
			result = append(result, id)
		}
	}
	return result
}

// Custom errors for role assignment
var (
	ErrRoleNotAssignable       = errors.New("role cannot be assigned in this context")
	ErrInheritanceCycleDetected = errors.New("role inheritance cycle detected")
	ErrMaxRolesExceeded        = errors.New("maximum number of roles exceeded for user")
)
