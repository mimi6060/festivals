package lineup

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Artist routes
	artists := r.Group("/artists")
	{
		artists.POST("", h.CreateArtist)
		artists.GET("", h.ListArtists)
		artists.GET("/search", h.SearchArtists)
		artists.GET("/:id", h.GetArtistByID)
		artists.PATCH("/:id", h.UpdateArtist)
		artists.DELETE("/:id", h.DeleteArtist)
		artists.GET("/:id/performances", h.GetArtistPerformances)
	}

	// Stage routes
	stages := r.Group("/stages")
	{
		stages.POST("", h.CreateStage)
		stages.GET("", h.ListStages)
		stages.GET("/:id", h.GetStageByID)
		stages.PATCH("/:id", h.UpdateStage)
		stages.DELETE("/:id", h.DeleteStage)
		stages.GET("/:id/performances", h.GetStagePerformances)
	}

	// Performance routes
	performances := r.Group("/performances")
	{
		performances.POST("", h.CreatePerformance)
		performances.GET("", h.ListPerformances)
		performances.GET("/:id", h.GetPerformanceByID)
		performances.PATCH("/:id", h.UpdatePerformance)
		performances.DELETE("/:id", h.DeletePerformance)
		performances.POST("/:id/status", h.UpdatePerformanceStatus)
	}

	// Lineup routes (read-only schedule views)
	lineup := r.Group("/lineup")
	{
		lineup.GET("", h.GetFullLineup)
		lineup.GET("/:day", h.GetLineupByDay)
	}
}

// =====================
// Artist handlers
// =====================

// CreateArtist creates a new artist
// @Summary Create a new artist
// @Tags artists
// @Accept json
// @Produce json
// @Param request body CreateArtistRequest true "Artist data"
// @Success 201 {object} ArtistResponse
// @Router /artists [post]
func (h *Handler) CreateArtist(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	var req CreateArtistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	artist, err := h.service.CreateArtist(c.Request.Context(), festivalID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, artist.ToResponse())
}

// ListArtists lists artists for a festival
// @Summary List artists
// @Tags artists
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} ArtistResponse
// @Router /artists [get]
func (h *Handler) ListArtists(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	artists, total, err := h.service.ListArtists(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]ArtistResponse, len(artists))
	for i, a := range artists {
		items[i] = a.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// SearchArtists searches artists by name or genre
// @Summary Search artists
// @Tags artists
// @Produce json
// @Param q query string true "Search query"
// @Success 200 {array} ArtistResponse
// @Router /artists/search [get]
func (h *Handler) SearchArtists(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	query := c.Query("q")
	if query == "" {
		response.BadRequest(c, "VALIDATION_ERROR", "Search query required", nil)
		return
	}

	artists, err := h.service.SearchArtists(c.Request.Context(), festivalID, query)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]ArtistResponse, len(artists))
	for i, a := range artists {
		items[i] = a.ToResponse()
	}

	response.OK(c, items)
}

// GetArtistByID gets an artist by ID
// @Summary Get artist by ID
// @Tags artists
// @Produce json
// @Param id path string true "Artist ID"
// @Success 200 {object} ArtistResponse
// @Router /artists/{id} [get]
func (h *Handler) GetArtistByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid artist ID", nil)
		return
	}

	artist, err := h.service.GetArtistByID(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, artist.ToResponse())
}

// UpdateArtist updates an artist
// @Summary Update artist
// @Tags artists
// @Accept json
// @Produce json
// @Param id path string true "Artist ID"
// @Param request body UpdateArtistRequest true "Update data"
// @Success 200 {object} ArtistResponse
// @Router /artists/{id} [patch]
func (h *Handler) UpdateArtist(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid artist ID", nil)
		return
	}

	var req UpdateArtistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	artist, err := h.service.UpdateArtist(c.Request.Context(), id, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, artist.ToResponse())
}

// DeleteArtist deletes an artist
// @Summary Delete artist
// @Tags artists
// @Param id path string true "Artist ID"
// @Success 204
// @Router /artists/{id} [delete]
func (h *Handler) DeleteArtist(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid artist ID", nil)
		return
	}

	if err := h.service.DeleteArtist(c.Request.Context(), id); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist not found")
			return
		}
		if err.Error() == "cannot delete artist with scheduled performances" {
			response.Conflict(c, "HAS_PERFORMANCES", err.Error())
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// GetArtistPerformances gets performances for an artist
// @Summary Get artist performances
// @Tags artists
// @Produce json
// @Param id path string true "Artist ID"
// @Success 200 {array} PerformanceResponse
// @Router /artists/{id}/performances [get]
func (h *Handler) GetArtistPerformances(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid artist ID", nil)
		return
	}

	performances, err := h.service.GetArtistPerformances(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	items := make([]PerformanceResponse, len(performances))
	for i, p := range performances {
		items[i] = p.ToResponse()
	}

	response.OK(c, items)
}

// =====================
// Stage handlers
// =====================

// CreateStage creates a new stage
// @Summary Create a new stage
// @Tags stages
// @Accept json
// @Produce json
// @Param request body CreateStageRequest true "Stage data"
// @Success 201 {object} StageResponse
// @Router /stages [post]
func (h *Handler) CreateStage(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	var req CreateStageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	stage, err := h.service.CreateStage(c.Request.Context(), festivalID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, stage.ToResponse())
}

// ListStages lists stages for a festival
// @Summary List stages
// @Tags stages
// @Produce json
// @Success 200 {array} StageResponse
// @Router /stages [get]
func (h *Handler) ListStages(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	stages, err := h.service.ListStages(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]StageResponse, len(stages))
	for i, s := range stages {
		items[i] = s.ToResponse()
	}

	response.OK(c, items)
}

// GetStageByID gets a stage by ID
// @Summary Get stage by ID
// @Tags stages
// @Produce json
// @Param id path string true "Stage ID"
// @Success 200 {object} StageResponse
// @Router /stages/{id} [get]
func (h *Handler) GetStageByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stage ID", nil)
		return
	}

	stage, err := h.service.GetStageByID(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Stage not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stage.ToResponse())
}

// UpdateStage updates a stage
// @Summary Update stage
// @Tags stages
// @Accept json
// @Produce json
// @Param id path string true "Stage ID"
// @Param request body UpdateStageRequest true "Update data"
// @Success 200 {object} StageResponse
// @Router /stages/{id} [patch]
func (h *Handler) UpdateStage(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stage ID", nil)
		return
	}

	var req UpdateStageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	stage, err := h.service.UpdateStage(c.Request.Context(), id, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Stage not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stage.ToResponse())
}

// DeleteStage deletes a stage
// @Summary Delete stage
// @Tags stages
// @Param id path string true "Stage ID"
// @Success 204
// @Router /stages/{id} [delete]
func (h *Handler) DeleteStage(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stage ID", nil)
		return
	}

	if err := h.service.DeleteStage(c.Request.Context(), id); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Stage not found")
			return
		}
		if err.Error() == "cannot delete stage with scheduled performances" {
			response.Conflict(c, "HAS_PERFORMANCES", err.Error())
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// GetStagePerformances gets performances for a stage
// @Summary Get stage performances
// @Tags stages
// @Produce json
// @Param id path string true "Stage ID"
// @Param day query string false "Filter by day (YYYY-MM-DD)"
// @Success 200 {array} PerformanceResponse
// @Router /stages/{id}/performances [get]
func (h *Handler) GetStagePerformances(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stage ID", nil)
		return
	}

	day := c.Query("day")

	performances, err := h.service.GetStagePerformances(c.Request.Context(), id, day)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Stage not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	items := make([]PerformanceResponse, len(performances))
	for i, p := range performances {
		items[i] = p.ToResponse()
	}

	response.OK(c, items)
}

// =====================
// Performance handlers
// =====================

// CreatePerformance creates a new performance
// @Summary Create a new performance
// @Tags performances
// @Accept json
// @Produce json
// @Param request body CreatePerformanceRequest true "Performance data"
// @Success 201 {object} PerformanceResponse
// @Router /performances [post]
func (h *Handler) CreatePerformance(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	var req CreatePerformanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	performance, err := h.service.CreatePerformance(c.Request.Context(), festivalID, req)
	if err != nil {
		if err.Error() == "artist not found" || err.Error() == "stage not found" {
			response.BadRequest(c, "INVALID_REFERENCE", err.Error(), nil)
			return
		}
		if err.Error() == "schedule conflict: overlapping performance on the same stage" {
			response.Conflict(c, "SCHEDULE_CONFLICT", err.Error())
			return
		}
		if err.Error() == "end time must be after start time" {
			response.BadRequest(c, "INVALID_TIME_RANGE", err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, performance.ToResponse())
}

// ListPerformances lists performances for a festival
// @Summary List performances
// @Tags performances
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} PerformanceResponse
// @Router /performances [get]
func (h *Handler) ListPerformances(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	performances, total, err := h.service.ListPerformances(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]PerformanceResponse, len(performances))
	for i, p := range performances {
		items[i] = p.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetPerformanceByID gets a performance by ID
// @Summary Get performance by ID
// @Tags performances
// @Produce json
// @Param id path string true "Performance ID"
// @Success 200 {object} PerformanceResponse
// @Router /performances/{id} [get]
func (h *Handler) GetPerformanceByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid performance ID", nil)
		return
	}

	performance, err := h.service.GetPerformanceByID(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Performance not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, performance.ToResponse())
}

// UpdatePerformance updates a performance
// @Summary Update performance
// @Tags performances
// @Accept json
// @Produce json
// @Param id path string true "Performance ID"
// @Param request body UpdatePerformanceRequest true "Update data"
// @Success 200 {object} PerformanceResponse
// @Router /performances/{id} [patch]
func (h *Handler) UpdatePerformance(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid performance ID", nil)
		return
	}

	var req UpdatePerformanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	performance, err := h.service.UpdatePerformance(c.Request.Context(), id, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Performance not found")
			return
		}
		if err.Error() == "artist not found" || err.Error() == "stage not found" {
			response.BadRequest(c, "INVALID_REFERENCE", err.Error(), nil)
			return
		}
		if err.Error() == "schedule conflict: overlapping performance on the same stage" {
			response.Conflict(c, "SCHEDULE_CONFLICT", err.Error())
			return
		}
		if err.Error() == "end time must be after start time" {
			response.BadRequest(c, "INVALID_TIME_RANGE", err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, performance.ToResponse())
}

// DeletePerformance deletes a performance
// @Summary Delete performance
// @Tags performances
// @Param id path string true "Performance ID"
// @Success 204
// @Router /performances/{id} [delete]
func (h *Handler) DeletePerformance(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid performance ID", nil)
		return
	}

	if err := h.service.DeletePerformance(c.Request.Context(), id); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Performance not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// UpdatePerformanceStatus updates the status of a performance
// @Summary Update performance status
// @Tags performances
// @Accept json
// @Produce json
// @Param id path string true "Performance ID"
// @Param request body object{status=PerformanceStatus} true "Status data"
// @Success 200 {object} PerformanceResponse
// @Router /performances/{id}/status [post]
func (h *Handler) UpdatePerformanceStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid performance ID", nil)
		return
	}

	var req struct {
		Status PerformanceStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	performance, err := h.service.UpdatePerformanceStatus(c.Request.Context(), id, req.Status)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Performance not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, performance.ToResponse())
}

// =====================
// Lineup handlers
// =====================

// GetFullLineup gets the full festival lineup
// @Summary Get full lineup
// @Tags lineup
// @Produce json
// @Success 200 {object} LineupResponse
// @Router /lineup [get]
func (h *Handler) GetFullLineup(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	lineup, err := h.service.GetFullLineup(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, lineup)
}

// GetLineupByDay gets the lineup for a specific day
// @Summary Get lineup by day
// @Tags lineup
// @Produce json
// @Param day path string true "Day (YYYY-MM-DD)"
// @Success 200 {object} DayScheduleResponse
// @Router /lineup/{day} [get]
func (h *Handler) GetLineupByDay(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	day := c.Param("day")
	if day == "" {
		response.BadRequest(c, "VALIDATION_ERROR", "Day parameter required", nil)
		return
	}

	schedule, err := h.service.GetLineupByDay(c.Request.Context(), festivalID, day)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, schedule)
}

// =====================
// Helper functions
// =====================

func getFestivalID(c *gin.Context) (uuid.UUID, error) {
	festivalIDStr := c.GetString("festival_id")
	if festivalIDStr == "" {
		// Try from URL param
		festivalIDStr = c.Param("festivalId")
	}
	if festivalIDStr == "" {
		return uuid.Nil, errors.ErrBadRequest
	}
	return uuid.Parse(festivalIDStr)
}
