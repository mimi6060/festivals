package artist

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository defines the interface for artist portal data operations
type Repository interface {
	// ArtistProfile operations
	CreateProfile(ctx context.Context, profile *ArtistProfile) error
	GetProfileByID(ctx context.Context, id uuid.UUID) (*ArtistProfile, error)
	GetProfileByUserID(ctx context.Context, userID uuid.UUID) (*ArtistProfile, error)
	UpdateProfile(ctx context.Context, profile *ArtistProfile) error
	DeleteProfile(ctx context.Context, id uuid.UUID) error
	ListProfiles(ctx context.Context, offset, limit int) ([]ArtistProfile, int64, error)
	SearchProfiles(ctx context.Context, query string, genre string, offset, limit int) ([]ArtistProfile, int64, error)

	// TechRider operations
	CreateTechRider(ctx context.Context, rider *TechRider) error
	GetTechRiderByID(ctx context.Context, id uuid.UUID) (*TechRider, error)
	ListTechRidersByArtist(ctx context.Context, artistProfileID uuid.UUID) ([]TechRider, error)
	UpdateTechRider(ctx context.Context, rider *TechRider) error
	DeleteTechRider(ctx context.Context, id uuid.UUID) error
	GetDefaultTechRider(ctx context.Context, artistProfileID uuid.UUID) (*TechRider, error)
	SetDefaultTechRider(ctx context.Context, artistProfileID uuid.UUID, riderID uuid.UUID) error

	// Availability operations
	CreateAvailability(ctx context.Context, availability *ArtistAvailability) error
	GetAvailabilityByID(ctx context.Context, id uuid.UUID) (*ArtistAvailability, error)
	ListAvailabilitiesByArtist(ctx context.Context, artistProfileID uuid.UUID) ([]ArtistAvailability, error)
	GetAvailabilitiesInRange(ctx context.Context, artistProfileID uuid.UUID, startDate, endDate string) ([]ArtistAvailability, error)
	UpdateAvailability(ctx context.Context, availability *ArtistAvailability) error
	DeleteAvailability(ctx context.Context, id uuid.UUID) error

	// Invitation operations
	CreateInvitation(ctx context.Context, invitation *ArtistInvitation) error
	GetInvitationByID(ctx context.Context, id uuid.UUID) (*ArtistInvitation, error)
	GetInvitationByIDWithDetails(ctx context.Context, id uuid.UUID) (*ArtistInvitation, error)
	ListInvitationsByArtist(ctx context.Context, artistProfileID uuid.UUID, status *InvitationStatus, offset, limit int) ([]ArtistInvitation, int64, error)
	ListInvitationsByFestival(ctx context.Context, festivalID uuid.UUID, status *InvitationStatus, offset, limit int) ([]ArtistInvitation, int64, error)
	UpdateInvitation(ctx context.Context, invitation *ArtistInvitation) error
	DeleteInvitation(ctx context.Context, id uuid.UUID) error
	CheckExistingInvitation(ctx context.Context, artistProfileID uuid.UUID, festivalID uuid.UUID) (*ArtistInvitation, error)

	// Document operations
	CreateDocument(ctx context.Context, document *ArtistDocument) error
	GetDocumentByID(ctx context.Context, id uuid.UUID) (*ArtistDocument, error)
	ListDocumentsByArtist(ctx context.Context, artistProfileID uuid.UUID, docType *DocumentType) ([]ArtistDocument, error)
	DeleteDocument(ctx context.Context, id uuid.UUID) error

	// Performance queries (join with lineup performances)
	GetUpcomingPerformances(ctx context.Context, artistProfileID uuid.UUID) ([]UpcomingPerformanceResponse, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new artist portal repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// =====================
// ArtistProfile operations
// =====================

func (r *repository) CreateProfile(ctx context.Context, profile *ArtistProfile) error {
	return r.db.WithContext(ctx).Create(profile).Error
}

func (r *repository) GetProfileByID(ctx context.Context, id uuid.UUID) (*ArtistProfile, error) {
	var profile ArtistProfile
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&profile).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get artist profile: %w", err)
	}
	return &profile, nil
}

func (r *repository) GetProfileByUserID(ctx context.Context, userID uuid.UUID) (*ArtistProfile, error) {
	var profile ArtistProfile
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&profile).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get artist profile: %w", err)
	}
	return &profile, nil
}

func (r *repository) UpdateProfile(ctx context.Context, profile *ArtistProfile) error {
	return r.db.WithContext(ctx).Save(profile).Error
}

func (r *repository) DeleteProfile(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&ArtistProfile{}).Error
}

func (r *repository) ListProfiles(ctx context.Context, offset, limit int) ([]ArtistProfile, int64, error) {
	var profiles []ArtistProfile
	var total int64

	query := r.db.WithContext(ctx).Model(&ArtistProfile{}).Where("is_public = ?", true)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count profiles: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("name ASC").Find(&profiles).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list profiles: %w", err)
	}

	return profiles, total, nil
}

func (r *repository) SearchProfiles(ctx context.Context, query string, genre string, offset, limit int) ([]ArtistProfile, int64, error) {
	var profiles []ArtistProfile
	var total int64

	dbQuery := r.db.WithContext(ctx).Model(&ArtistProfile{}).Where("is_public = ?", true)

	if query != "" {
		searchPattern := "%" + query + "%"
		dbQuery = dbQuery.Where("name ILIKE ? OR stage_name ILIKE ? OR genre ILIKE ?", searchPattern, searchPattern, searchPattern)
	}

	if genre != "" {
		dbQuery = dbQuery.Where("genre = ?", genre)
	}

	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count profiles: %w", err)
	}

	if err := dbQuery.Offset(offset).Limit(limit).Order("name ASC").Find(&profiles).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to search profiles: %w", err)
	}

	return profiles, total, nil
}

// =====================
// TechRider operations
// =====================

func (r *repository) CreateTechRider(ctx context.Context, rider *TechRider) error {
	return r.db.WithContext(ctx).Create(rider).Error
}

func (r *repository) GetTechRiderByID(ctx context.Context, id uuid.UUID) (*TechRider, error) {
	var rider TechRider
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&rider).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get tech rider: %w", err)
	}
	return &rider, nil
}

func (r *repository) ListTechRidersByArtist(ctx context.Context, artistProfileID uuid.UUID) ([]TechRider, error) {
	var riders []TechRider
	err := r.db.WithContext(ctx).
		Where("artist_profile_id = ?", artistProfileID).
		Order("is_default DESC, name ASC").
		Find(&riders).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list tech riders: %w", err)
	}
	return riders, nil
}

func (r *repository) UpdateTechRider(ctx context.Context, rider *TechRider) error {
	return r.db.WithContext(ctx).Save(rider).Error
}

func (r *repository) DeleteTechRider(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&TechRider{}).Error
}

func (r *repository) GetDefaultTechRider(ctx context.Context, artistProfileID uuid.UUID) (*TechRider, error) {
	var rider TechRider
	err := r.db.WithContext(ctx).
		Where("artist_profile_id = ? AND is_default = ?", artistProfileID, true).
		First(&rider).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get default tech rider: %w", err)
	}
	return &rider, nil
}

func (r *repository) SetDefaultTechRider(ctx context.Context, artistProfileID uuid.UUID, riderID uuid.UUID) error {
	// Start transaction
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Reset all riders for this artist
		if err := tx.Model(&TechRider{}).
			Where("artist_profile_id = ?", artistProfileID).
			Update("is_default", false).Error; err != nil {
			return err
		}

		// Set the new default
		return tx.Model(&TechRider{}).
			Where("id = ?", riderID).
			Update("is_default", true).Error
	})
}

// =====================
// Availability operations
// =====================

func (r *repository) CreateAvailability(ctx context.Context, availability *ArtistAvailability) error {
	return r.db.WithContext(ctx).Create(availability).Error
}

func (r *repository) GetAvailabilityByID(ctx context.Context, id uuid.UUID) (*ArtistAvailability, error) {
	var availability ArtistAvailability
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&availability).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get availability: %w", err)
	}
	return &availability, nil
}

func (r *repository) ListAvailabilitiesByArtist(ctx context.Context, artistProfileID uuid.UUID) ([]ArtistAvailability, error) {
	var availabilities []ArtistAvailability
	err := r.db.WithContext(ctx).
		Where("artist_profile_id = ?", artistProfileID).
		Order("start_date ASC").
		Find(&availabilities).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list availabilities: %w", err)
	}
	return availabilities, nil
}

func (r *repository) GetAvailabilitiesInRange(ctx context.Context, artistProfileID uuid.UUID, startDate, endDate string) ([]ArtistAvailability, error) {
	var availabilities []ArtistAvailability
	err := r.db.WithContext(ctx).
		Where("artist_profile_id = ? AND start_date <= ? AND end_date >= ?", artistProfileID, endDate, startDate).
		Order("start_date ASC").
		Find(&availabilities).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get availabilities in range: %w", err)
	}
	return availabilities, nil
}

func (r *repository) UpdateAvailability(ctx context.Context, availability *ArtistAvailability) error {
	return r.db.WithContext(ctx).Save(availability).Error
}

func (r *repository) DeleteAvailability(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&ArtistAvailability{}).Error
}

// =====================
// Invitation operations
// =====================

func (r *repository) CreateInvitation(ctx context.Context, invitation *ArtistInvitation) error {
	return r.db.WithContext(ctx).Create(invitation).Error
}

func (r *repository) GetInvitationByID(ctx context.Context, id uuid.UUID) (*ArtistInvitation, error) {
	var invitation ArtistInvitation
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&invitation).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get invitation: %w", err)
	}
	return &invitation, nil
}

func (r *repository) GetInvitationByIDWithDetails(ctx context.Context, id uuid.UUID) (*ArtistInvitation, error) {
	var invitation ArtistInvitation
	err := r.db.WithContext(ctx).
		Table("artist_invitations").
		Select(`artist_invitations.*,
			festivals.name as festival_name,
			festivals.logo_url as festival_logo,
			CONCAT(festivals.start_date, ' - ', festivals.end_date) as festival_dates,
			stages.name as stage_name`).
		Joins("LEFT JOIN festivals ON festivals.id = artist_invitations.festival_id").
		Joins("LEFT JOIN stages ON stages.id = artist_invitations.proposed_stage_id").
		Where("artist_invitations.id = ?", id).
		First(&invitation).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get invitation with details: %w", err)
	}
	return &invitation, nil
}

func (r *repository) ListInvitationsByArtist(ctx context.Context, artistProfileID uuid.UUID, status *InvitationStatus, offset, limit int) ([]ArtistInvitation, int64, error) {
	var invitations []ArtistInvitation
	var total int64

	query := r.db.WithContext(ctx).
		Table("artist_invitations").
		Select(`artist_invitations.*,
			festivals.name as festival_name,
			festivals.logo_url as festival_logo,
			CONCAT(festivals.start_date, ' - ', festivals.end_date) as festival_dates,
			stages.name as stage_name`).
		Joins("LEFT JOIN festivals ON festivals.id = artist_invitations.festival_id").
		Joins("LEFT JOIN stages ON stages.id = artist_invitations.proposed_stage_id").
		Where("artist_invitations.artist_profile_id = ?", artistProfileID)

	if status != nil {
		query = query.Where("artist_invitations.status = ?", *status)
	}

	// Count total
	countQuery := r.db.WithContext(ctx).Model(&ArtistInvitation{}).Where("artist_profile_id = ?", artistProfileID)
	if status != nil {
		countQuery = countQuery.Where("status = ?", *status)
	}
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count invitations: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("artist_invitations.created_at DESC").Find(&invitations).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list invitations: %w", err)
	}

	return invitations, total, nil
}

func (r *repository) ListInvitationsByFestival(ctx context.Context, festivalID uuid.UUID, status *InvitationStatus, offset, limit int) ([]ArtistInvitation, int64, error) {
	var invitations []ArtistInvitation
	var total int64

	query := r.db.WithContext(ctx).
		Table("artist_invitations").
		Select(`artist_invitations.*,
			artist_profiles.name as artist_name,
			artist_profiles.stage_name as artist_stage_name,
			stages.name as stage_name`).
		Joins("LEFT JOIN artist_profiles ON artist_profiles.id = artist_invitations.artist_profile_id").
		Joins("LEFT JOIN stages ON stages.id = artist_invitations.proposed_stage_id").
		Where("artist_invitations.festival_id = ?", festivalID)

	if status != nil {
		query = query.Where("artist_invitations.status = ?", *status)
	}

	// Count total
	countQuery := r.db.WithContext(ctx).Model(&ArtistInvitation{}).Where("festival_id = ?", festivalID)
	if status != nil {
		countQuery = countQuery.Where("status = ?", *status)
	}
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count invitations: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("artist_invitations.created_at DESC").Find(&invitations).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list invitations: %w", err)
	}

	return invitations, total, nil
}

func (r *repository) UpdateInvitation(ctx context.Context, invitation *ArtistInvitation) error {
	return r.db.WithContext(ctx).Save(invitation).Error
}

func (r *repository) DeleteInvitation(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&ArtistInvitation{}).Error
}

func (r *repository) CheckExistingInvitation(ctx context.Context, artistProfileID uuid.UUID, festivalID uuid.UUID) (*ArtistInvitation, error) {
	var invitation ArtistInvitation
	err := r.db.WithContext(ctx).
		Where("artist_profile_id = ? AND festival_id = ? AND status IN ?", artistProfileID, festivalID, []InvitationStatus{InvitationStatusPending, InvitationStatusAccepted, InvitationStatusNegotiating}).
		First(&invitation).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to check existing invitation: %w", err)
	}
	return &invitation, nil
}

// =====================
// Document operations
// =====================

func (r *repository) CreateDocument(ctx context.Context, document *ArtistDocument) error {
	return r.db.WithContext(ctx).Create(document).Error
}

func (r *repository) GetDocumentByID(ctx context.Context, id uuid.UUID) (*ArtistDocument, error) {
	var document ArtistDocument
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&document).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get document: %w", err)
	}
	return &document, nil
}

func (r *repository) ListDocumentsByArtist(ctx context.Context, artistProfileID uuid.UUID, docType *DocumentType) ([]ArtistDocument, error) {
	var documents []ArtistDocument
	query := r.db.WithContext(ctx).Where("artist_profile_id = ?", artistProfileID)

	if docType != nil {
		query = query.Where("type = ?", *docType)
	}

	err := query.Order("created_at DESC").Find(&documents).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list documents: %w", err)
	}
	return documents, nil
}

func (r *repository) DeleteDocument(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&ArtistDocument{}).Error
}

// =====================
// Performance queries
// =====================

func (r *repository) GetUpcomingPerformances(ctx context.Context, artistProfileID uuid.UUID) ([]UpcomingPerformanceResponse, error) {
	var performances []UpcomingPerformanceResponse

	// Query performances linked to this artist profile via the artists table
	// This assumes there's a link between artist_profiles and the lineup artists table
	err := r.db.WithContext(ctx).
		Table("performances").
		Select(`performances.id,
			performances.festival_id,
			festivals.name as festival_name,
			festivals.logo_url as festival_logo,
			performances.stage_id,
			stages.name as stage_name,
			performances.start_time,
			performances.end_time,
			performances.status`).
		Joins("JOIN artists ON artists.id = performances.artist_id").
		Joins("JOIN artist_profiles ON artist_profiles.user_id = artists.user_id OR artist_profiles.name = artists.name").
		Joins("JOIN festivals ON festivals.id = performances.festival_id").
		Joins("JOIN stages ON stages.id = performances.stage_id").
		Where("artist_profiles.id = ? AND performances.start_time >= NOW()", artistProfileID).
		Order("performances.start_time ASC").
		Limit(20).
		Find(&performances).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get upcoming performances: %w", err)
	}

	return performances, nil
}
