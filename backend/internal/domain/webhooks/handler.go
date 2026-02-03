package webhooks

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// Handler handles HTTP requests for webhook management
type Handler struct {
	service *Service
}

// NewHandler creates a new webhooks handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers the webhook routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	webhooks := r.Group("/festivals/:festivalId/webhooks")
	{
		webhooks.POST("", h.Create)
		webhooks.GET("", h.List)
		webhooks.GET("/:webhookId", h.GetByID)
		webhooks.PATCH("/:webhookId", h.Update)
		webhooks.DELETE("/:webhookId", h.Delete)
		webhooks.GET("/:webhookId/deliveries", h.GetDeliveries)
		webhooks.POST("/:webhookId/test", h.Test)
		webhooks.POST("/:webhookId/regenerate-secret", h.RegenerateSecret)
	}
}

// Create creates a new webhook
// @Summary Create a new webhook
// @Description Create a new webhook for a festival. The secret is only returned once at creation time.
// @Tags webhooks
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param request body CreateWebhookRequest true "Webhook data"
// @Success 201 {object} response.Response{data=WebhookWithSecretResponse} "Webhook created successfully"
// @Failure 400 {object} response.ErrorResponse "Invalid request body"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/webhooks [post]
func (h *Handler) Create(c *gin.Context) {
	festivalIDStr := c.Param("festivalId")
	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req CreateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	webhook, err := h.service.CreateWebhook(c.Request.Context(), festivalID, req)
	if err != nil {
		if errors.IsValidation(err) {
			response.BadRequest(c, "VALIDATION_ERROR", err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, webhook.ToResponseWithSecret())
}

// List returns all webhooks for a festival
// @Summary List webhooks
// @Description Get all webhooks for a festival
// @Tags webhooks
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Success 200 {object} response.Response{data=[]WebhookResponse} "List of webhooks"
// @Failure 400 {object} response.ErrorResponse "Invalid festival ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/webhooks [get]
func (h *Handler) List(c *gin.Context) {
	festivalIDStr := c.Param("festivalId")
	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	webhooks, err := h.service.ListWebhooks(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]WebhookResponse, len(webhooks))
	for i, w := range webhooks {
		items[i] = w.ToResponse()
	}

	response.OK(c, items)
}

// GetByID returns a specific webhook
// @Summary Get webhook by ID
// @Description Get details of a specific webhook
// @Tags webhooks
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param webhookId path string true "Webhook ID" format(uuid)
// @Success 200 {object} response.Response{data=WebhookResponse} "Webhook details"
// @Failure 400 {object} response.ErrorResponse "Invalid ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "Webhook not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/webhooks/{webhookId} [get]
func (h *Handler) GetByID(c *gin.Context) {
	webhookIDStr := c.Param("webhookId")
	webhookID, err := uuid.Parse(webhookIDStr)
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

// Update updates a webhook
// @Summary Update webhook
// @Description Update an existing webhook
// @Tags webhooks
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param webhookId path string true "Webhook ID" format(uuid)
// @Param request body UpdateWebhookRequest true "Update data"
// @Success 200 {object} response.Response{data=WebhookResponse} "Webhook updated successfully"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "Webhook not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/webhooks/{webhookId} [patch]
func (h *Handler) Update(c *gin.Context) {
	webhookIDStr := c.Param("webhookId")
	webhookID, err := uuid.Parse(webhookIDStr)
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
		if errors.IsValidation(err) {
			response.BadRequest(c, "VALIDATION_ERROR", err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, webhook.ToResponse())
}

// Delete deletes a webhook
// @Summary Delete webhook
// @Description Delete a webhook and all its delivery logs
// @Tags webhooks
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param webhookId path string true "Webhook ID" format(uuid)
// @Success 204 "Webhook deleted successfully"
// @Failure 400 {object} response.ErrorResponse "Invalid ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "Webhook not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/webhooks/{webhookId} [delete]
func (h *Handler) Delete(c *gin.Context) {
	webhookIDStr := c.Param("webhookId")
	webhookID, err := uuid.Parse(webhookIDStr)
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

// GetDeliveries returns delivery logs for a webhook
// @Summary Get webhook delivery logs
// @Description Get paginated delivery logs for a webhook
// @Tags webhooks
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param webhookId path string true "Webhook ID" format(uuid)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} response.Response{data=[]WebhookDeliveryResponse,meta=response.Meta} "List of deliveries"
// @Failure 400 {object} response.ErrorResponse "Invalid ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "Webhook not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/webhooks/{webhookId}/deliveries [get]
func (h *Handler) GetDeliveries(c *gin.Context) {
	webhookIDStr := c.Param("webhookId")
	webhookID, err := uuid.Parse(webhookIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid webhook ID", nil)
		return
	}

	// Check webhook exists
	_, err = h.service.GetWebhook(c.Request.Context(), webhookID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Webhook not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	deliveries, total, err := h.service.GetDeliveryLogs(c.Request.Context(), webhookID, page, perPage)
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

// Test sends a test event to a webhook
// @Summary Test webhook
// @Description Send a test event to a webhook to verify it's working
// @Tags webhooks
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param webhookId path string true "Webhook ID" format(uuid)
// @Param request body TestWebhookRequest false "Test data"
// @Success 200 {object} response.Response{data=WebhookDeliveryResponse} "Test delivery result"
// @Failure 400 {object} response.ErrorResponse "Invalid ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "Webhook not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/webhooks/{webhookId}/test [post]
func (h *Handler) Test(c *gin.Context) {
	webhookIDStr := c.Param("webhookId")
	webhookID, err := uuid.Parse(webhookIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid webhook ID", nil)
		return
	}

	var req TestWebhookRequest
	// Allow empty body for simple test
	_ = c.ShouldBindJSON(&req)

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

// RegenerateSecret generates a new secret for a webhook
// @Summary Regenerate webhook secret
// @Description Generate a new signing secret for a webhook
// @Tags webhooks
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param webhookId path string true "Webhook ID" format(uuid)
// @Success 200 {object} response.Response{data=WebhookWithSecretResponse} "Webhook with new secret"
// @Failure 400 {object} response.ErrorResponse "Invalid ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "Webhook not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/webhooks/{webhookId}/regenerate-secret [post]
func (h *Handler) RegenerateSecret(c *gin.Context) {
	webhookIDStr := c.Param("webhookId")
	webhookID, err := uuid.Parse(webhookIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid webhook ID", nil)
		return
	}

	webhook, err := h.service.RegenerateSecret(c.Request.Context(), webhookID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Webhook not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, webhook.ToResponseWithSecret())
}
