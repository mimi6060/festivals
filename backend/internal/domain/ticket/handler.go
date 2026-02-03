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
	service   *Service
	qrService *QRService
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// NewHandlerWithQR creates a new ticket handler with QR code support
func NewHandlerWithQR(service *Service, qrService *QRService) *Handler {
	return &Handler{
		service:   service,
		qrService: qrService,
	}
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
		tickets.GET("/:id/qr", h.GetTicketQRCode)
		tickets.GET("/:id/qr/download", h.DownloadTicketQRCode)
		tickets.POST("/:id/qr/regenerate", h.RegenerateTicketQRCode)
		tickets.GET("/code/:code", h.GetTicketByCode)
		tickets.POST("/scan", h.ScanTicket)
		tickets.POST("/:id/transfer", h.TransferTicket)
	}

	// User ticket routes
	r.GET("/me/tickets", h.GetMyTickets)
}

// CreateTicketType creates a new ticket type
// @Summary Create a new ticket type
// @Description Create a new ticket type for a festival with pricing, quantity, and validity settings
// @Tags ticket-types
// @Accept json
// @Produce json
// @Param request body CreateTicketTypeRequest true "Ticket type data"
// @Success 201 {object} response.Response{data=TicketTypeResponse} "Ticket type created"
// @Failure 400 {object} response.ErrorResponse "Invalid request body"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
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
// @Description Get paginated list of ticket types for a festival
// @Tags ticket-types
// @Produce json
// @Param festivalId query string true "Festival ID" format(uuid)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} response.Response{data=[]TicketTypeResponse,meta=response.Meta} "Ticket type list"
// @Failure 400 {object} response.ErrorResponse "Invalid festival ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
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
// @Description Get detailed information about a specific ticket type
// @Tags ticket-types
// @Produce json
// @Param id path string true "Ticket Type ID" format(uuid)
// @Success 200 {object} response.Response{data=TicketTypeResponse} "Ticket type details"
// @Failure 400 {object} response.ErrorResponse "Invalid ticket type ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Ticket type not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
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
// @Description Update an existing ticket type with partial data
// @Tags ticket-types
// @Accept json
// @Produce json
// @Param id path string true "Ticket Type ID" format(uuid)
// @Param request body UpdateTicketTypeRequest true "Update data"
// @Success 200 {object} response.Response{data=TicketTypeResponse} "Updated ticket type"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Ticket type not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
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
// @Description Permanently delete a ticket type. Cannot delete if tickets have been sold.
// @Tags ticket-types
// @Param id path string true "Ticket Type ID" format(uuid)
// @Success 204 "Ticket type deleted"
// @Failure 400 {object} response.ErrorResponse "Cannot delete with existing tickets"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Ticket type not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
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
// @Description Create an individual ticket of a specific type
// @Tags tickets
// @Accept json
// @Produce json
// @Param request body CreateTicketRequest true "Ticket data"
// @Success 201 {object} response.Response{data=TicketResponse} "Ticket created"
// @Failure 400 {object} response.ErrorResponse "Invalid request or sold out"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Ticket type not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
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

// GetTicketQRCode returns the QR code for a ticket
// @Summary Get ticket QR code
// @Description Get the QR code for a specific ticket as JSON with base64 encoded image
// @Tags tickets
// @Produce json
// @Param id path string true "Ticket ID" format(uuid)
// @Success 200 {object} response.Response{data=QRCodeResponse} "QR code data"
// @Failure 400 {object} response.ErrorResponse "Invalid ticket ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Ticket not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /tickets/{id}/qr [get]
func (h *Handler) GetTicketQRCode(c *gin.Context) {
	if h.qrService == nil {
		response.InternalError(c, "QR code service not configured")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket ID", nil)
		return
	}

	// Verify user has access to this ticket
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	// Get ticket to verify ownership
	ticket, err := h.service.GetTicket(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound || err == errors.ErrTicketNotFound {
			response.NotFound(c, "Ticket not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	// Check ownership (unless user is admin/staff)
	if ticket.UserID == nil || *ticket.UserID != userID {
		// TODO: Add admin/staff check here
		response.Forbidden(c, "You do not own this ticket")
		return
	}

	// Generate QR code
	qrResult, err := h.qrService.GenerateQRCode(c.Request.Context(), id)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, QRCodeResponse{
		TicketID:    qrResult.TicketID,
		TicketCode:  qrResult.TicketCode,
		FestivalID:  qrResult.FestivalID,
		QRImageB64:  qrResult.QRImageB64,
		QRDataURI:   "data:image/png;base64," + qrResult.QRImageB64,
		ExpiresAt:   qrResult.ExpiresAt.Format(time.RFC3339),
		GeneratedAt: qrResult.GeneratedAt.Format(time.RFC3339),
	})
}

// DownloadTicketQRCode returns the QR code as a downloadable PNG image
// @Summary Download ticket QR code
// @Description Download the QR code for a specific ticket as a PNG image file
// @Tags tickets
// @Produce png
// @Param id path string true "Ticket ID" format(uuid)
// @Success 200 {file} binary "PNG image"
// @Failure 400 {object} response.ErrorResponse "Invalid ticket ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Ticket not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /tickets/{id}/qr/download [get]
func (h *Handler) DownloadTicketQRCode(c *gin.Context) {
	if h.qrService == nil {
		response.InternalError(c, "QR code service not configured")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket ID", nil)
		return
	}

	// Verify user has access to this ticket
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	// Get ticket to verify ownership
	ticket, err := h.service.GetTicket(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound || err == errors.ErrTicketNotFound {
			response.NotFound(c, "Ticket not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	// Check ownership
	if ticket.UserID == nil || *ticket.UserID != userID {
		response.Forbidden(c, "You do not own this ticket")
		return
	}

	// Generate QR code
	qrPNG, filename, err := h.qrService.GetQRCodeAsPNG(c.Request.Context(), id)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Set headers for file download
	c.Header("Content-Type", "image/png")
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Header("Content-Length", strconv.Itoa(len(qrPNG)))

	c.Data(http.StatusOK, "image/png", qrPNG)
}

// RegenerateTicketQRCode regenerates a new QR code for a ticket
// @Summary Regenerate ticket QR code
// @Description Regenerate a new QR code for a ticket with a fresh timestamp
// @Tags tickets
// @Produce json
// @Param id path string true "Ticket ID" format(uuid)
// @Success 200 {object} response.Response{data=QRCodeResponse} "New QR code data"
// @Failure 400 {object} response.ErrorResponse "Invalid ticket ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Ticket not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /tickets/{id}/qr/regenerate [post]
func (h *Handler) RegenerateTicketQRCode(c *gin.Context) {
	if h.qrService == nil {
		response.InternalError(c, "QR code service not configured")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket ID", nil)
		return
	}

	// Verify user has access to this ticket
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	// Get ticket to verify ownership
	ticket, err := h.service.GetTicket(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound || err == errors.ErrTicketNotFound {
			response.NotFound(c, "Ticket not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	// Check ownership
	if ticket.UserID == nil || *ticket.UserID != userID {
		response.Forbidden(c, "You do not own this ticket")
		return
	}

	// Regenerate QR code
	qrResult, err := h.qrService.RegenerateQRCode(c.Request.Context(), id)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, QRCodeResponse{
		TicketID:    qrResult.TicketID,
		TicketCode:  qrResult.TicketCode,
		FestivalID:  qrResult.FestivalID,
		QRImageB64:  qrResult.QRImageB64,
		QRDataURI:   "data:image/png;base64," + qrResult.QRImageB64,
		ExpiresAt:   qrResult.ExpiresAt.Format(time.RFC3339),
		GeneratedAt: qrResult.GeneratedAt.Format(time.RFC3339),
	})
}

// QRCodeResponse represents the API response for a QR code
type QRCodeResponse struct {
	TicketID    uuid.UUID `json:"ticketId"`
	TicketCode  string    `json:"ticketCode"`
	FestivalID  uuid.UUID `json:"festivalId"`
	QRImageB64  string    `json:"qrImageB64"`
	QRDataURI   string    `json:"qrDataUri"`
	ExpiresAt   string    `json:"expiresAt"`
	GeneratedAt string    `json:"generatedAt"`
}

// ScanTicket validates and scans a ticket (for entry/exit)
// @Summary Scan/validate ticket
// @Description Scan a ticket for entry or exit validation. Returns scan result with success status.
// @Tags tickets
// @Accept json
// @Produce json
// @Param request body ScanTicketRequest true "Scan data"
// @Success 200 {object} response.Response{data=ScanResponse} "Scan result"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Staff authentication required"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
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
// @Description Transfer a ticket to another person. Subject to ticket type transfer rules.
// @Tags tickets
// @Accept json
// @Produce json
// @Param id path string true "Ticket ID" format(uuid)
// @Param request body TransferTicketRequest true "Transfer data"
// @Success 200 {object} response.Response{data=TicketResponse} "Transferred ticket"
// @Failure 400 {object} response.ErrorResponse "Transfer not allowed or max transfers exceeded"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "You do not own this ticket"
// @Failure 404 {object} response.ErrorResponse "Ticket not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
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
// @Description Get paginated list of tickets belonging to the authenticated user
// @Tags tickets
// @Produce json
// @Param festivalId query string false "Filter by festival ID" format(uuid)
// @Param status query string false "Filter by status" Enums(VALID, USED, EXPIRED, CANCELLED, TRANSFERRED)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} response.Response{data=[]TicketResponse,meta=response.Meta} "User's tickets"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
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
