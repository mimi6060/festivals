package middleware

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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

// RequirePermission middleware checks if the user has a specific permission
func RequirePermission(permission string) gin.HandlerFunc {
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

// RequireAnyPermission middleware checks if the user has any of the specified permissions
func RequireAnyPermission(permissions ...string) gin.HandlerFunc {
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
