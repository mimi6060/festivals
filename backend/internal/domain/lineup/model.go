package lineup

import (
	"time"

	"github.com/google/uuid"
)

// Artist represents a performing artist at a festival
type Artist struct {
	ID          uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID  uuid.UUID    `json:"festivalId" gorm:"type:uuid;not null;index"`
	Name        string       `json:"name" gorm:"not null"`
	Description string       `json:"description"`
	Genre       string       `json:"genre"`
	ImageURL    string       `json:"imageUrl,omitempty"`
	SocialLinks SocialLinks  `json:"socialLinks" gorm:"type:jsonb;default:'{}'"`
	CreatedAt   time.Time    `json:"createdAt"`
	UpdatedAt   time.Time    `json:"updatedAt"`
}

func (Artist) TableName() string {
	return "artists"
}

// SocialLinks holds artist social media links
type SocialLinks struct {
	Website   string `json:"website,omitempty"`
	Instagram string `json:"instagram,omitempty"`
	Twitter   string `json:"twitter,omitempty"`
	Facebook  string `json:"facebook,omitempty"`
	Spotify   string `json:"spotify,omitempty"`
	YouTube   string `json:"youtube,omitempty"`
	SoundCloud string `json:"soundcloud,omitempty"`
}

// Stage represents a performance stage at a festival
type Stage struct {
	ID         uuid.UUID     `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID uuid.UUID     `json:"festivalId" gorm:"type:uuid;not null;index"`
	Name       string        `json:"name" gorm:"not null"`
	Location   string        `json:"location"`
	Capacity   int           `json:"capacity"`
	Settings   StageSettings `json:"settings" gorm:"type:jsonb;default:'{}'"`
	CreatedAt  time.Time     `json:"createdAt"`
	UpdatedAt  time.Time     `json:"updatedAt"`
}

func (Stage) TableName() string {
	return "stages"
}

// StageSettings holds stage-specific configuration
type StageSettings struct {
	Color       string `json:"color,omitempty"`       // UI color for the stage
	Description string `json:"description,omitempty"` // Stage description/vibe
	ImageURL    string `json:"imageUrl,omitempty"`    // Stage image
	IsIndoor    bool   `json:"isIndoor"`              // Indoor or outdoor
	HasSeating  bool   `json:"hasSeating"`            // Has seating area
}

// Performance represents a scheduled performance by an artist on a stage
type Performance struct {
	ID         uuid.UUID         `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID uuid.UUID         `json:"festivalId" gorm:"type:uuid;not null;index"`
	ArtistID   uuid.UUID         `json:"artistId" gorm:"type:uuid;not null;index"`
	StageID    uuid.UUID         `json:"stageId" gorm:"type:uuid;not null;index"`
	StartTime  time.Time         `json:"startTime" gorm:"not null"`
	EndTime    time.Time         `json:"endTime" gorm:"not null"`
	Day        string            `json:"day" gorm:"not null;index"` // Format: 2006-01-02
	Status     PerformanceStatus `json:"status" gorm:"default:'SCHEDULED'"`
	CreatedAt  time.Time         `json:"createdAt"`
	UpdatedAt  time.Time         `json:"updatedAt"`

	// Relations (for eager loading)
	Artist *Artist `json:"artist,omitempty" gorm:"foreignKey:ArtistID"`
	Stage  *Stage  `json:"stage,omitempty" gorm:"foreignKey:StageID"`
}

func (Performance) TableName() string {
	return "performances"
}

// PerformanceStatus represents the status of a performance
type PerformanceStatus string

const (
	PerformanceStatusScheduled PerformanceStatus = "SCHEDULED"
	PerformanceStatusLive      PerformanceStatus = "LIVE"
	PerformanceStatusCompleted PerformanceStatus = "COMPLETED"
	PerformanceStatusCancelled PerformanceStatus = "CANCELLED"
	PerformanceStatusDelayed   PerformanceStatus = "DELAYED"
)

// =====================
// Request DTOs
// =====================

// CreateArtistRequest represents the request to create an artist
type CreateArtistRequest struct {
	Name        string       `json:"name" binding:"required"`
	Description string       `json:"description"`
	Genre       string       `json:"genre"`
	ImageURL    string       `json:"imageUrl"`
	SocialLinks *SocialLinks `json:"socialLinks"`
}

// UpdateArtistRequest represents the request to update an artist
type UpdateArtistRequest struct {
	Name        *string      `json:"name,omitempty"`
	Description *string      `json:"description,omitempty"`
	Genre       *string      `json:"genre,omitempty"`
	ImageURL    *string      `json:"imageUrl,omitempty"`
	SocialLinks *SocialLinks `json:"socialLinks,omitempty"`
}

// CreateStageRequest represents the request to create a stage
type CreateStageRequest struct {
	Name     string         `json:"name" binding:"required"`
	Location string         `json:"location"`
	Capacity int            `json:"capacity"`
	Settings *StageSettings `json:"settings"`
}

// UpdateStageRequest represents the request to update a stage
type UpdateStageRequest struct {
	Name     *string        `json:"name,omitempty"`
	Location *string        `json:"location,omitempty"`
	Capacity *int           `json:"capacity,omitempty"`
	Settings *StageSettings `json:"settings,omitempty"`
}

// CreatePerformanceRequest represents the request to create a performance
type CreatePerformanceRequest struct {
	ArtistID  uuid.UUID `json:"artistId" binding:"required"`
	StageID   uuid.UUID `json:"stageId" binding:"required"`
	StartTime time.Time `json:"startTime" binding:"required"`
	EndTime   time.Time `json:"endTime" binding:"required"`
	Day       string    `json:"day" binding:"required"` // Format: 2006-01-02
}

// UpdatePerformanceRequest represents the request to update a performance
type UpdatePerformanceRequest struct {
	ArtistID  *uuid.UUID         `json:"artistId,omitempty"`
	StageID   *uuid.UUID         `json:"stageId,omitempty"`
	StartTime *time.Time         `json:"startTime,omitempty"`
	EndTime   *time.Time         `json:"endTime,omitempty"`
	Day       *string            `json:"day,omitempty"`
	Status    *PerformanceStatus `json:"status,omitempty"`
}

// =====================
// Response DTOs
// =====================

// ArtistResponse represents the API response for an artist
type ArtistResponse struct {
	ID          uuid.UUID   `json:"id"`
	FestivalID  uuid.UUID   `json:"festivalId"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Genre       string      `json:"genre"`
	ImageURL    string      `json:"imageUrl,omitempty"`
	SocialLinks SocialLinks `json:"socialLinks"`
	CreatedAt   string      `json:"createdAt"`
	UpdatedAt   string      `json:"updatedAt"`
}

func (a *Artist) ToResponse() ArtistResponse {
	return ArtistResponse{
		ID:          a.ID,
		FestivalID:  a.FestivalID,
		Name:        a.Name,
		Description: a.Description,
		Genre:       a.Genre,
		ImageURL:    a.ImageURL,
		SocialLinks: a.SocialLinks,
		CreatedAt:   a.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   a.UpdatedAt.Format(time.RFC3339),
	}
}

// StageResponse represents the API response for a stage
type StageResponse struct {
	ID         uuid.UUID     `json:"id"`
	FestivalID uuid.UUID     `json:"festivalId"`
	Name       string        `json:"name"`
	Location   string        `json:"location"`
	Capacity   int           `json:"capacity"`
	Settings   StageSettings `json:"settings"`
	CreatedAt  string        `json:"createdAt"`
	UpdatedAt  string        `json:"updatedAt"`
}

func (s *Stage) ToResponse() StageResponse {
	return StageResponse{
		ID:         s.ID,
		FestivalID: s.FestivalID,
		Name:       s.Name,
		Location:   s.Location,
		Capacity:   s.Capacity,
		Settings:   s.Settings,
		CreatedAt:  s.CreatedAt.Format(time.RFC3339),
		UpdatedAt:  s.UpdatedAt.Format(time.RFC3339),
	}
}

// PerformanceResponse represents the API response for a performance
type PerformanceResponse struct {
	ID         uuid.UUID         `json:"id"`
	FestivalID uuid.UUID         `json:"festivalId"`
	ArtistID   uuid.UUID         `json:"artistId"`
	StageID    uuid.UUID         `json:"stageId"`
	StartTime  string            `json:"startTime"`
	EndTime    string            `json:"endTime"`
	Day        string            `json:"day"`
	Status     PerformanceStatus `json:"status"`
	Artist     *ArtistResponse   `json:"artist,omitempty"`
	Stage      *StageResponse    `json:"stage,omitempty"`
	CreatedAt  string            `json:"createdAt"`
	UpdatedAt  string            `json:"updatedAt"`
}

func (p *Performance) ToResponse() PerformanceResponse {
	resp := PerformanceResponse{
		ID:         p.ID,
		FestivalID: p.FestivalID,
		ArtistID:   p.ArtistID,
		StageID:    p.StageID,
		StartTime:  p.StartTime.Format(time.RFC3339),
		EndTime:    p.EndTime.Format(time.RFC3339),
		Day:        p.Day,
		Status:     p.Status,
		CreatedAt:  p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:  p.UpdatedAt.Format(time.RFC3339),
	}

	if p.Artist != nil {
		artistResp := p.Artist.ToResponse()
		resp.Artist = &artistResp
	}

	if p.Stage != nil {
		stageResp := p.Stage.ToResponse()
		resp.Stage = &stageResp
	}

	return resp
}

// LineupResponse represents the full lineup for a festival
type LineupResponse struct {
	FestivalID   uuid.UUID              `json:"festivalId"`
	Days         []string               `json:"days"`
	Stages       []StageResponse        `json:"stages"`
	Schedule     map[string][]DaySlot   `json:"schedule"` // day -> slots
}

// DaySlot represents a time slot in the schedule
type DaySlot struct {
	Stage        StageResponse         `json:"stage"`
	Performances []PerformanceResponse `json:"performances"`
}

// DayScheduleResponse represents the schedule for a specific day
type DayScheduleResponse struct {
	Day          string                `json:"day"`
	Stages       []StageResponse       `json:"stages"`
	Performances []PerformanceResponse `json:"performances"`
}
