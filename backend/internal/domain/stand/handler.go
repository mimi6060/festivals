package stand

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
	stands := r.Group("/stands")
	{
		stands.POST("", h.Create)
		stands.GET("", h.List)
		stands.GET("/:id", h.GetByID)
		stands.PATCH("/:id", h.Update)
		stands.DELETE("/:id", h.Delete)
		stands.POST("/:id/activate", h.Activate)
		stands.POST("/:id/deactivate", h.Deactivate)

		// Staff management
		stands.GET("/:id/staff", h.GetStaff)
		stands.POST("/:id/staff", h.AssignStaff)
		stands.DELETE("/:id/staff/:userId", h.RemoveStaff)
		stands.POST("/:id/staff/:userId/validate-pin", h.ValidatePIN)
	}

	// My stands (for staff)
	r.GET("/me/stands", h.GetMyStands)
}

// Create creates a new stand
func (h *Handler) Create(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	var req CreateStandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	stand, err := h.service.Create(c.Request.Context(), festivalID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, stand.ToResponse())
}

// List lists stands for a festival
func (h *Handler) List(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	category := c.Query("category")

	if category != "" {
		stands, err := h.service.ListByCategory(c.Request.Context(), festivalID, StandCategory(category))
		if err != nil {
			response.InternalError(c, err.Error())
			return
		}

		items := make([]StandResponse, len(stands))
		for i, s := range stands {
			items[i] = s.ToResponse()
		}

		response.OK(c, items)
		return
	}

	stands, total, err := h.service.List(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]StandResponse, len(stands))
	for i, s := range stands {
		items[i] = s.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetByID gets a stand by ID
func (h *Handler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	stand, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Stand not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stand.ToResponse())
}

// Update updates a stand
func (h *Handler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	var req UpdateStandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	stand, err := h.service.Update(c.Request.Context(), id, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Stand not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stand.ToResponse())
}

// Delete deletes a stand
func (h *Handler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Stand not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// Activate activates a stand
func (h *Handler) Activate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	stand, err := h.service.Activate(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Stand not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stand.ToResponse())
}

// Deactivate deactivates a stand
func (h *Handler) Deactivate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	stand, err := h.service.Deactivate(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Stand not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stand.ToResponse())
}

// GetStaff gets staff assigned to a stand
func (h *Handler) GetStaff(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	staff, err := h.service.GetStaff(c.Request.Context(), id)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]StandStaffResponse, len(staff))
	for i, s := range staff {
		items[i] = s.ToResponse()
	}

	response.OK(c, items)
}

// AssignStaff assigns a staff member to a stand
func (h *Handler) AssignStaff(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	var req AssignStaffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	staff, err := h.service.AssignStaff(c.Request.Context(), id, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Stand not found")
			return
		}
		if err.Error() == "user already assigned to this stand" {
			response.BadRequest(c, "ALREADY_ASSIGNED", err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, staff.ToResponse())
}

// RemoveStaff removes a staff member from a stand
func (h *Handler) RemoveStaff(c *gin.Context) {
	standID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid user ID", nil)
		return
	}

	if err := h.service.RemoveStaff(c.Request.Context(), standID, userID); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Staff assignment not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// ValidatePIN validates a staff member's PIN
func (h *Handler) ValidatePIN(c *gin.Context) {
	standID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid user ID", nil)
		return
	}

	var req struct {
		PIN string `json:"pin" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	valid, err := h.service.ValidateStaffPIN(c.Request.Context(), standID, userID, req.PIN)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Staff assignment not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{"valid": valid})
}

// GetMyStands gets stands the current user is assigned to
func (h *Handler) GetMyStands(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	assignments, err := h.service.GetUserStands(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]StandStaffResponse, len(assignments))
	for i, a := range assignments {
		items[i] = a.ToResponse()
	}

	response.OK(c, items)
}

// Helper functions

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

func getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		return uuid.Nil, errors.ErrUnauthorized
	}
	return uuid.Parse(userIDStr)
}
