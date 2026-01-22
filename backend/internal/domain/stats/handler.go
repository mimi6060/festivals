package stats

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// Handler handles HTTP requests for stats endpoints
type Handler struct {
	service *Service
}

// NewHandler creates a new stats handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers stats routes on the router
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Festival stats routes
	festivals := r.Group("/festivals")
	{
		festivals.GET("/:id/stats", h.GetFestivalStats)
		festivals.GET("/:id/stats/dashboard", h.GetDashboardStats)
		festivals.GET("/:id/stats/revenue", h.GetRevenueChart)
		festivals.GET("/:id/stats/products", h.GetTopProducts)
		festivals.GET("/:id/stats/staff", h.GetStaffPerformance)
		festivals.GET("/:id/stats/transactions", h.GetRecentTransactions)
		festivals.GET("/:id/stats/daily", h.GetDailyStats)
		festivals.GET("/:id/stats/stands", h.GetTopStands)
	}

	// Stand stats routes
	stands := r.Group("/stands")
	{
		stands.GET("/:id/stats", h.GetStandStats)
	}
}

// GetFestivalStats returns overall statistics for a festival
// @Summary Get festival statistics
// @Description Get aggregated statistics for a festival
// @Tags stats
// @Produce json
// @Param id path string true "Festival ID"
// @Param timeframe query string false "Timeframe (TODAY, WEEK, MONTH, ALL)" default(TODAY)
// @Success 200 {object} FestivalStatsResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/stats [get]
func (h *Handler) GetFestivalStats(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	timeframe := ParseTimeframe(c.DefaultQuery("timeframe", "TODAY"))

	stats, err := h.service.GetFestivalStats(c.Request.Context(), festivalID, timeframe)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stats)
}

// GetDashboardStats returns comprehensive dashboard statistics
// @Summary Get dashboard statistics
// @Description Get comprehensive dashboard statistics including charts and top items
// @Tags stats
// @Produce json
// @Param id path string true "Festival ID"
// @Param timeframe query string false "Timeframe (TODAY, WEEK, MONTH, ALL)" default(TODAY)
// @Success 200 {object} DashboardStats
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/stats/dashboard [get]
func (h *Handler) GetDashboardStats(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	timeframe := ParseTimeframe(c.DefaultQuery("timeframe", "TODAY"))

	dashboard, err := h.service.GetDashboardStats(c.Request.Context(), festivalID, timeframe)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, dashboard)
}

// GetRevenueChart returns revenue chart data
// @Summary Get revenue chart data
// @Description Get revenue data formatted for charting
// @Tags stats
// @Produce json
// @Param id path string true "Festival ID"
// @Param start_date query string false "Start date (YYYY-MM-DD)" default(7 days ago)
// @Param end_date query string false "End date (YYYY-MM-DD)" default(today)
// @Success 200 {object} RevenueChartData
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/stats/revenue [get]
func (h *Handler) GetRevenueChart(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	// Parse date range
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -7)

	if startStr := c.Query("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			startDate = parsed
		} else {
			response.BadRequest(c, "INVALID_DATE", "Invalid start_date format, use YYYY-MM-DD", nil)
			return
		}
	}

	if endStr := c.Query("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			endDate = parsed
		} else {
			response.BadRequest(c, "INVALID_DATE", "Invalid end_date format, use YYYY-MM-DD", nil)
			return
		}
	}

	// Validate date range
	if startDate.After(endDate) {
		response.BadRequest(c, "INVALID_DATE_RANGE", "start_date must be before end_date", nil)
		return
	}

	// Limit to 90 days max
	if endDate.Sub(startDate) > 90*24*time.Hour {
		response.BadRequest(c, "DATE_RANGE_TOO_LARGE", "Date range cannot exceed 90 days", nil)
		return
	}

	chartData, err := h.service.GetRevenueChart(c.Request.Context(), festivalID, startDate, endDate)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, chartData)
}

// GetTopProducts returns top selling products
// @Summary Get top selling products
// @Description Get top selling products for a festival
// @Tags stats
// @Produce json
// @Param id path string true "Festival ID"
// @Param limit query int false "Number of products to return" default(10)
// @Param timeframe query string false "Timeframe (TODAY, WEEK, MONTH, ALL)" default(TODAY)
// @Success 200 {array} ProductStatsResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/stats/products [get]
func (h *Handler) GetTopProducts(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	timeframe := ParseTimeframe(c.DefaultQuery("timeframe", "TODAY"))

	products, err := h.service.GetTopSellingProducts(c.Request.Context(), festivalID, limit, timeframe)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, products)
}

// GetStaffPerformance returns staff performance statistics
// @Summary Get staff performance
// @Description Get performance statistics for all staff members
// @Tags stats
// @Produce json
// @Param id path string true "Festival ID"
// @Param timeframe query string false "Timeframe (TODAY, WEEK, MONTH, ALL)" default(TODAY)
// @Success 200 {array} StaffPerformanceResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/stats/staff [get]
func (h *Handler) GetStaffPerformance(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	timeframe := ParseTimeframe(c.DefaultQuery("timeframe", "TODAY"))

	performance, err := h.service.GetStaffPerformance(c.Request.Context(), festivalID, timeframe)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, performance)
}

// GetRecentTransactions returns recent transactions
// @Summary Get recent transactions
// @Description Get recent transactions for a festival
// @Tags stats
// @Produce json
// @Param id path string true "Festival ID"
// @Param limit query int false "Number of transactions to return" default(20)
// @Success 200 {array} RecentTransactionResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/stats/transactions [get]
func (h *Handler) GetRecentTransactions(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	transactions, err := h.service.GetRecentTransactions(c.Request.Context(), festivalID, limit)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, transactions)
}

// GetDailyStats returns daily statistics for a date range
// @Summary Get daily statistics
// @Description Get daily statistics for a festival within a date range
// @Tags stats
// @Produce json
// @Param id path string true "Festival ID"
// @Param start_date query string false "Start date (YYYY-MM-DD)" default(7 days ago)
// @Param end_date query string false "End date (YYYY-MM-DD)" default(today)
// @Success 200 {array} DailyStatsResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/stats/daily [get]
func (h *Handler) GetDailyStats(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	// Parse date range
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -7)

	if startStr := c.Query("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			startDate = parsed
		} else {
			response.BadRequest(c, "INVALID_DATE", "Invalid start_date format, use YYYY-MM-DD", nil)
			return
		}
	}

	if endStr := c.Query("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			endDate = parsed
		} else {
			response.BadRequest(c, "INVALID_DATE", "Invalid end_date format, use YYYY-MM-DD", nil)
			return
		}
	}

	// Validate date range
	if startDate.After(endDate) {
		response.BadRequest(c, "INVALID_DATE_RANGE", "start_date must be before end_date", nil)
		return
	}

	// Limit to 90 days max
	if endDate.Sub(startDate) > 90*24*time.Hour {
		response.BadRequest(c, "DATE_RANGE_TOO_LARGE", "Date range cannot exceed 90 days", nil)
		return
	}

	stats, err := h.service.GetDailyStats(c.Request.Context(), festivalID, startDate, endDate)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stats)
}

// GetTopStands returns top performing stands
// @Summary Get top stands
// @Description Get top performing stands for a festival
// @Tags stats
// @Produce json
// @Param id path string true "Festival ID"
// @Param limit query int false "Number of stands to return" default(10)
// @Param timeframe query string false "Timeframe (TODAY, WEEK, MONTH, ALL)" default(TODAY)
// @Success 200 {array} StandStatsResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/stats/stands [get]
func (h *Handler) GetTopStands(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	timeframe := ParseTimeframe(c.DefaultQuery("timeframe", "TODAY"))

	stands, err := h.service.GetTopStands(c.Request.Context(), festivalID, limit, timeframe)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stands)
}

// GetStandStats returns statistics for a specific stand
// @Summary Get stand statistics
// @Description Get statistics for a specific stand
// @Tags stats
// @Produce json
// @Param id path string true "Stand ID"
// @Param timeframe query string false "Timeframe (TODAY, WEEK, MONTH, ALL)" default(TODAY)
// @Success 200 {object} StandStatsResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /stands/{id}/stats [get]
func (h *Handler) GetStandStats(c *gin.Context) {
	standID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid stand ID", nil)
		return
	}

	timeframe := ParseTimeframe(c.DefaultQuery("timeframe", "TODAY"))

	stats, err := h.service.GetStandStats(c.Request.Context(), standID, timeframe)
	if err != nil {
		if err == errors.ErrNotFound {
			response.NotFound(c, "Stand not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, stats)
}
