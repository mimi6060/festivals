package wallet

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

type Handler struct {
	service      *Service
	exchangeRate float64
	currencyName string
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service:      service,
		exchangeRate: 0.10, // Default, should be overridden per festival
		currencyName: "Jetons",
	}
}

// SetFestivalConfig sets the festival-specific configuration
func (h *Handler) SetFestivalConfig(exchangeRate float64, currencyName string) {
	h.exchangeRate = exchangeRate
	h.currencyName = currencyName
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// User wallet routes
	me := r.Group("/me")
	{
		me.GET("/wallets", h.GetMyWallets)
		me.GET("/wallets/:festivalId", h.GetMyWallet)
		me.POST("/wallets/:festivalId", h.CreateMyWallet)
		me.GET("/wallets/:festivalId/qr", h.GenerateQR)
		me.GET("/wallets/:festivalId/transactions", h.GetMyTransactions)
	}

	// Staff wallet routes (requires staff role)
	wallets := r.Group("/wallets")
	{
		wallets.GET("/:id", h.GetWallet)
		wallets.POST("/:id/topup", h.TopUp)
		wallets.POST("/:id/freeze", h.FreezeWallet)
		wallets.POST("/:id/unfreeze", h.UnfreezeWallet)
	}

	// Payment routes (staff only)
	payments := r.Group("/payments")
	{
		payments.POST("", h.ProcessPayment)
		payments.POST("/validate-qr", h.ValidateQR)
		payments.POST("/refund", h.RefundPayment)
	}
}

// GetMyWallets returns all wallets for the current user
// @Summary Get user's wallets
// @Description Get all wallets belonging to the authenticated user
// @Tags wallets
// @Produce json
// @Success 200 {object} response.Response{data=[]WalletResponse} "List of user's wallets"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /me/wallets [get]
func (h *Handler) GetMyWallets(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	wallets, err := h.service.GetUserWallets(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]WalletResponse, len(wallets))
	for i, w := range wallets {
		items[i] = w.ToResponse(h.exchangeRate, h.currencyName)
	}

	response.OK(c, items)
}

// GetMyWallet returns the user's wallet for a specific festival
// @Summary Get user's wallet for a festival
// @Description Get or create wallet for the authenticated user in a specific festival
// @Tags wallets
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Success 200 {object} response.Response{data=WalletResponse} "Wallet details"
// @Failure 400 {object} response.ErrorResponse "Invalid festival ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /me/wallets/{festivalId} [get]
func (h *Handler) GetMyWallet(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	wallet, err := h.service.GetOrCreateWallet(c.Request.Context(), userID, festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, wallet.ToResponse(h.exchangeRate, h.currencyName))
}

// CreateMyWallet creates a wallet for the user in a festival
// @Summary Create wallet for a festival
// @Description Create a new wallet for the authenticated user in a specific festival
// @Tags wallets
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Success 201 {object} response.Response{data=WalletResponse} "Wallet created"
// @Failure 400 {object} response.ErrorResponse "Invalid festival ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /me/wallets/{festivalId} [post]
func (h *Handler) CreateMyWallet(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	wallet, err := h.service.GetOrCreateWallet(c.Request.Context(), userID, festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, wallet.ToResponse(h.exchangeRate, h.currencyName))
}

// GenerateQR generates a QR code payload for the user's wallet
// @Summary Generate QR code for wallet
// @Description Generate a signed QR code payload for cashless payments
// @Tags wallets
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Success 200 {object} response.Response{data=object{qrCode=string,balance=int64}} "QR code payload"
// @Failure 400 {object} response.ErrorResponse "Invalid festival ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /me/wallets/{festivalId}/qr [get]
func (h *Handler) GenerateQR(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	// Get or create wallet
	wallet, err := h.service.GetOrCreateWallet(c.Request.Context(), userID, festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Generate QR payload
	qrPayload, err := h.service.GenerateQRPayload(c.Request.Context(), wallet.ID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{
		"qrCode":  qrPayload,
		"balance": wallet.Balance,
	})
}

// GetMyTransactions returns transactions for the user's wallet
// @Summary Get wallet transactions
// @Description Get paginated list of transactions for the user's wallet
// @Tags wallets
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} response.Response{data=[]TransactionResponse,meta=response.Meta} "Transaction list"
// @Failure 400 {object} response.ErrorResponse "Invalid festival ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /me/wallets/{festivalId}/transactions [get]
func (h *Handler) GetMyTransactions(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	// Get wallet
	wallet, err := h.service.GetOrCreateWallet(c.Request.Context(), userID, festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	transactions, total, err := h.service.GetTransactions(c.Request.Context(), wallet.ID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]TransactionResponse, len(transactions))
	for i, tx := range transactions {
		items[i] = tx.ToResponse(h.exchangeRate, h.currencyName)
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetWallet returns a wallet by ID (staff only)
// @Summary Get wallet by ID
// @Description Get wallet details by ID (staff only)
// @Tags wallets
// @Produce json
// @Param id path string true "Wallet ID" format(uuid)
// @Success 200 {object} response.Response{data=WalletResponse} "Wallet details"
// @Failure 400 {object} response.ErrorResponse "Invalid wallet ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Wallet not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /wallets/{id} [get]
func (h *Handler) GetWallet(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid wallet ID", nil)
		return
	}

	wallet, err := h.service.GetWallet(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Wallet not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, wallet.ToResponse(h.exchangeRate, h.currencyName))
}

// TopUp adds funds to a wallet (staff only)
// @Summary Top up wallet
// @Description Add funds to a wallet (staff only)
// @Tags wallets
// @Accept json
// @Produce json
// @Param id path string true "Wallet ID" format(uuid)
// @Param request body TopUpRequest true "Top up data"
// @Success 200 {object} response.Response{data=TransactionResponse} "Transaction details"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /wallets/{id}/topup [post]
func (h *Handler) TopUp(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid wallet ID", nil)
		return
	}

	var req TopUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	staffID := getStaffID(c)

	tx, err := h.service.TopUp(c.Request.Context(), id, req, staffID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, tx.ToResponse(h.exchangeRate, h.currencyName))
}

// ProcessPayment processes a payment at a stand (staff only)
// @Summary Process payment
// @Description Process a cashless payment at a stand (staff only)
// @Tags payments
// @Accept json
// @Produce json
// @Param request body PaymentRequest true "Payment data"
// @Success 200 {object} response.Response{data=TransactionResponse} "Transaction details"
// @Failure 400 {object} response.ErrorResponse "Invalid request or insufficient balance"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /payments [post]
func (h *Handler) ProcessPayment(c *gin.Context) {
	var req PaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	staffID, err := getStaffIDRequired(c)
	if err != nil {
		response.Unauthorized(c, "Staff authentication required")
		return
	}

	tx, err := h.service.ProcessPayment(c.Request.Context(), req, staffID)
	if err != nil {
		if err.Error() == "insufficient balance" {
			response.BadRequest(c, "INSUFFICIENT_BALANCE", "Insufficient balance", nil)
			return
		}
		if err.Error() == "wallet is not active" {
			response.BadRequest(c, "WALLET_FROZEN", "Wallet is frozen", nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, tx.ToResponse(h.exchangeRate, h.currencyName))
}

// ValidateQR validates a QR code and returns wallet info
// @Summary Validate QR code
// @Description Validate a QR code and return associated wallet information
// @Tags payments
// @Accept json
// @Produce json
// @Param request body object{qrCode=string} true "QR code payload"
// @Success 200 {object} response.Response{data=WalletResponse} "Wallet details"
// @Failure 400 {object} response.ErrorResponse "Invalid QR code"
// @Failure 404 {object} response.ErrorResponse "Wallet not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /payments/validate-qr [post]
func (h *Handler) ValidateQR(c *gin.Context) {
	var req struct {
		QRCode string `json:"qrCode" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	payload, err := h.service.ValidateQRPayload(c.Request.Context(), req.QRCode)
	if err != nil {
		response.BadRequest(c, "INVALID_QR", err.Error(), nil)
		return
	}

	// Get wallet info
	wallet, err := h.service.GetWallet(c.Request.Context(), payload.WalletID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Wallet not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, wallet.ToResponse(h.exchangeRate, h.currencyName))
}

// RefundPayment refunds a transaction (staff only)
// @Summary Refund payment
// @Description Refund a previous transaction (staff only)
// @Tags payments
// @Accept json
// @Produce json
// @Param request body RefundRequest true "Refund data"
// @Success 200 {object} response.Response{data=TransactionResponse} "Refund transaction"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Transaction not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /payments/refund [post]
func (h *Handler) RefundPayment(c *gin.Context) {
	var req RefundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	staffID := getStaffID(c)

	tx, err := h.service.RefundTransaction(c.Request.Context(), req.TransactionID, req.Reason, staffID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Transaction not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, tx.ToResponse(h.exchangeRate, h.currencyName))
}

// FreezeWallet freezes a wallet (admin only)
// @Summary Freeze wallet
// @Description Freeze a wallet to prevent transactions (admin only)
// @Tags wallets
// @Produce json
// @Param id path string true "Wallet ID" format(uuid)
// @Success 200 {object} response.Response{data=WalletResponse} "Frozen wallet"
// @Failure 400 {object} response.ErrorResponse "Invalid wallet ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Wallet not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /wallets/{id}/freeze [post]
func (h *Handler) FreezeWallet(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid wallet ID", nil)
		return
	}

	wallet, err := h.service.FreezeWallet(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Wallet not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, wallet.ToResponse(h.exchangeRate, h.currencyName))
}

// UnfreezeWallet unfreezes a wallet (admin only)
// @Summary Unfreeze wallet
// @Description Unfreeze a previously frozen wallet (admin only)
// @Tags wallets
// @Produce json
// @Param id path string true "Wallet ID" format(uuid)
// @Success 200 {object} response.Response{data=WalletResponse} "Unfrozen wallet"
// @Failure 400 {object} response.ErrorResponse "Invalid wallet ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Wallet not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /wallets/{id}/unfreeze [post]
func (h *Handler) UnfreezeWallet(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid wallet ID", nil)
		return
	}

	wallet, err := h.service.UnfreezeWallet(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Wallet not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, wallet.ToResponse(h.exchangeRate, h.currencyName))
}

// Helper functions

func getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		return uuid.Nil, errors.ErrUnauthorized
	}
	return uuid.Parse(userIDStr)
}

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

func getStaffIDRequired(c *gin.Context) (uuid.UUID, error) {
	staffID := getStaffID(c)
	if staffID == nil {
		return uuid.Nil, errors.ErrUnauthorized
	}
	return *staffID, nil
}
