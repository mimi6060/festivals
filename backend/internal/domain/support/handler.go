package support

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// Handler handles HTTP requests for support operations
type Handler struct {
	service *Service
}

// NewHandler creates a new support handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers the support routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Support ticket routes (festival scoped)
	support := r.Group("/support")
	{
		// Tickets
		support.POST("/tickets", h.CreateTicket)
		support.GET("/tickets", h.ListTickets)

		// FAQ
		support.GET("/faq", h.ListFAQs)
		support.POST("/faq", h.CreateFAQ)
		support.GET("/faq/:faqId", h.GetFAQ)
		support.PATCH("/faq/:faqId", h.UpdateFAQ)
		support.DELETE("/faq/:faqId", h.DeleteFAQ)
	}

	// Ticket-specific routes (not festival scoped for direct access)
	tickets := r.Group("/support/tickets")
	{
		tickets.GET("/:ticketId", h.GetTicket)
		tickets.GET("/:ticketId/messages", h.GetMessages)
		tickets.POST("/:ticketId/messages", h.AddMessage)
		tickets.PUT("/:ticketId/status", h.UpdateTicketStatus)
		tickets.PUT("/:ticketId/assign", h.AssignTicket)
	}

	// Stats route
	r.GET("/support/stats", h.GetTicketStats)

	// User's own tickets
	r.GET("/me/support/tickets", h.GetMyTickets)
}

// CreateTicket creates a new support ticket
// @Summary Create a support ticket
// @Description Create a new support ticket for the current user
// @Tags support
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param request body CreateTicketRequest true "Ticket data"
// @Success 201 {object} response.Response{data=SupportTicketResponse} "Ticket created"
// @Failure 400 {object} response.ErrorResponse "Invalid request body"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/support/tickets [post]
func (h *Handler) CreateTicket(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Authentication required")
		return
	}

	var req CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	ticket, err := h.service.CreateSupportTicket(c.Request.Context(), festivalID, userID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, ticket.ToResponse())
}

// ListTickets lists support tickets for a festival
// @Summary List support tickets
// @Description Get paginated list of support tickets for a festival (staff only)
// @Tags support
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param status query string false "Filter by status" Enums(OPEN, IN_PROGRESS, WAITING_CUSTOMER, RESOLVED, CLOSED)
// @Param priority query string false "Filter by priority" Enums(LOW, MEDIUM, HIGH, URGENT)
// @Param category query string false "Filter by category" Enums(PAYMENT, REFUND, TECHNICAL, ACCESS, OTHER)
// @Param assignedTo query string false "Filter by assigned staff ID" format(uuid)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} response.Response{data=[]SupportTicketResponse,meta=response.Meta} "Ticket list"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden - staff only"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/support/tickets [get]
func (h *Handler) ListTickets(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	filters := TicketFilters{}

	if status := c.Query("status"); status != "" {
		s := TicketStatus(status)
		filters.Status = &s
	}
	if priority := c.Query("priority"); priority != "" {
		p := TicketPriority(priority)
		filters.Priority = &p
	}
	if category := c.Query("category"); category != "" {
		cat := TicketCategory(category)
		filters.Category = &cat
	}
	if assignedToStr := c.Query("assignedTo"); assignedToStr != "" {
		if assignedTo, err := uuid.Parse(assignedToStr); err == nil {
			filters.AssignedTo = &assignedTo
		}
	}

	tickets, total, err := h.service.GetTicketsByFestival(c.Request.Context(), festivalID, filters, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]SupportTicketResponse, len(tickets))
	for i, t := range tickets {
		items[i] = t.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetTicket gets a support ticket by ID
// @Summary Get support ticket
// @Description Get detailed information about a specific support ticket
// @Tags support
// @Produce json
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Success 200 {object} response.Response{data=SupportTicketResponse} "Ticket details"
// @Failure 400 {object} response.ErrorResponse "Invalid ticket ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Ticket not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /support/tickets/{ticketId} [get]
func (h *Handler) GetTicket(c *gin.Context) {
	ticketID, err := uuid.Parse(c.Param("ticketId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket ID", nil)
		return
	}

	ticket, err := h.service.GetTicket(c.Request.Context(), ticketID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Ticket not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, ticket.ToResponse())
}

// GetMessages gets messages for a support ticket
// @Summary Get ticket messages
// @Description Get paginated list of messages for a support ticket
// @Tags support
// @Produce json
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(50)
// @Success 200 {object} response.Response{data=[]TicketMessageResponse,meta=response.Meta} "Message list"
// @Failure 400 {object} response.ErrorResponse "Invalid ticket ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Ticket not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /support/tickets/{ticketId}/messages [get]
func (h *Handler) GetMessages(c *gin.Context) {
	ticketID, err := uuid.Parse(c.Param("ticketId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))

	messages, total, err := h.service.GetMessages(c.Request.Context(), ticketID, page, perPage)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Ticket not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	items := make([]TicketMessageResponse, len(messages))
	for i, m := range messages {
		items[i] = m.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// AddMessage adds a message to a support ticket
// @Summary Add message to ticket
// @Description Add a new message to an existing support ticket
// @Tags support
// @Accept json
// @Produce json
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Param request body CreateMessageRequest true "Message data"
// @Success 201 {object} response.Response{data=TicketMessageResponse} "Message created"
// @Failure 400 {object} response.ErrorResponse "Invalid request body or closed ticket"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Ticket not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /support/tickets/{ticketId}/messages [post]
func (h *Handler) AddMessage(c *gin.Context) {
	ticketID, err := uuid.Parse(c.Param("ticketId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket ID", nil)
		return
	}

	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Authentication required")
		return
	}

	var req CreateMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	// Determine sender type based on user role
	senderType := SenderTypeUser
	if isStaff(c) {
		senderType = SenderTypeStaff
	}

	message, err := h.service.ReplyToTicket(c.Request.Context(), ticketID, userID, senderType, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Ticket not found")
			return
		}
		if err.Error() == "cannot reply to a closed ticket" {
			response.BadRequest(c, "TICKET_CLOSED", "Cannot reply to a closed ticket", nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, message.ToResponse())
}

// UpdateTicketStatus updates the status of a support ticket
// @Summary Update ticket status
// @Description Update the status of a support ticket (staff only)
// @Tags support
// @Accept json
// @Produce json
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Param request body UpdateTicketStatusRequest true "Status update data"
// @Success 200 {object} response.Response{data=SupportTicketResponse} "Updated ticket"
// @Failure 400 {object} response.ErrorResponse "Invalid request or status transition"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden - staff only"
// @Failure 404 {object} response.ErrorResponse "Ticket not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /support/tickets/{ticketId}/status [put]
func (h *Handler) UpdateTicketStatus(c *gin.Context) {
	ticketID, err := uuid.Parse(c.Param("ticketId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket ID", nil)
		return
	}

	var req UpdateTicketStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	ticket, err := h.service.UpdateTicketStatus(c.Request.Context(), ticketID, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Ticket not found")
			return
		}
		if err.Error()[:7] == "invalid" {
			response.BadRequest(c, "INVALID_STATUS", err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, ticket.ToResponse())
}

// AssignTicket assigns a support ticket to a staff member
// @Summary Assign ticket to staff
// @Description Assign a support ticket to a staff member (staff only)
// @Tags support
// @Accept json
// @Produce json
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Param request body AssignTicketRequest true "Assignment data"
// @Success 200 {object} response.Response{data=SupportTicketResponse} "Updated ticket"
// @Failure 400 {object} response.ErrorResponse "Invalid request or closed ticket"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden - staff only"
// @Failure 404 {object} response.ErrorResponse "Ticket not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /support/tickets/{ticketId}/assign [put]
func (h *Handler) AssignTicket(c *gin.Context) {
	ticketID, err := uuid.Parse(c.Param("ticketId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket ID", nil)
		return
	}

	var req AssignTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	ticket, err := h.service.AssignToStaff(c.Request.Context(), ticketID, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Ticket not found")
			return
		}
		if err.Error() == "cannot assign a closed ticket" {
			response.BadRequest(c, "TICKET_CLOSED", "Cannot assign a closed ticket", nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, ticket.ToResponse())
}

// GetTicketStats gets support ticket statistics
// @Summary Get ticket statistics
// @Description Get support ticket statistics for a festival (staff only)
// @Tags support
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Success 200 {object} response.Response{data=TicketStats} "Ticket statistics"
// @Failure 400 {object} response.ErrorResponse "Invalid festival ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden - staff only"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/support/stats [get]
func (h *Handler) GetTicketStats(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	stats, err := h.service.GetTicketStats(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stats)
}

// GetMyTickets gets the current user's support tickets
// @Summary Get my support tickets
// @Description Get paginated list of support tickets for the current user
// @Tags support
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} response.Response{data=[]SupportTicketResponse,meta=response.Meta} "User's tickets"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /me/support/tickets [get]
func (h *Handler) GetMyTickets(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Authentication required")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	tickets, total, err := h.service.GetTicketsByUser(c.Request.Context(), userID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]SupportTicketResponse, len(tickets))
	for i, t := range tickets {
		items[i] = t.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// FAQ Handlers

// ListFAQs lists FAQ items for a festival
// @Summary List FAQ items
// @Description Get paginated list of FAQ items for a festival
// @Tags support
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param category query string false "Filter by category"
// @Param published_only query bool false "Only show published FAQs" default(true)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(50)
// @Success 200 {object} response.Response{data=[]FAQItemResponse,meta=response.Meta} "FAQ list"
// @Failure 400 {object} response.ErrorResponse "Invalid festival ID"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Router /festivals/{festivalId}/support/faq [get]
func (h *Handler) ListFAQs(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))
	publishedOnly := c.DefaultQuery("published_only", "true") == "true"

	// Check for category filter
	category := c.Query("category")
	if category != "" {
		faqs, err := h.service.GetFAQsByCategory(c.Request.Context(), festivalID, category, publishedOnly)
		if err != nil {
			response.InternalError(c, err.Error())
			return
		}

		items := make([]FAQItemResponse, len(faqs))
		for i, f := range faqs {
			items[i] = f.ToResponse()
		}

		response.OK(c, items)
		return
	}

	faqs, total, err := h.service.GetFAQsByFestival(c.Request.Context(), festivalID, publishedOnly, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]FAQItemResponse, len(faqs))
	for i, f := range faqs {
		items[i] = f.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// CreateFAQ creates a new FAQ item
// @Summary Create FAQ item
// @Description Create a new FAQ item for a festival (staff only)
// @Tags support
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param request body CreateFAQRequest true "FAQ data"
// @Success 201 {object} response.Response{data=FAQItemResponse} "FAQ created"
// @Failure 400 {object} response.ErrorResponse "Invalid request body"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden - staff only"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/support/faq [post]
func (h *Handler) CreateFAQ(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	var req CreateFAQRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	faq, err := h.service.CreateFAQ(c.Request.Context(), festivalID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, faq.ToResponse())
}

// GetFAQ gets an FAQ item by ID
// @Summary Get FAQ item
// @Description Get detailed information about a specific FAQ item
// @Tags support
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param faqId path string true "FAQ ID" format(uuid)
// @Success 200 {object} response.Response{data=FAQItemResponse} "FAQ details"
// @Failure 400 {object} response.ErrorResponse "Invalid FAQ ID"
// @Failure 404 {object} response.ErrorResponse "FAQ not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Router /festivals/{festivalId}/support/faq/{faqId} [get]
func (h *Handler) GetFAQ(c *gin.Context) {
	faqID, err := uuid.Parse(c.Param("faqId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid FAQ ID", nil)
		return
	}

	faq, err := h.service.GetFAQ(c.Request.Context(), faqID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "FAQ not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, faq.ToResponse())
}

// UpdateFAQ updates an FAQ item
// @Summary Update FAQ item
// @Description Update an existing FAQ item (staff only)
// @Tags support
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param faqId path string true "FAQ ID" format(uuid)
// @Param request body UpdateFAQRequest true "Update data"
// @Success 200 {object} response.Response{data=FAQItemResponse} "Updated FAQ"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden - staff only"
// @Failure 404 {object} response.ErrorResponse "FAQ not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/support/faq/{faqId} [patch]
func (h *Handler) UpdateFAQ(c *gin.Context) {
	faqID, err := uuid.Parse(c.Param("faqId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid FAQ ID", nil)
		return
	}

	var req UpdateFAQRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	faq, err := h.service.UpdateFAQ(c.Request.Context(), faqID, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "FAQ not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, faq.ToResponse())
}

// DeleteFAQ deletes an FAQ item
// @Summary Delete FAQ item
// @Description Permanently delete an FAQ item (staff only)
// @Tags support
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param faqId path string true "FAQ ID" format(uuid)
// @Success 204 "FAQ deleted"
// @Failure 400 {object} response.ErrorResponse "Invalid FAQ ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Forbidden - staff only"
// @Failure 404 {object} response.ErrorResponse "FAQ not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/support/faq/{faqId} [delete]
func (h *Handler) DeleteFAQ(c *gin.Context) {
	faqID, err := uuid.Parse(c.Param("faqId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid FAQ ID", nil)
		return
	}

	if err := h.service.DeleteFAQ(c.Request.Context(), faqID); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "FAQ not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// Helper functions

func getFestivalID(c *gin.Context) (uuid.UUID, error) {
	// First try from context (set by middleware)
	festivalIDStr := c.GetString("festival_id")
	if festivalIDStr == "" {
		// Try from URL query parameter
		festivalIDStr = c.Query("festivalId")
	}
	if festivalIDStr == "" {
		// Try from URL path parameter
		festivalIDStr = c.Param("festivalId")
	}
	if festivalIDStr == "" {
		// Try from URL path parameter (alternate name)
		festivalIDStr = c.Param("id")
	}
	if festivalIDStr == "" {
		return uuid.Nil, errors.ErrBadRequest
	}
	return uuid.Parse(festivalIDStr)
}

func getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		return uuid.Nil, errors.ErrUnauthorized
	}
	return uuid.Parse(userIDStr)
}

func isStaff(c *gin.Context) bool {
	// Check if user has staff role from context
	role := c.GetString("role")
	return role == "staff" || role == "admin" || role == "support"
}
