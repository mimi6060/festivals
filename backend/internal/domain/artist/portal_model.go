package artist

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// =====================
// ArtistProfile - Extended profile for the artist portal
// =====================

// ArtistProfile represents a complete artist profile with all details
type ArtistProfile struct {
	ID              uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID          uuid.UUID       `json:"userId" gorm:"type:uuid;not null;uniqueIndex"`
	Name            string          `json:"name" gorm:"not null"`
	StageName       string          `json:"stageName"`
	Bio             string          `json:"bio" gorm:"type:text"`
	ShortBio        string          `json:"shortBio" gorm:"size:500"`
	Genre           string          `json:"genre"`
	SubGenres       StringArray     `json:"subGenres" gorm:"type:jsonb;default:'[]'"`
	Country         string          `json:"country"`
	City            string          `json:"city"`
	ProfileImageURL string          `json:"profileImageUrl"`
	CoverImageURL   string          `json:"coverImageUrl"`
	Photos          PhotoGallery    `json:"photos" gorm:"type:jsonb;default:'[]'"`
	SocialLinks     ArtistSocials   `json:"socialLinks" gorm:"type:jsonb;default:'{}'"`
	ContactInfo     ArtistContact   `json:"contactInfo" gorm:"type:jsonb;default:'{}'"`
	MusicLinks      MusicPlatforms  `json:"musicLinks" gorm:"type:jsonb;default:'{}'"`
	IsVerified      bool            `json:"isVerified" gorm:"default:false"`
	IsPublic        bool            `json:"isPublic" gorm:"default:true"`
	CreatedAt       time.Time       `json:"createdAt"`
	UpdatedAt       time.Time       `json:"updatedAt"`

	// Relations
	TechRiders      []TechRider          `json:"techRiders,omitempty" gorm:"foreignKey:ArtistProfileID"`
	Availabilities  []ArtistAvailability `json:"availabilities,omitempty" gorm:"foreignKey:ArtistProfileID"`
	Invitations     []ArtistInvitation   `json:"invitations,omitempty" gorm:"foreignKey:ArtistProfileID"`
}

func (ArtistProfile) TableName() string {
	return "artist_profiles"
}

// StringArray is a custom type for storing string arrays in JSONB
type StringArray []string

func (s StringArray) Value() (driver.Value, error) {
	return json.Marshal(s)
}

func (s *StringArray) Scan(value interface{}) error {
	if value == nil {
		*s = []string{}
		return nil
	}
	return json.Unmarshal(value.([]byte), s)
}

// PhotoGallery holds artist photos
type PhotoGallery []ArtistPhoto

func (p PhotoGallery) Value() (driver.Value, error) {
	return json.Marshal(p)
}

func (p *PhotoGallery) Scan(value interface{}) error {
	if value == nil {
		*p = []ArtistPhoto{}
		return nil
	}
	return json.Unmarshal(value.([]byte), p)
}

// ArtistPhoto represents a photo in the gallery
type ArtistPhoto struct {
	URL         string `json:"url"`
	Caption     string `json:"caption,omitempty"`
	IsPrimary   bool   `json:"isPrimary,omitempty"`
	UploadedAt  string `json:"uploadedAt,omitempty"`
}

// ArtistSocials holds social media links
type ArtistSocials struct {
	Website    string `json:"website,omitempty"`
	Instagram  string `json:"instagram,omitempty"`
	Twitter    string `json:"twitter,omitempty"`
	Facebook   string `json:"facebook,omitempty"`
	TikTok     string `json:"tiktok,omitempty"`
	YouTube    string `json:"youtube,omitempty"`
	LinkedIn   string `json:"linkedin,omitempty"`
}

func (a ArtistSocials) Value() (driver.Value, error) {
	return json.Marshal(a)
}

func (a *ArtistSocials) Scan(value interface{}) error {
	if value == nil {
		*a = ArtistSocials{}
		return nil
	}
	return json.Unmarshal(value.([]byte), a)
}

// ArtistContact holds contact information
type ArtistContact struct {
	Email        string `json:"email,omitempty"`
	Phone        string `json:"phone,omitempty"`
	BookingEmail string `json:"bookingEmail,omitempty"`
	ManagerName  string `json:"managerName,omitempty"`
	ManagerEmail string `json:"managerEmail,omitempty"`
	ManagerPhone string `json:"managerPhone,omitempty"`
	AgentName    string `json:"agentName,omitempty"`
	AgentEmail   string `json:"agentEmail,omitempty"`
	AgentPhone   string `json:"agentPhone,omitempty"`
}

func (a ArtistContact) Value() (driver.Value, error) {
	return json.Marshal(a)
}

func (a *ArtistContact) Scan(value interface{}) error {
	if value == nil {
		*a = ArtistContact{}
		return nil
	}
	return json.Unmarshal(value.([]byte), a)
}

// MusicPlatforms holds streaming and music platform links
type MusicPlatforms struct {
	Spotify      string `json:"spotify,omitempty"`
	AppleMusic   string `json:"appleMusic,omitempty"`
	SoundCloud   string `json:"soundcloud,omitempty"`
	Bandcamp     string `json:"bandcamp,omitempty"`
	Deezer       string `json:"deezer,omitempty"`
	Mixcloud     string `json:"mixcloud,omitempty"`
	Beatport     string `json:"beatport,omitempty"`
}

func (m MusicPlatforms) Value() (driver.Value, error) {
	return json.Marshal(m)
}

func (m *MusicPlatforms) Scan(value interface{}) error {
	if value == nil {
		*m = MusicPlatforms{}
		return nil
	}
	return json.Unmarshal(value.([]byte), m)
}

// =====================
// TechRider - Technical requirements for performances
// =====================

// TechRider represents technical requirements for an artist's performance
type TechRider struct {
	ID              uuid.UUID          `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ArtistProfileID uuid.UUID          `json:"artistProfileId" gorm:"type:uuid;not null;index"`
	Name            string             `json:"name" gorm:"not null"` // e.g., "Full Band Setup", "DJ Set", "Acoustic"
	Description     string             `json:"description" gorm:"type:text"`
	IsDefault       bool               `json:"isDefault" gorm:"default:false"`
	SetupTime       int                `json:"setupTime"` // Minutes needed for setup
	SoundcheckTime  int                `json:"soundcheckTime"` // Minutes needed for soundcheck
	TeardownTime    int                `json:"teardownTime"` // Minutes needed for teardown
	SoundRequirements  SoundRequirements  `json:"soundRequirements" gorm:"type:jsonb;default:'{}'"`
	LightRequirements  LightRequirements  `json:"lightRequirements" gorm:"type:jsonb;default:'{}'"`
	BacklineRequirements BacklineRequirements `json:"backlineRequirements" gorm:"type:jsonb;default:'{}'"`
	StageRequirements   StageRequirements    `json:"stageRequirements" gorm:"type:jsonb;default:'{}'"`
	HospitalityRequirements HospitalityRequirements `json:"hospitalityRequirements" gorm:"type:jsonb;default:'{}'"`
	AdditionalNotes string             `json:"additionalNotes" gorm:"type:text"`
	DocumentURLs    StringArray        `json:"documentUrls" gorm:"type:jsonb;default:'[]'"` // PDF riders, stage plots
	CreatedAt       time.Time          `json:"createdAt"`
	UpdatedAt       time.Time          `json:"updatedAt"`
}

func (TechRider) TableName() string {
	return "tech_riders"
}

// SoundRequirements holds sound/PA requirements
type SoundRequirements struct {
	MinPAWatts       int           `json:"minPaWatts,omitempty"`
	MonitorChannels  int           `json:"monitorChannels,omitempty"`
	InEarMonitors    bool          `json:"inEarMonitors,omitempty"`
	InEarChannels    int           `json:"inEarChannels,omitempty"`
	MicrophoneList   []Equipment   `json:"microphoneList,omitempty"`
	DIBoxes          int           `json:"diBoxes,omitempty"`
	MixerChannels    int           `json:"mixerChannels,omitempty"`
	SpecialEffects   []string      `json:"specialEffects,omitempty"` // Reverb, delay, etc.
	Notes            string        `json:"notes,omitempty"`
}

func (s SoundRequirements) Value() (driver.Value, error) {
	return json.Marshal(s)
}

func (s *SoundRequirements) Scan(value interface{}) error {
	if value == nil {
		*s = SoundRequirements{}
		return nil
	}
	return json.Unmarshal(value.([]byte), s)
}

// LightRequirements holds lighting requirements
type LightRequirements struct {
	RequiresFog       bool     `json:"requiresFog,omitempty"`
	RequiresHaze      bool     `json:"requiresHaze,omitempty"`
	RequiresStrobe    bool     `json:"requiresStrobe,omitempty"`
	ColorPreferences  []string `json:"colorPreferences,omitempty"`
	AvoidColors       []string `json:"avoidColors,omitempty"`
	SpecialFixtures   []string `json:"specialFixtures,omitempty"`
	HasLightingDesign bool     `json:"hasLightingDesign,omitempty"`
	LightingDesignURL string   `json:"lightingDesignUrl,omitempty"`
	Notes             string   `json:"notes,omitempty"`
}

func (l LightRequirements) Value() (driver.Value, error) {
	return json.Marshal(l)
}

func (l *LightRequirements) Scan(value interface{}) error {
	if value == nil {
		*l = LightRequirements{}
		return nil
	}
	return json.Unmarshal(value.([]byte), l)
}

// BacklineRequirements holds backline/instrument requirements
type BacklineRequirements struct {
	NeedsBackline    bool        `json:"needsBackline"`
	BringsOwnGear    bool        `json:"bringsOwnGear"`
	Drums            *DrumKit    `json:"drums,omitempty"`
	Keyboards        []Equipment `json:"keyboards,omitempty"`
	Amplifiers       []Equipment `json:"amplifiers,omitempty"`
	DJEquipment      *DJSetup    `json:"djEquipment,omitempty"`
	OtherEquipment   []Equipment `json:"otherEquipment,omitempty"`
	Notes            string      `json:"notes,omitempty"`
}

func (b BacklineRequirements) Value() (driver.Value, error) {
	return json.Marshal(b)
}

func (b *BacklineRequirements) Scan(value interface{}) error {
	if value == nil {
		*b = BacklineRequirements{}
		return nil
	}
	return json.Unmarshal(value.([]byte), b)
}

// Equipment represents a piece of equipment
type Equipment struct {
	Name        string `json:"name"`
	Model       string `json:"model,omitempty"`
	Quantity    int    `json:"quantity"`
	Required    bool   `json:"required"`
	Notes       string `json:"notes,omitempty"`
}

// DrumKit represents drum kit requirements
type DrumKit struct {
	Needed          bool     `json:"needed"`
	Kit             string   `json:"kit,omitempty"` // e.g., "Full kit", "Electronic"
	KickDrums       int      `json:"kickDrums,omitempty"`
	SnareDrums      int      `json:"snareDrums,omitempty"`
	Toms            int      `json:"toms,omitempty"`
	Cymbals         []string `json:"cymbals,omitempty"`
	Hardware        []string `json:"hardware,omitempty"`
	Notes           string   `json:"notes,omitempty"`
}

// DJSetup represents DJ equipment requirements
type DJSetup struct {
	CDJs            int    `json:"cdjs,omitempty"`
	CDJModel        string `json:"cdjModel,omitempty"`
	Turntables      int    `json:"turntables,omitempty"`
	TurntableModel  string `json:"turntableModel,omitempty"`
	Mixer           string `json:"mixer,omitempty"`
	NeedsLaptopStand bool  `json:"needsLaptopStand,omitempty"`
	NeedsUSB        bool   `json:"needsUsb,omitempty"`
	Notes           string `json:"notes,omitempty"`
}

// StageRequirements holds stage/space requirements
type StageRequirements struct {
	MinWidth       float64 `json:"minWidth,omitempty"`  // Meters
	MinDepth       float64 `json:"minDepth,omitempty"`  // Meters
	MinHeight      float64 `json:"minHeight,omitempty"` // Meters
	RequiresRisers bool    `json:"requiresRisers,omitempty"`
	RiserDetails   string  `json:"riserDetails,omitempty"`
	RequiresCatwalk bool   `json:"requiresCatwalk,omitempty"`
	PowerRequirements string `json:"powerRequirements,omitempty"`
	StagePlotURL   string  `json:"stagePlotUrl,omitempty"`
	Notes          string  `json:"notes,omitempty"`
}

func (s StageRequirements) Value() (driver.Value, error) {
	return json.Marshal(s)
}

func (s *StageRequirements) Scan(value interface{}) error {
	if value == nil {
		*s = StageRequirements{}
		return nil
	}
	return json.Unmarshal(value.([]byte), s)
}

// HospitalityRequirements holds hospitality/catering requirements
type HospitalityRequirements struct {
	PartySize           int           `json:"partySize,omitempty"` // Number of people in the party
	DressingRoomNeeded  bool          `json:"dressingRoomNeeded,omitempty"`
	PrivateDressingRoom bool          `json:"privateDressingRoom,omitempty"`
	DietaryRestrictions []string      `json:"dietaryRestrictions,omitempty"` // Vegan, Gluten-free, etc.
	MealRequests        []string      `json:"mealRequests,omitempty"`
	BeverageRequests    []string      `json:"beverageRequests,omitempty"`
	TowelQuantity       int           `json:"towelQuantity,omitempty"`
	TransportNeeds      string        `json:"transportNeeds,omitempty"`
	AccommodationNeeds  string        `json:"accommodationNeeds,omitempty"`
	Notes               string        `json:"notes,omitempty"`
}

func (h HospitalityRequirements) Value() (driver.Value, error) {
	return json.Marshal(h)
}

func (h *HospitalityRequirements) Scan(value interface{}) error {
	if value == nil {
		*h = HospitalityRequirements{}
		return nil
	}
	return json.Unmarshal(value.([]byte), h)
}

// =====================
// ArtistAvailability - Available dates/times
// =====================

// ArtistAvailability represents time slots when an artist is available
type ArtistAvailability struct {
	ID              uuid.UUID         `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ArtistProfileID uuid.UUID         `json:"artistProfileId" gorm:"type:uuid;not null;index"`
	StartDate       time.Time         `json:"startDate" gorm:"not null"`
	EndDate         time.Time         `json:"endDate" gorm:"not null"`
	Status          AvailabilityStatus `json:"status" gorm:"default:'AVAILABLE'"`
	Notes           string            `json:"notes"`
	CreatedAt       time.Time         `json:"createdAt"`
	UpdatedAt       time.Time         `json:"updatedAt"`
}

func (ArtistAvailability) TableName() string {
	return "artist_availabilities"
}

// AvailabilityStatus represents the availability status
type AvailabilityStatus string

const (
	AvailabilityStatusAvailable    AvailabilityStatus = "AVAILABLE"
	AvailabilityStatusTentative    AvailabilityStatus = "TENTATIVE"
	AvailabilityStatusUnavailable  AvailabilityStatus = "UNAVAILABLE"
	AvailabilityStatusBooked       AvailabilityStatus = "BOOKED"
)

// =====================
// ArtistInvitation - Invitations from festivals
// =====================

// ArtistInvitation represents an invitation from a festival to an artist
type ArtistInvitation struct {
	ID              uuid.UUID        `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ArtistProfileID uuid.UUID        `json:"artistProfileId" gorm:"type:uuid;not null;index"`
	FestivalID      uuid.UUID        `json:"festivalId" gorm:"type:uuid;not null;index"`
	SentByUserID    uuid.UUID        `json:"sentByUserId" gorm:"type:uuid;not null"`
	Status          InvitationStatus `json:"status" gorm:"default:'PENDING'"`
	ProposedFee     float64          `json:"proposedFee,omitempty"` // Optional fee offer
	Currency        string           `json:"currency" gorm:"default:'EUR'"`
	ProposedDate    *time.Time       `json:"proposedDate,omitempty"`
	ProposedStageID *uuid.UUID       `json:"proposedStageId,omitempty" gorm:"type:uuid"`
	SetDuration     int              `json:"setDuration,omitempty"` // Minutes
	Message         string           `json:"message" gorm:"type:text"`
	ArtistResponse  string           `json:"artistResponse,omitempty" gorm:"type:text"`
	RespondedAt     *time.Time       `json:"respondedAt,omitempty"`
	ExpiresAt       *time.Time       `json:"expiresAt,omitempty"`
	ContractURL     string           `json:"contractUrl,omitempty"`
	ContractStatus  ContractStatus   `json:"contractStatus" gorm:"default:'NONE'"`
	ContractSignedAt *time.Time      `json:"contractSignedAt,omitempty"`
	CreatedAt       time.Time        `json:"createdAt"`
	UpdatedAt       time.Time        `json:"updatedAt"`

	// Virtual fields for responses (not stored, loaded via joins)
	FestivalName    string           `json:"festivalName,omitempty" gorm:"-"`
	FestivalLogo    string           `json:"festivalLogo,omitempty" gorm:"-"`
	FestivalDates   string           `json:"festivalDates,omitempty" gorm:"-"`
	StageName       string           `json:"stageName,omitempty" gorm:"-"`
}

func (ArtistInvitation) TableName() string {
	return "artist_invitations"
}

// InvitationStatus represents the status of an invitation
type InvitationStatus string

const (
	InvitationStatusPending    InvitationStatus = "PENDING"
	InvitationStatusAccepted   InvitationStatus = "ACCEPTED"
	InvitationStatusDeclined   InvitationStatus = "DECLINED"
	InvitationStatusExpired    InvitationStatus = "EXPIRED"
	InvitationStatusCancelled  InvitationStatus = "CANCELLED"
	InvitationStatusNegotiating InvitationStatus = "NEGOTIATING"
)

// ContractStatus represents the contract signing status
type ContractStatus string

const (
	ContractStatusNone      ContractStatus = "NONE"
	ContractStatusPending   ContractStatus = "PENDING"
	ContractStatusSent      ContractStatus = "SENT"
	ContractStatusSigned    ContractStatus = "SIGNED"
	ContractStatusRejected  ContractStatus = "REJECTED"
)

// =====================
// ArtistDocument - Documents associated with an artist
// =====================

// ArtistDocument represents a document uploaded by or for an artist
type ArtistDocument struct {
	ID              uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ArtistProfileID uuid.UUID    `json:"artistProfileId" gorm:"type:uuid;not null;index"`
	Type            DocumentType `json:"type" gorm:"not null"`
	Name            string       `json:"name" gorm:"not null"`
	URL             string       `json:"url" gorm:"not null"`
	MimeType        string       `json:"mimeType"`
	Size            int64        `json:"size"` // Bytes
	IsPublic        bool         `json:"isPublic" gorm:"default:false"`
	ExpiresAt       *time.Time   `json:"expiresAt,omitempty"`
	CreatedAt       time.Time    `json:"createdAt"`
	UpdatedAt       time.Time    `json:"updatedAt"`
}

func (ArtistDocument) TableName() string {
	return "artist_documents"
}

// DocumentType represents the type of document
type DocumentType string

const (
	DocumentTypeTechRider    DocumentType = "TECH_RIDER"
	DocumentTypeStagePlot    DocumentType = "STAGE_PLOT"
	DocumentTypeContract     DocumentType = "CONTRACT"
	DocumentTypeW9           DocumentType = "W9"
	DocumentTypeInsurance    DocumentType = "INSURANCE"
	DocumentTypePressKit     DocumentType = "PRESS_KIT"
	DocumentTypeOther        DocumentType = "OTHER"
)

// =====================
// Request DTOs
// =====================

// CreateArtistProfileRequest represents the request to create an artist profile
type CreateArtistProfileRequest struct {
	Name            string          `json:"name" binding:"required"`
	StageName       string          `json:"stageName"`
	Bio             string          `json:"bio"`
	ShortBio        string          `json:"shortBio"`
	Genre           string          `json:"genre"`
	SubGenres       []string        `json:"subGenres"`
	Country         string          `json:"country"`
	City            string          `json:"city"`
	ProfileImageURL string          `json:"profileImageUrl"`
	CoverImageURL   string          `json:"coverImageUrl"`
	SocialLinks     *ArtistSocials  `json:"socialLinks"`
	ContactInfo     *ArtistContact  `json:"contactInfo"`
	MusicLinks      *MusicPlatforms `json:"musicLinks"`
}

// UpdateArtistProfileRequest represents the request to update an artist profile
type UpdateArtistProfileRequest struct {
	Name            *string          `json:"name,omitempty"`
	StageName       *string          `json:"stageName,omitempty"`
	Bio             *string          `json:"bio,omitempty"`
	ShortBio        *string          `json:"shortBio,omitempty"`
	Genre           *string          `json:"genre,omitempty"`
	SubGenres       []string         `json:"subGenres,omitempty"`
	Country         *string          `json:"country,omitempty"`
	City            *string          `json:"city,omitempty"`
	ProfileImageURL *string          `json:"profileImageUrl,omitempty"`
	CoverImageURL   *string          `json:"coverImageUrl,omitempty"`
	Photos          []ArtistPhoto    `json:"photos,omitempty"`
	SocialLinks     *ArtistSocials   `json:"socialLinks,omitempty"`
	ContactInfo     *ArtistContact   `json:"contactInfo,omitempty"`
	MusicLinks      *MusicPlatforms  `json:"musicLinks,omitempty"`
	IsPublic        *bool            `json:"isPublic,omitempty"`
}

// CreateTechRiderRequest represents the request to create a tech rider
type CreateTechRiderRequest struct {
	Name                    string                  `json:"name" binding:"required"`
	Description             string                  `json:"description"`
	IsDefault               bool                    `json:"isDefault"`
	SetupTime               int                     `json:"setupTime"`
	SoundcheckTime          int                     `json:"soundcheckTime"`
	TeardownTime            int                     `json:"teardownTime"`
	SoundRequirements       *SoundRequirements      `json:"soundRequirements"`
	LightRequirements       *LightRequirements      `json:"lightRequirements"`
	BacklineRequirements    *BacklineRequirements   `json:"backlineRequirements"`
	StageRequirements       *StageRequirements      `json:"stageRequirements"`
	HospitalityRequirements *HospitalityRequirements `json:"hospitalityRequirements"`
	AdditionalNotes         string                  `json:"additionalNotes"`
	DocumentURLs            []string                `json:"documentUrls"`
}

// UpdateTechRiderRequest represents the request to update a tech rider
type UpdateTechRiderRequest struct {
	Name                    *string                  `json:"name,omitempty"`
	Description             *string                  `json:"description,omitempty"`
	IsDefault               *bool                    `json:"isDefault,omitempty"`
	SetupTime               *int                     `json:"setupTime,omitempty"`
	SoundcheckTime          *int                     `json:"soundcheckTime,omitempty"`
	TeardownTime            *int                     `json:"teardownTime,omitempty"`
	SoundRequirements       *SoundRequirements       `json:"soundRequirements,omitempty"`
	LightRequirements       *LightRequirements       `json:"lightRequirements,omitempty"`
	BacklineRequirements    *BacklineRequirements    `json:"backlineRequirements,omitempty"`
	StageRequirements       *StageRequirements       `json:"stageRequirements,omitempty"`
	HospitalityRequirements *HospitalityRequirements `json:"hospitalityRequirements,omitempty"`
	AdditionalNotes         *string                  `json:"additionalNotes,omitempty"`
	DocumentURLs            []string                 `json:"documentUrls,omitempty"`
}

// CreateAvailabilityRequest represents the request to create availability
type CreateAvailabilityRequest struct {
	StartDate time.Time          `json:"startDate" binding:"required"`
	EndDate   time.Time          `json:"endDate" binding:"required"`
	Status    AvailabilityStatus `json:"status"`
	Notes     string             `json:"notes"`
}

// CreateInvitationRequest represents the request to create an invitation (by festival organizer)
type CreateInvitationRequest struct {
	ArtistProfileID uuid.UUID  `json:"artistProfileId" binding:"required"`
	ProposedFee     float64    `json:"proposedFee"`
	Currency        string     `json:"currency"`
	ProposedDate    *time.Time `json:"proposedDate"`
	ProposedStageID *uuid.UUID `json:"proposedStageId"`
	SetDuration     int        `json:"setDuration"`
	Message         string     `json:"message"`
	ExpiresAt       *time.Time `json:"expiresAt"`
}

// RespondToInvitationRequest represents the artist's response to an invitation
type RespondToInvitationRequest struct {
	Accept    bool   `json:"accept"`
	Response  string `json:"response"`
	CounterFee *float64 `json:"counterFee,omitempty"` // For negotiation
}

// =====================
// Response DTOs
// =====================

// ArtistProfileResponse represents the API response for an artist profile
type ArtistProfileResponse struct {
	ID              uuid.UUID       `json:"id"`
	UserID          uuid.UUID       `json:"userId"`
	Name            string          `json:"name"`
	StageName       string          `json:"stageName"`
	Bio             string          `json:"bio"`
	ShortBio        string          `json:"shortBio"`
	Genre           string          `json:"genre"`
	SubGenres       []string        `json:"subGenres"`
	Country         string          `json:"country"`
	City            string          `json:"city"`
	ProfileImageURL string          `json:"profileImageUrl"`
	CoverImageURL   string          `json:"coverImageUrl"`
	Photos          []ArtistPhoto   `json:"photos"`
	SocialLinks     ArtistSocials   `json:"socialLinks"`
	ContactInfo     ArtistContact   `json:"contactInfo"`
	MusicLinks      MusicPlatforms  `json:"musicLinks"`
	IsVerified      bool            `json:"isVerified"`
	IsPublic        bool            `json:"isPublic"`
	CreatedAt       string          `json:"createdAt"`
	UpdatedAt       string          `json:"updatedAt"`
}

func (p *ArtistProfile) ToResponse() ArtistProfileResponse {
	subGenres := []string(p.SubGenres)
	if subGenres == nil {
		subGenres = []string{}
	}
	photos := []ArtistPhoto(p.Photos)
	if photos == nil {
		photos = []ArtistPhoto{}
	}
	return ArtistProfileResponse{
		ID:              p.ID,
		UserID:          p.UserID,
		Name:            p.Name,
		StageName:       p.StageName,
		Bio:             p.Bio,
		ShortBio:        p.ShortBio,
		Genre:           p.Genre,
		SubGenres:       subGenres,
		Country:         p.Country,
		City:            p.City,
		ProfileImageURL: p.ProfileImageURL,
		CoverImageURL:   p.CoverImageURL,
		Photos:          photos,
		SocialLinks:     p.SocialLinks,
		ContactInfo:     p.ContactInfo,
		MusicLinks:      p.MusicLinks,
		IsVerified:      p.IsVerified,
		IsPublic:        p.IsPublic,
		CreatedAt:       p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       p.UpdatedAt.Format(time.RFC3339),
	}
}

// TechRiderResponse represents the API response for a tech rider
type TechRiderResponse struct {
	ID                      uuid.UUID               `json:"id"`
	ArtistProfileID         uuid.UUID               `json:"artistProfileId"`
	Name                    string                  `json:"name"`
	Description             string                  `json:"description"`
	IsDefault               bool                    `json:"isDefault"`
	SetupTime               int                     `json:"setupTime"`
	SoundcheckTime          int                     `json:"soundcheckTime"`
	TeardownTime            int                     `json:"teardownTime"`
	SoundRequirements       SoundRequirements       `json:"soundRequirements"`
	LightRequirements       LightRequirements       `json:"lightRequirements"`
	BacklineRequirements    BacklineRequirements    `json:"backlineRequirements"`
	StageRequirements       StageRequirements       `json:"stageRequirements"`
	HospitalityRequirements HospitalityRequirements `json:"hospitalityRequirements"`
	AdditionalNotes         string                  `json:"additionalNotes"`
	DocumentURLs            []string                `json:"documentUrls"`
	CreatedAt               string                  `json:"createdAt"`
	UpdatedAt               string                  `json:"updatedAt"`
}

func (t *TechRider) ToResponse() TechRiderResponse {
	docURLs := []string(t.DocumentURLs)
	if docURLs == nil {
		docURLs = []string{}
	}
	return TechRiderResponse{
		ID:                      t.ID,
		ArtistProfileID:         t.ArtistProfileID,
		Name:                    t.Name,
		Description:             t.Description,
		IsDefault:               t.IsDefault,
		SetupTime:               t.SetupTime,
		SoundcheckTime:          t.SoundcheckTime,
		TeardownTime:            t.TeardownTime,
		SoundRequirements:       t.SoundRequirements,
		LightRequirements:       t.LightRequirements,
		BacklineRequirements:    t.BacklineRequirements,
		StageRequirements:       t.StageRequirements,
		HospitalityRequirements: t.HospitalityRequirements,
		AdditionalNotes:         t.AdditionalNotes,
		DocumentURLs:            docURLs,
		CreatedAt:               t.CreatedAt.Format(time.RFC3339),
		UpdatedAt:               t.UpdatedAt.Format(time.RFC3339),
	}
}

// InvitationResponse represents the API response for an invitation
type InvitationResponse struct {
	ID              uuid.UUID        `json:"id"`
	ArtistProfileID uuid.UUID        `json:"artistProfileId"`
	FestivalID      uuid.UUID        `json:"festivalId"`
	FestivalName    string           `json:"festivalName"`
	FestivalLogo    string           `json:"festivalLogo,omitempty"`
	FestivalDates   string           `json:"festivalDates,omitempty"`
	StageName       string           `json:"stageName,omitempty"`
	SentByUserID    uuid.UUID        `json:"sentByUserId"`
	Status          InvitationStatus `json:"status"`
	ProposedFee     float64          `json:"proposedFee,omitempty"`
	Currency        string           `json:"currency"`
	ProposedDate    *string          `json:"proposedDate,omitempty"`
	ProposedStageID *uuid.UUID       `json:"proposedStageId,omitempty"`
	SetDuration     int              `json:"setDuration,omitempty"`
	Message         string           `json:"message"`
	ArtistResponse  string           `json:"artistResponse,omitempty"`
	RespondedAt     *string          `json:"respondedAt,omitempty"`
	ExpiresAt       *string          `json:"expiresAt,omitempty"`
	ContractURL     string           `json:"contractUrl,omitempty"`
	ContractStatus  ContractStatus   `json:"contractStatus"`
	ContractSignedAt *string         `json:"contractSignedAt,omitempty"`
	CreatedAt       string           `json:"createdAt"`
	UpdatedAt       string           `json:"updatedAt"`
}

func (i *ArtistInvitation) ToResponse() InvitationResponse {
	resp := InvitationResponse{
		ID:              i.ID,
		ArtistProfileID: i.ArtistProfileID,
		FestivalID:      i.FestivalID,
		FestivalName:    i.FestivalName,
		FestivalLogo:    i.FestivalLogo,
		FestivalDates:   i.FestivalDates,
		StageName:       i.StageName,
		SentByUserID:    i.SentByUserID,
		Status:          i.Status,
		ProposedFee:     i.ProposedFee,
		Currency:        i.Currency,
		ProposedStageID: i.ProposedStageID,
		SetDuration:     i.SetDuration,
		Message:         i.Message,
		ArtistResponse:  i.ArtistResponse,
		ContractURL:     i.ContractURL,
		ContractStatus:  i.ContractStatus,
		CreatedAt:       i.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       i.UpdatedAt.Format(time.RFC3339),
	}

	if i.ProposedDate != nil {
		date := i.ProposedDate.Format(time.RFC3339)
		resp.ProposedDate = &date
	}
	if i.RespondedAt != nil {
		date := i.RespondedAt.Format(time.RFC3339)
		resp.RespondedAt = &date
	}
	if i.ExpiresAt != nil {
		date := i.ExpiresAt.Format(time.RFC3339)
		resp.ExpiresAt = &date
	}
	if i.ContractSignedAt != nil {
		date := i.ContractSignedAt.Format(time.RFC3339)
		resp.ContractSignedAt = &date
	}

	return resp
}

// AvailabilityResponse represents the API response for availability
type AvailabilityResponse struct {
	ID              uuid.UUID          `json:"id"`
	ArtistProfileID uuid.UUID          `json:"artistProfileId"`
	StartDate       string             `json:"startDate"`
	EndDate         string             `json:"endDate"`
	Status          AvailabilityStatus `json:"status"`
	Notes           string             `json:"notes"`
	CreatedAt       string             `json:"createdAt"`
	UpdatedAt       string             `json:"updatedAt"`
}

func (a *ArtistAvailability) ToResponse() AvailabilityResponse {
	return AvailabilityResponse{
		ID:              a.ID,
		ArtistProfileID: a.ArtistProfileID,
		StartDate:       a.StartDate.Format(time.RFC3339),
		EndDate:         a.EndDate.Format(time.RFC3339),
		Status:          a.Status,
		Notes:           a.Notes,
		CreatedAt:       a.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       a.UpdatedAt.Format(time.RFC3339),
	}
}

// UpcomingPerformanceResponse represents an upcoming performance for an artist
type UpcomingPerformanceResponse struct {
	ID           uuid.UUID `json:"id"`
	FestivalID   uuid.UUID `json:"festivalId"`
	FestivalName string    `json:"festivalName"`
	FestivalLogo string    `json:"festivalLogo,omitempty"`
	StageID      uuid.UUID `json:"stageId"`
	StageName    string    `json:"stageName"`
	StartTime    string    `json:"startTime"`
	EndTime      string    `json:"endTime"`
	Status       string    `json:"status"`
}
