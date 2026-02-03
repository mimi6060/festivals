package lineup

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	// Artist operations
	CreateArtist(ctx context.Context, artist *Artist) error
	GetArtistByID(ctx context.Context, id uuid.UUID) (*Artist, error)
	ListArtistsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Artist, int64, error)
	UpdateArtist(ctx context.Context, artist *Artist) error
	DeleteArtist(ctx context.Context, id uuid.UUID) error
	SearchArtists(ctx context.Context, festivalID uuid.UUID, query string) ([]Artist, error)

	// Stage operations
	CreateStage(ctx context.Context, stage *Stage) error
	GetStageByID(ctx context.Context, id uuid.UUID) (*Stage, error)
	ListStagesByFestival(ctx context.Context, festivalID uuid.UUID) ([]Stage, error)
	UpdateStage(ctx context.Context, stage *Stage) error
	DeleteStage(ctx context.Context, id uuid.UUID) error

	// Performance operations
	CreatePerformance(ctx context.Context, performance *Performance) error
	GetPerformanceByID(ctx context.Context, id uuid.UUID) (*Performance, error)
	GetPerformanceByIDWithRelations(ctx context.Context, id uuid.UUID) (*Performance, error)
	ListPerformancesByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Performance, int64, error)
	UpdatePerformance(ctx context.Context, performance *Performance) error
	DeletePerformance(ctx context.Context, id uuid.UUID) error

	// Schedule queries
	GetLineupByDay(ctx context.Context, festivalID uuid.UUID, day string) ([]Performance, error)
	GetArtistPerformances(ctx context.Context, artistID uuid.UUID) ([]Performance, error)
	GetStagePerformances(ctx context.Context, stageID uuid.UUID, day string) ([]Performance, error)
	GetOverlappingPerformances(ctx context.Context, stageID uuid.UUID, startTime, endTime string, excludeID *uuid.UUID) ([]Performance, error)
	GetAllDays(ctx context.Context, festivalID uuid.UUID) ([]string, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// =====================
// Artist operations
// =====================

func (r *repository) CreateArtist(ctx context.Context, artist *Artist) error {
	return r.db.WithContext(ctx).Create(artist).Error
}

func (r *repository) GetArtistByID(ctx context.Context, id uuid.UUID) (*Artist, error) {
	var artist Artist
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&artist).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get artist: %w", err)
	}
	return &artist, nil
}

func (r *repository) ListArtistsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Artist, int64, error) {
	var artists []Artist
	var total int64

	query := r.db.WithContext(ctx).Model(&Artist{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count artists: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("name ASC").Find(&artists).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list artists: %w", err)
	}

	return artists, total, nil
}

func (r *repository) UpdateArtist(ctx context.Context, artist *Artist) error {
	return r.db.WithContext(ctx).Save(artist).Error
}

func (r *repository) DeleteArtist(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&Artist{}).Error
}

func (r *repository) SearchArtists(ctx context.Context, festivalID uuid.UUID, query string) ([]Artist, error) {
	var artists []Artist
	searchPattern := "%" + query + "%"
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND (name ILIKE ? OR genre ILIKE ?)", festivalID, searchPattern, searchPattern).
		Order("name ASC").
		Limit(50).
		Find(&artists).Error
	if err != nil {
		return nil, fmt.Errorf("failed to search artists: %w", err)
	}
	return artists, nil
}

// =====================
// Stage operations
// =====================

func (r *repository) CreateStage(ctx context.Context, stage *Stage) error {
	return r.db.WithContext(ctx).Create(stage).Error
}

func (r *repository) GetStageByID(ctx context.Context, id uuid.UUID) (*Stage, error) {
	var stage Stage
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&stage).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get stage: %w", err)
	}
	return &stage, nil
}

func (r *repository) ListStagesByFestival(ctx context.Context, festivalID uuid.UUID) ([]Stage, error) {
	var stages []Stage
	err := r.db.WithContext(ctx).
		Where("festival_id = ?", festivalID).
		Order("name ASC").
		Find(&stages).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list stages: %w", err)
	}
	return stages, nil
}

func (r *repository) UpdateStage(ctx context.Context, stage *Stage) error {
	return r.db.WithContext(ctx).Save(stage).Error
}

func (r *repository) DeleteStage(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&Stage{}).Error
}

// =====================
// Performance operations
// =====================

func (r *repository) CreatePerformance(ctx context.Context, performance *Performance) error {
	return r.db.WithContext(ctx).Create(performance).Error
}

func (r *repository) GetPerformanceByID(ctx context.Context, id uuid.UUID) (*Performance, error) {
	var performance Performance
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&performance).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get performance: %w", err)
	}
	return &performance, nil
}

func (r *repository) GetPerformanceByIDWithRelations(ctx context.Context, id uuid.UUID) (*Performance, error) {
	var performance Performance
	err := r.db.WithContext(ctx).
		Preload("Artist").
		Preload("Stage").
		Where("id = ?", id).
		First(&performance).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get performance: %w", err)
	}
	return &performance, nil
}

func (r *repository) ListPerformancesByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Performance, int64, error) {
	var performances []Performance
	var total int64

	query := r.db.WithContext(ctx).Model(&Performance{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count performances: %w", err)
	}

	if err := query.
		Preload("Artist").
		Preload("Stage").
		Offset(offset).
		Limit(limit).
		Order("day ASC, start_time ASC").
		Find(&performances).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list performances: %w", err)
	}

	return performances, total, nil
}

func (r *repository) UpdatePerformance(ctx context.Context, performance *Performance) error {
	return r.db.WithContext(ctx).Save(performance).Error
}

func (r *repository) DeletePerformance(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&Performance{}).Error
}

// =====================
// Schedule queries
// =====================

func (r *repository) GetLineupByDay(ctx context.Context, festivalID uuid.UUID, day string) ([]Performance, error) {
	var performances []Performance
	err := r.db.WithContext(ctx).
		Preload("Artist").
		Preload("Stage").
		Where("festival_id = ? AND day = ?", festivalID, day).
		Order("start_time ASC, stage_id ASC").
		Find(&performances).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get lineup by day: %w", err)
	}
	return performances, nil
}

func (r *repository) GetArtistPerformances(ctx context.Context, artistID uuid.UUID) ([]Performance, error) {
	var performances []Performance
	err := r.db.WithContext(ctx).
		Preload("Stage").
		Where("artist_id = ?", artistID).
		Order("day ASC, start_time ASC").
		Find(&performances).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get artist performances: %w", err)
	}
	return performances, nil
}

func (r *repository) GetStagePerformances(ctx context.Context, stageID uuid.UUID, day string) ([]Performance, error) {
	var performances []Performance
	query := r.db.WithContext(ctx).
		Preload("Artist").
		Where("stage_id = ?", stageID)

	if day != "" {
		query = query.Where("day = ?", day)
	}

	err := query.Order("day ASC, start_time ASC").Find(&performances).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get stage performances: %w", err)
	}
	return performances, nil
}

func (r *repository) GetOverlappingPerformances(ctx context.Context, stageID uuid.UUID, startTime, endTime string, excludeID *uuid.UUID) ([]Performance, error) {
	var performances []Performance
	query := r.db.WithContext(ctx).
		Where("stage_id = ?", stageID).
		Where("NOT (end_time <= ? OR start_time >= ?)", startTime, endTime)

	if excludeID != nil {
		query = query.Where("id != ?", *excludeID)
	}

	err := query.Find(&performances).Error
	if err != nil {
		return nil, fmt.Errorf("failed to check overlapping performances: %w", err)
	}
	return performances, nil
}

func (r *repository) GetAllDays(ctx context.Context, festivalID uuid.UUID) ([]string, error) {
	var days []string
	err := r.db.WithContext(ctx).
		Model(&Performance{}).
		Where("festival_id = ?", festivalID).
		Distinct("day").
		Order("day ASC").
		Pluck("day", &days).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get all days: %w", err)
	}
	return days, nil
}
