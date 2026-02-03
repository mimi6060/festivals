package apikeys

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// APIKey represents an API key for a festival
type APIKey struct {
	ID         uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID uuid.UUID      `json:"festivalId" gorm:"type:uuid;not null;index"`
	Name       string         `json:"name" gorm:"not null"`
	KeyHash    string         `json:"-" gorm:"not null;uniqueIndex"`
	Prefix     string         `json:"prefix" gorm:"not null"` // First 8 chars for identification
	Scopes     pq.StringArray `json:"scopes" gorm:"type:text[]"`
	RateLimit  int            `json:"rateLimit" gorm:"default:1000"` // Requests per hour
	ExpiresAt  *time.Time     `json:"expiresAt,omitempty"`
	LastUsedAt *time.Time     `json:"lastUsedAt,omitempty"`
	IsRevoked  bool           `json:"isRevoked" gorm:"default:false"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
}

func (APIKey) TableName() string {
	return "public.api_keys"
}

// APIKeyScope represents available scopes for API keys
type APIKeyScope string

const (
	ScopeReadFestivals   APIKeyScope = "festivals:read"
	ScopeWriteFestivals  APIKeyScope = "festivals:write"
	ScopeReadTickets     APIKeyScope = "tickets:read"
	ScopeWriteTickets    APIKeyScope = "tickets:write"
	ScopeReadOrders      APIKeyScope = "orders:read"
	ScopeWriteOrders     APIKeyScope = "orders:write"
	ScopeReadWallets     APIKeyScope = "wallets:read"
	ScopeWriteWallets    APIKeyScope = "wallets:write"
	ScopeReadStands      APIKeyScope = "stands:read"
	ScopeWriteStands     APIKeyScope = "stands:write"
	ScopeReadProducts    APIKeyScope = "products:read"
	ScopeWriteProducts   APIKeyScope = "products:write"
	ScopeReadAnalytics   APIKeyScope = "analytics:read"
	ScopeReadLineup      APIKeyScope = "lineup:read"
	ScopeWriteLineup     APIKeyScope = "lineup:write"
	ScopeReadWebhooks    APIKeyScope = "webhooks:read"
	ScopeWriteWebhooks   APIKeyScope = "webhooks:write"
	ScopeAll             APIKeyScope = "*"
)

// ValidScopes returns all valid API key scopes
func ValidScopes() []APIKeyScope {
	return []APIKeyScope{
		ScopeReadFestivals,
		ScopeWriteFestivals,
		ScopeReadTickets,
		ScopeWriteTickets,
		ScopeReadOrders,
		ScopeWriteOrders,
		ScopeReadWallets,
		ScopeWriteWallets,
		ScopeReadStands,
		ScopeWriteStands,
		ScopeReadProducts,
		ScopeWriteProducts,
		ScopeReadAnalytics,
		ScopeReadLineup,
		ScopeWriteLineup,
		ScopeReadWebhooks,
		ScopeWriteWebhooks,
		ScopeAll,
	}
}

// IsValidScope checks if a scope is valid
func IsValidScope(scope string) bool {
	for _, s := range ValidScopes() {
		if string(s) == scope {
			return true
		}
	}
	return false
}

// CreateAPIKeyRequest represents the request to create an API key
type CreateAPIKeyRequest struct {
	Name      string   `json:"name" binding:"required,min=1,max=100"`
	Scopes    []string `json:"scopes" binding:"required,min=1"`
	RateLimit *int     `json:"rateLimit,omitempty"`
	ExpiresAt *string  `json:"expiresAt,omitempty"` // ISO 8601 format
}

// RotateAPIKeyRequest represents the request to rotate an API key
type RotateAPIKeyRequest struct {
	ExpiresAt *string `json:"expiresAt,omitempty"` // ISO 8601 format for new key
}

// APIKeyResponse represents the API response for an API key (masked)
type APIKeyResponse struct {
	ID         uuid.UUID  `json:"id"`
	FestivalID uuid.UUID  `json:"festivalId"`
	Name       string     `json:"name"`
	Prefix     string     `json:"prefix"`
	Scopes     []string   `json:"scopes"`
	RateLimit  int        `json:"rateLimit"`
	ExpiresAt  *string    `json:"expiresAt,omitempty"`
	LastUsedAt *string    `json:"lastUsedAt,omitempty"`
	IsRevoked  bool       `json:"isRevoked"`
	CreatedAt  string     `json:"createdAt"`
}

// APIKeyCreatedResponse is returned only when a key is first created
type APIKeyCreatedResponse struct {
	APIKeyResponse
	Key string `json:"key"` // Full key - only returned once on creation
}

// ToResponse converts an APIKey to APIKeyResponse (masked)
func (k *APIKey) ToResponse() APIKeyResponse {
	resp := APIKeyResponse{
		ID:         k.ID,
		FestivalID: k.FestivalID,
		Name:       k.Name,
		Prefix:     k.Prefix,
		Scopes:     k.Scopes,
		RateLimit:  k.RateLimit,
		IsRevoked:  k.IsRevoked,
		CreatedAt:  k.CreatedAt.Format(time.RFC3339),
	}

	if k.ExpiresAt != nil {
		exp := k.ExpiresAt.Format(time.RFC3339)
		resp.ExpiresAt = &exp
	}

	if k.LastUsedAt != nil {
		used := k.LastUsedAt.Format(time.RFC3339)
		resp.LastUsedAt = &used
	}

	return resp
}

// ToCreatedResponse creates a response with the full key (only used at creation time)
func (k *APIKey) ToCreatedResponse(fullKey string) APIKeyCreatedResponse {
	return APIKeyCreatedResponse{
		APIKeyResponse: k.ToResponse(),
		Key:            fullKey,
	}
}
