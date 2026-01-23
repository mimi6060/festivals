package lineup

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// FavoritesHandler handles favorites-related HTTP requests
type FavoritesHandler struct {
	favoritesService *FavoritesService
}

// NewFavoritesHandler creates a new favorites handler
func NewFavoritesHandler(favoritesService *FavoritesService) *FavoritesHandler {
	return &FavoritesHandler{favoritesService: favoritesService}
}

// RegisterRoutes registers favorites routes
func (h *FavoritesHandler) RegisterRoutes(r *gin.RouterGroup) {
	// Favorites routes under /festivals/:festivalId
	favorites := r.Group("/artists/:artistId/favorite")
	{
		favorites.POST("", h.AddFavorite)
		favorites.DELETE("", h.RemoveFavorite)
		favorites.GET("", h.CheckFavorite)
	}

	// Get favorite count for an artist
	r.GET("/artists/:artistId/favorites/count", h.GetFavoriteCount)

	// User favorites routes
	me := r.Group("/me")
	{
		me.GET("/favorites", h.GetUserFavorites)
		me.GET("/favorites/upcoming", h.GetUpcomingFavoritePerformances)
	}
}

// getUserID extracts the user ID from the context
func getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		return uuid.Nil, nil
	}
	return uuid.Parse(userIDStr)
}

// AddFavorite adds an artist to user's favorites
// @Summary Add artist to favorites
// @Tags favorites
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param artistId path string true "Artist ID"
// @Success 201 {object} UserFavoriteResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Failure 409 {object} response.ErrorResponse "Already favorited"
// @Router /festivals/{festivalId}/artists/{artistId}/favorite [post]
func (h *FavoritesHandler) AddFavorite(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	artistID, err := uuid.Parse(c.Param("artistId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid artist ID", nil)
		return
	}

	userID, err := getUserID(c)
	if err != nil || userID == uuid.Nil {
		response.Unauthorized(c, "Authentication required")
		return
	}

	favorite, err := h.favoritesService.AddFavorite(c.Request.Context(), userID, artistID, festivalID)
	if err != nil {
		if err.Error() == "artist not found" {
			response.NotFound(c, "Artist not found")
			return
		}
		if err.Error() == "artist already favorited" {
			response.Conflict(c, "ALREADY_FAVORITED", "Artist is already in your favorites")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, favorite.ToResponse())
}

// RemoveFavorite removes an artist from user's favorites
// @Summary Remove artist from favorites
// @Tags favorites
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param artistId path string true "Artist ID"
// @Success 204
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{festivalId}/artists/{artistId}/favorite [delete]
func (h *FavoritesHandler) RemoveFavorite(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	artistID, err := uuid.Parse(c.Param("artistId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid artist ID", nil)
		return
	}

	userID, err := getUserID(c)
	if err != nil || userID == uuid.Nil {
		response.Unauthorized(c, "Authentication required")
		return
	}

	err = h.favoritesService.RemoveFavorite(c.Request.Context(), userID, artistID, festivalID)
	if err != nil {
		if err.Error() == "favorite not found" {
			response.NotFound(c, "Favorite not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// CheckFavorite checks if a user has favorited an artist
// @Summary Check if artist is favorited
// @Tags favorites
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param artistId path string true "Artist ID"
// @Success 200 {object} object{isFavorited=bool}
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Router /festivals/{festivalId}/artists/{artistId}/favorite [get]
func (h *FavoritesHandler) CheckFavorite(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	artistID, err := uuid.Parse(c.Param("artistId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid artist ID", nil)
		return
	}

	userID, err := getUserID(c)
	if err != nil || userID == uuid.Nil {
		response.Unauthorized(c, "Authentication required")
		return
	}

	isFavorited, err := h.favoritesService.IsFavorited(c.Request.Context(), userID, artistID, festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, map[string]bool{"isFavorited": isFavorited})
}

// GetFavoriteCount returns the number of users who favorited an artist
// @Summary Get favorite count for artist
// @Tags favorites
// @Produce json
// @Param artistId path string true "Artist ID"
// @Success 200 {object} FavoriteCountResponse
// @Failure 400 {object} response.ErrorResponse
// @Router /festivals/{festivalId}/artists/{artistId}/favorites/count [get]
func (h *FavoritesHandler) GetFavoriteCount(c *gin.Context) {
	artistID, err := uuid.Parse(c.Param("artistId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid artist ID", nil)
		return
	}

	count, err := h.favoritesService.GetFavoriteCount(c.Request.Context(), artistID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, count)
}

// GetUserFavorites returns all favorites for the current user
// @Summary Get user's favorites
// @Tags favorites
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Success 200 {object} FavoritesListResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Router /festivals/{festivalId}/me/favorites [get]
func (h *FavoritesHandler) GetUserFavorites(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	userID, err := getUserID(c)
	if err != nil || userID == uuid.Nil {
		response.Unauthorized(c, "Authentication required")
		return
	}

	favorites, err := h.favoritesService.GetUserFavorites(c.Request.Context(), userID, festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, favorites)
}

// GetUpcomingFavoritePerformances returns upcoming performances of favorited artists
// @Summary Get upcoming performances of favorited artists
// @Tags favorites
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Param limit query int false "Limit" default(10)
// @Success 200 {array} PerformanceResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Router /festivals/{festivalId}/me/favorites/upcoming [get]
func (h *FavoritesHandler) GetUpcomingFavoritePerformances(c *gin.Context) {
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "INVALID_FESTIVAL", "Festival context required", nil)
		return
	}

	userID, err := getUserID(c)
	if err != nil || userID == uuid.Nil {
		response.Unauthorized(c, "Authentication required")
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	performances, err := h.favoritesService.GetUpcomingFavoritePerformances(c.Request.Context(), userID, festivalID, limit)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, performances)
}
