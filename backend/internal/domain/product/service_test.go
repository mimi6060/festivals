package product

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// TestService_Create tests the Create method
func TestService_Create(t *testing.T) {
	tests := []struct {
		name      string
		req       CreateProductRequest
		setupMock func(*MockRepository)
		wantErr   bool
		validate  func(*testing.T, *Product)
	}{
		{
			name: "create beer product with unlimited stock",
			req: CreateProductRequest{
				StandID:     uuid.New(),
				Name:        "Lager Beer",
				Description: "Refreshing lager beer",
				Price:       350, // 3.50 EUR in cents
				Category:    ProductCategoryBeer,
				Tags:        []string{"alcoholic", "cold"},
			},
			setupMock: func(m *MockRepository) {
				m.On("Create", mock.Anything, mock.AnythingOfType("*product.Product")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, p *Product) {
				assert.Equal(t, "Lager Beer", p.Name)
				assert.Equal(t, "Refreshing lager beer", p.Description)
				assert.Equal(t, int64(350), p.Price)
				assert.Equal(t, ProductCategoryBeer, p.Category)
				assert.Nil(t, p.Stock)
				assert.Equal(t, ProductStatusActive, p.Status)
				assert.Equal(t, []string{"alcoholic", "cold"}, p.Tags)
			},
		},
		{
			name: "create food product with limited stock",
			req: CreateProductRequest{
				StandID:     uuid.New(),
				Name:        "Burger",
				Description: "Gourmet burger with fries",
				Price:       1200, // 12 EUR in cents
				Category:    ProductCategoryFood,
				Stock:       func() *int { s := 50; return &s }(),
				SortOrder:   1,
			},
			setupMock: func(m *MockRepository) {
				m.On("Create", mock.Anything, mock.AnythingOfType("*product.Product")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, p *Product) {
				assert.Equal(t, "Burger", p.Name)
				assert.Equal(t, int64(1200), p.Price)
				assert.Equal(t, ProductCategoryFood, p.Category)
				assert.NotNil(t, p.Stock)
				assert.Equal(t, 50, *p.Stock)
				assert.Equal(t, 1, p.SortOrder)
			},
		},
		{
			name: "create merchandise product with SKU",
			req: CreateProductRequest{
				StandID:  uuid.New(),
				Name:     "Festival T-Shirt",
				Price:    2500, // 25 EUR in cents
				Category: ProductCategoryMerch,
				SKU:      "TSHIRT-M-BLK",
				ImageURL: "https://example.com/tshirt.jpg",
				Stock:    func() *int { s := 100; return &s }(),
			},
			setupMock: func(m *MockRepository) {
				m.On("Create", mock.Anything, mock.AnythingOfType("*product.Product")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, p *Product) {
				assert.Equal(t, "Festival T-Shirt", p.Name)
				assert.Equal(t, "TSHIRT-M-BLK", p.SKU)
				assert.Equal(t, "https://example.com/tshirt.jpg", p.ImageURL)
				assert.Equal(t, ProductCategoryMerch, p.Category)
			},
		},
		{
			name: "create cocktail product",
			req: CreateProductRequest{
				StandID:     uuid.New(),
				Name:        "Mojito",
				Description: "Classic Cuban cocktail",
				Price:       800, // 8 EUR in cents
				Category:    ProductCategoryCocktail,
			},
			setupMock: func(m *MockRepository) {
				m.On("Create", mock.Anything, mock.AnythingOfType("*product.Product")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, p *Product) {
				assert.Equal(t, "Mojito", p.Name)
				assert.Equal(t, ProductCategoryCocktail, p.Category)
				assert.Equal(t, []string{}, p.Tags) // Should default to empty array
			},
		},
		{
			name: "create soft drink product",
			req: CreateProductRequest{
				StandID:  uuid.New(),
				Name:     "Cola",
				Price:    250,
				Category: ProductCategorySoft,
			},
			setupMock: func(m *MockRepository) {
				m.On("Create", mock.Anything, mock.AnythingOfType("*product.Product")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, p *Product) {
				assert.Equal(t, "Cola", p.Name)
				assert.Equal(t, ProductCategorySoft, p.Category)
			},
		},
		{
			name: "create product fails on repository error",
			req: CreateProductRequest{
				StandID:  uuid.New(),
				Name:     "Test Product",
				Price:    100,
				Category: ProductCategoryOther,
			},
			setupMock: func(m *MockRepository) {
				m.On("Create", mock.Anything, mock.AnythingOfType("*product.Product")).Return(errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo)

			service := NewService(mockRepo)

			product, err := service.Create(context.Background(), tt.req)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, product)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, product)
				assert.NotEqual(t, uuid.Nil, product.ID)
				assert.Equal(t, tt.req.StandID, product.StandID)
				if tt.validate != nil {
					tt.validate(t, product)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_UpdateStock tests the UpdateStock method
func TestService_UpdateStock(t *testing.T) {
	tests := []struct {
		name      string
		productID uuid.UUID
		delta     int
		setupMock func(*MockRepository, uuid.UUID)
		wantErr   bool
	}{
		{
			name:      "increase stock",
			productID: uuid.New(),
			delta:     10,
			setupMock: func(m *MockRepository, productID uuid.UUID) {
				m.On("UpdateStock", mock.Anything, productID, 10).Return(nil)
			},
			wantErr: false,
		},
		{
			name:      "decrease stock",
			productID: uuid.New(),
			delta:     -5,
			setupMock: func(m *MockRepository, productID uuid.UUID) {
				m.On("UpdateStock", mock.Anything, productID, -5).Return(nil)
			},
			wantErr: false,
		},
		{
			name:      "update stock on unlimited product",
			productID: uuid.New(),
			delta:     -1,
			setupMock: func(m *MockRepository, productID uuid.UUID) {
				m.On("UpdateStock", mock.Anything, productID, -1).Return(nil)
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.productID)

			service := NewService(mockRepo)

			err := service.UpdateStock(context.Background(), tt.productID, tt.delta)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_DecrementStock tests the DecrementStock method
func TestService_DecrementStock(t *testing.T) {
	tests := []struct {
		name       string
		productIDs []uuid.UUID
		setupMock  func(*MockRepository, []uuid.UUID)
		wantErr    bool
		errMsg     string
	}{
		{
			name:       "decrement single product stock",
			productIDs: []uuid.UUID{uuid.New()},
			setupMock: func(m *MockRepository, ids []uuid.UUID) {
				for _, id := range ids {
					m.On("UpdateStock", mock.Anything, id, -1).Return(nil)
				}
			},
			wantErr: false,
		},
		{
			name:       "decrement multiple products stock",
			productIDs: []uuid.UUID{uuid.New(), uuid.New(), uuid.New()},
			setupMock: func(m *MockRepository, ids []uuid.UUID) {
				for _, id := range ids {
					m.On("UpdateStock", mock.Anything, id, -1).Return(nil)
				}
			},
			wantErr: false,
		},
		{
			name:       "decrement with insufficient stock fails",
			productIDs: []uuid.UUID{uuid.New()},
			setupMock: func(m *MockRepository, ids []uuid.UUID) {
				m.On("UpdateStock", mock.Anything, ids[0], -1).Return(errors.New("insufficient stock"))
			},
			wantErr: true,
			errMsg:  "insufficient stock",
		},
		{
			name:       "decrement fails on second product",
			productIDs: []uuid.UUID{uuid.New(), uuid.New()},
			setupMock: func(m *MockRepository, ids []uuid.UUID) {
				m.On("UpdateStock", mock.Anything, ids[0], -1).Return(nil)
				m.On("UpdateStock", mock.Anything, ids[1], -1).Return(errors.New("insufficient stock"))
			},
			wantErr: true,
			errMsg:  "insufficient stock",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.productIDs)

			service := NewService(mockRepo)

			err := service.DecrementStock(context.Background(), tt.productIDs)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_IncrementStock tests the IncrementStock method
func TestService_IncrementStock(t *testing.T) {
	tests := []struct {
		name       string
		productIDs []uuid.UUID
		setupMock  func(*MockRepository, []uuid.UUID)
		wantErr    bool
	}{
		{
			name:       "increment single product stock",
			productIDs: []uuid.UUID{uuid.New()},
			setupMock: func(m *MockRepository, ids []uuid.UUID) {
				for _, id := range ids {
					m.On("UpdateStock", mock.Anything, id, 1).Return(nil)
				}
			},
			wantErr: false,
		},
		{
			name:       "increment multiple products stock",
			productIDs: []uuid.UUID{uuid.New(), uuid.New()},
			setupMock: func(m *MockRepository, ids []uuid.UUID) {
				for _, id := range ids {
					m.On("UpdateStock", mock.Anything, id, 1).Return(nil)
				}
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.productIDs)

			service := NewService(mockRepo)

			err := service.IncrementStock(context.Background(), tt.productIDs)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_Update tests the Update method
func TestService_Update(t *testing.T) {
	tests := []struct {
		name      string
		productID uuid.UUID
		req       UpdateProductRequest
		setupMock func(*MockRepository, uuid.UUID)
		wantErr   bool
		validate  func(*testing.T, *Product)
	}{
		{
			name:      "update product name",
			productID: uuid.New(),
			req: UpdateProductRequest{
				Name: func() *string { s := "Updated Beer Name"; return &s }(),
			},
			setupMock: func(m *MockRepository, productID uuid.UUID) {
				existing := &Product{
					ID:       productID,
					Name:     "Original Name",
					Price:    350,
					Category: ProductCategoryBeer,
					Status:   ProductStatusActive,
					Tags:     []string{},
				}
				m.On("GetByID", mock.Anything, productID).Return(existing, nil)
				m.On("Update", mock.Anything, mock.AnythingOfType("*product.Product")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, p *Product) {
				assert.Equal(t, "Updated Beer Name", p.Name)
			},
		},
		{
			name:      "update product price",
			productID: uuid.New(),
			req: UpdateProductRequest{
				Price: func() *int64 { p := int64(500); return &p }(),
			},
			setupMock: func(m *MockRepository, productID uuid.UUID) {
				existing := &Product{
					ID:       productID,
					Name:     "Test Product",
					Price:    350,
					Category: ProductCategoryBeer,
					Status:   ProductStatusActive,
					Tags:     []string{},
				}
				m.On("GetByID", mock.Anything, productID).Return(existing, nil)
				m.On("Update", mock.Anything, mock.AnythingOfType("*product.Product")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, p *Product) {
				assert.Equal(t, int64(500), p.Price)
			},
		},
		{
			name:      "update product stock",
			productID: uuid.New(),
			req: UpdateProductRequest{
				Stock: func() *int { s := 100; return &s }(),
			},
			setupMock: func(m *MockRepository, productID uuid.UUID) {
				existing := &Product{
					ID:       productID,
					Name:     "Test Product",
					Price:    350,
					Category: ProductCategoryFood,
					Status:   ProductStatusActive,
					Stock:    func() *int { s := 50; return &s }(),
					Tags:     []string{},
				}
				m.On("GetByID", mock.Anything, productID).Return(existing, nil)
				m.On("Update", mock.Anything, mock.AnythingOfType("*product.Product")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, p *Product) {
				assert.NotNil(t, p.Stock)
				assert.Equal(t, 100, *p.Stock)
			},
		},
		{
			name:      "update multiple fields",
			productID: uuid.New(),
			req: UpdateProductRequest{
				Name:        func() *string { s := "New Name"; return &s }(),
				Description: func() *string { s := "New Description"; return &s }(),
				Price:       func() *int64 { p := int64(1000); return &p }(),
				Tags:        []string{"new", "tags"},
			},
			setupMock: func(m *MockRepository, productID uuid.UUID) {
				existing := &Product{
					ID:          productID,
					Name:        "Old Name",
					Description: "Old Description",
					Price:       500,
					Category:    ProductCategoryMerch,
					Status:      ProductStatusActive,
					Tags:        []string{"old"},
				}
				m.On("GetByID", mock.Anything, productID).Return(existing, nil)
				m.On("Update", mock.Anything, mock.AnythingOfType("*product.Product")).Return(nil)
			},
			wantErr: false,
			validate: func(t *testing.T, p *Product) {
				assert.Equal(t, "New Name", p.Name)
				assert.Equal(t, "New Description", p.Description)
				assert.Equal(t, int64(1000), p.Price)
				assert.Equal(t, []string{"new", "tags"}, p.Tags)
			},
		},
		{
			name:      "update non-existent product fails",
			productID: uuid.New(),
			req: UpdateProductRequest{
				Name: func() *string { s := "Test"; return &s }(),
			},
			setupMock: func(m *MockRepository, productID uuid.UUID) {
				m.On("GetByID", mock.Anything, productID).Return(nil, nil)
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.productID)

			service := NewService(mockRepo)

			product, err := service.Update(context.Background(), tt.productID, tt.req)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, product)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, product)
				if tt.validate != nil {
					tt.validate(t, product)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_Delete tests the Delete method
func TestService_Delete(t *testing.T) {
	tests := []struct {
		name      string
		productID uuid.UUID
		setupMock func(*MockRepository, uuid.UUID)
		wantErr   bool
	}{
		{
			name:      "delete existing product",
			productID: uuid.New(),
			setupMock: func(m *MockRepository, productID uuid.UUID) {
				product := &Product{
					ID:       productID,
					Name:     "Test Product",
					Price:    100,
					Category: ProductCategoryBeer,
					Status:   ProductStatusActive,
				}
				m.On("GetByID", mock.Anything, productID).Return(product, nil)
				m.On("Delete", mock.Anything, productID).Return(nil)
			},
			wantErr: false,
		},
		{
			name:      "delete non-existent product fails",
			productID: uuid.New(),
			setupMock: func(m *MockRepository, productID uuid.UUID) {
				m.On("GetByID", mock.Anything, productID).Return(nil, nil)
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.productID)

			service := NewService(mockRepo)

			err := service.Delete(context.Background(), tt.productID)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_Activate tests the Activate method
func TestService_Activate(t *testing.T) {
	mockRepo := NewMockRepository()
	productID := uuid.New()

	existing := &Product{
		ID:        productID,
		Name:      "Test Product",
		Price:     350,
		Category:  ProductCategoryBeer,
		Status:    ProductStatusInactive,
		Tags:      []string{},
		CreatedAt: time.Now().Add(-24 * time.Hour),
		UpdatedAt: time.Now().Add(-24 * time.Hour),
	}

	mockRepo.On("GetByID", mock.Anything, productID).Return(existing, nil)
	mockRepo.On("Update", mock.Anything, mock.MatchedBy(func(p *Product) bool {
		return p.Status == ProductStatusActive
	})).Return(nil)

	service := NewService(mockRepo)

	product, err := service.Activate(context.Background(), productID)

	assert.NoError(t, err)
	assert.NotNil(t, product)
	assert.Equal(t, ProductStatusActive, product.Status)

	mockRepo.AssertExpectations(t)
}

// TestService_Deactivate tests the Deactivate method
func TestService_Deactivate(t *testing.T) {
	mockRepo := NewMockRepository()
	productID := uuid.New()

	existing := &Product{
		ID:        productID,
		Name:      "Test Product",
		Price:     350,
		Category:  ProductCategoryBeer,
		Status:    ProductStatusActive,
		Tags:      []string{},
		CreatedAt: time.Now().Add(-24 * time.Hour),
		UpdatedAt: time.Now().Add(-24 * time.Hour),
	}

	mockRepo.On("GetByID", mock.Anything, productID).Return(existing, nil)
	mockRepo.On("Update", mock.Anything, mock.MatchedBy(func(p *Product) bool {
		return p.Status == ProductStatusInactive
	})).Return(nil)

	service := NewService(mockRepo)

	product, err := service.Deactivate(context.Background(), productID)

	assert.NoError(t, err)
	assert.NotNil(t, product)
	assert.Equal(t, ProductStatusInactive, product.Status)

	mockRepo.AssertExpectations(t)
}

// TestService_GetByID tests the GetByID method
func TestService_GetByID(t *testing.T) {
	tests := []struct {
		name      string
		productID uuid.UUID
		setupMock func(*MockRepository, uuid.UUID)
		wantErr   bool
	}{
		{
			name:      "get existing product",
			productID: uuid.New(),
			setupMock: func(m *MockRepository, productID uuid.UUID) {
				product := &Product{
					ID:       productID,
					Name:     "Test Product",
					Price:    350,
					Category: ProductCategoryBeer,
					Status:   ProductStatusActive,
				}
				m.On("GetByID", mock.Anything, productID).Return(product, nil)
			},
			wantErr: false,
		},
		{
			name:      "get non-existent product fails",
			productID: uuid.New(),
			setupMock: func(m *MockRepository, productID uuid.UUID) {
				m.On("GetByID", mock.Anything, productID).Return(nil, nil)
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.productID)

			service := NewService(mockRepo)

			product, err := service.GetByID(context.Background(), tt.productID)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, product)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, product)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_List tests the List method
func TestService_List(t *testing.T) {
	tests := []struct {
		name           string
		standID        uuid.UUID
		page           int
		perPage        int
		expectedOffset int
		expectedLimit  int
		setupMock      func(*MockRepository, uuid.UUID)
	}{
		{
			name:           "first page default per page",
			standID:        uuid.New(),
			page:           1,
			perPage:        50,
			expectedOffset: 0,
			expectedLimit:  50,
			setupMock: func(m *MockRepository, standID uuid.UUID) {
				m.On("ListByStand", mock.Anything, standID, 0, 50).Return([]Product{}, int64(0), nil)
			},
		},
		{
			name:           "second page",
			standID:        uuid.New(),
			page:           2,
			perPage:        50,
			expectedOffset: 50,
			expectedLimit:  50,
			setupMock: func(m *MockRepository, standID uuid.UUID) {
				m.On("ListByStand", mock.Anything, standID, 50, 50).Return([]Product{}, int64(0), nil)
			},
		},
		{
			name:           "invalid page defaults to 1",
			standID:        uuid.New(),
			page:           0,
			perPage:        50,
			expectedOffset: 0,
			expectedLimit:  50,
			setupMock: func(m *MockRepository, standID uuid.UUID) {
				m.On("ListByStand", mock.Anything, standID, 0, 50).Return([]Product{}, int64(0), nil)
			},
		},
		{
			name:           "invalid per page defaults to 50",
			standID:        uuid.New(),
			page:           1,
			perPage:        0,
			expectedOffset: 0,
			expectedLimit:  50,
			setupMock: func(m *MockRepository, standID uuid.UUID) {
				m.On("ListByStand", mock.Anything, standID, 0, 50).Return([]Product{}, int64(0), nil)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo, tt.standID)

			service := NewService(mockRepo)

			_, _, err := service.List(context.Background(), tt.standID, tt.page, tt.perPage)
			assert.NoError(t, err)

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestService_CreateBulk tests the CreateBulk method
func TestService_CreateBulk(t *testing.T) {
	tests := []struct {
		name      string
		req       BulkCreateProductRequest
		setupMock func(*MockRepository)
		wantErr   bool
		wantCount int
	}{
		{
			name: "create multiple products",
			req: BulkCreateProductRequest{
				StandID: uuid.New(),
				Products: []CreateProductRequest{
					{Name: "Beer 1", Price: 350, Category: ProductCategoryBeer},
					{Name: "Beer 2", Price: 400, Category: ProductCategoryBeer},
					{Name: "Cola", Price: 250, Category: ProductCategorySoft},
				},
			},
			setupMock: func(m *MockRepository) {
				m.On("CreateBulk", mock.Anything, mock.AnythingOfType("[]product.Product")).Return(nil)
			},
			wantErr:   false,
			wantCount: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := NewMockRepository()
			tt.setupMock(mockRepo)

			service := NewService(mockRepo)

			products, err := service.CreateBulk(context.Background(), tt.req)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Len(t, products, tt.wantCount)
				for _, p := range products {
					assert.Equal(t, tt.req.StandID, p.StandID)
					assert.NotEqual(t, uuid.Nil, p.ID)
					assert.Equal(t, ProductStatusActive, p.Status)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
