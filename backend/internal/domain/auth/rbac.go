package auth

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// ============================================================================
// Enhanced RBAC Service Interface
// ============================================================================

// EnhancedRBACService extends RBACService with additional permission check methods
type EnhancedRBACService interface {
	RBACService

	// Enhanced permission checks
	HasPermissionString(ctx context.Context, userID uuid.UUID, permission PermissionString, festivalID *uuid.UUID) bool
	HasAnyPermissionString(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, permissions ...PermissionString) bool
	HasAllPermissionStrings(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, permissions ...PermissionString) bool

	// Permission group checks
	HasPermissionGroup(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, groupName string) bool

	// Effective permissions
	GetEffectivePermissions(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) ([]PermissionString, error)
	GetEffectivePermissionsMap(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) (map[PermissionString]bool, error)

	// Bulk permission checks
	CheckMultiplePermissions(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, permissions []PermissionString) map[PermissionString]bool

	// Role inheritance
	GetInheritedPermissions(ctx context.Context, roleID uuid.UUID) ([]Permission, error)
	GetRoleHierarchy(ctx context.Context, festivalID *uuid.UUID) ([]RoleHierarchyNode, error)

	// Permission groups
	ListPermissionGroups() []PermissionGroup
	GetPermissionGroup(name string) *PermissionGroup

	// Resource-based checks
	CanAccessResource(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, resource Resource, action Action) bool
	CanAccessWildcard(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, wildcardPattern string) bool
}

// RoleHierarchyNode represents a node in the role hierarchy
type RoleHierarchyNode struct {
	Role     Role                `json:"role"`
	Children []RoleHierarchyNode `json:"children,omitempty"`
	Level    int                 `json:"level"`
}

// ============================================================================
// Enhanced RBAC Service Implementation
// ============================================================================

type enhancedRBACService struct {
	RBACService                                   // Embed the interface
	repo               RBACRepository
	enhancedCache      *enhancedPermissionCache
	cacheExpiry        time.Duration
	cacheMutex         sync.RWMutex
	roleInheritanceMap map[uuid.UUID][]uuid.UUID // roleID -> inherited roleIDs
}

type enhancedPermissionCache struct {
	mu   sync.RWMutex
	data map[string]*cachedUserPermissions
}

type cachedUserPermissions struct {
	permissions    map[PermissionString]bool
	permissionList []PermissionString
	roles          []Role
	expiresAt      time.Time
}

// NewEnhancedRBACService creates a new enhanced RBAC service
func NewEnhancedRBACService(repo RBACRepository) EnhancedRBACService {
	baseService := NewRBACService(repo)
	return &enhancedRBACService{
		RBACService: baseService,
		repo:        repo,
		enhancedCache: &enhancedPermissionCache{
			data: make(map[string]*cachedUserPermissions),
		},
		cacheExpiry:        5 * time.Minute,
		roleInheritanceMap: buildRoleInheritanceMap(),
	}
}

// buildRoleInheritanceMap builds the role inheritance hierarchy
func buildRoleInheritanceMap() map[uuid.UUID][]uuid.UUID {
	// Role inheritance: higher roles inherit from lower roles
	// SUPER_ADMIN inherits from FESTIVAL_OWNER
	// FESTIVAL_OWNER inherits from FESTIVAL_ADMIN
	// FESTIVAL_ADMIN inherits from all manager roles
	// etc.
	return make(map[uuid.UUID][]uuid.UUID)
}

// ============================================================================
// Enhanced Permission Checks
// ============================================================================

// HasPermissionString checks if user has a specific permission string
func (s *enhancedRBACService) HasPermissionString(ctx context.Context, userID uuid.UUID, permission PermissionString, festivalID *uuid.UUID) bool {
	// Convert permission string to resource/action and use base service
	resource, action := ConvertToResourceAction(permission)
	if resource != "" && action != "" {
		return s.RBACService.HasPermission(ctx, userID, resource, action, festivalID)
	}

	// Fallback to cache check
	permMap, err := s.GetEffectivePermissionsMap(ctx, userID, festivalID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get effective permissions")
		return false
	}

	return permMap[permission]
}

// HasAnyPermissionString checks if user has any of the specified permissions
func (s *enhancedRBACService) HasAnyPermissionString(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, permissions ...PermissionString) bool {
	permMap, err := s.GetEffectivePermissionsMap(ctx, userID, festivalID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get effective permissions")
		return false
	}

	for _, perm := range permissions {
		if permMap[perm] {
			return true
		}
	}
	return false
}

// HasAllPermissionStrings checks if user has all specified permissions
func (s *enhancedRBACService) HasAllPermissionStrings(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, permissions ...PermissionString) bool {
	permMap, err := s.GetEffectivePermissionsMap(ctx, userID, festivalID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get effective permissions")
		return false
	}

	for _, perm := range permissions {
		if !permMap[perm] {
			return false
		}
	}
	return true
}

// HasPermissionGroup checks if user has all permissions in a permission group
func (s *enhancedRBACService) HasPermissionGroup(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, groupName string) bool {
	group := GetPermissionGroup(groupName)
	if group == nil {
		return false
	}

	return s.HasAllPermissionStrings(ctx, userID, festivalID, group.Permissions...)
}

// ============================================================================
// Effective Permissions
// ============================================================================

// GetEffectivePermissions returns all effective permissions for a user
func (s *enhancedRBACService) GetEffectivePermissions(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) ([]PermissionString, error) {
	// Check cache
	cacheKey := s.buildEnhancedCacheKey(userID, festivalID)

	s.enhancedCache.mu.RLock()
	if cached, ok := s.enhancedCache.data[cacheKey]; ok && cached.expiresAt.After(time.Now()) {
		s.enhancedCache.mu.RUnlock()
		return cached.permissionList, nil
	}
	s.enhancedCache.mu.RUnlock()

	// Fetch from database
	roles, err := s.repo.GetUserRoles(ctx, userID, festivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user roles: %w", err)
	}

	// Build permission set from all roles
	permSet := make(map[PermissionString]bool)

	for _, role := range roles {
		// Get predefined permissions for system roles
		if role.Type == RoleTypeSystem {
			if perms := GetPermissionsForRole(PredefinedRoleName(role.Name)); perms != nil {
				for _, p := range perms {
					permSet[p] = true
				}
			}
		}

		// Get database permissions
		for _, p := range role.Permissions {
			permStr := CreatePermissionString(string(p.Resource), string(p.Action))
			permSet[permStr] = true
		}
	}

	// Convert to slice
	var permList []PermissionString
	for p := range permSet {
		permList = append(permList, p)
	}

	// Sort for consistency
	sort.Slice(permList, func(i, j int) bool {
		return string(permList[i]) < string(permList[j])
	})

	// Update cache
	s.updateEnhancedCache(cacheKey, permList, permSet, roles)

	return permList, nil
}

// GetEffectivePermissionsMap returns a map of all effective permissions
func (s *enhancedRBACService) GetEffectivePermissionsMap(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID) (map[PermissionString]bool, error) {
	// Check cache
	cacheKey := s.buildEnhancedCacheKey(userID, festivalID)

	s.enhancedCache.mu.RLock()
	if cached, ok := s.enhancedCache.data[cacheKey]; ok && cached.expiresAt.After(time.Now()) {
		s.enhancedCache.mu.RUnlock()
		return cached.permissions, nil
	}
	s.enhancedCache.mu.RUnlock()

	// Build permissions (this will update cache)
	_, err := s.GetEffectivePermissions(ctx, userID, festivalID)
	if err != nil {
		return nil, err
	}

	// Return from cache
	s.enhancedCache.mu.RLock()
	defer s.enhancedCache.mu.RUnlock()

	if cached, ok := s.enhancedCache.data[cacheKey]; ok {
		return cached.permissions, nil
	}

	return make(map[PermissionString]bool), nil
}

// ============================================================================
// Bulk Operations
// ============================================================================

// CheckMultiplePermissions checks multiple permissions at once
func (s *enhancedRBACService) CheckMultiplePermissions(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, permissions []PermissionString) map[PermissionString]bool {
	result := make(map[PermissionString]bool)

	permMap, err := s.GetEffectivePermissionsMap(ctx, userID, festivalID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get effective permissions for bulk check")
		for _, p := range permissions {
			result[p] = false
		}
		return result
	}

	for _, p := range permissions {
		result[p] = permMap[p]
	}

	return result
}

// ============================================================================
// Role Inheritance
// ============================================================================

// GetInheritedPermissions returns all permissions including inherited ones
func (s *enhancedRBACService) GetInheritedPermissions(ctx context.Context, roleID uuid.UUID) ([]Permission, error) {
	role, err := s.repo.GetRoleByID(ctx, roleID)
	if err != nil {
		return nil, fmt.Errorf("failed to get role: %w", err)
	}
	if role == nil {
		return nil, ErrRoleNotFound
	}

	// Get direct permissions
	permissions := role.Permissions

	// Add inherited permissions based on role type
	if role.Type == RoleTypeSystem {
		// System roles inherit based on priority
		// Higher priority roles include lower priority permissions
		inheritedRoles := s.getInheritedRolesForSystemRole(ctx, role.Name, role.Priority)
		for _, inheritedRole := range inheritedRoles {
			permissions = append(permissions, inheritedRole.Permissions...)
		}
	}

	// Deduplicate permissions
	permMap := make(map[string]Permission)
	for _, p := range permissions {
		key := fmt.Sprintf("%s:%s", p.Resource, p.Action)
		if _, exists := permMap[key]; !exists {
			permMap[key] = p
		}
	}

	var result []Permission
	for _, p := range permMap {
		result = append(result, p)
	}

	return result, nil
}

// GetRoleHierarchy returns the role hierarchy for a festival
func (s *enhancedRBACService) GetRoleHierarchy(ctx context.Context, festivalID *uuid.UUID) ([]RoleHierarchyNode, error) {
	roles, err := s.repo.ListRoles(ctx, festivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to list roles: %w", err)
	}

	// Sort by priority (highest first)
	sort.Slice(roles, func(i, j int) bool {
		return roles[i].Priority > roles[j].Priority
	})

	// Build hierarchy
	var hierarchy []RoleHierarchyNode
	priorityLevels := make(map[int]int) // priority -> level
	currentLevel := 0
	lastPriority := -1

	for _, role := range roles {
		if role.Priority != lastPriority {
			currentLevel++
			priorityLevels[role.Priority] = currentLevel
			lastPriority = role.Priority
		}

		hierarchy = append(hierarchy, RoleHierarchyNode{
			Role:     role,
			Level:    priorityLevels[role.Priority],
			Children: nil, // Could be enhanced to build actual tree structure
		})
	}

	return hierarchy, nil
}

// ============================================================================
// Permission Groups
// ============================================================================

// ListPermissionGroups returns all available permission groups
func (s *enhancedRBACService) ListPermissionGroups() []PermissionGroup {
	return GetPermissionGroups()
}

// GetPermissionGroup returns a specific permission group by name
func (s *enhancedRBACService) GetPermissionGroup(name string) *PermissionGroup {
	return GetPermissionGroup(name)
}

// ============================================================================
// Resource-Based Checks
// ============================================================================

// CanAccessResource checks if user can perform action on a resource
func (s *enhancedRBACService) CanAccessResource(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, resource Resource, action Action) bool {
	// Use the base HasPermission
	return s.RBACService.HasPermission(ctx, userID, resource, action, festivalID)
}

// CanAccessWildcard checks if user has all permissions matching a wildcard pattern
func (s *enhancedRBACService) CanAccessWildcard(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, wildcardPattern string) bool {
	permissions := GetWildcardPermissions(wildcardPattern)
	if len(permissions) == 0 {
		return false
	}

	return s.HasAllPermissionStrings(ctx, userID, festivalID, permissions...)
}

// ============================================================================
// Helper Methods
// ============================================================================

func (s *enhancedRBACService) buildEnhancedCacheKey(userID uuid.UUID, festivalID *uuid.UUID) string {
	if festivalID == nil {
		return fmt.Sprintf("enhanced:%s:global", userID.String())
	}
	return fmt.Sprintf("enhanced:%s:%s", userID.String(), festivalID.String())
}

func (s *enhancedRBACService) updateEnhancedCache(cacheKey string, permList []PermissionString, permMap map[PermissionString]bool, roles []Role) {
	s.enhancedCache.mu.Lock()
	defer s.enhancedCache.mu.Unlock()

	s.enhancedCache.data[cacheKey] = &cachedUserPermissions{
		permissions:    permMap,
		permissionList: permList,
		roles:          roles,
		expiresAt:      time.Now().Add(s.cacheExpiry),
	}
}

func (s *enhancedRBACService) getInheritedRolesForSystemRole(ctx context.Context, roleName string, priority int) []Role {
	// Define role inheritance hierarchy
	// Higher priority roles inherit from lower priority roles
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

	inheritedRoleNames, ok := inheritanceMap[roleName]
	if !ok {
		return nil
	}

	var inheritedRoles []Role
	for _, name := range inheritedRoleNames {
		role, err := s.repo.GetRoleByName(ctx, string(name), nil)
		if err == nil && role != nil {
			inheritedRoles = append(inheritedRoles, *role)
		}
	}

	return inheritedRoles
}

// ClearEnhancedCache clears the enhanced permission cache for a user
func (s *enhancedRBACService) ClearEnhancedCache(userID uuid.UUID) {
	s.enhancedCache.mu.Lock()
	defer s.enhancedCache.mu.Unlock()

	// Clear all cache entries for this user
	for key := range s.enhancedCache.data {
		if len(key) > 45 && key[9:45] == userID.String() {
			delete(s.enhancedCache.data, key)
		}
	}

	// Also clear base cache
	s.RBACService.ClearCache(userID)
}

// logAudit creates an audit log entry
func (s *enhancedRBACService) logAudit(ctx context.Context, action AuditAction, actorID uuid.UUID, targetUserID, roleID, festivalID *uuid.UUID, resource *Resource, oldValue, newValue string) {
	auditLog := &RBACAuditLog{
		Action:       action,
		ActorID:      actorID,
		TargetUserID: targetUserID,
		RoleID:       roleID,
		FestivalID:   festivalID,
		Resource:     resource,
		OldValue:     oldValue,
		NewValue:     newValue,
	}

	if err := s.repo.CreateAuditLog(ctx, auditLog); err != nil {
		log.Error().Err(err).
			Str("action", string(action)).
			Str("actorID", actorID.String()).
			Msg("Failed to create audit log")
	}
}

// ============================================================================
// Permission Context Helpers
// ============================================================================

// PermissionCheckContext provides context for permission checks
type PermissionCheckContext struct {
	UserID     uuid.UUID
	FestivalID *uuid.UUID
	StandID    *uuid.UUID
	IPAddress  string
	RequestID  string
}

// CreatePermissionCheckContext creates a new permission check context
func CreatePermissionCheckContext(userID uuid.UUID, festivalID, standID *uuid.UUID) PermissionCheckContext {
	return PermissionCheckContext{
		UserID:     userID,
		FestivalID: festivalID,
		StandID:    standID,
	}
}

// CheckPermissionWithContext checks permission using a context object
func (s *enhancedRBACService) CheckPermissionWithContext(ctx context.Context, pc PermissionCheckContext, resource Resource, action Action) error {
	if !s.RBACService.HasPermission(ctx, pc.UserID, resource, action, pc.FestivalID) {
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

// RequirePermissionString returns an error if the user doesn't have the required permission string
func (s *enhancedRBACService) RequirePermissionString(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, permission PermissionString) error {
	if !s.HasPermissionString(ctx, userID, permission, festivalID) {
		return ErrInsufficientPermissions
	}
	return nil
}

// RequireAnyPermissionString returns nil if the user has any of the specified permission strings
func (s *enhancedRBACService) RequireAnyPermissionString(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, permissions ...PermissionString) error {
	if !s.HasAnyPermissionString(ctx, userID, festivalID, permissions...) {
		return ErrInsufficientPermissions
	}
	return nil
}

// RequireAllPermissionStrings returns nil only if the user has all specified permission strings
func (s *enhancedRBACService) RequireAllPermissionStrings(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, permissions ...PermissionString) error {
	if !s.HasAllPermissionStrings(ctx, userID, festivalID, permissions...) {
		return ErrInsufficientPermissions
	}
	return nil
}
