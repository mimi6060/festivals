package notification

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// Handler handles HTTP requests for notification operations
type Handler struct {
	prefsService *PreferencesService
	pushService  *PushService
	hub          *NotificationHub
}

// NewHandler creates a new notification handler
func NewHandler(prefsService *PreferencesService, pushService *PushService, hub *NotificationHub) *Handler {
	return &Handler{
		prefsService: prefsService,
		pushService:  pushService,
		hub:          hub,
	}
}

// RegisterRoutes registers the notification routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	notifications := r.Group("/notifications")
	{
		// Push token management
		notifications.POST("/token", h.RegisterPushToken)
		notifications.DELETE("/token", h.UnregisterPushToken)

		// User notifications
		notifications.GET("", h.ListNotifications)
		notifications.GET("/unread-count", h.GetUnreadCount)
		notifications.POST("/:id/read", h.MarkAsRead)
		notifications.POST("/read-all", h.MarkAllAsRead)
		notifications.DELETE("/:id", h.DeleteNotification)

		// Preferences
		notifications.GET("/preferences", h.GetPreferences)
		notifications.PATCH("/preferences", h.UpdatePreferences)

		// Topics
		notifications.POST("/topics/:topic/subscribe", h.SubscribeToTopic)
		notifications.POST("/topics/:topic/unsubscribe", h.UnsubscribeFromTopic)

		// Test endpoint (only in dev)
		notifications.POST("/test", h.SendTestNotification)
	}
}

// RegisterPushTokenRequest represents the request to register a push token
type RegisterPushTokenRequest struct {
	Token      string `json:"token" binding:"required"`
	Platform   string `json:"platform" binding:"required,oneof=ios android web"`
	DeviceID   string `json:"deviceId" binding:"required"`
	DeviceName string `json:"deviceName,omitempty"`
	AppVersion string `json:"appVersion,omitempty"`
}

// RegisterPushToken registers a push notification token for the authenticated user
// @Summary Register push token
// @Tags notifications
// @Accept json
// @Produce json
// @Param request body RegisterPushTokenRequest true "Push token data"
// @Success 200 {object} map[string]bool
// @Router /notifications/token [post]
func (h *Handler) RegisterPushToken(c *gin.Context) {
	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	var req RegisterPushTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	if err := h.prefsService.RegisterDeviceToken(
		c.Request.Context(),
		userID,
		req.Token,
		req.Platform,
		req.DeviceID,
		req.AppVersion,
	); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{"success": true, "message": "Push token registered"})
}

// UnregisterPushTokenRequest represents the request to unregister a push token
type UnregisterPushTokenRequest struct {
	Token string `json:"token" binding:"required"`
}

// UnregisterPushToken removes a push notification token
// @Summary Unregister push token
// @Tags notifications
// @Accept json
// @Produce json
// @Param request body UnregisterPushTokenRequest true "Push token to remove"
// @Success 200 {object} map[string]bool
// @Router /notifications/token [delete]
func (h *Handler) UnregisterPushToken(c *gin.Context) {
	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	var req UnregisterPushTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	if err := h.prefsService.UnregisterDeviceToken(c.Request.Context(), userID, req.Token); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{"success": true, "message": "Push token unregistered"})
}

// ListNotifications returns the user's notifications
// @Summary List notifications
// @Tags notifications
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {array} InAppNotification
// @Router /notifications [get]
func (h *Handler) ListNotifications(c *gin.Context) {
	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	// This would typically fetch from a notifications table
	// For now, return empty array - notifications are delivered via push/in-app
	response.OKWithMeta(c, []interface{}{}, &response.Meta{
		Total:   0,
		Page:    page,
		PerPage: limit,
	})

	_ = userID // Would be used to fetch user's notifications
}

// GetUnreadCount returns the count of unread notifications
// @Summary Get unread notification count
// @Tags notifications
// @Produce json
// @Success 200 {object} map[string]int
// @Router /notifications/unread-count [get]
func (h *Handler) GetUnreadCount(c *gin.Context) {
	_, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	// This would typically count from a notifications table
	response.OK(c, gin.H{"count": 0})
}

// MarkAsRead marks a notification as read
// @Summary Mark notification as read
// @Tags notifications
// @Produce json
// @Param id path string true "Notification ID"
// @Success 200 {object} map[string]bool
// @Router /notifications/{id}/read [post]
func (h *Handler) MarkAsRead(c *gin.Context) {
	_, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	notificationID := c.Param("id")
	if _, err := uuid.Parse(notificationID); err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid notification ID", nil)
		return
	}

	// This would typically update the notification in a database
	response.OK(c, gin.H{"success": true})
}

// MarkAllAsRead marks all notifications as read
// @Summary Mark all notifications as read
// @Tags notifications
// @Produce json
// @Success 200 {object} map[string]bool
// @Router /notifications/read-all [post]
func (h *Handler) MarkAllAsRead(c *gin.Context) {
	_, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	// This would typically update all notifications in a database
	response.OK(c, gin.H{"success": true})
}

// DeleteNotification deletes a notification
// @Summary Delete notification
// @Tags notifications
// @Param id path string true "Notification ID"
// @Success 204
// @Router /notifications/{id} [delete]
func (h *Handler) DeleteNotification(c *gin.Context) {
	_, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	notificationID := c.Param("id")
	if _, err := uuid.Parse(notificationID); err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid notification ID", nil)
		return
	}

	// This would typically delete from a database
	c.Status(http.StatusNoContent)
}

// GetPreferences returns the user's notification preferences
// @Summary Get notification preferences
// @Tags notifications
// @Produce json
// @Success 200 {object} UserPreferencesResponse
// @Router /notifications/preferences [get]
func (h *Handler) GetPreferences(c *gin.Context) {
	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	prefs, err := h.prefsService.GetUserPreferences(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, prefs.ToResponse())
}

// UpdatePreferences updates the user's notification preferences
// @Summary Update notification preferences
// @Tags notifications
// @Accept json
// @Produce json
// @Param request body UpdateUserPreferencesRequest true "Preferences update"
// @Success 200 {object} UserPreferencesResponse
// @Router /notifications/preferences [patch]
func (h *Handler) UpdatePreferences(c *gin.Context) {
	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	var req UpdateUserPreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	prefs, err := h.prefsService.UpdatePreferences(c.Request.Context(), userID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, prefs.ToResponse())
}

// SubscribeToTopic subscribes the user to a notification topic
// @Summary Subscribe to topic
// @Tags notifications
// @Param topic path string true "Topic name"
// @Success 200 {object} map[string]bool
// @Router /notifications/topics/{topic}/subscribe [post]
func (h *Handler) SubscribeToTopic(c *gin.Context) {
	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	topic := c.Param("topic")
	if topic == "" {
		response.BadRequest(c, "INVALID_TOPIC", "Topic is required", nil)
		return
	}

	// Get user's device tokens
	tokens, err := h.prefsService.GetDeviceTokens(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	if len(tokens) == 0 {
		response.BadRequest(c, "NO_DEVICE_TOKEN", "No device token registered", nil)
		return
	}

	// Subscribe each token to the topic
	for _, dt := range tokens {
		if err := h.pushService.SubscribeToTopic(c.Request.Context(), dt.Token, topic); err != nil {
			// Log error but continue
			continue
		}
	}

	response.OK(c, gin.H{"success": true, "topic": topic})
}

// UnsubscribeFromTopic unsubscribes the user from a notification topic
// @Summary Unsubscribe from topic
// @Tags notifications
// @Param topic path string true "Topic name"
// @Success 200 {object} map[string]bool
// @Router /notifications/topics/{topic}/unsubscribe [post]
func (h *Handler) UnsubscribeFromTopic(c *gin.Context) {
	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	topic := c.Param("topic")
	if topic == "" {
		response.BadRequest(c, "INVALID_TOPIC", "Topic is required", nil)
		return
	}

	// Get user's device tokens
	tokens, err := h.prefsService.GetDeviceTokens(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Unsubscribe each token from the topic
	for _, dt := range tokens {
		if err := h.pushService.UnsubscribeFromTopic(c.Request.Context(), dt.Token, topic); err != nil {
			// Log error but continue
			continue
		}
	}

	response.OK(c, gin.H{"success": true, "topic": topic})
}

// SendTestNotification sends a test notification to the current user
// @Summary Send test notification
// @Tags notifications
// @Produce json
// @Success 200 {object} map[string]bool
// @Router /notifications/test [post]
func (h *Handler) SendTestNotification(c *gin.Context) {
	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	// Send a test push notification
	notification := &PushNotification{
		Title:    "Test Notification",
		Body:     "This is a test notification from Festivals app",
		Sound:    "default",
		Priority: "high",
		Data: map[string]string{
			"type": "test",
		},
	}

	messageID, err := h.pushService.SendToUser(c.Request.Context(), userID, notification)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{
		"success":   true,
		"messageId": messageID,
	})
}

// Helper to get user ID from context
func (h *Handler) getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		return uuid.Nil, errNotAuthenticated
	}
	return uuid.Parse(userIDStr)
}

var errNotAuthenticated = &authError{message: "User not authenticated"}

type authError struct {
	message string
}

func (e *authError) Error() string {
	return e.message
}
