package refund

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// Handler handles HTTP requests for refund operations
type Handler struct {
	service *Service
}

// NewHandler creates a new refund handler
func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

// RegisterRoutes registers the refund routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// User refund routes
	me := r.Group("/me")
	{
		me.POST("/refunds", h.RequestRefund)
		me.GET("/refunds", h.GetMyRefunds)
	}

	// Admin festival refund routes
	festivals := r.Group("/festivals")
	{
		festivals.GET("/:id/refunds", h.GetFestivalRefunds)
	}

	// Admin refund management routes
	refunds := r.Group("/refunds")
	{
		refunds.GET("/:id", h.GetRefund)
		refunds.POST("/:id/approve", h.ApproveRefund)
		refunds.POST("/:id/reject", h.RejectRefund)
		refunds.POST("/:id/process", h.ProcessRefund)
	}

	// Admin pending refunds
	admin := r.Group("/admin")
	{
		admin.GET("/refunds/pending", h.GetPendingRefunds)
		admin.POST("/refunds/auto-process", h.AutoProcessRefunds)
	}
}

// RequestRefund handles POST /me/refunds - User requests a refund
// @Summary Request a refund
// @Description Request a refund for wallet balance after festival ends
// @Tags refunds
// @Accept json
// @Produce json
// @Param request body CreateRefundInput true "Refund request data"
// @Success 201 {object} response.Response{data=RefundResponse} "Refund request created"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /me/refunds [post]
func (h *Handler) RequestRefund(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	var input CreateRefundInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	refund, err := h.service.RequestRefund(c.Request.Context(), userID, input)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	response.Created(c, refund.ToResponse())
}

// GetMyRefunds handles GET /me/refunds - Get user's refund requests
// @Summary Get my refund requests
// @Description Get all refund requests for the authenticated user
// @Tags refunds
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} response.Response{data=[]RefundResponse,meta=response.Meta} "Refund list"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /me/refunds [get]
func (h *Handler) GetMyRefunds(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	refunds, total, err := h.service.GetUserRefunds(c.Request.Context(), userID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]RefundResponse, len(refunds))
	for i, r := range refunds {
		items[i] = r.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetFestivalRefunds handles GET /festivals/:id/refunds - Get festival refund requests (admin)
// @Summary Get festival refunds
// @Description Get all refund requests for a festival (admin only)
// @Tags refunds
// @Produce json
// @Param id path string true "Festival ID" format(uuid)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Param status query string false "Filter by status" Enums(pending, approved, processing, completed, rejected)
// @Success 200 {object} response.Response{data=[]RefundResponse,meta=response.Meta} "Refund list"
// @Failure 400 {object} response.ErrorResponse "Invalid festival ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{id}/refunds [get]
func (h *Handler) GetFestivalRefunds(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	// Optional status filter
	var statusFilter *RefundStatus
	if statusStr := c.Query("status"); statusStr != "" {
		status := RefundStatus(statusStr)
		// Validate status
		switch status {
		case RefundStatusPending, RefundStatusApproved, RefundStatusProcessing, RefundStatusCompleted, RefundStatusRejected:
			statusFilter = &status
		default:
			response.BadRequest(c, "INVALID_STATUS", "Invalid status filter", nil)
			return
		}
	}

	refunds, total, err := h.service.GetFestivalRefunds(c.Request.Context(), festivalID, statusFilter, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]RefundResponse, len(refunds))
	for i, r := range refunds {
		items[i] = r.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetRefund handles GET /refunds/:id - Get a specific refund request
// @Summary Get refund by ID
// @Description Get details of a specific refund request
// @Tags refunds
// @Produce json
// @Param id path string true "Refund ID" format(uuid)
// @Success 200 {object} response.Response{data=RefundResponse} "Refund details"
// @Failure 400 {object} response.ErrorResponse "Invalid refund ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Refund not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /refunds/{id} [get]
func (h *Handler) GetRefund(c *gin.Context) {
	refundID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid refund ID", nil)
		return
	}

	refund, err := h.service.GetRefund(c.Request.Context(), refundID)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	response.OK(c, refund.ToResponse())
}

// ApproveRefund handles POST /refunds/:id/approve - Approve a pending refund (admin)
// @Summary Approve refund
// @Description Approve a pending refund request (admin only)
// @Tags refunds
// @Accept json
// @Produce json
// @Param id path string true "Refund ID" format(uuid)
// @Param request body ApproveRefundInput false "Approval notes"
// @Success 200 {object} response.Response{data=RefundResponse} "Approved refund"
// @Failure 400 {object} response.ErrorResponse "Invalid refund ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Refund not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /refunds/{id}/approve [post]
func (h *Handler) ApproveRefund(c *gin.Context) {
	refundID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid refund ID", nil)
		return
	}

	adminID, err := getAdminID(c)
	if err != nil {
		response.Unauthorized(c, "Admin authentication required")
		return
	}

	var input ApproveRefundInput
	// Input is optional, so we don't check for binding errors
	c.ShouldBindJSON(&input)

	refund, err := h.service.ApproveRefund(c.Request.Context(), refundID, adminID, input)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	response.OK(c, refund.ToResponse())
}

// RejectRefund handles POST /refunds/:id/reject - Reject a pending refund (admin)
// @Summary Reject refund
// @Description Reject a pending refund request with a reason (admin only)
// @Tags refunds
// @Accept json
// @Produce json
// @Param id path string true "Refund ID" format(uuid)
// @Param request body RejectRefundInput true "Rejection reason"
// @Success 200 {object} response.Response{data=RefundResponse} "Rejected refund"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Refund not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /refunds/{id}/reject [post]
func (h *Handler) RejectRefund(c *gin.Context) {
	refundID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid refund ID", nil)
		return
	}

	adminID, err := getAdminID(c)
	if err != nil {
		response.Unauthorized(c, "Admin authentication required")
		return
	}

	var input RejectRefundInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Rejection reason is required", err.Error())
		return
	}

	refund, err := h.service.RejectRefund(c.Request.Context(), refundID, adminID, input)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	response.OK(c, refund.ToResponse())
}

// ProcessRefund handles POST /refunds/:id/process - Process an approved refund (admin)
// @Summary Process refund
// @Description Process an approved refund (admin only)
// @Tags refunds
// @Accept json
// @Produce json
// @Param id path string true "Refund ID" format(uuid)
// @Param request body ProcessRefundInput true "Processing details"
// @Success 200 {object} response.Response{data=RefundResponse} "Processed refund"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Refund not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /refunds/{id}/process [post]
func (h *Handler) ProcessRefund(c *gin.Context) {
	refundID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid refund ID", nil)
		return
	}

	adminID, err := getAdminID(c)
	if err != nil {
		response.Unauthorized(c, "Admin authentication required")
		return
	}

	var input ProcessRefundInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	refund, err := h.service.ProcessRefund(c.Request.Context(), refundID, adminID, input)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	response.OK(c, refund.ToResponse())
}

// GetPendingRefunds handles GET /admin/refunds/pending - Get all pending refunds (admin)
// @Summary Get pending refunds
// @Description Get all pending refund requests across all festivals (admin only)
// @Tags refunds
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} response.Response{data=[]RefundResponse,meta=response.Meta} "Pending refunds"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /admin/refunds/pending [get]
func (h *Handler) GetPendingRefunds(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	refunds, total, err := h.service.GetPendingRefunds(c.Request.Context(), page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]RefundResponse, len(refunds))
	for i, r := range refunds {
		items[i] = r.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// AutoProcessRefunds handles POST /admin/refunds/auto-process - Auto process approved refunds (admin)
// @Summary Auto-process refunds
// @Description Automatically process all approved refunds (admin only)
// @Tags refunds
// @Produce json
// @Success 200 {object} response.Response{data=object{processed=int,message=string}} "Processing result"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /admin/refunds/auto-process [post]
func (h *Handler) AutoProcessRefunds(c *gin.Context) {
	count, err := h.service.AutoProcessRefunds(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{
		"processed": count,
		"message":   "Auto-processing completed",
	})
}

// Helper functions

func getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		return uuid.Nil, errors.ErrUnauthorized
	}
	return uuid.Parse(userIDStr)
}

func getAdminID(c *gin.Context) (uuid.UUID, error) {
	// First try admin_id, then fall back to user_id
	adminIDStr := c.GetString("admin_id")
	if adminIDStr == "" {
		adminIDStr = c.GetString("user_id")
	}
	if adminIDStr == "" {
		return uuid.Nil, errors.ErrUnauthorized
	}
	return uuid.Parse(adminIDStr)
}

func handleServiceError(c *gin.Context, err error) {
	if err == errors.ErrNotFound {
		response.NotFound(c, "Refund request not found")
		return
	}
	if err == errors.ErrForbidden {
		response.Forbidden(c, "Access denied")
		return
	}
	if err == errors.ErrWalletNotFound {
		response.NotFound(c, "Wallet not found")
		return
	}
	if err == errors.ErrInsufficientBalance {
		response.BadRequest(c, "INSUFFICIENT_BALANCE", "Insufficient wallet balance", nil)
		return
	}

	// Check for AppError
	if appErr, ok := err.(*errors.AppError); ok {
		response.BadRequest(c, appErr.Code, appErr.Message, appErr.Details)
		return
	}

	response.InternalError(c, err.Error())
}
