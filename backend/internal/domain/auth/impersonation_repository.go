package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// impersonationRepository implements ImpersonationRepository
type impersonationRepository struct {
	db *gorm.DB
}

// NewImpersonationRepository creates a new impersonation repository
func NewImpersonationRepository(db *gorm.DB) ImpersonationRepository {
	return &impersonationRepository{db: db}
}

func (r *impersonationRepository) CreateSession(ctx context.Context, session *ImpersonationSession) error {
	return r.db.WithContext(ctx).Create(session).Error
}

func (r *impersonationRepository) GetSessionByToken(ctx context.Context, token string) (*ImpersonationSession, error) {
	var session ImpersonationSession
	err := r.db.WithContext(ctx).Where("token = ?", token).First(&session).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get session by token: %w", err)
	}
	return &session, nil
}

func (r *impersonationRepository) GetSessionByID(ctx context.Context, id uuid.UUID) (*ImpersonationSession, error) {
	var session ImpersonationSession
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&session).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get session by ID: %w", err)
	}
	return &session, nil
}

func (r *impersonationRepository) GetActiveSessionByAdmin(ctx context.Context, adminID uuid.UUID) (*ImpersonationSession, error) {
	var session ImpersonationSession
	err := r.db.WithContext(ctx).
		Where("admin_id = ? AND is_active = ? AND ended_at IS NULL AND expires_at > ?", adminID, true, time.Now()).
		First(&session).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get active session: %w", err)
	}
	return &session, nil
}

func (r *impersonationRepository) UpdateSession(ctx context.Context, session *ImpersonationSession) error {
	return r.db.WithContext(ctx).Save(session).Error
}

func (r *impersonationRepository) ListActiveSessions(ctx context.Context) ([]ImpersonationSession, error) {
	var sessions []ImpersonationSession
	err := r.db.WithContext(ctx).
		Where("is_active = ? AND ended_at IS NULL AND expires_at > ?", true, time.Now()).
		Order("started_at DESC").
		Find(&sessions).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list active sessions: %w", err)
	}
	return sessions, nil
}

func (r *impersonationRepository) EndSession(ctx context.Context, token string) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&ImpersonationSession{}).
		Where("token = ?", token).
		Updates(map[string]interface{}{
			"is_active": false,
			"ended_at":  now,
			"updated_at": now,
		}).Error
}

func (r *impersonationRepository) IncrementActionsCount(ctx context.Context, sessionID uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&ImpersonationSession{}).
		Where("id = ?", sessionID).
		UpdateColumn("actions_count", gorm.Expr("actions_count + ?", 1)).Error
}

func (r *impersonationRepository) CleanupExpiredSessions(ctx context.Context) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&ImpersonationSession{}).
		Where("is_active = ? AND expires_at < ?", true, now).
		Updates(map[string]interface{}{
			"is_active":  false,
			"updated_at": now,
		}).Error
}

func (r *impersonationRepository) CreateAuditLog(ctx context.Context, log *ImpersonationAuditLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

// DefaultUserInfoProvider provides a default implementation of UserInfoProvider
// This should be replaced with actual user service in production
type DefaultUserInfoProvider struct {
	db *gorm.DB
}

// NewDefaultUserInfoProvider creates a new default user info provider
func NewDefaultUserInfoProvider(db *gorm.DB) UserInfoProvider {
	return &DefaultUserInfoProvider{db: db}
}

// Simple user struct for querying
type userInfo struct {
	Email string
	Name  string
}

func (p *DefaultUserInfoProvider) GetUserEmail(ctx context.Context, userID uuid.UUID) (string, error) {
	var info userInfo
	// This assumes a users table exists with id, email columns
	err := p.db.WithContext(ctx).
		Table("users").
		Select("email").
		Where("id = ?", userID).
		First(&info).Error
	if err != nil {
		return "", err
	}
	return info.Email, nil
}

func (p *DefaultUserInfoProvider) GetUserName(ctx context.Context, userID uuid.UUID) (string, error) {
	var info userInfo
	// This assumes a users table exists with id, name columns
	err := p.db.WithContext(ctx).
		Table("users").
		Select("name").
		Where("id = ?", userID).
		First(&info).Error
	if err != nil {
		return "", err
	}
	return info.Name, nil
}

func (p *DefaultUserInfoProvider) IsSuperAdmin(ctx context.Context, userID uuid.UUID) bool {
	// Check role assignments for SUPER_ADMIN role
	var count int64
	p.db.WithContext(ctx).
		Table("role_assignments ra").
		Joins("JOIN roles r ON ra.role_id = r.id").
		Where("ra.user_id = ? AND r.name = ? AND ra.is_active = ?", userID, string(RoleSuperAdmin), true).
		Count(&count)
	return count > 0
}
