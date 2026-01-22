package product

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

type Handler struct {
	service      *Service
	exchangeRate float64
	currencyName string
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service:      service,
		exchangeRate: 0.10,
		currencyName: "Jetons",
	}
}

// SetFestivalConfig sets the festival-specific configuration
func (h *Handler) SetFestivalConfig(exchangeRate float64, currencyName string) {
	h.exchangeRate = exchangeRate
	h.currencyName = currencyName
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	products := r.Group("/products")
	{
		products.POST("", h.Create)
		products.POST("/bulk", h.CreateBulk)
		products.GET("", h.List)
		products.GET("/:id", h.GetByID)
		products.PATCH("/:id", h.Update)
		products.DELETE("/:id", h.Delete)
		products.POST("/:id/activate", h.Activate)
		products.POST("/:id/deactivate", h.Deactivate)
		products.POST("/:id/stock", h.UpdateStock)
	}

	// Stand products endpoint (uses same :id as stands routes)
	r.GET("/stands/:id/products", h.ListByStand)
}

// Create creates a new product
// @Summary Create a new product
// @Description Create a new product for a stand
// @Tags products
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param request body CreateProductRequest true "Product data"
// @Success 201 {object} response.Response{data=ProductResponse} "Product created"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/products [post]
func (h *Handler) Create(c *gin.Context) {
	var req CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	product, err := h.service.Create(c.Request.Context(), req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, product.ToResponse(h.exchangeRate, h.currencyName))
}

// CreateBulk creates multiple products at once
// @Summary Bulk create products
// @Description Create multiple products at once
// @Tags products
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param request body BulkCreateProductRequest true "Products data"
// @Success 201 {object} response.Response{data=[]ProductResponse} "Products created"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/products/bulk [post]
func (h *Handler) CreateBulk(c *gin.Context) {
	var req BulkCreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	products, err := h.service.CreateBulk(c.Request.Context(), req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]ProductResponse, len(products))
	for i, p := range products {
		items[i] = p.ToResponse(h.exchangeRate, h.currencyName)
	}

	response.Created(c, items)
}

// List lists products (with optional standId filter)
// @Summary List products
// @Description Get paginated list of products for a stand
// @Tags products
// @Produce json
// @Param standId query string true "Stand ID" format(uuid)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(50)
// @Param category query string false "Filter by category" Enums(food, drinks, merchandise, other)
// @Success 200 {object} response.Response{data=[]ProductResponse,meta=response.Meta} "Product list"
// @Failure 400 {object} response.ErrorResponse "Invalid stand ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/products [get]
func (h *Handler) List(c *gin.Context) {
	standIDStr := c.Query("standId")
	if standIDStr == "" {
		response.BadRequest(c, "MISSING_STAND", "standId query parameter required", nil)
		return
	}

	standID, err := uuid.Parse(standIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))
	category := c.Query("category")

	if category != "" {
		products, err := h.service.ListByCategory(c.Request.Context(), standID, ProductCategory(category))
		if err != nil {
			response.InternalError(c, err.Error())
			return
		}

		items := make([]ProductResponse, len(products))
		for i, p := range products {
			items[i] = p.ToResponse(h.exchangeRate, h.currencyName)
		}

		response.OK(c, items)
		return
	}

	products, total, err := h.service.List(c.Request.Context(), standID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]ProductResponse, len(products))
	for i, p := range products {
		items[i] = p.ToResponse(h.exchangeRate, h.currencyName)
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// ListByStand lists products for a specific stand
// @Summary List products by stand
// @Description Get paginated list of products for a specific stand
// @Tags products
// @Produce json
// @Param standId path string true "Stand ID" format(uuid)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(50)
// @Success 200 {object} response.Response{data=[]ProductResponse,meta=response.Meta} "Product list"
// @Failure 400 {object} response.ErrorResponse "Invalid stand ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /stands/{standId}/products [get]
func (h *Handler) ListByStand(c *gin.Context) {
	standID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))

	products, total, err := h.service.List(c.Request.Context(), standID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]ProductResponse, len(products))
	for i, p := range products {
		items[i] = p.ToResponse(h.exchangeRate, h.currencyName)
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetByID gets a product by ID
// @Summary Get product by ID
// @Description Get detailed information about a specific product
// @Tags products
// @Produce json
// @Param id path string true "Product ID" format(uuid)
// @Success 200 {object} response.Response{data=ProductResponse} "Product details"
// @Failure 400 {object} response.ErrorResponse "Invalid product ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Product not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/products/{id} [get]
func (h *Handler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid product ID", nil)
		return
	}

	product, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Product not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, product.ToResponse(h.exchangeRate, h.currencyName))
}

// Update updates a product
// @Summary Update product
// @Description Update an existing product
// @Tags products
// @Accept json
// @Produce json
// @Param id path string true "Product ID" format(uuid)
// @Param request body UpdateProductRequest true "Update data"
// @Success 200 {object} response.Response{data=ProductResponse} "Updated product"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Product not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/products/{id} [patch]
func (h *Handler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid product ID", nil)
		return
	}

	var req UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	product, err := h.service.Update(c.Request.Context(), id, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Product not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, product.ToResponse(h.exchangeRate, h.currencyName))
}

// Delete deletes a product
// @Summary Delete product
// @Description Permanently delete a product
// @Tags products
// @Param id path string true "Product ID" format(uuid)
// @Success 204 "Product deleted"
// @Failure 400 {object} response.ErrorResponse "Invalid product ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Product not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/products/{id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid product ID", nil)
		return
	}

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Product not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// Activate activates a product
// @Summary Activate product
// @Description Activate a product for sale
// @Tags products
// @Produce json
// @Param id path string true "Product ID" format(uuid)
// @Success 200 {object} response.Response{data=ProductResponse} "Activated product"
// @Failure 400 {object} response.ErrorResponse "Invalid product ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Product not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/products/{id}/activate [post]
func (h *Handler) Activate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid product ID", nil)
		return
	}

	product, err := h.service.Activate(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Product not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, product.ToResponse(h.exchangeRate, h.currencyName))
}

// Deactivate deactivates a product
// @Summary Deactivate product
// @Description Deactivate a product, preventing sales
// @Tags products
// @Produce json
// @Param id path string true "Product ID" format(uuid)
// @Success 200 {object} response.Response{data=ProductResponse} "Deactivated product"
// @Failure 400 {object} response.ErrorResponse "Invalid product ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Product not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/products/{id}/deactivate [post]
func (h *Handler) Deactivate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid product ID", nil)
		return
	}

	product, err := h.service.Deactivate(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Product not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, product.ToResponse(h.exchangeRate, h.currencyName))
}

// UpdateStock updates product stock
// @Summary Update product stock
// @Description Adjust product stock quantity (can be positive or negative)
// @Tags products
// @Accept json
// @Produce json
// @Param id path string true "Product ID" format(uuid)
// @Param request body object{delta=int} true "Stock delta"
// @Success 200 {object} response.Response{data=ProductResponse} "Updated product"
// @Failure 400 {object} response.ErrorResponse "Invalid request or insufficient stock"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Product not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/products/{id}/stock [post]
func (h *Handler) UpdateStock(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid product ID", nil)
		return
	}

	var req struct {
		Delta int `json:"delta" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	if err := h.service.UpdateStock(c.Request.Context(), id, req.Delta); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Product not found")
			return
		}
		if err.Error() == "insufficient stock" {
			response.BadRequest(c, "INSUFFICIENT_STOCK", "Insufficient stock", nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	// Get updated product
	product, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, product.ToResponse(h.exchangeRate, h.currencyName))
}
