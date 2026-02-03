package festival

import (
	"time"

	"github.com/google/uuid"
)

type Festival struct {
	ID              uuid.UUID         `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name            string            `json:"name" gorm:"not null"`
	Slug            string            `json:"slug" gorm:"unique;not null"`
	Description     string            `json:"description"`
	StartDate       time.Time         `json:"startDate" gorm:"not null"`
	EndDate         time.Time         `json:"endDate" gorm:"not null"`
	Location        string            `json:"location"`
	Timezone        string            `json:"timezone" gorm:"default:'Europe/Brussels'"`
	CurrencyName    string            `json:"currencyName" gorm:"default:'Jetons'"`
	ExchangeRate    float64           `json:"exchangeRate" gorm:"type:decimal(10,4);default:0.10"`
	StripeAccountID string            `json:"stripeAccountId,omitempty"`
	Settings        FestivalSettings  `json:"settings" gorm:"type:jsonb;default:'{}'"`
	Status          FestivalStatus    `json:"status" gorm:"default:'DRAFT'"`
	CreatedBy       *uuid.UUID        `json:"createdBy,omitempty" gorm:"type:uuid"`
	CreatedAt       time.Time         `json:"createdAt"`
	UpdatedAt       time.Time         `json:"updatedAt"`
}

func (Festival) TableName() string {
	return "public.festivals"
}

type FestivalStatus string

const (
	FestivalStatusDraft     FestivalStatus = "DRAFT"
	FestivalStatusActive    FestivalStatus = "ACTIVE"
	FestivalStatusCompleted FestivalStatus = "COMPLETED"
	FestivalStatusArchived  FestivalStatus = "ARCHIVED"
)

type FestivalSettings struct {
	RefundPolicy   string `json:"refundPolicy"`   // auto, manual, none
	ReentryPolicy  string `json:"reentryPolicy"`  // single, multiple
	LogoURL        string `json:"logoUrl,omitempty"`
	PrimaryColor   string `json:"primaryColor,omitempty"`
	SecondaryColor string `json:"secondaryColor,omitempty"`
}

// CreateFestivalRequest represents the request to create a festival
type CreateFestivalRequest struct {
	Name         string    `json:"name" binding:"required"`
	Description  string    `json:"description"`
	StartDate    time.Time `json:"startDate" binding:"required"`
	EndDate      time.Time `json:"endDate" binding:"required"`
	Location     string    `json:"location"`
	Timezone     string    `json:"timezone"`
	CurrencyName string    `json:"currencyName"`
	ExchangeRate float64   `json:"exchangeRate"`
}

// UpdateFestivalRequest represents the request to update a festival
type UpdateFestivalRequest struct {
	Name            *string           `json:"name,omitempty"`
	Description     *string           `json:"description,omitempty"`
	StartDate       *time.Time        `json:"startDate,omitempty"`
	EndDate         *time.Time        `json:"endDate,omitempty"`
	Location        *string           `json:"location,omitempty"`
	Timezone        *string           `json:"timezone,omitempty"`
	CurrencyName    *string           `json:"currencyName,omitempty"`
	ExchangeRate    *float64          `json:"exchangeRate,omitempty"`
	StripeAccountID *string           `json:"stripeAccountId,omitempty"`
	Settings        *FestivalSettings `json:"settings,omitempty"`
	Status          *FestivalStatus   `json:"status,omitempty"`
}

// FestivalResponse represents the API response for a festival
type FestivalResponse struct {
	ID              uuid.UUID        `json:"id"`
	Name            string           `json:"name"`
	Slug            string           `json:"slug"`
	Description     string           `json:"description"`
	StartDate       string           `json:"startDate"`
	EndDate         string           `json:"endDate"`
	Location        string           `json:"location"`
	Timezone        string           `json:"timezone"`
	CurrencyName    string           `json:"currencyName"`
	ExchangeRate    float64          `json:"exchangeRate"`
	StripeAccountID string           `json:"stripeAccountId,omitempty"`
	Settings        FestivalSettings `json:"settings"`
	Status          FestivalStatus   `json:"status"`
	CreatedAt       string           `json:"createdAt"`
	UpdatedAt       string           `json:"updatedAt"`
}

func (f *Festival) ToResponse() FestivalResponse {
	return FestivalResponse{
		ID:              f.ID,
		Name:            f.Name,
		Slug:            f.Slug,
		Description:     f.Description,
		StartDate:       f.StartDate.Format("2006-01-02"),
		EndDate:         f.EndDate.Format("2006-01-02"),
		Location:        f.Location,
		Timezone:        f.Timezone,
		CurrencyName:    f.CurrencyName,
		ExchangeRate:    f.ExchangeRate,
		StripeAccountID: f.StripeAccountID,
		Settings:        f.Settings,
		Status:          f.Status,
		CreatedAt:       f.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       f.UpdatedAt.Format(time.RFC3339),
	}
}
