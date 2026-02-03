package festivalmap

import (
	"time"

	"github.com/google/uuid"
)

// POIType represents the type of Point of Interest
type POIType string

const (
	POITypeStage         POIType = "STAGE"
	POITypeBar           POIType = "BAR"
	POITypeFood          POIType = "FOOD"
	POITypeToilet        POIType = "TOILET"
	POITypeFirstAid      POIType = "FIRST_AID"
	POITypeEntrance      POIType = "ENTRANCE"
	POITypeExit          POIType = "EXIT"
	POITypeCharging      POIType = "CHARGING"
	POITypeCamping       POIType = "CAMPING"
	POITypeVIP           POIType = "VIP"
	POITypeInfo          POIType = "INFO"
	POITypeATM           POIType = "ATM"
	POITypeParking       POIType = "PARKING"
	POITypeMerch         POIType = "MERCH"
	POITypeSecurity      POIType = "SECURITY"
	POITypeWater         POIType = "WATER"
	POITypeSmoking       POIType = "SMOKING"
	POITypeLockers       POIType = "LOCKERS"
	POITypeLostFound     POIType = "LOST_FOUND"
	POITypeAccessibility POIType = "ACCESSIBILITY"
	POITypeOther         POIType = "OTHER"
)

// POIStatus represents the status of a POI
type POIStatus string

const (
	POIStatusActive   POIStatus = "ACTIVE"
	POIStatusInactive POIStatus = "INACTIVE"
	POIStatusClosed   POIStatus = "CLOSED"
	POIStatusBusy     POIStatus = "BUSY"
)

// ZoneType represents the type of zone
type ZoneType string

const (
	ZoneTypeGeneral    ZoneType = "GENERAL"
	ZoneTypeVIP        ZoneType = "VIP"
	ZoneTypeCamping    ZoneType = "CAMPING"
	ZoneTypeParking    ZoneType = "PARKING"
	ZoneTypeBackstage  ZoneType = "BACKSTAGE"
	ZoneTypeRestricted ZoneType = "RESTRICTED"
	ZoneTypeFood       ZoneType = "FOOD"
	ZoneTypeStage      ZoneType = "STAGE"
)

// Coordinate represents a geographic coordinate
type Coordinate struct {
	Latitude  float64 `json:"latitude" gorm:"type:decimal(10,8)"`
	Longitude float64 `json:"longitude" gorm:"type:decimal(11,8)"`
}

// MapConfig represents the map configuration for a festival
type MapConfig struct {
	ID            uuid.UUID     `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID    uuid.UUID     `json:"festivalId" gorm:"type:uuid;not null;uniqueIndex"`
	CenterLat     float64       `json:"centerLat" gorm:"type:decimal(10,8);not null"`
	CenterLng     float64       `json:"centerLng" gorm:"type:decimal(11,8);not null"`
	DefaultZoom   float64       `json:"defaultZoom" gorm:"type:decimal(4,2);default:16"`
	MinZoom       float64       `json:"minZoom" gorm:"type:decimal(4,2);default:14"`
	MaxZoom       float64       `json:"maxZoom" gorm:"type:decimal(4,2);default:20"`
	BoundsNorthLat float64      `json:"boundsNorthLat" gorm:"type:decimal(10,8)"`
	BoundsSouthLat float64      `json:"boundsSouthLat" gorm:"type:decimal(10,8)"`
	BoundsEastLng  float64      `json:"boundsEastLng" gorm:"type:decimal(11,8)"`
	BoundsWestLng  float64      `json:"boundsWestLng" gorm:"type:decimal(11,8)"`
	StyleURL      string        `json:"styleUrl" gorm:"default:'mapbox://styles/mapbox/streets-v12'"`
	Settings      MapSettings   `json:"settings" gorm:"type:jsonb;default:'{}'"`
	CreatedAt     time.Time     `json:"createdAt"`
	UpdatedAt     time.Time     `json:"updatedAt"`
}

func (MapConfig) TableName() string {
	return "map_configs"
}

// MapSettings holds additional map configuration
type MapSettings struct {
	ShowTraffic      bool   `json:"showTraffic"`
	Show3DBuildings  bool   `json:"show3dBuildings"`
	ShowSatellite    bool   `json:"showSatellite"`
	CustomTileURL    string `json:"customTileUrl,omitempty"`
	OverlayImageURL  string `json:"overlayImageUrl,omitempty"`
	OverlayOpacity   float64 `json:"overlayOpacity,omitempty"`
	EnableClustering bool   `json:"enableClustering"`
	ClusterRadius    int    `json:"clusterRadius"`
}

// POI represents a Point of Interest on the festival map
type POI struct {
	ID           uuid.UUID   `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID   uuid.UUID   `json:"festivalId" gorm:"type:uuid;not null;index"`
	Name         string      `json:"name" gorm:"not null"`
	Description  string      `json:"description"`
	Type         POIType     `json:"type" gorm:"not null;index"`
	Status       POIStatus   `json:"status" gorm:"default:'ACTIVE'"`
	Latitude     float64     `json:"latitude" gorm:"type:decimal(10,8);not null"`
	Longitude    float64     `json:"longitude" gorm:"type:decimal(11,8);not null"`
	IconURL      string      `json:"iconUrl,omitempty"`
	ImageURL     string      `json:"imageUrl,omitempty"`
	Color        string      `json:"color,omitempty"`
	StandID      *uuid.UUID  `json:"standId,omitempty" gorm:"type:uuid;index"`
	StageID      *uuid.UUID  `json:"stageId,omitempty" gorm:"type:uuid;index"`
	ZoneID       *uuid.UUID  `json:"zoneId,omitempty" gorm:"type:uuid;index"`
	OpeningHours string      `json:"openingHours,omitempty"`
	Capacity     *int        `json:"capacity,omitempty"`
	IsAccessible bool        `json:"isAccessible" gorm:"default:false"`
	IsFeatured   bool        `json:"isFeatured" gorm:"default:false"`
	SortOrder    int         `json:"sortOrder" gorm:"default:0"`
	Metadata     POIMetadata `json:"metadata" gorm:"type:jsonb;default:'{}'"`
	CreatedAt    time.Time   `json:"createdAt"`
	UpdatedAt    time.Time   `json:"updatedAt"`
}

func (POI) TableName() string {
	return "map_pois"
}

// POIMetadata holds additional POI data
type POIMetadata struct {
	PhoneNumber     string   `json:"phoneNumber,omitempty"`
	Website         string   `json:"website,omitempty"`
	Tags            []string `json:"tags,omitempty"`
	Amenities       []string `json:"amenities,omitempty"`
	WaitTime        *int     `json:"waitTime,omitempty"` // in minutes
	QueueLength     *int     `json:"queueLength,omitempty"`
	LastUpdated     string   `json:"lastUpdated,omitempty"`
	ExternalID      string   `json:"externalId,omitempty"`
	NavigationNotes string   `json:"navigationNotes,omitempty"`
}

// Zone represents a geographic zone on the festival map
type Zone struct {
	ID          uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID  uuid.UUID    `json:"festivalId" gorm:"type:uuid;not null;index"`
	Name        string       `json:"name" gorm:"not null"`
	Description string       `json:"description"`
	Type        ZoneType     `json:"type" gorm:"not null;index"`
	Color       string       `json:"color" gorm:"default:'#6366F1'"`
	FillColor   string       `json:"fillColor" gorm:"default:'#6366F180'"`
	FillOpacity float64      `json:"fillOpacity" gorm:"type:decimal(3,2);default:0.3"`
	BorderColor string       `json:"borderColor" gorm:"default:'#6366F1'"`
	BorderWidth float64      `json:"borderWidth" gorm:"type:decimal(3,1);default:2"`
	Coordinates []Coordinate `json:"coordinates" gorm:"type:jsonb"`
	CenterLat   float64      `json:"centerLat" gorm:"type:decimal(10,8)"`
	CenterLng   float64      `json:"centerLng" gorm:"type:decimal(11,8)"`
	Capacity    *int         `json:"capacity,omitempty"`
	IsRestricted bool        `json:"isRestricted" gorm:"default:false"`
	RequiresPass bool        `json:"requiresPass" gorm:"default:false"`
	IsVisible   bool         `json:"isVisible" gorm:"default:true"`
	SortOrder   int          `json:"sortOrder" gorm:"default:0"`
	Metadata    ZoneMetadata `json:"metadata" gorm:"type:jsonb;default:'{}'"`
	CreatedAt   time.Time    `json:"createdAt"`
	UpdatedAt   time.Time    `json:"updatedAt"`
}

func (Zone) TableName() string {
	return "map_zones"
}

// ZoneMetadata holds additional zone data
type ZoneMetadata struct {
	AccessRules     string   `json:"accessRules,omitempty"`
	AllowedTickets  []string `json:"allowedTickets,omitempty"`
	MaxOccupancy    *int     `json:"maxOccupancy,omitempty"`
	CurrentOccupancy *int    `json:"currentOccupancy,omitempty"`
	Features        []string `json:"features,omitempty"`
}

// =====================
// Request DTOs
// =====================

// CreateMapConfigRequest represents the request to create map configuration
type CreateMapConfigRequest struct {
	CenterLat     float64     `json:"centerLat" binding:"required"`
	CenterLng     float64     `json:"centerLng" binding:"required"`
	DefaultZoom   float64     `json:"defaultZoom"`
	MinZoom       float64     `json:"minZoom"`
	MaxZoom       float64     `json:"maxZoom"`
	BoundsNorthLat float64    `json:"boundsNorthLat"`
	BoundsSouthLat float64    `json:"boundsSouthLat"`
	BoundsEastLng  float64    `json:"boundsEastLng"`
	BoundsWestLng  float64    `json:"boundsWestLng"`
	StyleURL      string      `json:"styleUrl"`
	Settings      *MapSettings `json:"settings"`
}

// UpdateMapConfigRequest represents the request to update map configuration
type UpdateMapConfigRequest struct {
	CenterLat      *float64     `json:"centerLat,omitempty"`
	CenterLng      *float64     `json:"centerLng,omitempty"`
	DefaultZoom    *float64     `json:"defaultZoom,omitempty"`
	MinZoom        *float64     `json:"minZoom,omitempty"`
	MaxZoom        *float64     `json:"maxZoom,omitempty"`
	BoundsNorthLat *float64     `json:"boundsNorthLat,omitempty"`
	BoundsSouthLat *float64     `json:"boundsSouthLat,omitempty"`
	BoundsEastLng  *float64     `json:"boundsEastLng,omitempty"`
	BoundsWestLng  *float64     `json:"boundsWestLng,omitempty"`
	StyleURL       *string      `json:"styleUrl,omitempty"`
	Settings       *MapSettings `json:"settings,omitempty"`
}

// CreatePOIRequest represents the request to create a POI
type CreatePOIRequest struct {
	Name         string       `json:"name" binding:"required"`
	Description  string       `json:"description"`
	Type         POIType      `json:"type" binding:"required"`
	Latitude     float64      `json:"latitude" binding:"required"`
	Longitude    float64      `json:"longitude" binding:"required"`
	IconURL      string       `json:"iconUrl"`
	ImageURL     string       `json:"imageUrl"`
	Color        string       `json:"color"`
	StandID      *uuid.UUID   `json:"standId"`
	StageID      *uuid.UUID   `json:"stageId"`
	ZoneID       *uuid.UUID   `json:"zoneId"`
	OpeningHours string       `json:"openingHours"`
	Capacity     *int         `json:"capacity"`
	IsAccessible bool         `json:"isAccessible"`
	IsFeatured   bool         `json:"isFeatured"`
	SortOrder    int          `json:"sortOrder"`
	Metadata     *POIMetadata `json:"metadata"`
}

// UpdatePOIRequest represents the request to update a POI
type UpdatePOIRequest struct {
	Name         *string      `json:"name,omitempty"`
	Description  *string      `json:"description,omitempty"`
	Type         *POIType     `json:"type,omitempty"`
	Status       *POIStatus   `json:"status,omitempty"`
	Latitude     *float64     `json:"latitude,omitempty"`
	Longitude    *float64     `json:"longitude,omitempty"`
	IconURL      *string      `json:"iconUrl,omitempty"`
	ImageURL     *string      `json:"imageUrl,omitempty"`
	Color        *string      `json:"color,omitempty"`
	StandID      *uuid.UUID   `json:"standId,omitempty"`
	StageID      *uuid.UUID   `json:"stageId,omitempty"`
	ZoneID       *uuid.UUID   `json:"zoneId,omitempty"`
	OpeningHours *string      `json:"openingHours,omitempty"`
	Capacity     *int         `json:"capacity,omitempty"`
	IsAccessible *bool        `json:"isAccessible,omitempty"`
	IsFeatured   *bool        `json:"isFeatured,omitempty"`
	SortOrder    *int         `json:"sortOrder,omitempty"`
	Metadata     *POIMetadata `json:"metadata,omitempty"`
}

// CreateZoneRequest represents the request to create a zone
type CreateZoneRequest struct {
	Name         string       `json:"name" binding:"required"`
	Description  string       `json:"description"`
	Type         ZoneType     `json:"type" binding:"required"`
	Color        string       `json:"color"`
	FillColor    string       `json:"fillColor"`
	FillOpacity  float64      `json:"fillOpacity"`
	BorderColor  string       `json:"borderColor"`
	BorderWidth  float64      `json:"borderWidth"`
	Coordinates  []Coordinate `json:"coordinates" binding:"required"`
	CenterLat    float64      `json:"centerLat"`
	CenterLng    float64      `json:"centerLng"`
	Capacity     *int         `json:"capacity"`
	IsRestricted bool         `json:"isRestricted"`
	RequiresPass bool         `json:"requiresPass"`
	IsVisible    bool         `json:"isVisible"`
	SortOrder    int          `json:"sortOrder"`
	Metadata     *ZoneMetadata `json:"metadata"`
}

// UpdateZoneRequest represents the request to update a zone
type UpdateZoneRequest struct {
	Name         *string       `json:"name,omitempty"`
	Description  *string       `json:"description,omitempty"`
	Type         *ZoneType     `json:"type,omitempty"`
	Color        *string       `json:"color,omitempty"`
	FillColor    *string       `json:"fillColor,omitempty"`
	FillOpacity  *float64      `json:"fillOpacity,omitempty"`
	BorderColor  *string       `json:"borderColor,omitempty"`
	BorderWidth  *float64      `json:"borderWidth,omitempty"`
	Coordinates  []Coordinate  `json:"coordinates,omitempty"`
	CenterLat    *float64      `json:"centerLat,omitempty"`
	CenterLng    *float64      `json:"centerLng,omitempty"`
	Capacity     *int          `json:"capacity,omitempty"`
	IsRestricted *bool         `json:"isRestricted,omitempty"`
	RequiresPass *bool         `json:"requiresPass,omitempty"`
	IsVisible    *bool         `json:"isVisible,omitempty"`
	SortOrder    *int          `json:"sortOrder,omitempty"`
	Metadata     *ZoneMetadata `json:"metadata,omitempty"`
}

// =====================
// Response DTOs
// =====================

// MapConfigResponse represents the API response for map configuration
type MapConfigResponse struct {
	ID            uuid.UUID   `json:"id"`
	FestivalID    uuid.UUID   `json:"festivalId"`
	CenterLat     float64     `json:"centerLat"`
	CenterLng     float64     `json:"centerLng"`
	DefaultZoom   float64     `json:"defaultZoom"`
	MinZoom       float64     `json:"minZoom"`
	MaxZoom       float64     `json:"maxZoom"`
	Bounds        *BoundsResponse `json:"bounds,omitempty"`
	StyleURL      string      `json:"styleUrl"`
	Settings      MapSettings `json:"settings"`
	CreatedAt     string      `json:"createdAt"`
	UpdatedAt     string      `json:"updatedAt"`
}

// BoundsResponse represents map bounds
type BoundsResponse struct {
	NorthLat float64 `json:"northLat"`
	SouthLat float64 `json:"southLat"`
	EastLng  float64 `json:"eastLng"`
	WestLng  float64 `json:"westLng"`
}

func (m *MapConfig) ToResponse() MapConfigResponse {
	resp := MapConfigResponse{
		ID:          m.ID,
		FestivalID:  m.FestivalID,
		CenterLat:   m.CenterLat,
		CenterLng:   m.CenterLng,
		DefaultZoom: m.DefaultZoom,
		MinZoom:     m.MinZoom,
		MaxZoom:     m.MaxZoom,
		StyleURL:    m.StyleURL,
		Settings:    m.Settings,
		CreatedAt:   m.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   m.UpdatedAt.Format(time.RFC3339),
	}

	// Include bounds if set
	if m.BoundsNorthLat != 0 || m.BoundsSouthLat != 0 {
		resp.Bounds = &BoundsResponse{
			NorthLat: m.BoundsNorthLat,
			SouthLat: m.BoundsSouthLat,
			EastLng:  m.BoundsEastLng,
			WestLng:  m.BoundsWestLng,
		}
	}

	return resp
}

// POIResponse represents the API response for a POI
type POIResponse struct {
	ID           uuid.UUID   `json:"id"`
	FestivalID   uuid.UUID   `json:"festivalId"`
	Name         string      `json:"name"`
	Description  string      `json:"description"`
	Type         POIType     `json:"type"`
	Status       POIStatus   `json:"status"`
	Latitude     float64     `json:"latitude"`
	Longitude    float64     `json:"longitude"`
	IconURL      string      `json:"iconUrl,omitempty"`
	ImageURL     string      `json:"imageUrl,omitempty"`
	Color        string      `json:"color,omitempty"`
	StandID      *uuid.UUID  `json:"standId,omitempty"`
	StageID      *uuid.UUID  `json:"stageId,omitempty"`
	ZoneID       *uuid.UUID  `json:"zoneId,omitempty"`
	OpeningHours string      `json:"openingHours,omitempty"`
	Capacity     *int        `json:"capacity,omitempty"`
	IsAccessible bool        `json:"isAccessible"`
	IsFeatured   bool        `json:"isFeatured"`
	SortOrder    int         `json:"sortOrder"`
	Metadata     POIMetadata `json:"metadata"`
	CreatedAt    string      `json:"createdAt"`
	UpdatedAt    string      `json:"updatedAt"`
}

func (p *POI) ToResponse() POIResponse {
	return POIResponse{
		ID:           p.ID,
		FestivalID:   p.FestivalID,
		Name:         p.Name,
		Description:  p.Description,
		Type:         p.Type,
		Status:       p.Status,
		Latitude:     p.Latitude,
		Longitude:    p.Longitude,
		IconURL:      p.IconURL,
		ImageURL:     p.ImageURL,
		Color:        p.Color,
		StandID:      p.StandID,
		StageID:      p.StageID,
		ZoneID:       p.ZoneID,
		OpeningHours: p.OpeningHours,
		Capacity:     p.Capacity,
		IsAccessible: p.IsAccessible,
		IsFeatured:   p.IsFeatured,
		SortOrder:    p.SortOrder,
		Metadata:     p.Metadata,
		CreatedAt:    p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    p.UpdatedAt.Format(time.RFC3339),
	}
}

// ZoneResponse represents the API response for a zone
type ZoneResponse struct {
	ID           uuid.UUID    `json:"id"`
	FestivalID   uuid.UUID    `json:"festivalId"`
	Name         string       `json:"name"`
	Description  string       `json:"description"`
	Type         ZoneType     `json:"type"`
	Color        string       `json:"color"`
	FillColor    string       `json:"fillColor"`
	FillOpacity  float64      `json:"fillOpacity"`
	BorderColor  string       `json:"borderColor"`
	BorderWidth  float64      `json:"borderWidth"`
	Coordinates  []Coordinate `json:"coordinates"`
	CenterLat    float64      `json:"centerLat"`
	CenterLng    float64      `json:"centerLng"`
	Capacity     *int         `json:"capacity,omitempty"`
	IsRestricted bool         `json:"isRestricted"`
	RequiresPass bool         `json:"requiresPass"`
	IsVisible    bool         `json:"isVisible"`
	SortOrder    int          `json:"sortOrder"`
	Metadata     ZoneMetadata `json:"metadata"`
	CreatedAt    string       `json:"createdAt"`
	UpdatedAt    string       `json:"updatedAt"`
}

func (z *Zone) ToResponse() ZoneResponse {
	return ZoneResponse{
		ID:           z.ID,
		FestivalID:   z.FestivalID,
		Name:         z.Name,
		Description:  z.Description,
		Type:         z.Type,
		Color:        z.Color,
		FillColor:    z.FillColor,
		FillOpacity:  z.FillOpacity,
		BorderColor:  z.BorderColor,
		BorderWidth:  z.BorderWidth,
		Coordinates:  z.Coordinates,
		CenterLat:    z.CenterLat,
		CenterLng:    z.CenterLng,
		Capacity:     z.Capacity,
		IsRestricted: z.IsRestricted,
		RequiresPass: z.RequiresPass,
		IsVisible:    z.IsVisible,
		SortOrder:    z.SortOrder,
		Metadata:     z.Metadata,
		CreatedAt:    z.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    z.UpdatedAt.Format(time.RFC3339),
	}
}

// FullMapResponse represents the complete map data response
type FullMapResponse struct {
	Config *MapConfigResponse `json:"config,omitempty"`
	POIs   []POIResponse      `json:"pois"`
	Zones  []ZoneResponse     `json:"zones"`
}
