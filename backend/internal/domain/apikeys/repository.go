package apikeys

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for API key data operations
type Repository interface {
	// CreateAPIKey creates a new API key
	CreateAPIKey(ctx context.Context, apiKey *APIKey) error

	// GetByID retrieves an API key by its ID
	GetByID(ctx context.Context, id uuid.UUID) (*APIKey, error)

	// GetByKeyHash retrieves an API key by its hash (for validation)
	GetByKeyHash(ctx context.Context, keyHash string) (*APIKey, error)

	// GetByFestival retrieves all API keys for a festival
	GetByFestival(ctx context.Context, festivalID uuid.UUID) ([]APIKey, error)

	// UpdateLastUsed updates the last used timestamp of an API key
	UpdateLastUsed(ctx context.Context, id uuid.UUID) error

	// RevokeKey marks an API key as revoked
	RevokeKey(ctx context.Context, id uuid.UUID) error

	// DeleteKey permanently deletes an API key
	DeleteKey(ctx context.Context, id uuid.UUID) error

	// Update updates an API key
	Update(ctx context.Context, apiKey *APIKey) error
}
