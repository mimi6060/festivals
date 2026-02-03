package media

import (
	"time"

	"github.com/google/uuid"
)

// Media represents a stored media file
type Media struct {
	ID         uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID *uuid.UUID `json:"festivalId,omitempty" gorm:"type:uuid;index"`
	Type       MediaType  `json:"type" gorm:"not null"`
	URL        string     `json:"url" gorm:"not null"`
	Filename   string     `json:"filename" gorm:"not null"`
	OriginalName string   `json:"originalName"`
	Size       int64      `json:"size" gorm:"not null"`
	MimeType   string     `json:"mimeType" gorm:"not null"`
	Width      int        `json:"width,omitempty"`
	Height     int        `json:"height,omitempty"`
	Bucket     string     `json:"bucket,omitempty"`
	Key        string     `json:"key,omitempty"`
	Thumbnails Thumbnails `json:"thumbnails,omitempty" gorm:"type:jsonb;default:'{}'"`
	Metadata   Metadata   `json:"metadata,omitempty" gorm:"type:jsonb;default:'{}'"`
	UploadedBy *uuid.UUID `json:"uploadedBy,omitempty" gorm:"type:uuid"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
}

func (Media) TableName() string {
	return "public.media"
}

// MediaType represents the type of media
type MediaType string

const (
	MediaTypeImage    MediaType = "IMAGE"
	MediaTypeDocument MediaType = "DOCUMENT"
	MediaTypeExport   MediaType = "EXPORT"
	MediaTypeVideo    MediaType = "VIDEO"
	MediaTypeAudio    MediaType = "AUDIO"
)

// IsValid checks if the media type is valid
func (t MediaType) IsValid() bool {
	switch t {
	case MediaTypeImage, MediaTypeDocument, MediaTypeExport, MediaTypeVideo, MediaTypeAudio:
		return true
	default:
		return false
	}
}

// String returns the string representation of the media type
func (t MediaType) String() string {
	return string(t)
}

// Thumbnails holds URLs for different thumbnail sizes
type Thumbnails struct {
	Small  string `json:"small,omitempty"`
	Medium string `json:"medium,omitempty"`
	Large  string `json:"large,omitempty"`
}

// Metadata holds additional metadata for the media
type Metadata struct {
	Alt         string            `json:"alt,omitempty"`
	Description string            `json:"description,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	Custom      map[string]string `json:"custom,omitempty"`
}

// UploadMediaRequest represents the request to upload media
type UploadMediaRequest struct {
	FestivalID  *uuid.UUID `json:"festivalId,omitempty"`
	Type        MediaType  `json:"type" binding:"required"`
	Alt         string     `json:"alt,omitempty"`
	Description string     `json:"description,omitempty"`
}

// UpdateMediaRequest represents the request to update media metadata
type UpdateMediaRequest struct {
	Alt         *string   `json:"alt,omitempty"`
	Description *string   `json:"description,omitempty"`
	Tags        *[]string `json:"tags,omitempty"`
}

// MediaResponse represents the API response for media
type MediaResponse struct {
	ID           uuid.UUID   `json:"id"`
	FestivalID   *uuid.UUID  `json:"festivalId,omitempty"`
	Type         MediaType   `json:"type"`
	URL          string      `json:"url"`
	Filename     string      `json:"filename"`
	OriginalName string      `json:"originalName"`
	Size         int64       `json:"size"`
	MimeType     string      `json:"mimeType"`
	Width        int         `json:"width,omitempty"`
	Height       int         `json:"height,omitempty"`
	Thumbnails   Thumbnails  `json:"thumbnails,omitempty"`
	Metadata     Metadata    `json:"metadata,omitempty"`
	UploadedBy   *uuid.UUID  `json:"uploadedBy,omitempty"`
	CreatedAt    string      `json:"createdAt"`
}

// ToResponse converts Media to MediaResponse
func (m *Media) ToResponse() MediaResponse {
	return MediaResponse{
		ID:           m.ID,
		FestivalID:   m.FestivalID,
		Type:         m.Type,
		URL:          m.URL,
		Filename:     m.Filename,
		OriginalName: m.OriginalName,
		Size:         m.Size,
		MimeType:     m.MimeType,
		Width:        m.Width,
		Height:       m.Height,
		Thumbnails:   m.Thumbnails,
		Metadata:     m.Metadata,
		UploadedBy:   m.UploadedBy,
		CreatedAt:    m.CreatedAt.Format(time.RFC3339),
	}
}

// MediaFilter represents filter options for listing media
type MediaFilter struct {
	FestivalID *uuid.UUID
	Type       *MediaType
	MimeType   *string
	UploadedBy *uuid.UUID
}

// ImageConfig holds configuration for image processing
type ImageConfig struct {
	MaxWidth         int
	MaxHeight        int
	Quality          int
	GenerateThumbs   bool
	ThumbnailSizes   []ThumbnailConfig
	AllowedMimeTypes []string
	MaxFileSize      int64
}

// ThumbnailConfig holds configuration for a thumbnail size
type ThumbnailConfig struct {
	Name   string
	Width  int
	Height int
}

// DefaultImageConfig returns default image configuration
func DefaultImageConfig() ImageConfig {
	return ImageConfig{
		MaxWidth:       2048,
		MaxHeight:      2048,
		Quality:        85,
		GenerateThumbs: true,
		ThumbnailSizes: []ThumbnailConfig{
			{Name: "small", Width: 150, Height: 150},
			{Name: "medium", Width: 300, Height: 300},
			{Name: "large", Width: 600, Height: 600},
		},
		AllowedMimeTypes: []string{
			"image/jpeg",
			"image/png",
			"image/gif",
			"image/webp",
		},
		MaxFileSize: 10 * 1024 * 1024, // 10MB
	}
}

// DocumentConfig holds configuration for document uploads
type DocumentConfig struct {
	AllowedMimeTypes []string
	MaxFileSize      int64
}

// DefaultDocumentConfig returns default document configuration
func DefaultDocumentConfig() DocumentConfig {
	return DocumentConfig{
		AllowedMimeTypes: []string{
			"application/pdf",
			"application/msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/vnd.ms-excel",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"text/csv",
			"text/plain",
		},
		MaxFileSize: 50 * 1024 * 1024, // 50MB
	}
}

// ExportConfig holds configuration for export files
type ExportConfig struct {
	AllowedMimeTypes []string
	MaxFileSize      int64
}

// DefaultExportConfig returns default export configuration
func DefaultExportConfig() ExportConfig {
	return ExportConfig{
		AllowedMimeTypes: []string{
			"application/pdf",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"text/csv",
			"application/json",
			"application/zip",
		},
		MaxFileSize: 100 * 1024 * 1024, // 100MB
	}
}

// ============================================
// Archives & Souvenirs (Photos/Videos) Models
// ============================================

// MediaItem represents a photo or video uploaded by a festivalier or staff
type MediaItem struct {
	ID           uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID   uuid.UUID       `json:"festivalId" gorm:"type:uuid;not null;index"`
	UploaderID   uuid.UUID       `json:"uploaderId" gorm:"type:uuid;not null;index"`
	Type         MediaItemType   `json:"type" gorm:"not null"`
	URL          string          `json:"url" gorm:"not null"`
	ThumbnailURL string          `json:"thumbnailUrl,omitempty"`
	Filename     string          `json:"filename" gorm:"not null"`
	OriginalName string          `json:"originalName"`
	Size         int64           `json:"size" gorm:"not null"`
	MimeType     string          `json:"mimeType" gorm:"not null"`
	Width        int             `json:"width,omitempty"`
	Height       int             `json:"height,omitempty"`
	Duration     int             `json:"duration,omitempty"` // Video duration in seconds
	Bucket       string          `json:"bucket,omitempty"`
	Key          string          `json:"key,omitempty"`
	Tags         []string        `json:"tags" gorm:"type:text[];serializer:json"`
	Location     *MediaLocation  `json:"location,omitempty" gorm:"type:jsonb"`
	ItemMetadata MediaItemMeta   `json:"metadata" gorm:"type:jsonb;default:'{}'"`
	Status       ModerationStatus `json:"status" gorm:"default:'PENDING'"`
	ModeratedBy  *uuid.UUID      `json:"moderatedBy,omitempty" gorm:"type:uuid"`
	ModeratedAt  *time.Time      `json:"moderatedAt,omitempty"`
	Watermarked  bool            `json:"watermarked" gorm:"default:false"`
	ViewCount    int64           `json:"viewCount" gorm:"default:0"`
	LikeCount    int64           `json:"likeCount" gorm:"default:0"`
	CreatedAt    time.Time       `json:"createdAt"`
	UpdatedAt    time.Time       `json:"updatedAt"`
}

func (MediaItem) TableName() string {
	return "media_items"
}

// MediaItemType represents the type of media item
type MediaItemType string

const (
	MediaItemTypePhoto MediaItemType = "PHOTO"
	MediaItemTypeVideo MediaItemType = "VIDEO"
)

// IsValid checks if the media item type is valid
func (t MediaItemType) IsValid() bool {
	switch t {
	case MediaItemTypePhoto, MediaItemTypeVideo:
		return true
	default:
		return false
	}
}

// ModerationStatus represents the moderation state of a media item
type ModerationStatus string

const (
	ModerationStatusPending  ModerationStatus = "PENDING"
	ModerationStatusApproved ModerationStatus = "APPROVED"
	ModerationStatusRejected ModerationStatus = "REJECTED"
	ModerationStatusFlagged  ModerationStatus = "FLAGGED"
)

// MediaLocation stores GPS coordinates and location info
type MediaLocation struct {
	Latitude  float64 `json:"latitude,omitempty"`
	Longitude float64 `json:"longitude,omitempty"`
	StageName string  `json:"stageName,omitempty"`
	Zone      string  `json:"zone,omitempty"`
}

// MediaItemMeta holds additional metadata for a media item
type MediaItemMeta struct {
	ArtistID      *uuid.UUID `json:"artistId,omitempty"`
	ArtistName    string     `json:"artistName,omitempty"`
	PerformanceID *uuid.UUID `json:"performanceId,omitempty"`
	Day           int        `json:"day,omitempty"` // Day of the festival (1, 2, 3...)
	CapturedAt    *time.Time `json:"capturedAt,omitempty"`
	Camera        string     `json:"camera,omitempty"`
	Description   string     `json:"description,omitempty"`
}

// Album represents a collection of media items
type Album struct {
	ID          uuid.UUID   `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID  uuid.UUID   `json:"festivalId" gorm:"type:uuid;not null;index"`
	Name        string      `json:"name" gorm:"not null"`
	Description string      `json:"description"`
	CoverURL    string      `json:"coverUrl,omitempty"`
	Type        AlbumType   `json:"type" gorm:"default:'GENERAL'"`
	Visibility  Visibility  `json:"visibility" gorm:"default:'PUBLIC'"`
	SortOrder   int         `json:"sortOrder" gorm:"default:0"`
	ItemCount   int         `json:"itemCount" gorm:"default:0"`
	CreatedBy   uuid.UUID   `json:"createdBy" gorm:"type:uuid;not null"`
	CreatedAt   time.Time   `json:"createdAt"`
	UpdatedAt   time.Time   `json:"updatedAt"`
}

func (Album) TableName() string {
	return "albums"
}

// AlbumType represents the category of an album
type AlbumType string

const (
	AlbumTypeGeneral     AlbumType = "GENERAL"
	AlbumTypeDaily       AlbumType = "DAILY"       // Per-day album
	AlbumTypeStage       AlbumType = "STAGE"       // Per-stage album
	AlbumTypeArtist      AlbumType = "ARTIST"      // Per-artist album
	AlbumTypeOfficial    AlbumType = "OFFICIAL"    // Official festival photos
	AlbumTypeUserCreated AlbumType = "USER_CREATED" // User-created albums
)

// Visibility represents the visibility of content
type Visibility string

const (
	VisibilityPublic   Visibility = "PUBLIC"
	VisibilityPrivate  Visibility = "PRIVATE"
	VisibilityUnlisted Visibility = "UNLISTED" // Accessible via link only
)

// AlbumItem represents the relationship between albums and media items
type AlbumItem struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	AlbumID     uuid.UUID `json:"albumId" gorm:"type:uuid;not null;index"`
	MediaItemID uuid.UUID `json:"mediaItemId" gorm:"type:uuid;not null;index"`
	SortOrder   int       `json:"sortOrder" gorm:"default:0"`
	AddedAt     time.Time `json:"addedAt"`
}

func (AlbumItem) TableName() string {
	return "album_items"
}

// MediaShare represents a share of media (public link, social share, etc.)
type MediaShare struct {
	ID          uuid.UUID   `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	MediaItemID *uuid.UUID  `json:"mediaItemId,omitempty" gorm:"type:uuid;index"`
	AlbumID     *uuid.UUID  `json:"albumId,omitempty" gorm:"type:uuid;index"`
	UserID      uuid.UUID   `json:"userId" gorm:"type:uuid;not null;index"`
	ShareCode   string      `json:"shareCode" gorm:"unique;not null;index"`
	Visibility  Visibility  `json:"visibility" gorm:"default:'PUBLIC'"`
	ExpiresAt   *time.Time  `json:"expiresAt,omitempty"`
	ViewCount   int64       `json:"viewCount" gorm:"default:0"`
	Platform    string      `json:"platform,omitempty"` // facebook, twitter, instagram, etc.
	CreatedAt   time.Time   `json:"createdAt"`
}

func (MediaShare) TableName() string {
	return "media_shares"
}

// MediaLike represents a like on a media item
type MediaLike struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	MediaItemID uuid.UUID `json:"mediaItemId" gorm:"type:uuid;not null;index:idx_media_likes_unique,unique"`
	UserID      uuid.UUID `json:"userId" gorm:"type:uuid;not null;index:idx_media_likes_unique,unique"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (MediaLike) TableName() string {
	return "media_likes"
}

// SouvenirPDF represents a generated souvenir PDF for a user
type SouvenirPDF struct {
	ID         uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID uuid.UUID `json:"festivalId" gorm:"type:uuid;not null;index"`
	UserID     uuid.UUID `json:"userId" gorm:"type:uuid;not null;index"`
	URL        string    `json:"url" gorm:"not null"`
	Filename   string    `json:"filename" gorm:"not null"`
	Size       int64     `json:"size"`
	Status     string    `json:"status" gorm:"default:'GENERATING'"`
	Error      string    `json:"error,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

func (SouvenirPDF) TableName() string {
	return "souvenir_pdfs"
}

// ============================================
// Request/Response types for Archives
// ============================================

// UploadMediaItemRequest represents the request to upload a media item
type UploadMediaItemRequest struct {
	FestivalID  uuid.UUID      `json:"festivalId" binding:"required"`
	Type        MediaItemType  `json:"type" binding:"required"`
	Tags        []string       `json:"tags,omitempty"`
	Description string         `json:"description,omitempty"`
	ArtistID    *uuid.UUID     `json:"artistId,omitempty"`
	StageName   string         `json:"stageName,omitempty"`
	Day         int            `json:"day,omitempty"`
	Location    *MediaLocation `json:"location,omitempty"`
}

// CreateAlbumRequest represents the request to create an album
type CreateAlbumRequest struct {
	FestivalID  uuid.UUID  `json:"festivalId" binding:"required"`
	Name        string     `json:"name" binding:"required"`
	Description string     `json:"description,omitempty"`
	Type        AlbumType  `json:"type,omitempty"`
	Visibility  Visibility `json:"visibility,omitempty"`
}

// UpdateAlbumRequest represents the request to update an album
type UpdateAlbumRequest struct {
	Name        *string     `json:"name,omitempty"`
	Description *string     `json:"description,omitempty"`
	CoverURL    *string     `json:"coverUrl,omitempty"`
	Visibility  *Visibility `json:"visibility,omitempty"`
	SortOrder   *int        `json:"sortOrder,omitempty"`
}

// AddToAlbumRequest represents the request to add media to an album
type AddToAlbumRequest struct {
	MediaItemIDs []uuid.UUID `json:"mediaItemIds" binding:"required"`
}

// GalleryFilter represents filter options for gallery listing
type GalleryFilter struct {
	FestivalID *uuid.UUID
	Type       *MediaItemType
	Status     *ModerationStatus
	Tags       []string
	ArtistID   *uuid.UUID
	Day        *int
	StageName  *string
	UploaderID *uuid.UUID
	AlbumID    *uuid.UUID
}

// ShareMediaRequest represents the request to share media
type ShareMediaRequest struct {
	MediaItemID *uuid.UUID `json:"mediaItemId,omitempty"`
	AlbumID     *uuid.UUID `json:"albumId,omitempty"`
	Visibility  Visibility `json:"visibility,omitempty"`
	ExpiresIn   int        `json:"expiresIn,omitempty"` // Hours until expiration, 0 = never
	Platform    string     `json:"platform,omitempty"`
}

// ModerateMediaRequest represents the request to moderate a media item
type ModerateMediaRequest struct {
	Status ModerationStatus `json:"status" binding:"required"`
	Reason string           `json:"reason,omitempty"`
}

// GenerateSouvenirRequest represents the request to generate a souvenir PDF
type GenerateSouvenirRequest struct {
	FestivalID      uuid.UUID   `json:"festivalId" binding:"required"`
	IncludeTickets  bool        `json:"includeTickets"`
	IncludePhotos   bool        `json:"includePhotos"`
	IncludeSchedule bool        `json:"includeSchedule"`
	PhotoIDs        []uuid.UUID `json:"photoIds,omitempty"` // Specific photos to include
}

// ============================================
// Response types for Archives
// ============================================

// MediaItemResponse represents the API response for a media item
type MediaItemResponse struct {
	ID           uuid.UUID        `json:"id"`
	FestivalID   uuid.UUID        `json:"festivalId"`
	UploaderID   uuid.UUID        `json:"uploaderId"`
	UploaderName string           `json:"uploaderName,omitempty"`
	Type         MediaItemType    `json:"type"`
	URL          string           `json:"url"`
	ThumbnailURL string           `json:"thumbnailUrl,omitempty"`
	OriginalName string           `json:"originalName"`
	Size         int64            `json:"size"`
	Width        int              `json:"width,omitempty"`
	Height       int              `json:"height,omitempty"`
	Duration     int              `json:"duration,omitempty"`
	Tags         []string         `json:"tags"`
	Location     *MediaLocation   `json:"location,omitempty"`
	Metadata     MediaItemMeta    `json:"metadata"`
	Status       ModerationStatus `json:"status"`
	ViewCount    int64            `json:"viewCount"`
	LikeCount    int64            `json:"likeCount"`
	IsLiked      bool             `json:"isLiked,omitempty"`
	CreatedAt    string           `json:"createdAt"`
}

// ToResponse converts MediaItem to MediaItemResponse
func (m *MediaItem) ToResponse() MediaItemResponse {
	return MediaItemResponse{
		ID:           m.ID,
		FestivalID:   m.FestivalID,
		UploaderID:   m.UploaderID,
		Type:         m.Type,
		URL:          m.URL,
		ThumbnailURL: m.ThumbnailURL,
		OriginalName: m.OriginalName,
		Size:         m.Size,
		Width:        m.Width,
		Height:       m.Height,
		Duration:     m.Duration,
		Tags:         m.Tags,
		Location:     m.Location,
		Metadata:     m.ItemMetadata,
		Status:       m.Status,
		ViewCount:    m.ViewCount,
		LikeCount:    m.LikeCount,
		CreatedAt:    m.CreatedAt.Format(time.RFC3339),
	}
}

// AlbumResponse represents the API response for an album
type AlbumResponse struct {
	ID          uuid.UUID  `json:"id"`
	FestivalID  uuid.UUID  `json:"festivalId"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	CoverURL    string     `json:"coverUrl,omitempty"`
	Type        AlbumType  `json:"type"`
	Visibility  Visibility `json:"visibility"`
	ItemCount   int        `json:"itemCount"`
	CreatedBy   uuid.UUID  `json:"createdBy"`
	CreatedAt   string     `json:"createdAt"`
}

// ToResponse converts Album to AlbumResponse
func (a *Album) ToResponse() AlbumResponse {
	return AlbumResponse{
		ID:          a.ID,
		FestivalID:  a.FestivalID,
		Name:        a.Name,
		Description: a.Description,
		CoverURL:    a.CoverURL,
		Type:        a.Type,
		Visibility:  a.Visibility,
		ItemCount:   a.ItemCount,
		CreatedBy:   a.CreatedBy,
		CreatedAt:   a.CreatedAt.Format(time.RFC3339),
	}
}

// MediaShareResponse represents the API response for a media share
type MediaShareResponse struct {
	ID          uuid.UUID  `json:"id"`
	MediaItemID *uuid.UUID `json:"mediaItemId,omitempty"`
	AlbumID     *uuid.UUID `json:"albumId,omitempty"`
	ShareCode   string     `json:"shareCode"`
	ShareURL    string     `json:"shareUrl"`
	Visibility  Visibility `json:"visibility"`
	ExpiresAt   *string    `json:"expiresAt,omitempty"`
	ViewCount   int64      `json:"viewCount"`
	CreatedAt   string     `json:"createdAt"`
}

// ToResponse converts MediaShare to MediaShareResponse
func (s *MediaShare) ToResponse(baseURL string) MediaShareResponse {
	var expiresAt *string
	if s.ExpiresAt != nil {
		formatted := s.ExpiresAt.Format(time.RFC3339)
		expiresAt = &formatted
	}

	return MediaShareResponse{
		ID:          s.ID,
		MediaItemID: s.MediaItemID,
		AlbumID:     s.AlbumID,
		ShareCode:   s.ShareCode,
		ShareURL:    baseURL + "/share/" + s.ShareCode,
		Visibility:  s.Visibility,
		ExpiresAt:   expiresAt,
		ViewCount:   s.ViewCount,
		CreatedAt:   s.CreatedAt.Format(time.RFC3339),
	}
}

// SouvenirPDFResponse represents the API response for a souvenir PDF
type SouvenirPDFResponse struct {
	ID         uuid.UUID `json:"id"`
	FestivalID uuid.UUID `json:"festivalId"`
	URL        string    `json:"url,omitempty"`
	Status     string    `json:"status"`
	Error      string    `json:"error,omitempty"`
	CreatedAt  string    `json:"createdAt"`
	ExpiresAt  string    `json:"expiresAt,omitempty"`
}

// ToResponse converts SouvenirPDF to SouvenirPDFResponse
func (p *SouvenirPDF) ToResponse() SouvenirPDFResponse {
	resp := SouvenirPDFResponse{
		ID:         p.ID,
		FestivalID: p.FestivalID,
		Status:     p.Status,
		Error:      p.Error,
		CreatedAt:  p.CreatedAt.Format(time.RFC3339),
	}
	if p.Status == "COMPLETED" {
		resp.URL = p.URL
		resp.ExpiresAt = p.ExpiresAt.Format(time.RFC3339)
	}
	return resp
}

// VideoConfig holds configuration for video uploads
type VideoConfig struct {
	AllowedMimeTypes []string
	MaxFileSize      int64
	MaxDuration      int // Max duration in seconds
}

// DefaultVideoConfig returns default video configuration
func DefaultVideoConfig() VideoConfig {
	return VideoConfig{
		AllowedMimeTypes: []string{
			"video/mp4",
			"video/quicktime",
			"video/x-msvideo",
			"video/webm",
		},
		MaxFileSize: 500 * 1024 * 1024, // 500MB
		MaxDuration: 180,               // 3 minutes
	}
}
