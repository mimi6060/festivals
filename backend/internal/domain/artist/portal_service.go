package artist

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

// Service provides artist portal business logic
type Service struct {
	repo Repository
}

// NewService creates a new artist portal service
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// =====================
// Profile management
// =====================

// CreateProfile creates a new artist profile
func (s *Service) CreateProfile(ctx context.Context, userID uuid.UUID, req CreateArtistProfileRequest) (*ArtistProfile, error) {
	// Check if profile already exists for this user
	existing, err := s.repo.GetProfileByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("profile already exists for this user")
	}

	profile := &ArtistProfile{
		ID:              uuid.New(),
		UserID:          userID,
		Name:            req.Name,
		StageName:       req.StageName,
		Bio:             req.Bio,
		ShortBio:        req.ShortBio,
		Genre:           req.Genre,
		SubGenres:       req.SubGenres,
		Country:         req.Country,
		City:            req.City,
		ProfileImageURL: req.ProfileImageURL,
		CoverImageURL:   req.CoverImageURL,
		IsPublic:        true,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if req.SocialLinks != nil {
		profile.SocialLinks = *req.SocialLinks
	}
	if req.ContactInfo != nil {
		profile.ContactInfo = *req.ContactInfo
	}
	if req.MusicLinks != nil {
		profile.MusicLinks = *req.MusicLinks
	}

	if err := s.repo.CreateProfile(ctx, profile); err != nil {
		return nil, fmt.Errorf("failed to create profile: %w", err)
	}

	return profile, nil
}

// GetArtistProfile gets an artist profile by ID
func (s *Service) GetArtistProfile(ctx context.Context, artistID uuid.UUID) (*ArtistProfile, error) {
	profile, err := s.repo.GetProfileByID(ctx, artistID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, errors.ErrNotFound
	}
	return profile, nil
}

// GetMyProfile gets the artist profile for the current user
func (s *Service) GetMyProfile(ctx context.Context, userID uuid.UUID) (*ArtistProfile, error) {
	profile, err := s.repo.GetProfileByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, errors.ErrNotFound
	}
	return profile, nil
}

// UpdateProfile updates an artist profile
func (s *Service) UpdateProfile(ctx context.Context, artistID uuid.UUID, req UpdateArtistProfileRequest) (*ArtistProfile, error) {
	profile, err := s.repo.GetProfileByID(ctx, artistID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.Name != nil {
		profile.Name = *req.Name
	}
	if req.StageName != nil {
		profile.StageName = *req.StageName
	}
	if req.Bio != nil {
		profile.Bio = *req.Bio
	}
	if req.ShortBio != nil {
		profile.ShortBio = *req.ShortBio
	}
	if req.Genre != nil {
		profile.Genre = *req.Genre
	}
	if len(req.SubGenres) > 0 {
		profile.SubGenres = req.SubGenres
	}
	if req.Country != nil {
		profile.Country = *req.Country
	}
	if req.City != nil {
		profile.City = *req.City
	}
	if req.ProfileImageURL != nil {
		profile.ProfileImageURL = *req.ProfileImageURL
	}
	if req.CoverImageURL != nil {
		profile.CoverImageURL = *req.CoverImageURL
	}
	if len(req.Photos) > 0 {
		profile.Photos = req.Photos
	}
	if req.SocialLinks != nil {
		profile.SocialLinks = *req.SocialLinks
	}
	if req.ContactInfo != nil {
		profile.ContactInfo = *req.ContactInfo
	}
	if req.MusicLinks != nil {
		profile.MusicLinks = *req.MusicLinks
	}
	if req.IsPublic != nil {
		profile.IsPublic = *req.IsPublic
	}

	profile.UpdatedAt = time.Now()

	if err := s.repo.UpdateProfile(ctx, profile); err != nil {
		return nil, fmt.Errorf("failed to update profile: %w", err)
	}

	return profile, nil
}

// ListArtistProfiles lists public artist profiles
func (s *Service) ListArtistProfiles(ctx context.Context, page, perPage int) ([]ArtistProfile, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListProfiles(ctx, offset, perPage)
}

// SearchArtistProfiles searches for artist profiles
func (s *Service) SearchArtistProfiles(ctx context.Context, query string, genre string, page, perPage int) ([]ArtistProfile, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.SearchProfiles(ctx, query, genre, offset, perPage)
}

// =====================
// Tech Rider management
// =====================

// SubmitTechRider creates a new tech rider for an artist
func (s *Service) SubmitTechRider(ctx context.Context, artistID uuid.UUID, req CreateTechRiderRequest) (*TechRider, error) {
	// Verify artist profile exists
	profile, err := s.repo.GetProfileByID(ctx, artistID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, errors.ErrNotFound
	}

	rider := &TechRider{
		ID:              uuid.New(),
		ArtistProfileID: artistID,
		Name:            req.Name,
		Description:     req.Description,
		IsDefault:       req.IsDefault,
		SetupTime:       req.SetupTime,
		SoundcheckTime:  req.SoundcheckTime,
		TeardownTime:    req.TeardownTime,
		AdditionalNotes: req.AdditionalNotes,
		DocumentURLs:    req.DocumentURLs,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if req.SoundRequirements != nil {
		rider.SoundRequirements = *req.SoundRequirements
	}
	if req.LightRequirements != nil {
		rider.LightRequirements = *req.LightRequirements
	}
	if req.BacklineRequirements != nil {
		rider.BacklineRequirements = *req.BacklineRequirements
	}
	if req.StageRequirements != nil {
		rider.StageRequirements = *req.StageRequirements
	}
	if req.HospitalityRequirements != nil {
		rider.HospitalityRequirements = *req.HospitalityRequirements
	}

	if err := s.repo.CreateTechRider(ctx, rider); err != nil {
		return nil, fmt.Errorf("failed to create tech rider: %w", err)
	}

	// If this is the first rider or marked as default, set it as default
	if req.IsDefault {
		if err := s.repo.SetDefaultTechRider(ctx, artistID, rider.ID); err != nil {
			// Non-critical error, continue
			fmt.Printf("warning: failed to set default tech rider: %v\n", err)
		}
	}

	return rider, nil
}

// GetTechRider gets a tech rider by ID
func (s *Service) GetTechRider(ctx context.Context, riderID uuid.UUID) (*TechRider, error) {
	rider, err := s.repo.GetTechRiderByID(ctx, riderID)
	if err != nil {
		return nil, err
	}
	if rider == nil {
		return nil, errors.ErrNotFound
	}
	return rider, nil
}

// ListTechRiders lists tech riders for an artist
func (s *Service) ListTechRiders(ctx context.Context, artistID uuid.UUID) ([]TechRider, error) {
	return s.repo.ListTechRidersByArtist(ctx, artistID)
}

// UpdateTechRider updates a tech rider
func (s *Service) UpdateTechRider(ctx context.Context, riderID uuid.UUID, req UpdateTechRiderRequest) (*TechRider, error) {
	rider, err := s.repo.GetTechRiderByID(ctx, riderID)
	if err != nil {
		return nil, err
	}
	if rider == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.Name != nil {
		rider.Name = *req.Name
	}
	if req.Description != nil {
		rider.Description = *req.Description
	}
	if req.SetupTime != nil {
		rider.SetupTime = *req.SetupTime
	}
	if req.SoundcheckTime != nil {
		rider.SoundcheckTime = *req.SoundcheckTime
	}
	if req.TeardownTime != nil {
		rider.TeardownTime = *req.TeardownTime
	}
	if req.SoundRequirements != nil {
		rider.SoundRequirements = *req.SoundRequirements
	}
	if req.LightRequirements != nil {
		rider.LightRequirements = *req.LightRequirements
	}
	if req.BacklineRequirements != nil {
		rider.BacklineRequirements = *req.BacklineRequirements
	}
	if req.StageRequirements != nil {
		rider.StageRequirements = *req.StageRequirements
	}
	if req.HospitalityRequirements != nil {
		rider.HospitalityRequirements = *req.HospitalityRequirements
	}
	if req.AdditionalNotes != nil {
		rider.AdditionalNotes = *req.AdditionalNotes
	}
	if len(req.DocumentURLs) > 0 {
		rider.DocumentURLs = req.DocumentURLs
	}

	rider.UpdatedAt = time.Now()

	if err := s.repo.UpdateTechRider(ctx, rider); err != nil {
		return nil, fmt.Errorf("failed to update tech rider: %w", err)
	}

	// Handle default setting
	if req.IsDefault != nil && *req.IsDefault {
		if err := s.repo.SetDefaultTechRider(ctx, rider.ArtistProfileID, rider.ID); err != nil {
			fmt.Printf("warning: failed to set default tech rider: %v\n", err)
		}
	}

	return rider, nil
}

// DeleteTechRider deletes a tech rider
func (s *Service) DeleteTechRider(ctx context.Context, riderID uuid.UUID) error {
	rider, err := s.repo.GetTechRiderByID(ctx, riderID)
	if err != nil {
		return err
	}
	if rider == nil {
		return errors.ErrNotFound
	}

	return s.repo.DeleteTechRider(ctx, riderID)
}

// =====================
// Availability management
// =====================

// AddAvailability adds availability slots for an artist
func (s *Service) AddAvailability(ctx context.Context, artistID uuid.UUID, req CreateAvailabilityRequest) (*ArtistAvailability, error) {
	// Verify artist profile exists
	profile, err := s.repo.GetProfileByID(ctx, artistID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, errors.ErrNotFound
	}

	// Validate date range
	if req.EndDate.Before(req.StartDate) {
		return nil, fmt.Errorf("end date must be after start date")
	}

	status := AvailabilityStatusAvailable
	if req.Status != "" {
		status = req.Status
	}

	availability := &ArtistAvailability{
		ID:              uuid.New(),
		ArtistProfileID: artistID,
		StartDate:       req.StartDate,
		EndDate:         req.EndDate,
		Status:          status,
		Notes:           req.Notes,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := s.repo.CreateAvailability(ctx, availability); err != nil {
		return nil, fmt.Errorf("failed to create availability: %w", err)
	}

	return availability, nil
}

// ListAvailabilities lists availability for an artist
func (s *Service) ListAvailabilities(ctx context.Context, artistID uuid.UUID) ([]ArtistAvailability, error) {
	return s.repo.ListAvailabilitiesByArtist(ctx, artistID)
}

// UpdateAvailability updates an availability slot
func (s *Service) UpdateAvailability(ctx context.Context, availabilityID uuid.UUID, status AvailabilityStatus, notes string) (*ArtistAvailability, error) {
	availability, err := s.repo.GetAvailabilityByID(ctx, availabilityID)
	if err != nil {
		return nil, err
	}
	if availability == nil {
		return nil, errors.ErrNotFound
	}

	availability.Status = status
	availability.Notes = notes
	availability.UpdatedAt = time.Now()

	if err := s.repo.UpdateAvailability(ctx, availability); err != nil {
		return nil, fmt.Errorf("failed to update availability: %w", err)
	}

	return availability, nil
}

// DeleteAvailability deletes an availability slot
func (s *Service) DeleteAvailability(ctx context.Context, availabilityID uuid.UUID) error {
	availability, err := s.repo.GetAvailabilityByID(ctx, availabilityID)
	if err != nil {
		return err
	}
	if availability == nil {
		return errors.ErrNotFound
	}

	return s.repo.DeleteAvailability(ctx, availabilityID)
}

// =====================
// Invitation management
// =====================

// CreateInvitation creates a new invitation (called by festival organizer)
func (s *Service) CreateInvitation(ctx context.Context, festivalID uuid.UUID, sentByUserID uuid.UUID, req CreateInvitationRequest) (*ArtistInvitation, error) {
	// Verify artist profile exists
	profile, err := s.repo.GetProfileByID(ctx, req.ArtistProfileID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, fmt.Errorf("artist profile not found")
	}

	// Check for existing invitation
	existing, err := s.repo.CheckExistingInvitation(ctx, req.ArtistProfileID, festivalID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("an active invitation already exists for this artist")
	}

	currency := "EUR"
	if req.Currency != "" {
		currency = req.Currency
	}

	invitation := &ArtistInvitation{
		ID:              uuid.New(),
		ArtistProfileID: req.ArtistProfileID,
		FestivalID:      festivalID,
		SentByUserID:    sentByUserID,
		Status:          InvitationStatusPending,
		ProposedFee:     req.ProposedFee,
		Currency:        currency,
		ProposedDate:    req.ProposedDate,
		ProposedStageID: req.ProposedStageID,
		SetDuration:     req.SetDuration,
		Message:         req.Message,
		ExpiresAt:       req.ExpiresAt,
		ContractStatus:  ContractStatusNone,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := s.repo.CreateInvitation(ctx, invitation); err != nil {
		return nil, fmt.Errorf("failed to create invitation: %w", err)
	}

	return invitation, nil
}

// GetInvitations gets all invitations for an artist
func (s *Service) GetInvitations(ctx context.Context, artistID uuid.UUID, status *InvitationStatus, page, perPage int) ([]ArtistInvitation, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListInvitationsByArtist(ctx, artistID, status, offset, perPage)
}

// GetInvitationsByFestival gets all invitations sent by a festival
func (s *Service) GetInvitationsByFestival(ctx context.Context, festivalID uuid.UUID, status *InvitationStatus, page, perPage int) ([]ArtistInvitation, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListInvitationsByFestival(ctx, festivalID, status, offset, perPage)
}

// GetInvitation gets a single invitation by ID
func (s *Service) GetInvitation(ctx context.Context, invitationID uuid.UUID) (*ArtistInvitation, error) {
	invitation, err := s.repo.GetInvitationByIDWithDetails(ctx, invitationID)
	if err != nil {
		return nil, err
	}
	if invitation == nil {
		return nil, errors.ErrNotFound
	}
	return invitation, nil
}

// RespondToInvitation handles an artist's response to an invitation
func (s *Service) RespondToInvitation(ctx context.Context, artistID uuid.UUID, invitationID uuid.UUID, accept bool, response string, counterFee *float64) (*ArtistInvitation, error) {
	invitation, err := s.repo.GetInvitationByID(ctx, invitationID)
	if err != nil {
		return nil, err
	}
	if invitation == nil {
		return nil, errors.ErrNotFound
	}

	// Verify the invitation belongs to this artist
	if invitation.ArtistProfileID != artistID {
		return nil, errors.ErrForbidden
	}

	// Check if invitation can be responded to
	if invitation.Status != InvitationStatusPending && invitation.Status != InvitationStatusNegotiating {
		return nil, fmt.Errorf("invitation cannot be responded to in current status: %s", invitation.Status)
	}

	// Check if expired
	if invitation.ExpiresAt != nil && invitation.ExpiresAt.Before(time.Now()) {
		invitation.Status = InvitationStatusExpired
		s.repo.UpdateInvitation(ctx, invitation)
		return nil, fmt.Errorf("invitation has expired")
	}

	now := time.Now()
	invitation.ArtistResponse = response
	invitation.RespondedAt = &now
	invitation.UpdatedAt = now

	if accept {
		invitation.Status = InvitationStatusAccepted
	} else if counterFee != nil {
		// Counter-offer (negotiation)
		invitation.Status = InvitationStatusNegotiating
		invitation.ProposedFee = *counterFee
	} else {
		invitation.Status = InvitationStatusDeclined
	}

	if err := s.repo.UpdateInvitation(ctx, invitation); err != nil {
		return nil, fmt.Errorf("failed to update invitation: %w", err)
	}

	// Return with full details
	return s.repo.GetInvitationByIDWithDetails(ctx, invitationID)
}

// CancelInvitation cancels an invitation (by festival organizer)
func (s *Service) CancelInvitation(ctx context.Context, invitationID uuid.UUID) error {
	invitation, err := s.repo.GetInvitationByID(ctx, invitationID)
	if err != nil {
		return err
	}
	if invitation == nil {
		return errors.ErrNotFound
	}

	if invitation.Status == InvitationStatusAccepted {
		return fmt.Errorf("cannot cancel an accepted invitation")
	}

	invitation.Status = InvitationStatusCancelled
	invitation.UpdatedAt = time.Now()

	return s.repo.UpdateInvitation(ctx, invitation)
}

// UpdateInvitationContract updates the contract status of an invitation
func (s *Service) UpdateInvitationContract(ctx context.Context, invitationID uuid.UUID, contractURL string, status ContractStatus) (*ArtistInvitation, error) {
	invitation, err := s.repo.GetInvitationByID(ctx, invitationID)
	if err != nil {
		return nil, err
	}
	if invitation == nil {
		return nil, errors.ErrNotFound
	}

	invitation.ContractURL = contractURL
	invitation.ContractStatus = status
	invitation.UpdatedAt = time.Now()

	if status == ContractStatusSigned {
		now := time.Now()
		invitation.ContractSignedAt = &now
	}

	if err := s.repo.UpdateInvitation(ctx, invitation); err != nil {
		return nil, fmt.Errorf("failed to update invitation contract: %w", err)
	}

	return invitation, nil
}

// =====================
// Performance queries
// =====================

// GetUpcomingPerformances gets upcoming performances for an artist
func (s *Service) GetUpcomingPerformances(ctx context.Context, artistID uuid.UUID) ([]UpcomingPerformanceResponse, error) {
	// Verify artist profile exists
	profile, err := s.repo.GetProfileByID(ctx, artistID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, errors.ErrNotFound
	}

	return s.repo.GetUpcomingPerformances(ctx, artistID)
}

// =====================
// Document management
// =====================

// AddDocument adds a document to an artist's profile
func (s *Service) AddDocument(ctx context.Context, artistID uuid.UUID, docType DocumentType, name, url, mimeType string, size int64, isPublic bool) (*ArtistDocument, error) {
	// Verify artist profile exists
	profile, err := s.repo.GetProfileByID(ctx, artistID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, errors.ErrNotFound
	}

	document := &ArtistDocument{
		ID:              uuid.New(),
		ArtistProfileID: artistID,
		Type:            docType,
		Name:            name,
		URL:             url,
		MimeType:        mimeType,
		Size:            size,
		IsPublic:        isPublic,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := s.repo.CreateDocument(ctx, document); err != nil {
		return nil, fmt.Errorf("failed to create document: %w", err)
	}

	return document, nil
}

// ListDocuments lists documents for an artist
func (s *Service) ListDocuments(ctx context.Context, artistID uuid.UUID, docType *DocumentType) ([]ArtistDocument, error) {
	return s.repo.ListDocumentsByArtist(ctx, artistID, docType)
}

// DeleteDocument deletes a document
func (s *Service) DeleteDocument(ctx context.Context, documentID uuid.UUID) error {
	document, err := s.repo.GetDocumentByID(ctx, documentID)
	if err != nil {
		return err
	}
	if document == nil {
		return errors.ErrNotFound
	}

	return s.repo.DeleteDocument(ctx, documentID)
}
