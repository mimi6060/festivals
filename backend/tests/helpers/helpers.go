package helpers

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/festival"
	"gorm.io/gorm"
)

// FestivalOptions allows customizing test festival creation
type FestivalOptions struct {
	Name         *string
	Description  *string
	StartDate    *time.Time
	EndDate      *time.Time
	Location     *string
	Timezone     *string
	CurrencyName *string
	ExchangeRate *float64
	Status       *festival.FestivalStatus
	CreatedBy    *uuid.UUID
}

// StringPtr returns a pointer to a string
func StringPtr(s string) *string {
	return &s
}

// Float64Ptr returns a pointer to a float64
func Float64Ptr(f float64) *float64 {
	return &f
}

// TimePtr returns a pointer to a time.Time
func TimePtr(t time.Time) *time.Time {
	return &t
}

// CreateTestFestival creates a festival for testing
func CreateTestFestival(t *testing.T, db *gorm.DB, opts *FestivalOptions) *festival.Festival {
	t.Helper()

	// Default values
	name := "Test Festival"
	description := "Test festival description"
	startDate := time.Now().AddDate(0, 1, 0)
	endDate := time.Now().AddDate(0, 1, 3)
	location := "Test Location"
	timezone := "Europe/Brussels"
	currencyName := "Jetons"
	exchangeRate := 0.10
	status := festival.FestivalStatusDraft

	// Apply options
	if opts != nil {
		if opts.Name != nil {
			name = *opts.Name
		}
		if opts.Description != nil {
			description = *opts.Description
		}
		if opts.StartDate != nil {
			startDate = *opts.StartDate
		}
		if opts.EndDate != nil {
			endDate = *opts.EndDate
		}
		if opts.Location != nil {
			location = *opts.Location
		}
		if opts.Timezone != nil {
			timezone = *opts.Timezone
		}
		if opts.CurrencyName != nil {
			currencyName = *opts.CurrencyName
		}
		if opts.ExchangeRate != nil {
			exchangeRate = *opts.ExchangeRate
		}
		if opts.Status != nil {
			status = *opts.Status
		}
	}

	// Generate unique slug
	slug := slugify(name) + "-" + uuid.New().String()[:8]

	f := &festival.Festival{
		ID:           uuid.New(),
		Name:         name,
		Slug:         slug,
		Description:  description,
		StartDate:    startDate,
		EndDate:      endDate,
		Location:     location,
		Timezone:     timezone,
		CurrencyName: currencyName,
		ExchangeRate: exchangeRate,
		Settings: festival.FestivalSettings{
			RefundPolicy:  "manual",
			ReentryPolicy: "single",
		},
		Status:    status,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if opts != nil && opts.CreatedBy != nil {
		f.CreatedBy = opts.CreatedBy
	}

	if err := db.Create(f).Error; err != nil {
		t.Fatalf("Failed to create test festival: %v", err)
	}

	return f
}

// slugify converts a string to a URL-friendly slug
func slugify(s string) string {
	result := make([]byte, 0, len(s))
	lastWasDash := false

	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c = c + 32 // lowercase
		}
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') {
			result = append(result, c)
			lastWasDash = false
		} else if !lastWasDash && len(result) > 0 {
			result = append(result, '-')
			lastWasDash = true
		}
	}

	// Remove trailing dash
	if len(result) > 0 && result[len(result)-1] == '-' {
		result = result[:len(result)-1]
	}

	return string(result)
}
