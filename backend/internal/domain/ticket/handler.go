package ticket

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Ticket type routes
	ticketTypes := r.Group("/ticket-types")
	{
		ticketTypes.POST("", h.CreateTicketType)
		ticketTypes.GET("", h.ListTicketTypes)
		ticketTypes.GET("/:id", h.GetTicketType)
		ticketTypes.PATCH("/:id", h.UpdateTicketType)
		ticketTypes.DELETE("/:id", h.DeleteTicketType)
	}

	// Ticket routes
	tickets := r.Group("/tickets")
	{
		tickets.POST("", h.CreateTicket)
		tickets.GET("", h.ListTickets)
		tickets.GET("/:id", h.GetTicket)
		tickets.GET("/code/:code", h.GetTicketByCode)
		tickets.POST("/scan", h.ScanTicket)
		tickets.POST("/:id/transfer", h.TransferTicket)
	}

	// User ticket routes
	r.GET("/me/tickets", h.GetMyTickets)
}

// CreateTicketType creates a new ticket type
// @Summary Create a new ticket type
// @Tags ticket-types
// @Accept json
// @Produce json
// @Param request body CreateTicketTypeRequest true "Ticket type data"
// @Success 201 {object} TicketTypeResponse
// @Router /ticket-types [post]
func (h *Handler) CreateTicketType(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	var req CreateTicketTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	ticketType, err := h.service.CreateTicketType(c.Request.Context(), festivalID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, ticketType.ToResponse())
}

// ListTicketTypes returns ticket types for a festival
// @Summary List ticket types
// @Tags ticket-types
// @Produce json
// @Param festivalId query string true "Festival ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} TicketTypeResponse
// @Router /ticket-types [get]
func (h *Handler) ListTicketTypes(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	ticketTypes, total, err := h.service.ListTicketTypes(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]TicketTypeResponse, len(ticketTypes))
	for i, tt := range ticketTypes {
		items[i] = tt.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetTicketType returns a ticket type by ID
// @Summary Get ticket type by ID
// @Tags ticket-types
// @Produce json
// @Param id path string true "Ticket Type ID"
// @Success 200 {object} TicketTypeResponse
// @Router /ticket-types/{id} [get]
func (h *Handler) GetTicketType(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket type ID", nil)
		return
	}

	ticketType, err := h.service.GetTicketType(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Ticket type not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, ticketType.ToResponse())
}

// UpdateTicketType updates a ticket type
// @Summary Update ticket type
// @Tags ticket-types
// @Accept json
// @Produce json
// @Param id path string true "Ticket Type ID"
// @Param request body UpdateTicketTypeRequest true "Update data"
// @Success 200 {object} TicketTypeResponse
// @Router /ticket-types/{id} [patch]
func (h *Handler) UpdateTicketType(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket type ID", nil)
		return
	}

	var req UpdateTicketTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	ticketType, err := h.service.UpdateTicketType(c.Request.Context(), id, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Ticket type not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, ticketType.ToResponse())
}

// DeleteTicketType deletes a ticket type
// @Summary Delete ticket type
// @Tags ticket-types
// @Param id path string true "Ticket Type ID"
// @Success 204
// @Router /ticket-types/{id} [delete]
func (h *Handler) DeleteTicketType(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket type ID", nil)
		return
	}

	if err := h.service.DeleteTicketType(c.Request.Context(), id); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Ticket type not found")
			return
		}
		if err.Error() == "cannot delete ticket type with existing tickets" {
			response.BadRequest(c, "HAS_TICKETS", "Cannot delete ticket type with existing tickets", nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// CreateTicket creates a new individual ticket
// @Summary Create a new ticket
// @Tags tickets
// @Accept json
// @Produce json
// @Param request body CreateTicketRequest true "Ticket data"
// @Success 201 {object} TicketResponse
// @Router /tickets [post]
func (h *Handler) CreateTicket(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	var req CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	ticket, err := h.service.CreateTicket(c.Request.Context(), festivalID, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Ticket type not found")
			return
		}
		if err.Error() == "ticket type sold out" {
			response.BadRequest(c, "SOLD_OUT", "Ticket type is sold out", nil)
			return
		}
		if err.Error() == "ticket type not available for sale" {
			response.BadRequest(c, "NOT_AVAILABLE", "Ticket type is not available for sale", nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, ticket.ToResponse())
}

// ListTickets returns a paginated list of tickets with filters
// @Summary List tickets
// @Tags tickets
// @Produce json
// @Param festivalId query string true "Festival ID"
// @Param ticketTypeId query string false "Filter by ticket type ID"
// @Param status query string false "Filter by status"
// @Param userId query string false "Filter by user ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} TicketResponse
// @Router /tickets [get]
func (h *Handler) ListTickets(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	filters := TicketFilters{
		FestivalID: festivalID,
	}

	if ticketTypeIDStr := c.Query("ticketTypeId"); ticketTypeIDStr != "" {
		if ticketTypeID, err := uuid.Parse(ticketTypeIDStr); err == nil {
			filters.TicketTypeID = &ticketTypeID
		}
	}

	if status := c.Query("status"); status != "" {
		ticketStatus := TicketStatus(status)
		filters.Status = &ticketStatus
	}

	if userIDStr := c.Query("userId"); userIDStr != "" {
		if userID, err := uuid.Parse(userIDStr); err == nil {
			filters.UserID = &userID
		}
	}

	tickets, total, err := h.service.ListTicketsByFestival(c.Request.Context(), filters.FestivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]TicketResponse, len(tickets))
	for i, t := range tickets {
		items[i] = t.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetTicket returns a ticket by ID
// @Summary Get ticket by ID
// @Tags tickets
// @Produce json
// @Param id path string true "Ticket ID"
// @Success 200 {object} TicketResponse
// @Router /tickets/{id} [get]
func (h *Handler) GetTicket(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket ID", nil)
		return
	}

	ticket, err := h.service.GetTicket(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound || err == errors.ErrTicketNotFound {
			response.NotFound(c, "Ticket not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, ticket.ToResponse())
}

// GetTicketByCode returns a ticket by its unique code
// @Summary Get ticket by code
// @Tags tickets
// @Produce json
// @Param code path string true "Ticket code"
// @Success 200 {object} TicketResponse
// @Router /tickets/code/{code} [get]
func (h *Handler) GetTicketByCode(c *gin.Context) {
	code := c.Param("code")
	if code == "" {
		response.BadRequest(c, "INVALID_CODE", "Ticket code is required", nil)
		return
	}

	ticket, err := h.service.GetTicketByCode(c.Request.Context(), code)
	if err != nil {
		if err == errors.ErrNotFound || err == errors.ErrTicketNotFound {
			response.NotFound(c, "Ticket not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, ticket.ToResponse())
}

// ScanTicket validates and scans a ticket (for entry/exit)
// @Summary Scan/validate ticket
// @Tags tickets
// @Accept json
// @Produce json
// @Param request body ScanTicketRequest true "Scan data"
// @Success 200 {object} ScanResponse
// @Router /tickets/scan [post]
func (h *Handler) ScanTicket(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	var req ScanTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	staffID, err := getStaffIDRequired(c)
	if err != nil {
		response.Unauthorized(c, "Staff authentication required")
		return
	}

	scanResult, err := h.service.ScanTicket(c.Request.Context(), festivalID, req, staffID)
	if err != nil {
		// Handle specific scan errors with appropriate responses
		switch err {
		case errors.ErrTicketNotFound:
			response.OK(c, ScanResponse{
				Success:   false,
				Result:    ScanResultInvalid,
				Message:   "Ticket not found",
				ScannedAt: time.Now().Format(time.RFC3339),
			})
			return
		case errors.ErrTicketAlreadyUsed:
			response.OK(c, ScanResponse{
				Success:   false,
				Result:    ScanResultAlready,
				Message:   "Ticket has already been used",
				ScannedAt: time.Now().Format(time.RFC3339),
			})
			return
		case errors.ErrTicketExpired:
			response.OK(c, ScanResponse{
				Success:   false,
				Result:    ScanResultExpired,
				Message:   "Ticket has expired",
				ScannedAt: time.Now().Format(time.RFC3339),
			})
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, scanResult)
}

// TransferTicket transfers a ticket to another person
// @Summary Transfer ticket
// @Tags tickets
// @Accept json
// @Produce json
// @Param id path string true "Ticket ID"
// @Param request body TransferTicketRequest true "Transfer data"
// @Success 200 {object} TicketResponse
// @Router /tickets/{id}/transfer [post]
func (h *Handler) TransferTicket(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket ID", nil)
		return
	}

	var req TransferTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	// Ensure the ticket ID in path matches the request
	req.TicketID = id

	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	ticket, err := h.service.TransferTicket(c.Request.Context(), userID, req)
	if err != nil {
		if err == errors.ErrNotFound || err == errors.ErrTicketNotFound {
			response.NotFound(c, "Ticket not found")
			return
		}
		if err.Error() == "transfer not allowed for this ticket type" {
			response.BadRequest(c, "TRANSFER_NOT_ALLOWED", "Transfer is not allowed for this ticket type", nil)
			return
		}
		if err.Error() == "maximum transfers exceeded" {
			response.BadRequest(c, "MAX_TRANSFERS_EXCEEDED", "Maximum number of transfers exceeded", nil)
			return
		}
		if err.Error() == "user does not own this ticket" {
			response.Forbidden(c, "You do not own this ticket")
			return
		}
		if err.Error() == "ticket is not valid for transfer" {
			response.BadRequest(c, "INVALID_STATUS", "Ticket is not valid for transfer", nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, ticket.ToResponse())
}

// GetMyTickets returns tickets for the current authenticated user
// @Summary Get current user's tickets
// @Tags tickets
// @Produce json
// @Param festivalId query string false "Filter by festival ID"
// @Param status query string false "Filter by status"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} TicketResponse
// @Router /me/tickets [get]
func (h *Handler) GetMyTickets(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	filters := TicketFilters{
		UserID: &userID,
	}

	// Optional festival filter
	if festivalIDStr := c.Query("festivalId"); festivalIDStr != "" {
		if festivalID, err := uuid.Parse(festivalIDStr); err == nil {
			filters.FestivalID = festivalID
		}
	}

	// Optional status filter
	if status := c.Query("status"); status != "" {
		ticketStatus := TicketStatus(status)
		filters.Status = &ticketStatus
	}

	tickets, total, err := h.service.ListTicketsByUser(c.Request.Context(), userID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]TicketResponse, len(tickets))
	for i, t := range tickets {
		items[i] = t.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// TicketFilters represents filters for listing tickets
type TicketFilters struct {
	FestivalID   uuid.UUID
	TicketTypeID *uuid.UUID
	UserID       *uuid.UUID
	Status       *TicketStatus
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
