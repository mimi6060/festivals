package lineup

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// =====================
// Artist management
// =====================

// CreateArtist creates a new artist
func (s *Service) CreateArtist(ctx context.Context, festivalID uuid.UUID, req CreateArtistRequest) (*Artist, error) {
	socialLinks := SocialLinks{}
	if req.SocialLinks != nil {
		socialLinks = *req.SocialLinks
	}

	artist := &Artist{
		ID:          uuid.New(),
		FestivalID:  festivalID,
		Name:        req.Name,
		Description: req.Description,
		Genre:       req.Genre,
		ImageURL:    req.ImageURL,
		SocialLinks: socialLinks,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.repo.CreateArtist(ctx, artist); err != nil {
		return nil, fmt.Errorf("failed to create artist: %w", err)
	}

	return artist, nil
}

// GetArtistByID gets an artist by ID
func (s *Service) GetArtistByID(ctx context.Context, id uuid.UUID) (*Artist, error) {
	artist, err := s.repo.GetArtistByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if artist == nil {
		return nil, errors.ErrNotFound
	}
	return artist, nil
}

// ListArtists lists artists for a festival
func (s *Service) ListArtists(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]Artist, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListArtistsByFestival(ctx, festivalID, offset, perPage)
}

// SearchArtists searches artists by name or genre
func (s *Service) SearchArtists(ctx context.Context, festivalID uuid.UUID, query string) ([]Artist, error) {
	return s.repo.SearchArtists(ctx, festivalID, query)
}

// UpdateArtist updates an artist
func (s *Service) UpdateArtist(ctx context.Context, id uuid.UUID, req UpdateArtistRequest) (*Artist, error) {
	artist, err := s.repo.GetArtistByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if artist == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.Name != nil {
		artist.Name = *req.Name
	}
	if req.Description != nil {
		artist.Description = *req.Description
	}
	if req.Genre != nil {
		artist.Genre = *req.Genre
	}
	if req.ImageURL != nil {
		artist.ImageURL = *req.ImageURL
	}
	if req.SocialLinks != nil {
		artist.SocialLinks = *req.SocialLinks
	}

	artist.UpdatedAt = time.Now()

	if err := s.repo.UpdateArtist(ctx, artist); err != nil {
		return nil, fmt.Errorf("failed to update artist: %w", err)
	}

	return artist, nil
}

// DeleteArtist deletes an artist
func (s *Service) DeleteArtist(ctx context.Context, id uuid.UUID) error {
	artist, err := s.repo.GetArtistByID(ctx, id)
	if err != nil {
		return err
	}
	if artist == nil {
		return errors.ErrNotFound
	}

	// Check if artist has performances
	performances, err := s.repo.GetArtistPerformances(ctx, id)
	if err != nil {
		return err
	}
	if len(performances) > 0 {
		return fmt.Errorf("cannot delete artist with scheduled performances")
	}

	return s.repo.DeleteArtist(ctx, id)
}

// GetArtistPerformances gets all performances for an artist
func (s *Service) GetArtistPerformances(ctx context.Context, artistID uuid.UUID) ([]Performance, error) {
	// Verify artist exists
	artist, err := s.repo.GetArtistByID(ctx, artistID)
	if err != nil {
		return nil, err
	}
	if artist == nil {
		return nil, errors.ErrNotFound
	}

	return s.repo.GetArtistPerformances(ctx, artistID)
}

// =====================
// Stage management
// =====================

// CreateStage creates a new stage
func (s *Service) CreateStage(ctx context.Context, festivalID uuid.UUID, req CreateStageRequest) (*Stage, error) {
	settings := StageSettings{}
	if req.Settings != nil {
		settings = *req.Settings
	}

	stage := &Stage{
		ID:         uuid.New(),
		FestivalID: festivalID,
		Name:       req.Name,
		Location:   req.Location,
		Capacity:   req.Capacity,
		Settings:   settings,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := s.repo.CreateStage(ctx, stage); err != nil {
		return nil, fmt.Errorf("failed to create stage: %w", err)
	}

	return stage, nil
}

// GetStageByID gets a stage by ID
func (s *Service) GetStageByID(ctx context.Context, id uuid.UUID) (*Stage, error) {
	stage, err := s.repo.GetStageByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if stage == nil {
		return nil, errors.ErrNotFound
	}
	return stage, nil
}

// ListStages lists stages for a festival
func (s *Service) ListStages(ctx context.Context, festivalID uuid.UUID) ([]Stage, error) {
	return s.repo.ListStagesByFestival(ctx, festivalID)
}

// UpdateStage updates a stage
func (s *Service) UpdateStage(ctx context.Context, id uuid.UUID, req UpdateStageRequest) (*Stage, error) {
	stage, err := s.repo.GetStageByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if stage == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.Name != nil {
		stage.Name = *req.Name
	}
	if req.Location != nil {
		stage.Location = *req.Location
	}
	if req.Capacity != nil {
		stage.Capacity = *req.Capacity
	}
	if req.Settings != nil {
		stage.Settings = *req.Settings
	}

	stage.UpdatedAt = time.Now()

	if err := s.repo.UpdateStage(ctx, stage); err != nil {
		return nil, fmt.Errorf("failed to update stage: %w", err)
	}

	return stage, nil
}

// DeleteStage deletes a stage
func (s *Service) DeleteStage(ctx context.Context, id uuid.UUID) error {
	stage, err := s.repo.GetStageByID(ctx, id)
	if err != nil {
		return err
	}
	if stage == nil {
		return errors.ErrNotFound
	}

	// Check if stage has performances
	performances, err := s.repo.GetStagePerformances(ctx, id, "")
	if err != nil {
		return err
	}
	if len(performances) > 0 {
		return fmt.Errorf("cannot delete stage with scheduled performances")
	}

	return s.repo.DeleteStage(ctx, id)
}

// GetStagePerformances gets all performances for a stage
func (s *Service) GetStagePerformances(ctx context.Context, stageID uuid.UUID, day string) ([]Performance, error) {
	// Verify stage exists
	stage, err := s.repo.GetStageByID(ctx, stageID)
	if err != nil {
		return nil, err
	}
	if stage == nil {
		return nil, errors.ErrNotFound
	}

	return s.repo.GetStagePerformances(ctx, stageID, day)
}

// =====================
// Performance/Schedule management
// =====================

// CreatePerformance creates a new performance
func (s *Service) CreatePerformance(ctx context.Context, festivalID uuid.UUID, req CreatePerformanceRequest) (*Performance, error) {
	// Validate artist exists
	artist, err := s.repo.GetArtistByID(ctx, req.ArtistID)
	if err != nil {
		return nil, err
	}
	if artist == nil {
		return nil, fmt.Errorf("artist not found")
	}

	// Validate stage exists
	stage, err := s.repo.GetStageByID(ctx, req.StageID)
	if err != nil {
		return nil, err
	}
	if stage == nil {
		return nil, fmt.Errorf("stage not found")
	}

	// Validate time range
	if req.EndTime.Before(req.StartTime) || req.EndTime.Equal(req.StartTime) {
		return nil, fmt.Errorf("end time must be after start time")
	}

	// Check for conflicts (overlapping performances on same stage)
	conflicts, err := s.checkScheduleConflict(ctx, req.StageID, req.StartTime, req.EndTime, nil)
	if err != nil {
		return nil, err
	}
	if len(conflicts) > 0 {
		return nil, fmt.Errorf("schedule conflict: overlapping performance on the same stage")
	}

	performance := &Performance{
		ID:         uuid.New(),
		FestivalID: festivalID,
		ArtistID:   req.ArtistID,
		StageID:    req.StageID,
		StartTime:  req.StartTime,
		EndTime:    req.EndTime,
		Day:        req.Day,
		Status:     PerformanceStatusScheduled,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := s.repo.CreatePerformance(ctx, performance); err != nil {
		return nil, fmt.Errorf("failed to create performance: %w", err)
	}

	// Load relations for response
	performance.Artist = artist
	performance.Stage = stage

	return performance, nil
}

// GetPerformanceByID gets a performance by ID
func (s *Service) GetPerformanceByID(ctx context.Context, id uuid.UUID) (*Performance, error) {
	performance, err := s.repo.GetPerformanceByIDWithRelations(ctx, id)
	if err != nil {
		return nil, err
	}
	if performance == nil {
		return nil, errors.ErrNotFound
	}
	return performance, nil
}

// ListPerformances lists performances for a festival
func (s *Service) ListPerformances(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]Performance, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListPerformancesByFestival(ctx, festivalID, offset, perPage)
}

// UpdatePerformance updates a performance
func (s *Service) UpdatePerformance(ctx context.Context, id uuid.UUID, req UpdatePerformanceRequest) (*Performance, error) {
	performance, err := s.repo.GetPerformanceByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if performance == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.ArtistID != nil {
		// Validate artist exists
		artist, err := s.repo.GetArtistByID(ctx, *req.ArtistID)
		if err != nil {
			return nil, err
		}
		if artist == nil {
			return nil, fmt.Errorf("artist not found")
		}
		performance.ArtistID = *req.ArtistID
	}

	if req.StageID != nil {
		// Validate stage exists
		stage, err := s.repo.GetStageByID(ctx, *req.StageID)
		if err != nil {
			return nil, err
		}
		if stage == nil {
			return nil, fmt.Errorf("stage not found")
		}
		performance.StageID = *req.StageID
	}

	if req.StartTime != nil {
		performance.StartTime = *req.StartTime
	}
	if req.EndTime != nil {
		performance.EndTime = *req.EndTime
	}
	if req.Day != nil {
		performance.Day = *req.Day
	}
	if req.Status != nil {
		performance.Status = *req.Status
	}

	// Validate time range
	if performance.EndTime.Before(performance.StartTime) || performance.EndTime.Equal(performance.StartTime) {
		return nil, fmt.Errorf("end time must be after start time")
	}

	// Check for conflicts if stage or time changed
	if req.StageID != nil || req.StartTime != nil || req.EndTime != nil {
		conflicts, err := s.checkScheduleConflict(ctx, performance.StageID, performance.StartTime, performance.EndTime, &id)
		if err != nil {
			return nil, err
		}
		if len(conflicts) > 0 {
			return nil, fmt.Errorf("schedule conflict: overlapping performance on the same stage")
		}
	}

	performance.UpdatedAt = time.Now()

	if err := s.repo.UpdatePerformance(ctx, performance); err != nil {
		return nil, fmt.Errorf("failed to update performance: %w", err)
	}

	// Load relations for response
	return s.repo.GetPerformanceByIDWithRelations(ctx, id)
}

// DeletePerformance deletes a performance
func (s *Service) DeletePerformance(ctx context.Context, id uuid.UUID) error {
	performance, err := s.repo.GetPerformanceByID(ctx, id)
	if err != nil {
		return err
	}
	if performance == nil {
		return errors.ErrNotFound
	}

	return s.repo.DeletePerformance(ctx, id)
}

// UpdatePerformanceStatus updates the status of a performance
func (s *Service) UpdatePerformanceStatus(ctx context.Context, id uuid.UUID, status PerformanceStatus) (*Performance, error) {
	return s.UpdatePerformance(ctx, id, UpdatePerformanceRequest{Status: &status})
}

// =====================
// Lineup/Schedule queries
// =====================

// GetLineupByDay gets the lineup for a specific day
func (s *Service) GetLineupByDay(ctx context.Context, festivalID uuid.UUID, day string) (*DayScheduleResponse, error) {
	performances, err := s.repo.GetLineupByDay(ctx, festivalID, day)
	if err != nil {
		return nil, err
	}

	stages, err := s.repo.ListStagesByFestival(ctx, festivalID)
	if err != nil {
		return nil, err
	}

	stageResponses := make([]StageResponse, len(stages))
	for i, stage := range stages {
		stageResponses[i] = stage.ToResponse()
	}

	performanceResponses := make([]PerformanceResponse, len(performances))
	for i, p := range performances {
		performanceResponses[i] = p.ToResponse()
	}

	return &DayScheduleResponse{
		Day:          day,
		Stages:       stageResponses,
		Performances: performanceResponses,
	}, nil
}

// GetFullLineup gets the complete lineup for a festival
func (s *Service) GetFullLineup(ctx context.Context, festivalID uuid.UUID) (*LineupResponse, error) {
	// Get all days
	days, err := s.repo.GetAllDays(ctx, festivalID)
	if err != nil {
		return nil, err
	}

	// Get all stages
	stages, err := s.repo.ListStagesByFestival(ctx, festivalID)
	if err != nil {
		return nil, err
	}

	stageResponses := make([]StageResponse, len(stages))
	for i, stage := range stages {
		stageResponses[i] = stage.ToResponse()
	}

	// Build schedule by day
	schedule := make(map[string][]DaySlot)

	for _, day := range days {
		performances, err := s.repo.GetLineupByDay(ctx, festivalID, day)
		if err != nil {
			return nil, err
		}

		// Group performances by stage
		stagePerfs := make(map[uuid.UUID][]PerformanceResponse)
		for _, p := range performances {
			stagePerfs[p.StageID] = append(stagePerfs[p.StageID], p.ToResponse())
		}

		// Create day slots for each stage
		var daySlots []DaySlot
		for _, stage := range stages {
			daySlots = append(daySlots, DaySlot{
				Stage:        stage.ToResponse(),
				Performances: stagePerfs[stage.ID],
			})
		}
		schedule[day] = daySlots
	}

	return &LineupResponse{
		FestivalID: festivalID,
		Days:       days,
		Stages:     stageResponses,
		Schedule:   schedule,
	}, nil
}

// =====================
// Conflict detection
// =====================

// checkScheduleConflict checks if there are any overlapping performances on the same stage
func (s *Service) checkScheduleConflict(ctx context.Context, stageID uuid.UUID, startTime, endTime time.Time, excludeID *uuid.UUID) ([]Performance, error) {
	return s.repo.GetOverlappingPerformances(
		ctx,
		stageID,
		startTime.Format(time.RFC3339),
		endTime.Format(time.RFC3339),
		excludeID,
	)
}

// CheckConflicts checks for scheduling conflicts for a potential performance
func (s *Service) CheckConflicts(ctx context.Context, stageID uuid.UUID, startTime, endTime time.Time, excludeID *uuid.UUID) ([]Performance, error) {
	return s.checkScheduleConflict(ctx, stageID, startTime, endTime, excludeID)
}
