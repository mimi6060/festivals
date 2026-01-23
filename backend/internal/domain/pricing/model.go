package pricing

import (
	"time"

	"github.com/google/uuid"
)

// DiscountType represents the type of discount applied
type DiscountType string

const (
	DiscountTypePercentage   DiscountType = "PERCENTAGE"
	DiscountTypeFixedAmount  DiscountType = "FIXED_AMOUNT"
)

// PricingRule represents a pricing rule (e.g., happy hour)
type PricingRule struct {
	ID            uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	StandID       uuid.UUID    `json:"standId" gorm:"type:uuid;not null;index"`
	ProductID     *uuid.UUID   `json:"productId,omitempty" gorm:"type:uuid;index"` // nil = applies to all products
	Name          string       `json:"name" gorm:"not null"`
	Description   string       `json:"description"`
	DiscountType  DiscountType `json:"discountType" gorm:"not null"`
	DiscountValue int64        `json:"discountValue" gorm:"not null"` // Percentage (0-100) or fixed amount in cents
	StartTime     string       `json:"startTime" gorm:"not null"`     // HH:MM format (e.g., "17:00")
	EndTime       string       `json:"endTime" gorm:"not null"`       // HH:MM format (e.g., "19:00")
	DaysOfWeek    []int        `json:"daysOfWeek" gorm:"type:int[];serializer:json"` // 0=Sunday, 1=Monday, ..., 6=Saturday
	Priority      int          `json:"priority" gorm:"default:0"`     // Higher priority rules are applied first
	Active        bool         `json:"active" gorm:"default:true"`
	CreatedAt     time.Time    `json:"createdAt"`
	UpdatedAt     time.Time    `json:"updatedAt"`
}

func (PricingRule) TableName() string {
	return "pricing_rules"
}

// CreatePricingRuleRequest represents the request to create a pricing rule
type CreatePricingRuleRequest struct {
	ProductID     *uuid.UUID   `json:"productId,omitempty"`
	Name          string       `json:"name" binding:"required"`
	Description   string       `json:"description"`
	DiscountType  DiscountType `json:"discountType" binding:"required,oneof=PERCENTAGE FIXED_AMOUNT"`
	DiscountValue int64        `json:"discountValue" binding:"required,min=1"`
	StartTime     string       `json:"startTime" binding:"required"` // HH:MM format
	EndTime       string       `json:"endTime" binding:"required"`   // HH:MM format
	DaysOfWeek    []int        `json:"daysOfWeek" binding:"required,min=1,dive,min=0,max=6"`
	Priority      int          `json:"priority"`
}

// UpdatePricingRuleRequest represents the request to update a pricing rule
type UpdatePricingRuleRequest struct {
	Name          *string       `json:"name,omitempty"`
	Description   *string       `json:"description,omitempty"`
	DiscountType  *DiscountType `json:"discountType,omitempty"`
	DiscountValue *int64        `json:"discountValue,omitempty"`
	StartTime     *string       `json:"startTime,omitempty"`
	EndTime       *string       `json:"endTime,omitempty"`
	DaysOfWeek    []int         `json:"daysOfWeek,omitempty"`
	Priority      *int          `json:"priority,omitempty"`
	Active        *bool         `json:"active,omitempty"`
}

// PricingRuleResponse represents the API response for a pricing rule
type PricingRuleResponse struct {
	ID            uuid.UUID    `json:"id"`
	StandID       uuid.UUID    `json:"standId"`
	ProductID     *uuid.UUID   `json:"productId,omitempty"`
	Name          string       `json:"name"`
	Description   string       `json:"description"`
	DiscountType  DiscountType `json:"discountType"`
	DiscountValue int64        `json:"discountValue"`
	StartTime     string       `json:"startTime"`
	EndTime       string       `json:"endTime"`
	DaysOfWeek    []int        `json:"daysOfWeek"`
	Priority      int          `json:"priority"`
	Active        bool         `json:"active"`
	IsCurrentlyActive bool     `json:"isCurrentlyActive"`
	CreatedAt     string       `json:"createdAt"`
	UpdatedAt     string       `json:"updatedAt"`
}

// ToResponse converts a PricingRule to its API response
func (r *PricingRule) ToResponse(isCurrentlyActive bool) PricingRuleResponse {
	return PricingRuleResponse{
		ID:                r.ID,
		StandID:           r.StandID,
		ProductID:         r.ProductID,
		Name:              r.Name,
		Description:       r.Description,
		DiscountType:      r.DiscountType,
		DiscountValue:     r.DiscountValue,
		StartTime:         r.StartTime,
		EndTime:           r.EndTime,
		DaysOfWeek:        r.DaysOfWeek,
		Priority:          r.Priority,
		Active:            r.Active,
		IsCurrentlyActive: isCurrentlyActive,
		CreatedAt:         r.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         r.UpdatedAt.Format(time.RFC3339),
	}
}

// CalculatedPrice represents a product with its calculated price after discounts
type CalculatedPrice struct {
	ProductID      uuid.UUID            `json:"productId"`
	ProductName    string               `json:"productName"`
	OriginalPrice  int64                `json:"originalPrice"`
	DiscountedPrice int64               `json:"discountedPrice"`
	Discount       int64                `json:"discount"`
	AppliedRule    *PricingRuleResponse `json:"appliedRule,omitempty"`
}

// CurrentPricesResponse represents the response for current prices
type CurrentPricesResponse struct {
	StandID       uuid.UUID         `json:"standId"`
	Prices        []CalculatedPrice `json:"prices"`
	ActiveRules   []PricingRuleResponse `json:"activeRules"`
	CalculatedAt  string            `json:"calculatedAt"`
}
