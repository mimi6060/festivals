package user

import (
	"time"

	"github.com/google/uuid"
)

// User represents a user in the system
type User struct {
	ID        uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Email     string     `json:"email" gorm:"unique;not null"`
	Name      string     `json:"name" gorm:"not null"`
	Phone     string     `json:"phone,omitempty"`
	Avatar    string     `json:"avatar,omitempty"`
	Role      UserRole   `json:"role" gorm:"default:'USER'"`
	Auth0ID   string     `json:"auth0Id" gorm:"unique;not null;index"`
	Status    UserStatus `json:"status" gorm:"default:'ACTIVE'"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

func (User) TableName() string {
	return "public.users"
}

// UserRole represents the role of a user
type UserRole string

const (
	UserRoleAdmin     UserRole = "ADMIN"
	UserRoleOrganizer UserRole = "ORGANIZER"
	UserRoleStaff     UserRole = "STAFF"
	UserRoleUser      UserRole = "USER"
)

// IsValid checks if the role is a valid UserRole
func (r UserRole) IsValid() bool {
	switch r {
	case UserRoleAdmin, UserRoleOrganizer, UserRoleStaff, UserRoleUser:
		return true
	}
	return false
}

// UserStatus represents the status of a user
type UserStatus string

const (
	UserStatusActive   UserStatus = "ACTIVE"
	UserStatusInactive UserStatus = "INACTIVE"
	UserStatusBanned   UserStatus = "BANNED"
)

// IsValid checks if the status is a valid UserStatus
func (s UserStatus) IsValid() bool {
	switch s {
	case UserStatusActive, UserStatusInactive, UserStatusBanned:
		return true
	}
	return false
}

// Auth0Profile represents the profile data from Auth0
type Auth0Profile struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Nickname      string `json:"nickname"`
	Picture       string `json:"picture"`
	UpdatedAt     string `json:"updated_at"`
}

// CreateUserRequest represents the request to create a user
type CreateUserRequest struct {
	Email   string   `json:"email" binding:"required,email"`
	Name    string   `json:"name" binding:"required"`
	Phone   string   `json:"phone,omitempty"`
	Avatar  string   `json:"avatar,omitempty"`
	Role    UserRole `json:"role,omitempty"`
	Auth0ID string   `json:"auth0Id" binding:"required"`
}

// UpdateUserRequest represents the request to update a user profile
type UpdateUserRequest struct {
	Name   *string `json:"name,omitempty"`
	Phone  *string `json:"phone,omitempty"`
	Avatar *string `json:"avatar,omitempty"`
}

// UpdateUserRoleRequest represents the request to update a user's role
type UpdateUserRoleRequest struct {
	Role UserRole `json:"role" binding:"required"`
}

// BanUserRequest represents the request to ban a user
type BanUserRequest struct {
	Reason string `json:"reason,omitempty"`
}

// UserResponse represents the API response for a user
type UserResponse struct {
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	Name      string     `json:"name"`
	Phone     string     `json:"phone,omitempty"`
	Avatar    string     `json:"avatar,omitempty"`
	Role      UserRole   `json:"role"`
	Status    UserStatus `json:"status"`
	CreatedAt string     `json:"createdAt"`
	UpdatedAt string     `json:"updatedAt"`
}

// ToResponse converts a User to UserResponse
func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:        u.ID,
		Email:     u.Email,
		Name:      u.Name,
		Phone:     u.Phone,
		Avatar:    u.Avatar,
		Role:      u.Role,
		Status:    u.Status,
		CreatedAt: u.CreatedAt.Format(time.RFC3339),
		UpdatedAt: u.UpdatedAt.Format(time.RFC3339),
	}
}

// UserListResponse represents a paginated list of users
type UserListResponse struct {
	Users []UserResponse `json:"users"`
	Total int64          `json:"total"`
	Page  int            `json:"page"`
	Limit int            `json:"limit"`
}
