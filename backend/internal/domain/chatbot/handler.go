package chatbot

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// Handler handles HTTP requests for chatbot
type Handler struct {
	service *Service
}

// NewHandler creates a new chatbot handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers the chatbot routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Public chat routes (for mobile app users)
	chat := r.Group("/chat")
	{
		chat.POST("/start", h.StartConversation)
		chat.POST("/:conversationId/message", h.SendMessage)
		chat.GET("/:conversationId", h.GetConversation)
		chat.POST("/:conversationId/escalate", h.EscalateConversation)
		chat.POST("/:conversationId/close", h.CloseConversation)
		chat.POST("/:conversationId/rate", h.RateConversation)
		chat.GET("/suggestions/:festivalId", h.GetSuggestedQuestions)
	}

	// Admin routes (for festival management)
	admin := r.Group("/admin/chatbot")
	{
		// Config
		admin.GET("/config/:festivalId", h.GetConfig)
		admin.PATCH("/config/:festivalId", h.UpdateConfig)

		// FAQ management
		admin.POST("/faq/:festivalId", h.CreateFAQEntry)
		admin.GET("/faq/:festivalId", h.ListFAQEntries)
		admin.GET("/faq/:festivalId/:faqId", h.GetFAQEntry)
		admin.PUT("/faq/:festivalId/:faqId", h.UpdateFAQEntry)
		admin.DELETE("/faq/:festivalId/:faqId", h.DeleteFAQEntry)

		// Conversations
		admin.GET("/conversations/:festivalId", h.ListConversations)
		admin.GET("/conversations/:festivalId/:conversationId", h.GetConversationAdmin)
		admin.DELETE("/conversations/:festivalId/:conversationId", h.DeleteConversation)

		// Analytics
		admin.GET("/analytics/:festivalId", h.GetAnalytics)
	}
}

// StartConversation starts a new conversation
// @Summary Start a new chat conversation
// @Tags chat
// @Accept json
// @Produce json
// @Param request body StartConversationRequest true "Start conversation request"
// @Success 200 {object} ConversationResponse
// @Router /chat/start [post]
func (h *Handler) StartConversation(c *gin.Context) {
	var req StartConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	festivalID, err := uuid.Parse(req.FestivalID)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	// Get user ID from context
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		response.Unauthorized(c, "User not authenticated")
		return
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_USER_ID", "Invalid user ID", nil)
		return
	}

	conv, err := h.service.StartConversation(c.Request.Context(), userID, festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, conv.ToResponse())
}

// SendMessage sends a message in a conversation
// @Summary Send a message in a conversation
// @Tags chat
// @Accept json
// @Produce json
// @Param conversationId path string true "Conversation ID"
// @Param request body SendMessageRequest true "Message request"
// @Success 200 {object} SendMessageResponse
// @Router /chat/{conversationId}/message [post]
func (h *Handler) SendMessage(c *gin.Context) {
	conversationID, err := uuid.Parse(c.Param("conversationId"))
	if err != nil {
		response.BadRequest(c, "INVALID_CONVERSATION_ID", "Invalid conversation ID", nil)
		return
	}

	var req SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	resp, err := h.service.SendMessage(c.Request.Context(), conversationID, req.Message)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, resp)
}

// GetConversation gets a conversation with messages
// @Summary Get a conversation
// @Tags chat
// @Produce json
// @Param conversationId path string true "Conversation ID"
// @Success 200 {object} ConversationResponse
// @Router /chat/{conversationId} [get]
func (h *Handler) GetConversation(c *gin.Context) {
	conversationID, err := uuid.Parse(c.Param("conversationId"))
	if err != nil {
		response.BadRequest(c, "INVALID_CONVERSATION_ID", "Invalid conversation ID", nil)
		return
	}

	conv, err := h.service.GetConversation(c.Request.Context(), conversationID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	if conv == nil {
		response.NotFound(c, "Conversation not found")
		return
	}

	response.OK(c, conv.ToResponse())
}

// EscalateConversation escalates a conversation to a human agent
// @Summary Escalate a conversation
// @Tags chat
// @Accept json
// @Produce json
// @Param conversationId path string true "Conversation ID"
// @Param request body EscalateRequest true "Escalate request"
// @Success 200
// @Router /chat/{conversationId}/escalate [post]
func (h *Handler) EscalateConversation(c *gin.Context) {
	conversationID, err := uuid.Parse(c.Param("conversationId"))
	if err != nil {
		response.BadRequest(c, "INVALID_CONVERSATION_ID", "Invalid conversation ID", nil)
		return
	}

	var req EscalateRequest
	_ = c.ShouldBindJSON(&req)

	if err := h.service.EscalateConversation(c.Request.Context(), conversationID, req.Reason); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{"message": "Conversation escalated successfully"})
}

// CloseConversation closes a conversation
// @Summary Close a conversation
// @Tags chat
// @Param conversationId path string true "Conversation ID"
// @Success 200
// @Router /chat/{conversationId}/close [post]
func (h *Handler) CloseConversation(c *gin.Context) {
	conversationID, err := uuid.Parse(c.Param("conversationId"))
	if err != nil {
		response.BadRequest(c, "INVALID_CONVERSATION_ID", "Invalid conversation ID", nil)
		return
	}

	if err := h.service.CloseConversation(c.Request.Context(), conversationID); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{"message": "Conversation closed successfully"})
}

// RateConversation rates a conversation
// @Summary Rate a conversation
// @Tags chat
// @Accept json
// @Produce json
// @Param conversationId path string true "Conversation ID"
// @Param request body RateConversationRequest true "Rate request"
// @Success 200
// @Router /chat/{conversationId}/rate [post]
func (h *Handler) RateConversation(c *gin.Context) {
	conversationID, err := uuid.Parse(c.Param("conversationId"))
	if err != nil {
		response.BadRequest(c, "INVALID_CONVERSATION_ID", "Invalid conversation ID", nil)
		return
	}

	var req RateConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	if err := h.service.RateConversation(c.Request.Context(), conversationID, req.Rating, req.Feedback); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{"message": "Conversation rated successfully"})
}

// GetSuggestedQuestions gets suggested questions for a festival
// @Summary Get suggested questions
// @Tags chat
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Success 200 {array} string
// @Router /chat/suggestions/{festivalId} [get]
func (h *Handler) GetSuggestedQuestions(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	suggestions := h.service.GetSuggestedQuestions(c.Request.Context(), festivalID)
	response.OK(c, suggestions)
}

// Admin handlers

// GetConfig gets the chatbot configuration
// @Summary Get chatbot configuration
// @Tags admin/chatbot
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Success 200 {object} ChatbotConfigResponse
// @Router /admin/chatbot/config/{festivalId} [get]
func (h *Handler) GetConfig(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	config, err := h.service.GetConfig(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, config.ToResponse())
}

// UpdateConfig updates the chatbot configuration
// @Summary Update chatbot configuration
// @Tags admin/chatbot
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param request body ChatbotConfigRequest true "Config update request"
// @Success 200 {object} ChatbotConfigResponse
// @Router /admin/chatbot/config/{festivalId} [patch]
func (h *Handler) UpdateConfig(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	var req ChatbotConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	config, err := h.service.UpdateConfig(c.Request.Context(), festivalID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, config.ToResponse())
}

// CreateFAQEntry creates a new FAQ entry
// @Summary Create a FAQ entry
// @Tags admin/chatbot
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param request body FAQEntryRequest true "FAQ entry request"
// @Success 201 {object} FAQEntryResponse
// @Router /admin/chatbot/faq/{festivalId} [post]
func (h *Handler) CreateFAQEntry(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	var req FAQEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	faq, err := h.service.CreateFAQEntry(c.Request.Context(), festivalID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, faq.ToResponse())
}

// ListFAQEntries lists FAQ entries for a festival
// @Summary List FAQ entries
// @Tags admin/chatbot
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param category query string false "Filter by category"
// @Param activeOnly query bool false "Only show active entries"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} FAQEntryResponse
// @Router /admin/chatbot/faq/{festivalId} [get]
func (h *Handler) ListFAQEntries(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	category := c.Query("category")
	activeOnly, _ := strconv.ParseBool(c.Query("activeOnly"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	faqs, total, err := h.service.ListFAQEntries(c.Request.Context(), festivalID, category, activeOnly, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]FAQEntryResponse, len(faqs))
	for i, f := range faqs {
		items[i] = f.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetFAQEntry gets a single FAQ entry
// @Summary Get a FAQ entry
// @Tags admin/chatbot
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param faqId path string true "FAQ ID"
// @Success 200 {object} FAQEntryResponse
// @Router /admin/chatbot/faq/{festivalId}/{faqId} [get]
func (h *Handler) GetFAQEntry(c *gin.Context) {
	faqID, err := uuid.Parse(c.Param("faqId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FAQ_ID", "Invalid FAQ ID", nil)
		return
	}

	faq, err := h.service.repo.GetFAQByID(c.Request.Context(), faqID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	if faq == nil {
		response.NotFound(c, "FAQ entry not found")
		return
	}

	response.OK(c, faq.ToResponse())
}

// UpdateFAQEntry updates a FAQ entry
// @Summary Update a FAQ entry
// @Tags admin/chatbot
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param faqId path string true "FAQ ID"
// @Param request body FAQEntryRequest true "FAQ entry request"
// @Success 200 {object} FAQEntryResponse
// @Router /admin/chatbot/faq/{festivalId}/{faqId} [put]
func (h *Handler) UpdateFAQEntry(c *gin.Context) {
	faqID, err := uuid.Parse(c.Param("faqId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FAQ_ID", "Invalid FAQ ID", nil)
		return
	}

	var req FAQEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	faq, err := h.service.UpdateFAQEntry(c.Request.Context(), faqID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, faq.ToResponse())
}

// DeleteFAQEntry deletes a FAQ entry
// @Summary Delete a FAQ entry
// @Tags admin/chatbot
// @Param festivalId path string true "Festival ID"
// @Param faqId path string true "FAQ ID"
// @Success 204
// @Router /admin/chatbot/faq/{festivalId}/{faqId} [delete]
func (h *Handler) DeleteFAQEntry(c *gin.Context) {
	faqID, err := uuid.Parse(c.Param("faqId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FAQ_ID", "Invalid FAQ ID", nil)
		return
	}

	if err := h.service.DeleteFAQEntry(c.Request.Context(), faqID); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// ListConversations lists conversations for a festival
// @Summary List conversations
// @Tags admin/chatbot
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param status query string false "Filter by status (ACTIVE, CLOSED, ESCALATED)"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} ConversationListResponse
// @Router /admin/chatbot/conversations/{festivalId} [get]
func (h *Handler) ListConversations(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	var status *ConversationStatus
	if s := c.Query("status"); s != "" {
		st := ConversationStatus(s)
		status = &st
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	conversations, total, err := h.service.ListConversations(c.Request.Context(), festivalID, status, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]ConversationResponse, len(conversations))
	for i, conv := range conversations {
		items[i] = conv.ToResponse()
	}

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	response.OK(c, ConversationListResponse{
		Items:      items,
		Total:      total,
		Page:       page,
		PerPage:    perPage,
		TotalPages: totalPages,
	})
}

// GetConversationAdmin gets a conversation with full details (admin)
// @Summary Get a conversation (admin)
// @Tags admin/chatbot
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param conversationId path string true "Conversation ID"
// @Success 200 {object} ConversationResponse
// @Router /admin/chatbot/conversations/{festivalId}/{conversationId} [get]
func (h *Handler) GetConversationAdmin(c *gin.Context) {
	conversationID, err := uuid.Parse(c.Param("conversationId"))
	if err != nil {
		response.BadRequest(c, "INVALID_CONVERSATION_ID", "Invalid conversation ID", nil)
		return
	}

	conv, err := h.service.GetConversation(c.Request.Context(), conversationID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	if conv == nil {
		response.NotFound(c, "Conversation not found")
		return
	}

	response.OK(c, conv.ToResponse())
}

// DeleteConversation deletes a conversation (admin)
// @Summary Delete a conversation (admin)
// @Tags admin/chatbot
// @Param festivalId path string true "Festival ID"
// @Param conversationId path string true "Conversation ID"
// @Success 204
// @Router /admin/chatbot/conversations/{festivalId}/{conversationId} [delete]
func (h *Handler) DeleteConversation(c *gin.Context) {
	conversationID, err := uuid.Parse(c.Param("conversationId"))
	if err != nil {
		response.BadRequest(c, "INVALID_CONVERSATION_ID", "Invalid conversation ID", nil)
		return
	}

	if err := h.service.repo.DeleteConversation(c.Request.Context(), conversationID); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// GetAnalytics gets chatbot analytics
// @Summary Get chatbot analytics
// @Tags admin/chatbot
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param days query int false "Number of days" default(7)
// @Success 200 {object} AnalyticsResponse
// @Router /admin/chatbot/analytics/{festivalId} [get]
func (h *Handler) GetAnalytics(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	days, _ := strconv.Atoi(c.DefaultQuery("days", "7"))

	analytics, err := h.service.GetAnalytics(c.Request.Context(), festivalID, days)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, analytics)
}
