package auth

import (
	"context"
)

// ContextKey is the type for context keys
type ContextKey string

const (
	// RolesContextKey is the key for storing user roles in context
	// Must match middleware.ContextKeyRoles
	RolesContextKey ContextKey = "roles"
	// UserIDContextKey is the key for storing user ID in context
	UserIDContextKey ContextKey = "user_id"
)

// GetRolesFromContext retrieves roles from context
func GetRolesFromContext(ctx context.Context) []string {
	roles, ok := ctx.Value(RolesContextKey).([]string)
	if !ok {
		return nil
	}
	return roles
}

// HasRole checks if the context contains a specific role
func HasRole(ctx context.Context, role string) bool {
	roles := GetRolesFromContext(ctx)
	for _, r := range roles {
		if r == role {
			return true
		}
	}
	return false
}

// HasAnyRole checks if the context contains any of the specified roles
func HasAnyRole(ctx context.Context, roles ...string) bool {
	userRoles := GetRolesFromContext(ctx)
	for _, userRole := range userRoles {
		for _, role := range roles {
			if userRole == role {
				return true
			}
		}
	}
	return false
}

// GetUserIDFromContext retrieves user ID from context
func GetUserIDFromContext(ctx context.Context) string {
	userID, ok := ctx.Value(UserIDContextKey).(string)
	if !ok {
		return ""
	}
	return userID
}

// SetRolesInContext sets roles in context
func SetRolesInContext(ctx context.Context, roles []string) context.Context {
	return context.WithValue(ctx, RolesContextKey, roles)
}

// SetUserIDInContext sets user ID in context
func SetUserIDInContext(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, UserIDContextKey, userID)
}
