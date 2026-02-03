package festivalmap

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository defines the interface for map data operations
type Repository interface {
	// MapConfig operations
	GetConfig(ctx context.Context, festivalID uuid.UUID) (*MapConfig, error)
	CreateConfig(ctx context.Context, config *MapConfig) error
	UpdateConfig(ctx context.Context, config *MapConfig) error
	DeleteConfig(ctx context.Context, festivalID uuid.UUID) error

	// POI operations
	CreatePOI(ctx context.Context, poi *POI) error
	GetPOIByID(ctx context.Context, id uuid.UUID) (*POI, error)
	ListPOIs(ctx context.Context, festivalID uuid.UUID, filters POIFilters) ([]POI, error)
	UpdatePOI(ctx context.Context, poi *POI) error
	DeletePOI(ctx context.Context, id uuid.UUID) error
	CountPOIs(ctx context.Context, festivalID uuid.UUID) (int64, error)
	GetPOIsByType(ctx context.Context, festivalID uuid.UUID, poiType POIType) ([]POI, error)
	GetPOIsByZone(ctx context.Context, zoneID uuid.UUID) ([]POI, error)
	BulkCreatePOIs(ctx context.Context, pois []POI) error
	BulkDeletePOIs(ctx context.Context, ids []uuid.UUID) error

	// Zone operations
	CreateZone(ctx context.Context, zone *Zone) error
	GetZoneByID(ctx context.Context, id uuid.UUID) (*Zone, error)
	ListZones(ctx context.Context, festivalID uuid.UUID, filters ZoneFilters) ([]Zone, error)
	UpdateZone(ctx context.Context, zone *Zone) error
	DeleteZone(ctx context.Context, id uuid.UUID) error
	CountZones(ctx context.Context, festivalID uuid.UUID) (int64, error)
	GetZonesByType(ctx context.Context, festivalID uuid.UUID, zoneType ZoneType) ([]Zone, error)
}

// POIFilters defines filtering options for POI queries
type POIFilters struct {
	Type         *POIType
	Status       *POIStatus
	ZoneID       *uuid.UUID
	IsAccessible *bool
	IsFeatured   *bool
	Search       string
}

// ZoneFilters defines filtering options for Zone queries
type ZoneFilters struct {
	Type         *ZoneType
	IsRestricted *bool
	IsVisible    *bool
	Search       string
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new map repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// =====================
// MapConfig Operations
// =====================

func (r *repository) GetConfig(ctx context.Context, festivalID uuid.UUID) (*MapConfig, error) {
	var config MapConfig
	err := r.db.WithContext(ctx).Where("festival_id = ?", festivalID).First(&config).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get map config: %w", err)
	}
	return &config, nil
}

func (r *repository) CreateConfig(ctx context.Context, config *MapConfig) error {
	return r.db.WithContext(ctx).Create(config).Error
}

func (r *repository) UpdateConfig(ctx context.Context, config *MapConfig) error {
	return r.db.WithContext(ctx).Save(config).Error
}

func (r *repository) DeleteConfig(ctx context.Context, festivalID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("festival_id = ?", festivalID).Delete(&MapConfig{}).Error
}

// =====================
// POI Operations
// =====================

func (r *repository) CreatePOI(ctx context.Context, poi *POI) error {
	return r.db.WithContext(ctx).Create(poi).Error
}

func (r *repository) GetPOIByID(ctx context.Context, id uuid.UUID) (*POI, error) {
	var poi POI
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&poi).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get POI: %w", err)
	}
	return &poi, nil
}

func (r *repository) ListPOIs(ctx context.Context, festivalID uuid.UUID, filters POIFilters) ([]POI, error) {
	var pois []POI
	query := r.db.WithContext(ctx).Where("festival_id = ?", festivalID)

	if filters.Type != nil {
		query = query.Where("type = ?", *filters.Type)
	}
	if filters.Status != nil {
		query = query.Where("status = ?", *filters.Status)
	}
	if filters.ZoneID != nil {
		query = query.Where("zone_id = ?", *filters.ZoneID)
	}
	if filters.IsAccessible != nil {
		query = query.Where("is_accessible = ?", *filters.IsAccessible)
	}
	if filters.IsFeatured != nil {
		query = query.Where("is_featured = ?", *filters.IsFeatured)
	}
	if filters.Search != "" {
		searchTerm := "%" + filters.Search + "%"
		query = query.Where("name ILIKE ? OR description ILIKE ?", searchTerm, searchTerm)
	}

	err := query.Order("sort_order ASC, name ASC").Find(&pois).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list POIs: %w", err)
	}

	return pois, nil
}

func (r *repository) UpdatePOI(ctx context.Context, poi *POI) error {
	return r.db.WithContext(ctx).Save(poi).Error
}

func (r *repository) DeletePOI(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&POI{}).Error
}

func (r *repository) CountPOIs(ctx context.Context, festivalID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&POI{}).Where("festival_id = ?", festivalID).Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("failed to count POIs: %w", err)
	}
	return count, nil
}

func (r *repository) GetPOIsByType(ctx context.Context, festivalID uuid.UUID, poiType POIType) ([]POI, error) {
	var pois []POI
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND type = ?", festivalID, poiType).
		Order("sort_order ASC, name ASC").
		Find(&pois).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get POIs by type: %w", err)
	}
	return pois, nil
}

func (r *repository) GetPOIsByZone(ctx context.Context, zoneID uuid.UUID) ([]POI, error) {
	var pois []POI
	err := r.db.WithContext(ctx).
		Where("zone_id = ?", zoneID).
		Order("sort_order ASC, name ASC").
		Find(&pois).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get POIs by zone: %w", err)
	}
	return pois, nil
}

func (r *repository) BulkCreatePOIs(ctx context.Context, pois []POI) error {
	if len(pois) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).CreateInBatches(pois, 100).Error
}

func (r *repository) BulkDeletePOIs(ctx context.Context, ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Where("id IN ?", ids).Delete(&POI{}).Error
}

// =====================
// Zone Operations
// =====================

func (r *repository) CreateZone(ctx context.Context, zone *Zone) error {
	return r.db.WithContext(ctx).Create(zone).Error
}

func (r *repository) GetZoneByID(ctx context.Context, id uuid.UUID) (*Zone, error) {
	var zone Zone
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&zone).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get zone: %w", err)
	}
	return &zone, nil
}

func (r *repository) ListZones(ctx context.Context, festivalID uuid.UUID, filters ZoneFilters) ([]Zone, error) {
	var zones []Zone
	query := r.db.WithContext(ctx).Where("festival_id = ?", festivalID)

	if filters.Type != nil {
		query = query.Where("type = ?", *filters.Type)
	}
	if filters.IsRestricted != nil {
		query = query.Where("is_restricted = ?", *filters.IsRestricted)
	}
	if filters.IsVisible != nil {
		query = query.Where("is_visible = ?", *filters.IsVisible)
	}
	if filters.Search != "" {
		searchTerm := "%" + filters.Search + "%"
		query = query.Where("name ILIKE ? OR description ILIKE ?", searchTerm, searchTerm)
	}

	err := query.Order("sort_order ASC, name ASC").Find(&zones).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list zones: %w", err)
	}

	return zones, nil
}

func (r *repository) UpdateZone(ctx context.Context, zone *Zone) error {
	return r.db.WithContext(ctx).Save(zone).Error
}

func (r *repository) DeleteZone(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&Zone{}).Error
}

func (r *repository) CountZones(ctx context.Context, festivalID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&Zone{}).Where("festival_id = ?", festivalID).Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("failed to count zones: %w", err)
	}
	return count, nil
}

func (r *repository) GetZonesByType(ctx context.Context, festivalID uuid.UUID, zoneType ZoneType) ([]Zone, error) {
	var zones []Zone
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND type = ?", festivalID, zoneType).
		Order("sort_order ASC, name ASC").
		Find(&zones).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get zones by type: %w", err)
	}
	return zones, nil
}
