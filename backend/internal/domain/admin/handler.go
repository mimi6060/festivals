package admin

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// Handler handles HTTP requests for admin operations
type Handler struct {
	service *Service
}

// NewHandler creates a new admin handler
func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

// RegisterRoutes registers the admin routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	admin := r.Group("/admin")
	{
		// SuperAdmin routes
		admin.GET("/superadmins", h.GetSuperAdmins)
		admin.POST("/superadmins", h.CreateSuperAdmin)
		admin.GET("/superadmins/:id", h.GetSuperAdmin)
		admin.PUT("/superadmins/:id", h.UpdateSuperAdmin)
		admin.DELETE("/superadmins/:id", h.DeleteSuperAdmin)

		// Platform settings routes
		admin.GET("/settings", h.GetSettings)
		admin.GET("/settings/:key", h.GetSetting)
		admin.PUT("/settings/:key", h.UpdateSetting)

		// Metrics routes
		admin.GET("/metrics", h.GetMetrics)

		// Audit log routes
		admin.GET("/audit-logs", h.GetAuditLogs)
	}
}

// GetSuperAdmins returns all super admins
// @Summary Get all super admins
// @Description Get a list of all platform super administrators
// @Tags admin
// @Produce json
// @Success 200 {object} response.Response{data=[]SuperAdminResponse} "List of super admins"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /admin/superadmins [get]
func (h *Handler) GetSuperAdmins(c *gin.Context) {
	// Check permission
	if !h.checkPermission(c, PermissionManageAdmins) {
		return
	}

	admins, err := h.service.GetAllSuperAdmins(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]SuperAdminResponse, len(admins))
	for i, admin := range admins {
		items[i] = admin.ToResponse()
	}

	response.OK(c, items)
}

// CreateSuperAdmin creates a new super admin
// @Summary Create a super admin
// @Description Create a new platform super administrator
// @Tags admin
// @Accept json
// @Produce json
// @Param request body CreateSuperAdminRequest true "Super admin data"
// @Success 201 {object} response.Response{data=SuperAdminResponse} "Super admin created"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 409 {object} response.ErrorResponse "User is already a super admin"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /admin/superadmins [post]
func (h *Handler) CreateSuperAdmin(c *gin.Context) {
	// Check permission
	if !h.checkPermission(c, PermissionManageAdmins) {
		return
	}

	var req CreateSuperAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	adminID, ipAddress, userAgent := h.getAuditInfo(c)

	admin, err := h.service.CreateSuperAdmin(c.Request.Context(), req, adminID, ipAddress, userAgent)
	if err != nil {
		if err == errors.ErrAlreadyExists {
			response.Conflict(c, "ALREADY_EXISTS", "User is already a super admin")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, admin.ToResponse())
}

// GetSuperAdmin returns a super admin by ID
// @Summary Get a super admin
// @Description Get a super admin by ID
// @Tags admin
// @Produce json
// @Param id path string true "Super admin ID" format(uuid)
// @Success 200 {object} response.Response{data=SuperAdminResponse} "Super admin details"
// @Failure 400 {object} response.ErrorResponse "Invalid ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "Super admin not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /admin/superadmins/{id} [get]
func (h *Handler) GetSuperAdmin(c *gin.Context) {
	// Check permission
	if !h.checkPermission(c, PermissionManageAdmins) {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid super admin ID", nil)
		return
	}

	admin, err := h.service.GetSuperAdmin(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Super admin not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, admin.ToResponse())
}

// UpdateSuperAdmin updates a super admin's permissions
// @Summary Update a super admin
// @Description Update a super admin's permissions
// @Tags admin
// @Accept json
// @Produce json
// @Param id path string true "Super admin ID" format(uuid)
// @Param request body UpdateSuperAdminRequest true "Updated permissions"
// @Success 200 {object} response.Response{data=SuperAdminResponse} "Updated super admin"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "Super admin not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /admin/superadmins/{id} [put]
func (h *Handler) UpdateSuperAdmin(c *gin.Context) {
	// Check permission
	if !h.checkPermission(c, PermissionManageAdmins) {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid super admin ID", nil)
		return
	}

	var req UpdateSuperAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	adminID, ipAddress, userAgent := h.getAuditInfo(c)

	admin, err := h.service.UpdateSuperAdmin(c.Request.Context(), id, req, adminID, ipAddress, userAgent)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Super admin not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, admin.ToResponse())
}

// DeleteSuperAdmin removes a super admin
// @Summary Delete a super admin
// @Description Remove a super admin from the platform
// @Tags admin
// @Produce json
// @Param id path string true "Super admin ID" format(uuid)
// @Success 204 "Super admin deleted"
// @Failure 400 {object} response.ErrorResponse "Invalid ID or cannot delete self"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "Super admin not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /admin/superadmins/{id} [delete]
func (h *Handler) DeleteSuperAdmin(c *gin.Context) {
	// Check permission
	if !h.checkPermission(c, PermissionManageAdmins) {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid super admin ID", nil)
		return
	}

	adminID, ipAddress, userAgent := h.getAuditInfo(c)

	err = h.service.DeleteSuperAdmin(c.Request.Context(), id, adminID, ipAddress, userAgent)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Super admin not found")
			return
		}
		if err.Error() == "cannot delete your own admin account" {
			response.BadRequest(c, "SELF_DELETE", "Cannot delete your own admin account", nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// GetSettings returns all platform settings
// @Summary Get all platform settings
// @Description Get a list of all platform configuration settings
// @Tags admin
// @Produce json
// @Success 200 {object} response.Response{data=[]PlatformSettingsResponse} "List of settings"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /admin/settings [get]
func (h *Handler) GetSettings(c *gin.Context) {
	// Check permission
	if !h.checkPermission(c, PermissionManageSettings) {
		return
	}

	settings, err := h.service.GetAllSettings(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]PlatformSettingsResponse, len(settings))
	for i, setting := range settings {
		items[i] = setting.ToResponse()
	}

	response.OK(c, items)
}

// GetSetting returns a specific platform setting
// @Summary Get a platform setting
// @Description Get a specific platform setting by key
// @Tags admin
// @Produce json
// @Param key path string true "Setting key"
// @Success 200 {object} response.Response{data=PlatformSettingsResponse} "Setting details"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "Setting not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /admin/settings/{key} [get]
func (h *Handler) GetSetting(c *gin.Context) {
	// Check permission
	if !h.checkPermission(c, PermissionManageSettings) {
		return
	}

	key := c.Param("key")
	if key == "" {
		response.BadRequest(c, "INVALID_KEY", "Setting key is required", nil)
		return
	}

	setting, err := h.service.GetSetting(c.Request.Context(), key)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Setting not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, setting.ToResponse())
}

// UpdateSetting updates a platform setting
// @Summary Update a platform setting
// @Description Update or create a platform configuration setting
// @Tags admin
// @Accept json
// @Produce json
// @Param key path string true "Setting key"
// @Param request body UpdateSettingRequest true "Setting data"
// @Success 200 {object} response.Response{data=PlatformSettingsResponse} "Updated setting"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /admin/settings/{key} [put]
func (h *Handler) UpdateSetting(c *gin.Context) {
	// Check permission
	if !h.checkPermission(c, PermissionManageSettings) {
		return
	}

	key := c.Param("key")
	if key == "" {
		response.BadRequest(c, "INVALID_KEY", "Setting key is required", nil)
		return
	}

	var req UpdateSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	adminID, ipAddress, userAgent := h.getAuditInfo(c)

	setting, err := h.service.UpdateSetting(c.Request.Context(), key, req, adminID, ipAddress, userAgent)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, setting.ToResponse())
}

// GetMetrics returns system metrics
// @Summary Get system metrics
// @Description Get aggregated platform metrics and statistics
// @Tags admin
// @Produce json
// @Success 200 {object} response.Response{data=SystemMetricsResponse} "System metrics"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /admin/metrics [get]
func (h *Handler) GetMetrics(c *gin.Context) {
	// Check permission
	if !h.checkPermission(c, PermissionViewMetrics) {
		return
	}

	metrics, err := h.service.GetSystemOverview(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, metrics.ToResponse())
}

// GetAuditLogs returns audit logs with filtering
// @Summary Get audit logs
// @Description Get paginated list of audit logs with optional filters
// @Tags admin
// @Produce json
// @Param admin_id query string false "Filter by admin ID" format(uuid)
// @Param action query string false "Filter by action (CREATE, UPDATE, DELETE, etc.)"
// @Param resource_type query string false "Filter by resource type"
// @Param resource_id query string false "Filter by resource ID" format(uuid)
// @Param start_date query string false "Filter by start date (RFC3339)"
// @Param end_date query string false "Filter by end date (RFC3339)"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} response.Response{data=[]AuditLogResponse,meta=response.Meta} "Audit logs"
// @Failure 400 {object} response.ErrorResponse "Invalid filter parameters"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /admin/audit-logs [get]
func (h *Handler) GetAuditLogs(c *gin.Context) {
	// Check permission
	if !h.checkPermission(c, PermissionViewAuditLogs) {
		return
	}

	filter := AuditLogFilter{
		Page:    1,
		PerPage: 20,
	}

	// Parse filters
	if adminIDStr := c.Query("admin_id"); adminIDStr != "" {
		adminID, err := uuid.Parse(adminIDStr)
		if err != nil {
			response.BadRequest(c, "INVALID_ADMIN_ID", "Invalid admin ID format", nil)
			return
		}
		filter.AdminID = &adminID
	}

	filter.Action = c.Query("action")
	filter.ResourceType = c.Query("resource_type")

	if resourceIDStr := c.Query("resource_id"); resourceIDStr != "" {
		resourceID, err := uuid.Parse(resourceIDStr)
		if err != nil {
			response.BadRequest(c, "INVALID_RESOURCE_ID", "Invalid resource ID format", nil)
			return
		}
		filter.ResourceID = &resourceID
	}

	if startDateStr := c.Query("start_date"); startDateStr != "" {
		startDate, err := time.Parse(time.RFC3339, startDateStr)
		if err != nil {
			response.BadRequest(c, "INVALID_START_DATE", "Invalid start date format (use RFC3339)", nil)
			return
		}
		filter.StartDate = &startDate
	}

	if endDateStr := c.Query("end_date"); endDateStr != "" {
		endDate, err := time.Parse(time.RFC3339, endDateStr)
		if err != nil {
			response.BadRequest(c, "INVALID_END_DATE", "Invalid end date format (use RFC3339)", nil)
			return
		}
		filter.EndDate = &endDate
	}

	if page, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil {
		filter.Page = page
	}
	if perPage, err := strconv.Atoi(c.DefaultQuery("per_page", "20")); err == nil {
		filter.PerPage = perPage
	}

	logs, total, err := h.service.GetAuditTrail(c.Request.Context(), filter)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]AuditLogResponse, len(logs))
	for i, log := range logs {
		items[i] = log.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    filter.Page,
		PerPage: filter.PerPage,
	})
}

// Helper functions

// checkPermission checks if the current user has the required permission
func (h *Handler) checkPermission(c *gin.Context, permission string) bool {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Authentication required")
		return false
	}

	hasPermission, err := h.service.HasPermission(c.Request.Context(), userID, permission)
	if err != nil {
		response.InternalError(c, "Failed to check permissions")
		return false
	}

	if !hasPermission {
		response.Forbidden(c, "Insufficient permissions")
		return false
	}

	return true
}

// getAuditInfo extracts audit information from the request context
func (h *Handler) getAuditInfo(c *gin.Context) (uuid.UUID, string, string) {
	adminID, _ := getUserID(c)
	ipAddress := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")
	return adminID, ipAddress, userAgent
}

func getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		return uuid.Nil, errors.ErrUnauthorized
	}
	return uuid.Parse(userIDStr)
}
