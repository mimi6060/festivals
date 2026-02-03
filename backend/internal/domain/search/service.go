package search

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/cache"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

const (
	// Cache TTL for search results
	searchCacheTTL = 5 * time.Minute
	// Cache TTL for suggestions (shorter since they're quick)
	suggestionCacheTTL = 2 * time.Minute
	// Maximum suggestions to return
	maxSuggestions = 10
)

// Service provides search operations with caching
type Service struct {
	repo        Repository
	redisClient *redis.Client
	keyBuilder  *cache.KeyBuilder
}

// NewService creates a new search service
func NewService(repo Repository, redisClient *redis.Client) *Service {
	return &Service{
		repo:        repo,
		redisClient: redisClient,
		keyBuilder:  cache.NewKeyBuilder("festivals"),
	}
}

// Search performs a search based on the provided filters
func (s *Service) Search(ctx context.Context, filters *SearchFilters) (*SearchResponse, error) {
	startTime := time.Now()

	// Normalize filters
	filters.Normalize()

	// Try to get from cache first
	if s.redisClient != nil {
		cached, err := s.getFromCache(ctx, filters)
		if err == nil && cached != nil {
			log.Debug().
				Str("query", filters.Query).
				Str("type", string(filters.Type)).
				Msg("Search results retrieved from cache")
			return cached, nil
		}
	}

	// Perform the search based on type
	var results []SearchResult
	var total int64
	var err error

	switch filters.Type {
	case SearchTypeArtist:
		results, total, err = s.repo.SearchArtists(ctx, filters.Query, filters.FestivalID, filters.Offset(), filters.PerPage)
	case SearchTypeStage:
		results, total, err = s.repo.SearchStages(ctx, filters.Query, filters.FestivalID, filters.Offset(), filters.PerPage)
	case SearchTypeStand:
		results, total, err = s.repo.SearchStands(ctx, filters.Query, filters.FestivalID, filters.Category, filters.Offset(), filters.PerPage)
	case SearchTypeProduct:
		results, total, err = s.repo.SearchProducts(ctx, filters.Query, filters.FestivalID, filters.Category, filters.Offset(), filters.PerPage)
	case SearchTypeAll:
		results, total, err = s.repo.SearchAll(ctx, filters.Query, filters.FestivalID, filters.Offset(), filters.PerPage)
	default:
		return nil, fmt.Errorf("invalid search type: %s", filters.Type)
	}

	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	// Handle nil results
	if results == nil {
		results = []SearchResult{}
	}

	// Create response
	response := NewSearchResponse(filters, results, total, time.Since(startTime))

	// Cache the results
	if s.redisClient != nil {
		if err := s.setCache(ctx, filters, response); err != nil {
			log.Warn().Err(err).Msg("Failed to cache search results")
		}
	}

	return response, nil
}

// SearchArtists searches only artists
func (s *Service) SearchArtists(ctx context.Context, query string, festivalID *uuid.UUID, page, perPage int) (*SearchResponse, error) {
	filters := &SearchFilters{
		Query:      query,
		Type:       SearchTypeArtist,
		FestivalID: festivalID,
		Page:       page,
		PerPage:    perPage,
	}
	return s.Search(ctx, filters)
}

// SearchStages searches only stages
func (s *Service) SearchStages(ctx context.Context, query string, festivalID *uuid.UUID, page, perPage int) (*SearchResponse, error) {
	filters := &SearchFilters{
		Query:      query,
		Type:       SearchTypeStage,
		FestivalID: festivalID,
		Page:       page,
		PerPage:    perPage,
	}
	return s.Search(ctx, filters)
}

// SearchStands searches only stands
func (s *Service) SearchStands(ctx context.Context, query string, festivalID *uuid.UUID, category string, page, perPage int) (*SearchResponse, error) {
	filters := &SearchFilters{
		Query:      query,
		Type:       SearchTypeStand,
		FestivalID: festivalID,
		Category:   category,
		Page:       page,
		PerPage:    perPage,
	}
	return s.Search(ctx, filters)
}

// SearchProducts searches only products
func (s *Service) SearchProducts(ctx context.Context, query string, festivalID *uuid.UUID, category string, page, perPage int) (*SearchResponse, error) {
	filters := &SearchFilters{
		Query:      query,
		Type:       SearchTypeProduct,
		FestivalID: festivalID,
		Category:   category,
		Page:       page,
		PerPage:    perPage,
	}
	return s.Search(ctx, filters)
}

// GetSuggestions returns search suggestions based on partial query
func (s *Service) GetSuggestions(ctx context.Context, query string, festivalID *uuid.UUID) (*SuggestionsResponse, error) {
	if len(query) < 2 {
		return &SuggestionsResponse{
			Query:       query,
			Suggestions: []SearchSuggestion{},
		}, nil
	}

	// Try to get from cache first
	if s.redisClient != nil {
		cached, err := s.getSuggestionsFromCache(ctx, query, festivalID)
		if err == nil && cached != nil {
			return cached, nil
		}
	}

	suggestions, err := s.repo.GetSuggestions(ctx, query, festivalID, maxSuggestions)
	if err != nil {
		return nil, fmt.Errorf("failed to get suggestions: %w", err)
	}

	if suggestions == nil {
		suggestions = []SearchSuggestion{}
	}

	response := &SuggestionsResponse{
		Query:       query,
		Suggestions: suggestions,
	}

	// Cache the suggestions
	if s.redisClient != nil {
		if err := s.setSuggestionsCache(ctx, query, festivalID, response); err != nil {
			log.Warn().Err(err).Msg("Failed to cache suggestions")
		}
	}

	return response, nil
}

// InvalidateCache invalidates all search cache for a festival
func (s *Service) InvalidateCache(ctx context.Context, festivalID *uuid.UUID) error {
	if s.redisClient == nil {
		return nil
	}

	pattern := s.buildSearchCachePattern(festivalID)
	return s.deleteByPattern(ctx, pattern)
}

// InvalidateEntityCache invalidates cache for a specific entity type
func (s *Service) InvalidateEntityCache(ctx context.Context, entityType SearchType, festivalID *uuid.UUID) error {
	if s.redisClient == nil {
		return nil
	}

	// Invalidate both specific type and "all" type caches
	pattern := s.buildSearchCachePattern(festivalID)
	return s.deleteByPattern(ctx, pattern)
}

// Cache key helpers

func (s *Service) buildSearchCacheKey(filters *SearchFilters) string {
	festivalPart := "global"
	if filters.FestivalID != nil {
		festivalPart = filters.FestivalID.String()
	}
	return fmt.Sprintf("%s:search:%s:%s:%s:%s:%d:%d",
		s.keyBuilder.FestivalKey(uuid.Nil), // Base prefix
		festivalPart,
		filters.Type,
		sanitizeQuery(filters.Query),
		filters.Category,
		filters.Page,
		filters.PerPage,
	)
}

func (s *Service) buildSuggestionsCacheKey(query string, festivalID *uuid.UUID) string {
	festivalPart := "global"
	if festivalID != nil {
		festivalPart = festivalID.String()
	}
	return fmt.Sprintf("%s:suggestions:%s:%s",
		s.keyBuilder.FestivalKey(uuid.Nil),
		festivalPart,
		sanitizeQuery(query),
	)
}

func (s *Service) buildSearchCachePattern(festivalID *uuid.UUID) string {
	festivalPart := "*"
	if festivalID != nil {
		festivalPart = festivalID.String()
	}
	return fmt.Sprintf("%s:search:%s:*",
		s.keyBuilder.FestivalKey(uuid.Nil),
		festivalPart,
	)
}

// Cache operations

func (s *Service) getFromCache(ctx context.Context, filters *SearchFilters) (*SearchResponse, error) {
	key := s.buildSearchCacheKey(filters)
	data, err := s.redisClient.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}

	var response SearchResponse
	if err := json.Unmarshal(data, &response); err != nil {
		return nil, err
	}

	return &response, nil
}

func (s *Service) setCache(ctx context.Context, filters *SearchFilters, response *SearchResponse) error {
	key := s.buildSearchCacheKey(filters)
	data, err := json.Marshal(response)
	if err != nil {
		return err
	}

	return s.redisClient.Set(ctx, key, data, searchCacheTTL).Err()
}

func (s *Service) getSuggestionsFromCache(ctx context.Context, query string, festivalID *uuid.UUID) (*SuggestionsResponse, error) {
	key := s.buildSuggestionsCacheKey(query, festivalID)
	data, err := s.redisClient.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}

	var response SuggestionsResponse
	if err := json.Unmarshal(data, &response); err != nil {
		return nil, err
	}

	return &response, nil
}

func (s *Service) setSuggestionsCache(ctx context.Context, query string, festivalID *uuid.UUID, response *SuggestionsResponse) error {
	key := s.buildSuggestionsCacheKey(query, festivalID)
	data, err := json.Marshal(response)
	if err != nil {
		return err
	}

	return s.redisClient.Set(ctx, key, data, suggestionCacheTTL).Err()
}

func (s *Service) deleteByPattern(ctx context.Context, pattern string) error {
	iter := s.redisClient.Scan(ctx, 0, pattern, 100).Iterator()
	for iter.Next(ctx) {
		if err := s.redisClient.Del(ctx, iter.Val()).Err(); err != nil {
			log.Warn().Err(err).Str("key", iter.Val()).Msg("Failed to delete cache key")
		}
	}
	return iter.Err()
}

// sanitizeQuery cleans up the query string for use in cache keys
func sanitizeQuery(query string) string {
	// Simple sanitization - replace problematic characters
	result := ""
	for _, r := range query {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == ' ' || r == '-' {
			result += string(r)
		}
	}
	// Limit length
	if len(result) > 50 {
		result = result[:50]
	}
	return result
}
