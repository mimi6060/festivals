package pricing

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Stand-level pricing rules
	stands := r.Group("/stands/:standId/pricing-rules")
	{
		stands.POST("", h.Create)
		stands.GET("", h.List)
	}

	// Current prices endpoint
	r.GET("/stands/:standId/current-prices", h.GetCurrentPrices)

	// Individual pricing rule operations
	pricingRules := r.Group("/pricing-rules")
	{
		pricingRules.GET("/:id", h.GetByID)
		pricingRules.PATCH("/:id", h.Update)
		pricingRules.DELETE("/:id", h.Delete)
	}
}

// Create creates a new pricing rule
// @Summary Create pricing rule
// @Description Create a new pricing rule (e.g., happy hour) for a stand
// @Tags pricing
// @Accept json
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param standId path string true "Stand ID" format(uuid)
// @Param request body CreatePricingRuleRequest true "Pricing rule data"
// @Success 201 {object} response.Response{data=PricingRuleResponse} "Pricing rule created"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 409 {object} response.ErrorResponse "Overlapping rule exists"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/stands/{standId}/pricing-rules [post]
func (h *Handler) Create(c *gin.Context) {
	standID, err := uuid.Parse(c.Param("standId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	var req CreatePricingRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	rule, err := h.service.Create(c.Request.Context(), standID, req)
	if err != nil {
		if err.Error()[:23] == "pricing rule overlaps" {
			response.Conflict(c, "OVERLAPPING_RULE", err.Error())
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	isActive := h.service.IsRuleCurrentlyActive(rule)
	response.Created(c, rule.ToResponse(isActive))
}

// List lists pricing rules for a stand
// @Summary List pricing rules
// @Description Get paginated list of pricing rules for a stand
// @Tags pricing
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param standId path string true "Stand ID" format(uuid)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} response.Response{data=[]PricingRuleResponse,meta=response.Meta} "Pricing rules list"
// @Failure 400 {object} response.ErrorResponse "Invalid stand ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/stands/{standId}/pricing-rules [get]
func (h *Handler) List(c *gin.Context) {
	standID, err := uuid.Parse(c.Param("standId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	rules, total, err := h.service.List(c.Request.Context(), standID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]PricingRuleResponse, len(rules))
	for i, rule := range rules {
		isActive := h.service.IsRuleCurrentlyActive(&rule)
		items[i] = rule.ToResponse(isActive)
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetByID gets a pricing rule by ID
// @Summary Get pricing rule
// @Description Get detailed information about a specific pricing rule
// @Tags pricing
// @Produce json
// @Param id path string true "Pricing Rule ID" format(uuid)
// @Success 200 {object} response.Response{data=PricingRuleResponse} "Pricing rule details"
// @Failure 400 {object} response.ErrorResponse "Invalid ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Pricing rule not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /pricing-rules/{id} [get]
func (h *Handler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid pricing rule ID", nil)
		return
	}

	rule, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Pricing rule not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	isActive := h.service.IsRuleCurrentlyActive(rule)
	response.OK(c, rule.ToResponse(isActive))
}

// Update updates a pricing rule
// @Summary Update pricing rule
// @Description Update an existing pricing rule
// @Tags pricing
// @Accept json
// @Produce json
// @Param id path string true "Pricing Rule ID" format(uuid)
// @Param request body UpdatePricingRuleRequest true "Update data"
// @Success 200 {object} response.Response{data=PricingRuleResponse} "Updated pricing rule"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Pricing rule not found"
// @Failure 409 {object} response.ErrorResponse "Overlapping rule exists"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /pricing-rules/{id} [patch]
func (h *Handler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid pricing rule ID", nil)
		return
	}

	var req UpdatePricingRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	rule, err := h.service.Update(c.Request.Context(), id, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Pricing rule not found")
			return
		}
		if len(err.Error()) >= 23 && err.Error()[:23] == "pricing rule overlaps" {
			response.Conflict(c, "OVERLAPPING_RULE", err.Error())
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	isActive := h.service.IsRuleCurrentlyActive(rule)
	response.OK(c, rule.ToResponse(isActive))
}

// Delete deletes a pricing rule
// @Summary Delete pricing rule
// @Description Permanently delete a pricing rule
// @Tags pricing
// @Param id path string true "Pricing Rule ID" format(uuid)
// @Success 204 "Pricing rule deleted"
// @Failure 400 {object} response.ErrorResponse "Invalid ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Pricing rule not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /pricing-rules/{id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid pricing rule ID", nil)
		return
	}

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Pricing rule not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.NoContent(c)
}

// GetCurrentPrices gets all products with their current prices
// @Summary Get current prices
// @Description Get all products for a stand with their current prices after applying active discounts
// @Tags pricing
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param standId path string true "Stand ID" format(uuid)
// @Success 200 {object} response.Response{data=CurrentPricesResponse} "Current prices"
// @Failure 400 {object} response.ErrorResponse "Invalid stand ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/stands/{standId}/current-prices [get]
func (h *Handler) GetCurrentPrices(c *gin.Context) {
	standID, err := uuid.Parse(c.Param("standId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	prices, err := h.service.GetCurrentPrices(c.Request.Context(), standID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, prices)
}
