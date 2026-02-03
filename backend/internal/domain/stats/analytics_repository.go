package stats

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AnalyticsRepository defines the interface for analytics data access
type AnalyticsRepository interface {
	// Event tracking
	CreateEvent(ctx context.Context, event *AnalyticsEvent) error
	CreateEventsBatch(ctx context.Context, events []*AnalyticsEvent) error
	GetEvents(ctx context.Context, festivalID uuid.UUID, filters EventFilters) ([]AnalyticsEvent, error)
	GetEventsByUser(ctx context.Context, userID, festivalID uuid.UUID) ([]AnalyticsEvent, error)
	GetEventsBySession(ctx context.Context, sessionID string, festivalID uuid.UUID) ([]AnalyticsEvent, error)
	GetEventCount(ctx context.Context, festivalID uuid.UUID, eventType EventType, start, end time.Time) (int64, error)

	// Funnel analysis
	GetFunnelData(ctx context.Context, festivalID uuid.UUID, steps []EventType, start, end time.Time) (*Funnel, error)
	GetFunnelDefinitions(ctx context.Context, festivalID uuid.UUID) ([]FunnelDefinition, error)
	SaveFunnelDefinition(ctx context.Context, funnel *FunnelDefinition) error

	// Cohort analysis
	GetCohortData(ctx context.Context, festivalID uuid.UUID, groupBy, metric string, period CohortPeriod, start, end time.Time) (*CohortAnalysis, error)

	// Heatmap data
	GetLocationHeatmap(ctx context.Context, festivalID uuid.UUID, start, end time.Time) (*Heatmap, error)
	GetTimeHeatmap(ctx context.Context, festivalID uuid.UUID, start, end time.Time) (*Heatmap, error)
	GetSpendingHeatmap(ctx context.Context, festivalID uuid.UUID, start, end time.Time) (*Heatmap, error)

	// User journey
	GetUserJourney(ctx context.Context, userID, festivalID uuid.UUID) (*UserJourney, error)

	// Analytics summary
	GetAnalyticsSummary(ctx context.Context, festivalID uuid.UUID, start, end time.Time) (*AnalyticsSummary, error)
	GetRealTimeMetrics(ctx context.Context, festivalID uuid.UUID) (*RealTimeMetrics, error)

	// Export
	SaveExport(ctx context.Context, export *AnalyticsExport) error
	GetExport(ctx context.Context, exportID uuid.UUID) (*AnalyticsExport, error)
	GetExportsByFestival(ctx context.Context, festivalID uuid.UUID) ([]AnalyticsExport, error)
}

// EventFilters contains filters for querying events
type EventFilters struct {
	EventTypes []EventType
	StartDate  *time.Time
	EndDate    *time.Time
	UserID     *uuid.UUID
	SessionID  string
	Category   string
	Platform   string
	Limit      int
	Offset     int
}

type analyticsRepository struct {
	db *gorm.DB
}

// NewAnalyticsRepository creates a new analytics repository
func NewAnalyticsRepository(db *gorm.DB) AnalyticsRepository {
	return &analyticsRepository{db: db}
}

// CreateEvent creates a new analytics event
func (r *analyticsRepository) CreateEvent(ctx context.Context, event *AnalyticsEvent) error {
	if event.ID == uuid.Nil {
		event.ID = uuid.New()
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}
	event.CreatedAt = time.Now()

	dataJSON, err := json.Marshal(event.Data)
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	query := `
		INSERT INTO public.analytics_events
		(id, festival_id, user_id, session_id, type, category, action, label, value, data,
		 device_type, platform, app_version, latitude, longitude, timestamp, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	if err := r.db.WithContext(ctx).Exec(query,
		event.ID, event.FestivalID, event.UserID, event.SessionID, event.Type,
		event.Category, event.Action, event.Label, event.Value, dataJSON,
		event.DeviceType, event.Platform, event.AppVersion,
		event.Latitude, event.Longitude, event.Timestamp, event.CreatedAt,
	).Error; err != nil {
		return fmt.Errorf("failed to create analytics event: %w", err)
	}

	return nil
}

// CreateEventsBatch creates multiple analytics events in a single batch
func (r *analyticsRepository) CreateEventsBatch(ctx context.Context, events []*AnalyticsEvent) error {
	if len(events) == 0 {
		return nil
	}

	now := time.Now()
	for _, event := range events {
		if event.ID == uuid.Nil {
			event.ID = uuid.New()
		}
		if event.Timestamp.IsZero() {
			event.Timestamp = now
		}
		event.CreatedAt = now
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, event := range events {
			dataJSON, err := json.Marshal(event.Data)
			if err != nil {
				return fmt.Errorf("failed to marshal event data: %w", err)
			}

			query := `
				INSERT INTO public.analytics_events
				(id, festival_id, user_id, session_id, type, category, action, label, value, data,
				 device_type, platform, app_version, latitude, longitude, timestamp, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

			if err := tx.Exec(query,
				event.ID, event.FestivalID, event.UserID, event.SessionID, event.Type,
				event.Category, event.Action, event.Label, event.Value, dataJSON,
				event.DeviceType, event.Platform, event.AppVersion,
				event.Latitude, event.Longitude, event.Timestamp, event.CreatedAt,
			).Error; err != nil {
				return fmt.Errorf("failed to create analytics event: %w", err)
			}
		}
		return nil
	})
}

// GetEvents retrieves analytics events based on filters
func (r *analyticsRepository) GetEvents(ctx context.Context, festivalID uuid.UUID, filters EventFilters) ([]AnalyticsEvent, error) {
	query := `
		SELECT id, festival_id, user_id, session_id, type, category, action, label, value, data,
		       device_type, platform, app_version, latitude, longitude, timestamp, created_at
		FROM public.analytics_events
		WHERE festival_id = ?`
	args := []interface{}{festivalID}

	if len(filters.EventTypes) > 0 {
		query += " AND type IN (?)"
		args = append(args, filters.EventTypes)
	}
	if filters.StartDate != nil {
		query += " AND timestamp >= ?"
		args = append(args, *filters.StartDate)
	}
	if filters.EndDate != nil {
		query += " AND timestamp <= ?"
		args = append(args, *filters.EndDate)
	}
	if filters.UserID != nil {
		query += " AND user_id = ?"
		args = append(args, *filters.UserID)
	}
	if filters.SessionID != "" {
		query += " AND session_id = ?"
		args = append(args, filters.SessionID)
	}
	if filters.Category != "" {
		query += " AND category = ?"
		args = append(args, filters.Category)
	}
	if filters.Platform != "" {
		query += " AND platform = ?"
		args = append(args, filters.Platform)
	}

	query += " ORDER BY timestamp DESC"

	if filters.Limit > 0 {
		query += " LIMIT ?"
		args = append(args, filters.Limit)
	}
	if filters.Offset > 0 {
		query += " OFFSET ?"
		args = append(args, filters.Offset)
	}

	var results []struct {
		ID         uuid.UUID
		FestivalID uuid.UUID
		UserID     *uuid.UUID
		SessionID  string
		Type       string
		Category   string
		Action     string
		Label      string
		Value      float64
		Data       []byte
		DeviceType string
		Platform   string
		AppVersion string
		Latitude   *float64
		Longitude  *float64
		Timestamp  time.Time
		CreatedAt  time.Time
	}

	if err := r.db.WithContext(ctx).Raw(query, args...).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get analytics events: %w", err)
	}

	events := make([]AnalyticsEvent, len(results))
	for i, res := range results {
		var data map[string]interface{}
		if len(res.Data) > 0 {
			json.Unmarshal(res.Data, &data)
		}

		events[i] = AnalyticsEvent{
			ID:         res.ID,
			FestivalID: res.FestivalID,
			UserID:     res.UserID,
			SessionID:  res.SessionID,
			Type:       EventType(res.Type),
			Category:   res.Category,
			Action:     res.Action,
			Label:      res.Label,
			Value:      res.Value,
			Data:       data,
			DeviceType: res.DeviceType,
			Platform:   res.Platform,
			AppVersion: res.AppVersion,
			Latitude:   res.Latitude,
			Longitude:  res.Longitude,
			Timestamp:  res.Timestamp,
			CreatedAt:  res.CreatedAt,
		}
	}

	return events, nil
}

// GetEventsByUser retrieves all events for a specific user
func (r *analyticsRepository) GetEventsByUser(ctx context.Context, userID, festivalID uuid.UUID) ([]AnalyticsEvent, error) {
	return r.GetEvents(ctx, festivalID, EventFilters{UserID: &userID, Limit: 1000})
}

// GetEventsBySession retrieves all events for a specific session
func (r *analyticsRepository) GetEventsBySession(ctx context.Context, sessionID string, festivalID uuid.UUID) ([]AnalyticsEvent, error) {
	return r.GetEvents(ctx, festivalID, EventFilters{SessionID: sessionID, Limit: 1000})
}

// GetEventCount returns the count of events matching criteria
func (r *analyticsRepository) GetEventCount(ctx context.Context, festivalID uuid.UUID, eventType EventType, start, end time.Time) (int64, error) {
	query := `
		SELECT COUNT(*)
		FROM public.analytics_events
		WHERE festival_id = ? AND type = ? AND timestamp >= ? AND timestamp <= ?`

	var count int64
	if err := r.db.WithContext(ctx).Raw(query, festivalID, eventType, start, end).Scan(&count).Error; err != nil {
		return 0, fmt.Errorf("failed to get event count: %w", err)
	}

	return count, nil
}

// GetFunnelData calculates funnel metrics for given steps
func (r *analyticsRepository) GetFunnelData(ctx context.Context, festivalID uuid.UUID, steps []EventType, start, end time.Time) (*Funnel, error) {
	if len(steps) < 2 {
		return nil, fmt.Errorf("funnel requires at least 2 steps")
	}

	funnel := &Funnel{
		ID:         uuid.New(),
		FestivalID: festivalID,
		Steps:      make([]FunnelStep, len(steps)),
		Period:     fmt.Sprintf("%s - %s", start.Format("2006-01-02"), end.Format("2006-01-02")),
		CreatedAt:  time.Now(),
	}

	// Get count for each step - users who completed that step
	// Using session-based analysis
	for i, step := range steps {
		var query string
		var args []interface{}

		if i == 0 {
			// First step - all users who performed this event
			query = `
				SELECT COUNT(DISTINCT session_id)
				FROM public.analytics_events
				WHERE festival_id = ? AND type = ? AND timestamp >= ? AND timestamp <= ?`
			args = []interface{}{festivalID, step, start, end}
		} else {
			// Subsequent steps - users who performed this step after all previous steps
			query = `
				WITH step_times AS (
					SELECT session_id, MIN(timestamp) as step_time
					FROM public.analytics_events
					WHERE festival_id = ? AND type = ? AND timestamp >= ? AND timestamp <= ?
					GROUP BY session_id
				)`
			args = []interface{}{festivalID, steps[0], start, end}

			for j := 1; j <= i; j++ {
				query += fmt.Sprintf(`
				, step%d_times AS (
					SELECT e.session_id, MIN(e.timestamp) as step_time
					FROM public.analytics_events e
					INNER JOIN step%s_times prev ON e.session_id = prev.session_id AND e.timestamp > prev.step_time
					WHERE e.festival_id = ? AND e.type = ? AND e.timestamp >= ? AND e.timestamp <= ?
					GROUP BY e.session_id
				)`, j, func() string {
					if j == 1 {
						return ""
					}
					return fmt.Sprintf("%d", j-1)
				}())
				args = append(args, festivalID, steps[j], start, end)
			}

			query += fmt.Sprintf(`
				SELECT COUNT(DISTINCT session_id) FROM step%d_times`, i)
		}

		var count int64
		if err := r.db.WithContext(ctx).Raw(query, args...).Scan(&count).Error; err != nil {
			// If query fails, fall back to simple count
			simpleQuery := `
				SELECT COUNT(DISTINCT session_id)
				FROM public.analytics_events
				WHERE festival_id = ? AND type = ? AND timestamp >= ? AND timestamp <= ?`
			if err := r.db.WithContext(ctx).Raw(simpleQuery, festivalID, step, start, end).Scan(&count).Error; err != nil {
				return nil, fmt.Errorf("failed to get funnel step count: %w", err)
			}
		}

		percentage := float64(100)
		if i > 0 && funnel.Steps[i-1].Count > 0 {
			percentage = float64(count) / float64(funnel.Steps[i-1].Count) * 100
		}

		funnel.Steps[i] = FunnelStep{
			Name:       string(step),
			EventType:  string(step),
			Count:      count,
			Percentage: percentage,
		}
	}

	// Calculate overall metrics
	if len(funnel.Steps) > 0 {
		funnel.TotalStarted = funnel.Steps[0].Count
		funnel.TotalCompleted = funnel.Steps[len(funnel.Steps)-1].Count

		if funnel.TotalStarted > 0 {
			funnel.ConversionRate = float64(funnel.TotalCompleted) / float64(funnel.TotalStarted) * 100
		}

		// Find step with highest drop-off
		maxDropOff := float64(0)
		for i := 1; i < len(funnel.Steps); i++ {
			dropOff := 100 - funnel.Steps[i].Percentage
			if dropOff > maxDropOff {
				maxDropOff = dropOff
				funnel.DropOffStep = i
			}
		}
	}

	return funnel, nil
}

// GetFunnelDefinitions retrieves saved funnel definitions
func (r *analyticsRepository) GetFunnelDefinitions(ctx context.Context, festivalID uuid.UUID) ([]FunnelDefinition, error) {
	var definitions []FunnelDefinition

	query := `
		SELECT id, festival_id, name, description, steps, is_active, created_at, updated_at
		FROM public.funnel_definitions
		WHERE festival_id = ? AND is_active = true
		ORDER BY created_at DESC`

	if err := r.db.WithContext(ctx).Raw(query, festivalID).Scan(&definitions).Error; err != nil {
		// Table might not exist, return empty
		return []FunnelDefinition{}, nil
	}

	return definitions, nil
}

// SaveFunnelDefinition saves a funnel definition
func (r *analyticsRepository) SaveFunnelDefinition(ctx context.Context, funnel *FunnelDefinition) error {
	if funnel.ID == uuid.Nil {
		funnel.ID = uuid.New()
	}
	funnel.CreatedAt = time.Now()
	funnel.UpdatedAt = time.Now()

	stepsJSON, err := json.Marshal(funnel.Steps)
	if err != nil {
		return fmt.Errorf("failed to marshal steps: %w", err)
	}

	query := `
		INSERT INTO public.funnel_definitions (id, festival_id, name, description, steps, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			steps = EXCLUDED.steps,
			is_active = EXCLUDED.is_active,
			updated_at = EXCLUDED.updated_at`

	if err := r.db.WithContext(ctx).Exec(query,
		funnel.ID, funnel.FestivalID, funnel.Name, funnel.Description,
		stepsJSON, funnel.IsActive, funnel.CreatedAt, funnel.UpdatedAt,
	).Error; err != nil {
		return fmt.Errorf("failed to save funnel definition: %w", err)
	}

	return nil
}

// GetCohortData performs cohort analysis
func (r *analyticsRepository) GetCohortData(ctx context.Context, festivalID uuid.UUID, groupBy, metric string, period CohortPeriod, start, end time.Time) (*CohortAnalysis, error) {
	analysis := &CohortAnalysis{
		FestivalID:  festivalID,
		Name:        fmt.Sprintf("Cohort Analysis by %s", groupBy),
		GroupBy:     groupBy,
		Metric:      metric,
		Period:      string(period),
		Cohorts:     []Cohort{},
		GeneratedAt: time.Now(),
	}

	// Determine the date truncation based on period
	var dateTrunc string
	switch period {
	case CohortPeriodDaily:
		dateTrunc = "day"
	case CohortPeriodWeekly:
		dateTrunc = "week"
	case CohortPeriodMonthly:
		dateTrunc = "month"
	default:
		dateTrunc = "week"
	}

	// Get cohorts based on first event date
	cohortQuery := `
		SELECT
			DATE_TRUNC(?, first_seen) as cohort_date,
			COUNT(DISTINCT user_id) as cohort_size
		FROM (
			SELECT user_id, MIN(timestamp) as first_seen
			FROM public.analytics_events
			WHERE festival_id = ? AND user_id IS NOT NULL AND timestamp >= ? AND timestamp <= ?
			GROUP BY user_id
		) first_events
		GROUP BY DATE_TRUNC(?, first_seen)
		ORDER BY cohort_date`

	var cohortResults []struct {
		CohortDate time.Time
		CohortSize int64
	}

	if err := r.db.WithContext(ctx).Raw(cohortQuery, dateTrunc, festivalID, start, end, dateTrunc).Scan(&cohortResults).Error; err != nil {
		// Return empty analysis if query fails
		return analysis, nil
	}

	// Build cohorts with retention data
	for _, cr := range cohortResults {
		cohort := Cohort{
			ID:         uuid.New(),
			FestivalID: festivalID,
			Name:       cr.CohortDate.Format("2006-01-02"),
			GroupBy:    groupBy,
			Metric:     metric,
			Period:     period,
			CohortDate: cr.CohortDate,
			CohortSize: cr.CohortSize,
			Metrics:    []CohortMetric{},
			CreatedAt:  time.Now(),
		}

		// Calculate retention for each subsequent period (up to 8 periods)
		for periodNum := 0; periodNum <= 8; periodNum++ {
			var periodStart, periodEnd time.Time
			switch period {
			case CohortPeriodDaily:
				periodStart = cr.CohortDate.AddDate(0, 0, periodNum)
				periodEnd = cr.CohortDate.AddDate(0, 0, periodNum+1)
			case CohortPeriodWeekly:
				periodStart = cr.CohortDate.AddDate(0, 0, periodNum*7)
				periodEnd = cr.CohortDate.AddDate(0, 0, (periodNum+1)*7)
			case CohortPeriodMonthly:
				periodStart = cr.CohortDate.AddDate(0, periodNum, 0)
				periodEnd = cr.CohortDate.AddDate(0, periodNum+1, 0)
			}

			if periodEnd.After(end) {
				break
			}

			// Count returning users in this period
			retentionQuery := `
				SELECT COUNT(DISTINCT e.user_id) as returning_users
				FROM public.analytics_events e
				INNER JOIN (
					SELECT user_id
					FROM public.analytics_events
					WHERE festival_id = ? AND user_id IS NOT NULL
					GROUP BY user_id
					HAVING DATE_TRUNC(?, MIN(timestamp)) = ?
				) cohort_users ON e.user_id = cohort_users.user_id
				WHERE e.festival_id = ? AND e.timestamp >= ? AND e.timestamp < ?`

			var returningUsers int64
			r.db.WithContext(ctx).Raw(retentionQuery, festivalID, dateTrunc, cr.CohortDate, festivalID, periodStart, periodEnd).Scan(&returningUsers)

			retentionRate := float64(0)
			if cr.CohortSize > 0 {
				retentionRate = float64(returningUsers) / float64(cr.CohortSize) * 100
			}

			cohort.Metrics = append(cohort.Metrics, CohortMetric{
				Period:        periodNum,
				Count:         returningUsers,
				RetentionRate: retentionRate,
			})
			cohort.RetentionCurve = append(cohort.RetentionCurve, retentionRate)
		}

		// Calculate revenue metrics
		revenueQuery := `
			SELECT COALESCE(SUM(value), 0) as total_revenue
			FROM public.analytics_events e
			INNER JOIN (
				SELECT user_id
				FROM public.analytics_events
				WHERE festival_id = ? AND user_id IS NOT NULL
				GROUP BY user_id
				HAVING DATE_TRUNC(?, MIN(timestamp)) = ?
			) cohort_users ON e.user_id = cohort_users.user_id
			WHERE e.festival_id = ? AND e.type IN ('PURCHASE', 'WALLET_TOP_UP')`

		r.db.WithContext(ctx).Raw(revenueQuery, festivalID, dateTrunc, cr.CohortDate, festivalID).Scan(&cohort.TotalRevenue)

		if cr.CohortSize > 0 {
			cohort.AverageRevenue = float64(cohort.TotalRevenue) / float64(cr.CohortSize)
			cohort.LifetimeValue = cohort.AverageRevenue
		}

		analysis.Cohorts = append(analysis.Cohorts, cohort)
	}

	// Calculate summary
	if len(analysis.Cohorts) > 0 {
		var totalUsers int64
		var totalRetention float64
		var totalLTV float64
		bestRetention := float64(0)
		worstRetention := float64(100)
		var bestCohort, worstCohort string

		for _, c := range analysis.Cohorts {
			totalUsers += c.CohortSize
			totalLTV += c.LifetimeValue

			if len(c.RetentionCurve) > 1 {
				endRetention := c.RetentionCurve[len(c.RetentionCurve)-1]
				totalRetention += endRetention
				if endRetention > bestRetention {
					bestRetention = endRetention
					bestCohort = c.Name
				}
				if endRetention < worstRetention {
					worstRetention = endRetention
					worstCohort = c.Name
				}
			}
		}

		analysis.Summary = CohortSummary{
			TotalUsers:           totalUsers,
			AverageRetention:     totalRetention / float64(len(analysis.Cohorts)),
			AverageLifetimeValue: totalLTV / float64(len(analysis.Cohorts)),
			BestCohort:           bestCohort,
			WorstCohort:          worstCohort,
			TrendDirection:       "stable",
		}

		// Determine trend
		if len(analysis.Cohorts) >= 2 {
			recentRetention := float64(0)
			olderRetention := float64(0)
			mid := len(analysis.Cohorts) / 2

			for i, c := range analysis.Cohorts {
				if len(c.RetentionCurve) > 1 {
					if i < mid {
						olderRetention += c.RetentionCurve[len(c.RetentionCurve)-1]
					} else {
						recentRetention += c.RetentionCurve[len(c.RetentionCurve)-1]
					}
				}
			}

			if recentRetention > olderRetention*1.1 {
				analysis.Summary.TrendDirection = "improving"
			} else if recentRetention < olderRetention*0.9 {
				analysis.Summary.TrendDirection = "declining"
			}
		}
	}

	return analysis, nil
}

// GetLocationHeatmap generates a location-based heatmap
func (r *analyticsRepository) GetLocationHeatmap(ctx context.Context, festivalID uuid.UUID, start, end time.Time) (*Heatmap, error) {
	heatmap := &Heatmap{
		ID:          uuid.New(),
		FestivalID:  festivalID,
		Type:        HeatmapTypeLocation,
		Name:        "Location Activity Heatmap",
		Description: "Visitor activity by location",
		Points:      []HeatmapPoint{},
		Unit:        "visitors",
		TimeStart:   start,
		TimeEnd:     end,
		GeneratedAt: time.Now(),
	}

	// Get activity by stand location
	query := `
		SELECT
			s.id as location_id,
			s.name as label,
			s.pos_x as x,
			s.pos_y as y,
			COUNT(t.id) as count,
			COALESCE(SUM(ABS(t.amount)), 0) as value
		FROM public.stands s
		LEFT JOIN public.transactions t ON t.stand_id = s.id
			AND t.created_at >= ? AND t.created_at <= ?
			AND t.status = 'COMPLETED'
		WHERE s.festival_id = ?
		GROUP BY s.id, s.name, s.pos_x, s.pos_y`

	var results []struct {
		LocationID uuid.UUID
		Label      string
		X          float64
		Y          float64
		Count      int64
		Value      float64
	}

	if err := r.db.WithContext(ctx).Raw(query, start, end, festivalID).Scan(&results).Error; err != nil {
		return heatmap, nil
	}

	for _, res := range results {
		point := HeatmapPoint{
			X:          res.X,
			Y:          res.Y,
			Value:      res.Value,
			Count:      res.Count,
			Label:      res.Label,
			LocationID: &res.LocationID,
		}
		heatmap.Points = append(heatmap.Points, point)

		if res.Value > heatmap.MaxValue {
			heatmap.MaxValue = res.Value
		}
		if res.Value < heatmap.MinValue || heatmap.MinValue == 0 {
			heatmap.MinValue = res.Value
		}
	}

	return heatmap, nil
}

// GetTimeHeatmap generates a time-based activity heatmap
func (r *analyticsRepository) GetTimeHeatmap(ctx context.Context, festivalID uuid.UUID, start, end time.Time) (*Heatmap, error) {
	heatmap := &Heatmap{
		ID:          uuid.New(),
		FestivalID:  festivalID,
		Type:        HeatmapTypeTime,
		Name:        "Activity by Time",
		Description: "Transaction activity by day and hour",
		Points:      []HeatmapPoint{},
		Unit:        "transactions",
		GridWidth:   24, // Hours
		GridHeight:  7,  // Days of week
		TimeStart:   start,
		TimeEnd:     end,
		GeneratedAt: time.Now(),
	}

	// Get transaction counts by day of week and hour
	query := `
		SELECT
			EXTRACT(DOW FROM t.created_at) as day_of_week,
			EXTRACT(HOUR FROM t.created_at) as hour,
			COUNT(*) as count,
			COALESCE(SUM(ABS(t.amount)), 0) as value
		FROM public.transactions t
		INNER JOIN public.wallets w ON t.wallet_id = w.id
		WHERE w.festival_id = ?
			AND t.created_at >= ? AND t.created_at <= ?
			AND t.status = 'COMPLETED'
		GROUP BY EXTRACT(DOW FROM t.created_at), EXTRACT(HOUR FROM t.created_at)
		ORDER BY day_of_week, hour`

	var results []struct {
		DayOfWeek float64
		Hour      float64
		Count     int64
		Value     float64
	}

	if err := r.db.WithContext(ctx).Raw(query, festivalID, start, end).Scan(&results).Error; err != nil {
		return heatmap, nil
	}

	days := []string{"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"}

	for _, res := range results {
		label := fmt.Sprintf("%s %02d:00", days[int(res.DayOfWeek)], int(res.Hour))
		point := HeatmapPoint{
			X:     res.Hour,
			Y:     res.DayOfWeek,
			Value: float64(res.Count),
			Count: res.Count,
			Label: label,
		}
		heatmap.Points = append(heatmap.Points, point)

		if float64(res.Count) > heatmap.MaxValue {
			heatmap.MaxValue = float64(res.Count)
		}
		if float64(res.Count) < heatmap.MinValue || heatmap.MinValue == 0 {
			heatmap.MinValue = float64(res.Count)
		}
	}

	return heatmap, nil
}

// GetSpendingHeatmap generates a spending-based heatmap
func (r *analyticsRepository) GetSpendingHeatmap(ctx context.Context, festivalID uuid.UUID, start, end time.Time) (*Heatmap, error) {
	heatmap := &Heatmap{
		ID:          uuid.New(),
		FestivalID:  festivalID,
		Type:        HeatmapTypeSpending,
		Name:        "Spending by Location",
		Description: "Total spending by stand",
		Points:      []HeatmapPoint{},
		Unit:        "EUR",
		TimeStart:   start,
		TimeEnd:     end,
		GeneratedAt: time.Now(),
	}

	query := `
		SELECT
			s.id as location_id,
			s.name as label,
			s.pos_x as x,
			s.pos_y as y,
			COUNT(t.id) as count,
			COALESCE(SUM(ABS(t.amount)), 0) as value
		FROM public.stands s
		LEFT JOIN public.transactions t ON t.stand_id = s.id
			AND t.created_at >= ? AND t.created_at <= ?
			AND t.status = 'COMPLETED'
			AND t.type = 'PURCHASE'
		WHERE s.festival_id = ?
		GROUP BY s.id, s.name, s.pos_x, s.pos_y
		ORDER BY value DESC`

	var results []struct {
		LocationID uuid.UUID
		Label      string
		X          float64
		Y          float64
		Count      int64
		Value      int64
	}

	if err := r.db.WithContext(ctx).Raw(query, start, end, festivalID).Scan(&results).Error; err != nil {
		return heatmap, nil
	}

	for _, res := range results {
		// Convert cents to euros for display
		valueEuros := float64(res.Value) / 100.0
		point := HeatmapPoint{
			X:          res.X,
			Y:          res.Y,
			Value:      valueEuros,
			Count:      res.Count,
			Label:      res.Label,
			LocationID: &res.LocationID,
		}
		heatmap.Points = append(heatmap.Points, point)

		if valueEuros > heatmap.MaxValue {
			heatmap.MaxValue = valueEuros
		}
		if valueEuros < heatmap.MinValue || heatmap.MinValue == 0 {
			heatmap.MinValue = valueEuros
		}
	}

	return heatmap, nil
}

// GetUserJourney retrieves the complete journey for a user
func (r *analyticsRepository) GetUserJourney(ctx context.Context, userID, festivalID uuid.UUID) (*UserJourney, error) {
	journey := &UserJourney{
		UserID:       userID,
		FestivalID:   festivalID,
		Steps:        []UserJourneyStep{},
		TopLocations: []string{},
		KeyMoments:   []UserJourneyStep{},
	}

	// Get all events for this user
	events, err := r.GetEventsByUser(ctx, userID, festivalID)
	if err != nil {
		return nil, err
	}

	if len(events) == 0 {
		return journey, nil
	}

	journey.TotalEvents = len(events)
	journey.FirstSeen = events[len(events)-1].Timestamp
	journey.LastSeen = events[0].Timestamp

	// Build steps and track locations
	locationCounts := make(map[string]int)
	var totalSpent int64

	for i, event := range events {
		step := UserJourneyStep{
			Timestamp: event.Timestamp,
			EventType: event.Type,
			Category:  event.Category,
			Action:    event.Action,
			Label:     event.Label,
			Value:     event.Value,
		}

		// Calculate duration to next step
		if i < len(events)-1 {
			step.Duration = int64(events[i].Timestamp.Sub(events[i+1].Timestamp).Seconds())
		}

		// Extract location from event data
		if event.Data != nil {
			if loc, ok := event.Data["location"].(string); ok {
				step.Location = loc
				locationCounts[loc]++
			}
			if locID, ok := event.Data["locationId"].(string); ok {
				if id, err := uuid.Parse(locID); err == nil {
					step.LocationID = &id
				}
			}
		}

		journey.Steps = append(journey.Steps, step)

		// Track key moments (purchases, check-in, top-ups)
		switch event.Type {
		case EventTypePurchase, EventTypeWalletTopUp, EventTypeCheckIn:
			journey.KeyMoments = append(journey.KeyMoments, step)
			if event.Type == EventTypePurchase {
				totalSpent += int64(event.Value)
			}
		}
	}

	journey.TotalSpent = totalSpent
	journey.TotalSpentDisplay = formatCurrency(totalSpent)

	// Get top locations
	type locCount struct {
		loc   string
		count int
	}
	var sortedLocs []locCount
	for loc, count := range locationCounts {
		sortedLocs = append(sortedLocs, locCount{loc, count})
	}
	// Simple sort
	for i := 0; i < len(sortedLocs); i++ {
		for j := i + 1; j < len(sortedLocs); j++ {
			if sortedLocs[j].count > sortedLocs[i].count {
				sortedLocs[i], sortedLocs[j] = sortedLocs[j], sortedLocs[i]
			}
		}
	}
	for i := 0; i < len(sortedLocs) && i < 5; i++ {
		journey.TopLocations = append(journey.TopLocations, sortedLocs[i].loc)
	}

	// Count unique sessions
	sessions := make(map[string]bool)
	for _, event := range events {
		sessions[event.SessionID] = true
	}
	journey.SessionCount = len(sessions)

	// Calculate engagement score (simplified)
	score := float64(0)
	if journey.TotalEvents > 10 {
		score += 20
	}
	if journey.SessionCount > 1 {
		score += 20
	}
	if len(journey.KeyMoments) > 3 {
		score += 30
	}
	if journey.TotalSpent > 5000 { // > 50 EUR
		score += 30
	}
	journey.EngagementScore = score

	// Determine customer type
	if journey.TotalSpent > 10000 {
		journey.CustomerType = "vip"
	} else if journey.SessionCount > 1 {
		journey.CustomerType = "returning"
	} else {
		journey.CustomerType = "new"
	}

	return journey, nil
}

// GetAnalyticsSummary retrieves a summary of analytics
func (r *analyticsRepository) GetAnalyticsSummary(ctx context.Context, festivalID uuid.UUID, start, end time.Time) (*AnalyticsSummary, error) {
	summary := &AnalyticsSummary{
		FestivalID:  festivalID,
		TopEvents:   []EventTypeCount{},
		TopDevices:  []DeviceCount{},
		TopPlatforms: []PlatformCount{},
		Period:      fmt.Sprintf("%s - %s", start.Format("2006-01-02"), end.Format("2006-01-02")),
		GeneratedAt: time.Now(),
	}

	// Total events
	r.db.WithContext(ctx).Raw(`
		SELECT COUNT(*) FROM public.analytics_events
		WHERE festival_id = ? AND timestamp >= ? AND timestamp <= ?`,
		festivalID, start, end).Scan(&summary.TotalEvents)

	// Unique users
	r.db.WithContext(ctx).Raw(`
		SELECT COUNT(DISTINCT user_id) FROM public.analytics_events
		WHERE festival_id = ? AND user_id IS NOT NULL AND timestamp >= ? AND timestamp <= ?`,
		festivalID, start, end).Scan(&summary.UniqueUsers)

	// Unique sessions
	r.db.WithContext(ctx).Raw(`
		SELECT COUNT(DISTINCT session_id) FROM public.analytics_events
		WHERE festival_id = ? AND timestamp >= ? AND timestamp <= ?`,
		festivalID, start, end).Scan(&summary.UniqueSessions)

	// Top event types
	var eventTypes []struct {
		Type  string
		Count int64
	}
	r.db.WithContext(ctx).Raw(`
		SELECT type, COUNT(*) as count FROM public.analytics_events
		WHERE festival_id = ? AND timestamp >= ? AND timestamp <= ?
		GROUP BY type ORDER BY count DESC LIMIT 10`,
		festivalID, start, end).Scan(&eventTypes)

	for _, et := range eventTypes {
		pct := float64(0)
		if summary.TotalEvents > 0 {
			pct = float64(et.Count) / float64(summary.TotalEvents) * 100
		}
		summary.TopEvents = append(summary.TopEvents, EventTypeCount{
			Type:       et.Type,
			Count:      et.Count,
			Percentage: pct,
		})
	}

	// Top devices
	var devices []struct {
		Device string
		Count  int64
	}
	r.db.WithContext(ctx).Raw(`
		SELECT device_type as device, COUNT(*) as count FROM public.analytics_events
		WHERE festival_id = ? AND device_type != '' AND timestamp >= ? AND timestamp <= ?
		GROUP BY device_type ORDER BY count DESC LIMIT 5`,
		festivalID, start, end).Scan(&devices)

	for _, d := range devices {
		pct := float64(0)
		if summary.TotalEvents > 0 {
			pct = float64(d.Count) / float64(summary.TotalEvents) * 100
		}
		summary.TopDevices = append(summary.TopDevices, DeviceCount{
			Device:     d.Device,
			Count:      d.Count,
			Percentage: pct,
		})
	}

	// Top platforms
	var platforms []struct {
		Platform string
		Count    int64
	}
	r.db.WithContext(ctx).Raw(`
		SELECT platform, COUNT(*) as count FROM public.analytics_events
		WHERE festival_id = ? AND platform != '' AND timestamp >= ? AND timestamp <= ?
		GROUP BY platform ORDER BY count DESC LIMIT 5`,
		festivalID, start, end).Scan(&platforms)

	for _, p := range platforms {
		pct := float64(0)
		if summary.TotalEvents > 0 {
			pct = float64(p.Count) / float64(summary.TotalEvents) * 100
		}
		summary.TopPlatforms = append(summary.TopPlatforms, PlatformCount{
			Platform:   p.Platform,
			Count:      p.Count,
			Percentage: pct,
		})
	}

	// Calculate conversion rate (ticket view to purchase)
	var views, purchases int64
	r.db.WithContext(ctx).Raw(`
		SELECT COUNT(*) FROM public.analytics_events
		WHERE festival_id = ? AND type = 'TICKET_VIEW' AND timestamp >= ? AND timestamp <= ?`,
		festivalID, start, end).Scan(&views)
	r.db.WithContext(ctx).Raw(`
		SELECT COUNT(*) FROM public.analytics_events
		WHERE festival_id = ? AND type = 'TICKET_BUY' AND timestamp >= ? AND timestamp <= ?`,
		festivalID, start, end).Scan(&purchases)

	if views > 0 {
		summary.ConversionRate = float64(purchases) / float64(views) * 100
	}

	// Engagement rate
	if summary.UniqueUsers > 0 && summary.UniqueSessions > 0 {
		summary.EngagementRate = float64(summary.TotalEvents) / float64(summary.UniqueSessions)
	}

	return summary, nil
}

// GetRealTimeMetrics retrieves current real-time metrics
func (r *analyticsRepository) GetRealTimeMetrics(ctx context.Context, festivalID uuid.UUID) (*RealTimeMetrics, error) {
	now := time.Now()
	fiveMinAgo := now.Add(-5 * time.Minute)
	oneMinAgo := now.Add(-1 * time.Minute)
	oneHourAgo := now.Add(-1 * time.Hour)

	metrics := &RealTimeMetrics{
		FestivalID:  festivalID,
		QueueAlerts: []string{},
		Timestamp:   now,
	}

	// Active users (events in last 5 minutes)
	r.db.WithContext(ctx).Raw(`
		SELECT COUNT(DISTINCT COALESCE(user_id::text, session_id))
		FROM public.analytics_events
		WHERE festival_id = ? AND timestamp >= ?`,
		festivalID, fiveMinAgo).Scan(&metrics.ActiveUsers)

	// Events per minute (based on last 5 minutes)
	var eventCount int64
	r.db.WithContext(ctx).Raw(`
		SELECT COUNT(*) FROM public.analytics_events
		WHERE festival_id = ? AND timestamp >= ?`,
		festivalID, fiveMinAgo).Scan(&eventCount)
	metrics.EventsPerMinute = float64(eventCount) / 5.0

	// Transactions in last minute
	r.db.WithContext(ctx).Raw(`
		SELECT COUNT(*) FROM public.transactions t
		INNER JOIN public.wallets w ON t.wallet_id = w.id
		WHERE w.festival_id = ? AND t.created_at >= ? AND t.status = 'COMPLETED'`,
		festivalID, oneMinAgo).Scan(&metrics.TransactionsNow)

	// Revenue in last hour
	r.db.WithContext(ctx).Raw(`
		SELECT COALESCE(SUM(ABS(amount)), 0) FROM public.transactions t
		INNER JOIN public.wallets w ON t.wallet_id = w.id
		WHERE w.festival_id = ? AND t.created_at >= ? AND t.status = 'COMPLETED'
		AND t.type IN ('TOP_UP', 'CASH_IN')`,
		festivalID, oneHourAgo).Scan(&metrics.RevenueLastHour)

	// Top stand right now
	var topStand struct {
		Name  string
		Count int64
	}
	r.db.WithContext(ctx).Raw(`
		SELECT s.name, COUNT(*) as count
		FROM public.transactions t
		INNER JOIN public.stands s ON t.stand_id = s.id
		INNER JOIN public.wallets w ON t.wallet_id = w.id
		WHERE w.festival_id = ? AND t.created_at >= ? AND t.status = 'COMPLETED'
		GROUP BY s.id, s.name
		ORDER BY count DESC LIMIT 1`,
		festivalID, fiveMinAgo).Scan(&topStand)
	metrics.TopStandNow = topStand.Name

	return metrics, nil
}

// SaveExport saves an export record
func (r *analyticsRepository) SaveExport(ctx context.Context, export *AnalyticsExport) error {
	if export.ID == uuid.Nil {
		export.ID = uuid.New()
	}
	export.CreatedAt = time.Now()
	export.ExpiresAt = time.Now().Add(24 * time.Hour) // Exports expire in 24 hours

	dataTypesJSON, _ := json.Marshal(export.DataTypes)

	query := `
		INSERT INTO public.analytics_exports
		(id, festival_id, format, file_name, file_url, file_size, data_types,
		 start_date, end_date, status, error, created_at, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	return r.db.WithContext(ctx).Exec(query,
		export.ID, export.FestivalID, export.Format, export.FileName, export.FileURL,
		export.FileSize, dataTypesJSON, export.StartDate, export.EndDate,
		export.Status, export.Error, export.CreatedAt, export.ExpiresAt,
	).Error
}

// GetExport retrieves an export by ID
func (r *analyticsRepository) GetExport(ctx context.Context, exportID uuid.UUID) (*AnalyticsExport, error) {
	var export AnalyticsExport
	query := `
		SELECT id, festival_id, format, file_name, file_url, file_size, data_types,
		       start_date, end_date, status, error, created_at, expires_at
		FROM public.analytics_exports WHERE id = ?`

	if err := r.db.WithContext(ctx).Raw(query, exportID).Scan(&export).Error; err != nil {
		return nil, err
	}

	return &export, nil
}

// GetExportsByFestival retrieves all exports for a festival
func (r *analyticsRepository) GetExportsByFestival(ctx context.Context, festivalID uuid.UUID) ([]AnalyticsExport, error) {
	var exports []AnalyticsExport
	query := `
		SELECT id, festival_id, format, file_name, file_url, file_size, data_types,
		       start_date, end_date, status, error, created_at, expires_at
		FROM public.analytics_exports
		WHERE festival_id = ? AND expires_at > NOW()
		ORDER BY created_at DESC`

	if err := r.db.WithContext(ctx).Raw(query, festivalID).Scan(&exports).Error; err != nil {
		return nil, err
	}

	return exports, nil
}
