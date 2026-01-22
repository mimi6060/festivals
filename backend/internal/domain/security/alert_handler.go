package security

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// Handler handles security alert HTTP requests
type Handler struct {
	service *Service
}

// NewHandler creates a new security handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers the security routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Public SOS endpoint (requires user auth)
	r.POST("/festivals/:festivalId/sos", h.CreateSOSAlert)

	// Festival security routes (requires staff/admin auth)
	security := r.Group("/festivals/:festivalId/security")
	{
		// Alerts
		security.GET("/alerts", h.GetAlerts)
		security.GET("/alerts/active", h.GetActiveAlerts)
		security.GET("/alerts/stats", h.GetAlertStats)
		security.POST("/alerts", h.CreateSecurityAlert)
		security.GET("/alerts/:alertId", h.GetAlert)
		security.PATCH("/alerts/:alertId", h.UpdateAlert)
		security.POST("/alerts/:alertId/acknowledge", h.AcknowledgeAlert)
		security.POST("/alerts/:alertId/assign", h.AssignAlert)
		security.POST("/alerts/:alertId/resolve", h.ResolveAlert)
		security.POST("/alerts/:alertId/cancel", h.CancelAlert)

		// Zones
		security.GET("/zones", h.GetZones)
		security.POST("/zones", h.CreateZone)
		security.GET("/zones/:zoneId", h.GetZone)
		security.PATCH("/zones/:zoneId", h.UpdateZone)
		security.DELETE("/zones/:zoneId", h.DeleteZone)
	}

	// User's own alerts
	r.GET("/my/alerts", h.GetMyAlerts)
}

// CreateSOSAlert creates an SOS alert
// @Summary Create SOS alert
// @Tags security
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param request body SOSRequest true "SOS data"
// @Success 201 {object} AlertResponse
// @Router /festivals/{festivalId}/sos [post]
func (h *Handler) CreateSOSAlert(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		response.Unauthorized(c, "Authentication required")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		response.Unauthorized(c, "Invalid user ID")
		return
	}

	var req SOSRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	alert, err := h.service.CreateSOSAlert(c.Request.Context(), festivalID, userID, req)
	if err != nil {
		if appErr, ok := err.(*errors.AppError); ok {
			if appErr.Code == "RATE_LIMITED" {
				c.JSON(http.StatusTooManyRequests, response.ErrorResponse{
					Error: response.ErrorDetail{Code: appErr.Code, Message: appErr.Message},
				})
				return
			}
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, alert.ToResponse())
}

// GetAlerts returns alerts for a festival
// @Summary Get alerts
// @Tags security
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Param type query string false "Alert types (comma-separated)"
// @Param severity query string false "Severities (comma-separated)"
// @Param status query string false "Statuses (comma-separated)"
// @Success 200 {array} AlertResponse
// @Router /festivals/{festivalId}/security/alerts [get]
func (h *Handler) GetAlerts(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	// Parse filters
	filters := AlertFilters{}

	if typeStr := c.Query("type"); typeStr != "" {
		types := strings.Split(typeStr, ",")
		for _, t := range types {
			filters.Types = append(filters.Types, AlertType(strings.TrimSpace(t)))
		}
	}

	if severityStr := c.Query("severity"); severityStr != "" {
		severities := strings.Split(severityStr, ",")
		for _, s := range severities {
			filters.Severities = append(filters.Severities, AlertSeverity(strings.TrimSpace(s)))
		}
	}

	if statusStr := c.Query("status"); statusStr != "" {
		statuses := strings.Split(statusStr, ",")
		for _, s := range statuses {
			filters.Statuses = append(filters.Statuses, AlertStatus(strings.TrimSpace(s)))
		}
	}

	if assignedToStr := c.Query("assigned_to"); assignedToStr != "" {
		if assignedTo, err := uuid.Parse(assignedToStr); err == nil {
			filters.AssignedTo = &assignedTo
		}
	}

	alerts, total, err := h.service.GetAlertsByFestival(c.Request.Context(), festivalID, filters, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]AlertResponse, len(alerts))
	for i, a := range alerts {
		items[i] = a.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetActiveAlerts returns active alerts for a festival
// @Summary Get active alerts
// @Tags security
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Success 200 {array} AlertResponse
// @Router /festivals/{festivalId}/security/alerts/active [get]
func (h *Handler) GetActiveAlerts(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	alerts, err := h.service.GetActiveAlerts(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]AlertResponse, len(alerts))
	for i, a := range alerts {
		items[i] = a.ToResponse()
	}

	response.OK(c, items)
}

// GetAlertStats returns alert statistics
// @Summary Get alert statistics
// @Tags security
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Success 200 {object} AlertStats
// @Router /festivals/{festivalId}/security/alerts/stats [get]
func (h *Handler) GetAlertStats(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	stats, err := h.service.GetAlertStats(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stats)
}

// CreateSecurityAlert creates a security alert
// @Summary Create security alert
// @Tags security
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param request body CreateAlertRequest true "Alert data"
// @Success 201 {object} AlertResponse
// @Router /festivals/{festivalId}/security/alerts [post]
func (h *Handler) CreateSecurityAlert(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	var creatorID *uuid.UUID
	if userIDStr := c.GetString("user_id"); userIDStr != "" {
		if id, err := uuid.Parse(userIDStr); err == nil {
			creatorID = &id
		}
	}

	var req CreateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	alert, err := h.service.CreateSecurityAlert(c.Request.Context(), festivalID, creatorID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, alert.ToResponse())
}

// GetAlert returns a specific alert
// @Summary Get alert by ID
// @Tags security
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param alertId path string true "Alert ID"
// @Success 200 {object} AlertResponse
// @Router /festivals/{festivalId}/security/alerts/{alertId} [get]
func (h *Handler) GetAlert(c *gin.Context) {
	alertID, err := uuid.Parse(c.Param("alertId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ALERT_ID", "Invalid alert ID", nil)
		return
	}

	alert, err := h.service.GetAlertByID(c.Request.Context(), alertID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Alert not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, alert.ToResponse())
}

// UpdateAlert updates an alert
// @Summary Update alert
// @Tags security
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param alertId path string true "Alert ID"
// @Param request body UpdateAlertRequest true "Update data"
// @Success 200 {object} AlertResponse
// @Router /festivals/{festivalId}/security/alerts/{alertId} [patch]
func (h *Handler) UpdateAlert(c *gin.Context) {
	alertID, err := uuid.Parse(c.Param("alertId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ALERT_ID", "Invalid alert ID", nil)
		return
	}

	var req UpdateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	alert, err := h.service.UpdateAlert(c.Request.Context(), alertID, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Alert not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, alert.ToResponse())
}

// AcknowledgeAlert acknowledges an alert
// @Summary Acknowledge alert
// @Tags security
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param alertId path string true "Alert ID"
// @Success 200 {object} AlertResponse
// @Router /festivals/{festivalId}/security/alerts/{alertId}/acknowledge [post]
func (h *Handler) AcknowledgeAlert(c *gin.Context) {
	alertID, err := uuid.Parse(c.Param("alertId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ALERT_ID", "Invalid alert ID", nil)
		return
	}

	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		response.Unauthorized(c, "Authentication required")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		response.Unauthorized(c, "Invalid user ID")
		return
	}

	alert, err := h.service.AcknowledgeAlert(c.Request.Context(), alertID, userID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Alert not found")
			return
		}
		if appErr, ok := err.(*errors.AppError); ok {
			response.BadRequest(c, appErr.Code, appErr.Message, nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, alert.ToResponse())
}

// AssignAlert assigns an alert to a staff member
// @Summary Assign alert
// @Tags security
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param alertId path string true "Alert ID"
// @Param request body AssignAlertRequest true "Assignment data"
// @Success 200 {object} AlertResponse
// @Router /festivals/{festivalId}/security/alerts/{alertId}/assign [post]
func (h *Handler) AssignAlert(c *gin.Context) {
	alertID, err := uuid.Parse(c.Param("alertId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ALERT_ID", "Invalid alert ID", nil)
		return
	}

	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		response.Unauthorized(c, "Authentication required")
		return
	}

	assignedBy, err := uuid.Parse(userIDStr)
	if err != nil {
		response.Unauthorized(c, "Invalid user ID")
		return
	}

	var req struct {
		AssignedTo uuid.UUID `json:"assignedTo" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	alert, err := h.service.AssignAlert(c.Request.Context(), alertID, req.AssignedTo, assignedBy)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Alert not found")
			return
		}
		if appErr, ok := err.(*errors.AppError); ok {
			response.BadRequest(c, appErr.Code, appErr.Message, nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, alert.ToResponse())
}

// ResolveAlert resolves an alert
// @Summary Resolve alert
// @Tags security
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param alertId path string true "Alert ID"
// @Param request body ResolveAlertRequest true "Resolution data"
// @Success 200 {object} AlertResponse
// @Router /festivals/{festivalId}/security/alerts/{alertId}/resolve [post]
func (h *Handler) ResolveAlert(c *gin.Context) {
	alertID, err := uuid.Parse(c.Param("alertId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ALERT_ID", "Invalid alert ID", nil)
		return
	}

	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		response.Unauthorized(c, "Authentication required")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		response.Unauthorized(c, "Invalid user ID")
		return
	}

	var req ResolveAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	alert, err := h.service.ResolveAlert(c.Request.Context(), alertID, userID, req.Resolution)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Alert not found")
			return
		}
		if appErr, ok := err.(*errors.AppError); ok {
			response.BadRequest(c, appErr.Code, appErr.Message, nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, alert.ToResponse())
}

// CancelAlert cancels an alert
// @Summary Cancel alert
// @Tags security
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param alertId path string true "Alert ID"
// @Param request body CancelAlertRequest true "Cancellation data"
// @Success 200 {object} AlertResponse
// @Router /festivals/{festivalId}/security/alerts/{alertId}/cancel [post]
func (h *Handler) CancelAlert(c *gin.Context) {
	alertID, err := uuid.Parse(c.Param("alertId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ALERT_ID", "Invalid alert ID", nil)
		return
	}

	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		response.Unauthorized(c, "Authentication required")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		response.Unauthorized(c, "Invalid user ID")
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	alert, err := h.service.CancelAlert(c.Request.Context(), alertID, userID, req.Reason)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Alert not found")
			return
		}
		if appErr, ok := err.(*errors.AppError); ok {
			response.BadRequest(c, appErr.Code, appErr.Message, nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, alert.ToResponse())
}

// GetMyAlerts returns alerts created by the current user
// @Summary Get my alerts
// @Tags security
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} AlertResponse
// @Router /my/alerts [get]
func (h *Handler) GetMyAlerts(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		response.Unauthorized(c, "Authentication required")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		response.Unauthorized(c, "Invalid user ID")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	alerts, total, err := h.service.GetUserAlerts(c.Request.Context(), userID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]AlertResponse, len(alerts))
	for i, a := range alerts {
		items[i] = a.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// Zone handlers

// GetZones returns security zones for a festival
// @Summary Get security zones
// @Tags security
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Success 200 {array} SecurityZoneResponse
// @Router /festivals/{festivalId}/security/zones [get]
func (h *Handler) GetZones(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	zones, err := h.service.GetZonesByFestival(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]SecurityZoneResponse, len(zones))
	for i, z := range zones {
		items[i] = z.ToResponse()
	}

	response.OK(c, items)
}

// CreateZone creates a new security zone
// @Summary Create security zone
// @Tags security
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param request body CreateZoneRequest true "Zone data"
// @Success 201 {object} SecurityZoneResponse
// @Router /festivals/{festivalId}/security/zones [post]
func (h *Handler) CreateZone(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
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

// GetZone returns a specific zone
// @Summary Get zone by ID
// @Tags security
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param zoneId path string true "Zone ID"
// @Success 200 {object} SecurityZoneResponse
// @Router /festivals/{festivalId}/security/zones/{zoneId} [get]
func (h *Handler) GetZone(c *gin.Context) {
	zoneID, err := uuid.Parse(c.Param("zoneId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ZONE_ID", "Invalid zone ID", nil)
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

// UpdateZone updates a security zone
// @Summary Update zone
// @Tags security
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param zoneId path string true "Zone ID"
// @Param request body UpdateZoneRequest true "Update data"
// @Success 200 {object} SecurityZoneResponse
// @Router /festivals/{festivalId}/security/zones/{zoneId} [patch]
func (h *Handler) UpdateZone(c *gin.Context) {
	zoneID, err := uuid.Parse(c.Param("zoneId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ZONE_ID", "Invalid zone ID", nil)
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

// DeleteZone deletes a security zone
// @Summary Delete zone
// @Tags security
// @Param festivalId path string true "Festival ID"
// @Param zoneId path string true "Zone ID"
// @Success 204
// @Router /festivals/{festivalId}/security/zones/{zoneId} [delete]
func (h *Handler) DeleteZone(c *gin.Context) {
	zoneID, err := uuid.Parse(c.Param("zoneId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ZONE_ID", "Invalid zone ID", nil)
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

// AssignAlertRequest represents a request to assign an alert
type AssignAlertRequest struct {
	AssignedTo uuid.UUID `json:"assignedTo" binding:"required"`
}

// CancelAlertRequest represents a request to cancel an alert
type CancelAlertRequest struct {
	Reason string `json:"reason" binding:"required"`
}
