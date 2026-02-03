package admin

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for admin data operations
type Repository interface {
	// SuperAdmin operations
	CreateSuperAdmin(ctx context.Context, admin *SuperAdmin) error
	GetSuperAdminByID(ctx context.Context, id uuid.UUID) (*SuperAdmin, error)
	GetSuperAdminByUserID(ctx context.Context, userID uuid.UUID) (*SuperAdmin, error)
	GetAllSuperAdmins(ctx context.Context) ([]SuperAdmin, error)
	UpdateSuperAdmin(ctx context.Context, admin *SuperAdmin) error
	DeleteSuperAdmin(ctx context.Context, id uuid.UUID) error

	// PlatformSettings operations
	CreateSetting(ctx context.Context, setting *PlatformSettings) error
	GetSettingByKey(ctx context.Context, key string) (*PlatformSettings, error)
	GetAllSettings(ctx context.Context) ([]PlatformSettings, error)
	UpdateSetting(ctx context.Context, setting *PlatformSettings) error
	DeleteSetting(ctx context.Context, key string) error

	// AuditLog operations
	CreateAuditLog(ctx context.Context, log *AuditLog) error
	GetAuditLogs(ctx context.Context, filter AuditLogFilter) ([]AuditLog, int64, error)
	GetAuditLogByID(ctx context.Context, id uuid.UUID) (*AuditLog, error)

	// Metrics operations
	GetSystemMetrics(ctx context.Context) (*SystemMetrics, error)
}
