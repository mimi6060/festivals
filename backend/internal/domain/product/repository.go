package product

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	Create(ctx context.Context, product *Product) error
	CreateBulk(ctx context.Context, products []Product) error
	GetByID(ctx context.Context, id uuid.UUID) (*Product, error)
	GetByIDs(ctx context.Context, ids []uuid.UUID) ([]Product, error)
	ListByStand(ctx context.Context, standID uuid.UUID, offset, limit int) ([]Product, int64, error)
	ListByCategory(ctx context.Context, standID uuid.UUID, category ProductCategory) ([]Product, error)
	Update(ctx context.Context, product *Product) error
	Delete(ctx context.Context, id uuid.UUID) error
	UpdateStock(ctx context.Context, id uuid.UUID, delta int) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, product *Product) error {
	return r.db.WithContext(ctx).Create(product).Error
}

func (r *repository) CreateBulk(ctx context.Context, products []Product) error {
	return r.db.WithContext(ctx).Create(&products).Error
}

func (r *repository) GetByID(ctx context.Context, id uuid.UUID) (*Product, error) {
	var product Product
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&product).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get product: %w", err)
	}
	return &product, nil
}

func (r *repository) GetByIDs(ctx context.Context, ids []uuid.UUID) ([]Product, error) {
	var products []Product
	err := r.db.WithContext(ctx).Where("id IN ?", ids).Find(&products).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get products: %w", err)
	}
	return products, nil
}

func (r *repository) ListByStand(ctx context.Context, standID uuid.UUID, offset, limit int) ([]Product, int64, error) {
	var products []Product
	var total int64

	query := r.db.WithContext(ctx).Model(&Product{}).Where("stand_id = ?", standID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count products: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("sort_order ASC, name ASC").Find(&products).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list products: %w", err)
	}

	return products, total, nil
}

func (r *repository) ListByCategory(ctx context.Context, standID uuid.UUID, category ProductCategory) ([]Product, error) {
	var products []Product
	err := r.db.WithContext(ctx).
		Where("stand_id = ? AND category = ? AND status = ?", standID, category, ProductStatusActive).
		Order("sort_order ASC, name ASC").
		Find(&products).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list products by category: %w", err)
	}
	return products, nil
}

func (r *repository) Update(ctx context.Context, product *Product) error {
	return r.db.WithContext(ctx).Save(product).Error
}

func (r *repository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&Product{}).Error
}

// UpdateStock atomically updates product stock
func (r *repository) UpdateStock(ctx context.Context, id uuid.UUID, delta int) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var product Product
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", id).
			First(&product).Error; err != nil {
			return fmt.Errorf("failed to lock product: %w", err)
		}

		if product.Stock == nil {
			// Unlimited stock
			return nil
		}

		newStock := *product.Stock + delta
		if newStock < 0 {
			return fmt.Errorf("insufficient stock")
		}

		if err := tx.Model(&product).Update("stock", newStock).Error; err != nil {
			return fmt.Errorf("failed to update stock: %w", err)
		}

		// Update status if out of stock
		if newStock == 0 {
			if err := tx.Model(&product).Update("status", ProductStatusOutOfStock).Error; err != nil {
				return fmt.Errorf("failed to update status: %w", err)
			}
		} else if product.Status == ProductStatusOutOfStock && newStock > 0 {
			if err := tx.Model(&product).Update("status", ProductStatusActive).Error; err != nil {
				return fmt.Errorf("failed to update status: %w", err)
			}
		}

		return nil
	})
}
