package media

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// ArchiveHandler handles archive and souvenir HTTP requests
type ArchiveHandler struct {
	service *ArchiveService
}

// NewArchiveHandler creates a new archive handler
func NewArchiveHandler(service *ArchiveService) *ArchiveHandler {
	return &ArchiveHandler{service: service}
}

// RegisterRoutes registers archive routes
func (h *ArchiveHandler) RegisterRoutes(r *gin.RouterGroup) {
	archives := r.Group("/archives")
	{
		// Media items
		archives.POST("/upload", h.UploadMedia)
		archives.GET("/gallery/:festivalId", h.GetFestivalGallery)
		archives.GET("/media/:id", h.GetMediaItem)
		archives.DELETE("/media/:id", h.DeleteMediaItem)

		// User photos
		archives.GET("/my-photos", h.GetMyPhotos)
		archives.GET("/my-photos/:festivalId", h.GetMyPhotosByFestival)

		// Albums
		archives.POST("/albums", h.CreateAlbum)
		archives.GET("/albums/:festivalId", h.ListAlbums)
		archives.GET("/album/:id", h.GetAlbum)
		archives.PATCH("/album/:id", h.UpdateAlbum)
		archives.DELETE("/album/:id", h.DeleteAlbum)
		archives.POST("/album/:id/items", h.AddToAlbum)
		archives.DELETE("/album/:id/items/:mediaId", h.RemoveFromAlbum)
		archives.GET("/album/:id/items", h.GetAlbumItems)

		// Sharing
		archives.POST("/share", h.ShareMedia)
		archives.GET("/share/:code", h.GetSharedMedia)
		archives.GET("/my-shares", h.GetMyShares)
		archives.DELETE("/share/:id", h.DeleteShare)

		// Likes
		archives.POST("/media/:id/like", h.LikeMedia)
		archives.DELETE("/media/:id/like", h.UnlikeMedia)
		archives.GET("/liked", h.GetLikedMedia)

		// Souvenir PDFs
		archives.POST("/souvenir", h.GenerateSouvenirPDF)
		archives.GET("/souvenir/:id", h.GetSouvenirPDF)
		archives.GET("/my-souvenirs", h.GetMySouvenirs)

		// Moderation (admin only)
		archives.GET("/moderation/:festivalId", h.GetPendingModeration)
		archives.POST("/moderate/:id", h.ModerateMedia)
		archives.POST("/moderate/bulk", h.BulkModerate)
	}
}

// ============================================
// Media Upload & Gallery Handlers
// ============================================

// UploadMedia uploads a photo or video
// @Summary Upload a media file
// @Tags archives
// @Accept multipart/form-data
// @Produce json
// @Param file formance file true "Media file"
// @Param festivalId formData string true "Festival ID"
// @Param type formData string true "Media type (PHOTO or VIDEO)"
// @Param tags formData []string false "Tags"
// @Param description formData string false "Description"
// @Success 201 {object} MediaItemResponse
// @Router /archives/upload [post]
func (h *ArchiveHandler) UploadMedia(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "MISSING_FILE", "No file provided", nil)
		return
	}

	festivalIDStr := c.PostForm("festivalId")
	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL_ID", "Invalid festival ID", nil)
		return
	}

	mediaType := MediaItemType(c.PostForm("type"))
	if !mediaType.IsValid() {
		response.BadRequest(c, "INVALID_TYPE", "Type must be PHOTO or VIDEO", nil)
		return
	}

	uploaderID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	req := UploadMediaItemRequest{
		FestivalID:  festivalID,
		Type:        mediaType,
		Description: c.PostForm("description"),
		StageName:   c.PostForm("stageName"),
	}

	// Parse tags
	if tags := c.PostFormArray("tags"); len(tags) > 0 {
		req.Tags = tags
	}

	// Parse day
	if dayStr := c.PostForm("day"); dayStr != "" {
		if day, err := strconv.Atoi(dayStr); err == nil {
			req.Day = day
		}
	}

	// Parse artist ID
	if artistIDStr := c.PostForm("artistId"); artistIDStr != "" {
		if artistID, err := uuid.Parse(artistIDStr); err == nil {
			req.ArtistID = &artistID
		}
	}

	item, err := h.service.UploadMedia(c.Request.Context(), file, req, uploaderID)
	if err != nil {
		if appErr, ok := err.(*errors.AppError); ok {
			response.BadRequest(c, appErr.Code, appErr.Message, nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, item.ToResponse())
}

// GetFestivalGallery retrieves the public gallery for a festival
// @Summary Get festival gallery
// @Tags archives
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Param type query string false "Filter by type (PHOTO or VIDEO)"
// @Param day query int false "Filter by day"
// @Param stageName query string false "Filter by stage name"
// @Success 200 {array} MediaItemResponse
// @Router /archives/gallery/{festivalId} [get]
func (h *ArchiveHandler) GetFestivalGallery(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	filter := GalleryFilter{}
	if typeStr := c.Query("type"); typeStr != "" {
		mediaType := MediaItemType(typeStr)
		filter.Type = &mediaType
	}
	if dayStr := c.Query("day"); dayStr != "" {
		if day, err := strconv.Atoi(dayStr); err == nil {
			filter.Day = &day
		}
	}
	if stageName := c.Query("stageName"); stageName != "" {
		filter.StageName = &stageName
	}

	items, total, err := h.service.GetFestivalGallery(c.Request.Context(), festivalID, page, perPage, filter)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Get user ID for like status
	userID, _ := h.getUserID(c)

	responses := make([]MediaItemResponse, len(items))
	for i, item := range items {
		resp := item.ToResponse()
		if userID != uuid.Nil {
			isLiked, _ := h.service.IsLikedByUser(c.Request.Context(), item.ID, userID)
			resp.IsLiked = isLiked
		}
		responses[i] = resp
	}

	response.OKWithMeta(c, responses, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetMediaItem retrieves a single media item
// @Summary Get media item by ID
// @Tags archives
// @Produce json
// @Param id path string true "Media Item ID"
// @Success 200 {object} MediaItemResponse
// @Router /archives/media/{id} [get]
func (h *ArchiveHandler) GetMediaItem(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid media ID", nil)
		return
	}

	item, err := h.service.GetMediaItem(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Media not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	resp := item.ToResponse()
	if userID, err := h.getUserID(c); err == nil && userID != uuid.Nil {
		isLiked, _ := h.service.IsLikedByUser(c.Request.Context(), item.ID, userID)
		resp.IsLiked = isLiked
	}

	response.OK(c, resp)
}

// DeleteMediaItem deletes a media item
// @Summary Delete media item
// @Tags archives
// @Param id path string true "Media Item ID"
// @Success 204
// @Router /archives/media/{id} [delete]
func (h *ArchiveHandler) DeleteMediaItem(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid media ID", nil)
		return
	}

	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	isAdmin := c.GetBool("is_admin")

	if err := h.service.DeleteMediaItem(c.Request.Context(), id, userID, isAdmin); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Media not found")
			return
		}
		if appErr, ok := err.(*errors.AppError); ok {
			response.Error(c, http.StatusForbidden, appErr.Code, appErr.Message, nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// GetMyPhotos retrieves photos uploaded by the current user
// @Summary Get my photos
// @Tags archives
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} MediaItemResponse
// @Router /archives/my-photos [get]
func (h *ArchiveHandler) GetMyPhotos(c *gin.Context) {
	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	items, total, err := h.service.GetUserPhotos(c.Request.Context(), userID, nil, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]MediaItemResponse, len(items))
	for i, item := range items {
		responses[i] = item.ToResponse()
	}

	response.OKWithMeta(c, responses, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetMyPhotosByFestival retrieves photos uploaded by the current user for a specific festival
// @Summary Get my photos for a festival
// @Tags archives
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} MediaItemResponse
// @Router /archives/my-photos/{festivalId} [get]
func (h *ArchiveHandler) GetMyPhotosByFestival(c *gin.Context) {
	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	items, total, err := h.service.GetUserPhotos(c.Request.Context(), userID, &festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]MediaItemResponse, len(items))
	for i, item := range items {
		responses[i] = item.ToResponse()
	}

	response.OKWithMeta(c, responses, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// ============================================
// Album Handlers
// ============================================

// CreateAlbum creates a new album
// @Summary Create album
// @Tags archives
// @Accept json
// @Produce json
// @Param request body CreateAlbumRequest true "Album data"
// @Success 201 {object} AlbumResponse
// @Router /archives/albums [post]
func (h *ArchiveHandler) CreateAlbum(c *gin.Context) {
	var req CreateAlbumRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	album, err := h.service.CreateAlbum(c.Request.Context(), req, userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, album.ToResponse())
}

// ListAlbums lists albums for a festival
// @Summary List albums
// @Tags archives
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} AlbumResponse
// @Router /archives/albums/{festivalId} [get]
func (h *ArchiveHandler) ListAlbums(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	albums, total, err := h.service.ListAlbums(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]AlbumResponse, len(albums))
	for i, album := range albums {
		responses[i] = album.ToResponse()
	}

	response.OKWithMeta(c, responses, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetAlbum retrieves an album by ID
// @Summary Get album by ID
// @Tags archives
// @Produce json
// @Param id path string true "Album ID"
// @Success 200 {object} AlbumResponse
// @Router /archives/album/{id} [get]
func (h *ArchiveHandler) GetAlbum(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid album ID", nil)
		return
	}

	album, err := h.service.GetAlbum(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Album not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, album.ToResponse())
}

// UpdateAlbum updates an album
// @Summary Update album
// @Tags archives
// @Accept json
// @Produce json
// @Param id path string true "Album ID"
// @Param request body UpdateAlbumRequest true "Update data"
// @Success 200 {object} AlbumResponse
// @Router /archives/album/{id} [patch]
func (h *ArchiveHandler) UpdateAlbum(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid album ID", nil)
		return
	}

	var req UpdateAlbumRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	album, err := h.service.UpdateAlbum(c.Request.Context(), id, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Album not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, album.ToResponse())
}

// DeleteAlbum deletes an album
// @Summary Delete album
// @Tags archives
// @Param id path string true "Album ID"
// @Success 204
// @Router /archives/album/{id} [delete]
func (h *ArchiveHandler) DeleteAlbum(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid album ID", nil)
		return
	}

	if err := h.service.DeleteAlbum(c.Request.Context(), id); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Album not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// AddToAlbum adds media items to an album
// @Summary Add items to album
// @Tags archives
// @Accept json
// @Param id path string true "Album ID"
// @Param request body AddToAlbumRequest true "Media item IDs"
// @Success 204
// @Router /archives/album/{id}/items [post]
func (h *ArchiveHandler) AddToAlbum(c *gin.Context) {
	albumID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid album ID", nil)
		return
	}

	var req AddToAlbumRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	if err := h.service.AddToAlbum(c.Request.Context(), albumID, req.MediaItemIDs); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Album not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// RemoveFromAlbum removes a media item from an album
// @Summary Remove item from album
// @Tags archives
// @Param id path string true "Album ID"
// @Param mediaId path string true "Media Item ID"
// @Success 204
// @Router /archives/album/{id}/items/{mediaId} [delete]
func (h *ArchiveHandler) RemoveFromAlbum(c *gin.Context) {
	albumID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid album ID", nil)
		return
	}

	mediaID, err := uuid.Parse(c.Param("mediaId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid media ID", nil)
		return
	}

	if err := h.service.RemoveFromAlbum(c.Request.Context(), albumID, mediaID); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// GetAlbumItems retrieves items in an album
// @Summary Get album items
// @Tags archives
// @Produce json
// @Param id path string true "Album ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} MediaItemResponse
// @Router /archives/album/{id}/items [get]
func (h *ArchiveHandler) GetAlbumItems(c *gin.Context) {
	albumID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid album ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	items, total, err := h.service.GetAlbumItems(c.Request.Context(), albumID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]MediaItemResponse, len(items))
	for i, item := range items {
		responses[i] = item.ToResponse()
	}

	response.OKWithMeta(c, responses, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// ============================================
// Share Handlers
// ============================================

// ShareMedia creates a share link
// @Summary Share media
// @Tags archives
// @Accept json
// @Produce json
// @Param request body ShareMediaRequest true "Share data"
// @Success 201 {object} MediaShareResponse
// @Router /archives/share [post]
func (h *ArchiveHandler) ShareMedia(c *gin.Context) {
	var req ShareMediaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	share, err := h.service.ShareMedia(c.Request.Context(), userID, req)
	if err != nil {
		if appErr, ok := err.(*errors.AppError); ok {
			response.BadRequest(c, appErr.Code, appErr.Message, nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, share.ToResponse(h.service.GetBaseURL()))
}

// GetSharedMedia retrieves shared media by code
// @Summary Get shared media
// @Tags archives
// @Produce json
// @Param code path string true "Share code"
// @Success 200 {object} map[string]interface{}
// @Router /archives/share/{code} [get]
func (h *ArchiveHandler) GetSharedMedia(c *gin.Context) {
	code := c.Param("code")
	if code == "" {
		response.BadRequest(c, "INVALID_CODE", "Share code is required", nil)
		return
	}

	share, mediaItem, album, err := h.service.GetSharedMedia(c.Request.Context(), code)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Share not found")
			return
		}
		if appErr, ok := err.(*errors.AppError); ok {
			response.Error(c, http.StatusGone, appErr.Code, appErr.Message, nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	result := gin.H{
		"share": share.ToResponse(h.service.GetBaseURL()),
	}
	if mediaItem != nil {
		result["media"] = mediaItem.ToResponse()
	}
	if album != nil {
		result["album"] = album.ToResponse()
	}

	response.OK(c, result)
}

// GetMyShares retrieves shares created by the current user
// @Summary Get my shares
// @Tags archives
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} MediaShareResponse
// @Router /archives/my-shares [get]
func (h *ArchiveHandler) GetMyShares(c *gin.Context) {
	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	shares, total, err := h.service.GetUserShares(c.Request.Context(), userID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]MediaShareResponse, len(shares))
	for i, share := range shares {
		responses[i] = share.ToResponse(h.service.GetBaseURL())
	}

	response.OKWithMeta(c, responses, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// DeleteShare deletes a share
// @Summary Delete share
// @Tags archives
// @Param id path string true "Share ID"
// @Success 204
// @Router /archives/share/{id} [delete]
func (h *ArchiveHandler) DeleteShare(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid share ID", nil)
		return
	}

	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	if err := h.service.DeleteShare(c.Request.Context(), id, userID); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Share not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// ============================================
// Like Handlers
// ============================================

// LikeMedia likes a media item
// @Summary Like media
// @Tags archives
// @Param id path string true "Media Item ID"
// @Success 204
// @Router /archives/media/{id}/like [post]
func (h *ArchiveHandler) LikeMedia(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid media ID", nil)
		return
	}

	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	if err := h.service.LikeMedia(c.Request.Context(), id, userID); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// UnlikeMedia removes a like from a media item
// @Summary Unlike media
// @Tags archives
// @Param id path string true "Media Item ID"
// @Success 204
// @Router /archives/media/{id}/like [delete]
func (h *ArchiveHandler) UnlikeMedia(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid media ID", nil)
		return
	}

	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	if err := h.service.UnlikeMedia(c.Request.Context(), id, userID); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// GetLikedMedia retrieves media liked by the current user
// @Summary Get liked media
// @Tags archives
// @Produce json
// @Param festivalId query string false "Festival ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} MediaItemResponse
// @Router /archives/liked [get]
func (h *ArchiveHandler) GetLikedMedia(c *gin.Context) {
	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	var festivalID *uuid.UUID
	if festivalIDStr := c.Query("festivalId"); festivalIDStr != "" {
		if id, err := uuid.Parse(festivalIDStr); err == nil {
			festivalID = &id
		}
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	items, total, err := h.service.GetLikedMedia(c.Request.Context(), userID, festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]MediaItemResponse, len(items))
	for i, item := range items {
		resp := item.ToResponse()
		resp.IsLiked = true
		responses[i] = resp
	}

	response.OKWithMeta(c, responses, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// ============================================
// Souvenir PDF Handlers
// ============================================

// GenerateSouvenirPDF generates a souvenir PDF
// @Summary Generate souvenir PDF
// @Tags archives
// @Accept json
// @Produce json
// @Param request body GenerateSouvenirRequest true "Souvenir options"
// @Success 202 {object} SouvenirPDFResponse
// @Router /archives/souvenir [post]
func (h *ArchiveHandler) GenerateSouvenirPDF(c *gin.Context) {
	var req GenerateSouvenirRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	pdf, err := h.service.GenerateSouvenirPDF(c.Request.Context(), userID, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	c.JSON(http.StatusAccepted, pdf.ToResponse())
}

// GetSouvenirPDF retrieves a souvenir PDF by ID
// @Summary Get souvenir PDF
// @Tags archives
// @Produce json
// @Param id path string true "Souvenir PDF ID"
// @Success 200 {object} SouvenirPDFResponse
// @Router /archives/souvenir/{id} [get]
func (h *ArchiveHandler) GetSouvenirPDF(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid souvenir ID", nil)
		return
	}

	pdf, err := h.service.GetSouvenirPDF(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Souvenir not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, pdf.ToResponse())
}

// GetMySouvenirs retrieves all souvenir PDFs for the current user
// @Summary Get my souvenirs
// @Tags archives
// @Produce json
// @Success 200 {array} SouvenirPDFResponse
// @Router /archives/my-souvenirs [get]
func (h *ArchiveHandler) GetMySouvenirs(c *gin.Context) {
	userID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	pdfs, err := h.service.GetUserSouvenirPDFs(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]SouvenirPDFResponse, len(pdfs))
	for i, pdf := range pdfs {
		responses[i] = pdf.ToResponse()
	}

	response.OK(c, responses)
}

// ============================================
// Moderation Handlers
// ============================================

// GetPendingModeration retrieves media pending moderation
// @Summary Get pending moderation
// @Tags archives
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {array} MediaItemResponse
// @Router /archives/moderation/{festivalId} [get]
func (h *ArchiveHandler) GetPendingModeration(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	items, total, err := h.service.GetPendingModeration(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]MediaItemResponse, len(items))
	for i, item := range items {
		responses[i] = item.ToResponse()
	}

	response.OKWithMeta(c, responses, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// ModerateMedia moderates a media item
// @Summary Moderate media
// @Tags archives
// @Accept json
// @Produce json
// @Param id path string true "Media Item ID"
// @Param request body ModerateMediaRequest true "Moderation data"
// @Success 200 {object} MediaItemResponse
// @Router /archives/moderate/{id} [post]
func (h *ArchiveHandler) ModerateMedia(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid media ID", nil)
		return
	}

	var req ModerateMediaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	moderatorID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	item, err := h.service.ModerateMedia(c.Request.Context(), id, req, moderatorID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Media not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, item.ToResponse())
}

// BulkModerate moderates multiple media items
// @Summary Bulk moderate media
// @Tags archives
// @Accept json
// @Param request body map[string]interface{} true "Bulk moderation data"
// @Success 204
// @Router /archives/moderate/bulk [post]
func (h *ArchiveHandler) BulkModerate(c *gin.Context) {
	var req struct {
		IDs    []uuid.UUID      `json:"ids" binding:"required"`
		Status ModerationStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	moderatorID, err := h.getUserID(c)
	if err != nil {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	if err := h.service.BulkModerate(c.Request.Context(), req.IDs, req.Status, moderatorID); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// ============================================
// Helper Methods
// ============================================

func (h *ArchiveHandler) getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		return uuid.Nil, errors.New("UNAUTHORIZED", "User not authenticated")
	}
	return uuid.Parse(userIDStr)
}
