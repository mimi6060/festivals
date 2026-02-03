package stats

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/mimi6060/festivals/backend/internal/pkg/response"
)

// AnalyticsHandler handles HTTP requests for analytics endpoints
type AnalyticsHandler struct {
	service *AnalyticsService
}

// NewAnalyticsHandler creates a new analytics handler
func NewAnalyticsHandler(service *AnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{service: service}
}

// RegisterRoutes registers analytics routes on the router
func (h *AnalyticsHandler) RegisterRoutes(r *gin.RouterGroup) {
	analytics := r.Group("/festivals/:id/analytics")
	{
		// Event tracking
		analytics.POST("/events", h.TrackEvent)
		analytics.POST("/events/batch", h.TrackEventsBatch)
		analytics.GET("/events", h.GetEvents)

		// Summary & real-time
		analytics.GET("/summary", h.GetAnalyticsSummary)
		analytics.GET("/realtime", h.GetRealTimeMetrics)

		// Funnel analysis
		analytics.GET("/funnels", h.GetAllFunnels)
		analytics.GET("/funnels/:name", h.GetFunnelAnalysis)
		analytics.POST("/funnels", h.CreateCustomFunnel)

		// Cohort analysis
		analytics.GET("/cohorts", h.GetCohortAnalysis)

		// Heatmaps
		analytics.GET("/heatmaps/:type", h.GetHeatmapData)

		// User journey
		analytics.GET("/users/:userId/journey", h.GetUserJourney)

		// Predictions
		analytics.GET("/predictions", h.GetPredictions)

		// Key metrics
		analytics.GET("/metrics/conversion", h.GetTicketConversionRate)
		analytics.GET("/metrics/avg-spend", h.GetAverageSpendPerVisitor)
		analytics.GET("/metrics/peak-times", h.GetPeakTimes)
		analytics.GET("/metrics/retention", h.GetRetentionRate)

		// Export
		analytics.POST("/export", h.ExportAnalytics)
		analytics.GET("/exports", h.GetExports)
		analytics.GET("/exports/:exportId", h.GetExport)
	}
}

// TrackEvent records a new analytics event
// @Summary Track analytics event
// @Description Record a new analytics event for a festival
// @Tags analytics
// @Accept json
// @Produce json
// @Param id path string true "Festival ID"
// @Param event body CreateAnalyticsEventRequest true "Event data"
// @Success 201 {object} AnalyticsEventResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/events [post]
func (h *AnalyticsHandler) TrackEvent(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req CreateAnalyticsEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_REQUEST", err.Error(), nil)
		return
	}

	// Get user ID from context if authenticated
	var userID *uuid.UUID
	if uid, exists := c.Get("userID"); exists {
		if id, ok := uid.(uuid.UUID); ok {
			userID = &id
		}
	}

	event, err := h.service.TrackEvent(c.Request.Context(), festivalID, userID, &req)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, event)
}

// TrackEventsBatch records multiple analytics events
// @Summary Track multiple analytics events
// @Description Record multiple analytics events in a batch
// @Tags analytics
// @Accept json
// @Produce json
// @Param id path string true "Festival ID"
// @Param events body []CreateAnalyticsEventRequest true "Events data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/events/batch [post]
func (h *AnalyticsHandler) TrackEventsBatch(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req []CreateAnalyticsEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_REQUEST", err.Error(), nil)
		return
	}

	if len(req) == 0 {
		response.BadRequest(c, "EMPTY_BATCH", "No events provided", nil)
		return
	}

	if len(req) > 100 {
		response.BadRequest(c, "BATCH_TOO_LARGE", "Maximum 100 events per batch", nil)
		return
	}

	var userID *uuid.UUID
	if uid, exists := c.Get("userID"); exists {
		if id, ok := uid.(uuid.UUID); ok {
			userID = &id
		}
	}

	if err := h.service.TrackEventsBatch(c.Request.Context(), festivalID, userID, req); err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{"tracked": len(req)})
}

// GetEvents retrieves analytics events
// @Summary Get analytics events
// @Description Retrieve analytics events with optional filters
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Param type query string false "Event type filter"
// @Param start_date query string false "Start date (YYYY-MM-DD)"
// @Param end_date query string false "End date (YYYY-MM-DD)"
// @Param limit query int false "Number of events to return" default(100)
// @Param offset query int false "Offset for pagination" default(0)
// @Success 200 {array} AnalyticsEventResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/events [get]
func (h *AnalyticsHandler) GetEvents(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	filters := EventFilters{
		Limit:  100,
		Offset: 0,
	}

	if typeStr := c.Query("type"); typeStr != "" {
		filters.EventTypes = []EventType{EventType(typeStr)}
	}

	if startStr := c.Query("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			filters.StartDate = &parsed
		}
	}

	if endStr := c.Query("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			parsed = parsed.Add(24*time.Hour - time.Second)
			filters.EndDate = &parsed
		}
	}

	if limit, err := strconv.Atoi(c.Query("limit")); err == nil && limit > 0 {
		filters.Limit = limit
	}

	if offset, err := strconv.Atoi(c.Query("offset")); err == nil && offset >= 0 {
		filters.Offset = offset
	}

	events, err := h.service.GetEvents(c.Request.Context(), festivalID, filters)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, events)
}

// GetAnalyticsSummary retrieves analytics summary
// @Summary Get analytics summary
// @Description Get aggregated analytics summary for a festival
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Param start_date query string false "Start date (YYYY-MM-DD)"
// @Param end_date query string false "End date (YYYY-MM-DD)"
// @Success 200 {object} AnalyticsSummary
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/summary [get]
func (h *AnalyticsHandler) GetAnalyticsSummary(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	end := time.Now()
	start := end.AddDate(0, 0, -30)

	if startStr := c.Query("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			start = parsed
		}
	}

	if endStr := c.Query("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			end = parsed.Add(24*time.Hour - time.Second)
		}
	}

	summary, err := h.service.GetAnalyticsSummary(c.Request.Context(), festivalID, start, end)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, summary)
}

// GetRealTimeMetrics retrieves real-time metrics
// @Summary Get real-time metrics
// @Description Get current real-time analytics metrics
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Success 200 {object} RealTimeMetrics
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/realtime [get]
func (h *AnalyticsHandler) GetRealTimeMetrics(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	metrics, err := h.service.GetRealTimeMetrics(c.Request.Context(), festivalID)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, metrics)
}

// GetAllFunnels retrieves all funnel analyses
// @Summary Get all funnels
// @Description Get analysis for all predefined and custom funnels
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Param start_date query string false "Start date (YYYY-MM-DD)"
// @Param end_date query string false "End date (YYYY-MM-DD)"
// @Success 200 {array} Funnel
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/funnels [get]
func (h *AnalyticsHandler) GetAllFunnels(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	end := time.Now()
	start := end.AddDate(0, 0, -30)

	if startStr := c.Query("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			start = parsed
		}
	}

	if endStr := c.Query("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			end = parsed.Add(24*time.Hour - time.Second)
		}
	}

	funnels, err := h.service.GetAllFunnels(c.Request.Context(), festivalID, start, end)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, funnels)
}

// GetFunnelAnalysis retrieves a specific funnel analysis
// @Summary Get funnel analysis
// @Description Get analysis for a specific funnel
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Param name path string true "Funnel name"
// @Param start_date query string false "Start date (YYYY-MM-DD)"
// @Param end_date query string false "End date (YYYY-MM-DD)"
// @Success 200 {object} Funnel
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/funnels/{name} [get]
func (h *AnalyticsHandler) GetFunnelAnalysis(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	funnelName := c.Param("name")
	if funnelName == "" {
		response.BadRequest(c, "INVALID_NAME", "Funnel name is required", nil)
		return
	}

	end := time.Now()
	start := end.AddDate(0, 0, -30)

	if startStr := c.Query("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			start = parsed
		}
	}

	if endStr := c.Query("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			end = parsed.Add(24*time.Hour - time.Second)
		}
	}

	funnel, err := h.service.GetFunnelAnalysis(c.Request.Context(), festivalID, funnelName, start, end)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, funnel)
}

// CreateCustomFunnel creates a custom funnel definition
// @Summary Create custom funnel
// @Description Create a custom funnel definition with specific steps
// @Tags analytics
// @Accept json
// @Produce json
// @Param id path string true "Festival ID"
// @Param funnel body object true "Funnel definition"
// @Success 201 {object} FunnelDefinition
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/funnels [post]
func (h *AnalyticsHandler) CreateCustomFunnel(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req struct {
		Name        string   `json:"name" binding:"required"`
		Description string   `json:"description"`
		Steps       []string `json:"steps" binding:"required,min=2"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_REQUEST", err.Error(), nil)
		return
	}

	funnel, err := h.service.CreateCustomFunnel(c.Request.Context(), festivalID, req.Name, req.Description, req.Steps)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, funnel)
}

// GetCohortAnalysis retrieves cohort analysis
// @Summary Get cohort analysis
// @Description Get cohort analysis for a festival
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Param type query string false "Cohort type (ticket_purchase, first_activity, revenue, spending)" default(first_activity)
// @Param period query string false "Period (DAILY, WEEKLY, MONTHLY)" default(WEEKLY)
// @Param start_date query string false "Start date (YYYY-MM-DD)"
// @Param end_date query string false "End date (YYYY-MM-DD)"
// @Success 200 {object} CohortAnalysis
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/cohorts [get]
func (h *AnalyticsHandler) GetCohortAnalysis(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	cohortType := c.DefaultQuery("type", "first_activity")
	periodStr := c.DefaultQuery("period", "WEEKLY")
	period := CohortPeriod(periodStr)

	end := time.Now()
	start := end.AddDate(0, -3, 0) // Default to last 3 months

	if startStr := c.Query("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			start = parsed
		}
	}

	if endStr := c.Query("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			end = parsed.Add(24*time.Hour - time.Second)
		}
	}

	analysis, err := h.service.GetCohortAnalysis(c.Request.Context(), festivalID, cohortType, period, start, end)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, analysis)
}

// GetHeatmapData retrieves heatmap data
// @Summary Get heatmap data
// @Description Get heatmap data for visualization
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Param type path string true "Heatmap type (LOCATION, TIME, SPENDING, TRAFFIC, ENGAGEMENT)"
// @Param start_date query string false "Start date (YYYY-MM-DD)"
// @Param end_date query string false "End date (YYYY-MM-DD)"
// @Success 200 {object} Heatmap
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/heatmaps/{type} [get]
func (h *AnalyticsHandler) GetHeatmapData(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	heatmapType := HeatmapType(c.Param("type"))
	validTypes := []HeatmapType{HeatmapTypeLocation, HeatmapTypeTime, HeatmapTypeSpending, HeatmapTypeTraffic, HeatmapTypeEngagement}
	valid := false
	for _, t := range validTypes {
		if t == heatmapType {
			valid = true
			break
		}
	}
	if !valid {
		response.BadRequest(c, "INVALID_TYPE", "Invalid heatmap type. Valid types: LOCATION, TIME, SPENDING, TRAFFIC, ENGAGEMENT", nil)
		return
	}

	end := time.Now()
	start := end.AddDate(0, 0, -7)

	if startStr := c.Query("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			start = parsed
		}
	}

	if endStr := c.Query("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			end = parsed.Add(24*time.Hour - time.Second)
		}
	}

	heatmap, err := h.service.GetHeatmapData(c.Request.Context(), festivalID, heatmapType, start, end)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, heatmap)
}

// GetUserJourney retrieves user journey
// @Summary Get user journey
// @Description Get complete journey for a specific user
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Param userId path string true "User ID"
// @Success 200 {object} UserJourney
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/users/{userId}/journey [get]
func (h *AnalyticsHandler) GetUserJourney(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		response.BadRequest(c, "INVALID_USER_ID", "Invalid user ID", nil)
		return
	}

	journey, err := h.service.GetUserJourney(c.Request.Context(), userID, festivalID)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, journey)
}

// GetPredictions retrieves ML predictions
// @Summary Get predictions
// @Description Get ML-based predictions for the festival
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Success 200 {object} Predictions
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/predictions [get]
func (h *AnalyticsHandler) GetPredictions(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	predictions, err := h.service.GetPredictions(c.Request.Context(), festivalID)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, predictions)
}

// GetTicketConversionRate retrieves ticket conversion rate
// @Summary Get ticket conversion rate
// @Description Get ticket view to purchase conversion rate
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Param start_date query string false "Start date (YYYY-MM-DD)"
// @Param end_date query string false "End date (YYYY-MM-DD)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/metrics/conversion [get]
func (h *AnalyticsHandler) GetTicketConversionRate(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	end := time.Now()
	start := end.AddDate(0, 0, -30)

	if startStr := c.Query("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			start = parsed
		}
	}

	if endStr := c.Query("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			end = parsed.Add(24*time.Hour - time.Second)
		}
	}

	rate, err := h.service.GetTicketConversionRate(c.Request.Context(), festivalID, start, end)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{
		"conversionRate": rate,
		"unit":           "percent",
		"period": gin.H{
			"start": start.Format("2006-01-02"),
			"end":   end.Format("2006-01-02"),
		},
	})
}

// GetAverageSpendPerVisitor retrieves average spend per visitor
// @Summary Get average spend per visitor
// @Description Get average spending per checked-in visitor
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/metrics/avg-spend [get]
func (h *AnalyticsHandler) GetAverageSpendPerVisitor(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	avgSpend, err := h.service.GetAverageSpendPerVisitor(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{
		"averageSpend":        avgSpend,
		"averageSpendDisplay": formatCurrency(int64(avgSpend)),
		"unit":                "cents",
	})
}

// GetPeakTimes retrieves peak activity times
// @Summary Get peak times
// @Description Get busiest hours and days
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Param start_date query string false "Start date (YYYY-MM-DD)"
// @Param end_date query string false "End date (YYYY-MM-DD)"
// @Success 200 {object} Heatmap
// @Failure 400 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/metrics/peak-times [get]
func (h *AnalyticsHandler) GetPeakTimes(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	end := time.Now()
	start := end.AddDate(0, 0, -7)

	if startStr := c.Query("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			start = parsed
		}
	}

	if endStr := c.Query("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			end = parsed.Add(24*time.Hour - time.Second)
		}
	}

	heatmap, err := h.service.GetPeakTimes(c.Request.Context(), festivalID, start, end)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, heatmap)
}

// GetRetentionRate retrieves retention rate
// @Summary Get retention rate
// @Description Get user retention rate between editions
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/metrics/retention [get]
func (h *AnalyticsHandler) GetRetentionRate(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	rate, err := h.service.GetRetentionRate(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{
		"retentionRate": rate,
		"unit":          "percent",
	})
}

// ExportAnalytics exports analytics data
// @Summary Export analytics data
// @Description Export analytics data in specified format
// @Tags analytics
// @Accept json
// @Produce json
// @Param id path string true "Festival ID"
// @Param request body AnalyticsExportRequest true "Export request"
// @Success 201 {object} AnalyticsExport
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/export [post]
func (h *AnalyticsHandler) ExportAnalytics(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	var req AnalyticsExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_REQUEST", err.Error(), nil)
		return
	}

	export, err := h.service.ExportAnalytics(c.Request.Context(), festivalID, &req)
	if err != nil {
		if err == errors.ErrFestivalNotFound {
			response.NotFound(c, "Festival not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Created(c, export)
}

// GetExports retrieves all exports for a festival
// @Summary Get exports
// @Description Get all available exports for a festival
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Success 200 {array} AnalyticsExport
// @Failure 400 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/exports [get]
func (h *AnalyticsHandler) GetExports(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	exports, err := h.service.GetExports(c.Request.Context(), festivalID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, exports)
}

// GetExport retrieves a specific export
// @Summary Get export
// @Description Get a specific export by ID
// @Tags analytics
// @Produce json
// @Param id path string true "Festival ID"
// @Param exportId path string true "Export ID"
// @Success 200 {object} AnalyticsExport
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /festivals/{id}/analytics/exports/{exportId} [get]
func (h *AnalyticsHandler) GetExport(c *gin.Context) {
	_, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "INVALID_ID", "Invalid festival ID", nil)
		return
	}

	exportID, err := uuid.Parse(c.Param("exportId"))
	if err != nil {
		response.BadRequest(c, "INVALID_EXPORT_ID", "Invalid export ID", nil)
		return
	}

	export, err := h.service.GetExport(c.Request.Context(), exportID)
	if err != nil {
		response.NotFound(c, "Export not found")
		return
	}

	response.OK(c, export)
}
