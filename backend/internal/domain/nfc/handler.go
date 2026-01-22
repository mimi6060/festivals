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

	// NFC bracelet management routes
	bracelets := r.Group("/nfc/bracelets")
	{
		bracelets.POST("/activate", h.ActivateBracelet)
		bracelets.GET("/:uid", h.GetBraceletInfo)
		bracelets.POST("/:uid/deactivate", h.DeactivateBracelet)
		bracelets.POST("/:uid/block", h.BlockBracelet)
		bracelets.POST("/:uid/lost", h.ReportBraceletLost)
		bracelets.GET("/:uid/transactions", h.GetBraceletTransactions)
		bracelets.POST("/payment", h.ProcessNFCPayment)
		bracelets.POST("/transfer-balance", h.TransferBraceletBalance)
	}

	// Festival-scoped NFC routes
	festivals := r.Group("/festivals")
	{
		festivals.GET("/:id/nfc/tags", h.ListFestivalTags)
		festivals.GET("/:id/nfc/tags/active", h.GetActiveTags)
		festivals.POST("/:id/nfc/bulk-register", h.BulkRegisterTags)

		// Bracelet routes
		festivals.GET("/:id/nfc/bracelets", h.ListFestivalBracelets)
		festivals.POST("/:id/nfc/bracelets/batch-activate", h.BatchActivateBracelets)
		festivals.GET("/:id/nfc/stats", h.GetNFCStats)

		// Batch routes
		festivals.GET("/:id/nfc/batches", h.ListBatches)
		festivals.POST("/:id/nfc/batches", h.CreateBatch)
		festivals.GET("/:id/nfc/batches/:batchId", h.GetBatch)
		festivals.POST("/:id/nfc/batches/:batchId/activate", h.ActivateBatch)
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

// ActivateBracelet activates a bracelet and links it to a wallet
// POST /nfc/bracelets/activate
func (h *Handler) ActivateBracelet(c *gin.Context) {
	var req NFCBraceletActivationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	staffID := getStaffID(c)

	bracelet, err := h.service.ActivateBracelet(c.Request.Context(), req.UID, req.UserID, req.WalletID, staffID)
	if err != nil {
		if err == errors.ErrWalletNotFound {
			response.NotFound(c, "Wallet not found")
			return
		}
		response.BadRequest(c, "ACTIVATION_FAILED", err.Error(), nil)
		return
	}

	response.Created(c, bracelet.ToResponse())
}

// DeactivateBracelet deactivates a bracelet
// POST /nfc/bracelets/:uid/deactivate
func (h *Handler) DeactivateBracelet(c *gin.Context) {
	uid := c.Param("uid")
	if uid == "" {
		response.BadRequest(c, "INVALID_UID", "Bracelet UID is required", nil)
		return
	}

	bracelet, err := h.service.DeactivateBracelet(c.Request.Context(), uid)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Bracelet not found")
			return
		}
		response.BadRequest(c, "DEACTIVATION_FAILED", err.Error(), nil)
		return
	}

	response.OK(c, bracelet.ToResponse())
}

// GetBraceletInfo retrieves detailed information about a bracelet
// GET /nfc/bracelets/:uid
func (h *Handler) GetBraceletInfo(c *gin.Context) {
	uid := c.Param("uid")
	if uid == "" {
		response.BadRequest(c, "INVALID_UID", "Bracelet UID is required", nil)
		return
	}

	info, err := h.service.GetBraceletInfo(c.Request.Context(), uid)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Bracelet not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, info)
}

// ProcessNFCPayment processes a payment using an NFC bracelet
// POST /nfc/bracelets/payment
func (h *Handler) ProcessNFCPayment(c *gin.Context) {
	var req NFCPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	staffID := getStaffID(c)
	deviceID := c.GetHeader("X-Device-ID")
	if deviceID == "" {
		deviceID = "unknown"
	}

	result, err := h.service.ProcessNFCPayment(c.Request.Context(), req.UID, req.Amount, req.StandID, staffID, deviceID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	if !result.Success {
		response.BadRequest(c, "PAYMENT_FAILED", result.Message, nil)
		return
	}

	response.OK(c, result)
}

// BlockBracelet blocks a bracelet
// POST /nfc/bracelets/:uid/block
func (h *Handler) BlockBracelet(c *gin.Context) {
	uid := c.Param("uid")
	if uid == "" {
		response.BadRequest(c, "INVALID_UID", "Bracelet UID is required", nil)
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	bracelet, err := h.service.BlockBracelet(c.Request.Context(), uid, req.Reason)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Bracelet not found")
			return
		}
		response.BadRequest(c, "BLOCK_FAILED", err.Error(), nil)
		return
	}

	response.OK(c, bracelet.ToResponse())
}

// ReportBraceletLost reports a bracelet as lost
// POST /nfc/bracelets/:uid/lost
func (h *Handler) ReportBraceletLost(c *gin.Context) {
	uid := c.Param("uid")
	if uid == "" {
		response.BadRequest(c, "INVALID_UID", "Bracelet UID is required", nil)
		return
	}

	bracelet, err := h.service.ReportLost(c.Request.Context(), uid)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Bracelet not found")
			return
		}
		response.BadRequest(c, "REPORT_FAILED", err.Error(), nil)
		return
	}

	response.OK(c, bracelet.ToResponse())
}

// GetBraceletTransactions retrieves transactions for a bracelet
// GET /nfc/bracelets/:uid/transactions
func (h *Handler) GetBraceletTransactions(c *gin.Context) {
	uid := c.Param("uid")
	if uid == "" {
		response.BadRequest(c, "INVALID_UID", "Bracelet UID is required", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	transactions, total, err := h.service.GetBraceletTransactions(c.Request.Context(), uid, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OKWithMeta(c, transactions, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// TransferBraceletBalance transfers balance from one bracelet to another
// POST /nfc/bracelets/transfer-balance
func (h *Handler) TransferBraceletBalance(c *gin.Context) {
	var req NFCTransferBalanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	result, err := h.service.TransferBalance(c.Request.Context(), req.FromUID, req.ToUID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	if !result.Success {
		response.BadRequest(c, "TRANSFER_FAILED", result.Message, nil)
		return
	}

	response.OK(c, result)
}

// ListFestivalBracelets lists all bracelets for a festival
// GET /festivals/:id/nfc/bracelets
func (h *Handler) ListFestivalBracelets(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	bracelets, total, err := h.service.ListBracelets(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]NFCBraceletResponse, len(bracelets))
	for i, bracelet := range bracelets {
		items[i] = bracelet.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// BatchActivateBracelets activates multiple bracelets
// POST /festivals/:id/nfc/bracelets/batch-activate
func (h *Handler) BatchActivateBracelets(c *gin.Context) {
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

	staffID := getStaffID(c)
	if staffID == nil {
		response.Unauthorized(c, "Staff ID required")
		return
	}

	bracelets, err := h.service.BatchActivate(c.Request.Context(), req.UIDs, festivalID, *staffID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]NFCBraceletResponse, len(bracelets))
	for i, bracelet := range bracelets {
		items[i] = bracelet.ToResponse()
	}

	response.Created(c, items)
}

// GetNFCStats retrieves NFC statistics for a festival
// GET /festivals/:id/nfc/stats
func (h *Handler) GetNFCStats(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	stats, err := h.service.GetNFCStats(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stats)
}

// CreateBatch creates a new batch of bracelets
// POST /festivals/:id/nfc/batches
func (h *Handler) CreateBatch(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req NFCBatchCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	staffID := getStaffID(c)
	if staffID == nil {
		response.Unauthorized(c, "Staff ID required")
		return
	}

	batch, err := h.service.CreateBatch(c.Request.Context(), festivalID, req, *staffID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, batch.ToResponse())
}

// ListBatches lists all batches for a festival
// GET /festivals/:id/nfc/batches
func (h *Handler) ListBatches(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	batches, total, err := h.service.ListBatches(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]NFCBatchResponse, len(batches))
	for i, batch := range batches {
		items[i] = batch.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetBatch retrieves a batch by ID
// GET /festivals/:id/nfc/batches/:batchId
func (h *Handler) GetBatch(c *gin.Context) {
	batchID, err := uuid.Parse(c.Param("batchId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid batch ID", nil)
		return
	}

	batch, err := h.service.GetBatch(c.Request.Context(), batchID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Batch not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, batch.ToResponse())
}

// ActivateBatch activates a batch
// POST /festivals/:id/nfc/batches/:batchId/activate
func (h *Handler) ActivateBatch(c *gin.Context) {
	batchID, err := uuid.Parse(c.Param("batchId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid batch ID", nil)
		return
	}

	batch, err := h.service.ActivateBatch(c.Request.Context(), batchID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Batch not found")
			return
		}
		response.BadRequest(c, "ACTIVATION_FAILED", err.Error(), nil)
		return
	}

	response.OK(c, batch.ToResponse())
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
