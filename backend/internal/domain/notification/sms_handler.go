package notification

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// SMSHandler handles SMS notification endpoints
type SMSHandler struct {
	smsService *SMSService
}

// NewSMSHandler creates a new SMS handler
func NewSMSHandler(smsService *SMSService) *SMSHandler {
	return &SMSHandler{smsService: smsService}
}

// RegisterRoutes registers SMS notification routes
func (h *SMSHandler) RegisterRoutes(r *gin.RouterGroup) {
	// Festival-specific SMS routes
	festivals := r.Group("/festivals/:festivalId/sms")
	{
		festivals.POST("/broadcast", h.SendBroadcast)
		festivals.GET("/logs", h.GetSMSLogs)
		festivals.GET("/broadcasts", h.GetBroadcasts)
		festivals.GET("/broadcasts/:broadcastId", h.GetBroadcast)
		festivals.GET("/stats", h.GetSMSStats)
		festivals.GET("/templates", h.GetTemplates)
	}

	// General SMS routes
	sms := r.Group("/sms")
	{
		sms.GET("/balance", h.GetBalance)
		sms.POST("/send", h.SendSingleSMS)
		sms.POST("/opt-out", h.OptOut)
		sms.POST("/opt-in", h.OptIn)
		sms.GET("/opt-out/check", h.CheckOptOut)
	}
}

// SendBroadcastRequest represents a request to send a broadcast SMS
type SendBroadcastRequest struct {
	Message string `json:"message" binding:"required,min=1,max=1600"`
}

// SendBroadcast sends a broadcast SMS to all festival participants
// @Summary Send broadcast SMS to all festival participants
// @Tags sms
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param request body SendBroadcastRequest true "Broadcast data"
// @Success 200 {object} BroadcastResult
// @Router /festivals/{festivalId}/sms/broadcast [post]
func (h *SMSHandler) SendBroadcast(c *gin.Context) {
	festivalIDStr := c.Param("festivalId")
	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req SendBroadcastRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	// Get user ID from context (set by auth middleware)
	var createdBy *uuid.UUID
	if userID := c.GetString("user_id"); userID != "" {
		if id, err := uuid.Parse(userID); err == nil {
			createdBy = &id
		}
	}

	result, err := h.smsService.SendBroadcast(c.Request.Context(), BroadcastRequest{
		FestivalID: festivalID,
		Message:    req.Message,
		CreatedBy:  createdBy,
	})
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, result)
}

// GetSMSLogs retrieves SMS logs for a festival
// @Summary Get SMS logs for a festival
// @Tags sms
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} SMSLogResponse
// @Router /festivals/{festivalId}/sms/logs [get]
func (h *SMSHandler) GetSMSLogs(c *gin.Context) {
	festivalIDStr := c.Param("festivalId")
	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	logs, total, err := h.smsService.GetSMSLogs(c.Request.Context(), &festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Convert to response
	items := make([]SMSLogResponse, len(logs))
	for i, l := range logs {
		items[i] = l.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetBroadcasts retrieves broadcast history for a festival
// @Summary Get broadcast history for a festival
// @Tags sms
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} SMSBroadcastResponse
// @Router /festivals/{festivalId}/sms/broadcasts [get]
func (h *SMSHandler) GetBroadcasts(c *gin.Context) {
	festivalIDStr := c.Param("festivalId")
	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	broadcasts, total, err := h.smsService.GetBroadcasts(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Convert to response
	items := make([]SMSBroadcastResponse, len(broadcasts))
	for i, b := range broadcasts {
		items[i] = b.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetBroadcast retrieves a single broadcast by ID
// @Summary Get broadcast by ID
// @Tags sms
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param broadcastId path string true "Broadcast ID"
// @Success 200 {object} SMSBroadcastResponse
// @Router /festivals/{festivalId}/sms/broadcasts/{broadcastId} [get]
func (h *SMSHandler) GetBroadcast(c *gin.Context) {
	broadcastIDStr := c.Param("broadcastId")
	broadcastID, err := uuid.Parse(broadcastIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid broadcast ID", nil)
		return
	}

	broadcast, err := h.smsService.GetBroadcastByID(c.Request.Context(), broadcastID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	if broadcast == nil {
		response.NotFound(c, "Broadcast not found")
		return
	}

	response.OK(c, broadcast.ToResponse())
}

// GetSMSStats retrieves SMS statistics for a festival
// @Summary Get SMS statistics for a festival
// @Tags sms
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Success 200 {object} SMSStats
// @Router /festivals/{festivalId}/sms/stats [get]
func (h *SMSHandler) GetSMSStats(c *gin.Context) {
	festivalIDStr := c.Param("festivalId")
	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	stats, err := h.smsService.GetSMSStats(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stats)
}

// SMSTemplateInfo represents template information for the API
type SMSTemplateInfo struct {
	ID          SMSTemplate `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Content     string      `json:"content"`
	Variables   []string    `json:"variables"`
}

// GetTemplates returns available SMS templates
// @Summary Get available SMS templates
// @Tags sms
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Success 200 {array} SMSTemplateInfo
// @Router /festivals/{festivalId}/sms/templates [get]
func (h *SMSHandler) GetTemplates(c *gin.Context) {
	templates := []SMSTemplateInfo{
		{
			ID:          SMSTemplateTicketReminder,
			Name:        "Ticket Reminder",
			Description: "Reminder sent before the festival starts",
			Content:     SMSTemplateContent[SMSTemplateTicketReminder],
			Variables:   []string{"name", "festivalName", "date"},
		},
		{
			ID:          SMSTemplateSOSConfirmation,
			Name:        "SOS Confirmation",
			Description: "Confirmation when user sends SOS alert",
			Content:     SMSTemplateContent[SMSTemplateSOSConfirmation],
			Variables:   []string{},
		},
		{
			ID:          SMSTemplateTopUpConfirmation,
			Name:        "Top-Up Confirmation",
			Description: "Confirmation when wallet is topped up",
			Content:     SMSTemplateContent[SMSTemplateTopUpConfirmation],
			Variables:   []string{"name", "amount", "balance", "festivalName"},
		},
		{
			ID:          SMSTemplateBroadcast,
			Name:        "Broadcast",
			Description: "Custom message to all participants",
			Content:     SMSTemplateContent[SMSTemplateBroadcast],
			Variables:   []string{"message"},
		},
		{
			ID:          SMSTemplateWelcome,
			Name:        "Welcome",
			Description: "Welcome message when user arrives",
			Content:     SMSTemplateContent[SMSTemplateWelcome],
			Variables:   []string{"festivalName"},
		},
		{
			ID:          SMSTemplateLineupChange,
			Name:        "Lineup Change",
			Description: "Notification about lineup changes",
			Content:     SMSTemplateContent[SMSTemplateLineupChange],
			Variables:   []string{"festivalName", "message"},
		},
		{
			ID:          SMSTemplateEmergency,
			Name:        "Emergency",
			Description: "Emergency notification to all participants",
			Content:     SMSTemplateContent[SMSTemplateEmergency],
			Variables:   []string{"festivalName", "message"},
		},
		{
			ID:          SMSTemplatePaymentConfirm,
			Name:        "Payment Confirmation",
			Description: "Confirmation after payment",
			Content:     SMSTemplateContent[SMSTemplatePaymentConfirm],
			Variables:   []string{"amount", "transactionId", "festivalName"},
		},
	}

	response.OK(c, templates)
}

// BalanceResponse represents the API response for balance
type BalanceAPIResponse struct {
	Currency string  `json:"currency"`
	Balance  float64 `json:"balance"`
}

// GetBalance retrieves the current Twilio account balance
// @Summary Get Twilio account balance
// @Tags sms
// @Produce json
// @Success 200 {object} BalanceAPIResponse
// @Router /sms/balance [get]
func (h *SMSHandler) GetBalance(c *gin.Context) {
	balance, err := h.smsService.GetBalance(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, BalanceAPIResponse{
		Currency: balance.Currency,
		Balance:  balance.Balance,
	})
}

// SendSingleSMSRequest represents a request to send a single SMS
type SendSingleSMSRequest struct {
	To       string      `json:"to" binding:"required"`
	Template SMSTemplate `json:"template" binding:"required"`
	Message  string      `json:"message,omitempty"` // For custom message with BROADCAST template
	Variables map[string]string `json:"variables,omitempty"`
}

// SendSingleSMS sends a single SMS message
// @Summary Send a single SMS message
// @Tags sms
// @Accept json
// @Produce json
// @Param request body SendSingleSMSRequest true "SMS data"
// @Success 200 {object} map[string]interface{}
// @Router /sms/send [post]
func (h *SMSHandler) SendSingleSMS(c *gin.Context) {
	var req SendSingleSMSRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	// Handle different templates
	var err error
	switch req.Template {
	case SMSTemplateTicketReminder:
		name := req.Variables["name"]
		festivalName := req.Variables["festivalName"]
		date := req.Variables["date"]
		err = h.smsService.SendTicketReminder(c.Request.Context(), req.To, name, festivalName, date)

	case SMSTemplateSOSConfirmation:
		err = h.smsService.SendSOSConfirmation(c.Request.Context(), req.To)

	case SMSTemplateWelcome:
		festivalName := req.Variables["festivalName"]
		err = h.smsService.SendWelcome(c.Request.Context(), req.To, festivalName)

	case SMSTemplateBroadcast:
		if req.Message == "" {
			response.BadRequest(c, "VALIDATION_ERROR", "Message is required for broadcast template", nil)
			return
		}
		// Direct send using template
		err = h.smsService.sendTemplatedSMS(c.Request.Context(), nil, nil, req.To, SMSTemplateBroadcast, SMSVariables{"message": req.Message})

	default:
		response.BadRequest(c, "INVALID_TEMPLATE", "Invalid or unsupported template", nil)
		return
	}

	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{"success": true, "message": "SMS sent successfully"})
}

// OptOutRequest represents a request to opt out of SMS
type OptOutRequest struct {
	Phone  string `json:"phone" binding:"required"`
	Reason string `json:"reason,omitempty"`
}

// OptOut opts out a phone number from SMS notifications
// @Summary Opt out of SMS notifications
// @Tags sms
// @Accept json
// @Produce json
// @Param request body OptOutRequest true "Opt out data"
// @Success 200 {object} map[string]interface{}
// @Router /sms/opt-out [post]
func (h *SMSHandler) OptOut(c *gin.Context) {
	var req OptOutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	// Get user ID from context if available
	var userID *uuid.UUID
	if userIDStr := c.GetString("user_id"); userIDStr != "" {
		if id, err := uuid.Parse(userIDStr); err == nil {
			userID = &id
		}
	}

	if err := h.smsService.OptOut(c.Request.Context(), req.Phone, userID, req.Reason); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{"success": true, "message": "Successfully opted out of SMS notifications"})
}

// OptInRequest represents a request to opt in to SMS
type OptInRequest struct {
	Phone string `json:"phone" binding:"required"`
}

// OptIn opts in a phone number to SMS notifications
// @Summary Opt in to SMS notifications
// @Tags sms
// @Accept json
// @Produce json
// @Param request body OptInRequest true "Opt in data"
// @Success 200 {object} map[string]interface{}
// @Router /sms/opt-in [post]
func (h *SMSHandler) OptIn(c *gin.Context) {
	var req OptInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	if err := h.smsService.OptIn(c.Request.Context(), req.Phone); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{"success": true, "message": "Successfully opted in to SMS notifications"})
}

// CheckOptOutRequest represents a request to check opt-out status
type CheckOptOutRequest struct {
	Phone string `form:"phone" binding:"required"`
}

// CheckOptOut checks if a phone number is opted out
// @Summary Check if phone number is opted out
// @Tags sms
// @Produce json
// @Param phone query string true "Phone number"
// @Success 200 {object} map[string]interface{}
// @Router /sms/opt-out/check [get]
func (h *SMSHandler) CheckOptOut(c *gin.Context) {
	phone := c.Query("phone")
	if phone == "" {
		response.BadRequest(c, "VALIDATION_ERROR", "Phone number is required", nil)
		return
	}

	isOptedOut, err := h.smsService.IsOptedOut(c.Request.Context(), phone)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"phone":     phone,
			"optedOut":  isOptedOut,
		},
	})
}
