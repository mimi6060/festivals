package reports

import (
	"time"

	"github.com/google/uuid"
)

// ReportType represents the type of report to generate
type ReportType string

const (
	ReportTypeTransactions     ReportType = "TRANSACTIONS"
	ReportTypeSales            ReportType = "SALES"
	ReportTypeTickets          ReportType = "TICKETS"
	ReportTypeWallets          ReportType = "WALLETS"
	ReportTypeStaffPerformance ReportType = "STAFF_PERFORMANCE"
)

// IsValid checks if the report type is valid
func (rt ReportType) IsValid() bool {
	switch rt {
	case ReportTypeTransactions, ReportTypeSales, ReportTypeTickets,
		ReportTypeWallets, ReportTypeStaffPerformance:
		return true
	}
	return false
}

// ReportFormat represents the output format for the report
type ReportFormat string

const (
	ReportFormatCSV  ReportFormat = "CSV"
	ReportFormatXLSX ReportFormat = "XLSX"
	ReportFormatPDF  ReportFormat = "PDF"
)

// IsValid checks if the report format is valid
func (rf ReportFormat) IsValid() bool {
	switch rf {
	case ReportFormatCSV, ReportFormatXLSX, ReportFormatPDF:
		return true
	}
	return false
}

// GetContentType returns the MIME type for the format
func (rf ReportFormat) GetContentType() string {
	switch rf {
	case ReportFormatCSV:
		return "text/csv"
	case ReportFormatXLSX:
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case ReportFormatPDF:
		return "application/pdf"
	default:
		return "application/octet-stream"
	}
}

// GetFileExtension returns the file extension for the format
func (rf ReportFormat) GetFileExtension() string {
	switch rf {
	case ReportFormatCSV:
		return ".csv"
	case ReportFormatXLSX:
		return ".xlsx"
	case ReportFormatPDF:
		return ".pdf"
	default:
		return ""
	}
}

// ReportStatus represents the status of a report generation job
type ReportStatus string

const (
	ReportStatusPending    ReportStatus = "PENDING"
	ReportStatusProcessing ReportStatus = "PROCESSING"
	ReportStatusCompleted  ReportStatus = "COMPLETED"
	ReportStatusFailed     ReportStatus = "FAILED"
)

// DateRange represents a date range filter for reports
type DateRange struct {
	StartDate time.Time `json:"startDate"`
	EndDate   time.Time `json:"endDate"`
}

// ReportFilters represents optional filters for report generation
type ReportFilters struct {
	StandIDs     []uuid.UUID `json:"standIds,omitempty"`
	StaffIDs     []uuid.UUID `json:"staffIds,omitempty"`
	TicketTypes  []uuid.UUID `json:"ticketTypes,omitempty"`
	Status       []string    `json:"status,omitempty"`
	MinAmount    *int64      `json:"minAmount,omitempty"`
	MaxAmount    *int64      `json:"maxAmount,omitempty"`
}

// ReportRequest represents a request to generate a report
type ReportRequest struct {
	Type       ReportType    `json:"type" binding:"required"`
	Format     ReportFormat  `json:"format" binding:"required"`
	DateRange  *DateRange    `json:"dateRange,omitempty"`
	Filters    *ReportFilters `json:"filters,omitempty"`
}

// Report represents a report record stored in the database
type Report struct {
	ID          uuid.UUID     `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID  uuid.UUID     `json:"festivalId" gorm:"type:uuid;not null;index"`
	RequestedBy uuid.UUID     `json:"requestedBy" gorm:"type:uuid;not null"`
	Type        ReportType    `json:"type" gorm:"not null"`
	Format      ReportFormat  `json:"format" gorm:"not null"`
	Status      ReportStatus  `json:"status" gorm:"default:'PENDING'"`
	FileName    string        `json:"fileName,omitempty"`
	FilePath    string        `json:"filePath,omitempty"`
	FileSize    int64         `json:"fileSize,omitempty"`
	RowCount    int           `json:"rowCount,omitempty"`
	DateRange   *DateRange    `json:"dateRange,omitempty" gorm:"type:jsonb"`
	Filters     *ReportFilters `json:"filters,omitempty" gorm:"type:jsonb"`
	Error       string        `json:"error,omitempty"`
	ExpiresAt   *time.Time    `json:"expiresAt,omitempty"`
	CompletedAt *time.Time    `json:"completedAt,omitempty"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`
}

func (Report) TableName() string {
	return "reports"
}

// GeneratedReport represents the result of a successful report generation
type GeneratedReport struct {
	ID        uuid.UUID `json:"id"`
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// ReportResponse represents the API response for a report
type ReportResponse struct {
	ID          uuid.UUID     `json:"id"`
	FestivalID  uuid.UUID     `json:"festivalId"`
	Type        ReportType    `json:"type"`
	Format      ReportFormat  `json:"format"`
	Status      ReportStatus  `json:"status"`
	FileName    string        `json:"fileName,omitempty"`
	FileSize    int64         `json:"fileSize,omitempty"`
	RowCount    int           `json:"rowCount,omitempty"`
	DownloadURL string        `json:"downloadUrl,omitempty"`
	Error       string        `json:"error,omitempty"`
	ExpiresAt   *string       `json:"expiresAt,omitempty"`
	CompletedAt *string       `json:"completedAt,omitempty"`
	CreatedAt   string        `json:"createdAt"`
}

// ToResponse converts a Report to ReportResponse
func (r *Report) ToResponse(downloadURL string) ReportResponse {
	resp := ReportResponse{
		ID:         r.ID,
		FestivalID: r.FestivalID,
		Type:       r.Type,
		Format:     r.Format,
		Status:     r.Status,
		FileName:   r.FileName,
		FileSize:   r.FileSize,
		RowCount:   r.RowCount,
		Error:      r.Error,
		CreatedAt:  r.CreatedAt.Format(time.RFC3339),
	}

	if downloadURL != "" && r.Status == ReportStatusCompleted {
		resp.DownloadURL = downloadURL
	}

	if r.ExpiresAt != nil {
		formatted := r.ExpiresAt.Format(time.RFC3339)
		resp.ExpiresAt = &formatted
	}

	if r.CompletedAt != nil {
		formatted := r.CompletedAt.Format(time.RFC3339)
		resp.CompletedAt = &formatted
	}

	return resp
}

// Export data structures for report generation

// TransactionExport represents a transaction row for export
type TransactionExport struct {
	ID            uuid.UUID  `json:"id"`
	WalletID      uuid.UUID  `json:"walletId"`
	UserEmail     string     `json:"userEmail"`
	UserName      string     `json:"userName"`
	Type          string     `json:"type"`
	Amount        int64      `json:"amount"`
	AmountDisplay string     `json:"amountDisplay"`
	BalanceBefore int64      `json:"balanceBefore"`
	BalanceAfter  int64      `json:"balanceAfter"`
	Reference     string     `json:"reference"`
	StandID       *uuid.UUID `json:"standId"`
	StandName     string     `json:"standName"`
	StaffID       *uuid.UUID `json:"staffId"`
	StaffName     string     `json:"staffName"`
	Status        string     `json:"status"`
	CreatedAt     time.Time  `json:"createdAt"`
}

// SalesExport represents a sales summary row for export
type SalesExport struct {
	StandID         uuid.UUID `json:"standId"`
	StandName       string    `json:"standName"`
	ProductID       uuid.UUID `json:"productId"`
	ProductName     string    `json:"productName"`
	Quantity        int       `json:"quantity"`
	UnitPrice       int64     `json:"unitPrice"`
	TotalRevenue    int64     `json:"totalRevenue"`
	RevenueDisplay  string    `json:"revenueDisplay"`
	Date            time.Time `json:"date"`
}

// TicketExport represents a ticket row for export
type TicketExport struct {
	ID            uuid.UUID  `json:"id"`
	Code          string     `json:"code"`
	TicketTypeID  uuid.UUID  `json:"ticketTypeId"`
	TicketType    string     `json:"ticketType"`
	Price         int64      `json:"price"`
	PriceDisplay  string     `json:"priceDisplay"`
	HolderName    string     `json:"holderName"`
	HolderEmail   string     `json:"holderEmail"`
	UserID        *uuid.UUID `json:"userId"`
	Status        string     `json:"status"`
	CheckedInAt   *time.Time `json:"checkedInAt"`
	CheckedInBy   string     `json:"checkedInBy"`
	CreatedAt     time.Time  `json:"createdAt"`
}

// WalletExport represents a wallet row for export
type WalletExport struct {
	ID              uuid.UUID `json:"id"`
	UserID          uuid.UUID `json:"userId"`
	UserEmail       string    `json:"userEmail"`
	UserName        string    `json:"userName"`
	Balance         int64     `json:"balance"`
	BalanceDisplay  string    `json:"balanceDisplay"`
	Status          string    `json:"status"`
	TotalTopUps     int64     `json:"totalTopUps"`
	TotalPurchases  int64     `json:"totalPurchases"`
	TransactionCount int      `json:"transactionCount"`
	CreatedAt       time.Time `json:"createdAt"`
}

// StaffPerformanceExport represents a staff performance row for export
type StaffPerformanceExport struct {
	StaffID          uuid.UUID `json:"staffId"`
	StaffName        string    `json:"staffName"`
	StaffEmail       string    `json:"staffEmail"`
	StandID          uuid.UUID `json:"standId"`
	StandName        string    `json:"standName"`
	Transactions     int       `json:"transactions"`
	TotalAmount      int64     `json:"totalAmount"`
	AmountDisplay    string    `json:"amountDisplay"`
	AverageAmount    int64     `json:"averageAmount"`
	AvgAmountDisplay string    `json:"avgAmountDisplay"`
	TopUps           int       `json:"topUps"`
	Purchases        int       `json:"purchases"`
	Refunds          int       `json:"refunds"`
}

// ReportTaskPayload represents the payload for async report generation
type ReportTaskPayload struct {
	ReportID   uuid.UUID `json:"reportId"`
	FestivalID uuid.UUID `json:"festivalId"`
}
