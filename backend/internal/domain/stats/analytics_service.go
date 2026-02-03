package stats

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"gorm.io/gorm"
)

// AnalyticsService provides business logic for advanced analytics
type AnalyticsService struct {
	repo         AnalyticsRepository
	statsRepo    Repository
	db           *gorm.DB
	exportPath   string
}

// NewAnalyticsService creates a new analytics service
func NewAnalyticsService(repo AnalyticsRepository, statsRepo Repository, db *gorm.DB, exportPath string) *AnalyticsService {
	if exportPath == "" {
		exportPath = "/tmp/analytics_exports"
	}
	return &AnalyticsService{
		repo:       repo,
		statsRepo:  statsRepo,
		db:         db,
		exportPath: exportPath,
	}
}

// ==================== Event Tracking ====================

// TrackEvent records a new analytics event
func (s *AnalyticsService) TrackEvent(ctx context.Context, festivalID uuid.UUID, userID *uuid.UUID, req *CreateAnalyticsEventRequest) (*AnalyticsEventResponse, error) {
	// Verify festival exists
	if err := s.verifyFestival(ctx, festivalID); err != nil {
		return nil, err
	}

	event := &AnalyticsEvent{
		ID:         uuid.New(),
		FestivalID: festivalID,
		UserID:     userID,
		SessionID:  req.SessionID,
		Type:       req.Type,
		Category:   req.Category,
		Action:     req.Action,
		Label:      req.Label,
		Value:      req.Value,
		Data:       req.Data,
		DeviceType: req.DeviceType,
		Platform:   req.Platform,
		AppVersion: req.AppVersion,
		Latitude:   req.Latitude,
		Longitude:  req.Longitude,
		Timestamp:  time.Now(),
	}

	if req.Timestamp != nil {
		event.Timestamp = *req.Timestamp
	}

	if err := s.repo.CreateEvent(ctx, event); err != nil {
		return nil, fmt.Errorf("failed to track event: %w", err)
	}

	response := event.ToResponse()
	return &response, nil
}

// TrackEventsBatch records multiple analytics events in a batch
func (s *AnalyticsService) TrackEventsBatch(ctx context.Context, festivalID uuid.UUID, userID *uuid.UUID, requests []CreateAnalyticsEventRequest) error {
	// Verify festival exists
	if err := s.verifyFestival(ctx, festivalID); err != nil {
		return err
	}

	events := make([]*AnalyticsEvent, len(requests))
	now := time.Now()

	for i, req := range requests {
		timestamp := now
		if req.Timestamp != nil {
			timestamp = *req.Timestamp
		}

		events[i] = &AnalyticsEvent{
			ID:         uuid.New(),
			FestivalID: festivalID,
			UserID:     userID,
			SessionID:  req.SessionID,
			Type:       req.Type,
			Category:   req.Category,
			Action:     req.Action,
			Label:      req.Label,
			Value:      req.Value,
			Data:       req.Data,
			DeviceType: req.DeviceType,
			Platform:   req.Platform,
			AppVersion: req.AppVersion,
			Latitude:   req.Latitude,
			Longitude:  req.Longitude,
			Timestamp:  timestamp,
		}
	}

	return s.repo.CreateEventsBatch(ctx, events)
}

// GetEvents retrieves analytics events based on filters
func (s *AnalyticsService) GetEvents(ctx context.Context, festivalID uuid.UUID, filters EventFilters) ([]AnalyticsEventResponse, error) {
	events, err := s.repo.GetEvents(ctx, festivalID, filters)
	if err != nil {
		return nil, err
	}

	responses := make([]AnalyticsEventResponse, len(events))
	for i, event := range events {
		responses[i] = event.ToResponse()
	}

	return responses, nil
}

// ==================== Funnel Analysis ====================

// GetFunnelAnalysis performs funnel analysis for a festival
func (s *AnalyticsService) GetFunnelAnalysis(ctx context.Context, festivalID uuid.UUID, funnelName string, start, end time.Time) (*Funnel, error) {
	if err := s.verifyFestival(ctx, festivalID); err != nil {
		return nil, err
	}

	// Get predefined funnel steps
	var steps []EventType
	for _, pf := range PredefinedFunnels() {
		if pf.Name == funnelName {
			steps = pf.Steps
			break
		}
	}

	// If not found in predefined, check custom funnels
	if len(steps) == 0 {
		definitions, _ := s.repo.GetFunnelDefinitions(ctx, festivalID)
		for _, def := range definitions {
			if def.Name == funnelName {
				for _, step := range def.Steps {
					steps = append(steps, EventType(step))
				}
				break
			}
		}
	}

	// Default to ticket purchase funnel
	if len(steps) == 0 {
		steps = []EventType{EventTypePageView, EventTypeTicketView, EventTypeTicketBuy}
	}

	funnel, err := s.repo.GetFunnelData(ctx, festivalID, steps, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to get funnel data: %w", err)
	}

	funnel.Name = funnelName
	return funnel, nil
}

// GetAllFunnels returns all available funnels with their analysis
func (s *AnalyticsService) GetAllFunnels(ctx context.Context, festivalID uuid.UUID, start, end time.Time) ([]Funnel, error) {
	if err := s.verifyFestival(ctx, festivalID); err != nil {
		return nil, err
	}

	funnels := []Funnel{}

	// Analyze predefined funnels
	for _, pf := range PredefinedFunnels() {
		funnel, err := s.repo.GetFunnelData(ctx, festivalID, pf.Steps, start, end)
		if err != nil {
			continue
		}
		funnel.Name = pf.Name
		funnel.Description = pf.Description
		funnels = append(funnels, *funnel)
	}

	// Analyze custom funnels
	definitions, _ := s.repo.GetFunnelDefinitions(ctx, festivalID)
	for _, def := range definitions {
		var steps []EventType
		for _, step := range def.Steps {
			steps = append(steps, EventType(step))
		}
		funnel, err := s.repo.GetFunnelData(ctx, festivalID, steps, start, end)
		if err != nil {
			continue
		}
		funnel.Name = def.Name
		funnel.Description = def.Description
		funnels = append(funnels, *funnel)
	}

	return funnels, nil
}

// CreateCustomFunnel creates a custom funnel definition
func (s *AnalyticsService) CreateCustomFunnel(ctx context.Context, festivalID uuid.UUID, name, description string, steps []string) (*FunnelDefinition, error) {
	if err := s.verifyFestival(ctx, festivalID); err != nil {
		return nil, err
	}

	if len(steps) < 2 {
		return nil, fmt.Errorf("funnel must have at least 2 steps")
	}

	funnel := &FunnelDefinition{
		ID:          uuid.New(),
		FestivalID:  festivalID,
		Name:        name,
		Description: description,
		Steps:       steps,
		IsActive:    true,
	}

	if err := s.repo.SaveFunnelDefinition(ctx, funnel); err != nil {
		return nil, fmt.Errorf("failed to save funnel definition: %w", err)
	}

	return funnel, nil
}

// ==================== Cohort Analysis ====================

// GetCohortAnalysis performs cohort analysis
func (s *AnalyticsService) GetCohortAnalysis(ctx context.Context, festivalID uuid.UUID, cohortType string, period CohortPeriod, start, end time.Time) (*CohortAnalysis, error) {
	if err := s.verifyFestival(ctx, festivalID); err != nil {
		return nil, err
	}

	// Determine groupBy and metric based on cohort type
	groupBy := "first_activity"
	metric := "retention"

	switch cohortType {
	case "ticket_purchase":
		groupBy = "ticket_purchase_date"
		metric = "retention"
	case "first_activity":
		groupBy = "first_activity"
		metric = "retention"
	case "revenue":
		groupBy = "first_activity"
		metric = "revenue"
	case "spending":
		groupBy = "ticket_purchase_date"
		metric = "spending"
	}

	analysis, err := s.repo.GetCohortData(ctx, festivalID, groupBy, metric, period, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to get cohort data: %w", err)
	}

	return analysis, nil
}

// ==================== Heatmap Data ====================

// GetHeatmapData generates heatmap data based on type
func (s *AnalyticsService) GetHeatmapData(ctx context.Context, festivalID uuid.UUID, heatmapType HeatmapType, start, end time.Time) (*Heatmap, error) {
	if err := s.verifyFestival(ctx, festivalID); err != nil {
		return nil, err
	}

	var heatmap *Heatmap
	var err error

	switch heatmapType {
	case HeatmapTypeLocation:
		heatmap, err = s.repo.GetLocationHeatmap(ctx, festivalID, start, end)
	case HeatmapTypeTime:
		heatmap, err = s.repo.GetTimeHeatmap(ctx, festivalID, start, end)
	case HeatmapTypeSpending:
		heatmap, err = s.repo.GetSpendingHeatmap(ctx, festivalID, start, end)
	case HeatmapTypeTraffic:
		heatmap, err = s.repo.GetLocationHeatmap(ctx, festivalID, start, end)
		if heatmap != nil {
			heatmap.Type = HeatmapTypeTraffic
			heatmap.Name = "Traffic Flow Heatmap"
			heatmap.Unit = "visits"
		}
	case HeatmapTypeEngagement:
		heatmap, err = s.repo.GetTimeHeatmap(ctx, festivalID, start, end)
		if heatmap != nil {
			heatmap.Type = HeatmapTypeEngagement
			heatmap.Name = "User Engagement Heatmap"
		}
	default:
		return nil, fmt.Errorf("unsupported heatmap type: %s", heatmapType)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get heatmap data: %w", err)
	}

	return heatmap, nil
}

// ==================== User Journey ====================

// GetUserJourney retrieves the complete journey for a user
func (s *AnalyticsService) GetUserJourney(ctx context.Context, userID, festivalID uuid.UUID) (*UserJourney, error) {
	if err := s.verifyFestival(ctx, festivalID); err != nil {
		return nil, err
	}

	journey, err := s.repo.GetUserJourney(ctx, userID, festivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user journey: %w", err)
	}

	return journey, nil
}

// ==================== Predictions ====================

// GetPredictions generates ML-based predictions for a festival
func (s *AnalyticsService) GetPredictions(ctx context.Context, festivalID uuid.UUID) (*Predictions, error) {
	if err := s.verifyFestival(ctx, festivalID); err != nil {
		return nil, err
	}

	predictions := &Predictions{
		FestivalID:      festivalID,
		PeakHours:       []Prediction{},
		StandDemand:     []Prediction{},
		Recommendations: []Recommendation{},
		GeneratedAt:     time.Now(),
	}

	// Get historical data for predictions
	now := time.Now()
	weekAgo := now.AddDate(0, 0, -7)

	// Get stats for prediction calculations
	stats, err := s.statsRepo.GetFestivalStats(ctx, festivalID, TimeframeWeek)
	if err != nil {
		// Continue without stats, use defaults
		stats = &FestivalStats{}
	}

	// Revenue prediction
	predictions.Revenue = s.predictRevenue(ctx, festivalID, stats)

	// Attendance prediction
	predictions.Attendance = s.predictAttendance(ctx, festivalID, stats)

	// Peak hours prediction
	predictions.PeakHours = s.predictPeakHours(ctx, festivalID, weekAgo, now)

	// Stand demand prediction
	predictions.StandDemand = s.predictStandDemand(ctx, festivalID)

	// Generate recommendations
	predictions.Recommendations = s.generateRecommendations(ctx, festivalID, stats, predictions)

	return predictions, nil
}

// predictRevenue generates revenue predictions
func (s *AnalyticsService) predictRevenue(ctx context.Context, festivalID uuid.UUID, stats *FestivalStats) *Prediction {
	// Simple prediction based on historical average
	avgDaily := float64(stats.TotalRevenue) / 7.0 // Weekly average

	// Add some variance for confidence interval
	variance := avgDaily * 0.15

	prediction := &Prediction{
		ID:              uuid.New(),
		FestivalID:      festivalID,
		Type:            PredictionTypeRevenue,
		Name:            "Daily Revenue Prediction",
		Description:     "Predicted revenue for the next day based on historical trends",
		PredictedValue:  avgDaily,
		Unit:            "EUR",
		Confidence:      0.75,
		ConfidenceLevel: "medium",
		LowerBound:      avgDaily - variance,
		UpperBound:      avgDaily + variance,
		PredictedAt:     time.Now(),
		ValidUntil:      time.Now().Add(24 * time.Hour),
		TargetDate:      time.Now().AddDate(0, 0, 1),
		Factors:         []PredictionFactor{},
		Historical:      []HistoricalPoint{},
		Trend:           "stable",
		PercentChange:   0,
	}

	// Add factors
	prediction.Factors = append(prediction.Factors, PredictionFactor{
		Name:        "Historical Average",
		Impact:      0.7,
		Description: "Based on 7-day average revenue",
		Category:    "historical",
	})

	if stats.ActiveWallets > 0 {
		avgPerWallet := float64(stats.TotalRevenue) / float64(stats.ActiveWallets)
		prediction.Factors = append(prediction.Factors, PredictionFactor{
			Name:        "Average Wallet Spend",
			Impact:      0.3,
			Description: fmt.Sprintf("%.2f EUR average per wallet", avgPerWallet/100),
			Category:    "behavioral",
		})
	}

	return prediction
}

// predictAttendance generates attendance predictions
func (s *AnalyticsService) predictAttendance(ctx context.Context, festivalID uuid.UUID, stats *FestivalStats) *Prediction {
	// Use check-in rate as base
	expectedCheckIns := float64(stats.TicketsSold) * 0.85 // 85% expected attendance

	prediction := &Prediction{
		ID:              uuid.New(),
		FestivalID:      festivalID,
		Type:            PredictionTypeAttendance,
		Name:            "Expected Attendance",
		Description:     "Predicted check-ins based on ticket sales and historical patterns",
		PredictedValue:  expectedCheckIns,
		Unit:            "visitors",
		Confidence:      0.8,
		ConfidenceLevel: "high",
		LowerBound:      expectedCheckIns * 0.75,
		UpperBound:      expectedCheckIns * 1.05,
		PredictedAt:     time.Now(),
		ValidUntil:      time.Now().Add(24 * time.Hour),
		TargetDate:      time.Now().AddDate(0, 0, 1),
		Factors:         []PredictionFactor{},
		Historical:      []HistoricalPoint{},
		Trend:           "stable",
	}

	// Calculate percent change from current
	if stats.TicketsCheckedIn > 0 {
		prediction.PercentChange = (expectedCheckIns - float64(stats.TicketsCheckedIn)) / float64(stats.TicketsCheckedIn) * 100
	}

	prediction.Factors = append(prediction.Factors, PredictionFactor{
		Name:        "Tickets Sold",
		Impact:      0.8,
		Description: fmt.Sprintf("%d tickets sold, expecting ~85%% attendance", stats.TicketsSold),
		Category:    "historical",
	})

	return prediction
}

// predictPeakHours predicts busy periods
func (s *AnalyticsService) predictPeakHours(ctx context.Context, festivalID uuid.UUID, start, end time.Time) []Prediction {
	predictions := []Prediction{}

	// Get time heatmap for pattern analysis
	heatmap, err := s.repo.GetTimeHeatmap(ctx, festivalID, start, end)
	if err != nil || len(heatmap.Points) == 0 {
		return predictions
	}

	// Find top 3 peak periods
	type peakInfo struct {
		hour  int
		day   int
		value float64
	}
	peaks := []peakInfo{}

	for _, point := range heatmap.Points {
		peaks = append(peaks, peakInfo{
			hour:  int(point.X),
			day:   int(point.Y),
			value: point.Value,
		})
	}

	// Sort by value descending
	sort.Slice(peaks, func(i, j int) bool {
		return peaks[i].value > peaks[j].value
	})

	days := []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}

	for i := 0; i < 3 && i < len(peaks); i++ {
		peak := peaks[i]
		predictions = append(predictions, Prediction{
			ID:              uuid.New(),
			FestivalID:      festivalID,
			Type:            PredictionTypeCrowdDensity,
			Name:            fmt.Sprintf("Peak Period %d", i+1),
			Description:     fmt.Sprintf("%s at %02d:00 - Expected high traffic", days[peak.day], peak.hour),
			PredictedValue:  peak.value,
			Unit:            "transactions",
			Confidence:      0.7,
			ConfidenceLevel: "medium",
			PredictedAt:     time.Now(),
			ValidUntil:      time.Now().Add(7 * 24 * time.Hour),
			Trend:           "stable",
		})
	}

	return predictions
}

// predictStandDemand predicts demand per stand
func (s *AnalyticsService) predictStandDemand(ctx context.Context, festivalID uuid.UUID) []Prediction {
	predictions := []Prediction{}

	// Get top stands data
	topStands, err := s.statsRepo.GetTopStands(ctx, festivalID, 5, TimeframeWeek)
	if err != nil {
		return predictions
	}

	for _, stand := range topStands {
		// Predict tomorrow's transactions based on average
		avgDaily := float64(stand.Transactions) / 7.0
		predictions = append(predictions, Prediction{
			ID:              uuid.New(),
			FestivalID:      festivalID,
			Type:            PredictionTypeDemand,
			Name:            stand.StandName,
			Description:     fmt.Sprintf("Expected transactions for %s", stand.StandName),
			PredictedValue:  avgDaily,
			Unit:            "transactions",
			Confidence:      0.65,
			ConfidenceLevel: "medium",
			LowerBound:      avgDaily * 0.7,
			UpperBound:      avgDaily * 1.3,
			PredictedAt:     time.Now(),
			ValidUntil:      time.Now().Add(24 * time.Hour),
			TargetDate:      time.Now().AddDate(0, 0, 1),
			Trend:           "stable",
		})
	}

	return predictions
}

// generateRecommendations creates actionable recommendations
func (s *AnalyticsService) generateRecommendations(ctx context.Context, festivalID uuid.UUID, stats *FestivalStats, predictions *Predictions) []Recommendation {
	recommendations := []Recommendation{}

	// Check-in rate recommendation
	if stats.TicketsSold > 0 {
		checkInRate := float64(stats.TicketsCheckedIn) / float64(stats.TicketsSold) * 100
		if checkInRate < 50 {
			recommendations = append(recommendations, Recommendation{
				ID:          uuid.New().String(),
				Title:       "Low Check-in Rate",
				Description: fmt.Sprintf("Only %.1f%% of tickets have been used. Consider sending reminders.", checkInRate),
				Category:    "operations",
				Priority:    "high",
				Impact:      "Increase attendance and revenue from on-site sales",
				ActionItems: []string{
					"Send push notification to ticket holders",
					"Post social media reminder",
					"Check for technical issues at entry points",
				},
			})
		}
	}

	// Wallet balance recommendation
	if stats.ActiveWallets > 0 && stats.TotalWallets > 0 {
		walletActivation := float64(stats.ActiveWallets) / float64(stats.TotalWallets) * 100
		if walletActivation < 60 {
			recommendations = append(recommendations, Recommendation{
				ID:          uuid.New().String(),
				Title:       "Improve Wallet Activation",
				Description: fmt.Sprintf("Only %.1f%% of wallets have funds. Consider top-up incentives.", walletActivation),
				Category:    "operations",
				Priority:    "medium",
				Impact:      "Increase on-site spending",
				ActionItems: []string{
					"Offer bonus credits for top-ups over 50 EUR",
					"Add more top-up stations",
					"Train staff on promoting cashless benefits",
				},
			})
		}
	}

	// Revenue optimization
	if stats.AverageTransaction > 0 && stats.AverageTransaction < 1000 { // < 10 EUR average
		recommendations = append(recommendations, Recommendation{
			ID:          uuid.New().String(),
			Title:       "Increase Average Transaction",
			Description: fmt.Sprintf("Average transaction is %.2f EUR. Consider upselling strategies.", float64(stats.AverageTransaction)/100),
			Category:    "pricing",
			Priority:    "medium",
			Impact:      "Boost revenue without increasing traffic",
			ActionItems: []string{
				"Create combo deals at stands",
				"Implement loyalty rewards",
				"Add premium product options",
			},
		})
	}

	// Staffing recommendation based on peak hours
	if len(predictions.PeakHours) > 0 {
		peakHour := predictions.PeakHours[0]
		recommendations = append(recommendations, Recommendation{
			ID:          uuid.New().String(),
			Title:       "Optimize Peak Hour Staffing",
			Description: peakHour.Description,
			Category:    "staffing",
			Priority:    "medium",
			Impact:      "Reduce wait times and improve customer experience",
			ActionItems: []string{
				"Schedule extra staff during peak periods",
				"Open additional service points",
				"Pre-stock popular items",
			},
		})
	}

	return recommendations
}

// ==================== Export Analytics ====================

// ExportAnalytics exports analytics data in the specified format
func (s *AnalyticsService) ExportAnalytics(ctx context.Context, festivalID uuid.UUID, req *AnalyticsExportRequest) (*AnalyticsExport, error) {
	if err := s.verifyFestival(ctx, festivalID); err != nil {
		return nil, err
	}

	export := &AnalyticsExport{
		ID:         uuid.New(),
		FestivalID: festivalID,
		Format:     req.Format,
		DataTypes:  req.DataTypes,
		StartDate:  req.StartDate,
		EndDate:    req.EndDate,
		Status:     "processing",
	}

	// Create export directory if it doesn't exist
	if err := os.MkdirAll(s.exportPath, 0755); err != nil {
		export.Status = "failed"
		export.Error = fmt.Sprintf("failed to create export directory: %v", err)
		s.repo.SaveExport(ctx, export)
		return export, nil
	}

	// Generate filename
	timestamp := time.Now().Format("20060102_150405")
	var ext string
	switch req.Format {
	case ExportFormatCSV:
		ext = "csv"
	case ExportFormatJSON:
		ext = "json"
	case ExportFormatExcel:
		ext = "xlsx"
	case ExportFormatPDF:
		ext = "pdf"
	default:
		ext = "json"
	}
	export.FileName = fmt.Sprintf("analytics_%s_%s.%s", festivalID.String()[:8], timestamp, ext)
	export.FileURL = filepath.Join(s.exportPath, export.FileName)

	// Export data based on format
	var err error
	switch req.Format {
	case ExportFormatCSV:
		err = s.exportToCSV(ctx, festivalID, export, req)
	case ExportFormatJSON:
		err = s.exportToJSON(ctx, festivalID, export, req)
	default:
		err = s.exportToJSON(ctx, festivalID, export, req)
	}

	if err != nil {
		export.Status = "failed"
		export.Error = err.Error()
	} else {
		export.Status = "completed"
		// Get file size
		if info, err := os.Stat(export.FileURL); err == nil {
			export.FileSize = info.Size()
		}
	}

	s.repo.SaveExport(ctx, export)
	return export, nil
}

// exportToCSV exports analytics data to CSV
func (s *AnalyticsService) exportToCSV(ctx context.Context, festivalID uuid.UUID, export *AnalyticsExport, req *AnalyticsExportRequest) error {
	file, err := os.Create(export.FileURL)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	for _, dataType := range req.DataTypes {
		switch dataType {
		case "events":
			// Export events
			events, err := s.repo.GetEvents(ctx, festivalID, EventFilters{
				StartDate: &req.StartDate,
				EndDate:   &req.EndDate,
				Limit:     100000,
			})
			if err != nil {
				continue
			}

			writer.Write([]string{"--- Events ---"})
			writer.Write([]string{"ID", "Type", "Category", "Action", "Label", "Value", "SessionID", "Platform", "Timestamp"})
			for _, event := range events {
				writer.Write([]string{
					event.ID.String(),
					string(event.Type),
					event.Category,
					event.Action,
					event.Label,
					fmt.Sprintf("%.2f", event.Value),
					event.SessionID,
					event.Platform,
					event.Timestamp.Format(time.RFC3339),
				})
			}
			writer.Write([]string{})

		case "summary":
			// Export summary
			summary, err := s.repo.GetAnalyticsSummary(ctx, festivalID, req.StartDate, req.EndDate)
			if err != nil {
				continue
			}

			writer.Write([]string{"--- Summary ---"})
			writer.Write([]string{"Metric", "Value"})
			writer.Write([]string{"Total Events", fmt.Sprintf("%d", summary.TotalEvents)})
			writer.Write([]string{"Unique Users", fmt.Sprintf("%d", summary.UniqueUsers)})
			writer.Write([]string{"Unique Sessions", fmt.Sprintf("%d", summary.UniqueSessions)})
			writer.Write([]string{"Conversion Rate", fmt.Sprintf("%.2f%%", summary.ConversionRate)})
			writer.Write([]string{"Engagement Rate", fmt.Sprintf("%.2f", summary.EngagementRate)})
			writer.Write([]string{})
		}
	}

	return nil
}

// exportToJSON exports analytics data to JSON
func (s *AnalyticsService) exportToJSON(ctx context.Context, festivalID uuid.UUID, export *AnalyticsExport, req *AnalyticsExportRequest) error {
	data := make(map[string]interface{})
	data["festivalId"] = festivalID.String()
	data["exportedAt"] = time.Now().Format(time.RFC3339)
	data["period"] = map[string]string{
		"start": req.StartDate.Format(time.RFC3339),
		"end":   req.EndDate.Format(time.RFC3339),
	}

	for _, dataType := range req.DataTypes {
		switch dataType {
		case "events":
			events, err := s.repo.GetEvents(ctx, festivalID, EventFilters{
				StartDate: &req.StartDate,
				EndDate:   &req.EndDate,
				Limit:     100000,
			})
			if err == nil {
				responses := make([]AnalyticsEventResponse, len(events))
				for i, e := range events {
					responses[i] = e.ToResponse()
				}
				data["events"] = responses
			}

		case "summary":
			summary, err := s.repo.GetAnalyticsSummary(ctx, festivalID, req.StartDate, req.EndDate)
			if err == nil {
				data["summary"] = summary
			}

		case "funnels":
			funnels, err := s.GetAllFunnels(ctx, festivalID, req.StartDate, req.EndDate)
			if err == nil {
				data["funnels"] = funnels
			}

		case "predictions":
			predictions, err := s.GetPredictions(ctx, festivalID)
			if err == nil {
				data["predictions"] = predictions
			}
		}
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	return os.WriteFile(export.FileURL, jsonData, 0644)
}

// GetExport retrieves an export by ID
func (s *AnalyticsService) GetExport(ctx context.Context, exportID uuid.UUID) (*AnalyticsExport, error) {
	return s.repo.GetExport(ctx, exportID)
}

// GetExports retrieves all exports for a festival
func (s *AnalyticsService) GetExports(ctx context.Context, festivalID uuid.UUID) ([]AnalyticsExport, error) {
	return s.repo.GetExportsByFestival(ctx, festivalID)
}

// ==================== Summary & Real-Time ====================

// GetAnalyticsSummary retrieves analytics summary
func (s *AnalyticsService) GetAnalyticsSummary(ctx context.Context, festivalID uuid.UUID, start, end time.Time) (*AnalyticsSummary, error) {
	if err := s.verifyFestival(ctx, festivalID); err != nil {
		return nil, err
	}

	return s.repo.GetAnalyticsSummary(ctx, festivalID, start, end)
}

// GetRealTimeMetrics retrieves current real-time metrics
func (s *AnalyticsService) GetRealTimeMetrics(ctx context.Context, festivalID uuid.UUID) (*RealTimeMetrics, error) {
	if err := s.verifyFestival(ctx, festivalID); err != nil {
		return nil, err
	}

	return s.repo.GetRealTimeMetrics(ctx, festivalID)
}

// ==================== Key Metrics ====================

// GetTicketConversionRate calculates ticket view to purchase conversion
func (s *AnalyticsService) GetTicketConversionRate(ctx context.Context, festivalID uuid.UUID, start, end time.Time) (float64, error) {
	views, _ := s.repo.GetEventCount(ctx, festivalID, EventTypeTicketView, start, end)
	purchases, _ := s.repo.GetEventCount(ctx, festivalID, EventTypeTicketBuy, start, end)

	if views == 0 {
		return 0, nil
	}

	return math.Round(float64(purchases)/float64(views)*10000) / 100, nil // 2 decimal places
}

// GetAverageSpendPerVisitor calculates average spending per checked-in visitor
func (s *AnalyticsService) GetAverageSpendPerVisitor(ctx context.Context, festivalID uuid.UUID) (float64, error) {
	stats, err := s.statsRepo.GetFestivalStats(ctx, festivalID, TimeframeAll)
	if err != nil {
		return 0, err
	}

	if stats.TicketsCheckedIn == 0 {
		return 0, nil
	}

	return float64(stats.TotalPurchases) / float64(stats.TicketsCheckedIn), nil
}

// GetPeakTimes returns the busiest hours/locations
func (s *AnalyticsService) GetPeakTimes(ctx context.Context, festivalID uuid.UUID, start, end time.Time) (*Heatmap, error) {
	return s.repo.GetTimeHeatmap(ctx, festivalID, start, end)
}

// GetRetentionRate calculates retention between festival editions
func (s *AnalyticsService) GetRetentionRate(ctx context.Context, festivalID uuid.UUID) (float64, error) {
	// This would require data from previous festival editions
	// For now, return a calculated value based on returning users
	summary, err := s.repo.GetAnalyticsSummary(ctx, festivalID, time.Now().AddDate(-1, 0, 0), time.Now())
	if err != nil {
		return 0, err
	}

	// Simplified: users with multiple sessions are considered "retained"
	if summary.UniqueUsers == 0 {
		return 0, nil
	}

	// Calculate retention as sessions per user (more sessions = better retention signal)
	avgSessions := float64(summary.UniqueSessions) / float64(summary.UniqueUsers)
	retention := math.Min(avgSessions/3.0*100, 100) // Cap at 100%

	return math.Round(retention*100) / 100, nil
}

// ==================== Helpers ====================

func (s *AnalyticsService) verifyFestival(ctx context.Context, festivalID uuid.UUID) error {
	var exists bool
	if err := s.db.WithContext(ctx).Raw(
		"SELECT EXISTS(SELECT 1 FROM public.festivals WHERE id = ?)",
		festivalID,
	).Scan(&exists).Error; err != nil {
		return fmt.Errorf("failed to verify festival: %w", err)
	}
	if !exists {
		return errors.ErrFestivalNotFound
	}
	return nil
}
