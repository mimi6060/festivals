package festivalmap

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

// Service handles map business logic
type Service struct {
	repo Repository
}

// NewService creates a new map service
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// =====================
// MapConfig Operations
// =====================

// GetConfig retrieves the map configuration for a festival
func (s *Service) GetConfig(ctx context.Context, festivalID uuid.UUID) (*MapConfig, error) {
	config, err := s.repo.GetConfig(ctx, festivalID)
	if err != nil {
		return nil, err
	}
	if config == nil {
		return nil, errors.ErrNotFound
	}
	return config, nil
}

// CreateOrUpdateConfig creates or updates map configuration for a festival
func (s *Service) CreateOrUpdateConfig(ctx context.Context, festivalID uuid.UUID, req CreateMapConfigRequest) (*MapConfig, error) {
	existing, err := s.repo.GetConfig(ctx, festivalID)
	if err != nil {
		return nil, err
	}

	if existing != nil {
		// Update existing config
		existing.CenterLat = req.CenterLat
		existing.CenterLng = req.CenterLng
		if req.DefaultZoom != 0 {
			existing.DefaultZoom = req.DefaultZoom
		}
		if req.MinZoom != 0 {
			existing.MinZoom = req.MinZoom
		}
		if req.MaxZoom != 0 {
			existing.MaxZoom = req.MaxZoom
		}
		existing.BoundsNorthLat = req.BoundsNorthLat
		existing.BoundsSouthLat = req.BoundsSouthLat
		existing.BoundsEastLng = req.BoundsEastLng
		existing.BoundsWestLng = req.BoundsWestLng
		if req.StyleURL != "" {
			existing.StyleURL = req.StyleURL
		}
		if req.Settings != nil {
			existing.Settings = *req.Settings
		}
		existing.UpdatedAt = time.Now()

		if err := s.repo.UpdateConfig(ctx, existing); err != nil {
			return nil, fmt.Errorf("failed to update map config: %w", err)
		}
		return existing, nil
	}

	// Create new config
	config := &MapConfig{
		ID:             uuid.New(),
		FestivalID:     festivalID,
		CenterLat:      req.CenterLat,
		CenterLng:      req.CenterLng,
		DefaultZoom:    req.DefaultZoom,
		MinZoom:        req.MinZoom,
		MaxZoom:        req.MaxZoom,
		BoundsNorthLat: req.BoundsNorthLat,
		BoundsSouthLat: req.BoundsSouthLat,
		BoundsEastLng:  req.BoundsEastLng,
		BoundsWestLng:  req.BoundsWestLng,
		StyleURL:       req.StyleURL,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	// Set defaults
	if config.DefaultZoom == 0 {
		config.DefaultZoom = 16
	}
	if config.MinZoom == 0 {
		config.MinZoom = 14
	}
	if config.MaxZoom == 0 {
		config.MaxZoom = 20
	}
	if config.StyleURL == "" {
		config.StyleURL = "mapbox://styles/mapbox/streets-v12"
	}
	if req.Settings != nil {
		config.Settings = *req.Settings
	}

	if err := s.repo.CreateConfig(ctx, config); err != nil {
		return nil, fmt.Errorf("failed to create map config: %w", err)
	}

	return config, nil
}

// UpdateConfig updates map configuration for a festival
func (s *Service) UpdateConfig(ctx context.Context, festivalID uuid.UUID, req UpdateMapConfigRequest) (*MapConfig, error) {
	config, err := s.repo.GetConfig(ctx, festivalID)
	if err != nil {
		return nil, err
	}
	if config == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.CenterLat != nil {
		config.CenterLat = *req.CenterLat
	}
	if req.CenterLng != nil {
		config.CenterLng = *req.CenterLng
	}
	if req.DefaultZoom != nil {
		config.DefaultZoom = *req.DefaultZoom
	}
	if req.MinZoom != nil {
		config.MinZoom = *req.MinZoom
	}
	if req.MaxZoom != nil {
		config.MaxZoom = *req.MaxZoom
	}
	if req.BoundsNorthLat != nil {
		config.BoundsNorthLat = *req.BoundsNorthLat
	}
	if req.BoundsSouthLat != nil {
		config.BoundsSouthLat = *req.BoundsSouthLat
	}
	if req.BoundsEastLng != nil {
		config.BoundsEastLng = *req.BoundsEastLng
	}
	if req.BoundsWestLng != nil {
		config.BoundsWestLng = *req.BoundsWestLng
	}
	if req.StyleURL != nil {
		config.StyleURL = *req.StyleURL
	}
	if req.Settings != nil {
		config.Settings = *req.Settings
	}

	config.UpdatedAt = time.Now()

	if err := s.repo.UpdateConfig(ctx, config); err != nil {
		return nil, fmt.Errorf("failed to update map config: %w", err)
	}

	return config, nil
}

// =====================
// POI Operations
// =====================

// CreatePOI creates a new Point of Interest
func (s *Service) CreatePOI(ctx context.Context, festivalID uuid.UUID, req CreatePOIRequest) (*POI, error) {
	poi := &POI{
		ID:           uuid.New(),
		FestivalID:   festivalID,
		Name:         req.Name,
		Description:  req.Description,
		Type:         req.Type,
		Status:       POIStatusActive,
		Latitude:     req.Latitude,
		Longitude:    req.Longitude,
		IconURL:      req.IconURL,
		ImageURL:     req.ImageURL,
		Color:        req.Color,
		StandID:      req.StandID,
		StageID:      req.StageID,
		ZoneID:       req.ZoneID,
		OpeningHours: req.OpeningHours,
		Capacity:     req.Capacity,
		IsAccessible: req.IsAccessible,
		IsFeatured:   req.IsFeatured,
		SortOrder:    req.SortOrder,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if req.Metadata != nil {
		poi.Metadata = *req.Metadata
	}

	// Set default color based on type if not provided
	if poi.Color == "" {
		poi.Color = s.getDefaultColorForType(req.Type)
	}

	if err := s.repo.CreatePOI(ctx, poi); err != nil {
		return nil, fmt.Errorf("failed to create POI: %w", err)
	}

	return poi, nil
}

// GetPOIByID retrieves a POI by its ID
func (s *Service) GetPOIByID(ctx context.Context, id uuid.UUID) (*POI, error) {
	poi, err := s.repo.GetPOIByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if poi == nil {
		return nil, errors.ErrNotFound
	}
	return poi, nil
}

// ListPOIs retrieves all POIs for a festival with optional filters
func (s *Service) ListPOIs(ctx context.Context, festivalID uuid.UUID, filters POIFilters) ([]POI, error) {
	return s.repo.ListPOIs(ctx, festivalID, filters)
}

// UpdatePOI updates an existing POI
func (s *Service) UpdatePOI(ctx context.Context, id uuid.UUID, req UpdatePOIRequest) (*POI, error) {
	poi, err := s.repo.GetPOIByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if poi == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.Name != nil {
		poi.Name = *req.Name
	}
	if req.Description != nil {
		poi.Description = *req.Description
	}
	if req.Type != nil {
		poi.Type = *req.Type
	}
	if req.Status != nil {
		poi.Status = *req.Status
	}
	if req.Latitude != nil {
		poi.Latitude = *req.Latitude
	}
	if req.Longitude != nil {
		poi.Longitude = *req.Longitude
	}
	if req.IconURL != nil {
		poi.IconURL = *req.IconURL
	}
	if req.ImageURL != nil {
		poi.ImageURL = *req.ImageURL
	}
	if req.Color != nil {
		poi.Color = *req.Color
	}
	if req.StandID != nil {
		poi.StandID = req.StandID
	}
	if req.StageID != nil {
		poi.StageID = req.StageID
	}
	if req.ZoneID != nil {
		poi.ZoneID = req.ZoneID
	}
	if req.OpeningHours != nil {
		poi.OpeningHours = *req.OpeningHours
	}
	if req.Capacity != nil {
		poi.Capacity = req.Capacity
	}
	if req.IsAccessible != nil {
		poi.IsAccessible = *req.IsAccessible
	}
	if req.IsFeatured != nil {
		poi.IsFeatured = *req.IsFeatured
	}
	if req.SortOrder != nil {
		poi.SortOrder = *req.SortOrder
	}
	if req.Metadata != nil {
		poi.Metadata = *req.Metadata
	}

	poi.UpdatedAt = time.Now()

	if err := s.repo.UpdatePOI(ctx, poi); err != nil {
		return nil, fmt.Errorf("failed to update POI: %w", err)
	}

	return poi, nil
}

// DeletePOI deletes a POI
func (s *Service) DeletePOI(ctx context.Context, id uuid.UUID) error {
	poi, err := s.repo.GetPOIByID(ctx, id)
	if err != nil {
		return err
	}
	if poi == nil {
		return errors.ErrNotFound
	}

	return s.repo.DeletePOI(ctx, id)
}

// GetPOIsByType retrieves all POIs of a specific type for a festival
func (s *Service) GetPOIsByType(ctx context.Context, festivalID uuid.UUID, poiType POIType) ([]POI, error) {
	return s.repo.GetPOIsByType(ctx, festivalID, poiType)
}

// BulkCreatePOIs creates multiple POIs at once
func (s *Service) BulkCreatePOIs(ctx context.Context, festivalID uuid.UUID, requests []CreatePOIRequest) ([]POI, error) {
	pois := make([]POI, len(requests))
	now := time.Now()

	for i, req := range requests {
		poi := POI{
			ID:           uuid.New(),
			FestivalID:   festivalID,
			Name:         req.Name,
			Description:  req.Description,
			Type:         req.Type,
			Status:       POIStatusActive,
			Latitude:     req.Latitude,
			Longitude:    req.Longitude,
			IconURL:      req.IconURL,
			ImageURL:     req.ImageURL,
			Color:        req.Color,
			StandID:      req.StandID,
			StageID:      req.StageID,
			ZoneID:       req.ZoneID,
			OpeningHours: req.OpeningHours,
			Capacity:     req.Capacity,
			IsAccessible: req.IsAccessible,
			IsFeatured:   req.IsFeatured,
			SortOrder:    req.SortOrder,
			CreatedAt:    now,
			UpdatedAt:    now,
		}

		if req.Metadata != nil {
			poi.Metadata = *req.Metadata
		}

		if poi.Color == "" {
			poi.Color = s.getDefaultColorForType(req.Type)
		}

		pois[i] = poi
	}

	if err := s.repo.BulkCreatePOIs(ctx, pois); err != nil {
		return nil, fmt.Errorf("failed to bulk create POIs: %w", err)
	}

	return pois, nil
}

// =====================
// Zone Operations
// =====================

// CreateZone creates a new zone
func (s *Service) CreateZone(ctx context.Context, festivalID uuid.UUID, req CreateZoneRequest) (*Zone, error) {
	zone := &Zone{
		ID:           uuid.New(),
		FestivalID:   festivalID,
		Name:         req.Name,
		Description:  req.Description,
		Type:         req.Type,
		Color:        req.Color,
		FillColor:    req.FillColor,
		FillOpacity:  req.FillOpacity,
		BorderColor:  req.BorderColor,
		BorderWidth:  req.BorderWidth,
		Coordinates:  req.Coordinates,
		CenterLat:    req.CenterLat,
		CenterLng:    req.CenterLng,
		Capacity:     req.Capacity,
		IsRestricted: req.IsRestricted,
		RequiresPass: req.RequiresPass,
		IsVisible:    req.IsVisible,
		SortOrder:    req.SortOrder,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if req.Metadata != nil {
		zone.Metadata = *req.Metadata
	}

	// Set defaults
	if zone.Color == "" {
		zone.Color = "#6366F1"
	}
	if zone.FillColor == "" {
		zone.FillColor = zone.Color + "40" // 25% opacity
	}
	if zone.BorderColor == "" {
		zone.BorderColor = zone.Color
	}
	if zone.FillOpacity == 0 {
		zone.FillOpacity = 0.3
	}
	if zone.BorderWidth == 0 {
		zone.BorderWidth = 2
	}

	// Calculate center if not provided
	if zone.CenterLat == 0 && zone.CenterLng == 0 && len(zone.Coordinates) > 0 {
		zone.CenterLat, zone.CenterLng = s.calculatePolygonCenter(zone.Coordinates)
	}

	if err := s.repo.CreateZone(ctx, zone); err != nil {
		return nil, fmt.Errorf("failed to create zone: %w", err)
	}

	return zone, nil
}

// GetZoneByID retrieves a zone by its ID
func (s *Service) GetZoneByID(ctx context.Context, id uuid.UUID) (*Zone, error) {
	zone, err := s.repo.GetZoneByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if zone == nil {
		return nil, errors.ErrNotFound
	}
	return zone, nil
}

// ListZones retrieves all zones for a festival with optional filters
func (s *Service) ListZones(ctx context.Context, festivalID uuid.UUID, filters ZoneFilters) ([]Zone, error) {
	return s.repo.ListZones(ctx, festivalID, filters)
}

// UpdateZone updates an existing zone
func (s *Service) UpdateZone(ctx context.Context, id uuid.UUID, req UpdateZoneRequest) (*Zone, error) {
	zone, err := s.repo.GetZoneByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if zone == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.Name != nil {
		zone.Name = *req.Name
	}
	if req.Description != nil {
		zone.Description = *req.Description
	}
	if req.Type != nil {
		zone.Type = *req.Type
	}
	if req.Color != nil {
		zone.Color = *req.Color
	}
	if req.FillColor != nil {
		zone.FillColor = *req.FillColor
	}
	if req.FillOpacity != nil {
		zone.FillOpacity = *req.FillOpacity
	}
	if req.BorderColor != nil {
		zone.BorderColor = *req.BorderColor
	}
	if req.BorderWidth != nil {
		zone.BorderWidth = *req.BorderWidth
	}
	if len(req.Coordinates) > 0 {
		zone.Coordinates = req.Coordinates
		// Recalculate center
		zone.CenterLat, zone.CenterLng = s.calculatePolygonCenter(req.Coordinates)
	}
	if req.CenterLat != nil {
		zone.CenterLat = *req.CenterLat
	}
	if req.CenterLng != nil {
		zone.CenterLng = *req.CenterLng
	}
	if req.Capacity != nil {
		zone.Capacity = req.Capacity
	}
	if req.IsRestricted != nil {
		zone.IsRestricted = *req.IsRestricted
	}
	if req.RequiresPass != nil {
		zone.RequiresPass = *req.RequiresPass
	}
	if req.IsVisible != nil {
		zone.IsVisible = *req.IsVisible
	}
	if req.SortOrder != nil {
		zone.SortOrder = *req.SortOrder
	}
	if req.Metadata != nil {
		zone.Metadata = *req.Metadata
	}

	zone.UpdatedAt = time.Now()

	if err := s.repo.UpdateZone(ctx, zone); err != nil {
		return nil, fmt.Errorf("failed to update zone: %w", err)
	}

	return zone, nil
}

// DeleteZone deletes a zone
func (s *Service) DeleteZone(ctx context.Context, id uuid.UUID) error {
	zone, err := s.repo.GetZoneByID(ctx, id)
	if err != nil {
		return err
	}
	if zone == nil {
		return errors.ErrNotFound
	}

	return s.repo.DeleteZone(ctx, id)
}

// GetZonesByType retrieves all zones of a specific type for a festival
func (s *Service) GetZonesByType(ctx context.Context, festivalID uuid.UUID, zoneType ZoneType) ([]Zone, error) {
	return s.repo.GetZonesByType(ctx, festivalID, zoneType)
}

// =====================
// Full Map Data
// =====================

// GetFullMapData retrieves complete map data for a festival
func (s *Service) GetFullMapData(ctx context.Context, festivalID uuid.UUID) (*FullMapResponse, error) {
	// Get config (optional - might not exist)
	config, _ := s.repo.GetConfig(ctx, festivalID)

	// Get all POIs
	pois, err := s.repo.ListPOIs(ctx, festivalID, POIFilters{})
	if err != nil {
		return nil, err
	}

	// Get all visible zones
	visible := true
	zones, err := s.repo.ListZones(ctx, festivalID, ZoneFilters{IsVisible: &visible})
	if err != nil {
		return nil, err
	}

	// Build response
	resp := &FullMapResponse{
		POIs:  make([]POIResponse, len(pois)),
		Zones: make([]ZoneResponse, len(zones)),
	}

	if config != nil {
		configResp := config.ToResponse()
		resp.Config = &configResp
	}

	for i, poi := range pois {
		resp.POIs[i] = poi.ToResponse()
	}

	for i, zone := range zones {
		resp.Zones[i] = zone.ToResponse()
	}

	return resp, nil
}

// =====================
// Helper Methods
// =====================

func (s *Service) getDefaultColorForType(poiType POIType) string {
	colorMap := map[POIType]string{
		POITypeStage:         "#8B5CF6", // Purple
		POITypeBar:           "#EAB308", // Yellow
		POITypeFood:          "#F97316", // Orange
		POITypeToilet:        "#3B82F6", // Blue
		POITypeFirstAid:      "#EF4444", // Red
		POITypeEntrance:      "#22C55E", // Green
		POITypeExit:          "#22C55E", // Green
		POITypeCharging:      "#84CC16", // Lime
		POITypeCamping:       "#14B8A6", // Teal
		POITypeVIP:           "#A855F7", // Purple
		POITypeInfo:          "#06B6D4", // Cyan
		POITypeATM:           "#0EA5E9", // Sky
		POITypeParking:       "#6B7280", // Gray
		POITypeMerch:         "#EC4899", // Pink
		POITypeSecurity:      "#F59E0B", // Amber
		POITypeWater:         "#3B82F6", // Blue
		POITypeSmoking:       "#78716C", // Stone
		POITypeLockers:       "#6366F1", // Indigo
		POITypeLostFound:     "#8B5CF6", // Violet
		POITypeAccessibility: "#6366F1", // Indigo
		POITypeOther:         "#9CA3AF", // Gray
	}

	if color, ok := colorMap[poiType]; ok {
		return color
	}
	return "#6366F1" // Default indigo
}

func (s *Service) calculatePolygonCenter(coords []Coordinate) (float64, float64) {
	if len(coords) == 0 {
		return 0, 0
	}

	var sumLat, sumLng float64
	for _, coord := range coords {
		sumLat += coord.Latitude
		sumLng += coord.Longitude
	}

	return sumLat / float64(len(coords)), sumLng / float64(len(coords))
}
