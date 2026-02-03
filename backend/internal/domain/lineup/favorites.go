package lineup

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserFavorite represents a user's favorite artist at a festival
type UserFavorite struct {
	ID         uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID     uuid.UUID `json:"userId" gorm:"type:uuid;not null;index:idx_user_favorites_user_festival"`
	ArtistID   uuid.UUID `json:"artistId" gorm:"type:uuid;not null;index"`
	FestivalID uuid.UUID `json:"festivalId" gorm:"type:uuid;not null;index:idx_user_favorites_user_festival"`
	CreatedAt  time.Time `json:"createdAt"`

	// Relations (for eager loading)
	Artist *Artist `json:"artist,omitempty" gorm:"foreignKey:ArtistID"`
}

func (UserFavorite) TableName() string {
	return "user_favorites"
}

// UserFavoriteResponse represents the API response for a user favorite
type UserFavoriteResponse struct {
	ID         uuid.UUID       `json:"id"`
	UserID     uuid.UUID       `json:"userId"`
	ArtistID   uuid.UUID       `json:"artistId"`
	FestivalID uuid.UUID       `json:"festivalId"`
	CreatedAt  string          `json:"createdAt"`
	Artist     *ArtistResponse `json:"artist,omitempty"`
}

func (f *UserFavorite) ToResponse() UserFavoriteResponse {
	resp := UserFavoriteResponse{
		ID:         f.ID,
		UserID:     f.UserID,
		ArtistID:   f.ArtistID,
		FestivalID: f.FestivalID,
		CreatedAt:  f.CreatedAt.Format(time.RFC3339),
	}

	if f.Artist != nil {
		artistResp := f.Artist.ToResponse()
		resp.Artist = &artistResp
	}

	return resp
}

// FavoriteWithUpcoming includes next performance info
type FavoriteWithUpcoming struct {
	Favorite        UserFavoriteResponse `json:"favorite"`
	NextPerformance *PerformanceResponse `json:"nextPerformance,omitempty"`
}

// FavoritesListResponse is the response for listing user favorites
type FavoritesListResponse struct {
	Favorites []FavoriteWithUpcoming `json:"favorites"`
	Total     int                    `json:"total"`
}

// FavoriteCountResponse is the response for getting favorite count
type FavoriteCountResponse struct {
	ArtistID uuid.UUID `json:"artistId"`
	Count    int64     `json:"count"`
}

// =====================
// Favorites Repository Interface Extension
// =====================

// FavoritesRepository defines the favorites-specific repository operations
type FavoritesRepository interface {
	// Favorite operations
	AddFavorite(ctx context.Context, favorite *UserFavorite) error
	RemoveFavorite(ctx context.Context, userID, artistID, festivalID uuid.UUID) error
	GetUserFavorites(ctx context.Context, userID, festivalID uuid.UUID) ([]UserFavorite, error)
	GetFavoriteCount(ctx context.Context, artistID uuid.UUID) (int64, error)
	IsFavorited(ctx context.Context, userID, artistID, festivalID uuid.UUID) (bool, error)
	GetUsersWhoFavoritedArtist(ctx context.Context, artistID uuid.UUID) ([]uuid.UUID, error)
}

// favoritesRepository implements FavoritesRepository
type favoritesRepository struct {
	db *gorm.DB
}

// NewFavoritesRepository creates a new favorites repository
func NewFavoritesRepository(db *gorm.DB) FavoritesRepository {
	return &favoritesRepository{db: db}
}

// AddFavorite adds an artist to user's favorites
func (r *favoritesRepository) AddFavorite(ctx context.Context, favorite *UserFavorite) error {
	return r.db.WithContext(ctx).Create(favorite).Error
}

// RemoveFavorite removes an artist from user's favorites
func (r *favoritesRepository) RemoveFavorite(ctx context.Context, userID, artistID, festivalID uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Where("user_id = ? AND artist_id = ? AND festival_id = ?", userID, artistID, festivalID).
		Delete(&UserFavorite{})

	if result.Error != nil {
		return fmt.Errorf("failed to remove favorite: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("favorite not found")
	}

	return nil
}

// GetUserFavorites retrieves all favorites for a user at a festival
func (r *favoritesRepository) GetUserFavorites(ctx context.Context, userID, festivalID uuid.UUID) ([]UserFavorite, error) {
	var favorites []UserFavorite
	err := r.db.WithContext(ctx).
		Preload("Artist").
		Where("user_id = ? AND festival_id = ?", userID, festivalID).
		Order("created_at DESC").
		Find(&favorites).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get user favorites: %w", err)
	}

	return favorites, nil
}

// GetFavoriteCount returns the number of users who favorited an artist
func (r *favoritesRepository) GetFavoriteCount(ctx context.Context, artistID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&UserFavorite{}).
		Where("artist_id = ?", artistID).
		Count(&count).Error

	if err != nil {
		return 0, fmt.Errorf("failed to count favorites: %w", err)
	}

	return count, nil
}

// IsFavorited checks if a user has favorited an artist
func (r *favoritesRepository) IsFavorited(ctx context.Context, userID, artistID, festivalID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&UserFavorite{}).
		Where("user_id = ? AND artist_id = ? AND festival_id = ?", userID, artistID, festivalID).
		Count(&count).Error

	if err != nil {
		return false, fmt.Errorf("failed to check favorite: %w", err)
	}

	return count > 0, nil
}

// GetUsersWhoFavoritedArtist returns all user IDs who favorited an artist
func (r *favoritesRepository) GetUsersWhoFavoritedArtist(ctx context.Context, artistID uuid.UUID) ([]uuid.UUID, error) {
	var userIDs []uuid.UUID
	err := r.db.WithContext(ctx).
		Model(&UserFavorite{}).
		Where("artist_id = ?", artistID).
		Distinct("user_id").
		Pluck("user_id", &userIDs).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get users who favorited artist: %w", err)
	}

	return userIDs, nil
}

// =====================
// Favorites Service Extension
// =====================

// FavoritesService provides favorites-related business logic
type FavoritesService struct {
	favoritesRepo FavoritesRepository
	lineupRepo    Repository
}

// NewFavoritesService creates a new favorites service
func NewFavoritesService(favoritesRepo FavoritesRepository, lineupRepo Repository) *FavoritesService {
	return &FavoritesService{
		favoritesRepo: favoritesRepo,
		lineupRepo:    lineupRepo,
	}
}

// AddFavorite adds an artist to user's favorites
func (s *FavoritesService) AddFavorite(ctx context.Context, userID, artistID, festivalID uuid.UUID) (*UserFavorite, error) {
	// Check if artist exists
	artist, err := s.lineupRepo.GetArtistByID(ctx, artistID)
	if err != nil {
		return nil, err
	}
	if artist == nil {
		return nil, fmt.Errorf("artist not found")
	}

	// Check if already favorited
	isFavorited, err := s.favoritesRepo.IsFavorited(ctx, userID, artistID, festivalID)
	if err != nil {
		return nil, err
	}
	if isFavorited {
		return nil, fmt.Errorf("artist already favorited")
	}

	favorite := &UserFavorite{
		ID:         uuid.New(),
		UserID:     userID,
		ArtistID:   artistID,
		FestivalID: festivalID,
		CreatedAt:  time.Now(),
		Artist:     artist,
	}

	if err := s.favoritesRepo.AddFavorite(ctx, favorite); err != nil {
		return nil, fmt.Errorf("failed to add favorite: %w", err)
	}

	return favorite, nil
}

// RemoveFavorite removes an artist from user's favorites
func (s *FavoritesService) RemoveFavorite(ctx context.Context, userID, artistID, festivalID uuid.UUID) error {
	return s.favoritesRepo.RemoveFavorite(ctx, userID, artistID, festivalID)
}

// GetUserFavorites retrieves all favorites for a user at a festival with upcoming performances
func (s *FavoritesService) GetUserFavorites(ctx context.Context, userID, festivalID uuid.UUID) (*FavoritesListResponse, error) {
	favorites, err := s.favoritesRepo.GetUserFavorites(ctx, userID, festivalID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]FavoriteWithUpcoming, len(favorites))

	for i, fav := range favorites {
		favResp := fav.ToResponse()
		item := FavoriteWithUpcoming{
			Favorite: favResp,
		}

		// Get upcoming performance for this artist
		performances, err := s.lineupRepo.GetArtistPerformances(ctx, fav.ArtistID)
		if err == nil {
			for _, perf := range performances {
				if perf.StartTime.After(now) {
					perfResp := perf.ToResponse()
					item.NextPerformance = &perfResp
					break
				}
			}
		}

		result[i] = item
	}

	return &FavoritesListResponse{
		Favorites: result,
		Total:     len(result),
	}, nil
}

// GetFavoriteCount returns the number of users who favorited an artist
func (s *FavoritesService) GetFavoriteCount(ctx context.Context, artistID uuid.UUID) (*FavoriteCountResponse, error) {
	count, err := s.favoritesRepo.GetFavoriteCount(ctx, artistID)
	if err != nil {
		return nil, err
	}

	return &FavoriteCountResponse{
		ArtistID: artistID,
		Count:    count,
	}, nil
}

// IsFavorited checks if a user has favorited an artist
func (s *FavoritesService) IsFavorited(ctx context.Context, userID, artistID, festivalID uuid.UUID) (bool, error) {
	return s.favoritesRepo.IsFavorited(ctx, userID, artistID, festivalID)
}

// GetUsersWhoFavoritedArtist returns all user IDs who favorited an artist
// This is useful for sending notifications when an artist is about to perform
func (s *FavoritesService) GetUsersWhoFavoritedArtist(ctx context.Context, artistID uuid.UUID) ([]uuid.UUID, error) {
	return s.favoritesRepo.GetUsersWhoFavoritedArtist(ctx, artistID)
}

// GetUpcomingFavoritePerformances returns upcoming performances of favorited artists
func (s *FavoritesService) GetUpcomingFavoritePerformances(ctx context.Context, userID, festivalID uuid.UUID, limit int) ([]PerformanceResponse, error) {
	favorites, err := s.favoritesRepo.GetUserFavorites(ctx, userID, festivalID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	var upcomingPerformances []Performance

	for _, fav := range favorites {
		performances, err := s.lineupRepo.GetArtistPerformances(ctx, fav.ArtistID)
		if err != nil {
			continue
		}

		for _, perf := range performances {
			if perf.StartTime.After(now) {
				upcomingPerformances = append(upcomingPerformances, perf)
			}
		}
	}

	// Sort by start time
	for i := 0; i < len(upcomingPerformances); i++ {
		for j := i + 1; j < len(upcomingPerformances); j++ {
			if upcomingPerformances[i].StartTime.After(upcomingPerformances[j].StartTime) {
				upcomingPerformances[i], upcomingPerformances[j] = upcomingPerformances[j], upcomingPerformances[i]
			}
		}
	}

	// Limit results
	if limit > 0 && len(upcomingPerformances) > limit {
		upcomingPerformances = upcomingPerformances[:limit]
	}

	// Convert to responses
	result := make([]PerformanceResponse, len(upcomingPerformances))
	for i, perf := range upcomingPerformances {
		result[i] = perf.ToResponse()
	}

	return result, nil
}
