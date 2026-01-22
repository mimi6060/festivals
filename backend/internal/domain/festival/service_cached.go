package festival

import (
	"context"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/cache"
	"github.com/rs/zerolog/log"
)

// ServiceInterface defines the interface for festival service operations
// This allows wrapping the service with caching
type ServiceInterface interface {
	Create(ctx context.Context, req CreateFestivalRequest, createdBy *uuid.UUID) (*Festival, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Festival, error)
	GetBySlug(ctx context.Context, slug string) (*Festival, error)
	List(ctx context.Context, page, perPage int) ([]Festival, int64, error)
	Update(ctx context.Context, id uuid.UUID, req UpdateFestivalRequest) (*Festival, error)
	Delete(ctx context.Context, id uuid.UUID) error
	Activate(ctx context.Context, id uuid.UUID) (*Festival, error)
	Archive(ctx context.Context, id uuid.UUID) (*Festival, error)
}

// Ensure Service implements ServiceInterface
var _ ServiceInterface = (*Service)(nil)

// CachedService wraps a ServiceInterface with caching
type CachedService struct {
	service     ServiceInterface
	cache       cache.Cacher
	invalidator *cache.Invalidator
	keys        *cache.KeyBuilder
}

// NewCachedService creates a new CachedService
func NewCachedService(service ServiceInterface, c cache.Cacher, invalidator *cache.Invalidator) *CachedService {
	return &CachedService{
		service:     service,
		cache:       c,
		invalidator: invalidator,
		keys:        cache.DefaultKeyBuilder,
	}
}

// Ensure CachedService implements ServiceInterface
var _ ServiceInterface = (*CachedService)(nil)

// Create creates a new festival (no caching, but invalidates list cache)
func (s *CachedService) Create(ctx context.Context, req CreateFestivalRequest, createdBy *uuid.UUID) (*Festival, error) {
	festival, err := s.service.Create(ctx, req, createdBy)
	if err != nil {
		return nil, err
	}

	// Invalidate list cache since we added a new festival
	if err := s.invalidateListCache(ctx); err != nil {
		log.Warn().Err(err).Msg("failed to invalidate festival list cache after create")
	}

	// Cache the new festival
	if err := s.cacheItem(ctx, festival); err != nil {
		log.Warn().Err(err).Str("festivalID", festival.ID.String()).Msg("failed to cache new festival")
	}

	return festival, nil
}

// GetByID retrieves a festival by ID with caching
func (s *CachedService) GetByID(ctx context.Context, id uuid.UUID) (*Festival, error) {
	key := s.keys.FestivalKey(id)

	var festival Festival
	err := s.cache.GetOrSetJSON(ctx, key, &festival, cache.FestivalTTL, func() (interface{}, error) {
		log.Debug().Str("festivalID", id.String()).Msg("fetching festival from database")
		return s.service.GetByID(ctx, id)
	})

	if err != nil {
		return nil, err
	}

	return &festival, nil
}

// GetBySlug retrieves a festival by slug with caching
func (s *CachedService) GetBySlug(ctx context.Context, slug string) (*Festival, error) {
	key := s.keys.FestivalSlugKey(slug)

	var festival Festival
	err := s.cache.GetOrSetJSON(ctx, key, &festival, cache.FestivalTTL, func() (interface{}, error) {
		log.Debug().Str("slug", slug).Msg("fetching festival from database")
		return s.service.GetBySlug(ctx, slug)
	})

	if err != nil {
		return nil, err
	}

	return &festival, nil
}

// List retrieves a paginated list of festivals with caching
func (s *CachedService) List(ctx context.Context, page, perPage int) ([]Festival, int64, error) {
	// Normalize pagination params for consistent caching
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	key := s.keys.FestivalListKey(page, perPage)

	// Use a wrapper struct for the list response
	type listResponse struct {
		Festivals []Festival `json:"festivals"`
		Total     int64      `json:"total"`
	}

	var response listResponse
	err := s.cache.GetOrSetJSON(ctx, key, &response, cache.ShortTTL, func() (interface{}, error) {
		log.Debug().Int("page", page).Int("perPage", perPage).Msg("fetching festival list from database")
		festivals, total, err := s.service.List(ctx, page, perPage)
		if err != nil {
			return nil, err
		}
		return listResponse{Festivals: festivals, Total: total}, nil
	})

	if err != nil {
		return nil, 0, err
	}

	return response.Festivals, response.Total, nil
}

// Update updates a festival and invalidates related caches
func (s *CachedService) Update(ctx context.Context, id uuid.UUID, req UpdateFestivalRequest) (*Festival, error) {
	// Get the current festival to know the old slug
	oldFestival, err := s.service.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	festival, err := s.service.Update(ctx, id, req)
	if err != nil {
		return nil, err
	}

	// Invalidate caches
	if err := s.invalidateItem(ctx, festival, oldFestival); err != nil {
		log.Warn().Err(err).Str("festivalID", id.String()).Msg("failed to invalidate festival cache after update")
	}

	// Re-cache the updated festival
	if err := s.cacheItem(ctx, festival); err != nil {
		log.Warn().Err(err).Str("festivalID", id.String()).Msg("failed to cache updated festival")
	}

	return festival, nil
}

// Delete deletes a festival and invalidates related caches
func (s *CachedService) Delete(ctx context.Context, id uuid.UUID) error {
	// Get festival first for cache invalidation
	festival, err := s.service.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if err := s.service.Delete(ctx, id); err != nil {
		return err
	}

	// Invalidate all caches related to this festival
	if err := s.invalidateItem(ctx, festival, nil); err != nil {
		log.Warn().Err(err).Str("festivalID", id.String()).Msg("failed to invalidate festival cache after delete")
	}

	// Invalidate list cache
	if err := s.invalidateListCache(ctx); err != nil {
		log.Warn().Err(err).Msg("failed to invalidate festival list cache after delete")
	}

	return nil
}

// Activate activates a festival
func (s *CachedService) Activate(ctx context.Context, id uuid.UUID) (*Festival, error) {
	festival, err := s.service.Activate(ctx, id)
	if err != nil {
		return nil, err
	}

	// Invalidate and re-cache
	if err := s.invalidateItem(ctx, festival, nil); err != nil {
		log.Warn().Err(err).Str("festivalID", id.String()).Msg("failed to invalidate festival cache after activate")
	}

	if err := s.cacheItem(ctx, festival); err != nil {
		log.Warn().Err(err).Str("festivalID", id.String()).Msg("failed to cache activated festival")
	}

	return festival, nil
}

// Archive archives a festival
func (s *CachedService) Archive(ctx context.Context, id uuid.UUID) (*Festival, error) {
	festival, err := s.service.Archive(ctx, id)
	if err != nil {
		return nil, err
	}

	// Invalidate and re-cache
	if err := s.invalidateItem(ctx, festival, nil); err != nil {
		log.Warn().Err(err).Str("festivalID", id.String()).Msg("failed to invalidate festival cache after archive")
	}

	if err := s.cacheItem(ctx, festival); err != nil {
		log.Warn().Err(err).Str("festivalID", id.String()).Msg("failed to cache archived festival")
	}

	return festival, nil
}

// cacheItem caches a festival by both ID and slug
func (s *CachedService) cacheItem(ctx context.Context, festival *Festival) error {
	// Cache by ID
	idKey := s.keys.FestivalKey(festival.ID)
	if err := s.cache.SetJSON(ctx, idKey, festival, cache.FestivalTTL); err != nil {
		return err
	}

	// Cache by slug
	slugKey := s.keys.FestivalSlugKey(festival.Slug)
	if err := s.cache.SetJSON(ctx, slugKey, festival, cache.FestivalTTL); err != nil {
		return err
	}

	return nil
}

// invalidateItem invalidates cache entries for a festival
func (s *CachedService) invalidateItem(ctx context.Context, festival *Festival, oldFestival *Festival) error {
	keysToDelete := []string{
		s.keys.FestivalKey(festival.ID),
		s.keys.FestivalSlugKey(festival.Slug),
	}

	// If slug changed, also invalidate old slug
	if oldFestival != nil && oldFestival.Slug != festival.Slug {
		keysToDelete = append(keysToDelete, s.keys.FestivalSlugKey(oldFestival.Slug))
	}

	if s.invalidator != nil {
		return s.invalidator.Delete(ctx, keysToDelete...)
	}

	return s.cache.Delete(ctx, keysToDelete...)
}

// invalidateListCache invalidates the festival list cache
func (s *CachedService) invalidateListCache(ctx context.Context) error {
	pattern := s.keys.base(cache.PrefixFestival, "list", "*")

	if s.invalidator != nil {
		return s.invalidator.InvalidatePattern(ctx, pattern)
	}

	// Fallback: just delete common pagination keys
	commonKeys := make([]string, 0, 10)
	for page := 1; page <= 5; page++ {
		for _, perPage := range []int{10, 20, 50, 100} {
			commonKeys = append(commonKeys, s.keys.FestivalListKey(page, perPage))
		}
	}

	return s.cache.Delete(ctx, commonKeys...)
}

// base is a helper to access the key builder's base method
func (k *cache.KeyBuilder) base(parts ...string) string {
	// Use a key that we know will produce the right prefix
	// This is a workaround since base is not exported
	return cache.DefaultKeyBuilder.FestivalKey(uuid.Nil)[:len("festivals:v1")] + ":" + joinParts(parts...)
}

func joinParts(parts ...string) string {
	result := ""
	for i, part := range parts {
		if i > 0 {
			result += ":"
		}
		result += part
	}
	return result
}
