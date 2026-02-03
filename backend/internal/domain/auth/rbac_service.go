package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// Common errors
var (
	ErrRoleNotFound             = errors.New("role not found")
	ErrRoleAlreadyExists        = errors.New("role already exists")
	ErrPermissionNotFound       = errors.New("permission not found")
	ErrAssignmentNotFound       = errors.New("role assignment not found")
	ErrAssignmentAlreadyExists  = errors.New("role assignment already exists")
	ErrCannotModifySystemRole   = errors.New("cannot modify system role")
	ErrCannotDeleteSystemRole   = errors.New("cannot delete system role")
	ErrInsufficientPermissions  = errors.New("insufficient permissions")
	ErrInvalidFestivalScope     = errors.New("invalid festival scope for this operation")
)

// RBACService defines the interface for RBAC operations
type RBACService interface {
	// Permission checks
	HasPermission(ctx context.Context, userID uuid.UUID, resource Resource, action Action, festivalID *uuid.UUID) bool
	HasPermissionWithStand(ctx context.Context, userID uuid.UUID, resource Resource, action Action, festivalID *uuid.UUID, standID *uuid.UUID) bool
	GetUserPermissions(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) (*UserPermissionsResponse, error)
	GetPermissionMatrix(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) (*PermissionMatrixResponse, error)

	// Role management
	CreateRole(ctx context.Context, actorID uuid.UUID, req CreateRoleRequest) (*Role, error)
	UpdateRole(ctx context.Context, actorID uuid.UUID, roleID uuid.UUID, req UpdateRoleRequest) (*Role, error)
	DeleteRole(ctx context.Context, actorID uuid.UUID, roleID uuid.UUID) error
	GetRole(ctx context.Context, roleID uuid.UUID) (*Role, error)
	ListRoles(ctx context.Context, festivalID *uuid.UUID) ([]Role, error)
	ListSystemRoles(ctx context.Context) ([]Role, error)
	ListCustomRoles(ctx context.Context, festivalID uuid.UUID) ([]Role, error)

	// Role assignment
	AssignRole(ctx context.Context, actorID uuid.UUID, req AssignRoleRequest) (*RoleAssignment, error)
	RemoveRole(ctx context.Context, actorID uuid.UUID, req RemoveRoleRequest) error
	GetUserRoles(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) ([]Role, error)
	ListFestivalRoleAssignments(ctx context.Context, festivalID uuid.UUID) ([]RoleAssignment, error)

	// Permission management
	ListPermissions(ctx context.Context) ([]Permission, error)
	ListPermissionsByResource(ctx context.Context, resource Resource) ([]Permission, error)

	// Audit
	ListAuditLogs(ctx context.Context, filter AuditLogFilter, offset, limit int) ([]RBACAuditLog, int64, error)

	// Initialization
	SeedDefaultData(ctx context.Context) error

	// Utility
	IsSuperAdmin(ctx context.Context, userID uuid.UUID) bool
	IsFestivalOwner(ctx context.Context, userID uuid.UUID, festivalID uuid.UUID) bool
	IsFestivalAdmin(ctx context.Context, userID uuid.UUID, festivalID uuid.UUID) bool
	ClearCache(userID uuid.UUID)
}

type rbacService struct {
	repo        RBACRepository
	cache       *permissionCache
	cacheExpiry time.Duration
}

// Permission cache for performance
type permissionCache struct {
	mu    sync.RWMutex
	data  map[string]*cachedPermissions
}

type cachedPermissions struct {
	permissions map[string]bool // "resource:action" -> allowed
	roles       []string
	expiresAt   time.Time
}

// NewRBACService creates a new RBAC service
func NewRBACService(repo RBACRepository) RBACService {
	return &rbacService{
		repo:        repo,
		cache:       &permissionCache{data: make(map[string]*cachedPermissions)},
		cacheExpiry: 5 * time.Minute,
	}
}

// ============================================================================
// Permission Checks
// ============================================================================

func (s *rbacService) HasPermission(ctx context.Context, userID uuid.UUID, resource Resource, action Action, festivalID *uuid.UUID) bool {
	return s.HasPermissionWithStand(ctx, userID, resource, action, festivalID, nil)
}

func (s *rbacService) HasPermissionWithStand(ctx context.Context, userID uuid.UUID, resource Resource, action Action, festivalID *uuid.UUID, standID *uuid.UUID) bool {
	// Check cache first
	cacheKey := s.buildCacheKey(userID, festivalID)
	permKey := string(resource) + ":" + string(action)

	s.cache.mu.RLock()
	if cached, ok := s.cache.data[cacheKey]; ok && cached.expiresAt.After(time.Now()) {
		if allowed, exists := cached.permissions[permKey]; exists {
			s.cache.mu.RUnlock()
			return allowed
		}
	}
	s.cache.mu.RUnlock()

	// Check database
	allowed, err := s.repo.HasPermission(ctx, userID, resource, action, festivalID, standID)
	if err != nil {
		log.Error().Err(err).
			Str("userID", userID.String()).
			Str("resource", string(resource)).
			Str("action", string(action)).
			Msg("Failed to check permission")
		return false
	}

	// Update cache
	s.updateCache(ctx, userID, festivalID)

	return allowed
}

func (s *rbacService) GetUserPermissions(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) (*UserPermissionsResponse, error) {
	roles, err := s.repo.GetUserRoles(ctx, userID, festivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user roles: %w", err)
	}

	permissions, err := s.repo.GetUserPermissions(ctx, userID, festivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user permissions: %w", err)
	}

	roleResponses := make([]RoleResponse, len(roles))
	for i, r := range roles {
		roleResponses[i] = r.ToResponse()
	}

	permResponses := make([]PermissionResponse, len(permissions))
	for i, p := range permissions {
		permResponses[i] = p.ToResponse()
	}

	return &UserPermissionsResponse{
		UserID:      userID,
		FestivalID:  festivalID,
		Roles:       roleResponses,
		Permissions: permResponses,
		EffectiveAt: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *rbacService) GetPermissionMatrix(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) (*PermissionMatrixResponse, error) {
	permissions, err := s.repo.GetUserPermissions(ctx, userID, festivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user permissions: %w", err)
	}

	// Build permission map
	permMap := make(map[string]map[string]bool)
	for _, resource := range AllResources() {
		permMap[string(resource)] = make(map[string]bool)
		for _, action := range AllActions() {
			permMap[string(resource)][string(action)] = false
		}
	}

	// Mark granted permissions
	for _, perm := range permissions {
		if _, ok := permMap[string(perm.Resource)]; ok {
			permMap[string(perm.Resource)][string(perm.Action)] = true
		}
	}

	return &PermissionMatrixResponse{
		Resources:   AllResources(),
		Actions:     AllActions(),
		Permissions: permMap,
	}, nil
}

// ============================================================================
// Role Management
// ============================================================================

func (s *rbacService) CreateRole(ctx context.Context, actorID uuid.UUID, req CreateRoleRequest) (*Role, error) {
	// Check if role with same name exists
	existing, err := s.repo.GetRoleByName(ctx, req.Name, req.FestivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing role: %w", err)
	}
	if existing != nil {
		return nil, ErrRoleAlreadyExists
	}

	// Create role
	role := &Role{
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Description: req.Description,
		Type:        RoleTypeCustom,
		FestivalID:  req.FestivalID,
		Priority:    req.Priority,
		IsActive:    true,
	}

	if err := s.repo.CreateRole(ctx, role); err != nil {
		return nil, fmt.Errorf("failed to create role: %w", err)
	}

	// Assign permissions
	if len(req.PermissionIDs) > 0 {
		if err := s.repo.SetRolePermissions(ctx, role.ID, req.PermissionIDs); err != nil {
			return nil, fmt.Errorf("failed to set role permissions: %w", err)
		}
	}

	// Reload role with permissions
	role, err = s.repo.GetRoleByID(ctx, role.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to reload role: %w", err)
	}

	// Audit log
	s.logAudit(ctx, AuditActionRoleCreated, actorID, nil, &role.ID, req.FestivalID, nil, "", toJSON(role))

	return role, nil
}

func (s *rbacService) UpdateRole(ctx context.Context, actorID uuid.UUID, roleID uuid.UUID, req UpdateRoleRequest) (*Role, error) {
	role, err := s.repo.GetRoleByID(ctx, roleID)
	if err != nil {
		return nil, fmt.Errorf("failed to get role: %w", err)
	}
	if role == nil {
		return nil, ErrRoleNotFound
	}

	// Cannot modify system roles (except deactivating)
	if role.IsSystemRole() && (req.DisplayName != nil || req.Description != nil || req.PermissionIDs != nil || req.Priority != nil) {
		return nil, ErrCannotModifySystemRole
	}

	oldValue := toJSON(role)

	// Update fields
	if req.DisplayName != nil {
		role.DisplayName = *req.DisplayName
	}
	if req.Description != nil {
		role.Description = *req.Description
	}
	if req.IsActive != nil {
		role.IsActive = *req.IsActive
	}
	if req.Priority != nil {
		role.Priority = *req.Priority
	}

	if err := s.repo.UpdateRole(ctx, role); err != nil {
		return nil, fmt.Errorf("failed to update role: %w", err)
	}

	// Update permissions if provided
	if req.PermissionIDs != nil {
		if err := s.repo.SetRolePermissions(ctx, role.ID, req.PermissionIDs); err != nil {
			return nil, fmt.Errorf("failed to update role permissions: %w", err)
		}
	}

	// Reload role
	role, err = s.repo.GetRoleByID(ctx, role.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to reload role: %w", err)
	}

	// Audit log
	s.logAudit(ctx, AuditActionRoleUpdated, actorID, nil, &role.ID, role.FestivalID, nil, oldValue, toJSON(role))

	// Clear caches for users with this role
	s.clearRoleCache(ctx, roleID)

	return role, nil
}

func (s *rbacService) DeleteRole(ctx context.Context, actorID uuid.UUID, roleID uuid.UUID) error {
	role, err := s.repo.GetRoleByID(ctx, roleID)
	if err != nil {
		return fmt.Errorf("failed to get role: %w", err)
	}
	if role == nil {
		return ErrRoleNotFound
	}

	if role.IsSystemRole() {
		return ErrCannotDeleteSystemRole
	}

	oldValue := toJSON(role)

	if err := s.repo.DeleteRole(ctx, roleID); err != nil {
		return fmt.Errorf("failed to delete role: %w", err)
	}

	// Audit log
	s.logAudit(ctx, AuditActionRoleDeleted, actorID, nil, &roleID, role.FestivalID, nil, oldValue, "")

	// Clear caches
	s.clearRoleCache(ctx, roleID)

	return nil
}

func (s *rbacService) GetRole(ctx context.Context, roleID uuid.UUID) (*Role, error) {
	role, err := s.repo.GetRoleByID(ctx, roleID)
	if err != nil {
		return nil, fmt.Errorf("failed to get role: %w", err)
	}
	if role == nil {
		return nil, ErrRoleNotFound
	}
	return role, nil
}

func (s *rbacService) ListRoles(ctx context.Context, festivalID *uuid.UUID) ([]Role, error) {
	return s.repo.ListRoles(ctx, festivalID)
}

func (s *rbacService) ListSystemRoles(ctx context.Context) ([]Role, error) {
	return s.repo.ListSystemRoles(ctx)
}

func (s *rbacService) ListCustomRoles(ctx context.Context, festivalID uuid.UUID) ([]Role, error) {
	return s.repo.ListCustomRoles(ctx, festivalID)
}

// ============================================================================
// Role Assignment
// ============================================================================

func (s *rbacService) AssignRole(ctx context.Context, actorID uuid.UUID, req AssignRoleRequest) (*RoleAssignment, error) {
	// Validate role exists
	role, err := s.repo.GetRoleByID(ctx, req.RoleID)
	if err != nil {
		return nil, fmt.Errorf("failed to get role: %w", err)
	}
	if role == nil {
		return nil, ErrRoleNotFound
	}

	// Check for existing assignment
	existing, err := s.repo.GetRoleAssignment(ctx, req.UserID, req.RoleID, req.FestivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing assignment: %w", err)
	}
	if existing != nil && existing.IsActive {
		return nil, ErrAssignmentAlreadyExists
	}

	// If there's an inactive assignment, reactivate it
	if existing != nil {
		existing.IsActive = true
		existing.AssignedBy = actorID
		existing.AssignedAt = time.Now()
		existing.ExpiresAt = req.ExpiresAt
		existing.Notes = req.Notes
		if err := s.repo.UpdateRoleAssignment(ctx, existing); err != nil {
			return nil, fmt.Errorf("failed to reactivate assignment: %w", err)
		}
		existing.Role = role

		// Audit log
		s.logAudit(ctx, AuditActionRoleAssigned, actorID, &req.UserID, &req.RoleID, req.FestivalID, nil, "", toJSON(existing))

		// Clear user cache
		s.ClearCache(req.UserID)

		return existing, nil
	}

	// Create new assignment
	assignment := &RoleAssignment{
		UserID:     req.UserID,
		RoleID:     req.RoleID,
		FestivalID: req.FestivalID,
		StandID:    req.StandID,
		AssignedBy: actorID,
		AssignedAt: time.Now(),
		ExpiresAt:  req.ExpiresAt,
		IsActive:   true,
		Notes:      req.Notes,
	}

	if err := s.repo.CreateRoleAssignment(ctx, assignment); err != nil {
		return nil, fmt.Errorf("failed to create role assignment: %w", err)
	}

	assignment.Role = role

	// Audit log
	s.logAudit(ctx, AuditActionRoleAssigned, actorID, &req.UserID, &req.RoleID, req.FestivalID, nil, "", toJSON(assignment))

	// Clear user cache
	s.ClearCache(req.UserID)

	return assignment, nil
}

func (s *rbacService) RemoveRole(ctx context.Context, actorID uuid.UUID, req RemoveRoleRequest) error {
	assignment, err := s.repo.GetRoleAssignment(ctx, req.UserID, req.RoleID, req.FestivalID)
	if err != nil {
		return fmt.Errorf("failed to get assignment: %w", err)
	}
	if assignment == nil {
		return ErrAssignmentNotFound
	}

	oldValue := toJSON(assignment)

	// Deactivate instead of delete to preserve history
	if err := s.repo.DeactivateRoleAssignment(ctx, req.UserID, req.RoleID, req.FestivalID); err != nil {
		return fmt.Errorf("failed to deactivate role assignment: %w", err)
	}

	// Audit log
	s.logAudit(ctx, AuditActionRoleRevoked, actorID, &req.UserID, &req.RoleID, req.FestivalID, nil, oldValue, req.Reason)

	// Clear user cache
	s.ClearCache(req.UserID)

	return nil
}

func (s *rbacService) GetUserRoles(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) ([]Role, error) {
	return s.repo.GetUserRoles(ctx, userID, festivalID)
}

func (s *rbacService) ListFestivalRoleAssignments(ctx context.Context, festivalID uuid.UUID) ([]RoleAssignment, error) {
	return s.repo.ListFestivalRoleAssignments(ctx, festivalID)
}

// ============================================================================
// Permission Management
// ============================================================================

func (s *rbacService) ListPermissions(ctx context.Context) ([]Permission, error) {
	return s.repo.ListPermissions(ctx)
}

func (s *rbacService) ListPermissionsByResource(ctx context.Context, resource Resource) ([]Permission, error) {
	return s.repo.ListPermissionsByResource(ctx, resource)
}

// ============================================================================
// Audit
// ============================================================================

func (s *rbacService) ListAuditLogs(ctx context.Context, filter AuditLogFilter, offset, limit int) ([]RBACAuditLog, int64, error) {
	return s.repo.ListAuditLogs(ctx, filter, offset, limit)
}

// ============================================================================
// Initialization
// ============================================================================

func (s *rbacService) SeedDefaultData(ctx context.Context) error {
	log.Info().Msg("Seeding RBAC permissions...")
	if err := s.repo.SeedPermissions(ctx); err != nil {
		return fmt.Errorf("failed to seed permissions: %w", err)
	}

	log.Info().Msg("Seeding RBAC predefined roles...")
	if err := s.repo.SeedPredefinedRoles(ctx); err != nil {
		return fmt.Errorf("failed to seed predefined roles: %w", err)
	}

	log.Info().Msg("RBAC default data seeded successfully")
	return nil
}

// ============================================================================
// Utility Methods
// ============================================================================

func (s *rbacService) IsSuperAdmin(ctx context.Context, userID uuid.UUID) bool {
	roles, err := s.repo.GetUserRoles(ctx, userID, nil)
	if err != nil {
		return false
	}
	for _, role := range roles {
		if role.Name == string(RoleSuperAdmin) {
			return true
		}
	}
	return false
}

func (s *rbacService) IsFestivalOwner(ctx context.Context, userID uuid.UUID, festivalID uuid.UUID) bool {
	roles, err := s.repo.GetUserRoles(ctx, userID, &festivalID)
	if err != nil {
		return false
	}
	for _, role := range roles {
		if role.Name == string(RoleFestivalOwner) || role.Name == string(RoleSuperAdmin) {
			return true
		}
	}
	return false
}

func (s *rbacService) IsFestivalAdmin(ctx context.Context, userID uuid.UUID, festivalID uuid.UUID) bool {
	roles, err := s.repo.GetUserRoles(ctx, userID, &festivalID)
	if err != nil {
		return false
	}
	for _, role := range roles {
		switch role.Name {
		case string(RoleFestivalAdmin), string(RoleFestivalOwner), string(RoleSuperAdmin):
			return true
		}
	}
	return false
}

func (s *rbacService) ClearCache(userID uuid.UUID) {
	s.cache.mu.Lock()
	defer s.cache.mu.Unlock()

	// Clear all cache entries for this user
	for key := range s.cache.data {
		if len(key) >= 36 && key[:36] == userID.String() {
			delete(s.cache.data, key)
		}
	}
}

// ============================================================================
// Helper Methods
// ============================================================================

func (s *rbacService) buildCacheKey(userID uuid.UUID, festivalID *uuid.UUID) string {
	if festivalID == nil {
		return userID.String() + ":global"
	}
	return userID.String() + ":" + festivalID.String()
}

func (s *rbacService) updateCache(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) {
	permissions, err := s.repo.GetUserPermissions(ctx, userID, festivalID)
	if err != nil {
		return
	}

	roles, err := s.repo.GetUserRoles(ctx, userID, festivalID)
	if err != nil {
		return
	}

	permMap := make(map[string]bool)
	for _, p := range permissions {
		permMap[p.PermissionKey()] = true
	}

	roleNames := make([]string, len(roles))
	for i, r := range roles {
		roleNames[i] = r.Name
	}

	s.cache.mu.Lock()
	defer s.cache.mu.Unlock()

	cacheKey := s.buildCacheKey(userID, festivalID)
	s.cache.data[cacheKey] = &cachedPermissions{
		permissions: permMap,
		roles:       roleNames,
		expiresAt:   time.Now().Add(s.cacheExpiry),
	}
}

func (s *rbacService) clearRoleCache(ctx context.Context, roleID uuid.UUID) {
	// Get all users with this role and clear their caches
	assignments, err := s.repo.ListRoleAssignmentsByRole(ctx, roleID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get role assignments for cache clearing")
		return
	}

	for _, assignment := range assignments {
		s.ClearCache(assignment.UserID)
	}
}

func (s *rbacService) logAudit(ctx context.Context, action AuditAction, actorID uuid.UUID, targetUserID, roleID, festivalID *uuid.UUID, resource *Resource, oldValue, newValue string) {
	log := &RBACAuditLog{
		Action:       action,
		ActorID:      actorID,
		TargetUserID: targetUserID,
		RoleID:       roleID,
		FestivalID:   festivalID,
		Resource:     resource,
		OldValue:     oldValue,
		NewValue:     newValue,
	}

	if err := s.repo.CreateAuditLog(ctx, log); err != nil {
		// Log error but don't fail the operation
		log := log // Shadow variable for zerolog
		_ = log    // Suppress unused warning
	}
}

func toJSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(b)
}

// ============================================================================
// Context-based Permission Helpers
// ============================================================================

// PermissionContext provides context for permission checks from HTTP handlers
type PermissionContext struct {
	UserID     uuid.UUID
	FestivalID *uuid.UUID
	StandID    *uuid.UUID
	IPAddress  string
	UserAgent  string
}

// CheckPermission is a convenience method for checking permissions with context
func (s *rbacService) CheckPermission(ctx context.Context, pc PermissionContext, resource Resource, action Action) error {
	if !s.HasPermissionWithStand(ctx, pc.UserID, resource, action, pc.FestivalID, pc.StandID) {
		// Log access denied
		s.logAudit(ctx, AuditActionAccessDenied, pc.UserID, nil, nil, pc.FestivalID, &resource, "", fmt.Sprintf("action=%s", action))
		return ErrInsufficientPermissions
	}

	// Log access granted for sensitive operations
	if action == ActionDelete || action == ActionApprove || action == ActionReject {
		s.logAudit(ctx, AuditActionAccessGranted, pc.UserID, nil, nil, pc.FestivalID, &resource, "", fmt.Sprintf("action=%s", action))
	}

	return nil
}

// RequirePermission returns an error if the user doesn't have the required permission
func (s *rbacService) RequirePermission(ctx context.Context, userID uuid.UUID, resource Resource, action Action, festivalID *uuid.UUID) error {
	if !s.HasPermission(ctx, userID, resource, action, festivalID) {
		return ErrInsufficientPermissions
	}
	return nil
}

// RequireAnyPermission returns nil if the user has any of the specified permissions
func (s *rbacService) RequireAnyPermission(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, permissions ...struct{ Resource Resource; Action Action }) error {
	for _, perm := range permissions {
		if s.HasPermission(ctx, userID, perm.Resource, perm.Action, festivalID) {
			return nil
		}
	}
	return ErrInsufficientPermissions
}

// RequireAllPermissions returns nil only if the user has all specified permissions
func (s *rbacService) RequireAllPermissions(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, permissions ...struct{ Resource Resource; Action Action }) error {
	for _, perm := range permissions {
		if !s.HasPermission(ctx, userID, perm.Resource, perm.Action, festivalID) {
			return ErrInsufficientPermissions
		}
	}
	return nil
}
