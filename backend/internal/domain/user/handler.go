package user

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// Handler handles HTTP requests for user operations
type Handler struct {
	service *Service
}

// NewHandler creates a new user handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers the user routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup, adminMiddleware gin.HandlerFunc) {
	// Current user routes (authenticated users)
	me := r.Group("/me")
	{
		me.GET("", h.GetCurrentUser)
		me.PATCH("", h.UpdateProfile)
	}

	// Admin user management routes
	users := r.Group("/users")
	users.Use(adminMiddleware)
	{
		users.GET("", h.ListUsers)
		users.GET("/:id", h.GetUser)
		users.PATCH("/:id/role", h.UpdateUserRole)
		users.POST("/:id/ban", h.BanUser)
		users.POST("/:id/unban", h.UnbanUser)
		users.DELETE("/:id", h.DeleteUser)
	}
}

// GetCurrentUser returns the currently authenticated user's profile
// @Summary Get current user profile
// @Tags users
// @Produce json
// @Success 200 {object} UserResponse
// @Router /me [get]
func (h *Handler) GetCurrentUser(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID := c.GetString("user_id")
	if userID == "" {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	id, err := uuid.Parse(userID)
	if err != nil {
		response.Unauthorized(c, "Invalid user ID")
		return
	}

	user, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "User not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, user.ToResponse())
}

// UpdateProfile updates the current user's profile
// @Summary Update current user profile
// @Tags users
// @Accept json
// @Produce json
// @Param request body UpdateUserRequest true "Profile update data"
// @Success 200 {object} UserResponse
// @Router /me [patch]
func (h *Handler) UpdateProfile(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID := c.GetString("user_id")
	if userID == "" {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	id, err := uuid.Parse(userID)
	if err != nil {
		response.Unauthorized(c, "Invalid user ID")
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	user, err := h.service.UpdateProfile(c.Request.Context(), id, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "User not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, user.ToResponse())
}

// ListUsers returns a paginated list of users (admin only)
// @Summary List all users
// @Tags users
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Param role query string false "Filter by role"
// @Param search query string false "Search by name or email"
// @Success 200 {array} UserResponse
// @Router /users [get]
func (h *Handler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	roleFilter := c.Query("role")
	searchQuery := c.Query("search")

	var users []User
	var total int64
	var err error

	if searchQuery != "" {
		// Search users
		users, total, err = h.service.Search(c.Request.Context(), searchQuery, page, perPage)
	} else if roleFilter != "" {
		// Filter by role
		role := UserRole(roleFilter)
		if !role.IsValid() {
			response.BadRequest(c, "INVALID_ROLE", "Invalid role filter", nil)
			return
		}
		users, total, err = h.service.ListByRole(c.Request.Context(), role, page, perPage)
	} else {
		// List all users
		users, total, err = h.service.List(c.Request.Context(), page, perPage)
	}

	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Convert to response
	items := make([]UserResponse, len(users))
	for i, u := range users {
		items[i] = u.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetUser returns a user by ID (admin only)
// @Summary Get user by ID
// @Tags users
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} UserResponse
// @Router /users/{id} [get]
func (h *Handler) GetUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid user ID", nil)
		return
	}

	user, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "User not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, user.ToResponse())
}

// UpdateUserRole updates a user's role (admin only)
// @Summary Update user role
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Param request body UpdateUserRoleRequest true "Role update data"
// @Success 200 {object} UserResponse
// @Router /users/{id}/role [patch]
func (h *Handler) UpdateUserRole(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid user ID", nil)
		return
	}

	var req UpdateUserRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	if !req.Role.IsValid() {
		response.BadRequest(c, "INVALID_ROLE", "Invalid role specified", nil)
		return
	}

	user, err := h.service.UpdateRole(c.Request.Context(), id, req.Role)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "User not found")
			return
		}
		if err == errors.ErrValidation {
			response.BadRequest(c, "INVALID_ROLE", "Invalid role specified", nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, user.ToResponse())
}

// BanUser bans a user (admin only)
// @Summary Ban user
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Param request body BanUserRequest false "Ban reason"
// @Success 200 {object} UserResponse
// @Router /users/{id}/ban [post]
func (h *Handler) BanUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid user ID", nil)
		return
	}

	var req BanUserRequest
	// Ignore binding errors as reason is optional
	_ = c.ShouldBindJSON(&req)

	user, err := h.service.BanUser(c.Request.Context(), id, req.Reason)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "User not found")
			return
		}
		if err == errors.ErrForbidden {
			response.Forbidden(c, "Cannot ban admin users")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, user.ToResponse())
}

// UnbanUser unbans a user (admin only)
// @Summary Unban user
// @Tags users
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} UserResponse
// @Router /users/{id}/unban [post]
func (h *Handler) UnbanUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid user ID", nil)
		return
	}

	user, err := h.service.UnbanUser(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "User not found")
			return
		}
		if err == errors.ErrBadRequest {
			response.BadRequest(c, "NOT_BANNED", "User is not banned", nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, user.ToResponse())
}

// DeleteUser deletes a user (admin only)
// @Summary Delete user
// @Tags users
// @Param id path string true "User ID"
// @Success 204
// @Router /users/{id} [delete]
func (h *Handler) DeleteUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid user ID", nil)
		return
	}

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "User not found")
			return
		}
		if err == errors.ErrForbidden {
			response.Forbidden(c, "Cannot delete admin users")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}
