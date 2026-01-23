package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/queue"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// AnalyticsWorker handles analytics processing tasks
type AnalyticsWorker struct {
	db  *gorm.DB
	rdb *redis.Client
}

// NewAnalyticsWorker creates a new analytics worker
func NewAnalyticsWorker(db *gorm.DB, rdb *redis.Client) *AnalyticsWorker {
	return &AnalyticsWorker{
		db:  db,
		rdb: rdb,
	}
}

// RegisterHandlers registers all analytics task handlers
func (w *AnalyticsWorker) RegisterHandlers(server *queue.Server) {
	server.HandleFunc(queue.TypeProcessAnalytics, w.HandleProcessAnalytics)
	server.HandleFunc(queue.TypeAggregateAnalytics, w.HandleAggregateAnalytics)
	server.HandleFunc(queue.TypeProcessAnalyticsEvent, w.HandleProcessAnalyticsEvent)
	server.HandleFunc(queue.TypeGenerateAnalyticsReport, w.HandleGenerateAnalyticsReport)
}

// HandleProcessAnalytics handles periodic analytics processing
func (w *AnalyticsWorker) HandleProcessAnalytics(ctx context.Context, task *asynq.Task) error {
	var payload ProcessAnalyticsPayload

	// Allow empty payload for scheduled tasks
	if len(task.Payload()) > 0 {
		if err := json.Unmarshal(task.Payload(), &payload); err != nil {
			return fmt.Errorf("failed to unmarshal payload: %w", err)
		}
	} else {
		// Default values for scheduled runs
		payload = ProcessAnalyticsPayload{
			TimeWindow:  "15m",
			MetricTypes: []string{"revenue", "transactions", "attendance", "active_users"},
		}
	}

	taskID, _ := asynq.GetTaskID(ctx)
	retryCount, _ := asynq.GetRetryCount(ctx)

	log.Info().
		Str("taskId", taskID).
		Str("timeWindow", payload.TimeWindow).
		Strs("metricTypes", payload.MetricTypes).
		Int("retry", retryCount).
		Msg("Processing analytics task")

	startTime := time.Now()

	// Calculate time window
	windowDuration := parseTimeWindow(payload.TimeWindow)
	windowStart := time.Now().Add(-windowDuration)
	windowEnd := time.Now()

	// Process analytics for each metric type
	for _, metricType := range payload.MetricTypes {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		switch metricType {
		case "revenue":
			if err := w.processRevenueMetrics(ctx, payload.FestivalID, windowStart, windowEnd); err != nil {
				log.Warn().Err(err).Str("metricType", metricType).Msg("Error processing revenue metrics")
			}
		case "transactions":
			if err := w.processTransactionMetrics(ctx, payload.FestivalID, windowStart, windowEnd); err != nil {
				log.Warn().Err(err).Str("metricType", metricType).Msg("Error processing transaction metrics")
			}
		case "attendance":
			if err := w.processAttendanceMetrics(ctx, payload.FestivalID, windowStart, windowEnd); err != nil {
				log.Warn().Err(err).Str("metricType", metricType).Msg("Error processing attendance metrics")
			}
		case "active_users":
			if err := w.processActiveUserMetrics(ctx, payload.FestivalID, windowStart, windowEnd); err != nil {
				log.Warn().Err(err).Str("metricType", metricType).Msg("Error processing active user metrics")
			}
		}
	}

	log.Info().
		Str("taskId", taskID).
		Strs("metricTypes", payload.MetricTypes).
		Dur("duration", time.Since(startTime)).
		Msg("Analytics processing completed")

	return nil
}

// HandleAggregateAnalytics handles analytics aggregation for reporting
func (w *AnalyticsWorker) HandleAggregateAnalytics(ctx context.Context, task *asynq.Task) error {
	var payload AggregateAnalyticsPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	taskID, _ := asynq.GetTaskID(ctx)

	log.Info().
		Str("taskId", taskID).
		Str("festivalId", payload.FestivalID.String()).
		Time("startDate", payload.StartDate).
		Time("endDate", payload.EndDate).
		Str("granularity", payload.Granularity).
		Msg("Processing analytics aggregation task")

	startTime := time.Now()

	// Determine time buckets based on granularity
	buckets := generateTimeBuckets(payload.StartDate, payload.EndDate, payload.Granularity)

	// Process each time bucket
	for _, bucket := range buckets {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		// Aggregate metrics for this bucket
		if err := w.aggregateBucketMetrics(ctx, payload.FestivalID, bucket.Start, bucket.End, payload.MetricTypes, payload.ReplaceExisting); err != nil {
			log.Warn().
				Err(err).
				Time("bucketStart", bucket.Start).
				Time("bucketEnd", bucket.End).
				Msg("Error aggregating bucket metrics")
		}
	}

	log.Info().
		Str("taskId", taskID).
		Int("bucketsProcessed", len(buckets)).
		Dur("duration", time.Since(startTime)).
		Msg("Analytics aggregation completed")

	return nil
}

// HandleProcessAnalyticsEvent handles processing a single analytics event
func (w *AnalyticsWorker) HandleProcessAnalyticsEvent(ctx context.Context, task *asynq.Task) error {
	var payload AnalyticsEventPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	taskID, _ := asynq.GetTaskID(ctx)
	retryCount, _ := asynq.GetRetryCount(ctx)

	log.Debug().
		Str("taskId", taskID).
		Str("eventId", payload.EventID.String()).
		Str("eventType", payload.EventType).
		Int("retry", retryCount).
		Msg("Processing analytics event")

	startTime := time.Now()

	// Store the event in the database
	if w.db != nil {
		eventRecord := AnalyticsEvent{
			ID:         payload.EventID,
			EventType:  payload.EventType,
			FestivalID: payload.FestivalID,
			UserID:     payload.UserID,
			SessionID:  payload.SessionID,
			Timestamp:  payload.Timestamp,
			Properties: payload.Properties,
			Context:    payload.Context,
			CreatedAt:  time.Now(),
		}

		if err := w.db.WithContext(ctx).Table("analytics_events").Create(&eventRecord).Error; err != nil {
			log.Error().
				Err(err).
				Str("eventId", payload.EventID.String()).
				Msg("Failed to store analytics event")
			return fmt.Errorf("failed to store event: %w", err)
		}
	}

	// Update real-time counters in Redis
	if w.rdb != nil {
		w.updateRealTimeCounters(ctx, payload)
	}

	log.Debug().
		Str("taskId", taskID).
		Str("eventId", payload.EventID.String()).
		Dur("duration", time.Since(startTime)).
		Msg("Analytics event processed")

	return nil
}

// HandleGenerateAnalyticsReport handles generating analytics reports
func (w *AnalyticsWorker) HandleGenerateAnalyticsReport(ctx context.Context, task *asynq.Task) error {
	var payload GenerateAnalyticsReportPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	taskID, _ := asynq.GetTaskID(ctx)

	log.Info().
		Str("taskId", taskID).
		Str("reportId", payload.ReportID.String()).
		Str("festivalId", payload.FestivalID.String()).
		Str("reportType", payload.ReportType).
		Time("startDate", payload.StartDate).
		Time("endDate", payload.EndDate).
		Msg("Processing analytics report task")

	startTime := time.Now()

	// Generate the report based on type
	var reportData interface{}
	var err error

	switch payload.ReportType {
	case "summary":
		reportData, err = w.generateSummaryReport(ctx, payload)
	case "detailed":
		reportData, err = w.generateDetailedReport(ctx, payload)
	case "trends":
		reportData, err = w.generateTrendsReport(ctx, payload)
	case "comparison":
		reportData, err = w.generateComparisonReport(ctx, payload)
	default:
		reportData, err = w.generateSummaryReport(ctx, payload)
	}

	if err != nil {
		log.Error().
			Err(err).
			Str("taskId", taskID).
			Str("reportId", payload.ReportID.String()).
			Msg("Failed to generate analytics report")

		// Update report status to failed
		w.updateReportStatus(ctx, payload.ReportID, "failed", err.Error())

		return fmt.Errorf("failed to generate report: %w", err)
	}

	// Store the report
	if err := w.storeReport(ctx, payload.ReportID, payload.Format, reportData); err != nil {
		log.Error().
			Err(err).
			Str("reportId", payload.ReportID.String()).
			Msg("Failed to store analytics report")
		return fmt.Errorf("failed to store report: %w", err)
	}

	// Update report status
	w.updateReportStatus(ctx, payload.ReportID, "completed", "")

	// Send notification if email is provided
	if payload.NotifyEmail != "" {
		log.Info().
			Str("reportId", payload.ReportID.String()).
			Str("email", payload.NotifyEmail).
			Msg("Sending analytics report notification")
		// In a real implementation, this would enqueue an email task
	}

	log.Info().
		Str("taskId", taskID).
		Str("reportId", payload.ReportID.String()).
		Str("reportType", payload.ReportType).
		Dur("duration", time.Since(startTime)).
		Msg("Analytics report generated successfully")

	return nil
}

// Helper methods

func parseTimeWindow(window string) time.Duration {
	switch window {
	case "5m":
		return 5 * time.Minute
	case "15m":
		return 15 * time.Minute
	case "1h":
		return time.Hour
	case "6h":
		return 6 * time.Hour
	case "1d":
		return 24 * time.Hour
	default:
		return 15 * time.Minute
	}
}

type TimeBucket struct {
	Start time.Time
	End   time.Time
}

func generateTimeBuckets(start, end time.Time, granularity string) []TimeBucket {
	var buckets []TimeBucket
	var step time.Duration

	switch granularity {
	case "minute":
		step = time.Minute
	case "hour":
		step = time.Hour
	case "day":
		step = 24 * time.Hour
	default:
		step = time.Hour
	}

	current := start
	for current.Before(end) {
		bucketEnd := current.Add(step)
		if bucketEnd.After(end) {
			bucketEnd = end
		}
		buckets = append(buckets, TimeBucket{Start: current, End: bucketEnd})
		current = bucketEnd
	}

	return buckets
}

func (w *AnalyticsWorker) processRevenueMetrics(ctx context.Context, festivalID *uuid.UUID, windowStart, windowEnd time.Time) error {
	if w.db == nil {
		return nil
	}

	query := w.db.WithContext(ctx)
	if festivalID != nil {
		query = query.Where("festival_id = ?", festivalID)
	}

	// Calculate total revenue in the time window
	var result struct {
		TotalRevenue int64
		TxCount      int64
		AvgTxValue   float64
	}

	err := query.Table("transactions").
		Select("COALESCE(SUM(amount), 0) as total_revenue, COUNT(*) as tx_count, COALESCE(AVG(amount), 0) as avg_tx_value").
		Where("created_at BETWEEN ? AND ?", windowStart, windowEnd).
		Where("status = ?", "completed").
		Scan(&result).Error

	if err != nil {
		return err
	}

	// Store in Redis for real-time dashboard
	if w.rdb != nil {
		key := fmt.Sprintf("analytics:revenue:%s", windowEnd.Format("2006-01-02T15:04"))
		w.rdb.HSet(ctx, key, map[string]interface{}{
			"total_revenue": result.TotalRevenue,
			"tx_count":      result.TxCount,
			"avg_tx_value":  result.AvgTxValue,
		})
		w.rdb.Expire(ctx, key, 24*time.Hour)
	}

	log.Debug().
		Int64("totalRevenue", result.TotalRevenue).
		Int64("txCount", result.TxCount).
		Float64("avgTxValue", result.AvgTxValue).
		Msg("Revenue metrics processed")

	return nil
}

func (w *AnalyticsWorker) processTransactionMetrics(ctx context.Context, festivalID *uuid.UUID, windowStart, windowEnd time.Time) error {
	if w.db == nil {
		return nil
	}

	query := w.db.WithContext(ctx)
	if festivalID != nil {
		query = query.Where("festival_id = ?", festivalID)
	}

	// Count transactions by type
	var results []struct {
		Type  string
		Count int64
	}

	err := query.Table("transactions").
		Select("type, COUNT(*) as count").
		Where("created_at BETWEEN ? AND ?", windowStart, windowEnd).
		Group("type").
		Scan(&results).Error

	if err != nil {
		return err
	}

	// Store in Redis
	if w.rdb != nil {
		key := fmt.Sprintf("analytics:transactions:%s", windowEnd.Format("2006-01-02T15:04"))
		for _, r := range results {
			w.rdb.HSet(ctx, key, r.Type, r.Count)
		}
		w.rdb.Expire(ctx, key, 24*time.Hour)
	}

	return nil
}

func (w *AnalyticsWorker) processAttendanceMetrics(ctx context.Context, festivalID *uuid.UUID, windowStart, windowEnd time.Time) error {
	if w.db == nil {
		return nil
	}

	query := w.db.WithContext(ctx)
	if festivalID != nil {
		query = query.Where("festival_id = ?", festivalID)
	}

	// Count check-ins and check-outs
	var result struct {
		CheckIns   int64
		CheckOuts  int64
		NetInside  int64
	}

	err := query.Table("attendance_logs").
		Select(`
			SUM(CASE WHEN type = 'check_in' THEN 1 ELSE 0 END) as check_ins,
			SUM(CASE WHEN type = 'check_out' THEN 1 ELSE 0 END) as check_outs
		`).
		Where("created_at BETWEEN ? AND ?", windowStart, windowEnd).
		Scan(&result).Error

	if err != nil {
		return err
	}

	result.NetInside = result.CheckIns - result.CheckOuts

	// Store in Redis
	if w.rdb != nil {
		key := fmt.Sprintf("analytics:attendance:%s", windowEnd.Format("2006-01-02T15:04"))
		w.rdb.HSet(ctx, key, map[string]interface{}{
			"check_ins":  result.CheckIns,
			"check_outs": result.CheckOuts,
			"net_inside": result.NetInside,
		})
		w.rdb.Expire(ctx, key, 24*time.Hour)
	}

	return nil
}

func (w *AnalyticsWorker) processActiveUserMetrics(ctx context.Context, festivalID *uuid.UUID, windowStart, windowEnd time.Time) error {
	if w.rdb == nil {
		return nil
	}

	// Get count of unique active sessions
	pattern := "session:*"
	if festivalID != nil {
		pattern = fmt.Sprintf("session:%s:*", festivalID.String())
	}

	var activeCount int64
	var cursor uint64

	for {
		keys, nextCursor, err := w.rdb.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return err
		}
		activeCount += int64(len(keys))
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	// Store the count
	key := fmt.Sprintf("analytics:active_users:%s", windowEnd.Format("2006-01-02T15:04"))
	w.rdb.Set(ctx, key, activeCount, 24*time.Hour)

	return nil
}

func (w *AnalyticsWorker) aggregateBucketMetrics(ctx context.Context, festivalID uuid.UUID, start, end time.Time, metricTypes []string, replace bool) error {
	if w.db == nil {
		return nil
	}

	// Check if aggregation exists
	var existingCount int64
	w.db.WithContext(ctx).Table("analytics_aggregates").
		Where("festival_id = ? AND bucket_start = ? AND bucket_end = ?", festivalID, start, end).
		Count(&existingCount)

	if existingCount > 0 && !replace {
		return nil // Skip if exists and not replacing
	}

	// Calculate aggregate metrics
	aggregateData := make(map[string]interface{})

	for _, metric := range metricTypes {
		switch metric {
		case "revenue":
			var total int64
			w.db.WithContext(ctx).Table("transactions").
				Where("festival_id = ? AND created_at BETWEEN ? AND ? AND status = ?", festivalID, start, end, "completed").
				Select("COALESCE(SUM(amount), 0)").
				Scan(&total)
			aggregateData["revenue"] = total

		case "transactions":
			var count int64
			w.db.WithContext(ctx).Table("transactions").
				Where("festival_id = ? AND created_at BETWEEN ? AND ?", festivalID, start, end).
				Count(&count)
			aggregateData["transactions"] = count

		case "attendance":
			var checkIns int64
			w.db.WithContext(ctx).Table("attendance_logs").
				Where("festival_id = ? AND created_at BETWEEN ? AND ? AND type = ?", festivalID, start, end, "check_in").
				Count(&checkIns)
			aggregateData["attendance"] = checkIns
		}
	}

	// Store or update the aggregate
	if replace && existingCount > 0 {
		w.db.WithContext(ctx).Table("analytics_aggregates").
			Where("festival_id = ? AND bucket_start = ?", festivalID, start).
			Updates(map[string]interface{}{
				"data":       aggregateData,
				"updated_at": time.Now(),
			})
	} else {
		w.db.WithContext(ctx).Table("analytics_aggregates").Create(map[string]interface{}{
			"id":           uuid.New(),
			"festival_id":  festivalID,
			"bucket_start": start,
			"bucket_end":   end,
			"data":         aggregateData,
			"created_at":   time.Now(),
		})
	}

	return nil
}

func (w *AnalyticsWorker) updateRealTimeCounters(ctx context.Context, event AnalyticsEventPayload) {
	// Update event type counter
	counterKey := fmt.Sprintf("analytics:realtime:%s:%s", event.FestivalID.String(), event.EventType)
	w.rdb.Incr(ctx, counterKey)
	w.rdb.Expire(ctx, counterKey, time.Hour)

	// Update festival activity timestamp
	activityKey := fmt.Sprintf("analytics:activity:%s", event.FestivalID.String())
	w.rdb.Set(ctx, activityKey, time.Now().Unix(), 24*time.Hour)

	// If user ID is provided, update user activity
	if event.UserID != nil {
		userKey := fmt.Sprintf("analytics:user_activity:%s", event.UserID.String())
		w.rdb.Set(ctx, userKey, time.Now().Unix(), time.Hour)
	}
}

func (w *AnalyticsWorker) generateSummaryReport(ctx context.Context, payload GenerateAnalyticsReportPayload) (interface{}, error) {
	if w.db == nil {
		return nil, fmt.Errorf("database not available")
	}

	report := map[string]interface{}{
		"festivalId": payload.FestivalID,
		"startDate":  payload.StartDate,
		"endDate":    payload.EndDate,
		"generatedAt": time.Now(),
	}

	// Revenue summary
	var revenueSummary struct {
		Total   int64
		Count   int64
		Average float64
	}
	w.db.WithContext(ctx).Table("transactions").
		Select("COALESCE(SUM(amount), 0) as total, COUNT(*) as count, COALESCE(AVG(amount), 0) as average").
		Where("festival_id = ? AND created_at BETWEEN ? AND ? AND status = ?",
			payload.FestivalID, payload.StartDate, payload.EndDate, "completed").
		Scan(&revenueSummary)

	report["revenue"] = revenueSummary

	// Attendance summary
	var attendanceSummary struct {
		CheckIns    int64
		UniqueUsers int64
	}
	w.db.WithContext(ctx).Table("attendance_logs").
		Select("COUNT(*) as check_ins, COUNT(DISTINCT user_id) as unique_users").
		Where("festival_id = ? AND created_at BETWEEN ? AND ? AND type = ?",
			payload.FestivalID, payload.StartDate, payload.EndDate, "check_in").
		Scan(&attendanceSummary)

	report["attendance"] = attendanceSummary

	return report, nil
}

func (w *AnalyticsWorker) generateDetailedReport(ctx context.Context, payload GenerateAnalyticsReportPayload) (interface{}, error) {
	// Similar to summary but with more granular data
	report, err := w.generateSummaryReport(ctx, payload)
	if err != nil {
		return nil, err
	}

	reportMap := report.(map[string]interface{})

	// Add hourly breakdown
	var hourlyData []struct {
		Hour    int
		Revenue int64
		TxCount int64
	}

	w.db.WithContext(ctx).Table("transactions").
		Select("EXTRACT(HOUR FROM created_at) as hour, SUM(amount) as revenue, COUNT(*) as tx_count").
		Where("festival_id = ? AND created_at BETWEEN ? AND ? AND status = ?",
			payload.FestivalID, payload.StartDate, payload.EndDate, "completed").
		Group("EXTRACT(HOUR FROM created_at)").
		Order("hour").
		Scan(&hourlyData)

	reportMap["hourlyBreakdown"] = hourlyData

	return reportMap, nil
}

func (w *AnalyticsWorker) generateTrendsReport(ctx context.Context, payload GenerateAnalyticsReportPayload) (interface{}, error) {
	// Generate trend analysis over the period
	report := map[string]interface{}{
		"festivalId": payload.FestivalID,
		"startDate":  payload.StartDate,
		"endDate":    payload.EndDate,
		"generatedAt": time.Now(),
	}

	// Daily trends
	var dailyTrends []struct {
		Date    string
		Revenue int64
		TxCount int64
	}

	w.db.WithContext(ctx).Table("transactions").
		Select("DATE(created_at) as date, SUM(amount) as revenue, COUNT(*) as tx_count").
		Where("festival_id = ? AND created_at BETWEEN ? AND ? AND status = ?",
			payload.FestivalID, payload.StartDate, payload.EndDate, "completed").
		Group("DATE(created_at)").
		Order("date").
		Scan(&dailyTrends)

	report["dailyTrends"] = dailyTrends

	return report, nil
}

func (w *AnalyticsWorker) generateComparisonReport(ctx context.Context, payload GenerateAnalyticsReportPayload) (interface{}, error) {
	// Compare current period with previous period
	duration := payload.EndDate.Sub(payload.StartDate)
	previousStart := payload.StartDate.Add(-duration)
	previousEnd := payload.StartDate

	currentReport, err := w.generateSummaryReport(ctx, payload)
	if err != nil {
		return nil, err
	}

	previousPayload := payload
	previousPayload.StartDate = previousStart
	previousPayload.EndDate = previousEnd

	previousReport, err := w.generateSummaryReport(ctx, previousPayload)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"current":  currentReport,
		"previous": previousReport,
		"comparison": map[string]interface{}{
			"currentPeriod":  fmt.Sprintf("%s to %s", payload.StartDate.Format("2006-01-02"), payload.EndDate.Format("2006-01-02")),
			"previousPeriod": fmt.Sprintf("%s to %s", previousStart.Format("2006-01-02"), previousEnd.Format("2006-01-02")),
		},
	}, nil
}

func (w *AnalyticsWorker) storeReport(ctx context.Context, reportID uuid.UUID, format string, data interface{}) error {
	if w.db == nil {
		return nil
	}

	// Serialize report data
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	// Update report record
	return w.db.WithContext(ctx).Table("analytics_reports").
		Where("id = ?", reportID).
		Updates(map[string]interface{}{
			"data":         jsonData,
			"status":       "completed",
			"completed_at": time.Now(),
		}).Error
}

func (w *AnalyticsWorker) updateReportStatus(ctx context.Context, reportID uuid.UUID, status, errorMsg string) {
	if w.db == nil {
		return
	}

	updates := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}

	if errorMsg != "" {
		updates["error_message"] = errorMsg
	}

	if status == "completed" {
		updates["completed_at"] = time.Now()
	}

	w.db.WithContext(ctx).Table("analytics_reports").
		Where("id = ?", reportID).
		Updates(updates)
}

// AnalyticsEvent represents an analytics event record
type AnalyticsEvent struct {
	ID         uuid.UUID              `json:"id" gorm:"type:uuid;primary_key"`
	EventType  string                 `json:"eventType" gorm:"not null;index"`
	FestivalID uuid.UUID              `json:"festivalId" gorm:"type:uuid;not null;index"`
	UserID     *uuid.UUID             `json:"userId,omitempty" gorm:"type:uuid;index"`
	SessionID  string                 `json:"sessionId,omitempty" gorm:"index"`
	Timestamp  time.Time              `json:"timestamp" gorm:"not null;index"`
	Properties map[string]interface{} `json:"properties,omitempty" gorm:"type:jsonb"`
	Context    map[string]interface{} `json:"context,omitempty" gorm:"type:jsonb"`
	CreatedAt  time.Time              `json:"createdAt" gorm:"autoCreateTime"`
}

// AnalyticsResult represents the result of an analytics operation for dead letter handling
type AnalyticsResult struct {
	TaskID       string    `json:"taskId"`
	TaskType     string    `json:"taskType"`
	FestivalID   string    `json:"festivalId,omitempty"`
	MetricsCount int       `json:"metricsCount"`
	Status       string    `json:"status"`
	Error        string    `json:"error,omitempty"`
	Duration     string    `json:"duration"`
	RetryCount   int       `json:"retryCount"`
	ProcessedAt  time.Time `json:"processedAt"`
}
