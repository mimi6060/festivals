package product

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Create creates a new product
func (s *Service) Create(ctx context.Context, req CreateProductRequest) (*Product, error) {
	product := &Product{
		ID:          uuid.New(),
		StandID:     req.StandID,
		Name:        req.Name,
		Description: req.Description,
		Price:       req.Price,
		Category:    req.Category,
		ImageURL:    req.ImageURL,
		SKU:         req.SKU,
		Stock:       req.Stock,
		SortOrder:   req.SortOrder,
		Status:      ProductStatusActive,
		Tags:        req.Tags,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if product.Tags == nil {
		product.Tags = []string{}
	}

	if err := s.repo.Create(ctx, product); err != nil {
		return nil, fmt.Errorf("failed to create product: %w", err)
	}

	return product, nil
}

// CreateBulk creates multiple products at once
func (s *Service) CreateBulk(ctx context.Context, req BulkCreateProductRequest) ([]Product, error) {
	products := make([]Product, len(req.Products))

	for i, p := range req.Products {
		tags := p.Tags
		if tags == nil {
			tags = []string{}
		}

		products[i] = Product{
			ID:          uuid.New(),
			StandID:     req.StandID,
			Name:        p.Name,
			Description: p.Description,
			Price:       p.Price,
			Category:    p.Category,
			ImageURL:    p.ImageURL,
			SKU:         p.SKU,
			Stock:       p.Stock,
			SortOrder:   p.SortOrder,
			Status:      ProductStatusActive,
			Tags:        tags,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}
	}

	if err := s.repo.CreateBulk(ctx, products); err != nil {
		return nil, fmt.Errorf("failed to create products: %w", err)
	}

	return products, nil
}

// GetByID gets a product by ID
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Product, error) {
	product, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if product == nil {
		return nil, errors.ErrNotFound
	}
	return product, nil
}

// GetByIDs gets multiple products by IDs
func (s *Service) GetByIDs(ctx context.Context, ids []uuid.UUID) ([]Product, error) {
	return s.repo.GetByIDs(ctx, ids)
}

// List lists products for a stand
func (s *Service) List(ctx context.Context, standID uuid.UUID, page, perPage int) ([]Product, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	offset := (page - 1) * perPage
	return s.repo.ListByStand(ctx, standID, offset, perPage)
}

// ListByCategory lists products by category
func (s *Service) ListByCategory(ctx context.Context, standID uuid.UUID, category ProductCategory) ([]Product, error) {
	return s.repo.ListByCategory(ctx, standID, category)
}

// Update updates a product
func (s *Service) Update(ctx context.Context, id uuid.UUID, req UpdateProductRequest) (*Product, error) {
	product, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if product == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.Name != nil {
		product.Name = *req.Name
	}
	if req.Description != nil {
		product.Description = *req.Description
	}
	if req.Price != nil {
		product.Price = *req.Price
	}
	if req.Category != nil {
		product.Category = *req.Category
	}
	if req.ImageURL != nil {
		product.ImageURL = *req.ImageURL
	}
	if req.SKU != nil {
		product.SKU = *req.SKU
	}
	if req.Stock != nil {
		product.Stock = req.Stock
	}
	if req.SortOrder != nil {
		product.SortOrder = *req.SortOrder
	}
	if req.Status != nil {
		product.Status = *req.Status
	}
	if req.Tags != nil {
		product.Tags = req.Tags
	}

	product.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, product); err != nil {
		return nil, fmt.Errorf("failed to update product: %w", err)
	}

	return product, nil
}

// Delete deletes a product
func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	product, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if product == nil {
		return errors.ErrNotFound
	}

	return s.repo.Delete(ctx, id)
}

// UpdateStock updates product stock
func (s *Service) UpdateStock(ctx context.Context, id uuid.UUID, delta int) error {
	return s.repo.UpdateStock(ctx, id, delta)
}

// DecrementStock decrements stock after a sale
func (s *Service) DecrementStock(ctx context.Context, productIDs []uuid.UUID) error {
	for _, id := range productIDs {
		if err := s.repo.UpdateStock(ctx, id, -1); err != nil {
			return fmt.Errorf("failed to decrement stock for %s: %w", id, err)
		}
	}
	return nil
}

// IncrementStock increments stock after a refund
func (s *Service) IncrementStock(ctx context.Context, productIDs []uuid.UUID) error {
	for _, id := range productIDs {
		if err := s.repo.UpdateStock(ctx, id, 1); err != nil {
			return fmt.Errorf("failed to increment stock for %s: %w", id, err)
		}
	}
	return nil
}

// Activate activates a product
func (s *Service) Activate(ctx context.Context, id uuid.UUID) (*Product, error) {
	status := ProductStatusActive
	return s.Update(ctx, id, UpdateProductRequest{Status: &status})
}

// Deactivate deactivates a product
func (s *Service) Deactivate(ctx context.Context, id uuid.UUID) (*Product, error) {
	status := ProductStatusInactive
	return s.Update(ctx, id, UpdateProductRequest{Status: &status})
}
