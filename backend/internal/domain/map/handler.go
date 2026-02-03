package festivalmap

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// Handler handles HTTP requests for map operations
type Handler struct {
	service *Service
}

// NewHandler creates a new map handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers map routes on the given router group
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	maps := r.Group("/festivals/:festivalId/map")
	{
		// Map configuration
		maps.GET("/config", h.GetConfig)
		maps.PUT("/config", h.CreateOrUpdateConfig)
		maps.PATCH("/config", h.UpdateConfig)

		// Full map data
		maps.GET("", h.GetFullMapData)

		// POIs
		maps.GET("/pois", h.ListPOIs)
		maps.POST("/pois", h.CreatePOI)
		maps.GET("/pois/:poiId", h.GetPOI)
		maps.PATCH("/pois/:poiId", h.UpdatePOI)
		maps.DELETE("/pois/:poiId", h.DeletePOI)
		maps.POST("/pois/bulk", h.BulkCreatePOIs)

		// Zones
		maps.GET("/zones", h.ListZones)
		maps.POST("/zones", h.CreateZone)
		maps.GET("/zones/:zoneId", h.GetZone)
		maps.PATCH("/zones/:zoneId", h.UpdateZone)
		maps.DELETE("/zones/:zoneId", h.DeleteZone)
	}
}

// =====================
// Helper Functions
// =====================

func (h *Handler) parseFestivalID(c *gin.Context) (uuid.UUID, error) {
	idStr := c.Param("festivalId")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

func (h *Handler) parsePOIID(c *gin.Context) (uuid.UUID, error) {
	idStr := c.Param("poiId")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

func (h *Handler) parseZoneID(c *gin.Context) (uuid.UUID, error) {
	idStr := c.Param("zoneId")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

// =====================
// Map Config Handlers
// =====================

// GetConfig returns the map configuration for a festival
// @Summary Get map configuration
// @Tags map
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Success 200 {object} MapConfigResponse
// @Router /festivals/{festivalId}/map/config [get]
func (h *Handler) GetConfig(c *gin.Context) {
	festivalID, err := h.parseFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	config, err := h.service.GetConfig(c.Request.Context(), festivalID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Map configuration not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, config.ToResponse())
}

// CreateOrUpdateConfig creates or updates map configuration
// @Summary Create or update map configuration
// @Tags map
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param request body CreateMapConfigRequest true "Map config data"
// @Success 200 {object} MapConfigResponse
// @Router /festivals/{festivalId}/map/config [put]
func (h *Handler) CreateOrUpdateConfig(c *gin.Context) {
	festivalID, err := h.parseFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req CreateMapConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	config, err := h.service.CreateOrUpdateConfig(c.Request.Context(), festivalID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, config.ToResponse())
}

// UpdateConfig partially updates map configuration
// @Summary Update map configuration
// @Tags map
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param request body UpdateMapConfigRequest true "Update data"
// @Success 200 {object} MapConfigResponse
// @Router /festivals/{festivalId}/map/config [patch]
func (h *Handler) UpdateConfig(c *gin.Context) {
	festivalID, err := h.parseFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req UpdateMapConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	config, err := h.service.UpdateConfig(c.Request.Context(), festivalID, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Map configuration not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, config.ToResponse())
}

// =====================
// Full Map Data Handler
// =====================

// GetFullMapData returns complete map data for a festival
// @Summary Get complete map data
// @Tags map
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Success 200 {object} FullMapResponse
// @Router /festivals/{festivalId}/map [get]
func (h *Handler) GetFullMapData(c *gin.Context) {
	festivalID, err := h.parseFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	data, err := h.service.GetFullMapData(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, data)
}

// =====================
// POI Handlers
// =====================

// ListPOIs returns all POIs for a festival
// @Summary List POIs
// @Tags map
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param type query string false "POI type filter"
// @Param status query string false "Status filter"
// @Param accessible query bool false "Accessibility filter"
// @Param featured query bool false "Featured filter"
// @Param search query string false "Search term"
// @Success 200 {array} POIResponse
// @Router /festivals/{festivalId}/map/pois [get]
func (h *Handler) ListPOIs(c *gin.Context) {
	festivalID, err := h.parseFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	// Parse filters
	filters := POIFilters{
		Search: c.Query("search"),
	}

	if typeStr := c.Query("type"); typeStr != "" {
		poiType := POIType(typeStr)
		filters.Type = &poiType
	}

	if statusStr := c.Query("status"); statusStr != "" {
		status := POIStatus(statusStr)
		filters.Status = &status
	}

	if accessibleStr := c.Query("accessible"); accessibleStr != "" {
		accessible := accessibleStr == "true"
		filters.IsAccessible = &accessible
	}

	if featuredStr := c.Query("featured"); featuredStr != "" {
		featured := featuredStr == "true"
		filters.IsFeatured = &featured
	}

	if zoneIDStr := c.Query("zoneId"); zoneIDStr != "" {
		if zoneID, err := uuid.Parse(zoneIDStr); err == nil {
			filters.ZoneID = &zoneID
		}
	}

	pois, err := h.service.ListPOIs(c.Request.Context(), festivalID, filters)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Convert to response
	items := make([]POIResponse, len(pois))
	for i, poi := range pois {
		items[i] = poi.ToResponse()
	}

	response.OK(c, items)
}

// CreatePOI creates a new POI
// @Summary Create POI
// @Tags map
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param request body CreatePOIRequest true "POI data"
// @Success 201 {object} POIResponse
// @Router /festivals/{festivalId}/map/pois [post]
func (h *Handler) CreatePOI(c *gin.Context) {
	festivalID, err := h.parseFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req CreatePOIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	poi, err := h.service.CreatePOI(c.Request.Context(), festivalID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, poi.ToResponse())
}

// GetPOI returns a POI by ID
// @Summary Get POI
// @Tags map
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param poiId path string true "POI ID"
// @Success 200 {object} POIResponse
// @Router /festivals/{festivalId}/map/pois/{poiId} [get]
func (h *Handler) GetPOI(c *gin.Context) {
	poiID, err := h.parsePOIID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid POI ID", nil)
		return
	}

	poi, err := h.service.GetPOIByID(c.Request.Context(), poiID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "POI not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, poi.ToResponse())
}

// UpdatePOI updates a POI
// @Summary Update POI
// @Tags map
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param poiId path string true "POI ID"
// @Param request body UpdatePOIRequest true "Update data"
// @Success 200 {object} POIResponse
// @Router /festivals/{festivalId}/map/pois/{poiId} [patch]
func (h *Handler) UpdatePOI(c *gin.Context) {
	poiID, err := h.parsePOIID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid POI ID", nil)
		return
	}

	var req UpdatePOIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	poi, err := h.service.UpdatePOI(c.Request.Context(), poiID, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "POI not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, poi.ToResponse())
}

// DeletePOI deletes a POI
// @Summary Delete POI
// @Tags map
// @Param festivalId path string true "Festival ID"
// @Param poiId path string true "POI ID"
// @Success 204
// @Router /festivals/{festivalId}/map/pois/{poiId} [delete]
func (h *Handler) DeletePOI(c *gin.Context) {
	poiID, err := h.parsePOIID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid POI ID", nil)
		return
	}

	if err := h.service.DeletePOI(c.Request.Context(), poiID); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "POI not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// BulkCreatePOIs creates multiple POIs at once
// @Summary Bulk create POIs
// @Tags map
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param request body []CreatePOIRequest true "POI data array"
// @Success 201 {array} POIResponse
// @Router /festivals/{festivalId}/map/pois/bulk [post]
func (h *Handler) BulkCreatePOIs(c *gin.Context) {
	festivalID, err := h.parseFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var requests []CreatePOIRequest
	if err := c.ShouldBindJSON(&requests); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	if len(requests) == 0 {
		response.BadRequest(c, "VALIDATION_ERROR", "At least one POI is required", nil)
		return
	}

	pois, err := h.service.BulkCreatePOIs(c.Request.Context(), festivalID, requests)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Convert to response
	items := make([]POIResponse, len(pois))
	for i, poi := range pois {
		items[i] = poi.ToResponse()
	}

	response.Created(c, items)
}

// =====================
// Zone Handlers
// =====================

// ListZones returns all zones for a festival
// @Summary List zones
// @Tags map
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param type query string false "Zone type filter"
// @Param restricted query bool false "Restricted filter"
// @Param visible query bool false "Visibility filter"
// @Param search query string false "Search term"
// @Success 200 {array} ZoneResponse
// @Router /festivals/{festivalId}/map/zones [get]
func (h *Handler) ListZones(c *gin.Context) {
	festivalID, err := h.parseFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	// Parse filters
	filters := ZoneFilters{
		Search: c.Query("search"),
	}

	if typeStr := c.Query("type"); typeStr != "" {
		zoneType := ZoneType(typeStr)
		filters.Type = &zoneType
	}

	if restrictedStr := c.Query("restricted"); restrictedStr != "" {
		restricted := restrictedStr == "true"
		filters.IsRestricted = &restricted
	}

	if visibleStr := c.Query("visible"); visibleStr != "" {
		visible := visibleStr == "true"
		filters.IsVisible = &visible
	}

	zones, err := h.service.ListZones(c.Request.Context(), festivalID, filters)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Convert to response
	items := make([]ZoneResponse, len(zones))
	for i, zone := range zones {
		items[i] = zone.ToResponse()
	}

	response.OK(c, items)
}

// CreateZone creates a new zone
// @Summary Create zone
// @Tags map
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param request body CreateZoneRequest true "Zone data"
// @Success 201 {object} ZoneResponse
// @Router /festivals/{festivalId}/map/zones [post]
func (h *Handler) CreateZone(c *gin.Context) {
	festivalID, err := h.parseFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req CreateZoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	zone, err := h.service.CreateZone(c.Request.Context(), festivalID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, zone.ToResponse())
}

// GetZone returns a zone by ID
// @Summary Get zone
// @Tags map
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param zoneId path string true "Zone ID"
// @Success 200 {object} ZoneResponse
// @Router /festivals/{festivalId}/map/zones/{zoneId} [get]
func (h *Handler) GetZone(c *gin.Context) {
	zoneID, err := h.parseZoneID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid zone ID", nil)
		return
	}

	zone, err := h.service.GetZoneByID(c.Request.Context(), zoneID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Zone not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, zone.ToResponse())
}

// UpdateZone updates a zone
// @Summary Update zone
// @Tags map
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param zoneId path string true "Zone ID"
// @Param request body UpdateZoneRequest true "Update data"
// @Success 200 {object} ZoneResponse
// @Router /festivals/{festivalId}/map/zones/{zoneId} [patch]
func (h *Handler) UpdateZone(c *gin.Context) {
	zoneID, err := h.parseZoneID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid zone ID", nil)
		return
	}

	var req UpdateZoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	zone, err := h.service.UpdateZone(c.Request.Context(), zoneID, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Zone not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, zone.ToResponse())
}

// DeleteZone deletes a zone
// @Summary Delete zone
// @Tags map
// @Param festivalId path string true "Festival ID"
// @Param zoneId path string true "Zone ID"
// @Success 204
// @Router /festivals/{festivalId}/map/zones/{zoneId} [delete]
func (h *Handler) DeleteZone(c *gin.Context) {
	zoneID, err := h.parseZoneID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid zone ID", nil)
		return
	}

	if err := h.service.DeleteZone(c.Request.Context(), zoneID); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Zone not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}
