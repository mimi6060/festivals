package media

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
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

// ArchiveService handles archive and souvenir operations
type ArchiveService struct {
	repo           ArchiveRepository
	storage        storage.Storage
	imageProcessor *storage.ImageProcessor
	imageConfig    ImageConfig
	videoConfig    VideoConfig
	defaultBucket  string
	baseURL        string
}

// NewArchiveService creates a new archive service
func NewArchiveService(repo ArchiveRepository, storageClient storage.Storage, defaultBucket, baseURL string) *ArchiveService {
	return &ArchiveService{
		repo:           repo,
		storage:        storageClient,
		imageProcessor: storage.NewImageProcessor(),
		imageConfig:    DefaultImageConfig(),
		videoConfig:    DefaultVideoConfig(),
		defaultBucket:  defaultBucket,
		baseURL:        baseURL,
	}
}

// ============================================
// Media Upload Operations
// ============================================

// UploadMedia uploads a photo or video to the archive
func (s *ArchiveService) UploadMedia(ctx context.Context, file *multipart.FileHeader, req UploadMediaItemRequest, uploaderID uuid.UUID) (*MediaItem, error) {
	// Validate request
	if !req.Type.IsValid() {
		return nil, errors.New("INVALID_TYPE", "Invalid media type. Must be PHOTO or VIDEO")
	}

	// Validate file based on type
	contentType := file.Header.Get("Content-Type")
	if req.Type == MediaItemTypePhoto {
		if file.Size > s.imageConfig.MaxFileSize {
			return nil, errors.New("FILE_TOO_LARGE", fmt.Sprintf("Photo size exceeds maximum of %d MB", s.imageConfig.MaxFileSize/(1024*1024)))
		}
		if !s.isAllowedImageType(contentType) {
			return nil, errors.New("INVALID_FILE_TYPE", "Invalid photo type. Allowed: JPEG, PNG, GIF, WebP")
		}
	} else {
		if file.Size > s.videoConfig.MaxFileSize {
			return nil, errors.New("FILE_TOO_LARGE", fmt.Sprintf("Video size exceeds maximum of %d MB", s.videoConfig.MaxFileSize/(1024*1024)))
		}
		if !s.isAllowedVideoType(contentType) {
			return nil, errors.New("INVALID_FILE_TYPE", "Invalid video type. Allowed: MP4, MOV, AVI, WebM")
		}
	}

	// Open file
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

	// Generate unique ID and filename
	mediaID := uuid.New()
	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s%s", mediaID.String(), ext)
	objectKey := s.buildArchiveKey(req.FestivalID, string(req.Type), filename)

	var width, height int
	var thumbnailURL string
	var processedBuf *bytes.Buffer

	// Process image
	if req.Type == MediaItemTypePhoto {
		// Optimize image
		optimizedBuf, format, err := s.imageProcessor.OptimizeImage(
			bytes.NewReader(fileData),
			s.imageConfig.MaxWidth,
			s.imageConfig.MaxHeight,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to optimize image: %w", err)
		}
		processedBuf = optimizedBuf

		// Get dimensions
		width, height, _ = s.imageProcessor.GetImageDimensions(bytes.NewReader(optimizedBuf.Bytes()))

		// Update content type based on processed format
		contentType = storage.GetContentType(format)

		// Generate thumbnail
		thumbnailURL, err = s.generateAndUploadThumbnail(ctx, bytes.NewReader(fileData), req.FestivalID, mediaID, format)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to generate thumbnail")
		}
	} else {
		processedBuf = bytes.NewBuffer(fileData)
	}

	// Upload to storage
	uploadOpts := storage.UploadOptions{
		ContentType: contentType,
		Metadata: map[string]string{
			"original_name": file.Filename,
			"uploader_id":   uploaderID.String(),
			"festival_id":   req.FestivalID.String(),
		},
	}

	fileInfo, err := s.storage.Upload(ctx, s.defaultBucket, objectKey, processedBuf, int64(processedBuf.Len()), uploadOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to upload media: %w", err)
	}

	// Create media item
	item := &MediaItem{
		ID:           mediaID,
		FestivalID:   req.FestivalID,
		UploaderID:   uploaderID,
		Type:         req.Type,
		URL:          fileInfo.URL,
		ThumbnailURL: thumbnailURL,
		Filename:     filename,
		OriginalName: file.Filename,
		Size:         int64(processedBuf.Len()),
		MimeType:     contentType,
		Width:        width,
		Height:       height,
		Bucket:       s.defaultBucket,
		Key:          objectKey,
		Tags:         req.Tags,
		Location:     req.Location,
		ItemMetadata: MediaItemMeta{
			ArtistID:    req.ArtistID,
			Day:         req.Day,
			Description: req.Description,
		},
		Status:    ModerationStatusPending,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if req.StageName != "" && item.Location == nil {
		item.Location = &MediaLocation{StageName: req.StageName}
	} else if req.StageName != "" && item.Location != nil {
		item.Location.StageName = req.StageName
	}

	if err := s.repo.CreateMediaItem(ctx, item); err != nil {
		// Cleanup on error
		_ = s.storage.Delete(ctx, s.defaultBucket, objectKey)
		return nil, fmt.Errorf("failed to save media item: %w", err)
	}

	log.Info().
		Str("media_id", item.ID.String()).
		Str("type", string(item.Type)).
		Str("festival_id", item.FestivalID.String()).
		Msg("Media uploaded successfully")

	return item, nil
}

// generateAndUploadThumbnail creates and uploads a thumbnail
func (s *ArchiveService) generateAndUploadThumbnail(ctx context.Context, reader io.Reader, festivalID, mediaID uuid.UUID, format storage.ImageFormat) (string, error) {
	thumb, _, err := s.imageProcessor.GenerateThumbnail(reader, storage.ThumbnailMedium)
	if err != nil {
		return "", err
	}

	ext := ".jpg"
	switch format {
	case storage.ImageFormatPNG:
		ext = ".png"
	case storage.ImageFormatGIF:
		ext = ".gif"
	}

	thumbFilename := fmt.Sprintf("%s_thumb%s", mediaID.String(), ext)
	thumbKey := s.buildArchiveKey(festivalID, "thumbnails", thumbFilename)

	uploadOpts := storage.UploadOptions{
		ContentType: storage.GetContentType(format),
	}

	fileInfo, err := s.storage.Upload(ctx, s.defaultBucket, thumbKey, thumb, int64(thumb.Len()), uploadOpts)
	if err != nil {
		return "", err
	}

	return fileInfo.URL, nil
}

// ============================================
// Album Operations
// ============================================

// CreateAlbum creates a new album
func (s *ArchiveService) CreateAlbum(ctx context.Context, req CreateAlbumRequest, createdBy uuid.UUID) (*Album, error) {
	album := &Album{
		ID:          uuid.New(),
		FestivalID:  req.FestivalID,
		Name:        req.Name,
		Description: req.Description,
		Type:        req.Type,
		Visibility:  req.Visibility,
		CreatedBy:   createdBy,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if album.Type == "" {
		album.Type = AlbumTypeGeneral
	}
	if album.Visibility == "" {
		album.Visibility = VisibilityPublic
	}

	if err := s.repo.CreateAlbum(ctx, album); err != nil {
		return nil, fmt.Errorf("failed to create album: %w", err)
	}

	log.Info().
		Str("album_id", album.ID.String()).
		Str("name", album.Name).
		Msg("Album created successfully")

	return album, nil
}

// GetAlbum retrieves an album by ID
func (s *ArchiveService) GetAlbum(ctx context.Context, id uuid.UUID) (*Album, error) {
	album, err := s.repo.GetAlbumByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if album == nil {
		return nil, errors.ErrNotFound
	}
	return album, nil
}

// ListAlbums lists albums for a festival
func (s *ArchiveService) ListAlbums(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]Album, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	return s.repo.ListAlbums(ctx, festivalID, offset, perPage)
}

// UpdateAlbum updates an album
func (s *ArchiveService) UpdateAlbum(ctx context.Context, id uuid.UUID, req UpdateAlbumRequest) (*Album, error) {
	album, err := s.repo.GetAlbumByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if album == nil {
		return nil, errors.ErrNotFound
	}

	if req.Name != nil {
		album.Name = *req.Name
	}
	if req.Description != nil {
		album.Description = *req.Description
	}
	if req.CoverURL != nil {
		album.CoverURL = *req.CoverURL
	}
	if req.Visibility != nil {
		album.Visibility = *req.Visibility
	}
	if req.SortOrder != nil {
		album.SortOrder = *req.SortOrder
	}
	album.UpdatedAt = time.Now()

	if err := s.repo.UpdateAlbum(ctx, album); err != nil {
		return nil, fmt.Errorf("failed to update album: %w", err)
	}

	return album, nil
}

// DeleteAlbum deletes an album
func (s *ArchiveService) DeleteAlbum(ctx context.Context, id uuid.UUID) error {
	album, err := s.repo.GetAlbumByID(ctx, id)
	if err != nil {
		return err
	}
	if album == nil {
		return errors.ErrNotFound
	}

	return s.repo.DeleteAlbum(ctx, id)
}

// AddToAlbum adds media items to an album
func (s *ArchiveService) AddToAlbum(ctx context.Context, albumID uuid.UUID, mediaItemIDs []uuid.UUID) error {
	album, err := s.repo.GetAlbumByID(ctx, albumID)
	if err != nil {
		return err
	}
	if album == nil {
		return errors.ErrNotFound
	}

	for i, mediaID := range mediaItemIDs {
		item := &AlbumItem{
			ID:          uuid.New(),
			AlbumID:     albumID,
			MediaItemID: mediaID,
			SortOrder:   album.ItemCount + i,
			AddedAt:     time.Now(),
		}
		if err := s.repo.AddItemToAlbum(ctx, item); err != nil {
			log.Warn().Err(err).Str("media_id", mediaID.String()).Msg("Failed to add item to album")
		}
	}

	// Update item count
	if err := s.repo.UpdateAlbumItemCount(ctx, albumID); err != nil {
		log.Warn().Err(err).Msg("Failed to update album item count")
	}

	return nil
}

// RemoveFromAlbum removes a media item from an album
func (s *ArchiveService) RemoveFromAlbum(ctx context.Context, albumID, mediaItemID uuid.UUID) error {
	if err := s.repo.RemoveItemFromAlbum(ctx, albumID, mediaItemID); err != nil {
		return err
	}
	return s.repo.UpdateAlbumItemCount(ctx, albumID)
}

// GetAlbumItems retrieves items in an album
func (s *ArchiveService) GetAlbumItems(ctx context.Context, albumID uuid.UUID, page, perPage int) ([]MediaItem, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	return s.repo.GetAlbumItems(ctx, albumID, offset, perPage)
}

// ============================================
// Gallery Operations
// ============================================

// GetFestivalGallery retrieves the gallery for a festival with filters
func (s *ArchiveService) GetFestivalGallery(ctx context.Context, festivalID uuid.UUID, page, perPage int, filter GalleryFilter) ([]MediaItem, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	// Only show approved items in public gallery
	approved := ModerationStatusApproved
	filter.FestivalID = &festivalID
	filter.Status = &approved

	return s.repo.ListMediaItems(ctx, filter, offset, perPage)
}

// GetUserPhotos retrieves photos uploaded by a specific user
func (s *ArchiveService) GetUserPhotos(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, page, perPage int) ([]MediaItem, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	filter := GalleryFilter{
		UploaderID: &userID,
		FestivalID: festivalID,
	}

	return s.repo.ListMediaItems(ctx, filter, offset, perPage)
}

// GetMediaItem retrieves a single media item
func (s *ArchiveService) GetMediaItem(ctx context.Context, id uuid.UUID) (*MediaItem, error) {
	item, err := s.repo.GetMediaItemByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, errors.ErrNotFound
	}

	// Increment view count
	_ = s.repo.IncrementViewCount(ctx, id)

	return item, nil
}

// DeleteMediaItem deletes a media item
func (s *ArchiveService) DeleteMediaItem(ctx context.Context, id uuid.UUID, requestingUserID uuid.UUID, isAdmin bool) error {
	item, err := s.repo.GetMediaItemByID(ctx, id)
	if err != nil {
		return err
	}
	if item == nil {
		return errors.ErrNotFound
	}

	// Check permissions - only uploader or admin can delete
	if !isAdmin && item.UploaderID != requestingUserID {
		return errors.New("FORBIDDEN", "You don't have permission to delete this media")
	}

	// Delete from storage
	if err := s.storage.Delete(ctx, item.Bucket, item.Key); err != nil {
		log.Warn().Err(err).Str("key", item.Key).Msg("Failed to delete media from storage")
	}

	// Delete thumbnail if exists
	if item.ThumbnailURL != "" {
		thumbKey := s.buildArchiveKey(item.FestivalID, "thumbnails", fmt.Sprintf("%s_thumb%s", item.ID.String(), filepath.Ext(item.Filename)))
		_ = s.storage.Delete(ctx, item.Bucket, thumbKey)
	}

	return s.repo.DeleteMediaItem(ctx, id)
}

// ============================================
// Sharing Operations
// ============================================

// ShareMedia creates a share link for a media item or album
func (s *ArchiveService) ShareMedia(ctx context.Context, userID uuid.UUID, req ShareMediaRequest) (*MediaShare, error) {
	if req.MediaItemID == nil && req.AlbumID == nil {
		return nil, errors.New("INVALID_REQUEST", "Either mediaItemId or albumId must be provided")
	}

	// Generate unique share code
	shareCode, err := s.generateShareCode()
	if err != nil {
		return nil, fmt.Errorf("failed to generate share code: %w", err)
	}

	share := &MediaShare{
		ID:          uuid.New(),
		MediaItemID: req.MediaItemID,
		AlbumID:     req.AlbumID,
		UserID:      userID,
		ShareCode:   shareCode,
		Visibility:  req.Visibility,
		Platform:    req.Platform,
		CreatedAt:   time.Now(),
	}

	if share.Visibility == "" {
		share.Visibility = VisibilityPublic
	}

	if req.ExpiresIn > 0 {
		expiresAt := time.Now().Add(time.Duration(req.ExpiresIn) * time.Hour)
		share.ExpiresAt = &expiresAt
	}

	if err := s.repo.CreateShare(ctx, share); err != nil {
		return nil, fmt.Errorf("failed to create share: %w", err)
	}

	log.Info().
		Str("share_id", share.ID.String()).
		Str("share_code", shareCode).
		Msg("Media share created successfully")

	return share, nil
}

// GetSharedMedia retrieves shared media by code
func (s *ArchiveService) GetSharedMedia(ctx context.Context, code string) (*MediaShare, *MediaItem, *Album, error) {
	share, err := s.repo.GetShareByCode(ctx, code)
	if err != nil {
		return nil, nil, nil, err
	}
	if share == nil {
		return nil, nil, nil, errors.ErrNotFound
	}

	// Check expiration
	if share.ExpiresAt != nil && time.Now().After(*share.ExpiresAt) {
		return nil, nil, nil, errors.New("EXPIRED", "This share link has expired")
	}

	// Increment view count
	_ = s.repo.IncrementShareViewCount(ctx, code)

	var mediaItem *MediaItem
	var album *Album

	if share.MediaItemID != nil {
		mediaItem, err = s.repo.GetMediaItemByID(ctx, *share.MediaItemID)
		if err != nil {
			return share, nil, nil, err
		}
	}

	if share.AlbumID != nil {
		album, err = s.repo.GetAlbumByID(ctx, *share.AlbumID)
		if err != nil {
			return share, nil, nil, err
		}
	}

	return share, mediaItem, album, nil
}

// GetUserShares retrieves shares created by a user
func (s *ArchiveService) GetUserShares(ctx context.Context, userID uuid.UUID, page, perPage int) ([]MediaShare, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	return s.repo.GetSharesByUser(ctx, userID, offset, perPage)
}

// DeleteShare deletes a share
func (s *ArchiveService) DeleteShare(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	share, err := s.repo.GetShareByCode(ctx, id.String())
	if err != nil {
		return err
	}
	if share == nil {
		return errors.ErrNotFound
	}
	if share.UserID != userID {
		return errors.New("FORBIDDEN", "You don't have permission to delete this share")
	}
	return s.repo.DeleteShare(ctx, id)
}

// ============================================
// Like Operations
// ============================================

// LikeMedia adds a like to a media item
func (s *ArchiveService) LikeMedia(ctx context.Context, mediaItemID, userID uuid.UUID) error {
	// Check if already liked
	existing, err := s.repo.GetLikeByUser(ctx, mediaItemID, userID)
	if err != nil {
		return err
	}
	if existing != nil {
		return nil // Already liked
	}

	like := &MediaLike{
		ID:          uuid.New(),
		MediaItemID: mediaItemID,
		UserID:      userID,
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateLike(ctx, like); err != nil {
		return fmt.Errorf("failed to create like: %w", err)
	}

	// Update like count
	return s.repo.UpdateLikeCount(ctx, mediaItemID)
}

// UnlikeMedia removes a like from a media item
func (s *ArchiveService) UnlikeMedia(ctx context.Context, mediaItemID, userID uuid.UUID) error {
	if err := s.repo.DeleteLike(ctx, mediaItemID, userID); err != nil {
		return err
	}
	return s.repo.UpdateLikeCount(ctx, mediaItemID)
}

// IsLikedByUser checks if a user has liked a media item
func (s *ArchiveService) IsLikedByUser(ctx context.Context, mediaItemID, userID uuid.UUID) (bool, error) {
	like, err := s.repo.GetLikeByUser(ctx, mediaItemID, userID)
	if err != nil {
		return false, err
	}
	return like != nil, nil
}

// GetLikedMedia retrieves media items liked by a user
func (s *ArchiveService) GetLikedMedia(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, page, perPage int) ([]MediaItem, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	return s.repo.GetLikedMediaByUser(ctx, userID, festivalID, offset, perPage)
}

// ============================================
// Moderation Operations
// ============================================

// ModerateMedia updates the moderation status of a media item
func (s *ArchiveService) ModerateMedia(ctx context.Context, id uuid.UUID, req ModerateMediaRequest, moderatorID uuid.UUID) (*MediaItem, error) {
	item, err := s.repo.GetMediaItemByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, errors.ErrNotFound
	}

	item.Status = req.Status
	item.ModeratedBy = &moderatorID
	now := time.Now()
	item.ModeratedAt = &now
	item.UpdatedAt = now

	if err := s.repo.UpdateMediaItem(ctx, item); err != nil {
		return nil, fmt.Errorf("failed to update media item: %w", err)
	}

	log.Info().
		Str("media_id", id.String()).
		Str("status", string(req.Status)).
		Str("moderated_by", moderatorID.String()).
		Msg("Media moderated successfully")

	return item, nil
}

// GetPendingModeration retrieves media items pending moderation
func (s *ArchiveService) GetPendingModeration(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]MediaItem, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	return s.repo.GetPendingModeration(ctx, festivalID, offset, perPage)
}

// BulkModerate moderates multiple media items at once
func (s *ArchiveService) BulkModerate(ctx context.Context, ids []uuid.UUID, status ModerationStatus, moderatorID uuid.UUID) error {
	return s.repo.BulkUpdateModerationStatus(ctx, ids, status, moderatorID)
}

// ============================================
// Souvenir PDF Operations
// ============================================

// GenerateSouvenirPDF generates a souvenir PDF for a user
func (s *ArchiveService) GenerateSouvenirPDF(ctx context.Context, userID uuid.UUID, req GenerateSouvenirRequest) (*SouvenirPDF, error) {
	// Create PDF record in generating state
	pdf := &SouvenirPDF{
		ID:         uuid.New(),
		FestivalID: req.FestivalID,
		UserID:     userID,
		Status:     "GENERATING",
		CreatedAt:  time.Now(),
		ExpiresAt:  time.Now().Add(7 * 24 * time.Hour), // 7 days expiry
	}

	if err := s.repo.CreateSouvenirPDF(ctx, pdf); err != nil {
		return nil, fmt.Errorf("failed to create souvenir PDF record: %w", err)
	}

	// Start async generation (in real implementation, this would be a background job)
	go s.generatePDFAsync(pdf.ID, userID, req)

	log.Info().
		Str("pdf_id", pdf.ID.String()).
		Str("festival_id", req.FestivalID.String()).
		Str("user_id", userID.String()).
		Msg("Souvenir PDF generation started")

	return pdf, nil
}

// generatePDFAsync generates the PDF asynchronously
func (s *ArchiveService) generatePDFAsync(pdfID, userID uuid.UUID, req GenerateSouvenirRequest) {
	ctx := context.Background()

	pdf, err := s.repo.GetSouvenirPDFByID(ctx, pdfID)
	if err != nil || pdf == nil {
		log.Error().Err(err).Str("pdf_id", pdfID.String()).Msg("Failed to get PDF record")
		return
	}

	// In a real implementation, this would:
	// 1. Fetch user's tickets
	// 2. Fetch user's photos (if requested)
	// 3. Fetch festival schedule (if requested)
	// 4. Generate PDF using a library like gofpdf or wkhtmltopdf
	// 5. Upload to storage
	// 6. Update record with URL

	// Simulate PDF generation
	time.Sleep(5 * time.Second)

	// Generate filename and upload
	filename := fmt.Sprintf("souvenir_%s_%s.pdf", req.FestivalID.String()[:8], userID.String()[:8])
	objectKey := fmt.Sprintf("souvenirs/%s/%s", req.FestivalID.String(), filename)

	// For now, create a placeholder PDF URL
	pdf.Filename = filename
	pdf.URL = fmt.Sprintf("%s/%s/%s", s.baseURL, s.defaultBucket, objectKey)
	pdf.Status = "COMPLETED"
	pdf.Size = 1024 * 100 // Placeholder size

	if err := s.repo.UpdateSouvenirPDF(ctx, pdf); err != nil {
		log.Error().Err(err).Str("pdf_id", pdfID.String()).Msg("Failed to update PDF record")
		return
	}

	log.Info().
		Str("pdf_id", pdfID.String()).
		Msg("Souvenir PDF generated successfully")
}

// GetSouvenirPDF retrieves a souvenir PDF by ID
func (s *ArchiveService) GetSouvenirPDF(ctx context.Context, id uuid.UUID) (*SouvenirPDF, error) {
	pdf, err := s.repo.GetSouvenirPDFByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if pdf == nil {
		return nil, errors.ErrNotFound
	}
	return pdf, nil
}

// GetUserSouvenirPDFs retrieves all souvenir PDFs for a user
func (s *ArchiveService) GetUserSouvenirPDFs(ctx context.Context, userID uuid.UUID) ([]SouvenirPDF, error) {
	return s.repo.ListSouvenirPDFs(ctx, userID)
}

// ============================================
// Helper Functions
// ============================================

func (s *ArchiveService) buildArchiveKey(festivalID uuid.UUID, subdir, filename string) string {
	return fmt.Sprintf("archives/%s/%s/%s", festivalID.String(), strings.ToLower(subdir), filename)
}

func (s *ArchiveService) generateShareCode() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *ArchiveService) isAllowedImageType(contentType string) bool {
	for _, allowed := range s.imageConfig.AllowedMimeTypes {
		if contentType == allowed {
			return true
		}
	}
	return false
}

func (s *ArchiveService) isAllowedVideoType(contentType string) bool {
	for _, allowed := range s.videoConfig.AllowedMimeTypes {
		if contentType == allowed {
			return true
		}
	}
	return false
}

// GetBaseURL returns the base URL for share links
func (s *ArchiveService) GetBaseURL() string {
	return s.baseURL
}
