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
