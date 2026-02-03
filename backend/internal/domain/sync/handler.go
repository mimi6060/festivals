package sync

import (
	"net/http"

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
	sync := r.Group("/sync")
	{
		sync.POST("/batch", h.SubmitBatch)
		sync.GET("/batch/:id", h.GetBatchStatus)
		sync.GET("/pending", h.GetPendingBatches)
	}
}

// SubmitBatch handles POST /sync/batch - Submit batch of offline transactions
// @Summary Submit offline transaction batch
// @Description Submit a batch of transactions made offline for processing
// @Tags sync
// @Accept json
// @Produce json
// @Param batch body SubmitBatchRequest true "Batch of offline transactions"
// @Success 200 {object} response.Response{data=SyncResult}
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Failure 500 {object} response.ErrorResponse
// @Router /sync/batch [post]
func (h *Handler) SubmitBatch(c *gin.Context) {
	var req SubmitBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	// Validate that the request has transactions
	if len(req.Transactions) == 0 {
		response.BadRequest(c, "EMPTY_BATCH", "Batch must contain at least one transaction", nil)
		return
	}

	// Validate each transaction has required fields
	for i, tx := range req.Transactions {
		if tx.LocalID == "" {
			response.BadRequest(c, "INVALID_TRANSACTION", "Transaction missing localId", map[string]interface{}{
				"index": i,
			})
			return
		}
		if tx.WalletID == uuid.Nil {
			response.BadRequest(c, "INVALID_TRANSACTION", "Transaction missing walletId", map[string]interface{}{
				"index":   i,
				"localId": tx.LocalID,
			})
			return
		}
		if tx.Signature == "" {
			response.BadRequest(c, "INVALID_TRANSACTION", "Transaction missing signature", map[string]interface{}{
				"index":   i,
				"localId": tx.LocalID,
			})
			return
		}
	}

	result, err := h.service.ProcessSyncBatch(c.Request.Context(), req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Return appropriate status based on result
	if result.Status == SyncStatusFailed {
		c.JSON(http.StatusMultiStatus, response.Response{Data: result})
		return
	}

	if result.Status == SyncStatusPartial {
		c.JSON(http.StatusMultiStatus, response.Response{Data: result})
		return
	}

	response.OK(c, result)
}

// GetBatchStatus handles GET /sync/batch/:id - Get batch status
// @Summary Get batch status
// @Description Get the status of a previously submitted batch
// @Tags sync
// @Accept json
// @Produce json
// @Param id path string true "Batch ID"
// @Success 200 {object} response.Response{data=BatchStatusResponse}
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Failure 500 {object} response.ErrorResponse
// @Router /sync/batch/{id} [get]
func (h *Handler) GetBatchStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid batch ID", nil)
		return
	}

	batch, err := h.service.GetBatch(c.Request.Context(), id)
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

// GetPendingBatches handles GET /sync/pending - Get pending syncs for device
// @Summary Get pending batches
// @Description Get all pending sync batches for a device
// @Tags sync
// @Accept json
// @Produce json
// @Param device_id query string true "Device ID"
// @Success 200 {object} response.Response{data=[]PendingBatchResponse}
// @Failure 400 {object} response.ErrorResponse
// @Failure 500 {object} response.ErrorResponse
// @Router /sync/pending [get]
func (h *Handler) GetPendingBatches(c *gin.Context) {
	deviceID := c.Query("device_id")
	if deviceID == "" {
		response.BadRequest(c, "MISSING_DEVICE_ID", "device_id query parameter is required", nil)
		return
	}

	batches, err := h.service.GetPendingBatches(c.Request.Context(), deviceID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Convert to response format
	items := make([]PendingBatchResponse, len(batches))
	for i, batch := range batches {
		items[i] = PendingBatchResponse{
			ID:         batch.ID,
			Status:     batch.Status,
			TotalCount: len(batch.Transactions),
			CreatedAt:  batch.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
	}

	response.OK(c, items)
}
