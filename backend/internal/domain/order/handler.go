package order

import (
	"strconv"
	"time"

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
		exchangeRate: 0.10, // Default, should be overridden per festival
		currencyName: "Jetons",
	}
}

// SetFestivalConfig sets the festival-specific configuration
func (h *Handler) SetFestivalConfig(exchangeRate float64, currencyName string) {
	h.exchangeRate = exchangeRate
	h.currencyName = currencyName
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// User order routes
	me := r.Group("/me")
	{
		me.GET("/orders", h.GetMyOrders)
		me.GET("/orders/:orderId", h.GetMyOrder)
	}

	// Order management routes (staff/admin)
	orders := r.Group("/orders")
	{
		orders.POST("", h.CreateOrder)
		orders.GET("/:id", h.GetOrder)
		orders.POST("/:id/pay", h.ProcessPayment)
		orders.POST("/:id/cancel", h.CancelOrder)
		orders.POST("/:id/refund", h.RefundOrder)
	}

	// Stand order routes (staff)
	stands := r.Group("/stands")
	{
		stands.GET("/:standId/orders", h.GetStandOrders)
		stands.GET("/:standId/orders/stats", h.GetStandStats)
	}

	// Festival order routes (admin)
	festivals := r.Group("/festivals")
	{
		festivals.GET("/:festivalId/orders", h.GetFestivalOrders)
	}
}

// GetMyOrders returns the current user's order history
// @Summary Get my orders
// @Description Get paginated list of orders for the authenticated user
// @Tags orders
// @Produce json
// @Param festival_id query string true "Festival ID" format(uuid)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} response.Response{data=[]OrderResponse,meta=response.Meta} "Order list"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /me/orders [get]
func (h *Handler) GetMyOrders(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	festivalIDStr := c.Query("festival_id")
	if festivalIDStr == "" {
		response.BadRequest(c, "MISSING_PARAM", "festival_id is required", nil)
		return
	}

	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	orders, total, err := h.service.GetOrderHistory(c.Request.Context(), userID, festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]OrderResponse, len(orders))
	for i, o := range orders {
		items[i] = o.ToResponse(h.exchangeRate, h.currencyName)
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetMyOrder returns a specific order for the current user
// @Summary Get my order
// @Description Get details of a specific order belonging to the authenticated user
// @Tags orders
// @Produce json
// @Param orderId path string true "Order ID" format(uuid)
// @Success 200 {object} response.Response{data=OrderResponse} "Order details"
// @Failure 400 {object} response.ErrorResponse "Invalid order ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 403 {object} response.ErrorResponse "Access denied"
// @Failure 404 {object} response.ErrorResponse "Order not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /me/orders/{orderId} [get]
func (h *Handler) GetMyOrder(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid order ID", nil)
		return
	}

	order, err := h.service.GetOrder(c.Request.Context(), orderID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Order not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	// Verify the order belongs to the user
	if order.UserID != userID {
		response.Forbidden(c, "Access denied")
		return
	}

	response.OK(c, order.ToResponse(h.exchangeRate, h.currencyName))
}

// CreateOrder creates a new order
// @Summary Create order
// @Description Create a new order for a stand
// @Tags orders
// @Accept json
// @Produce json
// @Param request body CreateOrderRequest true "Order data"
// @Success 201 {object} response.Response{data=OrderResponse} "Created order"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /orders [post]
func (h *Handler) CreateOrder(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	// Get festival and wallet IDs from context or request
	festivalID, err := getFestivalID(c)
	if err != nil {
		response.BadRequest(c, "MISSING_CONTEXT", "Festival context required", nil)
		return
	}

	walletID, err := getWalletID(c)
	if err != nil {
		response.BadRequest(c, "MISSING_CONTEXT", "Wallet context required", nil)
		return
	}

	staffID := getStaffID(c)

	order, err := h.service.CreateOrder(c.Request.Context(), userID, festivalID, walletID, req, staffID)
	if err != nil {
		response.BadRequest(c, "CREATE_FAILED", err.Error(), nil)
		return
	}

	response.Created(c, order.ToResponse(h.exchangeRate, h.currencyName))
}

// GetOrder returns an order by ID
// @Summary Get order
// @Description Get order details by ID (staff/admin only)
// @Tags orders
// @Produce json
// @Param id path string true "Order ID" format(uuid)
// @Success 200 {object} response.Response{data=OrderResponse} "Order details"
// @Failure 400 {object} response.ErrorResponse "Invalid order ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Order not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /orders/{id} [get]
func (h *Handler) GetOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid order ID", nil)
		return
	}

	order, err := h.service.GetOrder(c.Request.Context(), orderID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Order not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, order.ToResponse(h.exchangeRate, h.currencyName))
}

// ProcessPayment processes payment for an order
// @Summary Process payment
// @Description Process payment for a pending order (staff only)
// @Tags orders
// @Produce json
// @Param id path string true "Order ID" format(uuid)
// @Success 200 {object} response.Response{data=OrderResponse} "Paid order"
// @Failure 400 {object} response.ErrorResponse "Invalid request or payment failed"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Order not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /orders/{id}/pay [post]
func (h *Handler) ProcessPayment(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid order ID", nil)
		return
	}

	staffID, err := getStaffIDRequired(c)
	if err != nil {
		response.Unauthorized(c, "Staff authentication required")
		return
	}

	order, err := h.service.ProcessPayment(c.Request.Context(), orderID, staffID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Order not found")
			return
		}
		if err.Error() == "insufficient balance" {
			response.BadRequest(c, "INSUFFICIENT_BALANCE", "Insufficient wallet balance", nil)
			return
		}
		response.BadRequest(c, "PAYMENT_FAILED", err.Error(), nil)
		return
	}

	response.OK(c, order.ToResponse(h.exchangeRate, h.currencyName))
}

// CancelOrder cancels a pending order
// @Summary Cancel order
// @Description Cancel a pending order (staff only)
// @Tags orders
// @Accept json
// @Produce json
// @Param id path string true "Order ID" format(uuid)
// @Param request body CancelOrderRequest false "Cancellation reason"
// @Success 200 {object} response.Response{data=OrderResponse} "Cancelled order"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Order not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /orders/{id}/cancel [post]
func (h *Handler) CancelOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid order ID", nil)
		return
	}

	var req CancelOrderRequest
	_ = c.ShouldBindJSON(&req) // Optional body

	staffID := getStaffID(c)

	order, err := h.service.CancelOrder(c.Request.Context(), orderID, req.Reason, staffID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Order not found")
			return
		}
		response.BadRequest(c, "CANCEL_FAILED", err.Error(), nil)
		return
	}

	response.OK(c, order.ToResponse(h.exchangeRate, h.currencyName))
}

// RefundOrder refunds a paid order
// @Summary Refund order
// @Description Refund a paid order (staff only)
// @Tags orders
// @Accept json
// @Produce json
// @Param id path string true "Order ID" format(uuid)
// @Param request body RefundOrderRequest true "Refund reason"
// @Success 200 {object} response.Response{data=OrderResponse} "Refunded order"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 404 {object} response.ErrorResponse "Order not found"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /orders/{id}/refund [post]
func (h *Handler) RefundOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid order ID", nil)
		return
	}

	var req RefundOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	staffID := getStaffID(c)

	order, err := h.service.RefundOrder(c.Request.Context(), orderID, req.Reason, staffID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Order not found")
			return
		}
		response.BadRequest(c, "REFUND_FAILED", err.Error(), nil)
		return
	}

	response.OK(c, order.ToResponse(h.exchangeRate, h.currencyName))
}

// GetStandOrders returns orders for a stand
// @Summary Get stand orders
// @Description Get paginated list of orders for a stand (staff only)
// @Tags orders
// @Produce json
// @Param standId path string true "Stand ID" format(uuid)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Param status query string false "Filter by status" Enums(PENDING, PAID, CANCELLED, REFUNDED)
// @Param start_date query string false "Filter by start date" format(date-time)
// @Param end_date query string false "Filter by end date" format(date-time)
// @Success 200 {object} response.Response{data=[]OrderResponse,meta=response.Meta} "Order list"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /stands/{standId}/orders [get]
func (h *Handler) GetStandOrders(c *gin.Context) {
	standID, err := uuid.Parse(c.Param("standId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	filter := h.buildFilter(c)

	orders, total, err := h.service.GetOrdersByStand(c.Request.Context(), standID, page, perPage, filter)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]OrderResponse, len(orders))
	for i, o := range orders {
		items[i] = o.ToResponse(h.exchangeRate, h.currencyName)
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetStandStats returns order statistics for a stand
// @Summary Get stand order statistics
// @Description Get order statistics for a stand (staff only)
// @Tags orders
// @Produce json
// @Param standId path string true "Stand ID" format(uuid)
// @Param start_date query string false "Start date" format(date-time)
// @Param end_date query string false "End date" format(date-time)
// @Success 200 {object} response.Response{data=OrderStandStats} "Stand statistics"
// @Failure 400 {object} response.ErrorResponse "Invalid stand ID"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /stands/{standId}/orders/stats [get]
func (h *Handler) GetStandStats(c *gin.Context) {
	standID, err := uuid.Parse(c.Param("standId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	var startDate, endDate *time.Time
	if startStr := c.Query("start_date"); startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			startDate = &t
		}
	}
	if endStr := c.Query("end_date"); endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			endDate = &t
		}
	}

	stats, err := h.service.GetStandStats(c.Request.Context(), standID, startDate, endDate)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stats)
}

// GetFestivalOrders returns orders for a festival
// @Summary Get festival orders
// @Description Get paginated list of orders for a festival (admin only)
// @Tags orders
// @Produce json
// @Param festivalId path string true "Festival ID" format(uuid)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Param status query string false "Filter by status" Enums(PENDING, PAID, CANCELLED, REFUNDED)
// @Param start_date query string false "Filter by start date" format(date-time)
// @Param end_date query string false "Filter by end date" format(date-time)
// @Success 200 {object} response.Response{data=[]OrderResponse,meta=response.Meta} "Order list"
// @Failure 400 {object} response.ErrorResponse "Invalid request"
// @Failure 401 {object} response.ErrorResponse "Unauthorized"
// @Failure 500 {object} response.ErrorResponse "Internal server error"
// @Security BearerAuth
// @Router /festivals/{festivalId}/orders [get]
func (h *Handler) GetFestivalOrders(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	filter := h.buildFilter(c)

	orders, total, err := h.service.GetOrdersByFestival(c.Request.Context(), festivalID, page, perPage, filter)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	items := make([]OrderResponse, len(orders))
	for i, o := range orders {
		items[i] = o.ToResponse(h.exchangeRate, h.currencyName)
	}

	response.OKWithMeta(c, items, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// Helper functions

func (h *Handler) buildFilter(c *gin.Context) *OrderFilter {
	filter := &OrderFilter{}
	hasFilter := false

	if statusStr := c.Query("status"); statusStr != "" {
		status := OrderStatus(statusStr)
		filter.Status = &status
		hasFilter = true
	}

	if startStr := c.Query("start_date"); startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			filter.StartDate = &t
			hasFilter = true
		}
	}

	if endStr := c.Query("end_date"); endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			filter.EndDate = &t
			hasFilter = true
		}
	}

	if userIDStr := c.Query("user_id"); userIDStr != "" {
		if userID, err := uuid.Parse(userIDStr); err == nil {
			filter.UserID = &userID
			hasFilter = true
		}
	}

	if !hasFilter {
		return nil
	}

	return filter
}

func getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		return uuid.Nil, errors.ErrUnauthorized
	}
	return uuid.Parse(userIDStr)
}

func getFestivalID(c *gin.Context) (uuid.UUID, error) {
	festivalIDStr := c.GetString("festival_id")
	if festivalIDStr == "" {
		// Try to get from query or path
		festivalIDStr = c.Query("festival_id")
		if festivalIDStr == "" {
			festivalIDStr = c.Param("festivalId")
		}
	}
	if festivalIDStr == "" {
		return uuid.Nil, errors.ErrBadRequest
	}
	return uuid.Parse(festivalIDStr)
}

func getWalletID(c *gin.Context) (uuid.UUID, error) {
	walletIDStr := c.GetString("wallet_id")
	if walletIDStr == "" {
		walletIDStr = c.Query("wallet_id")
	}
	if walletIDStr == "" {
		return uuid.Nil, errors.ErrBadRequest
	}
	return uuid.Parse(walletIDStr)
}

func getStaffID(c *gin.Context) *uuid.UUID {
	staffIDStr := c.GetString("staff_id")
	if staffIDStr == "" {
		// Fall back to user_id for staff
		staffIDStr = c.GetString("user_id")
	}
	if staffIDStr == "" {
		return nil
	}
	id, err := uuid.Parse(staffIDStr)
	if err != nil {
		return nil
	}
	return &id
}

func getStaffIDRequired(c *gin.Context) (uuid.UUID, error) {
	staffID := getStaffID(c)
	if staffID == nil {
		return uuid.Nil, errors.ErrUnauthorized
	}
	return *staffID, nil
}
