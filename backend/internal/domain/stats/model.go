package stats

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Timeframe represents the time period for stats aggregation
type Timeframe string

const (
	TimeframeToday Timeframe = "TODAY"
	TimeframeWeek  Timeframe = "WEEK"
	TimeframeMonth Timeframe = "MONTH"
	TimeframeAll   Timeframe = "ALL"
)

// ParseTimeframe converts a string to Timeframe, defaults to TODAY if invalid
func ParseTimeframe(s string) Timeframe {
	switch s {
	case "TODAY", "today":
		return TimeframeToday
	case "WEEK", "week":
		return TimeframeWeek
	case "MONTH", "month":
		return TimeframeMonth
	case "ALL", "all":
		return TimeframeAll
	default:
		return TimeframeToday
	}
}

// GetStartTime returns the start time for a given timeframe
func (t Timeframe) GetStartTime() time.Time {
	now := time.Now()
	switch t {
	case TimeframeToday:
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	case TimeframeWeek:
		return now.AddDate(0, 0, -7)
	case TimeframeMonth:
		return now.AddDate(0, -1, 0)
	case TimeframeAll:
		return time.Time{} // Zero time means no filter
	default:
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	}
}

// FestivalStats represents aggregated statistics for a festival
type FestivalStats struct {
	FestivalID          uuid.UUID `json:"festivalId"`
	TotalRevenue        int64     `json:"totalRevenue"`        // Total revenue in cents
	TotalRevenueDisplay string    `json:"totalRevenueDisplay"` // Formatted revenue
	TicketsSold         int       `json:"ticketsSold"`         // Total tickets sold
	TicketsCheckedIn    int       `json:"ticketsCheckedIn"`    // Tickets that have been scanned
	TotalWallets        int       `json:"totalWallets"`        // Total wallets created
	ActiveWallets       int       `json:"activeWallets"`       // Wallets with balance > 0
	TotalTransactions   int       `json:"totalTransactions"`   // Total number of transactions
	TotalTopUps         int64     `json:"totalTopUps"`         // Total top-up amount in cents
	TotalPurchases      int64     `json:"totalPurchases"`      // Total purchase amount in cents
	AverageTransaction  int64     `json:"averageTransaction"`  // Average transaction amount
	TotalStands         int       `json:"totalStands"`         // Number of stands
	ActiveStands        int       `json:"activeStands"`        // Stands with transactions
	Timeframe           Timeframe `json:"timeframe"`
	GeneratedAt         time.Time `json:"generatedAt"`
}

// FestivalStatsResponse is the API response for festival stats
type FestivalStatsResponse struct {
	FestivalID          uuid.UUID `json:"festivalId"`
	TotalRevenue        int64     `json:"totalRevenue"`
	TotalRevenueDisplay string    `json:"totalRevenueDisplay"`
	TicketsSold         int       `json:"ticketsSold"`
	TicketsCheckedIn    int       `json:"ticketsCheckedIn"`
	CheckInRate         float64   `json:"checkInRate"` // Percentage of tickets checked in
	TotalWallets        int       `json:"totalWallets"`
	ActiveWallets       int       `json:"activeWallets"`
	TotalTransactions   int       `json:"totalTransactions"`
	TotalTopUps         int64     `json:"totalTopUps"`
	TotalTopUpsDisplay  string    `json:"totalTopUpsDisplay"`
	TotalPurchases      int64     `json:"totalPurchases"`
	TotalPurchasesDisplay string  `json:"totalPurchasesDisplay"`
	AverageTransaction  int64     `json:"averageTransaction"`
	AverageTransactionDisplay string `json:"averageTransactionDisplay"`
	TotalStands         int       `json:"totalStands"`
	ActiveStands        int       `json:"activeStands"`
	Timeframe           string    `json:"timeframe"`
	GeneratedAt         string    `json:"generatedAt"`
}

// ToResponse converts FestivalStats to API response format
func (s *FestivalStats) ToResponse() FestivalStatsResponse {
	checkInRate := float64(0)
	if s.TicketsSold > 0 {
		checkInRate = float64(s.TicketsCheckedIn) / float64(s.TicketsSold) * 100
	}

	return FestivalStatsResponse{
		FestivalID:          s.FestivalID,
		TotalRevenue:        s.TotalRevenue,
		TotalRevenueDisplay: formatCurrency(s.TotalRevenue),
		TicketsSold:         s.TicketsSold,
		TicketsCheckedIn:    s.TicketsCheckedIn,
		CheckInRate:         checkInRate,
		TotalWallets:        s.TotalWallets,
		ActiveWallets:       s.ActiveWallets,
		TotalTransactions:   s.TotalTransactions,
		TotalTopUps:         s.TotalTopUps,
		TotalTopUpsDisplay:  formatCurrency(s.TotalTopUps),
		TotalPurchases:      s.TotalPurchases,
		TotalPurchasesDisplay: formatCurrency(s.TotalPurchases),
		AverageTransaction:  s.AverageTransaction,
		AverageTransactionDisplay: formatCurrency(s.AverageTransaction),
		TotalStands:         s.TotalStands,
		ActiveStands:        s.ActiveStands,
		Timeframe:           string(s.Timeframe),
		GeneratedAt:         s.GeneratedAt.Format(time.RFC3339),
	}
}

// DailyStats represents statistics for a single day
type DailyStats struct {
	Date              time.Time `json:"date"`
	Revenue           int64     `json:"revenue"`           // Revenue in cents
	Transactions      int       `json:"transactions"`      // Number of transactions
	NewWallets        int       `json:"newWallets"`        // New wallets created
	TopUps            int64     `json:"topUps"`            // Top-up amount in cents
	Purchases         int64     `json:"purchases"`         // Purchase amount in cents
	UniqueCustomers   int       `json:"uniqueCustomers"`   // Unique wallets with transactions
	TicketsSold       int       `json:"ticketsSold"`       // Tickets sold this day
	TicketsCheckedIn  int       `json:"ticketsCheckedIn"`  // Tickets checked in this day
}

// DailyStatsResponse is the API response for daily stats
type DailyStatsResponse struct {
	Date              string  `json:"date"`
	Revenue           int64   `json:"revenue"`
	RevenueDisplay    string  `json:"revenueDisplay"`
	Transactions      int     `json:"transactions"`
	NewWallets        int     `json:"newWallets"`
	TopUps            int64   `json:"topUps"`
	TopUpsDisplay     string  `json:"topUpsDisplay"`
	Purchases         int64   `json:"purchases"`
	PurchasesDisplay  string  `json:"purchasesDisplay"`
	UniqueCustomers   int     `json:"uniqueCustomers"`
	TicketsSold       int     `json:"ticketsSold"`
	TicketsCheckedIn  int     `json:"ticketsCheckedIn"`
}

// ToResponse converts DailyStats to API response format
func (d *DailyStats) ToResponse() DailyStatsResponse {
	return DailyStatsResponse{
		Date:              d.Date.Format("2006-01-02"),
		Revenue:           d.Revenue,
		RevenueDisplay:    formatCurrency(d.Revenue),
		Transactions:      d.Transactions,
		NewWallets:        d.NewWallets,
		TopUps:            d.TopUps,
		TopUpsDisplay:     formatCurrency(d.TopUps),
		Purchases:         d.Purchases,
		PurchasesDisplay:  formatCurrency(d.Purchases),
		UniqueCustomers:   d.UniqueCustomers,
		TicketsSold:       d.TicketsSold,
		TicketsCheckedIn:  d.TicketsCheckedIn,
	}
}

// StandStats represents statistics for a specific stand
type StandStats struct {
	StandID           uuid.UUID      `json:"standId"`
	StandName         string         `json:"standName"`
	Revenue           int64          `json:"revenue"`           // Revenue in cents
	Transactions      int            `json:"transactions"`      // Number of transactions
	AverageTransaction int64         `json:"averageTransaction"`// Average transaction amount
	UniqueCustomers   int            `json:"uniqueCustomers"`   // Unique wallets
	TopProducts       []ProductStats `json:"topProducts"`       // Top selling products
	Timeframe         Timeframe      `json:"timeframe"`
}

// StandStatsResponse is the API response for stand stats
type StandStatsResponse struct {
	StandID             uuid.UUID             `json:"standId"`
	StandName           string                `json:"standName"`
	Revenue             int64                 `json:"revenue"`
	RevenueDisplay      string                `json:"revenueDisplay"`
	Transactions        int                   `json:"transactions"`
	AverageTransaction  int64                 `json:"averageTransaction"`
	AverageTransactionDisplay string          `json:"averageTransactionDisplay"`
	UniqueCustomers     int                   `json:"uniqueCustomers"`
	TopProducts         []ProductStatsResponse `json:"topProducts"`
	Timeframe           string                `json:"timeframe"`
}

// ToResponse converts StandStats to API response format
func (s *StandStats) ToResponse() StandStatsResponse {
	topProducts := make([]ProductStatsResponse, len(s.TopProducts))
	for i, p := range s.TopProducts {
		topProducts[i] = p.ToResponse()
	}

	return StandStatsResponse{
		StandID:            s.StandID,
		StandName:          s.StandName,
		Revenue:            s.Revenue,
		RevenueDisplay:     formatCurrency(s.Revenue),
		Transactions:       s.Transactions,
		AverageTransaction: s.AverageTransaction,
		AverageTransactionDisplay: formatCurrency(s.AverageTransaction),
		UniqueCustomers:    s.UniqueCustomers,
		TopProducts:        topProducts,
		Timeframe:          string(s.Timeframe),
	}
}

// ProductStats represents statistics for a product
type ProductStats struct {
	ProductID    uuid.UUID `json:"productId"`
	ProductName  string    `json:"productName"`
	StandID      uuid.UUID `json:"standId"`
	StandName    string    `json:"standName,omitempty"`
	QuantitySold int       `json:"quantitySold"`
	Revenue      int64     `json:"revenue"` // Revenue in cents
	UnitPrice    int64     `json:"unitPrice"`
}

// ProductStatsResponse is the API response for product stats
type ProductStatsResponse struct {
	ProductID      uuid.UUID `json:"productId"`
	ProductName    string    `json:"productName"`
	StandID        uuid.UUID `json:"standId"`
	StandName      string    `json:"standName,omitempty"`
	QuantitySold   int       `json:"quantitySold"`
	Revenue        int64     `json:"revenue"`
	RevenueDisplay string    `json:"revenueDisplay"`
	UnitPrice      int64     `json:"unitPrice"`
	UnitPriceDisplay string  `json:"unitPriceDisplay"`
}

// ToResponse converts ProductStats to API response format
func (p *ProductStats) ToResponse() ProductStatsResponse {
	return ProductStatsResponse{
		ProductID:      p.ProductID,
		ProductName:    p.ProductName,
		StandID:        p.StandID,
		StandName:      p.StandName,
		QuantitySold:   p.QuantitySold,
		Revenue:        p.Revenue,
		RevenueDisplay: formatCurrency(p.Revenue),
		UnitPrice:      p.UnitPrice,
		UnitPriceDisplay: formatCurrency(p.UnitPrice),
	}
}

// StaffPerformance represents statistics for a staff member
type StaffPerformance struct {
	StaffID           uuid.UUID `json:"staffId"`
	StaffName         string    `json:"staffName"`
	Transactions      int       `json:"transactions"`
	TotalAmount       int64     `json:"totalAmount"`
	AverageAmount     int64     `json:"averageAmount"`
	StandID           uuid.UUID `json:"standId"`
	StandName         string    `json:"standName"`
}

// StaffPerformanceResponse is the API response for staff performance
type StaffPerformanceResponse struct {
	StaffID              uuid.UUID `json:"staffId"`
	StaffName            string    `json:"staffName"`
	Transactions         int       `json:"transactions"`
	TotalAmount          int64     `json:"totalAmount"`
	TotalAmountDisplay   string    `json:"totalAmountDisplay"`
	AverageAmount        int64     `json:"averageAmount"`
	AverageAmountDisplay string    `json:"averageAmountDisplay"`
	StandID              uuid.UUID `json:"standId"`
	StandName            string    `json:"standName"`
}

// ToResponse converts StaffPerformance to API response format
func (sp *StaffPerformance) ToResponse() StaffPerformanceResponse {
	return StaffPerformanceResponse{
		StaffID:              sp.StaffID,
		StaffName:            sp.StaffName,
		Transactions:         sp.Transactions,
		TotalAmount:          sp.TotalAmount,
		TotalAmountDisplay:   formatCurrency(sp.TotalAmount),
		AverageAmount:        sp.AverageAmount,
		AverageAmountDisplay: formatCurrency(sp.AverageAmount),
		StandID:              sp.StandID,
		StandName:            sp.StandName,
	}
}

// RecentTransaction represents a recent transaction for display
type RecentTransaction struct {
	ID          uuid.UUID `json:"id"`
	Type        string    `json:"type"`
	Amount      int64     `json:"amount"`
	StandID     *uuid.UUID `json:"standId,omitempty"`
	StandName   string    `json:"standName,omitempty"`
	StaffID     *uuid.UUID `json:"staffId,omitempty"`
	StaffName   string    `json:"staffName,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

// RecentTransactionResponse is the API response for recent transactions
type RecentTransactionResponse struct {
	ID            uuid.UUID  `json:"id"`
	Type          string     `json:"type"`
	Amount        int64      `json:"amount"`
	AmountDisplay string     `json:"amountDisplay"`
	StandID       *uuid.UUID `json:"standId,omitempty"`
	StandName     string     `json:"standName,omitempty"`
	StaffID       *uuid.UUID `json:"staffId,omitempty"`
	StaffName     string     `json:"staffName,omitempty"`
	CreatedAt     string     `json:"createdAt"`
}

// ToResponse converts RecentTransaction to API response format
func (rt *RecentTransaction) ToResponse() RecentTransactionResponse {
	return RecentTransactionResponse{
		ID:            rt.ID,
		Type:          rt.Type,
		Amount:        rt.Amount,
		AmountDisplay: formatCurrency(rt.Amount),
		StandID:       rt.StandID,
		StandName:     rt.StandName,
		StaffID:       rt.StaffID,
		StaffName:     rt.StaffName,
		CreatedAt:     rt.CreatedAt.Format(time.RFC3339),
	}
}

// RevenueChartData represents revenue data for charting
type RevenueChartData struct {
	Labels   []string `json:"labels"`   // Date labels
	Revenue  []int64  `json:"revenue"`  // Revenue values
	TopUps   []int64  `json:"topUps"`   // Top-up values
	Purchases []int64 `json:"purchases"` // Purchase values
}

// DashboardStats combines multiple stats for dashboard display
type DashboardStats struct {
	Overview           FestivalStatsResponse       `json:"overview"`
	RevenueChart       RevenueChartData            `json:"revenueChart"`
	TopProducts        []ProductStatsResponse      `json:"topProducts"`
	TopStands          []StandStatsResponse        `json:"topStands"`
	RecentTransactions []RecentTransactionResponse `json:"recentTransactions"`
}

// formatCurrency formats cents to a currency display string
func formatCurrency(cents int64) string {
	euros := float64(cents) / 100
	if euros == float64(int64(euros)) {
		return fmt.Sprintf("%.0f EUR", euros)
	}
	return fmt.Sprintf("%.2f EUR", euros)
}

// ==================== Advanced Analytics Models ====================

// EventType represents the type of analytics event
type EventType string

const (
	EventTypePageView     EventType = "PAGE_VIEW"
	EventTypeTicketView   EventType = "TICKET_VIEW"
	EventTypeTicketBuy    EventType = "TICKET_BUY"
	EventTypeCheckIn      EventType = "CHECK_IN"
	EventTypeWalletTopUp  EventType = "WALLET_TOP_UP"
	EventTypePurchase     EventType = "PURCHASE"
	EventTypeStandVisit   EventType = "STAND_VISIT"
	EventTypeMapInteract  EventType = "MAP_INTERACT"
	EventTypeLineupView   EventType = "LINEUP_VIEW"
	EventTypeArtistView   EventType = "ARTIST_VIEW"
	EventTypeNotification EventType = "NOTIFICATION"
	EventTypeShare        EventType = "SHARE"
	EventTypeRefund       EventType = "REFUND"
	EventTypeAppOpen      EventType = "APP_OPEN"
	EventTypeCustom       EventType = "CUSTOM"
)

// AnalyticsEvent represents a tracked user event
type AnalyticsEvent struct {
	ID          uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	FestivalID  uuid.UUID              `json:"festivalId" gorm:"type:uuid;index"`
	UserID      *uuid.UUID             `json:"userId,omitempty" gorm:"type:uuid;index"`
	SessionID   string                 `json:"sessionId" gorm:"index"`
	Type        EventType              `json:"type" gorm:"index"`
	Category    string                 `json:"category"`
	Action      string                 `json:"action"`
	Label       string                 `json:"label,omitempty"`
	Value       float64                `json:"value,omitempty"`
	Data        map[string]interface{} `json:"data,omitempty" gorm:"type:jsonb"`
	DeviceType  string                 `json:"deviceType,omitempty"`
	Platform    string                 `json:"platform,omitempty"`
	AppVersion  string                 `json:"appVersion,omitempty"`
	Latitude    *float64               `json:"latitude,omitempty"`
	Longitude   *float64               `json:"longitude,omitempty"`
	Timestamp   time.Time              `json:"timestamp" gorm:"index"`
	CreatedAt   time.Time              `json:"createdAt"`
}

// AnalyticsEventResponse is the API response for analytics events
type AnalyticsEventResponse struct {
	ID         uuid.UUID              `json:"id"`
	FestivalID uuid.UUID              `json:"festivalId"`
	UserID     *uuid.UUID             `json:"userId,omitempty"`
	SessionID  string                 `json:"sessionId"`
	Type       string                 `json:"type"`
	Category   string                 `json:"category"`
	Action     string                 `json:"action"`
	Label      string                 `json:"label,omitempty"`
	Value      float64                `json:"value,omitempty"`
	Data       map[string]interface{} `json:"data,omitempty"`
	DeviceType string                 `json:"deviceType,omitempty"`
	Platform   string                 `json:"platform,omitempty"`
	Timestamp  string                 `json:"timestamp"`
}

// ToResponse converts AnalyticsEvent to API response
func (e *AnalyticsEvent) ToResponse() AnalyticsEventResponse {
	return AnalyticsEventResponse{
		ID:         e.ID,
		FestivalID: e.FestivalID,
		UserID:     e.UserID,
		SessionID:  e.SessionID,
		Type:       string(e.Type),
		Category:   e.Category,
		Action:     e.Action,
		Label:      e.Label,
		Value:      e.Value,
		Data:       e.Data,
		DeviceType: e.DeviceType,
		Platform:   e.Platform,
		Timestamp:  e.Timestamp.Format(time.RFC3339),
	}
}

// CreateAnalyticsEventRequest is the request to create an analytics event
type CreateAnalyticsEventRequest struct {
	Type       EventType              `json:"type" binding:"required"`
	Category   string                 `json:"category" binding:"required"`
	Action     string                 `json:"action" binding:"required"`
	Label      string                 `json:"label,omitempty"`
	Value      float64                `json:"value,omitempty"`
	Data       map[string]interface{} `json:"data,omitempty"`
	SessionID  string                 `json:"sessionId" binding:"required"`
	DeviceType string                 `json:"deviceType,omitempty"`
	Platform   string                 `json:"platform,omitempty"`
	AppVersion string                 `json:"appVersion,omitempty"`
	Latitude   *float64               `json:"latitude,omitempty"`
	Longitude  *float64               `json:"longitude,omitempty"`
	Timestamp  *time.Time             `json:"timestamp,omitempty"`
}

// FunnelStep represents a single step in a funnel
type FunnelStep struct {
	Name       string  `json:"name"`
	EventType  string  `json:"eventType"`
	Count      int64   `json:"count"`
	Percentage float64 `json:"percentage"` // Percentage from previous step
}

// Funnel represents a conversion funnel analysis
type Funnel struct {
	ID             uuid.UUID    `json:"id"`
	FestivalID     uuid.UUID    `json:"festivalId"`
	Name           string       `json:"name"`
	Description    string       `json:"description,omitempty"`
	Steps          []FunnelStep `json:"steps"`
	TotalStarted   int64        `json:"totalStarted"`   // Users who started the funnel
	TotalCompleted int64        `json:"totalCompleted"` // Users who completed all steps
	ConversionRate float64      `json:"conversionRate"` // Overall conversion rate
	AverageTime    float64      `json:"averageTime"`    // Average time to complete (seconds)
	DropOffStep    int          `json:"dropOffStep"`    // Step with highest drop-off
	Period         string       `json:"period"`         // Time period analyzed
	CreatedAt      time.Time    `json:"createdAt"`
}

// FunnelDefinition defines the steps for a funnel
type FunnelDefinition struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	FestivalID  uuid.UUID `json:"festivalId" gorm:"type:uuid;index"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Steps       []string  `json:"steps" gorm:"type:jsonb"` // Ordered list of event types
	IsActive    bool      `json:"isActive" gorm:"default:true"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// PredefinedFunnels returns common funnel definitions for festivals
func PredefinedFunnels() []struct {
	Name        string
	Description string
	Steps       []EventType
} {
	return []struct {
		Name        string
		Description string
		Steps       []EventType
	}{
		{
			Name:        "ticket_purchase",
			Description: "Ticket purchase funnel from view to purchase",
			Steps:       []EventType{EventTypePageView, EventTypeTicketView, EventTypeTicketBuy},
		},
		{
			Name:        "check_in",
			Description: "Check-in flow from ticket purchase to entry",
			Steps:       []EventType{EventTypeTicketBuy, EventTypeAppOpen, EventTypeCheckIn},
		},
		{
			Name:        "wallet_usage",
			Description: "Wallet activation and first purchase",
			Steps:       []EventType{EventTypeCheckIn, EventTypeWalletTopUp, EventTypePurchase},
		},
		{
			Name:        "engagement",
			Description: "Full engagement funnel",
			Steps:       []EventType{EventTypeTicketBuy, EventTypeCheckIn, EventTypeLineupView, EventTypePurchase},
		},
	}
}

// CohortPeriod represents the period for cohort analysis
type CohortPeriod string

const (
	CohortPeriodDaily   CohortPeriod = "DAILY"
	CohortPeriodWeekly  CohortPeriod = "WEEKLY"
	CohortPeriodMonthly CohortPeriod = "MONTHLY"
)

// CohortMetric represents metrics for a cohort over time
type CohortMetric struct {
	Period        int     `json:"period"`        // 0 = same period, 1 = next period, etc.
	Value         float64 `json:"value"`         // The metric value
	Count         int64   `json:"count"`         // Number of users/events
	RetentionRate float64 `json:"retentionRate"` // Percentage retained from period 0
}

// Cohort represents a cohort analysis result
type Cohort struct {
	ID              uuid.UUID      `json:"id"`
	FestivalID      uuid.UUID      `json:"festivalId"`
	Name            string         `json:"name"`           // e.g., "Ticket Purchase Cohort"
	GroupBy         string         `json:"groupBy"`        // e.g., "ticket_purchase_date"
	Metric          string         `json:"metric"`         // e.g., "retention", "revenue", "transactions"
	Period          CohortPeriod   `json:"period"`         // Daily, Weekly, Monthly
	CohortDate      time.Time      `json:"cohortDate"`     // Start date of this cohort
	CohortSize      int64          `json:"cohortSize"`     // Number of users in cohort
	Metrics         []CohortMetric `json:"metrics"`        // Metrics over time
	TotalRevenue    int64          `json:"totalRevenue"`   // Total revenue from this cohort
	AverageRevenue  float64        `json:"averageRevenue"` // Average revenue per user
	RetentionCurve  []float64      `json:"retentionCurve"` // Retention % over time
	LifetimeValue   float64        `json:"lifetimeValue"`  // Estimated LTV
	CreatedAt       time.Time      `json:"createdAt"`
}

// CohortAnalysis represents full cohort analysis with multiple cohorts
type CohortAnalysis struct {
	FestivalID      uuid.UUID `json:"festivalId"`
	Name            string    `json:"name"`
	Description     string    `json:"description,omitempty"`
	GroupBy         string    `json:"groupBy"`
	Metric          string    `json:"metric"`
	Period          string    `json:"period"`
	Cohorts         []Cohort  `json:"cohorts"`
	Summary         CohortSummary `json:"summary"`
	GeneratedAt     time.Time `json:"generatedAt"`
}

// CohortSummary provides aggregate statistics across cohorts
type CohortSummary struct {
	TotalUsers           int64   `json:"totalUsers"`
	AverageRetention     float64 `json:"averageRetention"`     // Average retention at end of period
	AverageLifetimeValue float64 `json:"averageLifetimeValue"`
	BestCohort           string  `json:"bestCohort"`           // Cohort with best retention
	WorstCohort          string  `json:"worstCohort"`          // Cohort with worst retention
	TrendDirection       string  `json:"trendDirection"`       // "improving", "declining", "stable"
}

// HeatmapType represents the type of heatmap data
type HeatmapType string

const (
	HeatmapTypeLocation    HeatmapType = "LOCATION"    // Physical location on festival grounds
	HeatmapTypeTime        HeatmapType = "TIME"        // Time-based activity
	HeatmapTypeSpending    HeatmapType = "SPENDING"    // Spending patterns
	HeatmapTypeTraffic     HeatmapType = "TRAFFIC"     // Traffic flow
	HeatmapTypeEngagement  HeatmapType = "ENGAGEMENT"  // User engagement
)

// HeatmapPoint represents a single point in a heatmap
type HeatmapPoint struct {
	X         float64 `json:"x"`         // X coordinate or hour (0-23)
	Y         float64 `json:"y"`         // Y coordinate or day (0-6)
	Value     float64 `json:"value"`     // Intensity value
	Count     int64   `json:"count"`     // Number of events
	Label     string  `json:"label,omitempty"` // Optional label
	LocationID *uuid.UUID `json:"locationId,omitempty"` // Associated location (stand, stage, etc.)
}

// Heatmap represents heatmap data for visualization
type Heatmap struct {
	ID          uuid.UUID      `json:"id"`
	FestivalID  uuid.UUID      `json:"festivalId"`
	Type        HeatmapType    `json:"type"`
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	Points      []HeatmapPoint `json:"points"`
	MinValue    float64        `json:"minValue"`
	MaxValue    float64        `json:"maxValue"`
	Unit        string         `json:"unit"` // e.g., "visitors", "EUR", "transactions"
	GridWidth   int            `json:"gridWidth,omitempty"`  // For location heatmaps
	GridHeight  int            `json:"gridHeight,omitempty"` // For location heatmaps
	TimeStart   time.Time      `json:"timeStart,omitempty"`
	TimeEnd     time.Time      `json:"timeEnd,omitempty"`
	GeneratedAt time.Time      `json:"generatedAt"`
}

// HeatmapRequest specifies parameters for heatmap generation
type HeatmapRequest struct {
	Type       HeatmapType `json:"type" binding:"required"`
	StartDate  *time.Time  `json:"startDate,omitempty"`
	EndDate    *time.Time  `json:"endDate,omitempty"`
	Resolution string      `json:"resolution,omitempty"` // "hour", "day", "meter"
	FilterBy   string      `json:"filterBy,omitempty"`   // Filter by stand, stage, etc.
	FilterID   *uuid.UUID  `json:"filterId,omitempty"`
}

// UserJourneyStep represents a step in a user's journey
type UserJourneyStep struct {
	Timestamp   time.Time   `json:"timestamp"`
	EventType   EventType   `json:"eventType"`
	Category    string      `json:"category"`
	Action      string      `json:"action"`
	Label       string      `json:"label,omitempty"`
	Value       float64     `json:"value,omitempty"`
	Location    string      `json:"location,omitempty"` // Stand name, stage name, etc.
	LocationID  *uuid.UUID  `json:"locationId,omitempty"`
	Duration    int64       `json:"duration,omitempty"` // Seconds until next step
}

// UserJourney represents a complete user journey through the festival
type UserJourney struct {
	UserID           uuid.UUID         `json:"userId"`
	FestivalID       uuid.UUID         `json:"festivalId"`
	SessionCount     int               `json:"sessionCount"`
	FirstSeen        time.Time         `json:"firstSeen"`
	LastSeen         time.Time         `json:"lastSeen"`
	TotalEvents      int               `json:"totalEvents"`
	TotalSpent       int64             `json:"totalSpent"`
	TotalSpentDisplay string           `json:"totalSpentDisplay"`
	Steps            []UserJourneyStep `json:"steps"`
	TopLocations     []string          `json:"topLocations"`     // Most visited locations
	KeyMoments       []UserJourneyStep `json:"keyMoments"`       // Important events (purchases, check-in)
	EngagementScore  float64           `json:"engagementScore"`  // 0-100 score
	CustomerType     string            `json:"customerType"`     // "new", "returning", "vip"
}

// PredictionType represents the type of prediction
type PredictionType string

const (
	PredictionTypeRevenue      PredictionType = "REVENUE"
	PredictionTypeAttendance   PredictionType = "ATTENDANCE"
	PredictionTypeDemand       PredictionType = "DEMAND"
	PredictionTypeCrowdDensity PredictionType = "CROWD_DENSITY"
	PredictionTypeWaitTime     PredictionType = "WAIT_TIME"
)

// Prediction represents a ML-based prediction
type Prediction struct {
	ID              uuid.UUID         `json:"id"`
	FestivalID      uuid.UUID         `json:"festivalId"`
	Type            PredictionType    `json:"type"`
	Name            string            `json:"name"`
	Description     string            `json:"description,omitempty"`
	PredictedValue  float64           `json:"predictedValue"`
	Unit            string            `json:"unit"`
	Confidence      float64           `json:"confidence"`       // 0-1 confidence score
	ConfidenceLevel string            `json:"confidenceLevel"`  // "low", "medium", "high"
	LowerBound      float64           `json:"lowerBound"`       // Lower confidence interval
	UpperBound      float64           `json:"upperBound"`       // Upper confidence interval
	PredictedAt     time.Time         `json:"predictedAt"`      // When prediction was made
	ValidUntil      time.Time         `json:"validUntil"`       // When prediction expires
	TargetDate      time.Time         `json:"targetDate"`       // What date/time this predicts
	Factors         []PredictionFactor `json:"factors"`         // Contributing factors
	Historical      []HistoricalPoint  `json:"historical"`      // Historical data for comparison
	Trend           string            `json:"trend"`            // "up", "down", "stable"
	PercentChange   float64           `json:"percentChange"`    // Change from previous period
}

// PredictionFactor represents a factor contributing to a prediction
type PredictionFactor struct {
	Name        string  `json:"name"`
	Impact      float64 `json:"impact"`      // -1 to 1, negative = reduces, positive = increases
	Description string  `json:"description"`
	Category    string  `json:"category"`    // "weather", "historical", "external", etc.
}

// HistoricalPoint represents a historical data point for comparison
type HistoricalPoint struct {
	Date  time.Time `json:"date"`
	Value float64   `json:"value"`
	Label string    `json:"label,omitempty"`
}

// Predictions contains all predictions for a festival
type Predictions struct {
	FestivalID       uuid.UUID    `json:"festivalId"`
	Revenue          *Prediction  `json:"revenue,omitempty"`
	Attendance       *Prediction  `json:"attendance,omitempty"`
	PeakHours        []Prediction `json:"peakHours,omitempty"`
	StandDemand      []Prediction `json:"standDemand,omitempty"`
	Recommendations  []Recommendation `json:"recommendations,omitempty"`
	GeneratedAt      time.Time    `json:"generatedAt"`
}

// Recommendation represents an actionable recommendation from ML analysis
type Recommendation struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Category    string    `json:"category"` // "staffing", "inventory", "pricing", "operations"
	Priority    string    `json:"priority"` // "low", "medium", "high", "critical"
	Impact      string    `json:"impact"`   // Expected impact description
	ActionItems []string  `json:"actionItems"`
	Deadline    *time.Time `json:"deadline,omitempty"`
	Metrics     map[string]interface{} `json:"metrics,omitempty"` // Supporting metrics
}

// AnalyticsExportFormat represents the export format
type AnalyticsExportFormat string

const (
	ExportFormatCSV   AnalyticsExportFormat = "CSV"
	ExportFormatJSON  AnalyticsExportFormat = "JSON"
	ExportFormatExcel AnalyticsExportFormat = "EXCEL"
	ExportFormatPDF   AnalyticsExportFormat = "PDF"
)

// AnalyticsExportRequest represents a request to export analytics data
type AnalyticsExportRequest struct {
	Format      AnalyticsExportFormat `json:"format" binding:"required"`
	DataTypes   []string              `json:"dataTypes" binding:"required"` // ["events", "funnels", "cohorts", etc.]
	StartDate   time.Time             `json:"startDate" binding:"required"`
	EndDate     time.Time             `json:"endDate" binding:"required"`
	Filters     map[string]interface{} `json:"filters,omitempty"`
	IncludeRaw  bool                  `json:"includeRaw,omitempty"`  // Include raw event data
	Granularity string                `json:"granularity,omitempty"` // "hour", "day", "week"
}

// AnalyticsExport represents an exported analytics file
type AnalyticsExport struct {
	ID          uuid.UUID             `json:"id"`
	FestivalID  uuid.UUID             `json:"festivalId"`
	Format      AnalyticsExportFormat `json:"format"`
	FileName    string                `json:"fileName"`
	FileURL     string                `json:"fileUrl"`
	FileSize    int64                 `json:"fileSize"`
	DataTypes   []string              `json:"dataTypes"`
	StartDate   time.Time             `json:"startDate"`
	EndDate     time.Time             `json:"endDate"`
	Status      string                `json:"status"` // "pending", "processing", "completed", "failed"
	Error       string                `json:"error,omitempty"`
	CreatedAt   time.Time             `json:"createdAt"`
	ExpiresAt   time.Time             `json:"expiresAt"`
}

// AnalyticsSummary provides a high-level summary of analytics
type AnalyticsSummary struct {
	FestivalID          uuid.UUID `json:"festivalId"`
	TotalEvents         int64     `json:"totalEvents"`
	UniqueUsers         int64     `json:"uniqueUsers"`
	UniqueSessions      int64     `json:"uniqueSessions"`
	AverageSessionDuration float64 `json:"averageSessionDuration"` // Seconds
	BounceRate          float64   `json:"bounceRate"`              // Percentage
	ConversionRate      float64   `json:"conversionRate"`          // Ticket view to purchase
	EngagementRate      float64   `json:"engagementRate"`          // Active users / total users
	TopEvents           []EventTypeCount `json:"topEvents"`
	TopDevices          []DeviceCount    `json:"topDevices"`
	TopPlatforms        []PlatformCount  `json:"topPlatforms"`
	Period              string    `json:"period"`
	GeneratedAt         time.Time `json:"generatedAt"`
}

// EventTypeCount represents event type with count
type EventTypeCount struct {
	Type       string  `json:"type"`
	Count      int64   `json:"count"`
	Percentage float64 `json:"percentage"`
}

// DeviceCount represents device type with count
type DeviceCount struct {
	Device     string  `json:"device"`
	Count      int64   `json:"count"`
	Percentage float64 `json:"percentage"`
}

// PlatformCount represents platform with count
type PlatformCount struct {
	Platform   string  `json:"platform"`
	Count      int64   `json:"count"`
	Percentage float64 `json:"percentage"`
}

// RealTimeMetrics represents real-time analytics metrics
type RealTimeMetrics struct {
	FestivalID        uuid.UUID `json:"festivalId"`
	ActiveUsers       int64     `json:"activeUsers"`       // Users active in last 5 minutes
	EventsPerMinute   float64   `json:"eventsPerMinute"`   // Current event rate
	TransactionsNow   int64     `json:"transactionsNow"`   // Transactions in last minute
	RevenueLastHour   int64     `json:"revenueLastHour"`
	TopStandNow       string    `json:"topStandNow"`       // Busiest stand right now
	QueueAlerts       []string  `json:"queueAlerts"`       // Stands with long queues
	Timestamp         time.Time `json:"timestamp"`
}
