package search

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// Handler handles search-related HTTP requests
type Handler struct {
	service *Service
}

// NewHandler creates a new search handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers the search routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	search := r.Group("/search")
	{
		search.GET("", h.Search)
		search.GET("/suggestions", h.GetSuggestions)
	}
}

// RegisterFestivalRoutes registers festival-scoped search routes
func (h *Handler) RegisterFestivalRoutes(r *gin.RouterGroup) {
	search := r.Group("/search")
	{
		search.GET("", h.SearchInFestival)
		search.GET("/suggestions", h.GetSuggestionsInFestival)
	}
}

// Search performs a global search across all entities
// @Summary Global search
// @Description Search across artists, stages, stands, and products
// @Tags search
// @Produce json
// @Param q query string true "Search query" minlength(1) maxlength(100)
// @Param type query string false "Search type filter" Enums(all, artist, stage, stand, product) default(all)
// @Param festival_id query string false "Festival ID to scope search" format(uuid)
// @Param category query string false "Category filter (for stands/products)"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20) maximum(100)
// @Success 200 {object} response.Response{data=SearchResponse} "Search results"
// @Failure 400 {object} response.ErrorResponse "Invalid request parameters"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Router /search [get]
func (h *Handler) Search(c *gin.Context) {
	var req SearchRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid search parameters", err.Error())
		return
	}

	filters, err := req.ToFilters()
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID format", nil)
		return
	}

	result, err := h.service.Search(c.Request.Context(), filters)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, result)
}

// SearchInFestival performs a search scoped to a specific festival
// @Summary Search within a festival
// @Description Search across artists, stages, stands, and products within a festival
// @Tags search
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param q query string true "Search query" minlength(1) maxlength(100)
// @Param type query string false "Search type filter" Enums(all, artist, stage, stand, product) default(all)
// @Param category query string false "Category filter (for stands/products)"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20) maximum(100)
// @Success 200 {object} response.Response{data=SearchResponse} "Search results"
// @Failure 400 {object} response.ErrorResponse "Invalid request parameters"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/search [get]
func (h *Handler) SearchInFestival(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	var req SearchRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid search parameters", err.Error())
		return
	}

	filters, err := req.ToFilters()
	if err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid filter parameters", err.Error())
		return
	}

	// Override festival ID from path
	filters.FestivalID = &festivalID

	result, err := h.service.Search(c.Request.Context(), filters)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, result)
}

// GetSuggestions returns search autocomplete suggestions
// @Summary Get search suggestions
// @Description Get autocomplete suggestions based on partial query
// @Tags search
// @Produce json
// @Param q query string true "Search query prefix" minlength(2) maxlength(50)
// @Param festival_id query string false "Festival ID to scope suggestions" format(uuid)
// @Success 200 {object} response.Response{data=SuggestionsResponse} "Search suggestions"
// @Failure 400 {object} response.ErrorResponse "Invalid request parameters"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Router /search/suggestions [get]
func (h *Handler) GetSuggestions(c *gin.Context) {
	query := c.Query("q")
	if query == "" || len(query) < 2 {
		response.BadRequest(c, "VALIDATION_ERROR", "Query must be at least 2 characters", nil)
		return
	}

	var festivalID *uuid.UUID
	if festivalIDStr := c.Query("festival_id"); festivalIDStr != "" {
		id, err := uuid.Parse(festivalIDStr)
		if err != nil {
			response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID format", nil)
			return
		}
		festivalID = &id
	}

	suggestions, err := h.service.GetSuggestions(c.Request.Context(), query, festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, suggestions)
}

// GetSuggestionsInFestival returns search suggestions scoped to a festival
// @Summary Get search suggestions within a festival
// @Description Get autocomplete suggestions based on partial query within a festival
// @Tags search
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param q query string true "Search query prefix" minlength(2) maxlength(50)
// @Success 200 {object} response.Response{data=SuggestionsResponse} "Search suggestions"
// @Failure 400 {object} response.ErrorResponse "Invalid request parameters"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/search/suggestions [get]
func (h *Handler) GetSuggestionsInFestival(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	query := c.Query("q")
	if query == "" || len(query) < 2 {
		response.BadRequest(c, "VALIDATION_ERROR", "Query must be at least 2 characters", nil)
		return
	}

	suggestions, err := h.service.GetSuggestions(c.Request.Context(), query, &festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, suggestions)
}

// InvalidateCache invalidates search cache for a festival (admin only)
// @Summary Invalidate search cache
// @Description Invalidate all search cache entries for a festival
// @Tags search
// @Param festivalId path string true "Festival ID" format(uuid)
// @Success 204 "Cache invalidated"
// @Failure 400 {object} response.ErrorResponse "Invalid festival ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/search/cache [delete]
func (h *Handler) InvalidateCache(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	if err := h.service.InvalidateCache(c.Request.Context(), &festivalID); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// Helper functions

func getFestivalID(c *gin.Context) (uuid.UUID, error) {
	festivalIDStr := c.GetString("festival_id")
	if festivalIDStr == "" {
		// Try from URL param
		festivalIDStr = c.Param("festivalId")
	}
	if festivalIDStr == "" {
		return uuid.Nil, ErrFestivalRequired
	}
	return uuid.Parse(festivalIDStr)
}

// Custom errors
var (
	ErrFestivalRequired = &customError{message: "festival ID is required"}
)

type customError struct {
	message string
}

func (e *customError) Error() string {
	return e.message
}
