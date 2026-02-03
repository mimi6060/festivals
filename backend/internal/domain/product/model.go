package product

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Product represents an item sold at a stand
type Product struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	StandID     uuid.UUID      `json:"standId" gorm:"type:uuid;not null;index"`
	Name        string         `json:"name" gorm:"not null"`
	Description string         `json:"description"`
	Price       int64          `json:"price" gorm:"not null"` // Price in cents
	Category    ProductCategory `json:"category" gorm:"not null"`
	ImageURL    string         `json:"imageUrl,omitempty"`
	SKU         string         `json:"sku,omitempty" gorm:"index"` // Stock keeping unit
	Stock       *int           `json:"stock,omitempty"`            // nil = unlimited
	SortOrder   int            `json:"sortOrder" gorm:"default:0"`
	Status      ProductStatus  `json:"status" gorm:"default:'ACTIVE'"`
	Tags        []string       `json:"tags" gorm:"type:text[];serializer:json"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
}

func (Product) TableName() string {
	return "products"
}

type ProductCategory string

const (
	ProductCategoryBeer      ProductCategory = "BEER"
	ProductCategoryCocktail  ProductCategory = "COCKTAIL"
	ProductCategorySoft      ProductCategory = "SOFT"
	ProductCategoryFood      ProductCategory = "FOOD"
	ProductCategorySnack     ProductCategory = "SNACK"
	ProductCategoryMerch     ProductCategory = "MERCH"
	ProductCategoryOther     ProductCategory = "OTHER"
)

type ProductStatus string

const (
	ProductStatusActive   ProductStatus = "ACTIVE"
	ProductStatusInactive ProductStatus = "INACTIVE"
	ProductStatusOutOfStock ProductStatus = "OUT_OF_STOCK"
)

// CreateProductRequest represents the request to create a product
type CreateProductRequest struct {
	StandID     uuid.UUID       `json:"standId" binding:"required"`
	Name        string          `json:"name" binding:"required"`
	Description string          `json:"description"`
	Price       int64           `json:"price" binding:"required,min=0"`
	Category    ProductCategory `json:"category" binding:"required"`
	ImageURL    string          `json:"imageUrl"`
	SKU         string          `json:"sku"`
	Stock       *int            `json:"stock"`
	SortOrder   int             `json:"sortOrder"`
	Tags        []string        `json:"tags"`
}

// UpdateProductRequest represents the request to update a product
type UpdateProductRequest struct {
	Name        *string          `json:"name,omitempty"`
	Description *string          `json:"description,omitempty"`
	Price       *int64           `json:"price,omitempty"`
	Category    *ProductCategory `json:"category,omitempty"`
	ImageURL    *string          `json:"imageUrl,omitempty"`
	SKU         *string          `json:"sku,omitempty"`
	Stock       *int             `json:"stock,omitempty"`
	SortOrder   *int             `json:"sortOrder,omitempty"`
	Status      *ProductStatus   `json:"status,omitempty"`
	Tags        []string         `json:"tags,omitempty"`
}

// BulkCreateProductRequest represents bulk product creation
type BulkCreateProductRequest struct {
	StandID  uuid.UUID              `json:"standId" binding:"required"`
	Products []CreateProductRequest `json:"products" binding:"required,min=1"`
}

// ProductResponse represents the API response for a product
type ProductResponse struct {
	ID           uuid.UUID       `json:"id"`
	StandID      uuid.UUID       `json:"standId"`
	Name         string          `json:"name"`
	Description  string          `json:"description"`
	Price        int64           `json:"price"`
	PriceDisplay string          `json:"priceDisplay"`
	Category     ProductCategory `json:"category"`
	ImageURL     string          `json:"imageUrl,omitempty"`
	SKU          string          `json:"sku,omitempty"`
	Stock        *int            `json:"stock,omitempty"`
	SortOrder    int             `json:"sortOrder"`
	Status       ProductStatus   `json:"status"`
	Tags         []string        `json:"tags"`
	CreatedAt    string          `json:"createdAt"`
	UpdatedAt    string          `json:"updatedAt"`
}

func (p *Product) ToResponse(exchangeRate float64, currencyName string) ProductResponse {
	// Convert cents to tokens
	tokens := float64(p.Price) * exchangeRate
	priceDisplay := formatPrice(tokens, currencyName)

	return ProductResponse{
		ID:           p.ID,
		StandID:      p.StandID,
		Name:         p.Name,
		Description:  p.Description,
		Price:        p.Price,
		PriceDisplay: priceDisplay,
		Category:     p.Category,
		ImageURL:     p.ImageURL,
		SKU:          p.SKU,
		Stock:        p.Stock,
		SortOrder:    p.SortOrder,
		Status:       p.Status,
		Tags:         p.Tags,
		CreatedAt:    p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    p.UpdatedAt.Format(time.RFC3339),
	}
}

func formatPrice(tokens float64, currencyName string) string {
	if tokens == float64(int64(tokens)) {
		return fmt.Sprintf("%.0f %s", tokens, currencyName)
	}
	return fmt.Sprintf("%.2f %s", tokens, currencyName)
}
