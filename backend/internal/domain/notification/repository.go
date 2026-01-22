package notification

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository defines the interface for notification data access
type Repository interface {
	// Preferences operations
	GetPreferencesByUserID(ctx context.Context, userID uuid.UUID) (*NotificationPreferences, error)
	CreatePreferences(ctx context.Context, prefs *NotificationPreferences) error
	UpdatePreferences(ctx context.Context, prefs *NotificationPreferences) error

	// Email log operations
	CreateEmailLog(ctx context.Context, log *EmailLog) error
	UpdateEmailLog(ctx context.Context, log *EmailLog) error
	GetEmailLogByID(ctx context.Context, id uuid.UUID) (*EmailLog, error)
	GetEmailLogByMessageID(ctx context.Context, messageID string) (*EmailLog, error)
	GetEmailLogsByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]EmailLog, int64, error)
	GetEmailLogsByStatus(ctx context.Context, status EmailLogStatus, offset, limit int) ([]EmailLog, int64, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new notification repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// GetPreferencesByUserID retrieves notification preferences for a user
func (r *repository) GetPreferencesByUserID(ctx context.Context, userID uuid.UUID) (*NotificationPreferences, error) {
	var prefs NotificationPreferences
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&prefs).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get preferences: %w", err)
	}
	return &prefs, nil
}

// CreatePreferences creates new notification preferences
func (r *repository) CreatePreferences(ctx context.Context, prefs *NotificationPreferences) error {
	return r.db.WithContext(ctx).Create(prefs).Error
}

// UpdatePreferences updates notification preferences
func (r *repository) UpdatePreferences(ctx context.Context, prefs *NotificationPreferences) error {
	return r.db.WithContext(ctx).Save(prefs).Error
}

// CreateEmailLog creates a new email log entry
func (r *repository) CreateEmailLog(ctx context.Context, log *EmailLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

// UpdateEmailLog updates an email log entry
func (r *repository) UpdateEmailLog(ctx context.Context, log *EmailLog) error {
	return r.db.WithContext(ctx).Save(log).Error
}

// GetEmailLogByID retrieves an email log by ID
func (r *repository) GetEmailLogByID(ctx context.Context, id uuid.UUID) (*EmailLog, error) {
	var log EmailLog
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&log).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get email log: %w", err)
	}
	return &log, nil
}

// GetEmailLogByMessageID retrieves an email log by external message ID
func (r *repository) GetEmailLogByMessageID(ctx context.Context, messageID string) (*EmailLog, error) {
	var log EmailLog
	err := r.db.WithContext(ctx).Where("message_id = ?", messageID).First(&log).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get email log: %w", err)
	}
	return &log, nil
}

// GetEmailLogsByUser retrieves email logs for a user with pagination
func (r *repository) GetEmailLogsByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]EmailLog, int64, error) {
	var logs []EmailLog
	var total int64

	query := r.db.WithContext(ctx).Model(&EmailLog{}).Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count email logs: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&logs).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list email logs: %w", err)
	}

	return logs, total, nil
}

// GetEmailLogsByStatus retrieves email logs by status with pagination
func (r *repository) GetEmailLogsByStatus(ctx context.Context, status EmailLogStatus, offset, limit int) ([]EmailLog, int64, error) {
	var logs []EmailLog
	var total int64

	query := r.db.WithContext(ctx).Model(&EmailLog{}).Where("status = ?", status)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count email logs: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&logs).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list email logs: %w", err)
	}

	return logs, total, nil
}
