package audit

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository defines the interface for audit log data access
type Repository interface {
	Create(ctx context.Context, log *AuditLog) error
	CreateBatch(ctx context.Context, logs []*AuditLog) error
	GetByID(ctx context.Context, id uuid.UUID) (*AuditLog, error)
	List(ctx context.Context, filter AuditLogFilter, offset, limit int) ([]AuditLog, int64, error)
	GetByUserID(ctx context.Context, userID uuid.UUID, offset, limit int) ([]AuditLog, int64, error)
	GetByResource(ctx context.Context, resource, resourceID string, offset, limit int) ([]AuditLog, int64, error)
	GetByFestivalID(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]AuditLog, int64, error)
	GetByAction(ctx context.Context, action AuditAction, offset, limit int) ([]AuditLog, int64, error)
	GetByTimeRange(ctx context.Context, start, end time.Time, offset, limit int) ([]AuditLog, int64, error)
	GetStats(ctx context.Context, filter AuditLogFilter) (*AuditLogStats, error)
	GetActionCounts(ctx context.Context, filter AuditLogFilter) (map[AuditAction]int64, error)
	GetUniqueUserCount(ctx context.Context, filter AuditLogFilter) (int64, error)
	DeleteOlderThan(ctx context.Context, before time.Time) (int64, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new audit log repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, log *AuditLog) error {
	if log.ID == uuid.Nil {
		log.ID = uuid.New()
	}
	if log.Timestamp.IsZero() {
		log.Timestamp = time.Now()
	}
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *repository) CreateBatch(ctx context.Context, logs []*AuditLog) error {
	if len(logs) == 0 {
		return nil
	}

	now := time.Now()
	for _, log := range logs {
		if log.ID == uuid.Nil {
			log.ID = uuid.New()
		}
		if log.Timestamp.IsZero() {
			log.Timestamp = now
		}
	}

	return r.db.WithContext(ctx).CreateInBatches(logs, 100).Error
}

func (r *repository) GetByID(ctx context.Context, id uuid.UUID) (*AuditLog, error) {
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

func (r *repository) List(ctx context.Context, filter AuditLogFilter, offset, limit int) ([]AuditLog, int64, error) {
	var logs []AuditLog
	var total int64

	query := r.db.WithContext(ctx).Model(&AuditLog{})
	query = r.applyFilter(query, filter)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count audit logs: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("timestamp DESC").Find(&logs).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list audit logs: %w", err)
	}

	return logs, total, nil
}

func (r *repository) GetByUserID(ctx context.Context, userID uuid.UUID, offset, limit int) ([]AuditLog, int64, error) {
	filter := AuditLogFilter{UserID: &userID}
	return r.List(ctx, filter, offset, limit)
}

func (r *repository) GetByResource(ctx context.Context, resource, resourceID string, offset, limit int) ([]AuditLog, int64, error) {
	filter := AuditLogFilter{
		Resources:  []string{resource},
		ResourceID: resourceID,
	}
	return r.List(ctx, filter, offset, limit)
}

func (r *repository) GetByFestivalID(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]AuditLog, int64, error) {
	filter := AuditLogFilter{FestivalID: &festivalID}
	return r.List(ctx, filter, offset, limit)
}

func (r *repository) GetByAction(ctx context.Context, action AuditAction, offset, limit int) ([]AuditLog, int64, error) {
	filter := AuditLogFilter{Actions: []AuditAction{action}}
	return r.List(ctx, filter, offset, limit)
}

func (r *repository) GetByTimeRange(ctx context.Context, start, end time.Time, offset, limit int) ([]AuditLog, int64, error) {
	filter := AuditLogFilter{
		StartTime: &start,
		EndTime:   &end,
	}
	return r.List(ctx, filter, offset, limit)
}

func (r *repository) GetStats(ctx context.Context, filter AuditLogFilter) (*AuditLogStats, error) {
	var total int64

	query := r.db.WithContext(ctx).Model(&AuditLog{})
	query = r.applyFilter(query, filter)

	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("failed to count audit logs for stats: %w", err)
	}

	// Get action counts
	actionCounts, err := r.GetActionCounts(ctx, filter)
	if err != nil {
		return nil, err
	}

	// Get category counts
	categoryCounts := make(map[string]int64)
	for action, count := range actionCounts {
		category := action.Category()
		categoryCounts[category] += count
	}

	// Get resource counts
	resourceCounts := make(map[string]int64)
	type resourceCount struct {
		Resource string
		Count    int64
	}
	var resourceResults []resourceCount
	resourceQuery := r.db.WithContext(ctx).Model(&AuditLog{}).
		Select("resource, COUNT(*) as count").
		Group("resource")
	resourceQuery = r.applyFilter(resourceQuery, filter)
	if err := resourceQuery.Scan(&resourceResults).Error; err != nil {
		return nil, fmt.Errorf("failed to get resource counts: %w", err)
	}
	for _, rc := range resourceResults {
		resourceCounts[rc.Resource] = rc.Count
	}

	// Get unique user count
	uniqueUsers, err := r.GetUniqueUserCount(ctx, filter)
	if err != nil {
		return nil, err
	}

	// Get top users
	type userCount struct {
		UserID uuid.UUID
		Count  int64
	}
	var topUsersResults []userCount
	topUsersQuery := r.db.WithContext(ctx).Model(&AuditLog{}).
		Select("user_id, COUNT(*) as count").
		Where("user_id IS NOT NULL").
		Group("user_id").
		Order("count DESC").
		Limit(10)
	topUsersQuery = r.applyFilter(topUsersQuery, filter)
	if err := topUsersQuery.Scan(&topUsersResults).Error; err != nil {
		return nil, fmt.Errorf("failed to get top users: %w", err)
	}

	topUsers := make([]UserActionCount, len(topUsersResults))
	for i, u := range topUsersResults {
		topUsers[i] = UserActionCount{
			UserID: u.UserID,
			Count:  u.Count,
		}
	}

	// Determine period string
	period := "all_time"
	if filter.StartTime != nil && filter.EndTime != nil {
		period = fmt.Sprintf("%s_to_%s",
			filter.StartTime.Format("2006-01-02"),
			filter.EndTime.Format("2006-01-02"))
	} else if filter.StartTime != nil {
		period = fmt.Sprintf("from_%s", filter.StartTime.Format("2006-01-02"))
	} else if filter.EndTime != nil {
		period = fmt.Sprintf("until_%s", filter.EndTime.Format("2006-01-02"))
	}

	return &AuditLogStats{
		TotalLogs:      total,
		ActionCounts:   actionCounts,
		CategoryCounts: categoryCounts,
		ResourceCounts: resourceCounts,
		UniqueUsers:    uniqueUsers,
		TopUsers:       topUsers,
		Period:         period,
	}, nil
}

func (r *repository) GetActionCounts(ctx context.Context, filter AuditLogFilter) (map[AuditAction]int64, error) {
	type actionCount struct {
		Action AuditAction
		Count  int64
	}

	var results []actionCount
	query := r.db.WithContext(ctx).Model(&AuditLog{}).
		Select("action, COUNT(*) as count").
		Group("action")
	query = r.applyFilter(query, filter)

	if err := query.Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get action counts: %w", err)
	}

	counts := make(map[AuditAction]int64)
	for _, r := range results {
		counts[r.Action] = r.Count
	}

	return counts, nil
}

func (r *repository) GetUniqueUserCount(ctx context.Context, filter AuditLogFilter) (int64, error) {
	var count int64
	query := r.db.WithContext(ctx).Model(&AuditLog{}).
		Where("user_id IS NOT NULL").
		Distinct("user_id")
	query = r.applyFilter(query, filter)

	if err := query.Count(&count).Error; err != nil {
		return 0, fmt.Errorf("failed to count unique users: %w", err)
	}

	return count, nil
}

func (r *repository) DeleteOlderThan(ctx context.Context, before time.Time) (int64, error) {
	result := r.db.WithContext(ctx).
		Where("timestamp < ?", before).
		Delete(&AuditLog{})
	if result.Error != nil {
		return 0, fmt.Errorf("failed to delete old audit logs: %w", result.Error)
	}
	return result.RowsAffected, nil
}

// applyFilter applies the filter conditions to a GORM query
func (r *repository) applyFilter(query *gorm.DB, filter AuditLogFilter) *gorm.DB {
	if filter.UserID != nil {
		query = query.Where("user_id = ?", filter.UserID)
	}

	if filter.FestivalID != nil {
		query = query.Where("festival_id = ?", filter.FestivalID)
	}

	if len(filter.Actions) > 0 {
		query = query.Where("action IN ?", filter.Actions)
	}

	if len(filter.Resources) > 0 {
		query = query.Where("resource IN ?", filter.Resources)
	}

	if filter.ResourceID != "" {
		query = query.Where("resource_id = ?", filter.ResourceID)
	}

	if filter.StartTime != nil {
		query = query.Where("timestamp >= ?", filter.StartTime)
	}

	if filter.EndTime != nil {
		query = query.Where("timestamp <= ?", filter.EndTime)
	}

	if filter.IP != "" {
		query = query.Where("ip = ?", filter.IP)
	}

	if filter.Category != "" {
		// Filter by action category
		actionsInCategory := getActionsForCategory(filter.Category)
		if len(actionsInCategory) > 0 {
			query = query.Where("action IN ?", actionsInCategory)
		}
	}

	return query
}

// getActionsForCategory returns all actions that belong to a specific category
func getActionsForCategory(category string) []AuditAction {
	categoryMap := map[string][]AuditAction{
		"authentication": {ActionLogin, ActionLogout, ActionLoginFailed, ActionTokenRefresh},
		"user_management": {ActionUserCreate, ActionUserUpdate, ActionUserDelete, ActionUserBan, ActionUserUnban, ActionRoleChange},
		"festival_management": {ActionFestivalCreate, ActionFestivalUpdate, ActionFestivalDelete},
		"ticketing": {ActionTicketCreate, ActionTicketUpdate, ActionTicketValidate, ActionTicketTransfer, ActionTicketRefund},
		"payments": {ActionWalletCreate, ActionWalletTopup, ActionWalletPayment, ActionWalletRefund, ActionWalletTransfer},
		"orders": {ActionOrderCreate, ActionOrderUpdate, ActionOrderCancel, ActionOrderRefund},
		"stands": {ActionStandCreate, ActionStandUpdate, ActionStandDelete},
		"products": {ActionProductCreate, ActionProductUpdate, ActionProductDelete},
		"lineup": {ActionArtistCreate, ActionArtistUpdate, ActionArtistDelete, ActionStageCreate, ActionStageUpdate, ActionStageDelete},
		"security": {ActionSecurityAlert, ActionAccessDenied, ActionSuspiciousActivity},
		"configuration": {ActionSettingsUpdate, ActionAPIKeyCreate, ActionAPIKeyRevoke},
		"exports": {ActionDataExport, ActionReportGenerate},
		"general": {ActionCreate, ActionRead, ActionUpdate, ActionDelete},
	}
	return categoryMap[category]
}
