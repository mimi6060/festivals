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

	// Stand products endpoint
	r.GET("/stands/:standId/products", h.ListByStand)
}

// Create creates a new product
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
func (h *Handler) ListByStand(c *gin.Context) {
	standID, err := uuid.Parse(c.Param("standId"))
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
