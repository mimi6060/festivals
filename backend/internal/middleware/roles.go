package middleware

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/mimi6060/festivals/backend/internal/domain/auth"
)

// AccessChecker is an interface for checking resource access
type AccessChecker interface {
	// HasFestivalAccess checks if a user has access to a festival
	HasFestivalAccess(ctx context.Context, userID, festivalID string) (bool, error)
	// HasStandAccess checks if a user (staff) has access to a stand
	HasStandAccess(ctx context.Context, userID, standID string) (bool, error)
	// IsOrganizerForFestival checks if a user is an organizer for a festival
	IsOrganizerForFestival(ctx context.Context, userID, festivalID string) (bool, error)
}

// RoleConfig holds configuration for role-based middleware
type RoleConfig struct {
	AccessChecker AccessChecker
}

// RequireRole middleware checks if the user has the required role
func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roles, exists := c.Get("roles")
		if !exists {
			respondForbidden(c, "No roles found")
			return
		}

		userRoles, ok := roles.([]string)
		if !ok {
			respondForbidden(c, "Invalid roles format")
			return
		}

		// Admin always has access
		for _, r := range userRoles {
			if r == RoleAdmin {
				c.Next()
				return
			}
		}

		// Check for the specific role
		for _, r := range userRoles {
			if r == role {
				c.Next()
				return
			}
		}

		respondForbidden(c, "Insufficient permissions. Required role: "+role)
	}
}

// RequireAnyRole middleware checks if the user has any of the required roles
func RequireAnyRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRolesRaw, exists := c.Get("roles")
		if !exists {
			respondForbidden(c, "No roles found")
			return
		}

		userRoles, ok := userRolesRaw.([]string)
		if !ok {
			respondForbidden(c, "Invalid roles format")
			return
		}

		// Admin always has access
		for _, r := range userRoles {
			if r == RoleAdmin {
				c.Next()
				return
			}
		}

		// Check if user has any of the required roles
		for _, userRole := range userRoles {
			for _, requiredRole := range roles {
				if userRole == requiredRole {
					c.Next()
					return
				}
			}
		}

		respondForbidden(c, "Insufficient permissions. Required one of roles: "+joinRoles(roles))
	}
}

// RequireAllRoles middleware checks if the user has all of the required roles
func RequireAllRoles(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRolesRaw, exists := c.Get("roles")
		if !exists {
			respondForbidden(c, "No roles found")
			return
		}

		userRoles, ok := userRolesRaw.([]string)
		if !ok {
			respondForbidden(c, "Invalid roles format")
			return
		}

		// Admin always has access
		for _, r := range userRoles {
			if r == RoleAdmin {
				c.Next()
				return
			}
		}

		// Check if user has all required roles
		for _, requiredRole := range roles {
			found := false
			for _, userRole := range userRoles {
				if userRole == requiredRole {
					found = true
					break
				}
			}
			if !found {
				respondForbidden(c, "Insufficient permissions. Required all roles: "+joinRoles(roles))
				return
			}
		}

		c.Next()
	}
}

// RequireAdmin middleware ensures the user is an admin
func RequireAdmin() gin.HandlerFunc {
	return RequireRole(RoleAdmin)
}

// RequireOrganizer middleware ensures the user is an organizer or admin
func RequireOrganizer() gin.HandlerFunc {
	return RequireAnyRole(RoleAdmin, RoleOrganizer)
}

// RequireStaff middleware ensures the user is staff, organizer, or admin
func RequireStaff() gin.HandlerFunc {
	return RequireAnyRole(RoleAdmin, RoleOrganizer, RoleStaff)
}

// RequireRolePermission middleware checks if the user has a specific permission (string-based)
func RequireRolePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Admins bypass permission checks
		if hasRoleInContext(c, RoleAdmin) {
			c.Next()
			return
		}

		permissions, exists := c.Get("permissions")
		if !exists {
			respondForbidden(c, "No permissions found")
			return
		}

		perms, ok := permissions.([]string)
		if !ok {
			respondForbidden(c, "Invalid permissions format")
			return
		}

		for _, p := range perms {
			if p == permission {
				c.Next()
				return
			}
		}

		respondForbidden(c, "Permission denied: "+permission)
	}
}

// RequireAnyRolePermission middleware checks if the user has any of the specified permissions (string-based)
func RequireAnyRolePermission(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Admins bypass permission checks
		if hasRoleInContext(c, RoleAdmin) {
			c.Next()
			return
		}

		userPermsRaw, exists := c.Get("permissions")
		if !exists {
			respondForbidden(c, "No permissions found")
			return
		}

		userPerms, ok := userPermsRaw.([]string)
		if !ok {
			respondForbidden(c, "Invalid permissions format")
			return
		}

		for _, userPerm := range userPerms {
			for _, requiredPerm := range permissions {
				if userPerm == requiredPerm {
					c.Next()
					return
				}
			}
		}

		respondForbidden(c, "Insufficient permissions")
	}
}

// RequireFestivalAccess middleware checks if the user has access to the festival
// The festival ID is expected to be in the URL parameter :festivalId
func RequireFestivalAccess(checker AccessChecker) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			respondForbidden(c, "User not authenticated")
			return
		}

		// Admins have access to all festivals
		if hasRoleInContext(c, RoleAdmin) {
			c.Next()
			return
		}

		festivalID := c.Param("festivalId")
		if festivalID == "" {
			festivalID = c.Param("festival_id")
		}
		if festivalID == "" {
			// Try to get from context (set by tenant middleware)
			festivalID = c.GetString("festival_id")
		}

		if festivalID == "" {
			respondForbidden(c, "Festival ID not found in request")
			return
		}

		// Validate festival ID format
		if _, err := uuid.Parse(festivalID); err != nil {
			respondForbidden(c, "Invalid festival ID format")
			return
		}

		// Check if user is an organizer for this festival (from JWT claims)
		claims := GetClaims(c)
		if claims != nil {
			for _, orgFestival := range claims.OrganizerFor {
				if orgFestival == festivalID {
					c.Set("is_organizer", true)
					c.Next()
					return
				}
			}
		}

		// Check via access checker if provided
		if checker != nil {
			hasAccess, err := checker.HasFestivalAccess(c.Request.Context(), userID, festivalID)
			if err != nil {
				respondInternalError(c, "Failed to check festival access")
				return
			}
			if hasAccess {
				c.Next()
				return
			}

			// Also check if user is an organizer
			isOrganizer, err := checker.IsOrganizerForFestival(c.Request.Context(), userID, festivalID)
			if err != nil {
				respondInternalError(c, "Failed to check organizer status")
				return
			}
			if isOrganizer {
				c.Set("is_organizer", true)
				c.Next()
				return
			}
		}

		respondForbidden(c, "You do not have access to this festival")
	}
}

// RequireStandAccess middleware checks if the user (staff) has access to the stand
// The stand ID is expected to be in the URL parameter :standId
func RequireStandAccess(checker AccessChecker) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			respondForbidden(c, "User not authenticated")
			return
		}

		// Admins have access to all stands
		if hasRoleInContext(c, RoleAdmin) {
			c.Next()
			return
		}

		// Organizers have access to all stands in their festivals
		if hasRoleInContext(c, RoleOrganizer) {
			// If we have a festival access checker, verify the organizer has access to this festival
			festivalID := c.GetString("festival_id")
			if festivalID == "" {
				festivalID = c.Param("festivalId")
			}

			if festivalID != "" && checker != nil {
				isOrganizer, err := checker.IsOrganizerForFestival(c.Request.Context(), userID, festivalID)
				if err == nil && isOrganizer {
					c.Next()
					return
				}
			}
		}

		standID := c.Param("standId")
		if standID == "" {
			standID = c.Param("stand_id")
		}

		if standID == "" {
			respondForbidden(c, "Stand ID not found in request")
			return
		}

		// Validate stand ID format
		if _, err := uuid.Parse(standID); err != nil {
			respondForbidden(c, "Invalid stand ID format")
			return
		}

		// Check from JWT claims
		claims := GetClaims(c)
		if claims != nil {
			for _, assignedStand := range claims.StandIDs {
				if assignedStand == standID {
					c.Next()
					return
				}
			}
		}

		// Check via access checker if provided
		if checker != nil {
			hasAccess, err := checker.HasStandAccess(c.Request.Context(), userID, standID)
			if err != nil {
				respondInternalError(c, "Failed to check stand access")
				return
			}
			if hasAccess {
				c.Next()
				return
			}
		}

		respondForbidden(c, "You do not have access to this stand")
	}
}

// RequireOwnerOrAdmin middleware checks if the user is the owner of the resource or an admin
// The owner ID is expected to be in the URL parameter specified by ownerParam
func RequireOwnerOrAdmin(ownerParam string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			respondForbidden(c, "User not authenticated")
			return
		}

		// Admins have access
		if hasRoleInContext(c, RoleAdmin) {
			c.Next()
			return
		}

		ownerID := c.Param(ownerParam)
		if ownerID == "" {
			respondForbidden(c, "Owner ID not found in request")
			return
		}

		if userID == ownerID {
			c.Next()
			return
		}

		respondForbidden(c, "You can only access your own resources")
	}
}

// RequireSelfOrRole middleware checks if the user is accessing their own resource or has the specified role
func RequireSelfOrRole(userParam string, roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			respondForbidden(c, "User not authenticated")
			return
		}

		targetUserID := c.Param(userParam)

		// Self access is always allowed
		if userID == targetUserID {
			c.Next()
			return
		}

		// Check roles (admin always included)
		allRoles := append([]string{RoleAdmin}, roles...)
		for _, role := range allRoles {
			if hasRoleInContext(c, role) {
				c.Next()
				return
			}
		}

		respondForbidden(c, "Insufficient permissions to access this user's resources")
	}
}

// Helper functions

func hasRoleInContext(c *gin.Context, role string) bool {
	rolesRaw, exists := c.Get("roles")
	if !exists {
		return false
	}
	roles, ok := rolesRaw.([]string)
	if !ok {
		return false
	}
	for _, r := range roles {
		if r == role {
			return true
		}
	}
	return false
}

func joinRoles(roles []string) string {
	if len(roles) == 0 {
		return ""
	}
	result := roles[0]
	for i := 1; i < len(roles); i++ {
		result += ", " + roles[i]
	}
	return result
}

func respondForbidden(c *gin.Context, message string) {
	c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
		"error": gin.H{
			"code":    "FORBIDDEN",
			"message": message,
		},
	})
}

func respondInternalError(c *gin.Context, message string) {
	c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
		"error": gin.H{
			"code":    "INTERNAL_ERROR",
			"message": message,
		},
	})
}

// RoleHierarchy defines the role hierarchy for permission inheritance
var RoleHierarchy = map[string]int{
	RoleUser:      0,
	RoleStaff:     1,
	RoleOrganizer: 2,
	RoleAdmin:     3,
}

// IsRoleAtLeast checks if the user's role is at least the specified level
func IsRoleAtLeast(userRole, requiredRole string) bool {
	userLevel, ok := RoleHierarchy[userRole]
	if !ok {
		return false
	}
	requiredLevel, ok := RoleHierarchy[requiredRole]
	if !ok {
		return false
	}
	return userLevel >= requiredLevel
}

// GetHighestRole returns the highest role from a list of roles
func GetHighestRole(roles []string) string {
	highest := ""
	highestLevel := -1
	for _, role := range roles {
		level, ok := RoleHierarchy[role]
		if ok && level > highestLevel {
			highest = role
			highestLevel = level
		}
	}
	return highest
}

// RequireMinimumRole middleware checks if the user has at least the specified role level
func RequireMinimumRole(minimumRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		rolesRaw, exists := c.Get("roles")
		if !exists {
			respondForbidden(c, "No roles found")
			return
		}

		roles, ok := rolesRaw.([]string)
		if !ok {
			respondForbidden(c, "Invalid roles format")
			return
		}

		highestRole := GetHighestRole(roles)
		if highestRole == "" {
			respondForbidden(c, "No valid roles found")
			return
		}

		if !IsRoleAtLeast(highestRole, minimumRole) {
			respondForbidden(c, "Insufficient role level. Required minimum: "+minimumRole)
			return
		}

		c.Next()
	}
}

// ============================================================================
// RBAC-based Middleware
// ============================================================================

// RBACConfig holds configuration for RBAC middleware
type RBACConfig struct {
	RBACService auth.RBACService
}

// Context keys for RBAC
const (
	ContextKeyRBACPermissions = "rbac_permissions"
	ContextKeyRBACRoles       = "rbac_roles"
)

// RequireRBACPermission middleware checks if the user has a specific RBAC permission
// This uses the database-backed RBAC system for granular permission checks
func RequireRBACPermission(rbacService auth.RBACService, resource auth.Resource, action auth.Action) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			respondForbidden(c, "User not authenticated")
			return
		}

		userUUID, err := uuid.Parse(userID)
		if err != nil {
			respondForbidden(c, "Invalid user ID")
			return
		}

		// Get festival ID from context or URL params
		festivalID := getFestivalIDFromContext(c)

		// Check permission
		if !rbacService.HasPermission(c.Request.Context(), userUUID, resource, action, festivalID) {
			respondForbidden(c, "Permission denied: "+string(resource)+":"+string(action))
			return
		}

		c.Next()
	}
}

// RequireRBACPermissionWithStand middleware checks permission with stand scope
func RequireRBACPermissionWithStand(rbacService auth.RBACService, resource auth.Resource, action auth.Action) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			respondForbidden(c, "User not authenticated")
			return
		}

		userUUID, err := uuid.Parse(userID)
		if err != nil {
			respondForbidden(c, "Invalid user ID")
			return
		}

		festivalID := getFestivalIDFromContext(c)
		standID := getStandIDFromContext(c)

		// Check permission with stand scope
		if !rbacService.HasPermissionWithStand(c.Request.Context(), userUUID, resource, action, festivalID, standID) {
			respondForbidden(c, "Permission denied: "+string(resource)+":"+string(action))
			return
		}

		c.Next()
	}
}

// RequireAnyRBACPermission middleware checks if user has any of the specified permissions
func RequireAnyRBACPermission(rbacService auth.RBACService, permissions ...struct {
	Resource auth.Resource
	Action   auth.Action
}) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			respondForbidden(c, "User not authenticated")
			return
		}

		userUUID, err := uuid.Parse(userID)
		if err != nil {
			respondForbidden(c, "Invalid user ID")
			return
		}

		festivalID := getFestivalIDFromContext(c)

		for _, perm := range permissions {
			if rbacService.HasPermission(c.Request.Context(), userUUID, perm.Resource, perm.Action, festivalID) {
				c.Next()
				return
			}
		}

		respondForbidden(c, "Insufficient permissions")
	}
}

// RequireAllRBACPermissions middleware checks if user has all specified permissions
func RequireAllRBACPermissions(rbacService auth.RBACService, permissions ...struct {
	Resource auth.Resource
	Action   auth.Action
}) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			respondForbidden(c, "User not authenticated")
			return
		}

		userUUID, err := uuid.Parse(userID)
		if err != nil {
			respondForbidden(c, "Invalid user ID")
			return
		}

		festivalID := getFestivalIDFromContext(c)

		for _, perm := range permissions {
			if !rbacService.HasPermission(c.Request.Context(), userUUID, perm.Resource, perm.Action, festivalID) {
				respondForbidden(c, "Permission denied: "+string(perm.Resource)+":"+string(perm.Action))
				return
			}
		}

		c.Next()
	}
}

// RequireRBACRole middleware checks if user has specific RBAC role
func RequireRBACRole(rbacService auth.RBACService, roleName auth.PredefinedRoleName) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			respondForbidden(c, "User not authenticated")
			return
		}

		userUUID, err := uuid.Parse(userID)
		if err != nil {
			respondForbidden(c, "Invalid user ID")
			return
		}

		festivalID := getFestivalIDFromContext(c)

		roles, err := rbacService.GetUserRoles(c.Request.Context(), userUUID, festivalID)
		if err != nil {
			respondInternalError(c, "Failed to get user roles")
			return
		}

		for _, role := range roles {
			if role.Name == string(roleName) {
				c.Next()
				return
			}
		}

		respondForbidden(c, "Required role: "+string(roleName))
	}
}

// RequireSuperAdmin middleware ensures user is a super admin
func RequireSuperAdmin(rbacService auth.RBACService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			respondForbidden(c, "User not authenticated")
			return
		}

		userUUID, err := uuid.Parse(userID)
		if err != nil {
			respondForbidden(c, "Invalid user ID")
			return
		}

		if !rbacService.IsSuperAdmin(c.Request.Context(), userUUID) {
			respondForbidden(c, "Super admin access required")
			return
		}

		c.Next()
	}
}

// RequireFestivalOwner middleware ensures user is festival owner or super admin
func RequireFestivalOwner(rbacService auth.RBACService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			respondForbidden(c, "User not authenticated")
			return
		}

		userUUID, err := uuid.Parse(userID)
		if err != nil {
			respondForbidden(c, "Invalid user ID")
			return
		}

		festivalID := getFestivalIDFromContext(c)
		if festivalID == nil {
			respondForbidden(c, "Festival ID required")
			return
		}

		if !rbacService.IsFestivalOwner(c.Request.Context(), userUUID, *festivalID) {
			respondForbidden(c, "Festival owner access required")
			return
		}

		c.Next()
	}
}

// RequireFestivalAdmin middleware ensures user is festival admin, owner, or super admin
func RequireFestivalAdmin(rbacService auth.RBACService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			respondForbidden(c, "User not authenticated")
			return
		}

		userUUID, err := uuid.Parse(userID)
		if err != nil {
			respondForbidden(c, "Invalid user ID")
			return
		}

		festivalID := getFestivalIDFromContext(c)
		if festivalID == nil {
			respondForbidden(c, "Festival ID required")
			return
		}

		if !rbacService.IsFestivalAdmin(c.Request.Context(), userUUID, *festivalID) {
			respondForbidden(c, "Festival admin access required")
			return
		}

		c.Next()
	}
}

// LoadUserRBACPermissions middleware loads RBAC permissions into context
// This can be used to preload permissions for efficiency
func LoadUserRBACPermissions(rbacService auth.RBACService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			c.Next()
			return
		}

		userUUID, err := uuid.Parse(userID)
		if err != nil {
			c.Next()
			return
		}

		festivalID := getFestivalIDFromContext(c)

		// Load user permissions
		permissions, err := rbacService.GetUserPermissions(c.Request.Context(), userUUID, festivalID)
		if err == nil && permissions != nil {
			c.Set(ContextKeyRBACPermissions, permissions)
		}

		// Load user roles
		roles, err := rbacService.GetUserRoles(c.Request.Context(), userUUID, festivalID)
		if err == nil {
			c.Set(ContextKeyRBACRoles, roles)
		}

		c.Next()
	}
}

// Helper functions for RBAC middleware

func getFestivalIDFromContext(c *gin.Context) *uuid.UUID {
	// Try URL params first
	festivalIDStr := c.Param("festivalId")
	if festivalIDStr == "" {
		festivalIDStr = c.Param("festival_id")
	}
	if festivalIDStr == "" {
		festivalIDStr = c.GetString("festival_id")
	}

	if festivalIDStr == "" {
		return nil
	}

	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		return nil
	}

	return &festivalID
}

func getStandIDFromContext(c *gin.Context) *uuid.UUID {
	standIDStr := c.Param("standId")
	if standIDStr == "" {
		standIDStr = c.Param("stand_id")
	}
	if standIDStr == "" {
		standIDStr = c.GetString("stand_id")
	}

	if standIDStr == "" {
		return nil
	}

	standID, err := uuid.Parse(standIDStr)
	if err != nil {
		return nil
	}

	return &standID
}

// GetRBACPermissions extracts RBAC permissions from context
func GetRBACPermissions(c *gin.Context) *auth.UserPermissionsResponse {
	if perms, exists := c.Get(ContextKeyRBACPermissions); exists {
		if p, ok := perms.(*auth.UserPermissionsResponse); ok {
			return p
		}
	}
	return nil
}

// GetRBACRoles extracts RBAC roles from context
func GetRBACRoles(c *gin.Context) []auth.Role {
	if roles, exists := c.Get(ContextKeyRBACRoles); exists {
		if r, ok := roles.([]auth.Role); ok {
			return r
		}
	}
	return nil
}

// HasRBACPermissionFromContext checks permission from preloaded context
func HasRBACPermissionFromContext(c *gin.Context, resource auth.Resource, action auth.Action) bool {
	perms := GetRBACPermissions(c)
	if perms == nil {
		return false
	}

	permKey := string(resource) + ":" + string(action)
	for _, p := range perms.Permissions {
		if string(p.Resource)+":"+string(p.Action) == permKey {
			return true
		}
	}
	return false
}

// HasRBACRoleFromContext checks role from preloaded context
func HasRBACRoleFromContext(c *gin.Context, roleName string) bool {
	roles := GetRBACRoles(c)
	if roles == nil {
		return false
	}

	for _, r := range roles {
		if r.Name == roleName {
			return true
		}
	}
	return false
}
