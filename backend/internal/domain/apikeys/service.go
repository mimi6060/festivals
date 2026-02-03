package apikeys

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

// Service provides API key management operations
type Service struct {
	repo Repository
}

// NewService creates a new API keys service
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// GenerateAPIKey creates a new API key and returns it (only returned once)
func (s *Service) GenerateAPIKey(ctx context.Context, festivalID uuid.UUID, req CreateAPIKeyRequest) (*APIKey, string, error) {
	// Validate scopes
	for _, scope := range req.Scopes {
		if !IsValidScope(scope) {
			return nil, "", errors.ValidationErr("Invalid scope: "+scope, nil)
		}
	}

	// Generate secure random key
	rawKey := make([]byte, 32)
	if _, err := rand.Read(rawKey); err != nil {
		return nil, "", fmt.Errorf("failed to generate random key: %w", err)
	}

	// Create the full key with prefix for identification
	prefix := "fst_" + base64.RawURLEncoding.EncodeToString(rawKey[:4])
	fullKey := prefix + "_" + base64.RawURLEncoding.EncodeToString(rawKey)

	// Hash the key for storage
	hash := sha256.Sum256([]byte(fullKey))
	keyHash := hex.EncodeToString(hash[:])

	// Set rate limit
	rateLimit := 1000
	if req.RateLimit != nil && *req.RateLimit > 0 {
		rateLimit = *req.RateLimit
	}

	// Parse expiration
	var expiresAt *time.Time
	if req.ExpiresAt != nil && *req.ExpiresAt != "" {
		t, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			return nil, "", errors.ValidationErr("Invalid expiration date format, use RFC3339", nil)
		}
		if t.Before(time.Now()) {
			return nil, "", errors.ValidationErr("Expiration date must be in the future", nil)
		}
		expiresAt = &t
	}

	apiKey := &APIKey{
		ID:         uuid.New(),
		FestivalID: festivalID,
		Name:       req.Name,
		KeyHash:    keyHash,
		Prefix:     prefix,
		Scopes:     req.Scopes,
		RateLimit:  rateLimit,
		ExpiresAt:  expiresAt,
		IsRevoked:  false,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := s.repo.CreateAPIKey(ctx, apiKey); err != nil {
		return nil, "", fmt.Errorf("failed to create API key: %w", err)
	}

	return apiKey, fullKey, nil
}

// ValidateAPIKey validates an API key and returns the key record if valid
func (s *Service) ValidateAPIKey(ctx context.Context, key string) (*APIKey, error) {
	// Hash the provided key
	hash := sha256.Sum256([]byte(key))
	keyHash := hex.EncodeToString(hash[:])

	// Look up by hash
	apiKey, err := s.repo.GetByKeyHash(ctx, keyHash)
	if err != nil {
		return nil, fmt.Errorf("failed to validate API key: %w", err)
	}

	if apiKey == nil {
		return nil, errors.UnauthorizedErr("Invalid API key")
	}

	// Check if revoked
	if apiKey.IsRevoked {
		return nil, errors.UnauthorizedErr("API key has been revoked")
	}

	// Check expiration
	if apiKey.ExpiresAt != nil && apiKey.ExpiresAt.Before(time.Now()) {
		return nil, errors.UnauthorizedErr("API key has expired")
	}

	// Update last used (async, don't fail on error)
	go func() {
		_ = s.repo.UpdateLastUsed(context.Background(), apiKey.ID)
	}()

	return apiKey, nil
}

// HasScope checks if an API key has a specific scope
func (s *Service) HasScope(apiKey *APIKey, requiredScope string) bool {
	for _, scope := range apiKey.Scopes {
		if scope == string(ScopeAll) || scope == requiredScope {
			return true
		}
	}
	return false
}

// ListAPIKeys returns all API keys for a festival (masked)
func (s *Service) ListAPIKeys(ctx context.Context, festivalID uuid.UUID) ([]APIKey, error) {
	return s.repo.GetByFestival(ctx, festivalID)
}

// GetAPIKey returns a specific API key by ID
func (s *Service) GetAPIKey(ctx context.Context, id uuid.UUID) (*APIKey, error) {
	apiKey, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if apiKey == nil {
		return nil, errors.ErrNotFound
	}
	return apiKey, nil
}

// RevokeAPIKey revokes an API key
func (s *Service) RevokeAPIKey(ctx context.Context, id uuid.UUID) error {
	apiKey, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if apiKey == nil {
		return errors.ErrNotFound
	}

	return s.repo.RevokeKey(ctx, id)
}

// DeleteAPIKey permanently deletes an API key
func (s *Service) DeleteAPIKey(ctx context.Context, id uuid.UUID) error {
	apiKey, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if apiKey == nil {
		return errors.ErrNotFound
	}

	return s.repo.DeleteKey(ctx, id)
}

// RotateAPIKey creates a new key with the same settings and revokes the old one
func (s *Service) RotateAPIKey(ctx context.Context, id uuid.UUID, req RotateAPIKeyRequest) (*APIKey, string, error) {
	// Get existing key
	oldKey, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, "", err
	}
	if oldKey == nil {
		return nil, "", errors.ErrNotFound
	}

	// Parse new expiration if provided
	var expiresAt *string
	if req.ExpiresAt != nil {
		expiresAt = req.ExpiresAt
	} else if oldKey.ExpiresAt != nil {
		exp := oldKey.ExpiresAt.Format(time.RFC3339)
		expiresAt = &exp
	}

	// Create new key with same settings
	createReq := CreateAPIKeyRequest{
		Name:      oldKey.Name,
		Scopes:    oldKey.Scopes,
		RateLimit: &oldKey.RateLimit,
		ExpiresAt: expiresAt,
	}

	newKey, fullKey, err := s.GenerateAPIKey(ctx, oldKey.FestivalID, createReq)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create new key: %w", err)
	}

	// Revoke old key
	if err := s.repo.RevokeKey(ctx, id); err != nil {
		return nil, "", fmt.Errorf("failed to revoke old key: %w", err)
	}

	return newKey, fullKey, nil
}
