package apikeys

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// Handler handles HTTP requests for API key management
type Handler struct {
	service *Service
}

// NewHandler creates a new API keys handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers the API key routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	apiKeys := r.Group("/festivals/:festivalId/api-keys")
	{
		apiKeys.POST("", h.Create)
		apiKeys.GET("", h.List)
		apiKeys.GET("/:keyId", h.GetByID)
		apiKeys.DELETE("/:keyId", h.Delete)
		apiKeys.POST("/:keyId/rotate", h.Rotate)
		apiKeys.POST("/:keyId/revoke", h.Revoke)
	}
}

// Create creates a new API key
// @Summary Create a new API key
// @Description Create a new API key for a festival. The full key is only returned once at creation time.
// @Tags api-keys
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param request body CreateAPIKeyRequest true "API key data"
// @Success 201 {object} response.Response{data=APIKeyCreatedResponse} "API key created successfully"
// @Failure 400 {object} response.ErrorResponse "Invalid request body"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "Festival not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/api-keys [post]
func (h *Handler) Create(c *gin.Context) {
	festivalIDStr := c.Param("festivalId")
	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req CreateAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	apiKey, fullKey, err := h.service.GenerateAPIKey(c.Request.Context(), festivalID, req)
	if err != nil {
		if errors.IsValidation(err) {
			response.BadRequest(c, "VALIDATION_ERROR", err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, apiKey.ToCreatedResponse(fullKey))
}

// List returns all API keys for a festival
// @Summary List API keys
// @Description Get all API keys for a festival (keys are masked)
// @Tags api-keys
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Success 200 {object} response.Response{data=[]APIKeyResponse} "List of API keys"
// @Failure 400 {object} response.ErrorResponse "Invalid festival ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/api-keys [get]
func (h *Handler) List(c *gin.Context) {
	festivalIDStr := c.Param("festivalId")
	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	apiKeys, err := h.service.ListAPIKeys(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Convert to responses (masked)
	items := make([]APIKeyResponse, len(apiKeys))
	for i, k := range apiKeys {
		items[i] = k.ToResponse()
	}

	response.OK(c, items)
}

// GetByID returns a specific API key
// @Summary Get API key by ID
// @Description Get details of a specific API key (key is masked)
// @Tags api-keys
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param keyId path string true "API Key ID" format(uuid)
// @Success 200 {object} response.Response{data=APIKeyResponse} "API key details"
// @Failure 400 {object} response.ErrorResponse "Invalid ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "API key not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/api-keys/{keyId} [get]
func (h *Handler) GetByID(c *gin.Context) {
	keyIDStr := c.Param("keyId")
	keyID, err := uuid.Parse(keyIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid API key ID", nil)
		return
	}

	apiKey, err := h.service.GetAPIKey(c.Request.Context(), keyID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "API key not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, apiKey.ToResponse())
}

// Delete permanently deletes an API key
// @Summary Delete API key
// @Description Permanently delete an API key
// @Tags api-keys
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param keyId path string true "API Key ID" format(uuid)
// @Success 204 "API key deleted successfully"
// @Failure 400 {object} response.ErrorResponse "Invalid ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "API key not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/api-keys/{keyId} [delete]
func (h *Handler) Delete(c *gin.Context) {
	keyIDStr := c.Param("keyId")
	keyID, err := uuid.Parse(keyIDStr)
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

// Rotate rotates an API key (creates new key, revokes old)
// @Summary Rotate API key
// @Description Create a new API key with the same settings and revoke the old one. The new key is only returned once.
// @Tags api-keys
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param keyId path string true "API Key ID" format(uuid)
// @Param request body RotateAPIKeyRequest false "Rotation options"
// @Success 201 {object} response.Response{data=APIKeyCreatedResponse} "New API key created"
// @Failure 400 {object} response.ErrorResponse "Invalid ID or request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "API key not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/api-keys/{keyId}/rotate [post]
func (h *Handler) Rotate(c *gin.Context) {
	keyIDStr := c.Param("keyId")
	keyID, err := uuid.Parse(keyIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid API key ID", nil)
		return
	}

	var req RotateAPIKeyRequest
	// Allow empty body for rotation without changes
	_ = c.ShouldBindJSON(&req)

	newKey, fullKey, err := h.service.RotateAPIKey(c.Request.Context(), keyID, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "API key not found")
			return
		}
		if errors.IsValidation(err) {
			response.BadRequest(c, "VALIDATION_ERROR", err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, newKey.ToCreatedResponse(fullKey))
}

// Revoke revokes an API key without deleting it
// @Summary Revoke API key
// @Description Revoke an API key, making it unusable but keeping the record
// @Tags api-keys
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param keyId path string true "API Key ID" format(uuid)
// @Success 200 {object} response.Response{data=APIKeyResponse} "API key revoked"
// @Failure 400 {object} response.ErrorResponse "Invalid ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden"
// @Failure 404 {object} response.ErrorResponse "API key not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/api-keys/{keyId}/revoke [post]
func (h *Handler) Revoke(c *gin.Context) {
	keyIDStr := c.Param("keyId")
	keyID, err := uuid.Parse(keyIDStr)
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

	// Get updated key
	apiKey, err := h.service.GetAPIKey(c.Request.Context(), keyID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, apiKey.ToResponse())
}
