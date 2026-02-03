package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// Handler handles API key and webhook HTTP requests
type Handler struct {
	service *Service
}

// NewHandler creates a new API handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers the API management routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	api := r.Group("/api")
	{
		// API Keys
		keys := api.Group("/keys")
		{
			keys.POST("", h.CreateAPIKey)
			keys.GET("", h.ListAPIKeys)
			keys.GET("/:keyId", h.GetAPIKey)
			keys.PATCH("/:keyId", h.UpdateAPIKey)
			keys.DELETE("/:keyId", h.DeleteAPIKey)
			keys.POST("/:keyId/revoke", h.RevokeAPIKey)
			keys.POST("/:keyId/rotate", h.RotateAPIKey)
			keys.GET("/:keyId/usage", h.GetAPIKeyUsage)
		}

		// Webhooks
		webhooks := api.Group("/webhooks")
		{
			webhooks.POST("", h.CreateWebhook)
			webhooks.GET("", h.ListWebhooks)
			webhooks.GET("/:webhookId", h.GetWebhook)
			webhooks.PATCH("/:webhookId", h.UpdateWebhook)
			webhooks.DELETE("/:webhookId", h.DeleteWebhook)
			webhooks.POST("/:webhookId/test", h.TestWebhook)
			webhooks.GET("/:webhookId/deliveries", h.GetWebhookDeliveries)
		}

		// Info endpoints
		api.GET("/permissions", h.ListPermissions)
		api.GET("/events", h.ListWebhookEvents)
	}
}

// =====================
// API Key Handlers
// =====================

// CreateAPIKey creates a new API key
// @Summary Create a new API key
// @Tags api-keys
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param request body CreateAPIKeyRequest true "API key data"
// @Success 201 {object} APIKeyCreatedResponse
// @Router /festivals/{festivalId}/api/keys [post]
func (h *Handler) CreateAPIKey(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req CreateAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	// Get creator ID from context
	var createdBy *uuid.UUID
	if userID := c.GetString("user_id"); userID != "" {
		if id, err := uuid.Parse(userID); err == nil {
			createdBy = &id
		}
	}

	result, err := h.service.GenerateAPIKey(c.Request.Context(), festivalID, req, createdBy)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, result)
}

// ListAPIKeys lists all API keys for a festival
// @Summary List API keys
// @Tags api-keys
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} APIKeyResponse
// @Router /festivals/{festivalId}/api/keys [get]
func (h *Handler) ListAPIKeys(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	keys, total, err := h.service.ListAPIKeys(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]APIKeyResponse, len(keys))
	for i, k := range keys {
		items[i] = k.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetAPIKey gets an API key by ID
// @Summary Get API key
// @Tags api-keys
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param keyId path string true "API Key ID"
// @Success 200 {object} APIKeyResponse
// @Router /festivals/{festivalId}/api/keys/{keyId} [get]
func (h *Handler) GetAPIKey(c *gin.Context) {
	keyID, err := uuid.Parse(c.Param("keyId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid API key ID", nil)
		return
	}

	key, err := h.service.GetAPIKey(c.Request.Context(), keyID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "API key not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, key.ToResponse())
}

// UpdateAPIKey updates an API key
// @Summary Update API key
// @Tags api-keys
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param keyId path string true "API Key ID"
// @Param request body UpdateAPIKeyRequest true "Update data"
// @Success 200 {object} APIKeyResponse
// @Router /festivals/{festivalId}/api/keys/{keyId} [patch]
func (h *Handler) UpdateAPIKey(c *gin.Context) {
	keyID, err := uuid.Parse(c.Param("keyId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid API key ID", nil)
		return
	}

	var req UpdateAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	key, err := h.service.UpdateAPIKey(c.Request.Context(), keyID, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "API key not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, key.ToResponse())
}

// DeleteAPIKey deletes an API key
// @Summary Delete API key
// @Tags api-keys
// @Param festivalId path string true "Festival ID"
// @Param keyId path string true "API Key ID"
// @Success 204
// @Router /festivals/{festivalId}/api/keys/{keyId} [delete]
func (h *Handler) DeleteAPIKey(c *gin.Context) {
	keyID, err := uuid.Parse(c.Param("keyId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid API key ID", nil)
		return
	}

	if err := h.service.DeleteAPIKey(c.Request.Context(), keyID); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "API key not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// RevokeAPIKey revokes an API key
// @Summary Revoke API key
// @Tags api-keys
// @Param festivalId path string true "Festival ID"
// @Param keyId path string true "API Key ID"
// @Success 200 {object} APIKeyResponse
// @Router /festivals/{festivalId}/api/keys/{keyId}/revoke [post]
func (h *Handler) RevokeAPIKey(c *gin.Context) {
	keyID, err := uuid.Parse(c.Param("keyId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid API key ID", nil)
		return
	}

	if err := h.service.RevokeAPIKey(c.Request.Context(), keyID); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "API key not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	key, _ := h.service.GetAPIKey(c.Request.Context(), keyID)
	response.OK(c, key.ToResponse())
}

// RotateAPIKey generates a new key while keeping the same configuration
// @Summary Rotate API key
// @Tags api-keys
// @Param festivalId path string true "Festival ID"
// @Param keyId path string true "API Key ID"
// @Success 200 {object} APIKeyCreatedResponse
// @Router /festivals/{festivalId}/api/keys/{keyId}/rotate [post]
func (h *Handler) RotateAPIKey(c *gin.Context) {
	keyID, err := uuid.Parse(c.Param("keyId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid API key ID", nil)
		return
	}

	result, err := h.service.RotateAPIKey(c.Request.Context(), keyID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "API key not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, result)
}

// GetAPIKeyUsage gets usage statistics for an API key
// @Summary Get API key usage
// @Tags api-keys
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param keyId path string true "API Key ID"
// @Param period query string false "Period (day, week, month, year)" default(month)
// @Success 200 {object} APIUsageResponse
// @Router /festivals/{festivalId}/api/keys/{keyId}/usage [get]
func (h *Handler) GetAPIKeyUsage(c *gin.Context) {
	keyID, err := uuid.Parse(c.Param("keyId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid API key ID", nil)
		return
	}

	period := c.DefaultQuery("period", "month")

	usage, err := h.service.GetUsageStats(c.Request.Context(), keyID, period)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, usage)
}

// =====================
// Webhook Handlers
// =====================

// CreateWebhook creates a new webhook
// @Summary Create a new webhook
// @Tags webhooks
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param request body CreateWebhookRequest true "Webhook data"
// @Success 201 {object} WebhookCreatedResponse
// @Router /festivals/{festivalId}/api/webhooks [post]
func (h *Handler) CreateWebhook(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req CreateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	// Get API key ID from query or context
	apiKeyIDStr := c.Query("api_key_id")
	if apiKeyIDStr == "" {
		// Try to get from context (set by API key middleware)
		if keyID, exists := c.Get("api_key_id"); exists {
			apiKeyIDStr = keyID.(string)
		}
	}

	apiKeyID, err := uuid.Parse(apiKeyIDStr)
	if err != nil {
		response.BadRequest(c, "MISSING_API_KEY", "API key ID is required", nil)
		return
	}

	result, err := h.service.RegisterWebhook(c.Request.Context(), apiKeyID, festivalID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, result)
}

// ListWebhooks lists all webhooks for a festival
// @Summary List webhooks
// @Tags webhooks
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} WebhookResponse
// @Router /festivals/{festivalId}/api/webhooks [get]
func (h *Handler) ListWebhooks(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	webhooks, total, err := h.service.ListWebhooks(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]WebhookResponse, len(webhooks))
	for i, w := range webhooks {
		items[i] = w.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetWebhook gets a webhook by ID
// @Summary Get webhook
// @Tags webhooks
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param webhookId path string true "Webhook ID"
// @Success 200 {object} WebhookResponse
// @Router /festivals/{festivalId}/api/webhooks/{webhookId} [get]
func (h *Handler) GetWebhook(c *gin.Context) {
	webhookID, err := uuid.Parse(c.Param("webhookId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid webhook ID", nil)
		return
	}

	webhook, err := h.service.GetWebhook(c.Request.Context(), webhookID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Webhook not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, webhook.ToResponse())
}

// UpdateWebhook updates a webhook
// @Summary Update webhook
// @Tags webhooks
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param webhookId path string true "Webhook ID"
// @Param request body UpdateWebhookRequest true "Update data"
// @Success 200 {object} WebhookResponse
// @Router /festivals/{festivalId}/api/webhooks/{webhookId} [patch]
func (h *Handler) UpdateWebhook(c *gin.Context) {
	webhookID, err := uuid.Parse(c.Param("webhookId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid webhook ID", nil)
		return
	}

	var req UpdateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	webhook, err := h.service.UpdateWebhook(c.Request.Context(), webhookID, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Webhook not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, webhook.ToResponse())
}

// DeleteWebhook deletes a webhook
// @Summary Delete webhook
// @Tags webhooks
// @Param festivalId path string true "Festival ID"
// @Param webhookId path string true "Webhook ID"
// @Success 204
// @Router /festivals/{festivalId}/api/webhooks/{webhookId} [delete]
func (h *Handler) DeleteWebhook(c *gin.Context) {
	webhookID, err := uuid.Parse(c.Param("webhookId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid webhook ID", nil)
		return
	}

	if err := h.service.DeleteWebhook(c.Request.Context(), webhookID); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Webhook not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// TestWebhook sends a test event to a webhook
// @Summary Test webhook
// @Tags webhooks
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param webhookId path string true "Webhook ID"
// @Param request body TestWebhookRequest true "Test data"
// @Success 200 {object} WebhookDeliveryResponse
// @Router /festivals/{festivalId}/api/webhooks/{webhookId}/test [post]
func (h *Handler) TestWebhook(c *gin.Context) {
	webhookID, err := uuid.Parse(c.Param("webhookId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid webhook ID", nil)
		return
	}

	var req TestWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	delivery, err := h.service.TestWebhook(c.Request.Context(), webhookID, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Webhook not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, delivery.ToResponse())
}

// GetWebhookDeliveries gets recent deliveries for a webhook
// @Summary Get webhook deliveries
// @Tags webhooks
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param webhookId path string true "Webhook ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} WebhookDeliveryResponse
// @Router /festivals/{festivalId}/api/webhooks/{webhookId}/deliveries [get]
func (h *Handler) GetWebhookDeliveries(c *gin.Context) {
	webhookID, err := uuid.Parse(c.Param("webhookId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid webhook ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	deliveries, total, err := h.service.GetWebhookDeliveries(c.Request.Context(), webhookID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]WebhookDeliveryResponse, len(deliveries))
	for i, d := range deliveries {
		items[i] = d.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// =====================
// Info Handlers
// =====================

// ListPermissions lists all available API permissions
// @Summary List available permissions
// @Tags api
// @Produce json
// @Success 200 {array} Permission
// @Router /festivals/{festivalId}/api/permissions [get]
func (h *Handler) ListPermissions(c *gin.Context) {
	permissions := AllPermissions()
	response.OK(c, permissions)
}

// ListWebhookEvents lists all available webhook event types
// @Summary List available webhook events
// @Tags api
// @Produce json
// @Success 200 {array} WebhookEventType
// @Router /festivals/{festivalId}/api/events [get]
func (h *Handler) ListWebhookEvents(c *gin.Context) {
	events := AllWebhookEvents()
	response.OK(c, events)
}
