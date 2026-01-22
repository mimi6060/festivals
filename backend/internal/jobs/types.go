package jobs

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/queue"
)

// ============================================================================
// Email Task Payloads
// ============================================================================

// SendEmailPayload represents the payload for a generic email task
type SendEmailPayload struct {
	To          string            `json:"to"`
	Subject     string            `json:"subject"`
	Template    string            `json:"template"`
	TemplateData map[string]interface{} `json:"templateData,omitempty"`
	Attachments []EmailAttachment `json:"attachments,omitempty"`
	Priority    string            `json:"priority,omitempty"` // high, normal, low
	FestivalID  *uuid.UUID        `json:"festivalId,omitempty"`
}

// EmailAttachment represents an email attachment
type EmailAttachment struct {
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
	Content     []byte `json:"content,omitempty"`
	URL         string `json:"url,omitempty"` // If content is stored remotely
}

// SendWelcomeEmailPayload represents the payload for a welcome email task
type SendWelcomeEmailPayload struct {
	UserID      uuid.UUID `json:"userId"`
	Email       string    `json:"email"`
	Name        string    `json:"name"`
	FestivalID  *uuid.UUID `json:"festivalId,omitempty"`
	FestivalName string   `json:"festivalName,omitempty"`
}

// SendTicketEmailPayload represents the payload for sending ticket confirmation
type SendTicketEmailPayload struct {
	TicketID    uuid.UUID `json:"ticketId"`
	UserID      uuid.UUID `json:"userId"`
	Email       string    `json:"email"`
	Name        string    `json:"name"`
	FestivalID  uuid.UUID `json:"festivalId"`
	FestivalName string   `json:"festivalName"`
	TicketType  string    `json:"ticketType"`
	TicketCode  string    `json:"ticketCode"`
	QRCodeURL   string    `json:"qrCodeUrl,omitempty"`
	EventDate   time.Time `json:"eventDate"`
	Venue       string    `json:"venue,omitempty"`
}

// SendRefundNotificationPayload represents the payload for refund notification email
type SendRefundNotificationPayload struct {
	RefundID       uuid.UUID `json:"refundId"`
	TransactionID  uuid.UUID `json:"transactionId"`
	UserID         uuid.UUID `json:"userId"`
	Email          string    `json:"email"`
	Name           string    `json:"name"`
	Amount         int64     `json:"amount"` // Amount in cents
	Currency       string    `json:"currency"`
	Reason         string    `json:"reason,omitempty"`
	Status         string    `json:"status"` // processed, failed
	ProcessedAt    time.Time `json:"processedAt"`
	FestivalID     uuid.UUID `json:"festivalId"`
	FestivalName   string    `json:"festivalName"`
}

// ============================================================================
// Report Task Payloads
// ============================================================================

// GenerateReportPayload represents the payload for generating a generic report
type GenerateReportPayload struct {
	ReportID    uuid.UUID              `json:"reportId"`
	Type        ReportType             `json:"type"`
	Format      ReportFormat           `json:"format"`
	FestivalID  uuid.UUID              `json:"festivalId"`
	RequestedBy uuid.UUID              `json:"requestedBy"`
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
	StartDate   *time.Time             `json:"startDate,omitempty"`
	EndDate     *time.Time             `json:"endDate,omitempty"`
	NotifyEmail string                 `json:"notifyEmail,omitempty"`
	WebhookURL  string                 `json:"webhookUrl,omitempty"`
}

// ReportType defines the type of report
type ReportType string

const (
	ReportTypeSales       ReportType = "sales"
	ReportTypeAttendance  ReportType = "attendance"
	ReportTypeTransactions ReportType = "transactions"
	ReportTypeWallets     ReportType = "wallets"
	ReportTypeStands      ReportType = "stands"
	ReportTypeProducts    ReportType = "products"
	ReportTypeRefunds     ReportType = "refunds"
	ReportTypeCustom      ReportType = "custom"
)

// ReportFormat defines the output format of a report
type ReportFormat string

const (
	ReportFormatPDF  ReportFormat = "pdf"
	ReportFormatCSV  ReportFormat = "csv"
	ReportFormatXLSX ReportFormat = "xlsx"
	ReportFormatJSON ReportFormat = "json"
)

// GenerateSalesReportPayload represents the payload for generating a sales report
type GenerateSalesReportPayload struct {
	ReportID       uuid.UUID    `json:"reportId"`
	FestivalID     uuid.UUID    `json:"festivalId"`
	RequestedBy    uuid.UUID    `json:"requestedBy"`
	Format         ReportFormat `json:"format"`
	StartDate      time.Time    `json:"startDate"`
	EndDate        time.Time    `json:"endDate"`
	GroupBy        string       `json:"groupBy,omitempty"` // day, hour, stand, product
	IncludeRefunds bool         `json:"includeRefunds"`
	StandIDs       []uuid.UUID  `json:"standIds,omitempty"` // Filter by specific stands
	NotifyEmail    string       `json:"notifyEmail,omitempty"`
}

// GenerateAttendanceReportPayload represents the payload for generating an attendance report
type GenerateAttendanceReportPayload struct {
	ReportID       uuid.UUID    `json:"reportId"`
	FestivalID     uuid.UUID    `json:"festivalId"`
	RequestedBy    uuid.UUID    `json:"requestedBy"`
	Format         ReportFormat `json:"format"`
	StartDate      time.Time    `json:"startDate"`
	EndDate        time.Time    `json:"endDate"`
	GroupBy        string       `json:"groupBy,omitempty"` // day, hour, ticket_type
	IncludeExits   bool         `json:"includeExits"`
	TicketTypeIDs  []uuid.UUID  `json:"ticketTypeIds,omitempty"`
	NotifyEmail    string       `json:"notifyEmail,omitempty"`
}

// ============================================================================
// Refund Task Payloads
// ============================================================================

// ProcessRefundPayload represents the payload for processing a single refund
type ProcessRefundPayload struct {
	RefundID       uuid.UUID `json:"refundId"`
	TransactionID  uuid.UUID `json:"transactionId"`
	WalletID       uuid.UUID `json:"walletId"`
	UserID         uuid.UUID `json:"userId"`
	Amount         int64     `json:"amount"` // Amount in cents
	Currency       string    `json:"currency"`
	Reason         string    `json:"reason,omitempty"`
	RequestedBy    uuid.UUID `json:"requestedBy"`
	FestivalID     uuid.UUID `json:"festivalId"`
	StripePaymentID string   `json:"stripePaymentId,omitempty"` // Original Stripe payment intent
	RefundMethod   string    `json:"refundMethod"` // stripe, wallet, manual
	NotifyUser     bool      `json:"notifyUser"`
}

// ProcessBulkRefundPayload represents the payload for processing multiple refunds
type ProcessBulkRefundPayload struct {
	BatchID     uuid.UUID              `json:"batchId"`
	FestivalID  uuid.UUID              `json:"festivalId"`
	RequestedBy uuid.UUID              `json:"requestedBy"`
	Refunds     []BulkRefundItem       `json:"refunds"`
	Reason      string                 `json:"reason,omitempty"`
	NotifyUsers bool                   `json:"notifyUsers"`
}

// BulkRefundItem represents a single refund item in a bulk refund request
type BulkRefundItem struct {
	TransactionID   uuid.UUID `json:"transactionId"`
	WalletID        uuid.UUID `json:"walletId"`
	UserID          uuid.UUID `json:"userId"`
	Amount          int64     `json:"amount"`
	StripePaymentID string    `json:"stripePaymentId,omitempty"`
}

// ============================================================================
// Cleanup Task Payloads
// ============================================================================

// CleanupExpiredQRCodesPayload represents the payload for cleaning expired QR codes
type CleanupExpiredQRCodesPayload struct {
	FestivalID      *uuid.UUID `json:"festivalId,omitempty"` // nil = all festivals
	ExpirationDate  time.Time  `json:"expirationDate"`       // Clean codes older than this
	DryRun          bool       `json:"dryRun"`               // If true, only report what would be deleted
}

// ArchiveOldTransactionsPayload represents the payload for archiving old transactions
type ArchiveOldTransactionsPayload struct {
	FestivalID     *uuid.UUID `json:"festivalId,omitempty"` // nil = all festivals
	OlderThan      time.Time  `json:"olderThan"`            // Archive transactions older than this
	BatchSize      int        `json:"batchSize"`            // Number of records per batch
	ArchiveBucket  string     `json:"archiveBucket,omitempty"`
	DryRun         bool       `json:"dryRun"`
}

// CleanupTempFilesPayload represents the payload for cleaning temporary files
type CleanupTempFilesPayload struct {
	Directory      string        `json:"directory"`       // Directory to clean
	OlderThan      time.Duration `json:"olderThan"`       // Delete files older than this duration
	FilePattern    string        `json:"filePattern,omitempty"` // Optional glob pattern
	DryRun         bool          `json:"dryRun"`
}

// CleanupExpiredSessionsPayload represents the payload for cleaning expired sessions
type CleanupExpiredSessionsPayload struct {
	ExpirationTime time.Time `json:"expirationTime"`
	BatchSize      int       `json:"batchSize"`
	DryRun         bool      `json:"dryRun"`
}

// ============================================================================
// Notification Task Payloads
// ============================================================================

// SendPushNotificationPayload represents the payload for sending push notifications
type SendPushNotificationPayload struct {
	UserID      uuid.UUID              `json:"userId"`
	Title       string                 `json:"title"`
	Body        string                 `json:"body"`
	Data        map[string]interface{} `json:"data,omitempty"`
	FestivalID  *uuid.UUID             `json:"festivalId,omitempty"`
	Badge       *int                   `json:"badge,omitempty"`
	Sound       string                 `json:"sound,omitempty"`
	Priority    string                 `json:"priority,omitempty"` // high, normal
}

// SendSMSNotificationPayload represents the payload for sending SMS notifications
type SendSMSNotificationPayload struct {
	UserID      uuid.UUID  `json:"userId"`
	PhoneNumber string     `json:"phoneNumber"`
	Message     string     `json:"message"`
	FestivalID  *uuid.UUID `json:"festivalId,omitempty"`
}

// ============================================================================
// Wallet Task Payloads
// ============================================================================

// ProcessWalletTopUpPayload represents the payload for processing wallet top-ups
type ProcessWalletTopUpPayload struct {
	TopUpID          uuid.UUID `json:"topUpId"`
	WalletID         uuid.UUID `json:"walletId"`
	UserID           uuid.UUID `json:"userId"`
	Amount           int64     `json:"amount"` // Amount in cents
	Currency         string    `json:"currency"`
	PaymentIntentID  string    `json:"paymentIntentId"`
	FestivalID       uuid.UUID `json:"festivalId"`
}

// ReconcileWalletsPayload represents the payload for wallet reconciliation
type ReconcileWalletsPayload struct {
	FestivalID   uuid.UUID  `json:"festivalId"`
	StartDate    time.Time  `json:"startDate"`
	EndDate      time.Time  `json:"endDate"`
	RequestedBy  uuid.UUID  `json:"requestedBy"`
	NotifyEmail  string     `json:"notifyEmail,omitempty"`
}

// ============================================================================
// Task Constructors
// ============================================================================

// NewSendEmailTask creates a new send email task
func NewSendEmailTask(payload *SendEmailPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeSendEmail, data, asynq.MaxRetry(3)), nil
}

// NewSendWelcomeEmailTask creates a new welcome email task
func NewSendWelcomeEmailTask(payload *SendWelcomeEmailPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeSendWelcomeEmail, data, asynq.MaxRetry(3)), nil
}

// NewSendTicketEmailTask creates a new ticket email task
func NewSendTicketEmailTask(payload *SendTicketEmailPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeSendTicketEmail, data, asynq.MaxRetry(5)), nil
}

// NewSendRefundNotificationTask creates a new refund notification email task
func NewSendRefundNotificationTask(payload *SendRefundNotificationPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeSendRefundNotification, data, asynq.MaxRetry(3)), nil
}

// NewGenerateReportTask creates a new report generation task
func NewGenerateReportTask(payload *GenerateReportPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeGenerateReport, data, asynq.MaxRetry(2), asynq.Timeout(30*time.Minute)), nil
}

// NewGenerateSalesReportTask creates a new sales report task
func NewGenerateSalesReportTask(payload *GenerateSalesReportPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeGenerateSalesReport, data, asynq.MaxRetry(2), asynq.Timeout(30*time.Minute)), nil
}

// NewGenerateAttendanceReportTask creates a new attendance report task
func NewGenerateAttendanceReportTask(payload *GenerateAttendanceReportPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeGenerateAttendanceReport, data, asynq.MaxRetry(2), asynq.Timeout(30*time.Minute)), nil
}

// NewProcessRefundTask creates a new refund processing task
func NewProcessRefundTask(payload *ProcessRefundPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeProcessRefund, data, asynq.MaxRetry(5), asynq.Queue(queue.QueueCritical)), nil
}

// NewProcessBulkRefundTask creates a new bulk refund processing task
func NewProcessBulkRefundTask(payload *ProcessBulkRefundPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeProcessBulkRefund, data, asynq.MaxRetry(3), asynq.Timeout(1*time.Hour)), nil
}

// NewCleanupExpiredQRCodesTask creates a new cleanup QR codes task
func NewCleanupExpiredQRCodesTask(payload *CleanupExpiredQRCodesPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeCleanupExpiredQRCodes, data, asynq.MaxRetry(2), asynq.Queue(queue.QueueLow)), nil
}

// NewArchiveOldTransactionsTask creates a new archive transactions task
func NewArchiveOldTransactionsTask(payload *ArchiveOldTransactionsPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeArchiveOldTransactions, data, asynq.MaxRetry(2), asynq.Queue(queue.QueueLow), asynq.Timeout(2*time.Hour)), nil
}

// NewCleanupTempFilesTask creates a new cleanup temp files task
func NewCleanupTempFilesTask(payload *CleanupTempFilesPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeCleanupTempFiles, data, asynq.MaxRetry(2), asynq.Queue(queue.QueueLow)), nil
}

// NewCleanupExpiredSessionsTask creates a new cleanup sessions task
func NewCleanupExpiredSessionsTask(payload *CleanupExpiredSessionsPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeCleanupExpiredSessions, data, asynq.MaxRetry(2), asynq.Queue(queue.QueueLow)), nil
}

// NewSendPushNotificationTask creates a new push notification task
func NewSendPushNotificationTask(payload *SendPushNotificationPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeSendPushNotification, data, asynq.MaxRetry(3)), nil
}

// NewSendSMSNotificationTask creates a new SMS notification task
func NewSendSMSNotificationTask(payload *SendSMSNotificationPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeSendSMSNotification, data, asynq.MaxRetry(3)), nil
}

// NewProcessWalletTopUpTask creates a new wallet top-up task
func NewProcessWalletTopUpTask(payload *ProcessWalletTopUpPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeProcessWalletTopUp, data, asynq.MaxRetry(5), asynq.Queue(queue.QueueCritical)), nil
}

// NewReconcileWalletsTask creates a new wallet reconciliation task
func NewReconcileWalletsTask(payload *ReconcileWalletsPayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(queue.TypeReconcileWallets, data, asynq.MaxRetry(2), asynq.Queue(queue.QueueLow), asynq.Timeout(1*time.Hour)), nil
}
