package reports

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jung-kurt/gofpdf"
	"github.com/xuri/excelize/v2"
)

const (
	// TaskTypeGenerateReport is the task type for async report generation
	TaskTypeGenerateReport = "report:generate"

	// DefaultReportExpiry is the default expiry time for generated reports
	DefaultReportExpiry = 24 * time.Hour
)

// StorageService defines the interface for file storage operations
type StorageService interface {
	Upload(ctx context.Context, key string, data io.Reader, contentType string) error
	GetSignedURL(ctx context.Context, key string, expiry time.Duration) (string, error)
	Delete(ctx context.Context, key string) error
}

// Service provides report generation functionality
type Service struct {
	repo        Repository
	storage     StorageService
	asynqClient *asynq.Client
	storagePath string // Local storage path for reports
}

// NewService creates a new reports service
func NewService(repo Repository, storage StorageService, asynqClient *asynq.Client, storagePath string) *Service {
	return &Service{
		repo:        repo,
		storage:     storage,
		asynqClient: asynqClient,
		storagePath: storagePath,
	}
}

// RequestReport creates a new report request and enqueues it for async processing
func (s *Service) RequestReport(ctx context.Context, festivalID, userID uuid.UUID, req ReportRequest) (*Report, error) {
	// Validate request
	if !req.Type.IsValid() {
		return nil, fmt.Errorf("invalid report type: %s", req.Type)
	}
	if !req.Format.IsValid() {
		return nil, fmt.Errorf("invalid report format: %s", req.Format)
	}

	// Create report record
	report := &Report{
		ID:          uuid.New(),
		FestivalID:  festivalID,
		RequestedBy: userID,
		Type:        req.Type,
		Format:      req.Format,
		Status:      ReportStatusPending,
		DateRange:   req.DateRange,
		Filters:     req.Filters,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.repo.CreateReport(ctx, report); err != nil {
		return nil, fmt.Errorf("failed to create report: %w", err)
	}

	// Enqueue async task
	if err := s.enqueueReportTask(report.ID, festivalID); err != nil {
		// Update report status to failed
		report.Status = ReportStatusFailed
		report.Error = "Failed to enqueue report generation task"
		_ = s.repo.UpdateReport(ctx, report)
		return nil, fmt.Errorf("failed to enqueue report task: %w", err)
	}

	return report, nil
}

// enqueueReportTask enqueues a report generation task
func (s *Service) enqueueReportTask(reportID, festivalID uuid.UUID) error {
	payload := ReportTaskPayload{
		ReportID:   reportID,
		FestivalID: festivalID,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal task payload: %w", err)
	}

	task := asynq.NewTask(TaskTypeGenerateReport, data, asynq.MaxRetry(3), asynq.Timeout(10*time.Minute))
	_, err = s.asynqClient.Enqueue(task)
	return err
}

// GenerateReport generates a report synchronously (called by the worker)
func (s *Service) GenerateReport(ctx context.Context, reportID uuid.UUID) error {
	// Get report
	report, err := s.repo.GetReportByID(ctx, reportID)
	if err != nil {
		return fmt.Errorf("failed to get report: %w", err)
	}
	if report == nil {
		return fmt.Errorf("report not found: %s", reportID)
	}

	// Update status to processing
	report.Status = ReportStatusProcessing
	report.UpdatedAt = time.Now()
	if err := s.repo.UpdateReport(ctx, report); err != nil {
		return fmt.Errorf("failed to update report status: %w", err)
	}

	// Generate report based on type
	var data interface{}
	var rowCount int
	switch report.Type {
	case ReportTypeTransactions:
		txData, err := s.repo.GetTransactionsForExport(ctx, report.FestivalID, report.DateRange, report.Filters)
		if err != nil {
			return s.failReport(ctx, report, err)
		}
		data = txData
		rowCount = len(txData)

	case ReportTypeSales:
		salesData, err := s.repo.GetSalesForExport(ctx, report.FestivalID, report.DateRange, report.Filters)
		if err != nil {
			return s.failReport(ctx, report, err)
		}
		data = salesData
		rowCount = len(salesData)

	case ReportTypeTickets:
		ticketData, err := s.repo.GetTicketsForExport(ctx, report.FestivalID, report.DateRange, report.Filters)
		if err != nil {
			return s.failReport(ctx, report, err)
		}
		data = ticketData
		rowCount = len(ticketData)

	case ReportTypeWallets:
		walletData, err := s.repo.GetWalletsForExport(ctx, report.FestivalID, report.DateRange, report.Filters)
		if err != nil {
			return s.failReport(ctx, report, err)
		}
		data = walletData
		rowCount = len(walletData)

	case ReportTypeStaffPerformance:
		staffData, err := s.repo.GetStaffPerformanceForExport(ctx, report.FestivalID, report.DateRange, report.Filters)
		if err != nil {
			return s.failReport(ctx, report, err)
		}
		data = staffData
		rowCount = len(staffData)

	default:
		return s.failReport(ctx, report, fmt.Errorf("unsupported report type: %s", report.Type))
	}

	// Generate file based on format
	var fileData []byte
	switch report.Format {
	case ReportFormatCSV:
		fileData, err = s.generateCSV(report.Type, data)
	case ReportFormatXLSX:
		fileData, err = s.generateXLSX(report.Type, data)
	case ReportFormatPDF:
		fileData, err = s.generatePDF(report.Type, data)
	default:
		err = fmt.Errorf("unsupported format: %s", report.Format)
	}

	if err != nil {
		return s.failReport(ctx, report, err)
	}

	// Generate filename
	fileName := s.generateFileName(report)

	// Upload to storage
	filePath, err := s.uploadToStorage(ctx, report.FestivalID, fileName, fileData, report.Format)
	if err != nil {
		return s.failReport(ctx, report, err)
	}

	// Update report as completed
	now := time.Now()
	expiresAt := now.Add(DefaultReportExpiry)
	report.Status = ReportStatusCompleted
	report.FileName = fileName
	report.FilePath = filePath
	report.FileSize = int64(len(fileData))
	report.RowCount = rowCount
	report.CompletedAt = &now
	report.ExpiresAt = &expiresAt
	report.UpdatedAt = now

	if err := s.repo.UpdateReport(ctx, report); err != nil {
		return fmt.Errorf("failed to update completed report: %w", err)
	}

	return nil
}

// failReport marks a report as failed
func (s *Service) failReport(ctx context.Context, report *Report, err error) error {
	report.Status = ReportStatusFailed
	report.Error = err.Error()
	report.UpdatedAt = time.Now()
	_ = s.repo.UpdateReport(ctx, report)
	return err
}

// generateFileName creates a unique filename for the report
func (s *Service) generateFileName(report *Report) string {
	timestamp := time.Now().Format("20060102-150405")
	return fmt.Sprintf("%s_%s_%s%s",
		report.Type,
		report.FestivalID.String()[:8],
		timestamp,
		report.Format.GetFileExtension(),
	)
}

// uploadToStorage uploads the report file to storage
func (s *Service) uploadToStorage(ctx context.Context, festivalID uuid.UUID, fileName string, data []byte, format ReportFormat) (string, error) {
	key := fmt.Sprintf("reports/%s/%s", festivalID, fileName)

	if s.storage != nil {
		// Use cloud storage
		if err := s.storage.Upload(ctx, key, bytes.NewReader(data), format.GetContentType()); err != nil {
			return "", fmt.Errorf("failed to upload to storage: %w", err)
		}
		return key, nil
	}

	// Fallback to local storage
	localPath := filepath.Join(s.storagePath, "reports", festivalID.String())
	if err := os.MkdirAll(localPath, 0755); err != nil {
		return "", fmt.Errorf("failed to create local storage directory: %w", err)
	}

	filePath := filepath.Join(localPath, fileName)
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write local file: %w", err)
	}

	return filePath, nil
}

// GetReportURL returns a signed URL for downloading the report
func (s *Service) GetReportURL(ctx context.Context, report *Report) (string, error) {
	if report.Status != ReportStatusCompleted || report.FilePath == "" {
		return "", nil
	}

	if s.storage != nil {
		// Get signed URL from cloud storage
		url, err := s.storage.GetSignedURL(ctx, report.FilePath, time.Hour)
		if err != nil {
			return "", fmt.Errorf("failed to get signed URL: %w", err)
		}
		return url, nil
	}

	// For local storage, return a relative path that the handler can serve
	return fmt.Sprintf("/api/v1/festivals/%s/reports/%s/download", report.FestivalID, report.ID), nil
}

// GetReport retrieves a report by ID
func (s *Service) GetReport(ctx context.Context, reportID uuid.UUID) (*Report, error) {
	return s.repo.GetReportByID(ctx, reportID)
}

// GetReports retrieves reports for a festival
func (s *Service) GetReports(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]Report, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetReportsByFestival(ctx, festivalID, offset, perPage)
}

// GetLocalFilePath returns the local file path for a report (for direct download)
func (s *Service) GetLocalFilePath(report *Report) string {
	if s.storage != nil {
		return "" // Not applicable for cloud storage
	}
	return report.FilePath
}

// generateCSV generates a CSV file from the data
func (s *Service) generateCSV(reportType ReportType, data interface{}) ([]byte, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	switch reportType {
	case ReportTypeTransactions:
		if err := s.writeTransactionsCSV(writer, data.([]TransactionExport)); err != nil {
			return nil, err
		}
	case ReportTypeSales:
		if err := s.writeSalesCSV(writer, data.([]SalesExport)); err != nil {
			return nil, err
		}
	case ReportTypeTickets:
		if err := s.writeTicketsCSV(writer, data.([]TicketExport)); err != nil {
			return nil, err
		}
	case ReportTypeWallets:
		if err := s.writeWalletsCSV(writer, data.([]WalletExport)); err != nil {
			return nil, err
		}
	case ReportTypeStaffPerformance:
		if err := s.writeStaffPerformanceCSV(writer, data.([]StaffPerformanceExport)); err != nil {
			return nil, err
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, fmt.Errorf("CSV writer error: %w", err)
	}

	return buf.Bytes(), nil
}

func (s *Service) writeTransactionsCSV(writer *csv.Writer, data []TransactionExport) error {
	headers := []string{"ID", "Wallet ID", "User Email", "User Name", "Type", "Amount", "Amount Display",
		"Balance Before", "Balance After", "Reference", "Stand ID", "Stand Name", "Staff ID", "Staff Name", "Status", "Created At"}
	if err := writer.Write(headers); err != nil {
		return err
	}

	for _, row := range data {
		record := []string{
			row.ID.String(),
			row.WalletID.String(),
			row.UserEmail,
			row.UserName,
			row.Type,
			fmt.Sprintf("%d", row.Amount),
			row.AmountDisplay,
			fmt.Sprintf("%d", row.BalanceBefore),
			fmt.Sprintf("%d", row.BalanceAfter),
			row.Reference,
			uuidPtrToString(row.StandID),
			row.StandName,
			uuidPtrToString(row.StaffID),
			row.StaffName,
			row.Status,
			row.CreatedAt.Format(time.RFC3339),
		}
		if err := writer.Write(record); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) writeSalesCSV(writer *csv.Writer, data []SalesExport) error {
	headers := []string{"Stand ID", "Stand Name", "Product ID", "Product Name", "Quantity", "Unit Price", "Total Revenue", "Revenue Display", "Date"}
	if err := writer.Write(headers); err != nil {
		return err
	}

	for _, row := range data {
		record := []string{
			row.StandID.String(),
			row.StandName,
			row.ProductID.String(),
			row.ProductName,
			fmt.Sprintf("%d", row.Quantity),
			fmt.Sprintf("%d", row.UnitPrice),
			fmt.Sprintf("%d", row.TotalRevenue),
			row.RevenueDisplay,
			row.Date.Format("2006-01-02"),
		}
		if err := writer.Write(record); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) writeTicketsCSV(writer *csv.Writer, data []TicketExport) error {
	headers := []string{"ID", "Code", "Ticket Type ID", "Ticket Type", "Price", "Price Display",
		"Holder Name", "Holder Email", "User ID", "Status", "Checked In At", "Checked In By", "Created At"}
	if err := writer.Write(headers); err != nil {
		return err
	}

	for _, row := range data {
		checkedInAt := ""
		if row.CheckedInAt != nil {
			checkedInAt = row.CheckedInAt.Format(time.RFC3339)
		}
		record := []string{
			row.ID.String(),
			row.Code,
			row.TicketTypeID.String(),
			row.TicketType,
			fmt.Sprintf("%d", row.Price),
			row.PriceDisplay,
			row.HolderName,
			row.HolderEmail,
			uuidPtrToString(row.UserID),
			row.Status,
			checkedInAt,
			row.CheckedInBy,
			row.CreatedAt.Format(time.RFC3339),
		}
		if err := writer.Write(record); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) writeWalletsCSV(writer *csv.Writer, data []WalletExport) error {
	headers := []string{"ID", "User ID", "User Email", "User Name", "Balance", "Balance Display",
		"Status", "Total Top Ups", "Total Purchases", "Transaction Count", "Created At"}
	if err := writer.Write(headers); err != nil {
		return err
	}

	for _, row := range data {
		record := []string{
			row.ID.String(),
			row.UserID.String(),
			row.UserEmail,
			row.UserName,
			fmt.Sprintf("%d", row.Balance),
			row.BalanceDisplay,
			row.Status,
			fmt.Sprintf("%d", row.TotalTopUps),
			fmt.Sprintf("%d", row.TotalPurchases),
			fmt.Sprintf("%d", row.TransactionCount),
			row.CreatedAt.Format(time.RFC3339),
		}
		if err := writer.Write(record); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) writeStaffPerformanceCSV(writer *csv.Writer, data []StaffPerformanceExport) error {
	headers := []string{"Staff ID", "Staff Name", "Staff Email", "Stand ID", "Stand Name",
		"Transactions", "Total Amount", "Amount Display", "Average Amount", "Avg Amount Display",
		"Top Ups", "Purchases", "Refunds"}
	if err := writer.Write(headers); err != nil {
		return err
	}

	for _, row := range data {
		record := []string{
			row.StaffID.String(),
			row.StaffName,
			row.StaffEmail,
			row.StandID.String(),
			row.StandName,
			fmt.Sprintf("%d", row.Transactions),
			fmt.Sprintf("%d", row.TotalAmount),
			row.AmountDisplay,
			fmt.Sprintf("%d", row.AverageAmount),
			row.AvgAmountDisplay,
			fmt.Sprintf("%d", row.TopUps),
			fmt.Sprintf("%d", row.Purchases),
			fmt.Sprintf("%d", row.Refunds),
		}
		if err := writer.Write(record); err != nil {
			return err
		}
	}
	return nil
}

// generateXLSX generates an XLSX file from the data using excelize
func (s *Service) generateXLSX(reportType ReportType, data interface{}) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	sheetName := "Report"
	f.SetSheetName("Sheet1", sheetName)

	switch reportType {
	case ReportTypeTransactions:
		if err := s.writeTransactionsXLSX(f, sheetName, data.([]TransactionExport)); err != nil {
			return nil, err
		}
	case ReportTypeSales:
		if err := s.writeSalesXLSX(f, sheetName, data.([]SalesExport)); err != nil {
			return nil, err
		}
	case ReportTypeTickets:
		if err := s.writeTicketsXLSX(f, sheetName, data.([]TicketExport)); err != nil {
			return nil, err
		}
	case ReportTypeWallets:
		if err := s.writeWalletsXLSX(f, sheetName, data.([]WalletExport)); err != nil {
			return nil, err
		}
	case ReportTypeStaffPerformance:
		if err := s.writeStaffPerformanceXLSX(f, sheetName, data.([]StaffPerformanceExport)); err != nil {
			return nil, err
		}
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, fmt.Errorf("failed to write XLSX: %w", err)
	}

	return buf.Bytes(), nil
}

func (s *Service) writeTransactionsXLSX(f *excelize.File, sheet string, data []TransactionExport) error {
	headers := []interface{}{"ID", "Wallet ID", "User Email", "User Name", "Type", "Amount", "Amount Display",
		"Balance Before", "Balance After", "Reference", "Stand ID", "Stand Name", "Staff ID", "Staff Name", "Status", "Created At"}
	if err := f.SetSheetRow(sheet, "A1", &headers); err != nil {
		return err
	}

	// Style header
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "#FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#4472C4"}, Pattern: 1},
	})
	f.SetRowStyle(sheet, 1, 1, headerStyle)

	for i, row := range data {
		rowNum := i + 2
		values := []interface{}{
			row.ID.String(),
			row.WalletID.String(),
			row.UserEmail,
			row.UserName,
			row.Type,
			row.Amount,
			row.AmountDisplay,
			row.BalanceBefore,
			row.BalanceAfter,
			row.Reference,
			uuidPtrToString(row.StandID),
			row.StandName,
			uuidPtrToString(row.StaffID),
			row.StaffName,
			row.Status,
			row.CreatedAt.Format(time.RFC3339),
		}
		if err := f.SetSheetRow(sheet, fmt.Sprintf("A%d", rowNum), &values); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) writeSalesXLSX(f *excelize.File, sheet string, data []SalesExport) error {
	headers := []interface{}{"Stand ID", "Stand Name", "Product ID", "Product Name", "Quantity", "Unit Price", "Total Revenue", "Revenue Display", "Date"}
	if err := f.SetSheetRow(sheet, "A1", &headers); err != nil {
		return err
	}

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "#FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#4472C4"}, Pattern: 1},
	})
	f.SetRowStyle(sheet, 1, 1, headerStyle)

	for i, row := range data {
		rowNum := i + 2
		values := []interface{}{
			row.StandID.String(),
			row.StandName,
			row.ProductID.String(),
			row.ProductName,
			row.Quantity,
			row.UnitPrice,
			row.TotalRevenue,
			row.RevenueDisplay,
			row.Date.Format("2006-01-02"),
		}
		if err := f.SetSheetRow(sheet, fmt.Sprintf("A%d", rowNum), &values); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) writeTicketsXLSX(f *excelize.File, sheet string, data []TicketExport) error {
	headers := []interface{}{"ID", "Code", "Ticket Type ID", "Ticket Type", "Price", "Price Display",
		"Holder Name", "Holder Email", "User ID", "Status", "Checked In At", "Checked In By", "Created At"}
	if err := f.SetSheetRow(sheet, "A1", &headers); err != nil {
		return err
	}

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "#FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#4472C4"}, Pattern: 1},
	})
	f.SetRowStyle(sheet, 1, 1, headerStyle)

	for i, row := range data {
		rowNum := i + 2
		checkedInAt := ""
		if row.CheckedInAt != nil {
			checkedInAt = row.CheckedInAt.Format(time.RFC3339)
		}
		values := []interface{}{
			row.ID.String(),
			row.Code,
			row.TicketTypeID.String(),
			row.TicketType,
			row.Price,
			row.PriceDisplay,
			row.HolderName,
			row.HolderEmail,
			uuidPtrToString(row.UserID),
			row.Status,
			checkedInAt,
			row.CheckedInBy,
			row.CreatedAt.Format(time.RFC3339),
		}
		if err := f.SetSheetRow(sheet, fmt.Sprintf("A%d", rowNum), &values); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) writeWalletsXLSX(f *excelize.File, sheet string, data []WalletExport) error {
	headers := []interface{}{"ID", "User ID", "User Email", "User Name", "Balance", "Balance Display",
		"Status", "Total Top Ups", "Total Purchases", "Transaction Count", "Created At"}
	if err := f.SetSheetRow(sheet, "A1", &headers); err != nil {
		return err
	}

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "#FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#4472C4"}, Pattern: 1},
	})
	f.SetRowStyle(sheet, 1, 1, headerStyle)

	for i, row := range data {
		rowNum := i + 2
		values := []interface{}{
			row.ID.String(),
			row.UserID.String(),
			row.UserEmail,
			row.UserName,
			row.Balance,
			row.BalanceDisplay,
			row.Status,
			row.TotalTopUps,
			row.TotalPurchases,
			row.TransactionCount,
			row.CreatedAt.Format(time.RFC3339),
		}
		if err := f.SetSheetRow(sheet, fmt.Sprintf("A%d", rowNum), &values); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) writeStaffPerformanceXLSX(f *excelize.File, sheet string, data []StaffPerformanceExport) error {
	headers := []interface{}{"Staff ID", "Staff Name", "Staff Email", "Stand ID", "Stand Name",
		"Transactions", "Total Amount", "Amount Display", "Average Amount", "Avg Amount Display",
		"Top Ups", "Purchases", "Refunds"}
	if err := f.SetSheetRow(sheet, "A1", &headers); err != nil {
		return err
	}

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "#FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#4472C4"}, Pattern: 1},
	})
	f.SetRowStyle(sheet, 1, 1, headerStyle)

	for i, row := range data {
		rowNum := i + 2
		values := []interface{}{
			row.StaffID.String(),
			row.StaffName,
			row.StaffEmail,
			row.StandID.String(),
			row.StandName,
			row.Transactions,
			row.TotalAmount,
			row.AmountDisplay,
			row.AverageAmount,
			row.AvgAmountDisplay,
			row.TopUps,
			row.Purchases,
			row.Refunds,
		}
		if err := f.SetSheetRow(sheet, fmt.Sprintf("A%d", rowNum), &values); err != nil {
			return err
		}
	}

	return nil
}

// generatePDF generates a PDF file from the data using gofpdf
func (s *Service) generatePDF(reportType ReportType, data interface{}) ([]byte, error) {
	pdf := gofpdf.New("L", "mm", "A4", "") // Landscape for wider tables
	pdf.SetFont("Arial", "", 10)
	pdf.AddPage()

	// Add title
	pdf.SetFont("Arial", "B", 16)
	title := s.getReportTitle(reportType)
	pdf.Cell(0, 10, title)
	pdf.Ln(15)

	// Add generation timestamp
	pdf.SetFont("Arial", "", 8)
	pdf.Cell(0, 5, fmt.Sprintf("Generated: %s", time.Now().Format("2006-01-02 15:04:05")))
	pdf.Ln(10)

	pdf.SetFont("Arial", "", 8)

	switch reportType {
	case ReportTypeTransactions:
		s.writeTransactionsPDF(pdf, data.([]TransactionExport))
	case ReportTypeSales:
		s.writeSalesPDF(pdf, data.([]SalesExport))
	case ReportTypeTickets:
		s.writeTicketsPDF(pdf, data.([]TicketExport))
	case ReportTypeWallets:
		s.writeWalletsPDF(pdf, data.([]WalletExport))
	case ReportTypeStaffPerformance:
		s.writeStaffPerformancePDF(pdf, data.([]StaffPerformanceExport))
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %w", err)
	}

	return buf.Bytes(), nil
}

func (s *Service) getReportTitle(reportType ReportType) string {
	switch reportType {
	case ReportTypeTransactions:
		return "Transactions Report"
	case ReportTypeSales:
		return "Sales Report"
	case ReportTypeTickets:
		return "Tickets Report"
	case ReportTypeWallets:
		return "Wallets Report"
	case ReportTypeStaffPerformance:
		return "Staff Performance Report"
	default:
		return "Report"
	}
}

func (s *Service) writeTransactionsPDF(pdf *gofpdf.Fpdf, data []TransactionExport) {
	// Headers
	headers := []string{"ID", "User", "Type", "Amount", "Stand", "Staff", "Status", "Date"}
	widths := []float64{30, 40, 20, 25, 35, 35, 20, 35}

	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(68, 114, 196)
	pdf.SetTextColor(255, 255, 255)
	for i, header := range headers {
		pdf.CellFormat(widths[i], 7, header, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 7)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFillColor(240, 240, 240)

	for i, row := range data {
		fill := i%2 == 0
		pdf.CellFormat(widths[0], 6, row.ID.String()[:8], "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[1], 6, truncateString(row.UserEmail, 25), "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[2], 6, row.Type, "1", 0, "C", fill, 0, "")
		pdf.CellFormat(widths[3], 6, row.AmountDisplay, "1", 0, "R", fill, 0, "")
		pdf.CellFormat(widths[4], 6, truncateString(row.StandName, 20), "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[5], 6, truncateString(row.StaffName, 20), "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[6], 6, row.Status, "1", 0, "C", fill, 0, "")
		pdf.CellFormat(widths[7], 6, row.CreatedAt.Format("2006-01-02 15:04"), "1", 0, "L", fill, 0, "")
		pdf.Ln(-1)

		// Add new page if needed
		if pdf.GetY() > 180 {
			pdf.AddPage()
			pdf.SetFont("Arial", "B", 8)
			pdf.SetFillColor(68, 114, 196)
			pdf.SetTextColor(255, 255, 255)
			for i, header := range headers {
				pdf.CellFormat(widths[i], 7, header, "1", 0, "C", true, 0, "")
			}
			pdf.Ln(-1)
			pdf.SetFont("Arial", "", 7)
			pdf.SetTextColor(0, 0, 0)
			pdf.SetFillColor(240, 240, 240)
		}
	}
}

func (s *Service) writeSalesPDF(pdf *gofpdf.Fpdf, data []SalesExport) {
	headers := []string{"Stand", "Product", "Quantity", "Unit Price", "Total Revenue", "Date"}
	widths := []float64{50, 60, 25, 30, 35, 40}

	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(68, 114, 196)
	pdf.SetTextColor(255, 255, 255)
	for i, header := range headers {
		pdf.CellFormat(widths[i], 7, header, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 7)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFillColor(240, 240, 240)

	for i, row := range data {
		fill := i%2 == 0
		pdf.CellFormat(widths[0], 6, truncateString(row.StandName, 30), "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[1], 6, truncateString(row.ProductName, 35), "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[2], 6, fmt.Sprintf("%d", row.Quantity), "1", 0, "R", fill, 0, "")
		pdf.CellFormat(widths[3], 6, formatCurrency(row.UnitPrice), "1", 0, "R", fill, 0, "")
		pdf.CellFormat(widths[4], 6, row.RevenueDisplay, "1", 0, "R", fill, 0, "")
		pdf.CellFormat(widths[5], 6, row.Date.Format("2006-01-02"), "1", 0, "L", fill, 0, "")
		pdf.Ln(-1)

		if pdf.GetY() > 180 {
			pdf.AddPage()
		}
	}
}

func (s *Service) writeTicketsPDF(pdf *gofpdf.Fpdf, data []TicketExport) {
	headers := []string{"Code", "Type", "Price", "Holder", "Email", "Status", "Checked In", "Created"}
	widths := []float64{25, 30, 25, 35, 45, 20, 35, 35}

	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(68, 114, 196)
	pdf.SetTextColor(255, 255, 255)
	for i, header := range headers {
		pdf.CellFormat(widths[i], 7, header, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 7)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFillColor(240, 240, 240)

	for i, row := range data {
		fill := i%2 == 0
		checkedIn := ""
		if row.CheckedInAt != nil {
			checkedIn = row.CheckedInAt.Format("2006-01-02 15:04")
		}
		pdf.CellFormat(widths[0], 6, truncateString(row.Code, 15), "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[1], 6, truncateString(row.TicketType, 18), "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[2], 6, row.PriceDisplay, "1", 0, "R", fill, 0, "")
		pdf.CellFormat(widths[3], 6, truncateString(row.HolderName, 22), "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[4], 6, truncateString(row.HolderEmail, 28), "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[5], 6, row.Status, "1", 0, "C", fill, 0, "")
		pdf.CellFormat(widths[6], 6, checkedIn, "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[7], 6, row.CreatedAt.Format("2006-01-02 15:04"), "1", 0, "L", fill, 0, "")
		pdf.Ln(-1)

		if pdf.GetY() > 180 {
			pdf.AddPage()
		}
	}
}

func (s *Service) writeWalletsPDF(pdf *gofpdf.Fpdf, data []WalletExport) {
	headers := []string{"User", "Email", "Balance", "Status", "Top Ups", "Purchases", "Transactions", "Created"}
	widths := []float64{35, 50, 25, 20, 25, 25, 25, 35}

	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(68, 114, 196)
	pdf.SetTextColor(255, 255, 255)
	for i, header := range headers {
		pdf.CellFormat(widths[i], 7, header, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 7)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFillColor(240, 240, 240)

	for i, row := range data {
		fill := i%2 == 0
		pdf.CellFormat(widths[0], 6, truncateString(row.UserName, 22), "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[1], 6, truncateString(row.UserEmail, 30), "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[2], 6, row.BalanceDisplay, "1", 0, "R", fill, 0, "")
		pdf.CellFormat(widths[3], 6, row.Status, "1", 0, "C", fill, 0, "")
		pdf.CellFormat(widths[4], 6, formatCurrency(row.TotalTopUps), "1", 0, "R", fill, 0, "")
		pdf.CellFormat(widths[5], 6, formatCurrency(row.TotalPurchases), "1", 0, "R", fill, 0, "")
		pdf.CellFormat(widths[6], 6, fmt.Sprintf("%d", row.TransactionCount), "1", 0, "R", fill, 0, "")
		pdf.CellFormat(widths[7], 6, row.CreatedAt.Format("2006-01-02 15:04"), "1", 0, "L", fill, 0, "")
		pdf.Ln(-1)

		if pdf.GetY() > 180 {
			pdf.AddPage()
		}
	}
}

func (s *Service) writeStaffPerformancePDF(pdf *gofpdf.Fpdf, data []StaffPerformanceExport) {
	headers := []string{"Staff", "Stand", "Transactions", "Total Amount", "Avg Amount", "Top Ups", "Purchases", "Refunds"}
	widths := []float64{40, 40, 25, 30, 30, 25, 25, 25}

	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(68, 114, 196)
	pdf.SetTextColor(255, 255, 255)
	for i, header := range headers {
		pdf.CellFormat(widths[i], 7, header, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 7)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFillColor(240, 240, 240)

	for i, row := range data {
		fill := i%2 == 0
		pdf.CellFormat(widths[0], 6, truncateString(row.StaffName, 25), "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[1], 6, truncateString(row.StandName, 25), "1", 0, "L", fill, 0, "")
		pdf.CellFormat(widths[2], 6, fmt.Sprintf("%d", row.Transactions), "1", 0, "R", fill, 0, "")
		pdf.CellFormat(widths[3], 6, row.AmountDisplay, "1", 0, "R", fill, 0, "")
		pdf.CellFormat(widths[4], 6, row.AvgAmountDisplay, "1", 0, "R", fill, 0, "")
		pdf.CellFormat(widths[5], 6, fmt.Sprintf("%d", row.TopUps), "1", 0, "R", fill, 0, "")
		pdf.CellFormat(widths[6], 6, fmt.Sprintf("%d", row.Purchases), "1", 0, "R", fill, 0, "")
		pdf.CellFormat(widths[7], 6, fmt.Sprintf("%d", row.Refunds), "1", 0, "R", fill, 0, "")
		pdf.Ln(-1)

		if pdf.GetY() > 180 {
			pdf.AddPage()
		}
	}
}

// Helper functions

func uuidPtrToString(id *uuid.UUID) string {
	if id == nil {
		return ""
	}
	return id.String()
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
