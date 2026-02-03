package security

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository defines the interface for security alert data access
type Repository interface {
	// Alert operations
	CreateAlert(ctx context.Context, alert *Alert) error
	GetAlertByID(ctx context.Context, id uuid.UUID) (*Alert, error)
	GetAlertsByFestival(ctx context.Context, festivalID uuid.UUID, filters AlertFilters, offset, limit int) ([]Alert, int64, error)
	GetActiveAlerts(ctx context.Context, festivalID uuid.UUID) ([]Alert, error)
	GetAlertsByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]Alert, int64, error)
	UpdateAlert(ctx context.Context, alert *Alert) error
	DeleteAlert(ctx context.Context, id uuid.UUID) error
	GetAlertStats(ctx context.Context, festivalID uuid.UUID) (*AlertStats, error)
	GetRecentSOSByUser(ctx context.Context, userID uuid.UUID, since time.Time) (*Alert, error)

	// Security zone operations
	CreateZone(ctx context.Context, zone *SecurityZone) error
	GetZoneByID(ctx context.Context, id uuid.UUID) (*SecurityZone, error)
	GetZonesByFestival(ctx context.Context, festivalID uuid.UUID) ([]SecurityZone, error)
	UpdateZone(ctx context.Context, zone *SecurityZone) error
	DeleteZone(ctx context.Context, id uuid.UUID) error
}

// AlertFilters defines filters for querying alerts
type AlertFilters struct {
	Types      []AlertType
	Severities []AlertSeverity
	Statuses   []AlertStatus
	AssignedTo *uuid.UUID
	FromDate   *time.Time
	ToDate     *time.Time
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new security repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Alert operations

func (r *repository) CreateAlert(ctx context.Context, alert *Alert) error {
	return r.db.WithContext(ctx).Create(alert).Error
}

func (r *repository) GetAlertByID(ctx context.Context, id uuid.UUID) (*Alert, error) {
	var alert Alert
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&alert).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get alert: %w", err)
	}
	return &alert, nil
}

func (r *repository) GetAlertsByFestival(ctx context.Context, festivalID uuid.UUID, filters AlertFilters, offset, limit int) ([]Alert, int64, error) {
	var alerts []Alert
	var total int64

	query := r.db.WithContext(ctx).Model(&Alert{}).Where("festival_id = ?", festivalID)

	// Apply filters
	if len(filters.Types) > 0 {
		query = query.Where("type IN ?", filters.Types)
	}
	if len(filters.Severities) > 0 {
		query = query.Where("severity IN ?", filters.Severities)
	}
	if len(filters.Statuses) > 0 {
		query = query.Where("status IN ?", filters.Statuses)
	}
	if filters.AssignedTo != nil {
		query = query.Where("assigned_to = ?", filters.AssignedTo)
	}
	if filters.FromDate != nil {
		query = query.Where("created_at >= ?", filters.FromDate)
	}
	if filters.ToDate != nil {
		query = query.Where("created_at <= ?", filters.ToDate)
	}

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count alerts: %w", err)
	}

	// Get results with pagination
	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&alerts).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list alerts: %w", err)
	}

	return alerts, total, nil
}

func (r *repository) GetActiveAlerts(ctx context.Context, festivalID uuid.UUID) ([]Alert, error) {
	var alerts []Alert
	err := r.db.WithContext(ctx).
		Where("festival_id = ?", festivalID).
		Where("status IN ?", []AlertStatus{AlertStatusPending, AlertStatusAcknowledged, AlertStatusInProgress}).
		Order("CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END").
		Order("created_at ASC").
		Find(&alerts).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get active alerts: %w", err)
	}
	return alerts, nil
}

func (r *repository) GetAlertsByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]Alert, int64, error) {
	var alerts []Alert
	var total int64

	query := r.db.WithContext(ctx).Model(&Alert{}).Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count user alerts: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&alerts).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list user alerts: %w", err)
	}

	return alerts, total, nil
}

func (r *repository) UpdateAlert(ctx context.Context, alert *Alert) error {
	return r.db.WithContext(ctx).Save(alert).Error
}

func (r *repository) DeleteAlert(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&Alert{}).Error
}

func (r *repository) GetAlertStats(ctx context.Context, festivalID uuid.UUID) (*AlertStats, error) {
	stats := &AlertStats{}

	// Total alerts
	if err := r.db.WithContext(ctx).Model(&Alert{}).Where("festival_id = ?", festivalID).Count(&stats.TotalAlerts).Error; err != nil {
		return nil, fmt.Errorf("failed to count total alerts: %w", err)
	}

	// Pending alerts
	if err := r.db.WithContext(ctx).Model(&Alert{}).
		Where("festival_id = ? AND status = ?", festivalID, AlertStatusPending).
		Count(&stats.PendingAlerts).Error; err != nil {
		return nil, fmt.Errorf("failed to count pending alerts: %w", err)
	}

	// In progress alerts
	if err := r.db.WithContext(ctx).Model(&Alert{}).
		Where("festival_id = ? AND status = ?", festivalID, AlertStatusInProgress).
		Count(&stats.InProgressAlerts).Error; err != nil {
		return nil, fmt.Errorf("failed to count in-progress alerts: %w", err)
	}

	// Resolved alerts
	if err := r.db.WithContext(ctx).Model(&Alert{}).
		Where("festival_id = ? AND status = ?", festivalID, AlertStatusResolved).
		Count(&stats.ResolvedAlerts).Error; err != nil {
		return nil, fmt.Errorf("failed to count resolved alerts: %w", err)
	}

	// Critical alerts
	if err := r.db.WithContext(ctx).Model(&Alert{}).
		Where("festival_id = ? AND severity = ? AND status NOT IN ?", festivalID, AlertSeverityCritical, []AlertStatus{AlertStatusResolved, AlertStatusCancelled}).
		Count(&stats.CriticalAlerts).Error; err != nil {
		return nil, fmt.Errorf("failed to count critical alerts: %w", err)
	}

	// High alerts
	if err := r.db.WithContext(ctx).Model(&Alert{}).
		Where("festival_id = ? AND severity = ? AND status NOT IN ?", festivalID, AlertSeverityHigh, []AlertStatus{AlertStatusResolved, AlertStatusCancelled}).
		Count(&stats.HighAlerts).Error; err != nil {
		return nil, fmt.Errorf("failed to count high alerts: %w", err)
	}

	// Average response time (time from creation to acknowledgement)
	var avgResponseTime *float64
	err := r.db.WithContext(ctx).Model(&Alert{}).
		Select("AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at)))").
		Where("festival_id = ? AND acknowledged_at IS NOT NULL", festivalID).
		Scan(&avgResponseTime).Error
	if err != nil {
		return nil, fmt.Errorf("failed to calculate average response time: %w", err)
	}
	if avgResponseTime != nil {
		stats.AverageResponseTime = *avgResponseTime
	}

	return stats, nil
}

func (r *repository) GetRecentSOSByUser(ctx context.Context, userID uuid.UUID, since time.Time) (*Alert, error) {
	var alert Alert
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND type = ? AND created_at >= ?", userID, AlertTypeSOS, since).
		Order("created_at DESC").
		First(&alert).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get recent SOS: %w", err)
	}
	return &alert, nil
}

// Security zone operations

func (r *repository) CreateZone(ctx context.Context, zone *SecurityZone) error {
	return r.db.WithContext(ctx).Create(zone).Error
}

func (r *repository) GetZoneByID(ctx context.Context, id uuid.UUID) (*SecurityZone, error) {
	var zone SecurityZone
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&zone).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get zone: %w", err)
	}
	return &zone, nil
}

func (r *repository) GetZonesByFestival(ctx context.Context, festivalID uuid.UUID) ([]SecurityZone, error) {
	var zones []SecurityZone
	err := r.db.WithContext(ctx).
		Where("festival_id = ?", festivalID).
		Order("name ASC").
		Find(&zones).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get zones: %w", err)
	}
	return zones, nil
}

func (r *repository) UpdateZone(ctx context.Context, zone *SecurityZone) error {
	return r.db.WithContext(ctx).Save(zone).Error
}

func (r *repository) DeleteZone(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&SecurityZone{}).Error
}
