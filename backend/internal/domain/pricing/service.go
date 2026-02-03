package pricing

import (
	"context"
	"fmt"
	"regexp"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/product"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

type Service struct {
	repo        Repository
	productRepo product.Repository
}

func NewService(repo Repository, productRepo product.Repository) *Service {
	return &Service{
		repo:        repo,
		productRepo: productRepo,
	}
}

// Create creates a new pricing rule
func (s *Service) Create(ctx context.Context, standID uuid.UUID, req CreatePricingRuleRequest) (*PricingRule, error) {
	// Validate time format
	if err := validateTimeFormat(req.StartTime); err != nil {
		return nil, fmt.Errorf("invalid start time: %w", err)
	}
	if err := validateTimeFormat(req.EndTime); err != nil {
		return nil, fmt.Errorf("invalid end time: %w", err)
	}

	// Validate discount value
	if req.DiscountType == DiscountTypePercentage && (req.DiscountValue < 1 || req.DiscountValue > 100) {
		return nil, fmt.Errorf("percentage discount must be between 1 and 100")
	}

	// Check for overlapping rules
	overlapping, err := s.repo.GetOverlappingRules(ctx, standID, req.ProductID, req.StartTime, req.EndTime, req.DaysOfWeek, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to check for overlapping rules: %w", err)
	}
	if len(overlapping) > 0 {
		return nil, fmt.Errorf("pricing rule overlaps with existing rule: %s", overlapping[0].Name)
	}

	rule := &PricingRule{
		ID:            uuid.New(),
		StandID:       standID,
		ProductID:     req.ProductID,
		Name:          req.Name,
		Description:   req.Description,
		DiscountType:  req.DiscountType,
		DiscountValue: req.DiscountValue,
		StartTime:     req.StartTime,
		EndTime:       req.EndTime,
		DaysOfWeek:    req.DaysOfWeek,
		Priority:      req.Priority,
		Active:        true,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if rule.DaysOfWeek == nil {
		rule.DaysOfWeek = []int{}
	}

	if err := s.repo.Create(ctx, rule); err != nil {
		return nil, fmt.Errorf("failed to create pricing rule: %w", err)
	}

	return rule, nil
}

// GetByID gets a pricing rule by ID
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*PricingRule, error) {
	rule, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if rule == nil {
		return nil, errors.ErrNotFound
	}
	return rule, nil
}

// List lists pricing rules for a stand
func (s *Service) List(ctx context.Context, standID uuid.UUID, page, perPage int) ([]PricingRule, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	offset := (page - 1) * perPage
	return s.repo.ListByStand(ctx, standID, offset, perPage)
}

// Update updates a pricing rule
func (s *Service) Update(ctx context.Context, id uuid.UUID, req UpdatePricingRuleRequest) (*PricingRule, error) {
	rule, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if rule == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.Name != nil {
		rule.Name = *req.Name
	}
	if req.Description != nil {
		rule.Description = *req.Description
	}
	if req.DiscountType != nil {
		rule.DiscountType = *req.DiscountType
	}
	if req.DiscountValue != nil {
		rule.DiscountValue = *req.DiscountValue
	}
	if req.StartTime != nil {
		if err := validateTimeFormat(*req.StartTime); err != nil {
			return nil, fmt.Errorf("invalid start time: %w", err)
		}
		rule.StartTime = *req.StartTime
	}
	if req.EndTime != nil {
		if err := validateTimeFormat(*req.EndTime); err != nil {
			return nil, fmt.Errorf("invalid end time: %w", err)
		}
		rule.EndTime = *req.EndTime
	}
	if req.DaysOfWeek != nil {
		rule.DaysOfWeek = req.DaysOfWeek
	}
	if req.Priority != nil {
		rule.Priority = *req.Priority
	}
	if req.Active != nil {
		rule.Active = *req.Active
	}

	// Validate discount value if both type and value are set
	if rule.DiscountType == DiscountTypePercentage && (rule.DiscountValue < 1 || rule.DiscountValue > 100) {
		return nil, fmt.Errorf("percentage discount must be between 1 and 100")
	}

	// Check for overlapping rules if time or days changed
	if req.StartTime != nil || req.EndTime != nil || req.DaysOfWeek != nil {
		overlapping, err := s.repo.GetOverlappingRules(ctx, rule.StandID, rule.ProductID, rule.StartTime, rule.EndTime, rule.DaysOfWeek, &id)
		if err != nil {
			return nil, fmt.Errorf("failed to check for overlapping rules: %w", err)
		}
		if len(overlapping) > 0 {
			return nil, fmt.Errorf("pricing rule overlaps with existing rule: %s", overlapping[0].Name)
		}
	}

	rule.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, rule); err != nil {
		return nil, fmt.Errorf("failed to update pricing rule: %w", err)
	}

	return rule, nil
}

// Delete deletes a pricing rule
func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	rule, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if rule == nil {
		return errors.ErrNotFound
	}

	return s.repo.Delete(ctx, id)
}

// GetCurrentDiscounts gets all currently active discounts for a stand
func (s *Service) GetCurrentDiscounts(ctx context.Context, standID uuid.UUID) ([]PricingRule, error) {
	return s.repo.GetActiveRules(ctx, standID, time.Now())
}

// CalculatePrice calculates the discounted price for a product
func (s *Service) CalculatePrice(ctx context.Context, standID uuid.UUID, productID uuid.UUID, originalPrice int64, quantity int, calculationTime time.Time) (*CalculatedPrice, error) {
	// Get active rules for the product
	rules, err := s.repo.GetActiveRulesForProduct(ctx, standID, productID, calculationTime)
	if err != nil {
		return nil, fmt.Errorf("failed to get active rules: %w", err)
	}

	result := &CalculatedPrice{
		ProductID:       productID,
		OriginalPrice:   originalPrice,
		DiscountedPrice: originalPrice,
		Discount:        0,
	}

	if len(rules) == 0 {
		return result, nil
	}

	// Apply the highest priority rule (first in the sorted list)
	rule := rules[0]
	var discount int64

	switch rule.DiscountType {
	case DiscountTypePercentage:
		discount = (originalPrice * rule.DiscountValue) / 100
	case DiscountTypeFixedAmount:
		discount = rule.DiscountValue
		if discount > originalPrice {
			discount = originalPrice
		}
	}

	result.DiscountedPrice = originalPrice - discount
	result.Discount = discount

	isActive := true
	ruleResponse := rule.ToResponse(isActive)
	result.AppliedRule = &ruleResponse

	return result, nil
}

// GetCurrentPrices gets all products for a stand with their current prices
func (s *Service) GetCurrentPrices(ctx context.Context, standID uuid.UUID) (*CurrentPricesResponse, error) {
	now := time.Now()

	// Get all products for the stand
	products, _, err := s.productRepo.ListByStand(ctx, standID, 0, 1000)
	if err != nil {
		return nil, fmt.Errorf("failed to get products: %w", err)
	}

	// Get all active rules
	activeRules, err := s.repo.GetActiveRules(ctx, standID, now)
	if err != nil {
		return nil, fmt.Errorf("failed to get active rules: %w", err)
	}

	// Calculate prices for each product
	prices := make([]CalculatedPrice, len(products))
	for i, p := range products {
		calc, err := s.CalculatePrice(ctx, standID, p.ID, p.Price, 1, now)
		if err != nil {
			return nil, fmt.Errorf("failed to calculate price for product %s: %w", p.ID, err)
		}
		calc.ProductName = p.Name
		prices[i] = *calc
	}

	// Convert rules to responses
	ruleResponses := make([]PricingRuleResponse, len(activeRules))
	for i, rule := range activeRules {
		ruleResponses[i] = rule.ToResponse(true)
	}

	return &CurrentPricesResponse{
		StandID:      standID,
		Prices:       prices,
		ActiveRules:  ruleResponses,
		CalculatedAt: now.Format(time.RFC3339),
	}, nil
}

// ValidateRule validates a pricing rule without saving it
func (s *Service) ValidateRule(ctx context.Context, standID uuid.UUID, req CreatePricingRuleRequest) error {
	// Validate time format
	if err := validateTimeFormat(req.StartTime); err != nil {
		return fmt.Errorf("invalid start time: %w", err)
	}
	if err := validateTimeFormat(req.EndTime); err != nil {
		return fmt.Errorf("invalid end time: %w", err)
	}

	// Validate discount value
	if req.DiscountType == DiscountTypePercentage && (req.DiscountValue < 1 || req.DiscountValue > 100) {
		return fmt.Errorf("percentage discount must be between 1 and 100")
	}

	// Validate days of week
	if len(req.DaysOfWeek) == 0 {
		return fmt.Errorf("at least one day of week must be selected")
	}
	for _, day := range req.DaysOfWeek {
		if day < 0 || day > 6 {
			return fmt.Errorf("invalid day of week: %d", day)
		}
	}

	// Check for overlapping rules
	overlapping, err := s.repo.GetOverlappingRules(ctx, standID, req.ProductID, req.StartTime, req.EndTime, req.DaysOfWeek, nil)
	if err != nil {
		return fmt.Errorf("failed to check for overlapping rules: %w", err)
	}
	if len(overlapping) > 0 {
		return fmt.Errorf("pricing rule overlaps with existing rule: %s", overlapping[0].Name)
	}

	return nil
}

// IsRuleCurrentlyActive checks if a rule is currently active
func (s *Service) IsRuleCurrentlyActive(rule *PricingRule) bool {
	now := time.Now()
	dayOfWeek := int(now.Weekday())
	timeStr := now.Format("15:04")

	// Check day
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

	// Check time
	return isTimeInRange(timeStr, rule.StartTime, rule.EndTime)
}

// validateTimeFormat validates that a time string is in HH:MM format
func validateTimeFormat(timeStr string) error {
	pattern := regexp.MustCompile(`^([01]?[0-9]|2[0-3]):[0-5][0-9]$`)
	if !pattern.MatchString(timeStr) {
		return fmt.Errorf("time must be in HH:MM format (e.g., 17:00)")
	}
	return nil
}
