package festival

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/database"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
	"gorm.io/gorm"
)

type Service struct {
	repo Repository
	db   *gorm.DB
}

func NewService(repo Repository, db *gorm.DB) *Service {
	return &Service{repo: repo, db: db}
}

func (s *Service) Create(ctx context.Context, req CreateFestivalRequest, createdBy *uuid.UUID) (*Festival, error) {
	// Generate slug from name
	slug := slugify(req.Name)

	// Check if slug already exists
	exists, err := s.repo.ExistsBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if exists {
		// Append random suffix
		slug = fmt.Sprintf("%s-%s", slug, uuid.New().String()[:8])
	}

	// Set defaults
	timezone := req.Timezone
	if timezone == "" {
		timezone = "Europe/Brussels"
	}

	currencyName := req.CurrencyName
	if currencyName == "" {
		currencyName = "Jetons"
	}

	exchangeRate := req.ExchangeRate
	if exchangeRate == 0 {
		exchangeRate = 0.10
	}

	festival := &Festival{
		ID:           uuid.New(),
		Name:         req.Name,
		Slug:         slug,
		Description:  req.Description,
		StartDate:    req.StartDate,
		EndDate:      req.EndDate,
		Location:     req.Location,
		Timezone:     timezone,
		CurrencyName: currencyName,
		ExchangeRate: exchangeRate,
		Settings: FestivalSettings{
			RefundPolicy:  "manual",
			ReentryPolicy: "single",
		},
		Status:    FestivalStatusDraft,
		CreatedBy: createdBy,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Create festival in database
	if err := s.repo.Create(ctx, festival); err != nil {
		return nil, fmt.Errorf("failed to create festival: %w", err)
	}

	// Create tenant schema
	if err := database.CreateTenantSchema(s.db, festival.ID.String()); err != nil {
		// Rollback: delete the festival
		_ = s.repo.Delete(ctx, festival.ID)
		return nil, fmt.Errorf("failed to create tenant schema: %w", err)
	}

	return festival, nil
}

func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Festival, error) {
	festival, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if festival == nil {
		return nil, errors.ErrNotFound
	}
	return festival, nil
}

func (s *Service) GetBySlug(ctx context.Context, slug string) (*Festival, error) {
	festival, err := s.repo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if festival == nil {
		return nil, errors.ErrNotFound
	}
	return festival, nil
}

func (s *Service) List(ctx context.Context, page, perPage int) ([]Festival, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.List(ctx, offset, perPage)
}

func (s *Service) Update(ctx context.Context, id uuid.UUID, req UpdateFestivalRequest) (*Festival, error) {
	festival, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if festival == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.Name != nil {
		festival.Name = *req.Name
	}
	if req.Description != nil {
		festival.Description = *req.Description
	}
	if req.StartDate != nil {
		festival.StartDate = *req.StartDate
	}
	if req.EndDate != nil {
		festival.EndDate = *req.EndDate
	}
	if req.Location != nil {
		festival.Location = *req.Location
	}
	if req.Timezone != nil {
		festival.Timezone = *req.Timezone
	}
	if req.CurrencyName != nil {
		festival.CurrencyName = *req.CurrencyName
	}
	if req.ExchangeRate != nil {
		festival.ExchangeRate = *req.ExchangeRate
	}
	if req.StripeAccountID != nil {
		festival.StripeAccountID = *req.StripeAccountID
	}
	if req.Settings != nil {
		festival.Settings = *req.Settings
	}
	if req.Status != nil {
		festival.Status = *req.Status
	}

	festival.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, festival); err != nil {
		return nil, fmt.Errorf("failed to update festival: %w", err)
	}

	return festival, nil
}

func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	festival, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if festival == nil {
		return errors.ErrNotFound
	}

	// Delete tenant schema
	if err := database.DropTenantSchema(s.db, id.String()); err != nil {
		return fmt.Errorf("failed to drop tenant schema: %w", err)
	}

	// Delete festival
	return s.repo.Delete(ctx, id)
}

func (s *Service) Activate(ctx context.Context, id uuid.UUID) (*Festival, error) {
	status := FestivalStatusActive
	return s.Update(ctx, id, UpdateFestivalRequest{Status: &status})
}

func (s *Service) Archive(ctx context.Context, id uuid.UUID) (*Festival, error) {
	status := FestivalStatusArchived
	return s.Update(ctx, id, UpdateFestivalRequest{Status: &status})
}

// slugify converts a string to a URL-friendly slug
func slugify(s string) string {
	// Normalize unicode and remove accents
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	result, _, _ := transform.String(t, s)

	// Convert to lowercase
	result = strings.ToLower(result)

	// Replace spaces and special characters with hyphens
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	result = reg.ReplaceAllString(result, "-")

	// Remove leading/trailing hyphens
	result = strings.Trim(result, "-")

	return result
}
