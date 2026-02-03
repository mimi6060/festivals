package payment

import (
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/payment"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
	"github.com/rs/zerolog/log"
)

// Handler handles payment HTTP requests
type Handler struct {
	service      *Service
	stripeClient *payment.StripeClient
}

// NewHandler creates a new payment handler
func NewHandler(service *Service, stripeClient *payment.StripeClient) *Handler {
	return &Handler{
		service:      service,
		stripeClient: stripeClient,
	}
}

// RegisterRoutes registers payment routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Payment intent routes (authenticated)
	payments := r.Group("/stripe")
	{
		// Create payment intent for wallet top-up
		payments.POST("/payment-intents", h.CreatePaymentIntent)

		// Create payment intent for ticket purchase
		payments.POST("/ticket-payment-intents", h.CreateTicketPaymentIntent)

		// Get payment intent by ID
		payments.GET("/payment-intents/:id", h.GetPaymentIntent)

		// Get user's payment history
		payments.GET("/payments", h.GetMyPayments)
	}

	// Stripe Connect routes (festival admin)
	connect := r.Group("/stripe/connect")
	{
		// Create Connect account for festival
		connect.POST("/accounts", h.CreateConnectAccount)

		// Get Connect account status
		connect.GET("/accounts/:festivalId", h.GetConnectAccountStatus)

		// Create new onboarding link
		connect.POST("/accounts/:festivalId/onboarding", h.CreateOnboardingLink)

		// Get transfers for festival
		connect.GET("/accounts/:festivalId/transfers", h.GetFestivalTransfers)

		// Initiate transfer to festival
		connect.POST("/accounts/:festivalId/transfers", h.CreateTransfer)
	}
}

// RegisterWebhookRoutes registers the webhook endpoint (no auth required)
func (h *Handler) RegisterWebhookRoutes(r *gin.RouterGroup) {
	r.POST("/stripe/webhook", h.HandleWebhook)
}

// CreatePaymentIntent creates a payment intent for wallet top-up
// @Summary Create payment intent for wallet top-up
// @Description Creates a Stripe PaymentIntent for adding funds to a wallet
// @Tags stripe
// @Accept json
// @Produce json
// @Param request body CreatePaymentIntentRequest true "Payment intent data"
// @Success 201 {object} response.Response{data=CreatePaymentIntentResponse} "Payment intent created"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /stripe/payment-intents [post]
func (h *Handler) CreatePaymentIntent(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "MISSING_CONTEXT", "Festival context required", nil)
		return
	}

	var req CreatePaymentIntentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	walletID, err := uuid.Parse(req.WalletID)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid wallet ID", nil)
		return
	}

	// Get user email from context or request
	email := c.GetString("user_email")

	pi, err := h.service.CreatePaymentIntent(c.Request.Context(), festivalID, userID, walletID, req.Amount, req.Currency, email)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create payment intent")
		response.InternalError(c, "Failed to create payment intent")
		return
	}

	response.Created(c, CreatePaymentIntentResponse{
		ID:           pi.ID,
		ClientSecret: pi.ClientSecret,
		Amount:       pi.Amount,
		Currency:     pi.Currency,
		Status:       pi.Status,
	})
}

// CreateTicketPaymentIntentRequest represents a request to create a payment intent for ticket purchase
type CreateTicketPaymentIntentRequest struct {
	TicketTypeID string `json:"ticketTypeId" binding:"required,uuid"`
	Quantity     int    `json:"quantity" binding:"required,min=1,max=10"`
	Currency     string `json:"currency,omitempty"`
}

// CreateTicketPaymentIntent creates a payment intent for ticket purchase
// @Summary Create payment intent for ticket purchase
// @Description Creates a Stripe PaymentIntent for purchasing tickets
// @Tags stripe
// @Accept json
// @Produce json
// @Param request body CreateTicketPaymentIntentRequest true "Ticket payment data"
// @Success 201 {object} response.Response{data=CreatePaymentIntentResponse} "Payment intent created"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Ticket type not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /stripe/ticket-payment-intents [post]
func (h *Handler) CreateTicketPaymentIntent(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "MISSING_CONTEXT", "Festival context required", nil)
		return
	}

	var req CreateTicketPaymentIntentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	ticketTypeID, err := uuid.Parse(req.TicketTypeID)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket type ID", nil)
		return
	}

	email := c.GetString("user_email")

	pi, err := h.service.CreateTicketPaymentIntent(c.Request.Context(), festivalID, userID, ticketTypeID, req.Quantity, req.Currency, email)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Ticket type not found")
			return
		}
		log.Error().Err(err).Msg("Failed to create ticket payment intent")
		response.InternalError(c, "Failed to create payment intent")
		return
	}

	response.Created(c, CreatePaymentIntentResponse{
		ID:           pi.ID,
		ClientSecret: pi.ClientSecret,
		Amount:       pi.Amount,
		Currency:     pi.Currency,
		Status:       pi.Status,
	})
}

// GetPaymentIntent returns a payment intent by ID
// @Summary Get payment intent by ID
// @Description Get detailed information about a specific payment intent
// @Tags stripe
// @Produce json
// @Param id path string true "Payment Intent ID" format(uuid)
// @Success 200 {object} response.Response{data=PaymentIntentResponse} "Payment intent details"
// @Failure 400 {object} response.ErrorResponse "Invalid payment intent ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Payment intent not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /stripe/payment-intents/{id} [get]
func (h *Handler) GetPaymentIntent(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid payment intent ID", nil)
		return
	}

	pi, err := h.service.GetPaymentIntent(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Payment intent not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	// Ensure user owns this payment intent
	if pi.UserID != userID {
		response.Forbidden(c, "Access denied")
		return
	}

	response.OK(c, pi.ToResponse())
}

// GetMyPayments returns the user's payment history
// @Summary Get my payment history
// @Description Get paginated list of user's payment intents
// @Tags stripe
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} response.Response{data=[]PaymentIntentResponse,meta=response.Meta} "Payment history"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /stripe/payments [get]
func (h *Handler) GetMyPayments(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	payments, total, err := h.service.GetPaymentsByUser(c.Request.Context(), userID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]PaymentIntentResponse, len(payments))
	for i, pi := range payments {
		items[i] = pi.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// CreateConnectAccount creates a Stripe Connect account for a festival
// @Summary Create Stripe Connect account
// @Description Create a Stripe Connect Express account for a festival to receive payouts
// @Tags stripe-connect
// @Accept json
// @Produce json
// @Param request body ConnectAccountRequest true "Connect account data"
// @Success 201 {object} response.Response{data=ConnectAccountResponse} "Connect account created"
// @Failure 400 {object} response.ErrorResponse "Invalid request or account exists"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /stripe/connect/accounts [post]
func (h *Handler) CreateConnectAccount(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "MISSING_CONTEXT", "Festival context required", nil)
		return
	}

	var req ConnectAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	country := req.Country
	if country == "" {
		country = "BE"
	}

	// Get festival name from context or service
	festivalName := c.GetString("festival_name")
	if festivalName == "" {
		festivalName = "Festival"
	}

	stripeAcct, onboardingURL, err := h.service.CreateStripeConnectAccount(c.Request.Context(), festivalID, festivalName, req.Email, country)
	if err != nil {
		if appErr, ok := err.(*errors.AppError); ok {
			response.BadRequest(c, appErr.Code, appErr.Message, nil)
			return
		}
		log.Error().Err(err).Msg("Failed to create Connect account")
		response.InternalError(c, "Failed to create Connect account")
		return
	}

	response.Created(c, ConnectAccountResponse{
		AccountID:      stripeAcct.StripeAccountID,
		OnboardingURL:  onboardingURL,
		Status:         stripeAcct.OnboardingStatus,
		ChargesEnabled: stripeAcct.ChargesEnabled,
		PayoutsEnabled: stripeAcct.PayoutsEnabled,
	})
}

// GetConnectAccountStatus gets the status of a Connect account
// @Summary Get Connect account status
// @Description Get the current status of a festival's Stripe Connect account
// @Tags stripe-connect
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Success 200 {object} response.Response{data=StripeAccountStatusResponse} "Account status"
// @Failure 400 {object} response.ErrorResponse "Invalid festival ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Connect account not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /stripe/connect/accounts/{festivalId} [get]
func (h *Handler) GetConnectAccountStatus(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	status, err := h.service.GetStripeAccountStatus(c.Request.Context(), festivalID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Connect account not found for this festival")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, StripeAccountStatusResponse{
		AccountID:           status.AccountID,
		OnboardingStatus:    determineOnboardingStatus(status),
		ChargesEnabled:      status.ChargesEnabled,
		PayoutsEnabled:      status.PayoutsEnabled,
		DetailsSubmitted:    status.DetailsSubmitted,
		CurrentlyDue:        status.CurrentlyDue,
		EventuallyDue:       status.EventuallyDue,
		PastDue:             status.PastDue,
		DisabledReason:      status.DisabledReason,
		PaymentsCapability:  status.PaymentsCapability,
		TransfersCapability: status.TransfersCapability,
	})
}

// CreateOnboardingLink creates a new onboarding link for a Connect account
// @Summary Create onboarding link
// @Description Create a new Stripe Connect onboarding link for completing account setup
// @Tags stripe-connect
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Success 200 {object} response.Response{data=object{url=string}} "Onboarding URL"
// @Failure 400 {object} response.ErrorResponse "Invalid festival ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Connect account not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /stripe/connect/accounts/{festivalId}/onboarding [post]
func (h *Handler) CreateOnboardingLink(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	url, err := h.service.CreateOnboardingLink(c.Request.Context(), festivalID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Connect account not found for this festival")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{"url": url})
}

// GetFestivalTransfers gets transfers for a festival
// @Summary Get festival transfers
// @Description Get paginated list of transfers to a festival's Connect account
// @Tags stripe-connect
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} response.Response{data=[]Transfer,meta=response.Meta} "Transfer list"
// @Failure 400 {object} response.ErrorResponse "Invalid festival ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /stripe/connect/accounts/{festivalId}/transfers [get]
func (h *Handler) GetFestivalTransfers(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	transfers, total, err := h.service.GetTransfersByFestival(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OKWithMeta(c, transfers, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// CreateTransferRequest represents a request to create a transfer
type CreateTransferRequest struct {
	Amount            int64  `json:"amount" binding:"required,min=100"`
	Description       string `json:"description,omitempty"`
	SourceTransaction string `json:"sourceTransaction,omitempty"`
}

// CreateTransfer initiates a transfer to a festival's Connect account
// @Summary Create transfer
// @Description Transfer funds to a festival's Stripe Connect account
// @Tags stripe-connect
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param request body CreateTransferRequest true "Transfer data"
// @Success 201 {object} response.Response{data=Transfer} "Transfer created"
// @Failure 400 {object} response.ErrorResponse "Invalid request or account not ready"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Connect account not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /stripe/connect/accounts/{festivalId}/transfers [post]
func (h *Handler) CreateTransfer(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req CreateTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	transfer, err := h.service.TransferToFestival(c.Request.Context(), festivalID, req.Amount, req.Description, req.SourceTransaction)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Connect account not found for this festival")
			return
		}
		if appErr, ok := err.(*errors.AppError); ok {
			response.BadRequest(c, appErr.Code, appErr.Message, nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, transfer)
}

// HandleWebhook processes incoming Stripe webhooks
// @Summary Handle Stripe webhook
// @Description Process incoming Stripe webhook events for payment and account updates
// @Tags stripe
// @Accept json
// @Produce json
// @Success 200 {object} object{received=bool} "Webhook processed"
// @Failure 400 {object} response.ErrorResponse "Invalid signature or payload"
// @Failure 500 {object} response.ErrorResponse "Processing error"
// @Router /webhooks/stripe [post]
func (h *Handler) HandleWebhook(c *gin.Context) {
	// Get the raw body
	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Error().Err(err).Msg("Failed to read webhook body")
		response.BadRequest(c, "INVALID_PAYLOAD", "Failed to read request body", nil)
		return
	}

	// Get the Stripe signature header
	signature := c.GetHeader("Stripe-Signature")
	if signature == "" {
		response.BadRequest(c, "MISSING_SIGNATURE", "Missing Stripe-Signature header", nil)
		return
	}

	// Verify and parse the webhook
	event, err := h.stripeClient.HandleWebhook(payload, signature)
	if err != nil {
		log.Error().Err(err).Msg("Failed to verify webhook signature")
		response.BadRequest(c, "INVALID_SIGNATURE", "Invalid webhook signature", nil)
		return
	}

	// Process the webhook
	if err := h.service.ProcessWebhook(c.Request.Context(), event); err != nil {
		log.Error().Err(err).Str("event_type", event.Type).Msg("Failed to process webhook")
		// Return 200 to acknowledge receipt even if processing fails
		// Stripe will retry on 5xx errors
		c.JSON(http.StatusOK, gin.H{"received": true, "warning": "Processing error logged"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"received": true})
}

// Helper functions

func getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		return uuid.Nil, errors.ErrUnauthorized
	}
	return uuid.Parse(userIDStr)
}

func getFestivalID(c *gin.Context) (uuid.UUID, error) {
	festivalIDStr := c.GetString("festival_id")
	if festivalIDStr == "" {
		festivalIDStr = c.Query("festival_id")
	}
	if festivalIDStr == "" {
		festivalIDStr = c.Param("festivalId")
	}
	if festivalIDStr == "" {
		return uuid.Nil, errors.ErrBadRequest
	}
	return uuid.Parse(festivalIDStr)
}

func determineOnboardingStatus(status *payment.AccountStatus) OnboardingStatus {
	if status.ChargesEnabled && status.PayoutsEnabled {
		return OnboardingStatusComplete
	}
	if status.DisabledReason != "" {
		return OnboardingStatusRestricted
	}
	if status.DetailsSubmitted {
		return OnboardingStatusInProgress
	}
	return OnboardingStatusPending
}
