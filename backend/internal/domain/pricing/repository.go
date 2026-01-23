package pricing

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	Create(ctx context.Context, rule *PricingRule) error
	GetByID(ctx context.Context, id uuid.UUID) (*PricingRule, error)
	ListByStand(ctx context.Context, standID uuid.UUID, offset, limit int) ([]PricingRule, int64, error)
	ListByProduct(ctx context.Context, productID uuid.UUID) ([]PricingRule, error)
	Update(ctx context.Context, rule *PricingRule) error
	Delete(ctx context.Context, id uuid.UUID) error
	GetActiveRules(ctx context.Context, standID uuid.UUID, currentTime time.Time) ([]PricingRule, error)
	GetActiveRulesForProduct(ctx context.Context, standID uuid.UUID, productID uuid.UUID, currentTime time.Time) ([]PricingRule, error)
	GetOverlappingRules(ctx context.Context, standID uuid.UUID, productID *uuid.UUID, startTime, endTime string, daysOfWeek []int, excludeID *uuid.UUID) ([]PricingRule, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, rule *PricingRule) error {
	return r.db.WithContext(ctx).Create(rule).Error
}

func (r *repository) GetByID(ctx context.Context, id uuid.UUID) (*PricingRule, error) {
	var rule PricingRule
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&rule).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get pricing rule: %w", err)
	}
	return &rule, nil
}

func (r *repository) ListByStand(ctx context.Context, standID uuid.UUID, offset, limit int) ([]PricingRule, int64, error) {
	var rules []PricingRule
	var total int64

	query := r.db.WithContext(ctx).Model(&PricingRule{}).Where("stand_id = ?", standID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count pricing rules: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("priority DESC, name ASC").Find(&rules).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list pricing rules: %w", err)
	}

	return rules, total, nil
}

func (r *repository) ListByProduct(ctx context.Context, productID uuid.UUID) ([]PricingRule, error) {
	var rules []PricingRule
	err := r.db.WithContext(ctx).
		Where("product_id = ? OR product_id IS NULL", productID).
		Where("active = ?", true).
		Order("priority DESC").
		Find(&rules).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list pricing rules by product: %w", err)
	}
	return rules, nil
}

func (r *repository) Update(ctx context.Context, rule *PricingRule) error {
	return r.db.WithContext(ctx).Save(rule).Error
}

func (r *repository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&PricingRule{}).Error
}

// GetActiveRules returns all pricing rules that are currently active for a stand
// based on the current day of week and time
func (r *repository) GetActiveRules(ctx context.Context, standID uuid.UUID, currentTime time.Time) ([]PricingRule, error) {
	var rules []PricingRule

	dayOfWeek := int(currentTime.Weekday())
	timeStr := currentTime.Format("15:04")

	// Get all active rules for the stand
	err := r.db.WithContext(ctx).
		Where("stand_id = ?", standID).
		Where("active = ?", true).
		Order("priority DESC").
		Find(&rules).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get active pricing rules: %w", err)
	}

	// Filter by day of week and time range
	var activeRules []PricingRule
	for _, rule := range rules {
		if isRuleActiveAt(rule, dayOfWeek, timeStr) {
			activeRules = append(activeRules, rule)
		}
	}

	return activeRules, nil
}

// GetActiveRulesForProduct returns all active pricing rules for a specific product
func (r *repository) GetActiveRulesForProduct(ctx context.Context, standID uuid.UUID, productID uuid.UUID, currentTime time.Time) ([]PricingRule, error) {
	var rules []PricingRule

	dayOfWeek := int(currentTime.Weekday())
	timeStr := currentTime.Format("15:04")

	// Get all active rules for the stand that apply to the product or all products
	err := r.db.WithContext(ctx).
		Where("stand_id = ?", standID).
		Where("(product_id = ? OR product_id IS NULL)", productID).
		Where("active = ?", true).
		Order("priority DESC").
		Find(&rules).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get active pricing rules for product: %w", err)
	}

	// Filter by day of week and time range
	var activeRules []PricingRule
	for _, rule := range rules {
		if isRuleActiveAt(rule, dayOfWeek, timeStr) {
			activeRules = append(activeRules, rule)
		}
	}

	return activeRules, nil
}

// GetOverlappingRules checks for rules that overlap with the given time range and days
func (r *repository) GetOverlappingRules(ctx context.Context, standID uuid.UUID, productID *uuid.UUID, startTime, endTime string, daysOfWeek []int, excludeID *uuid.UUID) ([]PricingRule, error) {
	var rules []PricingRule

	query := r.db.WithContext(ctx).
		Where("stand_id = ?", standID).
		Where("active = ?", true)

	// If productID is nil, check rules that apply to all products
	// If productID is set, check rules that apply to that product or all products
	if productID != nil {
		query = query.Where("(product_id = ? OR product_id IS NULL)", *productID)
	} else {
		query = query.Where("product_id IS NULL")
	}

	if excludeID != nil {
		query = query.Where("id != ?", *excludeID)
	}

	err := query.Find(&rules).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get overlapping rules: %w", err)
	}

	// Filter for overlapping rules
	var overlapping []PricingRule
	for _, rule := range rules {
		if hasTimeOverlap(rule.StartTime, rule.EndTime, startTime, endTime) && hasDaysOverlap(rule.DaysOfWeek, daysOfWeek) {
			overlapping = append(overlapping, rule)
		}
	}

	return overlapping, nil
}

// isRuleActiveAt checks if a rule is active at the given day and time
func isRuleActiveAt(rule PricingRule, dayOfWeek int, timeStr string) bool {
	// Check if the day is in the rule's days of week
	dayMatch := false
	for _, d := range rule.DaysOfWeek {
		if d == dayOfWeek {
			dayMatch = true
			break
		}
	}
	if !dayMatch {
		return false
	}

	// Check if the time is within the rule's time range
	return isTimeInRange(timeStr, rule.StartTime, rule.EndTime)
}

// isTimeInRange checks if a time is within a range (handling overnight ranges)
func isTimeInRange(timeStr, startTime, endTime string) bool {
	if startTime <= endTime {
		// Normal range (e.g., 17:00 to 19:00)
		return timeStr >= startTime && timeStr <= endTime
	}
	// Overnight range (e.g., 22:00 to 02:00)
	return timeStr >= startTime || timeStr <= endTime
}

// hasTimeOverlap checks if two time ranges overlap
func hasTimeOverlap(start1, end1, start2, end2 string) bool {
	// Simple overlap check for non-overnight ranges
	if start1 <= end1 && start2 <= end2 {
		return start1 <= end2 && start2 <= end1
	}
	// For overnight ranges, assume potential overlap (conservative approach)
	return true
}

// hasDaysOverlap checks if two day of week slices have any overlap
func hasDaysOverlap(days1, days2 []int) bool {
	daySet := make(map[int]bool)
	for _, d := range days1 {
		daySet[d] = true
	}
	for _, d := range days2 {
		if daySet[d] {
			return true
		}
	}
	return false
}
