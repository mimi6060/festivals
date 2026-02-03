package admin

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Default query timeout for admin operations
const defaultQueryTimeout = 10 * time.Second

type postgresRepository struct {
	db *gorm.DB
}

// NewPostgresRepository creates a new PostgreSQL repository for admin operations
func NewPostgresRepository(db *gorm.DB) Repository {
	return &postgresRepository{db: db}
}

// withTimeout creates a context with the default query timeout
func (r *postgresRepository) withTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, defaultQueryTimeout)
}

// SuperAdmin operations

func (r *postgresRepository) CreateSuperAdmin(ctx context.Context, admin *SuperAdmin) error {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	return r.db.WithContext(ctx).Create(admin).Error
}

func (r *postgresRepository) GetSuperAdminByID(ctx context.Context, id uuid.UUID) (*SuperAdmin, error) {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	var admin SuperAdmin
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&admin).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get super admin: %w", err)
	}
	return &admin, nil
}

func (r *postgresRepository) GetSuperAdminByUserID(ctx context.Context, userID uuid.UUID) (*SuperAdmin, error) {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	var admin SuperAdmin
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&admin).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get super admin by user ID: %w", err)
	}
	return &admin, nil
}

func (r *postgresRepository) GetAllSuperAdmins(ctx context.Context) ([]SuperAdmin, error) {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	var admins []SuperAdmin
	err := r.db.WithContext(ctx).Order("created_at DESC").Find(&admins).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get super admins: %w", err)
	}
	return admins, nil
}

func (r *postgresRepository) UpdateSuperAdmin(ctx context.Context, admin *SuperAdmin) error {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	admin.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Save(admin).Error
}

func (r *postgresRepository) DeleteSuperAdmin(ctx context.Context, id uuid.UUID) error {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	result := r.db.WithContext(ctx).Where("id = ?", id).Delete(&SuperAdmin{})
	if result.Error != nil {
		return fmt.Errorf("failed to delete super admin: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("super admin not found")
	}
	return nil
}

// PlatformSettings operations

func (r *postgresRepository) CreateSetting(ctx context.Context, setting *PlatformSettings) error {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	return r.db.WithContext(ctx).Create(setting).Error
}

func (r *postgresRepository) GetSettingByKey(ctx context.Context, key string) (*PlatformSettings, error) {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	var setting PlatformSettings
	err := r.db.WithContext(ctx).Where("key = ?", key).First(&setting).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get setting: %w", err)
	}
	return &setting, nil
}

func (r *postgresRepository) GetAllSettings(ctx context.Context) ([]PlatformSettings, error) {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	var settings []PlatformSettings
	err := r.db.WithContext(ctx).Order("key ASC").Find(&settings).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get settings: %w", err)
	}
	return settings, nil
}

func (r *postgresRepository) UpdateSetting(ctx context.Context, setting *PlatformSettings) error {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	setting.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Save(setting).Error
}

func (r *postgresRepository) DeleteSetting(ctx context.Context, key string) error {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	result := r.db.WithContext(ctx).Where("key = ?", key).Delete(&PlatformSettings{})
	if result.Error != nil {
		return fmt.Errorf("failed to delete setting: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("setting not found")
	}
	return nil
}

// AuditLog operations

func (r *postgresRepository) CreateAuditLog(ctx context.Context, log *AuditLog) error {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	return r.db.WithContext(ctx).Create(log).Error
}

func (r *postgresRepository) GetAuditLogs(ctx context.Context, filter AuditLogFilter) ([]AuditLog, int64, error) {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	var logs []AuditLog
	var total int64

	query := r.db.WithContext(ctx).Model(&AuditLog{})

	// Apply filters
	if filter.AdminID != nil {
		query = query.Where("admin_id = ?", *filter.AdminID)
	}
	if filter.Action != "" {
		query = query.Where("action = ?", filter.Action)
	}
	if filter.ResourceType != "" {
		query = query.Where("resource_type = ?", filter.ResourceType)
	}
	if filter.ResourceID != nil {
		query = query.Where("resource_id = ?", *filter.ResourceID)
	}
	if filter.StartDate != nil {
		query = query.Where("created_at >= ?", *filter.StartDate)
	}
	if filter.EndDate != nil {
		query = query.Where("created_at < ?", *filter.EndDate)
	}

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count audit logs: %w", err)
	}

	// Apply pagination
	page := filter.Page
	perPage := filter.PerPage
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	// Fetch data
	if err := query.Order("created_at DESC").Offset(offset).Limit(perPage).Find(&logs).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to get audit logs: %w", err)
	}

	return logs, total, nil
}

func (r *postgresRepository) GetAuditLogByID(ctx context.Context, id uuid.UUID) (*AuditLog, error) {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	var log AuditLog
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&log).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get audit log: %w", err)
	}
	return &log, nil
}

// GetSystemMetrics retrieves aggregated platform metrics
func (r *postgresRepository) GetSystemMetrics(ctx context.Context) (*SystemMetrics, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second) // Longer timeout for aggregation
	defer cancel()

	var metrics SystemMetrics

	// Get festival counts
	// Active festivals: status = 'ACTIVE' or 'ONGOING'
	if err := r.db.WithContext(ctx).
		Table("festivals").
		Where("status IN ('ACTIVE', 'ONGOING')").
		Count(&metrics.ActiveFestivals).Error; err != nil {
		return nil, fmt.Errorf("failed to count active festivals: %w", err)
	}

	// Total festivals
	if err := r.db.WithContext(ctx).
		Table("festivals").
		Count(&metrics.TotalFestivals).Error; err != nil {
		return nil, fmt.Errorf("failed to count total festivals: %w", err)
	}

	// Total users
	if err := r.db.WithContext(ctx).
		Table("users").
		Count(&metrics.TotalUsers).Error; err != nil {
		return nil, fmt.Errorf("failed to count users: %w", err)
	}

	// Total transactions
	if err := r.db.WithContext(ctx).
		Table("transactions").
		Count(&metrics.TotalTransactions).Error; err != nil {
		return nil, fmt.Errorf("failed to count transactions: %w", err)
	}

	// Revenue today (sum of completed top-up transactions for today)
	today := time.Now().Truncate(24 * time.Hour)
	tomorrow := today.Add(24 * time.Hour)
	if err := r.db.WithContext(ctx).
		Table("transactions").
		Select("COALESCE(SUM(amount), 0)").
		Where("type IN ('TOP_UP', 'CASH_IN') AND status = 'COMPLETED' AND created_at >= ? AND created_at < ?", today, tomorrow).
		Scan(&metrics.RevenueToday).Error; err != nil {
		return nil, fmt.Errorf("failed to calculate today's revenue: %w", err)
	}

	// Revenue this month
	firstOfMonth := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)
	nextMonth := firstOfMonth.AddDate(0, 1, 0)
	if err := r.db.WithContext(ctx).
		Table("transactions").
		Select("COALESCE(SUM(amount), 0)").
		Where("type IN ('TOP_UP', 'CASH_IN') AND status = 'COMPLETED' AND created_at >= ? AND created_at < ?", firstOfMonth, nextMonth).
		Scan(&metrics.RevenueThisMonth).Error; err != nil {
		return nil, fmt.Errorf("failed to calculate monthly revenue: %w", err)
	}

	// Active wallets (wallets with status = 'ACTIVE')
	if err := r.db.WithContext(ctx).
		Table("wallets").
		Where("status = 'ACTIVE'").
		Count(&metrics.ActiveWallets).Error; err != nil {
		return nil, fmt.Errorf("failed to count active wallets: %w", err)
	}

	// Total tickets sold
	if err := r.db.WithContext(ctx).
		Table("tickets").
		Where("status IN ('VALID', 'USED')").
		Count(&metrics.TotalTicketsSold).Error; err != nil {
		return nil, fmt.Errorf("failed to count tickets sold: %w", err)
	}

	return &metrics, nil
}
