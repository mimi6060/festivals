package nfc

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
	return &Handler{
		service: service,
	}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// NFC tag management routes
	nfc := r.Group("/nfc")
	{
		nfc.POST("/activate", h.ActivateTag)
		nfc.POST("/register", h.RegisterTag)
		nfc.GET("/:uid", h.GetTag)
		nfc.POST("/:uid/deactivate", h.DeactivateTag)
		nfc.POST("/:uid/block", h.BlockTag)
		nfc.POST("/:uid/unblock", h.UnblockTag)
		nfc.POST("/:uid/transfer", h.TransferTag)
		nfc.POST("/:uid/validate", h.ValidateTagForPayment)
		nfc.GET("/:uid/offline-token", h.GenerateOfflineToken)
	}

	// Festival-scoped NFC routes
	festivals := r.Group("/festivals")
	{
		festivals.GET("/:id/nfc/tags", h.ListFestivalTags)
		festivals.GET("/:id/nfc/tags/active", h.GetActiveTags)
		festivals.POST("/:id/nfc/bulk-register", h.BulkRegisterTags)
	}

	// Offline transaction sync routes
	sync := r.Group("/nfc/sync")
	{
		sync.POST("/transaction", h.SyncOfflineTransaction)
	}
}

// ActivateTag activates an NFC tag and links it to a wallet
// POST /nfc/activate
func (h *Handler) ActivateTag(c *gin.Context) {
	var req NFCActivationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	staffID := getStaffID(c)

	tag, err := h.service.ActivateTag(c.Request.Context(), req, staffID)
	if err != nil {
		if err == errors.ErrWalletNotFound {
			response.NotFound(c, "Wallet not found")
			return
		}
		response.BadRequest(c, "ACTIVATION_FAILED", err.Error(), nil)
		return
	}

	response.Created(c, tag.ToResponse())
}

// RegisterTag registers a new NFC tag without activating it
// POST /nfc/register
func (h *Handler) RegisterTag(c *gin.Context) {
	var req struct {
		UID        string    `json:"uid" binding:"required"`
		FestivalID uuid.UUID `json:"festivalId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	tag, err := h.service.RegisterTag(c.Request.Context(), req.UID, req.FestivalID)
	if err != nil {
		if err == errors.ErrAlreadyExists {
			response.Conflict(c, "TAG_EXISTS", "NFC tag already registered")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, tag.ToResponse())
}

// GetTag retrieves an NFC tag by its UID
// GET /nfc/:uid
func (h *Handler) GetTag(c *gin.Context) {
	uid := c.Param("uid")
	if uid == "" {
		response.BadRequest(c, "INVALID_UID", "NFC tag UID is required", nil)
		return
	}

	tag, err := h.service.GetTag(c.Request.Context(), uid)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "NFC tag not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, tag.ToResponse())
}

// DeactivateTag deactivates an NFC tag
// POST /nfc/:uid/deactivate
func (h *Handler) DeactivateTag(c *gin.Context) {
	uid := c.Param("uid")
	if uid == "" {
		response.BadRequest(c, "INVALID_UID", "NFC tag UID is required", nil)
		return
	}

	tag, err := h.service.DeactivateTag(c.Request.Context(), uid)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "NFC tag not found")
			return
		}
		response.BadRequest(c, "DEACTIVATION_FAILED", err.Error(), nil)
		return
	}

	response.OK(c, tag.ToResponse())
}

// BlockTag blocks an NFC tag
// POST /nfc/:uid/block
func (h *Handler) BlockTag(c *gin.Context) {
	uid := c.Param("uid")
	if uid == "" {
		response.BadRequest(c, "INVALID_UID", "NFC tag UID is required", nil)
		return
	}

	var req NFCBlockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	tag, err := h.service.BlockTag(c.Request.Context(), uid, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "NFC tag not found")
			return
		}
		response.BadRequest(c, "BLOCK_FAILED", err.Error(), nil)
		return
	}

	response.OK(c, tag.ToResponse())
}

// UnblockTag unblocks a blocked NFC tag
// POST /nfc/:uid/unblock
func (h *Handler) UnblockTag(c *gin.Context) {
	uid := c.Param("uid")
	if uid == "" {
		response.BadRequest(c, "INVALID_UID", "NFC tag UID is required", nil)
		return
	}

	tag, err := h.service.UnblockTag(c.Request.Context(), uid)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "NFC tag not found")
			return
		}
		response.BadRequest(c, "UNBLOCK_FAILED", err.Error(), nil)
		return
	}

	response.OK(c, tag.ToResponse())
}

// TransferTag transfers an NFC tag to a new wallet
// POST /nfc/:uid/transfer
func (h *Handler) TransferTag(c *gin.Context) {
	uid := c.Param("uid")
	if uid == "" {
		response.BadRequest(c, "INVALID_UID", "NFC tag UID is required", nil)
		return
	}

	var req NFCTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	tag, err := h.service.TransferTag(c.Request.Context(), uid, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "NFC tag not found")
			return
		}
		if err == errors.ErrWalletNotFound {
			response.NotFound(c, "Target wallet not found")
			return
		}
		response.BadRequest(c, "TRANSFER_FAILED", err.Error(), nil)
		return
	}

	response.OK(c, tag.ToResponse())
}

// ValidateTagForPayment validates if an NFC tag can be used for payment
// POST /nfc/:uid/validate
func (h *Handler) ValidateTagForPayment(c *gin.Context) {
	uid := c.Param("uid")
	if uid == "" {
		response.BadRequest(c, "INVALID_UID", "NFC tag UID is required", nil)
		return
	}

	var req struct {
		Amount int64 `json:"amount" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	result, err := h.service.ValidateTagForPayment(c.Request.Context(), uid, req.Amount)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, result)
}

// GenerateOfflineToken generates a signed offline token for the NFC tag
// GET /nfc/:uid/offline-token
func (h *Handler) GenerateOfflineToken(c *gin.Context) {
	uid := c.Param("uid")
	if uid == "" {
		response.BadRequest(c, "INVALID_UID", "NFC tag UID is required", nil)
		return
	}

	token, err := h.service.GenerateOfflineToken(c.Request.Context(), uid)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "NFC tag not found")
			return
		}
		if err == errors.ErrWalletNotFound {
			response.NotFound(c, "Linked wallet not found")
			return
		}
		response.BadRequest(c, "TOKEN_GENERATION_FAILED", err.Error(), nil)
		return
	}

	response.OK(c, token)
}

// ListFestivalTags lists all NFC tags for a festival
// GET /festivals/:id/nfc/tags
func (h *Handler) ListFestivalTags(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	tags, total, err := h.service.ListFestivalTags(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]NFCTagResponse, len(tags))
	for i, tag := range tags {
		items[i] = tag.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetActiveTags gets all active NFC tags for a festival
// GET /festivals/:id/nfc/tags/active
func (h *Handler) GetActiveTags(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	tags, err := h.service.GetActiveTags(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]NFCTagResponse, len(tags))
	for i, tag := range tags {
		items[i] = tag.ToResponse()
	}

	response.OK(c, items)
}

// BulkRegisterTags registers multiple NFC tags at once
// POST /festivals/:id/nfc/bulk-register
func (h *Handler) BulkRegisterTags(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req struct {
		UIDs []string `json:"uids" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	tags, err := h.service.BulkRegisterTags(c.Request.Context(), req.UIDs, festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]NFCTagResponse, len(tags))
	for i, tag := range tags {
		items[i] = tag.ToResponse()
	}

	response.Created(c, items)
}

// SyncOfflineTransaction syncs an offline transaction to the server
// POST /nfc/sync/transaction
func (h *Handler) SyncOfflineTransaction(c *gin.Context) {
	var tx NFCTransaction
	if err := c.ShouldBindJSON(&tx); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	if err := h.service.SyncOfflineTransaction(c.Request.Context(), &tx); err != nil {
		response.BadRequest(c, "SYNC_FAILED", err.Error(), nil)
		return
	}

	c.JSON(http.StatusAccepted, response.Response{
		Data: gin.H{
			"status":  "accepted",
			"message": "Transaction queued for processing",
		},
	})
}

// Helper functions

func getStaffID(c *gin.Context) *uuid.UUID {
	staffIDStr := c.GetString("staff_id")
	if staffIDStr == "" {
		// Fall back to user_id for staff
		staffIDStr = c.GetString("user_id")
	}
	if staffIDStr == "" {
		return nil
	}
	id, err := uuid.Parse(staffIDStr)
	if err != nil {
		return nil
	}
	return &id
}
