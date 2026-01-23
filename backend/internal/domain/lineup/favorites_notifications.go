package lineup

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/queue"
	"github.com/rs/zerolog/log"
)

// Task type constants for favorite artist notifications
const (
	TypeFavoriteArtistNotification      = "notification:favorite_artist"
	TypeScheduleFavoriteNotifications   = "notification:schedule_favorites"
)

// FavoriteArtistNotificationPayload contains the data for a favorite artist notification
type FavoriteArtistNotificationPayload struct {
	UserID        uuid.UUID `json:"userId"`
	ArtistID      uuid.UUID `json:"artistId"`
	ArtistName    string    `json:"artistName"`
	FestivalID    uuid.UUID `json:"festivalId"`
	PerformanceID uuid.UUID `json:"performanceId"`
	StageName     string    `json:"stageName"`
	StartTime     time.Time `json:"startTime"`
	MinutesBefore int       `json:"minutesBefore"`
}

// NewFavoriteArtistNotificationTask creates a new task for notifying users about their favorite artist
func NewFavoriteArtistNotificationTask(payload FavoriteArtistNotificationPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}
	return asynq.NewTask(TypeFavoriteArtistNotification, data), nil
}

// FavoritesNotificationScheduler handles scheduling notifications for favorite artists
type FavoritesNotificationScheduler struct {
	queueClient      *queue.Client
	favoritesService *FavoritesService
	lineupRepo       Repository
}

// NewFavoritesNotificationScheduler creates a new scheduler for favorites notifications
func NewFavoritesNotificationScheduler(
	queueClient *queue.Client,
	favoritesService *FavoritesService,
	lineupRepo Repository,
) *FavoritesNotificationScheduler {
	return &FavoritesNotificationScheduler{
		queueClient:      queueClient,
		favoritesService: favoritesService,
		lineupRepo:       lineupRepo,
	}
}

// SchedulePerformanceNotifications schedules notifications for all users who favorited an artist
// This should be called when a performance is created or when it's about to start
func (s *FavoritesNotificationScheduler) SchedulePerformanceNotifications(
	ctx context.Context,
	performance *Performance,
	minutesBefore []int,
) error {
	// Get all users who favorited this artist
	userIDs, err := s.favoritesService.GetUsersWhoFavoritedArtist(ctx, performance.ArtistID)
	if err != nil {
		return fmt.Errorf("failed to get users who favorited artist: %w", err)
	}

	if len(userIDs) == 0 {
		log.Debug().
			Str("artist_id", performance.ArtistID.String()).
			Msg("No users favorited this artist, skipping notifications")
		return nil
	}

	// Get artist details
	artist, err := s.lineupRepo.GetArtistByID(ctx, performance.ArtistID)
	if err != nil || artist == nil {
		return fmt.Errorf("failed to get artist: %w", err)
	}

	// Get stage details
	stage, err := s.lineupRepo.GetStageByID(ctx, performance.StageID)
	if err != nil || stage == nil {
		return fmt.Errorf("failed to get stage: %w", err)
	}

	// Default notification times if not specified
	if len(minutesBefore) == 0 {
		minutesBefore = []int{15, 5} // 15 minutes and 5 minutes before
	}

	now := time.Now()
	scheduledCount := 0

	for _, userID := range userIDs {
		for _, minutes := range minutesBefore {
			notifyAt := performance.StartTime.Add(-time.Duration(minutes) * time.Minute)

			// Skip if the notification time is in the past
			if notifyAt.Before(now) {
				continue
			}

			payload := FavoriteArtistNotificationPayload{
				UserID:        userID,
				ArtistID:      artist.ID,
				ArtistName:    artist.Name,
				FestivalID:    performance.FestivalID,
				PerformanceID: performance.ID,
				StageName:     stage.Name,
				StartTime:     performance.StartTime,
				MinutesBefore: minutes,
			}

			task, err := NewFavoriteArtistNotificationTask(payload)
			if err != nil {
				log.Error().Err(err).Msg("Failed to create notification task")
				continue
			}

			// Schedule the task
			_, err = s.queueClient.EnqueueScheduled(ctx, task, notifyAt,
				asynq.TaskID(fmt.Sprintf("fav_notif_%s_%s_%d", performance.ID, userID, minutes)),
				asynq.MaxRetry(3),
			)
			if err != nil {
				// Task might already exist, which is fine
				log.Debug().Err(err).
					Str("performance_id", performance.ID.String()).
					Str("user_id", userID.String()).
					Int("minutes_before", minutes).
					Msg("Failed to schedule notification (might already exist)")
				continue
			}

			scheduledCount++
		}
	}

	log.Info().
		Str("performance_id", performance.ID.String()).
		Str("artist_name", artist.Name).
		Int("user_count", len(userIDs)).
		Int("scheduled_count", scheduledCount).
		Msg("Scheduled favorite artist notifications")

	return nil
}

// CancelPerformanceNotifications cancels all scheduled notifications for a performance
// This should be called when a performance is cancelled or deleted
func (s *FavoritesNotificationScheduler) CancelPerformanceNotifications(
	ctx context.Context,
	performanceID uuid.UUID,
) error {
	// Note: Cancellation would require storing task IDs or using the Inspector
	// For now, we just log that this would cancel notifications
	log.Info().
		Str("performance_id", performanceID.String()).
		Msg("Would cancel scheduled notifications for performance")
	return nil
}

// FavoriteNotificationHandler handles the favorite artist notification task
type FavoriteNotificationHandler struct {
	// notificationService would be injected here for actually sending notifications
	// pushService PushNotificationService
}

// NewFavoriteNotificationHandler creates a new handler for favorite notifications
func NewFavoriteNotificationHandler() *FavoriteNotificationHandler {
	return &FavoriteNotificationHandler{}
}

// ProcessTask processes a favorite artist notification task
func (h *FavoriteNotificationHandler) ProcessTask(ctx context.Context, t *asynq.Task) error {
	var payload FavoriteArtistNotificationPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	// Build notification message
	var message string
	if payload.MinutesBefore == 0 {
		message = fmt.Sprintf("%s is performing now at %s!", payload.ArtistName, payload.StageName)
	} else {
		message = fmt.Sprintf("%s is performing in %d minutes at %s!",
			payload.ArtistName, payload.MinutesBefore, payload.StageName)
	}

	// In a real implementation, this would send a push notification
	// For now, we just log it
	log.Info().
		Str("user_id", payload.UserID.String()).
		Str("artist_name", payload.ArtistName).
		Str("stage_name", payload.StageName).
		Int("minutes_before", payload.MinutesBefore).
		Str("message", message).
		Msg("Would send favorite artist notification")

	// Example of what the actual implementation would look like:
	// return h.pushService.SendPush(ctx, payload.UserID, PushNotification{
	//     Title:   "Your favorite artist is coming up!",
	//     Body:    message,
	//     Data: map[string]string{
	//         "type":          "favorite_artist",
	//         "performanceId": payload.PerformanceID.String(),
	//         "artistId":      payload.ArtistID.String(),
	//     },
	// })

	return nil
}

// OnFavoriteAdded is called when a user adds a new favorite
// It schedules notifications for any upcoming performances of that artist
func (s *FavoritesNotificationScheduler) OnFavoriteAdded(
	ctx context.Context,
	userID uuid.UUID,
	artistID uuid.UUID,
	festivalID uuid.UUID,
) error {
	// Get upcoming performances for this artist
	performances, err := s.lineupRepo.GetArtistPerformances(ctx, artistID)
	if err != nil {
		return fmt.Errorf("failed to get artist performances: %w", err)
	}

	now := time.Now()
	minutesBefore := []int{15, 5}

	for _, perf := range performances {
		// Only schedule for future performances
		if perf.StartTime.Before(now) {
			continue
		}

		// Get stage info
		stage, err := s.lineupRepo.GetStageByID(ctx, perf.StageID)
		if err != nil || stage == nil {
			continue
		}

		// Get artist info
		artist, err := s.lineupRepo.GetArtistByID(ctx, perf.ArtistID)
		if err != nil || artist == nil {
			continue
		}

		for _, minutes := range minutesBefore {
			notifyAt := perf.StartTime.Add(-time.Duration(minutes) * time.Minute)

			if notifyAt.Before(now) {
				continue
			}

			payload := FavoriteArtistNotificationPayload{
				UserID:        userID,
				ArtistID:      artistID,
				ArtistName:    artist.Name,
				FestivalID:    festivalID,
				PerformanceID: perf.ID,
				StageName:     stage.Name,
				StartTime:     perf.StartTime,
				MinutesBefore: minutes,
			}

			task, err := NewFavoriteArtistNotificationTask(payload)
			if err != nil {
				continue
			}

			s.queueClient.EnqueueScheduled(ctx, task, notifyAt,
				asynq.TaskID(fmt.Sprintf("fav_notif_%s_%s_%d", perf.ID, userID, minutes)),
				asynq.MaxRetry(3),
			)
		}
	}

	return nil
}
