package festival

import (
	"net/http"
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
	festivals := r.Group("/festivals")
	{
		festivals.POST("", h.Create)
		festivals.GET("", h.List)
		festivals.GET("/:id", h.GetByID)
		festivals.PATCH("/:id", h.Update)
		festivals.DELETE("/:id", h.Delete)
		festivals.POST("/:id/activate", h.Activate)
		festivals.POST("/:id/archive", h.Archive)
	}
}

// Create creates a new festival
// @Summary Create a new festival
// @Tags festivals
// @Accept json
// @Produce json
// @Param request body CreateFestivalRequest true "Festival data"
// @Success 201 {object} FestivalResponse
// @Router /festivals [post]
func (h *Handler) Create(c *gin.Context) {
	var req CreateFestivalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	// Get creator ID from context (set by auth middleware)
	var createdBy *uuid.UUID
	if userID := c.GetString("user_id"); userID != "" {
		if id, err := uuid.Parse(userID); err == nil {
			createdBy = &id
		}
	}

	festival, err := h.service.Create(c.Request.Context(), req, createdBy)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, festival.ToResponse())
}

// List returns a paginated list of festivals
// @Summary List festivals
// @Tags festivals
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} FestivalResponse
// @Router /festivals [get]
func (h *Handler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	festivals, total, err := h.service.List(c.Request.Context(), page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Convert to response
	items := make([]FestivalResponse, len(festivals))
	for i, f := range festivals {
		items[i] = f.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetByID returns a festival by ID
// @Summary Get festival by ID
// @Tags festivals
// @Produce json
// @Param id path string true "Festival ID"
// @Success 200 {object} FestivalResponse
// @Router /festivals/{id} [get]
func (h *Handler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	festival, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, festival.ToResponse())
}

// Update updates a festival
// @Summary Update festival
// @Tags festivals
// @Accept json
// @Produce json
// @Param id path string true "Festival ID"
// @Param request body UpdateFestivalRequest true "Update data"
// @Success 200 {object} FestivalResponse
// @Router /festivals/{id} [patch]
func (h *Handler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req UpdateFestivalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	festival, err := h.service.Update(c.Request.Context(), id, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, festival.ToResponse())
}

// Delete deletes a festival
// @Summary Delete festival
// @Tags festivals
// @Param id path string true "Festival ID"
// @Success 204
// @Router /festivals/{id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// Activate activates a festival
// @Summary Activate festival
// @Tags festivals
// @Param id path string true "Festival ID"
// @Success 200 {object} FestivalResponse
// @Router /festivals/{id}/activate [post]
func (h *Handler) Activate(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	festival, err := h.service.Activate(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, festival.ToResponse())
}

// Archive archives a festival
// @Summary Archive festival
// @Tags festivals
// @Param id path string true "Festival ID"
// @Success 200 {object} FestivalResponse
// @Router /festivals/{id}/archive [post]
func (h *Handler) Archive(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	festival, err := h.service.Archive(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, festival.ToResponse())
}
