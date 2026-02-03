package inventory

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
	inventory := r.Group("/inventory")
	{
		// Stock items
		inventory.POST("/items", h.CreateItem)
		inventory.GET("/items", h.ListItems)
		inventory.GET("/items/:id", h.GetItem)
		inventory.PATCH("/items/:id", h.UpdateItem)
		inventory.DELETE("/items/:id", h.DeleteItem)

		// Stock operations
		inventory.POST("/adjust", h.AdjustStock)
		inventory.POST("/sale", h.RecordSale)
		inventory.GET("/stock/:productId/:standId", h.GetStock)

		// Movements
		inventory.GET("/movements", h.ListMovements)

		// Alerts
		inventory.GET("/alerts", h.ListAlerts)
		inventory.POST("/alerts/:id/acknowledge", h.AcknowledgeAlert)

		// Counts
		inventory.POST("/counts", h.CreateCount)
		inventory.GET("/counts", h.ListCounts)
		inventory.GET("/counts/:id", h.GetCount)
		inventory.GET("/counts/:id/items", h.GetCountItems)
		inventory.POST("/counts/:id/record", h.RecordCountItem)
		inventory.POST("/counts/:id/reconcile", h.ReconcileCount)
		inventory.POST("/counts/:id/cancel", h.CancelCount)

		// Summary
		inventory.GET("/summary", h.GetSummary)
	}

	// Stand-specific endpoints
	r.GET("/stands/:standId/inventory", h.ListStandInventory)
	r.GET("/stands/:standId/inventory/summary", h.GetStandSummary)
	r.GET("/stands/:standId/inventory/movements", h.ListStandMovements)
	r.GET("/stands/:standId/inventory/alerts", h.ListStandAlerts)
}

// getCurrentUser extracts the current user from the context
func getCurrentUser(c *gin.Context) (uuid.UUID, string) {
	userID, exists := c.Get("userID")
	if !exists {
		return uuid.Nil, "System"
	}
	userName, _ := c.Get("userName")
	name, _ := userName.(string)
	if name == "" {
		name = "Unknown"
	}
	return userID.(uuid.UUID), name
}

// CreateItem creates a new inventory item
func (h *Handler) CreateItem(c *gin.Context) {
	var req CreateInventoryItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	item, err := h.service.CreateItem(c.Request.Context(), req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, item.ToResponse("", "", ""))
}

// GetItem gets an inventory item by ID
func (h *Handler) GetItem(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid item ID", nil)
		return
	}

	item, err := h.service.GetItemByID(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Inventory item not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, item.ToResponse("", "", ""))
}

// ListItems lists inventory items
func (h *Handler) ListItems(c *gin.Context) {
	festivalIDStr := c.Query("festivalId")
	if festivalIDStr == "" {
		response.BadRequest(c, "MISSING_FESTIVAL", "festivalId query parameter required", nil)
		return
	}

	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))

	items, total, err := h.service.ListItemsByFestival(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]InventoryItemResponse, len(items))
	for i, item := range items {
		responses[i] = item.ToResponse("", "", "")
	}

	response.OKWithMeta(c, responses, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// UpdateItem updates an inventory item
func (h *Handler) UpdateItem(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid item ID", nil)
		return
	}

	var req UpdateInventoryItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	item, err := h.service.UpdateItem(c.Request.Context(), id, req)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Inventory item not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, item.ToResponse("", "", ""))
}

// DeleteItem deletes an inventory item
func (h *Handler) DeleteItem(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid item ID", nil)
		return
	}

	// Just verify it exists first
	_, err = h.service.GetItemByID(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Inventory item not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	// Note: actual deletion would need to be implemented in service
	response.NoContent(c)
}

// GetStock gets the current stock level
func (h *Handler) GetStock(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("productId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid product ID", nil)
		return
	}

	standID, err := uuid.Parse(c.Param("standId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	stock, err := h.service.GetStock(c.Request.Context(), productID, standID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{"productId": productID, "standId": standID, "quantity": stock})
}

// AdjustStock adjusts stock level
func (h *Handler) AdjustStock(c *gin.Context) {
	var req AdjustStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	userID, userName := getCurrentUser(c)

	item, err := h.service.AdjustStock(c.Request.Context(), req, userID, userName)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, item.ToResponse("", "", ""))
}

// RecordSale records a sale
func (h *Handler) RecordSale(c *gin.Context) {
	var req RecordSaleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	userID, userName := getCurrentUser(c)

	if err := h.service.RecordSale(c.Request.Context(), req, userID, userName); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{"success": true})
}

// ListMovements lists stock movements
func (h *Handler) ListMovements(c *gin.Context) {
	festivalIDStr := c.Query("festivalId")
	if festivalIDStr == "" {
		response.BadRequest(c, "MISSING_FESTIVAL", "festivalId query parameter required", nil)
		return
	}

	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))

	movements, total, err := h.service.GetMovementsByFestival(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]StockMovementResponse, len(movements))
	for i, m := range movements {
		responses[i] = m.ToResponse("", "")
	}

	response.OKWithMeta(c, responses, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// ListAlerts lists stock alerts
func (h *Handler) ListAlerts(c *gin.Context) {
	festivalIDStr := c.Query("festivalId")
	if festivalIDStr == "" {
		response.BadRequest(c, "MISSING_FESTIVAL", "festivalId query parameter required", nil)
		return
	}

	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))

	var statusFilter *AlertStatus
	if statusStr := c.Query("status"); statusStr != "" {
		status := AlertStatus(statusStr)
		statusFilter = &status
	}

	alerts, total, err := h.service.GetAlertsByFestival(c.Request.Context(), festivalID, statusFilter, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]StockAlertResponse, len(alerts))
	for i, a := range alerts {
		responses[i] = a.ToResponse("", "")
	}

	response.OKWithMeta(c, responses, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// AcknowledgeAlert acknowledges an alert
func (h *Handler) AcknowledgeAlert(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid alert ID", nil)
		return
	}

	userID, _ := getCurrentUser(c)

	alert, err := h.service.AcknowledgeAlert(c.Request.Context(), id, userID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Alert not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, alert.ToResponse("", ""))
}

// CreateCount creates a new inventory count
func (h *Handler) CreateCount(c *gin.Context) {
	var req CreateCountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	userID, _ := getCurrentUser(c)

	count, err := h.service.CreateInventoryCount(c.Request.Context(), req, userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, count.ToResponse("", 0, 0, 0))
}

// ListCounts lists inventory counts
func (h *Handler) ListCounts(c *gin.Context) {
	festivalIDStr := c.Query("festivalId")
	if festivalIDStr == "" {
		response.BadRequest(c, "MISSING_FESTIVAL", "festivalId query parameter required", nil)
		return
	}

	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))

	counts, total, err := h.service.ListCountsByFestival(c.Request.Context(), festivalID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]InventoryCountResponse, len(counts))
	for i, count := range counts {
		responses[i] = count.ToResponse("", 0, 0, 0)
	}

	response.OKWithMeta(c, responses, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetCount gets an inventory count
func (h *Handler) GetCount(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid count ID", nil)
		return
	}

	count, err := h.service.GetInventoryCount(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Count not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, count.ToResponse("", 0, 0, 0))
}

// GetCountItems gets items for a count
func (h *Handler) GetCountItems(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid count ID", nil)
		return
	}

	items, err := h.service.GetCountItems(c.Request.Context(), id)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]InventoryCountItemResponse, len(items))
	for i, item := range items {
		responses[i] = item.ToResponse("", "")
	}

	response.OK(c, responses)
}

// RecordCountItem records a count for an item
func (h *Handler) RecordCountItem(c *gin.Context) {
	var req struct {
		ItemID    uuid.UUID `json:"itemId" binding:"required"`
		CountedQty int      `json:"countedQty" binding:"min=0"`
		Notes     string    `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	userID, _ := getCurrentUser(c)

	item, err := h.service.RecordCountItem(c.Request.Context(), req.ItemID, req.CountedQty, req.Notes, userID)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Count item not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, item.ToResponse("", ""))
}

// ReconcileCount reconciles an inventory count
func (h *Handler) ReconcileCount(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid count ID", nil)
		return
	}

	var req ReconcileCountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "VALIDATION_ERROR", "Invalid request body", err.Error())
		return
	}

	userID, userName := getCurrentUser(c)

	count, err := h.service.ReconcileCount(c.Request.Context(), id, req, userID, userName)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Count not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, count.ToResponse("", 0, 0, 0))
}

// CancelCount cancels an inventory count
func (h *Handler) CancelCount(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid count ID", nil)
		return
	}

	count, err := h.service.CancelCount(c.Request.Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Count not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, count.ToResponse("", 0, 0, 0))
}

// GetSummary gets the inventory summary for a festival
func (h *Handler) GetSummary(c *gin.Context) {
	festivalIDStr := c.Query("festivalId")
	if festivalIDStr == "" {
		response.BadRequest(c, "MISSING_FESTIVAL", "festivalId query parameter required", nil)
		return
	}

	festivalID, err := uuid.Parse(festivalIDStr)
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	summary, err := h.service.GetStockSummary(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, summary)
}

// Stand-specific handlers

// ListStandInventory lists inventory for a stand
func (h *Handler) ListStandInventory(c *gin.Context) {
	standID, err := uuid.Parse(c.Param("standId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))

	items, total, err := h.service.ListItemsByStand(c.Request.Context(), standID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]InventoryItemResponse, len(items))
	for i, item := range items {
		responses[i] = item.ToResponse("", "", "")
	}

	response.OKWithMeta(c, responses, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// GetStandSummary gets inventory summary for a stand
func (h *Handler) GetStandSummary(c *gin.Context) {
	standID, err := uuid.Parse(c.Param("standId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	summary, err := h.service.GetStandStockSummary(c.Request.Context(), standID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, summary)
}

// ListStandMovements lists movements for a stand
func (h *Handler) ListStandMovements(c *gin.Context) {
	standID, err := uuid.Parse(c.Param("standId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))

	movements, total, err := h.service.GetMovementsByStand(c.Request.Context(), standID, page, perPage)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]StockMovementResponse, len(movements))
	for i, m := range movements {
		responses[i] = m.ToResponse("", "")
	}

	response.OKWithMeta(c, responses, &response.Meta{
		Total:   int(total),
		Page:    page,
		PerPage: perPage,
	})
}

// ListStandAlerts lists alerts for a stand
func (h *Handler) ListStandAlerts(c *gin.Context) {
	standID, err := uuid.Parse(c.Param("standId"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	var statusFilter *AlertStatus
	if statusStr := c.Query("status"); statusStr != "" {
		status := AlertStatus(statusStr)
		statusFilter = &status
	}

	alerts, err := h.service.repo.ListAlertsByStand(c.Request.Context(), standID, statusFilter)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	responses := make([]StockAlertResponse, len(alerts))
	for i, a := range alerts {
		responses[i] = a.ToResponse("", "")
	}

	response.OK(c, responses)
}
