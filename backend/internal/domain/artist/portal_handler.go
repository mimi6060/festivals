package artist

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// Handler handles HTTP requests for artist portal
type Handler struct {
	service *Service
}

// NewHandler creates a new artist portal handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers all artist portal routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Artist portal routes (authenticated artist)
	portal := r.Group("/artists/portal")
	{
		// Profile management
		portal.GET("/profile", h.GetMyProfile)
		portal.POST("/profile", h.CreateProfile)
		portal.PATCH("/profile", h.UpdateMyProfile)

		// Tech riders
		portal.GET("/riders", h.ListMyTechRiders)
		portal.POST("/riders", h.CreateTechRider)
		portal.GET("/riders/:riderId", h.GetTechRider)
		portal.PATCH("/riders/:riderId", h.UpdateTechRider)
		portal.DELETE("/riders/:riderId", h.DeleteTechRider)

		// Availability
		portal.GET("/availability", h.ListMyAvailability)
		portal.POST("/availability", h.AddAvailability)
		portal.PATCH("/availability/:availabilityId", h.UpdateAvailability)
		portal.DELETE("/availability/:availabilityId", h.DeleteAvailability)

		// Invitations
		portal.GET("/invitations", h.GetMyInvitations)
		portal.GET("/invitations/:invitationId", h.GetInvitation)
		portal.POST("/invitations/:invitationId/respond", h.RespondToInvitation)

		// Performances
		portal.GET("/performances", h.GetMyUpcomingPerformances)

		// Documents
		portal.GET("/documents", h.ListMyDocuments)
		portal.POST("/documents", h.AddDocument)
		portal.DELETE("/documents/:documentId", h.DeleteDocument)
	}

	// Public artist profiles (read-only)
	artists := r.Group("/artists")
	{
		artists.GET("", h.ListArtistProfiles)
		artists.GET("/search", h.SearchArtistProfiles)
		artists.GET("/:artistId/profile", h.GetArtistProfile)
		artists.GET("/:artistId/riders", h.GetArtistTechRiders)
		artists.GET("/:artistId/riders/:riderId", h.GetArtistTechRider)
	}
}

// RegisterFestivalRoutes registers routes for festival organizers to manage invitations
func (h *Handler) RegisterFestivalRoutes(r *gin.RouterGroup) {
	invitations := r.Group("/invitations")
	{
		invitations.GET("", h.ListFestivalInvitations)
		invitations.POST("", h.CreateInvitation)
		invitations.GET("/:invitationId", h.GetFestivalInvitation)
		invitations.POST("/:invitationId/cancel", h.CancelInvitation)
		invitations.POST("/:invitationId/contract", h.UpdateInvitationContract)
	}
}

// =====================
// Profile handlers
// =====================

// GetMyProfile gets the authenticated artist's profile
// @Summary Get my artist profile
// @Tags artist-portal
// @Produce json
// @Success 200 {object} ArtistProfileResponse
// @Router /artists/portal/profile [get]
func (h *Handler) GetMyProfile(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User authentication required")
		return
	}

	profile, err := h.service.GetMyProfile(c.Request.Context(), userID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist profile not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, profile.ToResponse())
}

// CreateProfile creates a new artist profile
// @Summary Create artist profile
// @Tags artist-portal
// @Accept json
// @Produce json
// @Param request body CreateArtistProfileRequest true "Profile data"
// @Success 201 {object} ArtistProfileResponse
// @Router /artists/portal/profile [post]
func (h *Handler) CreateProfile(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User authentication required")
		return
	}

	var req CreateArtistProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	profile, err := h.service.CreateProfile(c.Request.Context(), userID, req)
	if err != nil {
		if err.Error() == "profile already exists for this user" {
			response.Conflict(c, "PROFILE_EXISTS", err.Error())
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, profile.ToResponse())
}

// UpdateMyProfile updates the authenticated artist's profile
// @Summary Update my artist profile
// @Tags artist-portal
// @Accept json
// @Produce json
// @Param request body UpdateArtistProfileRequest true "Update data"
// @Success 200 {object} ArtistProfileResponse
// @Router /artists/portal/profile [patch]
func (h *Handler) UpdateMyProfile(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User authentication required")
		return
	}

	profile, err := h.service.GetMyProfile(c.Request.Context(), userID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist profile not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	var req UpdateArtistProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	updated, err := h.service.UpdateProfile(c.Request.Context(), profile.ID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, updated.ToResponse())
}

// GetArtistProfile gets a public artist profile
// @Summary Get artist profile
// @Tags artists
// @Produce json
// @Param artistId path string true "Artist ID"
// @Success 200 {object} ArtistProfileResponse
// @Router /artists/{artistId}/profile [get]
func (h *Handler) GetArtistProfile(c *gin.Context) {
	artistID, err := uuid.Parse(c.Param("artistId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid artist ID", nil)
		return
	}

	profile, err := h.service.GetArtistProfile(c.Request.Context(), artistID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist profile not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	// Only return public profiles
	if !profile.IsPublic {
		response.NotFound(c, "Artist profile not found")
		return
	}

	response.OK(c, profile.ToResponse())
}

// ListArtistProfiles lists public artist profiles
// @Summary List artist profiles
// @Tags artists
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} ArtistProfileResponse
// @Router /artists [get]
func (h *Handler) ListArtistProfiles(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	profiles, total, err := h.service.ListArtistProfiles(c.Request.Context(), page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]ArtistProfileResponse, len(profiles))
	for i, p := range profiles {
		items[i] = p.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// SearchArtistProfiles searches for artist profiles
// @Summary Search artist profiles
// @Tags artists
// @Produce json
// @Param q query string false "Search query"
// @Param genre query string false "Genre filter"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} ArtistProfileResponse
// @Router /artists/search [get]
func (h *Handler) SearchArtistProfiles(c *gin.Context) {
	query := c.Query("q")
	genre := c.Query("genre")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	profiles, total, err := h.service.SearchArtistProfiles(c.Request.Context(), query, genre, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]ArtistProfileResponse, len(profiles))
	for i, p := range profiles {
		items[i] = p.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// =====================
// Tech Rider handlers
// =====================

// CreateTechRider creates a new tech rider
// @Summary Create tech rider
// @Tags artist-portal
// @Accept json
// @Produce json
// @Param request body CreateTechRiderRequest true "Tech rider data"
// @Success 201 {object} TechRiderResponse
// @Router /artists/portal/riders [post]
func (h *Handler) CreateTechRider(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User authentication required")
		return
	}

	profile, err := h.service.GetMyProfile(c.Request.Context(), userID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist profile not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	var req CreateTechRiderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	rider, err := h.service.SubmitTechRider(c.Request.Context(), profile.ID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, rider.ToResponse())
}

// ListMyTechRiders lists the artist's tech riders
// @Summary List my tech riders
// @Tags artist-portal
// @Produce json
// @Success 200 {array} TechRiderResponse
// @Router /artists/portal/riders [get]
func (h *Handler) ListMyTechRiders(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User authentication required")
		return
	}

	profile, err := h.service.GetMyProfile(c.Request.Context(), userID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist profile not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	riders, err := h.service.ListTechRiders(c.Request.Context(), profile.ID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]TechRiderResponse, len(riders))
	for i, r := range riders {
		items[i] = r.ToResponse()
	}

	response.OK(c, items)
}

// GetTechRider gets a tech rider by ID
// @Summary Get tech rider
// @Tags artist-portal
// @Produce json
// @Param riderId path string true "Rider ID"
// @Success 200 {object} TechRiderResponse
// @Router /artists/portal/riders/{riderId} [get]
func (h *Handler) GetTechRider(c *gin.Context) {
	riderID, err := uuid.Parse(c.Param("riderId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid rider ID", nil)
		return
	}

	rider, err := h.service.GetTechRider(c.Request.Context(), riderID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Tech rider not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, rider.ToResponse())
}

// UpdateTechRider updates a tech rider
// @Summary Update tech rider
// @Tags artist-portal
// @Accept json
// @Produce json
// @Param riderId path string true "Rider ID"
// @Param request body UpdateTechRiderRequest true "Update data"
// @Success 200 {object} TechRiderResponse
// @Router /artists/portal/riders/{riderId} [patch]
func (h *Handler) UpdateTechRider(c *gin.Context) {
	riderID, err := uuid.Parse(c.Param("riderId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid rider ID", nil)
		return
	}

	var req UpdateTechRiderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	rider, err := h.service.UpdateTechRider(c.Request.Context(), riderID, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Tech rider not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, rider.ToResponse())
}

// DeleteTechRider deletes a tech rider
// @Summary Delete tech rider
// @Tags artist-portal
// @Param riderId path string true "Rider ID"
// @Success 204
// @Router /artists/portal/riders/{riderId} [delete]
func (h *Handler) DeleteTechRider(c *gin.Context) {
	riderID, err := uuid.Parse(c.Param("riderId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid rider ID", nil)
		return
	}

	if err := h.service.DeleteTechRider(c.Request.Context(), riderID); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Tech rider not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// GetArtistTechRiders gets public tech riders for an artist
// @Summary Get artist's tech riders
// @Tags artists
// @Produce json
// @Param artistId path string true "Artist ID"
// @Success 200 {array} TechRiderResponse
// @Router /artists/{artistId}/riders [get]
func (h *Handler) GetArtistTechRiders(c *gin.Context) {
	artistID, err := uuid.Parse(c.Param("artistId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid artist ID", nil)
		return
	}

	riders, err := h.service.ListTechRiders(c.Request.Context(), artistID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]TechRiderResponse, len(riders))
	for i, r := range riders {
		items[i] = r.ToResponse()
	}

	response.OK(c, items)
}

// GetArtistTechRider gets a specific tech rider for an artist
// @Summary Get artist's tech rider
// @Tags artists
// @Produce json
// @Param artistId path string true "Artist ID"
// @Param riderId path string true "Rider ID"
// @Success 200 {object} TechRiderResponse
// @Router /artists/{artistId}/riders/{riderId} [get]
func (h *Handler) GetArtistTechRider(c *gin.Context) {
	riderID, err := uuid.Parse(c.Param("riderId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid rider ID", nil)
		return
	}

	rider, err := h.service.GetTechRider(c.Request.Context(), riderID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Tech rider not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, rider.ToResponse())
}

// =====================
// Availability handlers
// =====================

// ListMyAvailability lists the artist's availability
// @Summary List my availability
// @Tags artist-portal
// @Produce json
// @Success 200 {array} AvailabilityResponse
// @Router /artists/portal/availability [get]
func (h *Handler) ListMyAvailability(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User authentication required")
		return
	}

	profile, err := h.service.GetMyProfile(c.Request.Context(), userID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist profile not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	availabilities, err := h.service.ListAvailabilities(c.Request.Context(), profile.ID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]AvailabilityResponse, len(availabilities))
	for i, a := range availabilities {
		items[i] = a.ToResponse()
	}

	response.OK(c, items)
}

// AddAvailability adds availability
// @Summary Add availability
// @Tags artist-portal
// @Accept json
// @Produce json
// @Param request body CreateAvailabilityRequest true "Availability data"
// @Success 201 {object} AvailabilityResponse
// @Router /artists/portal/availability [post]
func (h *Handler) AddAvailability(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User authentication required")
		return
	}

	profile, err := h.service.GetMyProfile(c.Request.Context(), userID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist profile not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	var req CreateAvailabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	availability, err := h.service.AddAvailability(c.Request.Context(), profile.ID, req)
	if err != nil {
		if err.Error() == "end date must be after start date" {
			response.BadRequest(c, "INVALID_DATE_RANGE", err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, availability.ToResponse())
}

// UpdateAvailability updates availability
// @Summary Update availability
// @Tags artist-portal
// @Accept json
// @Produce json
// @Param availabilityId path string true "Availability ID"
// @Param request body object{status=AvailabilityStatus,notes=string} true "Update data"
// @Success 200 {object} AvailabilityResponse
// @Router /artists/portal/availability/{availabilityId} [patch]
func (h *Handler) UpdateAvailability(c *gin.Context) {
	availabilityID, err := uuid.Parse(c.Param("availabilityId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid availability ID", nil)
		return
	}

	var req struct {
		Status AvailabilityStatus `json:"status"`
		Notes  string             `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	availability, err := h.service.UpdateAvailability(c.Request.Context(), availabilityID, req.Status, req.Notes)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Availability not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, availability.ToResponse())
}

// DeleteAvailability deletes availability
// @Summary Delete availability
// @Tags artist-portal
// @Param availabilityId path string true "Availability ID"
// @Success 204
// @Router /artists/portal/availability/{availabilityId} [delete]
func (h *Handler) DeleteAvailability(c *gin.Context) {
	availabilityID, err := uuid.Parse(c.Param("availabilityId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid availability ID", nil)
		return
	}

	if err := h.service.DeleteAvailability(c.Request.Context(), availabilityID); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Availability not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// =====================
// Invitation handlers (Artist)
// =====================

// GetMyInvitations gets the artist's invitations
// @Summary Get my invitations
// @Tags artist-portal
// @Produce json
// @Param status query string false "Filter by status"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} InvitationResponse
// @Router /artists/portal/invitations [get]
func (h *Handler) GetMyInvitations(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User authentication required")
		return
	}

	profile, err := h.service.GetMyProfile(c.Request.Context(), userID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist profile not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	var status *InvitationStatus
	if statusStr := c.Query("status"); statusStr != "" {
		s := InvitationStatus(statusStr)
		status = &s
	}

	invitations, total, err := h.service.GetInvitations(c.Request.Context(), profile.ID, status, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]InvitationResponse, len(invitations))
	for i, inv := range invitations {
		items[i] = inv.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetInvitation gets a specific invitation
// @Summary Get invitation
// @Tags artist-portal
// @Produce json
// @Param invitationId path string true "Invitation ID"
// @Success 200 {object} InvitationResponse
// @Router /artists/portal/invitations/{invitationId} [get]
func (h *Handler) GetInvitation(c *gin.Context) {
	invitationID, err := uuid.Parse(c.Param("invitationId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid invitation ID", nil)
		return
	}

	invitation, err := h.service.GetInvitation(c.Request.Context(), invitationID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Invitation not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, invitation.ToResponse())
}

// RespondToInvitation responds to an invitation
// @Summary Respond to invitation
// @Tags artist-portal
// @Accept json
// @Produce json
// @Param invitationId path string true "Invitation ID"
// @Param request body RespondToInvitationRequest true "Response data"
// @Success 200 {object} InvitationResponse
// @Router /artists/portal/invitations/{invitationId}/respond [post]
func (h *Handler) RespondToInvitation(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User authentication required")
		return
	}

	profile, err := h.service.GetMyProfile(c.Request.Context(), userID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist profile not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	invitationID, err := uuid.Parse(c.Param("invitationId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid invitation ID", nil)
		return
	}

	var req RespondToInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	invitation, err := h.service.RespondToInvitation(c.Request.Context(), profile.ID, invitationID, req.Accept, req.Response, req.CounterFee)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Invitation not found")
			return
		}
		if err == errors.ErrForbidden {
			response.Forbidden(c, "Not authorized to respond to this invitation")
			return
		}
		if err.Error() == "invitation has expired" {
			response.BadRequest(c, "INVITATION_EXPIRED", err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, invitation.ToResponse())
}

// =====================
// Performance handlers
// =====================

// GetMyUpcomingPerformances gets upcoming performances
// @Summary Get my upcoming performances
// @Tags artist-portal
// @Produce json
// @Success 200 {array} UpcomingPerformanceResponse
// @Router /artists/portal/performances [get]
func (h *Handler) GetMyUpcomingPerformances(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User authentication required")
		return
	}

	profile, err := h.service.GetMyProfile(c.Request.Context(), userID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist profile not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	performances, err := h.service.GetUpcomingPerformances(c.Request.Context(), profile.ID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, performances)
}

// =====================
// Document handlers
// =====================

// ListMyDocuments lists the artist's documents
// @Summary List my documents
// @Tags artist-portal
// @Produce json
// @Param type query string false "Filter by document type"
// @Success 200 {array} ArtistDocument
// @Router /artists/portal/documents [get]
func (h *Handler) ListMyDocuments(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User authentication required")
		return
	}

	profile, err := h.service.GetMyProfile(c.Request.Context(), userID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist profile not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	var docType *DocumentType
	if typeStr := c.Query("type"); typeStr != "" {
		t := DocumentType(typeStr)
		docType = &t
	}

	documents, err := h.service.ListDocuments(c.Request.Context(), profile.ID, docType)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, documents)
}

// AddDocument adds a document
// @Summary Add document
// @Tags artist-portal
// @Accept json
// @Produce json
// @Param request body object{type=DocumentType,name=string,url=string,mimeType=string,size=int64,isPublic=bool} true "Document data"
// @Success 201 {object} ArtistDocument
// @Router /artists/portal/documents [post]
func (h *Handler) AddDocument(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User authentication required")
		return
	}

	profile, err := h.service.GetMyProfile(c.Request.Context(), userID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Artist profile not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	var req struct {
		Type     DocumentType `json:"type" binding:"required"`
		Name     string       `json:"name" binding:"required"`
		URL      string       `json:"url" binding:"required"`
		MimeType string       `json:"mimeType"`
		Size     int64        `json:"size"`
		IsPublic bool         `json:"isPublic"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	document, err := h.service.AddDocument(c.Request.Context(), profile.ID, req.Type, req.Name, req.URL, req.MimeType, req.Size, req.IsPublic)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, document)
}

// DeleteDocument deletes a document
// @Summary Delete document
// @Tags artist-portal
// @Param documentId path string true "Document ID"
// @Success 204
// @Router /artists/portal/documents/{documentId} [delete]
func (h *Handler) DeleteDocument(c *gin.Context) {
	documentID, err := uuid.Parse(c.Param("documentId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid document ID", nil)
		return
	}

	if err := h.service.DeleteDocument(c.Request.Context(), documentID); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Document not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// =====================
// Festival invitation handlers
// =====================

// ListFestivalInvitations lists invitations sent by the festival
// @Summary List festival invitations
// @Tags festival-invitations
// @Produce json
// @Param status query string false "Filter by status"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} InvitationResponse
// @Router /festivals/{festivalId}/invitations [get]
func (h *Handler) ListFestivalInvitations(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	var status *InvitationStatus
	if statusStr := c.Query("status"); statusStr != "" {
		s := InvitationStatus(statusStr)
		status = &s
	}

	invitations, total, err := h.service.GetInvitationsByFestival(c.Request.Context(), festivalID, status, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]InvitationResponse, len(invitations))
	for i, inv := range invitations {
		items[i] = inv.ToResponse()
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// CreateInvitation creates a new invitation
// @Summary Create invitation
// @Tags festival-invitations
// @Accept json
// @Produce json
// @Param request body CreateInvitationRequest true "Invitation data"
// @Success 201 {object} InvitationResponse
// @Router /festivals/{festivalId}/invitations [post]
func (h *Handler) CreateInvitation(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User authentication required")
		return
	}

	var req CreateInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	invitation, err := h.service.CreateInvitation(c.Request.Context(), festivalID, userID, req)
	if err != nil {
		if err.Error() == "artist profile not found" {
			response.BadRequest(c, "ARTIST_NOT_FOUND", err.Error(), nil)
			return
		}
		if err.Error() == "an active invitation already exists for this artist" {
			response.Conflict(c, "INVITATION_EXISTS", err.Error())
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, invitation.ToResponse())
}

// GetFestivalInvitation gets an invitation by ID
// @Summary Get festival invitation
// @Tags festival-invitations
// @Produce json
// @Param invitationId path string true "Invitation ID"
// @Success 200 {object} InvitationResponse
// @Router /festivals/{festivalId}/invitations/{invitationId} [get]
func (h *Handler) GetFestivalInvitation(c *gin.Context) {
	invitationID, err := uuid.Parse(c.Param("invitationId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid invitation ID", nil)
		return
	}

	invitation, err := h.service.GetInvitation(c.Request.Context(), invitationID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Invitation not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, invitation.ToResponse())
}

// CancelInvitation cancels an invitation
// @Summary Cancel invitation
// @Tags festival-invitations
// @Param invitationId path string true "Invitation ID"
// @Success 204
// @Router /festivals/{festivalId}/invitations/{invitationId}/cancel [post]
func (h *Handler) CancelInvitation(c *gin.Context) {
	invitationID, err := uuid.Parse(c.Param("invitationId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid invitation ID", nil)
		return
	}

	if err := h.service.CancelInvitation(c.Request.Context(), invitationID); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Invitation not found")
			return
		}
		if err.Error() == "cannot cancel an accepted invitation" {
			response.BadRequest(c, "CANNOT_CANCEL", err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// UpdateInvitationContract updates contract status
// @Summary Update invitation contract
// @Tags festival-invitations
// @Accept json
// @Produce json
// @Param invitationId path string true "Invitation ID"
// @Param request body object{contractUrl=string,status=ContractStatus} true "Contract data"
// @Success 200 {object} InvitationResponse
// @Router /festivals/{festivalId}/invitations/{invitationId}/contract [post]
func (h *Handler) UpdateInvitationContract(c *gin.Context) {
	invitationID, err := uuid.Parse(c.Param("invitationId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid invitation ID", nil)
		return
	}

	var req struct {
		ContractURL string         `json:"contractUrl"`
		Status      ContractStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	invitation, err := h.service.UpdateInvitationContract(c.Request.Context(), invitationID, req.ContractURL, req.Status)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Invitation not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, invitation.ToResponse())
}

// =====================
// Helper functions
// =====================

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
		festivalIDStr = c.Param("festivalId")
	}
	if festivalIDStr == "" {
		return uuid.Nil, errors.ErrBadRequest
	}
	return uuid.Parse(festivalIDStr)
}
