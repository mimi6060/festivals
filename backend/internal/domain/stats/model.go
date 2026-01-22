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
