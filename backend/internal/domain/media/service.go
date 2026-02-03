package media

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/storage"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/rs/zerolog/log"
)

// Service handles media operations
type Service struct {
	repo           Repository
	storage        storage.Storage
	imageProcessor *storage.ImageProcessor
	imageConfig    ImageConfig
	docConfig      DocumentConfig
	exportConfig   ExportConfig
	defaultBucket  string
}

// NewService creates a new media service
func NewService(repo Repository, storageClient storage.Storage, defaultBucket string) *Service {
	return &Service{
		repo:           repo,
		storage:        storageClient,
		imageProcessor: storage.NewImageProcessor(),
		imageConfig:    DefaultImageConfig(),
		docConfig:      DefaultDocumentConfig(),
		exportConfig:   DefaultExportConfig(),
		defaultBucket:  defaultBucket,
	}
}

// UploadImage uploads and processes an image file
func (s *Service) UploadImage(ctx context.Context, file *multipart.FileHeader, festivalID *uuid.UUID, uploadedBy *uuid.UUID) (*Media, error) {
	// Validate file size
	if file.Size > s.imageConfig.MaxFileSize {
		return nil, errors.New("FILE_TOO_LARGE", fmt.Sprintf("Image file size exceeds maximum allowed size of %d bytes", s.imageConfig.MaxFileSize))
	}

	// Validate mime type
	contentType := file.Header.Get("Content-Type")
	if !s.isAllowedImageType(contentType) {
		return nil, errors.New("INVALID_FILE_TYPE", "File type not allowed. Allowed types: JPEG, PNG, GIF, WebP")
	}

	// Open the file
	src, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer src.Close()

	// Read file content
	fileData, err := io.ReadAll(src)
	if err != nil {
		return nil, fmt.Errorf("failed to read uploaded file: %w", err)
	}

	// Process and optimize the image
	optimizedBuf, format, err := s.imageProcessor.OptimizeImage(
		bytes.NewReader(fileData),
		s.imageConfig.MaxWidth,
		s.imageConfig.MaxHeight,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to optimize image: %w", err)
	}

	// Get image dimensions
	width, height, err := s.imageProcessor.GetImageDimensions(bytes.NewReader(optimizedBuf.Bytes()))
	if err != nil {
		log.Warn().Err(err).Msg("Failed to get image dimensions")
	}

	// Generate unique filename
	mediaID := uuid.New()
	ext := s.getExtensionForFormat(format)
	filename := fmt.Sprintf("%s%s", mediaID.String(), ext)
	objectKey := s.buildObjectKey(festivalID, MediaTypeImage, filename)

	// Upload to storage
	uploadOpts := storage.UploadOptions{
		ContentType: storage.GetContentType(format),
		Metadata: map[string]string{
			"original_name": file.Filename,
			"uploaded_by":   uploadedBy.String(),
		},
	}

	fileInfo, err := s.storage.Upload(ctx, s.defaultBucket, objectKey, optimizedBuf, int64(optimizedBuf.Len()), uploadOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to upload image: %w", err)
	}

	// Generate thumbnails
	var thumbnails Thumbnails
	if s.imageConfig.GenerateThumbs {
		thumbnails, err = s.generateAndUploadThumbnails(ctx, bytes.NewReader(fileData), festivalID, mediaID, format)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to generate thumbnails")
		}
	}

	// Create media record
	media := &Media{
		ID:           mediaID,
		FestivalID:   festivalID,
		Type:         MediaTypeImage,
		URL:          fileInfo.URL,
		Filename:     filename,
		OriginalName: file.Filename,
		Size:         int64(optimizedBuf.Len()),
		MimeType:     storage.GetContentType(format),
		Width:        width,
		Height:       height,
		Bucket:       s.defaultBucket,
		Key:          objectKey,
		Thumbnails:   thumbnails,
		UploadedBy:   uploadedBy,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.repo.Create(ctx, media); err != nil {
		// Cleanup uploaded file on database error
		_ = s.storage.Delete(ctx, s.defaultBucket, objectKey)
		return nil, fmt.Errorf("failed to save media record: %w", err)
	}

	log.Info().
		Str("media_id", media.ID.String()).
		Str("filename", filename).
		Int64("size", media.Size).
		Msg("Image uploaded successfully")

	return media, nil
}

// UploadDocument uploads a document file
func (s *Service) UploadDocument(ctx context.Context, file *multipart.FileHeader, festivalID *uuid.UUID, uploadedBy *uuid.UUID) (*Media, error) {
	// Validate file size
	if file.Size > s.docConfig.MaxFileSize {
		return nil, errors.New("FILE_TOO_LARGE", fmt.Sprintf("Document file size exceeds maximum allowed size of %d bytes", s.docConfig.MaxFileSize))
	}

	// Validate mime type
	contentType := file.Header.Get("Content-Type")
	if !s.isAllowedDocumentType(contentType) {
		return nil, errors.New("INVALID_FILE_TYPE", "Document type not allowed")
	}

	// Open the file
	src, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer src.Close()

	// Generate unique filename
	mediaID := uuid.New()
	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s%s", mediaID.String(), ext)
	objectKey := s.buildObjectKey(festivalID, MediaTypeDocument, filename)

	// Upload to storage
	uploadOpts := storage.UploadOptions{
		ContentType: contentType,
		Metadata: map[string]string{
			"original_name": file.Filename,
			"uploaded_by":   uploadedBy.String(),
		},
	}

	fileInfo, err := s.storage.Upload(ctx, s.defaultBucket, objectKey, src, file.Size, uploadOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to upload document: %w", err)
	}

	// Create media record
	media := &Media{
		ID:           mediaID,
		FestivalID:   festivalID,
		Type:         MediaTypeDocument,
		URL:          fileInfo.URL,
		Filename:     filename,
		OriginalName: file.Filename,
		Size:         file.Size,
		MimeType:     contentType,
		Bucket:       s.defaultBucket,
		Key:          objectKey,
		UploadedBy:   uploadedBy,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.repo.Create(ctx, media); err != nil {
		// Cleanup uploaded file on database error
		_ = s.storage.Delete(ctx, s.defaultBucket, objectKey)
		return nil, fmt.Errorf("failed to save media record: %w", err)
	}

	log.Info().
		Str("media_id", media.ID.String()).
		Str("filename", filename).
		Int64("size", media.Size).
		Msg("Document uploaded successfully")

	return media, nil
}

// UploadExport uploads an export file (CSV, Excel, etc.)
func (s *Service) UploadExport(ctx context.Context, reader io.Reader, filename string, contentType string, size int64, festivalID *uuid.UUID, uploadedBy *uuid.UUID) (*Media, error) {
	// Validate file size
	if size > s.exportConfig.MaxFileSize {
		return nil, errors.New("FILE_TOO_LARGE", fmt.Sprintf("Export file size exceeds maximum allowed size of %d bytes", s.exportConfig.MaxFileSize))
	}

	// Validate mime type
	if !s.isAllowedExportType(contentType) {
		return nil, errors.New("INVALID_FILE_TYPE", "Export type not allowed")
	}

	// Generate unique filename
	mediaID := uuid.New()
	ext := filepath.Ext(filename)
	newFilename := fmt.Sprintf("%s%s", mediaID.String(), ext)
	objectKey := s.buildObjectKey(festivalID, MediaTypeExport, newFilename)

	// Upload to storage
	uploadOpts := storage.UploadOptions{
		ContentType: contentType,
		Metadata: map[string]string{
			"original_name": filename,
		},
	}

	if uploadedBy != nil {
		uploadOpts.Metadata["uploaded_by"] = uploadedBy.String()
	}

	fileInfo, err := s.storage.Upload(ctx, s.defaultBucket, objectKey, reader, size, uploadOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to upload export: %w", err)
	}

	// Create media record
	media := &Media{
		ID:           mediaID,
		FestivalID:   festivalID,
		Type:         MediaTypeExport,
		URL:          fileInfo.URL,
		Filename:     newFilename,
		OriginalName: filename,
		Size:         size,
		MimeType:     contentType,
		Bucket:       s.defaultBucket,
		Key:          objectKey,
		UploadedBy:   uploadedBy,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.repo.Create(ctx, media); err != nil {
		// Cleanup uploaded file on database error
		_ = s.storage.Delete(ctx, s.defaultBucket, objectKey)
		return nil, fmt.Errorf("failed to save media record: %w", err)
	}

	log.Info().
		Str("media_id", media.ID.String()).
		Str("filename", newFilename).
		Int64("size", media.Size).
		Msg("Export uploaded successfully")

	return media, nil
}

// DeleteMedia deletes a media file and its record
func (s *Service) DeleteMedia(ctx context.Context, id uuid.UUID) error {
	media, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if media == nil {
		return errors.ErrNotFound
	}

	// Delete from storage
	if err := s.storage.Delete(ctx, media.Bucket, media.Key); err != nil {
		log.Warn().Err(err).Str("key", media.Key).Msg("Failed to delete main file from storage")
	}

	// Delete thumbnails if they exist
	if media.Thumbnails.Small != "" {
		_ = s.storage.Delete(ctx, media.Bucket, s.buildThumbnailKey(media.Key, "small"))
	}
	if media.Thumbnails.Medium != "" {
		_ = s.storage.Delete(ctx, media.Bucket, s.buildThumbnailKey(media.Key, "medium"))
	}
	if media.Thumbnails.Large != "" {
		_ = s.storage.Delete(ctx, media.Bucket, s.buildThumbnailKey(media.Key, "large"))
	}

	// Delete database record
	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("failed to delete media record: %w", err)
	}

	log.Info().
		Str("media_id", id.String()).
		Msg("Media deleted successfully")

	return nil
}

// GetMedia retrieves a media record by ID
func (s *Service) GetMedia(ctx context.Context, id uuid.UUID) (*Media, error) {
	media, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if media == nil {
		return nil, errors.ErrNotFound
	}
	return media, nil
}

// GetMediaURL returns a signed URL for accessing the media
func (s *Service) GetMediaURL(ctx context.Context, id uuid.UUID, expiry time.Duration) (string, error) {
	media, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return "", err
	}
	if media == nil {
		return "", errors.ErrNotFound
	}

	signedURL, err := s.storage.GetSignedURL(ctx, media.Bucket, media.Key, expiry)
	if err != nil {
		return "", fmt.Errorf("failed to generate signed URL: %w", err)
	}

	return signedURL, nil
}

// ListMedia lists media with optional filters
func (s *Service) ListMedia(ctx context.Context, filter MediaFilter, page, perPage int) ([]Media, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.List(ctx, filter, offset, perPage)
}

// UpdateMetadata updates the metadata of a media record
func (s *Service) UpdateMetadata(ctx context.Context, id uuid.UUID, req UpdateMediaRequest) (*Media, error) {
	media, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if media == nil {
		return nil, errors.ErrNotFound
	}

	if req.Alt != nil {
		media.Metadata.Alt = *req.Alt
	}
	if req.Description != nil {
		media.Metadata.Description = *req.Description
	}
	if req.Tags != nil {
		media.Metadata.Tags = *req.Tags
	}

	media.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, media); err != nil {
		return nil, fmt.Errorf("failed to update media: %w", err)
	}

	return media, nil
}

// generateAndUploadThumbnails creates and uploads thumbnails for an image
func (s *Service) generateAndUploadThumbnails(ctx context.Context, reader io.Reader, festivalID *uuid.UUID, mediaID uuid.UUID, format storage.ImageFormat) (Thumbnails, error) {
	var thumbnails Thumbnails

	sizes := []storage.ThumbnailSize{
		storage.ThumbnailSmall,
		storage.ThumbnailMedium,
		storage.ThumbnailLarge,
	}

	thumbs, _, err := s.imageProcessor.GenerateMultipleThumbnails(reader, sizes)
	if err != nil {
		return thumbnails, fmt.Errorf("failed to generate thumbnails: %w", err)
	}

	ext := s.getExtensionForFormat(format)

	for name, buf := range thumbs {
		thumbFilename := fmt.Sprintf("%s_%s%s", mediaID.String(), name, ext)
		thumbKey := s.buildObjectKey(festivalID, MediaTypeImage, "thumbnails/"+thumbFilename)

		uploadOpts := storage.UploadOptions{
			ContentType: storage.GetContentType(format),
		}

		fileInfo, err := s.storage.Upload(ctx, s.defaultBucket, thumbKey, buf, int64(buf.Len()), uploadOpts)
		if err != nil {
			log.Warn().Err(err).Str("size", name).Msg("Failed to upload thumbnail")
			continue
		}

		switch name {
		case "small":
			thumbnails.Small = fileInfo.URL
		case "medium":
			thumbnails.Medium = fileInfo.URL
		case "large":
			thumbnails.Large = fileInfo.URL
		}
	}

	return thumbnails, nil
}

// buildObjectKey constructs the storage key for a file
func (s *Service) buildObjectKey(festivalID *uuid.UUID, mediaType MediaType, filename string) string {
	var parts []string

	if festivalID != nil {
		parts = append(parts, festivalID.String())
	} else {
		parts = append(parts, "global")
	}

	parts = append(parts, strings.ToLower(string(mediaType)), filename)

	return strings.Join(parts, "/")
}

// buildThumbnailKey constructs the storage key for a thumbnail
func (s *Service) buildThumbnailKey(originalKey, size string) string {
	dir := filepath.Dir(originalKey)
	base := filepath.Base(originalKey)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)

	return fmt.Sprintf("%s/thumbnails/%s_%s%s", dir, name, size, ext)
}

// getExtensionForFormat returns the file extension for an image format
func (s *Service) getExtensionForFormat(format storage.ImageFormat) string {
	switch format {
	case storage.ImageFormatJPEG:
		return ".jpg"
	case storage.ImageFormatPNG:
		return ".png"
	case storage.ImageFormatGIF:
		return ".gif"
	default:
		return ".jpg"
	}
}

// isAllowedImageType checks if the content type is an allowed image type
func (s *Service) isAllowedImageType(contentType string) bool {
	for _, allowed := range s.imageConfig.AllowedMimeTypes {
		if contentType == allowed {
			return true
		}
	}
	return false
}

// isAllowedDocumentType checks if the content type is an allowed document type
func (s *Service) isAllowedDocumentType(contentType string) bool {
	for _, allowed := range s.docConfig.AllowedMimeTypes {
		if contentType == allowed {
			return true
		}
	}
	return false
}

// isAllowedExportType checks if the content type is an allowed export type
func (s *Service) isAllowedExportType(contentType string) bool {
	for _, allowed := range s.exportConfig.AllowedMimeTypes {
		if contentType == allowed {
			return true
		}
	}
	return false
}
