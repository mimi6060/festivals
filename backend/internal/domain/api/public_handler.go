package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/festival"
	"github.com/mimi6060/festivals/backend/internal/domain/lineup"
	"github.com/mimi6060/festivals/backend/internal/domain/ticket"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// PublicHandler handles public API requests (for third-party integrations)
type PublicHandler struct {
	apiService      *Service
	festivalService *festival.Service
	lineupService   *lineup.Service
	ticketService   *ticket.Service
}

// NewPublicHandler creates a new public API handler
func NewPublicHandler(
	apiService *Service,
	festivalService *festival.Service,
	lineupService *lineup.Service,
	ticketService *ticket.Service,
) *PublicHandler {
	return &PublicHandler{
		apiService:      apiService,
		festivalService: festivalService,
		lineupService:   lineupService,
		ticketService:   ticketService,
	}
}

// RegisterPublicRoutes registers the public API routes
// These routes are meant for third-party developers using API keys
func (h *PublicHandler) RegisterPublicRoutes(r *gin.RouterGroup) {
	v1 := r.Group("/v1")
	{
		// Festival info
		v1.GET("/festivals/:id", h.GetFestival)

		// Lineup
		v1.GET("/festivals/:id/lineup", h.GetLineup)
		v1.GET("/festivals/:id/artists", h.ListArtists)
		v1.GET("/festivals/:id/stages", h.ListStages)
		v1.GET("/festivals/:id/schedule", h.GetSchedule)

		// Tickets
		v1.GET("/festivals/:id/tickets", h.ListTicketTypes)
		v1.GET("/festivals/:id/tickets/:ticketTypeId", h.GetTicketType)
		v1.GET("/festivals/:id/tickets/:ticketTypeId/availability", h.CheckTicketAvailability)

		// Webhook receiver (for testing)
		v1.POST("/webhooks/receive", h.ReceiveWebhook)

		// Health check
		v1.GET("/health", h.HealthCheck)
	}
}

// =====================
// Festival Endpoints
// =====================

// GetFestival returns public festival information
// @Summary Get festival info
// @Description Returns public information about a festival
// @Tags public-api
// @Produce json
// @Param id path string true "Festival ID"
// @Security ApiKeyAuth
// @Success 200 {object} PublicFestivalResponse
// @Router /public/v1/festivals/{id} [get]
func (h *PublicHandler) GetFestival(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	// Verify the API key has access to this festival
	if !h.validateFestivalAccess(c, festivalID) {
		return
	}

	fest, err := h.festivalService.GetByID(c.Request.Context(), festivalID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	// Return public-safe response
	response.OK(c, PublicFestivalResponse{
		ID:           fest.ID,
		Name:         fest.Name,
		Slug:         fest.Slug,
		Description:  fest.Description,
		StartDate:    fest.StartDate.Format("2006-01-02"),
		EndDate:      fest.EndDate.Format("2006-01-02"),
		Location:     fest.Location,
		Timezone:     fest.Timezone,
		CurrencyName: fest.CurrencyName,
		Status:       string(fest.Status),
		Settings: PublicFestivalSettings{
			LogoURL:        fest.Settings.LogoURL,
			PrimaryColor:   fest.Settings.PrimaryColor,
			SecondaryColor: fest.Settings.SecondaryColor,
		},
	})
}

// =====================
// Lineup Endpoints
// =====================

// GetLineup returns the complete festival lineup
// @Summary Get festival lineup
// @Description Returns the complete lineup including artists, stages, and schedule
// @Tags public-api
// @Produce json
// @Param id path string true "Festival ID"
// @Security ApiKeyAuth
// @Success 200 {object} lineup.LineupResponse
// @Router /public/v1/festivals/{id}/lineup [get]
func (h *PublicHandler) GetLineup(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	if !h.validateFestivalAccess(c, festivalID) {
		return
	}

	lineupData, err := h.lineupService.GetFullLineup(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, lineupData)
}

// ListArtists returns all artists for a festival
// @Summary List artists
// @Description Returns all artists performing at the festival
// @Tags public-api
// @Produce json
// @Param id path string true "Festival ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(50)
// @Security ApiKeyAuth
// @Success 200 {array} lineup.ArtistResponse
// @Router /public/v1/festivals/{id}/artists [get]
func (h *PublicHandler) ListArtists(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	if !h.validateFestivalAccess(c, festivalID) {
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))

	artists, total, err := h.lineupService.ListArtists(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]lineup.ArtistResponse, len(artists))
	for i, a := range artists {
		items[i] = a.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// ListStages returns all stages for a festival
// @Summary List stages
// @Description Returns all stages at the festival
// @Tags public-api
// @Produce json
// @Param id path string true "Festival ID"
// @Security ApiKeyAuth
// @Success 200 {array} lineup.StageResponse
// @Router /public/v1/festivals/{id}/stages [get]
func (h *PublicHandler) ListStages(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	if !h.validateFestivalAccess(c, festivalID) {
		return
	}

	stages, err := h.lineupService.ListStages(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]lineup.StageResponse, len(stages))
	for i, s := range stages {
		items[i] = s.ToResponse()
	}

	response.OK(c, items)
}

// GetSchedule returns the schedule for a specific day
// @Summary Get day schedule
// @Description Returns the schedule for a specific day
// @Tags public-api
// @Produce json
// @Param id path string true "Festival ID"
// @Param day query string false "Day (format: 2006-01-02)"
// @Security ApiKeyAuth
// @Success 200 {object} lineup.DayScheduleResponse
// @Router /public/v1/festivals/{id}/schedule [get]
func (h *PublicHandler) GetSchedule(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	if !h.validateFestivalAccess(c, festivalID) {
		return
	}

	day := c.Query("day")

	schedule, err := h.lineupService.GetLineupByDay(c.Request.Context(), festivalID, day)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, schedule)
}

// =====================
// Ticket Endpoints
// =====================

// ListTicketTypes returns available ticket types
// @Summary List ticket types
// @Description Returns all available ticket types for the festival
// @Tags public-api
// @Produce json
// @Param id path string true "Festival ID"
// @Param status query string false "Filter by status (ACTIVE, SOLD_OUT)"
// @Security ApiKeyAuth
// @Success 200 {array} PublicTicketTypeResponse
// @Router /public/v1/festivals/{id}/tickets [get]
func (h *PublicHandler) ListTicketTypes(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	if !h.validateFestivalAccess(c, festivalID) {
		return
	}

	ticketTypes, _, err := h.ticketService.ListTicketTypes(c.Request.Context(), festivalID, 1, 100)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Filter by status if provided
	status := c.Query("status")

	items := make([]PublicTicketTypeResponse, 0)
	for _, tt := range ticketTypes {
		// Only return active tickets in public API
		if tt.Status != ticket.TicketTypeStatusActive && status != string(tt.Status) {
			continue
		}
		items = append(items, toPublicTicketType(&tt))
	}

	response.OK(c, items)
}

// GetTicketType returns a specific ticket type
// @Summary Get ticket type
// @Description Returns details for a specific ticket type
// @Tags public-api
// @Produce json
// @Param id path string true "Festival ID"
// @Param ticketTypeId path string true "Ticket Type ID"
// @Security ApiKeyAuth
// @Success 200 {object} PublicTicketTypeResponse
// @Router /public/v1/festivals/{id}/tickets/{ticketTypeId} [get]
func (h *PublicHandler) GetTicketType(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	ticketTypeID, err := uuid.Parse(c.Param("ticketTypeId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket type ID", nil)
		return
	}

	if !h.validateFestivalAccess(c, festivalID) {
		return
	}

	tt, err := h.ticketService.GetTicketType(c.Request.Context(), ticketTypeID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Ticket type not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, toPublicTicketType(tt))
}

// CheckTicketAvailability checks if tickets are available
// @Summary Check ticket availability
// @Description Returns current availability for a ticket type
// @Tags public-api
// @Produce json
// @Param id path string true "Festival ID"
// @Param ticketTypeId path string true "Ticket Type ID"
// @Param quantity query int false "Desired quantity" default(1)
// @Security ApiKeyAuth
// @Success 200 {object} TicketAvailabilityResponse
// @Router /public/v1/festivals/{id}/tickets/{ticketTypeId}/availability [get]
func (h *PublicHandler) CheckTicketAvailability(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	ticketTypeID, err := uuid.Parse(c.Param("ticketTypeId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid ticket type ID", nil)
		return
	}

	if !h.validateFestivalAccess(c, festivalID) {
		return
	}

	quantity, _ := strconv.Atoi(c.DefaultQuery("quantity", "1"))
	if quantity < 1 {
		quantity = 1
	}

	tt, err := h.ticketService.GetTicketType(c.Request.Context(), ticketTypeID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Ticket type not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	available := -1 // Unlimited
	if tt.Quantity != nil {
		available = *tt.Quantity - tt.QuantitySold
	}

	canPurchase := tt.Status == ticket.TicketTypeStatusActive && (available == -1 || available >= quantity)

	response.OK(c, TicketAvailabilityResponse{
		TicketTypeID: tt.ID,
		Name:         tt.Name,
		Available:    available,
		Requested:    quantity,
		CanPurchase:  canPurchase,
		Status:       string(tt.Status),
		Message:      getAvailabilityMessage(available, quantity, tt.Status),
	})
}

// =====================
// Webhook Endpoints
// =====================

// ReceiveWebhook is a test endpoint for receiving webhooks
// @Summary Receive webhook (test endpoint)
// @Description Test endpoint for receiving and echoing webhook payloads
// @Tags public-api
// @Accept json
// @Produce json
// @Param payload body WebhookPayload true "Webhook payload"
// @Success 200 {object} map[string]any
// @Router /public/v1/webhooks/receive [post]
func (h *PublicHandler) ReceiveWebhook(c *gin.Context) {
	var payload WebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Invalid webhook payload", err.Error())
		return
	}

	// Echo back the received payload
	response.OK(c, gin.H{
		"received":  true,
		"id":        payload.ID,
		"event":     payload.Event,
		"timestamp": payload.Timestamp,
		"signature": c.GetHeader("X-Webhook-Signature"),
	})
}

// HealthCheck returns API health status
// @Summary API health check
// @Description Returns the health status of the public API
// @Tags public-api
// @Produce json
// @Success 200 {object} map[string]any
// @Router /public/v1/health [get]
func (h *PublicHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"version": "1.0.0",
	})
}

// =====================
// Helper Functions
// =====================

// validateFestivalAccess checks if the API key has access to the festival
func (h *PublicHandler) validateFestivalAccess(c *gin.Context, festivalID uuid.UUID) bool {
	keyFestivalID := c.GetString("api_festival_id")
	if keyFestivalID == "" {
		response.Unauthorized(c, "API key authentication required")
		return false
	}

	if keyFestivalID != festivalID.String() {
		response.Forbidden(c, "Your API key does not have access to this festival")
		return false
	}

	return true
}

// toPublicTicketType converts a ticket type to a public response
func toPublicTicketType(tt *ticket.TicketType) PublicTicketTypeResponse {
	available := -1
	if tt.Quantity != nil {
		available = *tt.Quantity - tt.QuantitySold
	}

	return PublicTicketTypeResponse{
		ID:           tt.ID,
		Name:         tt.Name,
		Description:  tt.Description,
		Price:        tt.Price,
		PriceDisplay: formatPrice(tt.Price),
		Available:    available,
		ValidFrom:    tt.ValidFrom.Format("2006-01-02T15:04:05Z07:00"),
		ValidUntil:   tt.ValidUntil.Format("2006-01-02T15:04:05Z07:00"),
		Benefits:     tt.Benefits,
		Status:       string(tt.Status),
	}
}

// formatPrice formats cents to a display string
func formatPrice(cents int64) string {
	euros := float64(cents) / 100
	return formatFloat(euros) + " EUR"
}

func formatFloat(f float64) string {
	return strconv.FormatFloat(f, 'f', 2, 64)
}

// getAvailabilityMessage returns a user-friendly availability message
func getAvailabilityMessage(available, requested int, status ticket.TicketTypeStatus) string {
	if status == ticket.TicketTypeStatusSoldOut {
		return "This ticket type is sold out."
	}
	if status != ticket.TicketTypeStatusActive {
		return "This ticket type is not available for purchase."
	}
	if available == -1 {
		return "Tickets are available."
	}
	if available < requested {
		return "Not enough tickets available. Only " + strconv.Itoa(available) + " remaining."
	}
	return "Tickets are available."
}

// =====================
// Public Response Types
// =====================

// PublicFestivalResponse is the public API response for a festival
type PublicFestivalResponse struct {
	ID           uuid.UUID              `json:"id"`
	Name         string                 `json:"name"`
	Slug         string                 `json:"slug"`
	Description  string                 `json:"description"`
	StartDate    string                 `json:"startDate"`
	EndDate      string                 `json:"endDate"`
	Location     string                 `json:"location"`
	Timezone     string                 `json:"timezone"`
	CurrencyName string                 `json:"currencyName"`
	Status       string                 `json:"status"`
	Settings     PublicFestivalSettings `json:"settings"`
}

// PublicFestivalSettings contains public-safe festival settings
type PublicFestivalSettings struct {
	LogoURL        string `json:"logoUrl,omitempty"`
	PrimaryColor   string `json:"primaryColor,omitempty"`
	SecondaryColor string `json:"secondaryColor,omitempty"`
}

// PublicTicketTypeResponse is the public API response for a ticket type
type PublicTicketTypeResponse struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	Price        int64     `json:"price"`
	PriceDisplay string    `json:"priceDisplay"`
	Available    int       `json:"available"` // -1 for unlimited
	ValidFrom    string    `json:"validFrom"`
	ValidUntil   string    `json:"validUntil"`
	Benefits     []string  `json:"benefits"`
	Status       string    `json:"status"`
}

// TicketAvailabilityResponse is the response for ticket availability check
type TicketAvailabilityResponse struct {
	TicketTypeID uuid.UUID `json:"ticketTypeId"`
	Name         string    `json:"name"`
	Available    int       `json:"available"` // -1 for unlimited
	Requested    int       `json:"requested"`
	CanPurchase  bool      `json:"canPurchase"`
	Status       string    `json:"status"`
	Message      string    `json:"message"`
}
