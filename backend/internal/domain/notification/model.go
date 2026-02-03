package notification

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// EmailClient defines the interface for sending emails
// This interface should be implemented by infrastructure layer (e.g., PostalClient, SendGridClient)
type EmailClient interface {
	// SendEmail sends an email with the given parameters
	SendEmail(ctx context.Context, to, subject, htmlBody, textBody string) (*EmailSendResult, error)
	// SendEmailWithAttachments sends an email with attachments
	SendEmailWithAttachments(ctx context.Context, req EmailSendRequest) (*EmailSendResult, error)
}

// EmailSendRequest represents a request to send an email
type EmailSendRequest struct {
	To          []string
	CC          []string
	BCC         []string
	From        string
	Subject     string
	HTMLBody    string
	TextBody    string
	Attachments []EmailAttachment
	Headers     map[string]string
	Tag         string
}

// EmailAttachment represents an email attachment
type EmailAttachment struct {
	Name        string
	ContentType string
	Data        string // Base64 encoded
}

// EmailSendResult represents the result of sending an email
type EmailSendResult struct {
	MessageID string
	Success   bool
	Error     string
}

// EmailTemplate represents the type of email template
type EmailTemplate string

const (
	EmailTemplateWelcome             EmailTemplate = "WELCOME"
	EmailTemplateTicketPurchased     EmailTemplate = "TICKET_PURCHASED"
	EmailTemplateTicketConfirmation  EmailTemplate = "TICKET_CONFIRMATION"
	EmailTemplateTicketTransferred   EmailTemplate = "TICKET_TRANSFERRED"
	EmailTemplateTopUpConfirmed      EmailTemplate = "TOP_UP_CONFIRMED"
	EmailTemplateRefundProcessed     EmailTemplate = "REFUND_PROCESSED"
	EmailTemplatePasswordReset       EmailTemplate = "PASSWORD_RESET"
	EmailTemplateSecurityAlert       EmailTemplate = "SECURITY_ALERT"
)

// IsValid checks if the template is a valid EmailTemplate
func (t EmailTemplate) IsValid() bool {
	switch t {
	case EmailTemplateWelcome,
		EmailTemplateTicketPurchased,
		EmailTemplateTicketConfirmation,
		EmailTemplateTicketTransferred,
		EmailTemplateTopUpConfirmed,
		EmailTemplateRefundProcessed,
		EmailTemplatePasswordReset,
		EmailTemplateSecurityAlert:
		return true
	}
	return false
}

// String returns the string representation of the template
func (t EmailTemplate) String() string {
	return string(t)
}

// GetSubject returns the default subject for each template type
func (t EmailTemplate) GetSubject() string {
	subjects := map[EmailTemplate]string{
		EmailTemplateWelcome:            "Welcome to Festivals!",
		EmailTemplateTicketPurchased:    "Your Ticket Purchase Confirmation",
		EmailTemplateTicketConfirmation: "Your Festival Ticket is Ready!",
		EmailTemplateTicketTransferred:  "Ticket Transfer Notification",
		EmailTemplateTopUpConfirmed:     "Wallet Top-Up Confirmation",
		EmailTemplateRefundProcessed:    "Refund Processed",
		EmailTemplatePasswordReset:      "Password Reset Request",
		EmailTemplateSecurityAlert:      "Security Alert - Action Required",
	}
	if subject, ok := subjects[t]; ok {
		return subject
	}
	return "Notification from Festivals"
}

// GetTemplatePath returns the file path for the template
func (t EmailTemplate) GetTemplatePath() string {
	paths := map[EmailTemplate]string{
		EmailTemplateWelcome:            "welcome.html",
		EmailTemplateTicketPurchased:    "ticket_purchase.html",
		EmailTemplateTicketConfirmation: "ticket_confirmation.html",
		EmailTemplateTicketTransferred:  "ticket_transfer.html",
		EmailTemplateTopUpConfirmed:     "topup_confirmation.html",
		EmailTemplateRefundProcessed:    "refund_processed.html",
		EmailTemplatePasswordReset:      "password_reset.html",
		EmailTemplateSecurityAlert:      "security_alert.html",
	}
	if path, ok := paths[t]; ok {
		return path
	}
	return ""
}

// NotificationPreferences represents a user's notification preferences
type NotificationPreferences struct {
	ID                     uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID                 uuid.UUID `json:"userId" gorm:"type:uuid;not null;uniqueIndex"`
	EmailEnabled           bool      `json:"emailEnabled" gorm:"default:true"`
	PushEnabled            bool      `json:"pushEnabled" gorm:"default:true"`
	MarketingEnabled       bool      `json:"marketingEnabled" gorm:"default:false"`
	TransactionAlerts      bool      `json:"transactionAlerts" gorm:"default:true"`
	TicketReminders        bool      `json:"ticketReminders" gorm:"default:true"`
	LineupUpdates          bool      `json:"lineupUpdates" gorm:"default:true"`
	SecurityAlerts         bool      `json:"securityAlerts" gorm:"default:true"`
	WeeklyDigest           bool      `json:"weeklyDigest" gorm:"default:false"`
	QuietHoursEnabled      bool      `json:"quietHoursEnabled" gorm:"default:false"`
	QuietHoursStart        string    `json:"quietHoursStart,omitempty" gorm:"default:'22:00'"` // HH:MM format
	QuietHoursEnd          string    `json:"quietHoursEnd,omitempty" gorm:"default:'08:00'"`   // HH:MM format
	PreferredLanguage      string    `json:"preferredLanguage" gorm:"default:'en'"`
	CreatedAt              time.Time `json:"createdAt"`
	UpdatedAt              time.Time `json:"updatedAt"`
}

func (NotificationPreferences) TableName() string {
	return "notification_preferences"
}

// NotificationPreferencesResponse represents the API response for preferences
type NotificationPreferencesResponse struct {
	EmailEnabled      bool   `json:"emailEnabled"`
	PushEnabled       bool   `json:"pushEnabled"`
	MarketingEnabled  bool   `json:"marketingEnabled"`
	TransactionAlerts bool   `json:"transactionAlerts"`
	TicketReminders   bool   `json:"ticketReminders"`
	LineupUpdates     bool   `json:"lineupUpdates"`
	SecurityAlerts    bool   `json:"securityAlerts"`
	WeeklyDigest      bool   `json:"weeklyDigest"`
	QuietHoursEnabled bool   `json:"quietHoursEnabled"`
	QuietHoursStart   string `json:"quietHoursStart,omitempty"`
	QuietHoursEnd     string `json:"quietHoursEnd,omitempty"`
	PreferredLanguage string `json:"preferredLanguage"`
}

// ToResponse converts NotificationPreferences to NotificationPreferencesResponse
func (p *NotificationPreferences) ToResponse() NotificationPreferencesResponse {
	return NotificationPreferencesResponse{
		EmailEnabled:      p.EmailEnabled,
		PushEnabled:       p.PushEnabled,
		MarketingEnabled:  p.MarketingEnabled,
		TransactionAlerts: p.TransactionAlerts,
		TicketReminders:   p.TicketReminders,
		LineupUpdates:     p.LineupUpdates,
		SecurityAlerts:    p.SecurityAlerts,
		WeeklyDigest:      p.WeeklyDigest,
		QuietHoursEnabled: p.QuietHoursEnabled,
		QuietHoursStart:   p.QuietHoursStart,
		QuietHoursEnd:     p.QuietHoursEnd,
		PreferredLanguage: p.PreferredLanguage,
	}
}

// UpdatePreferencesRequest represents a request to update notification preferences
type UpdatePreferencesRequest struct {
	EmailEnabled      *bool   `json:"emailEnabled,omitempty"`
	PushEnabled       *bool   `json:"pushEnabled,omitempty"`
	MarketingEnabled  *bool   `json:"marketingEnabled,omitempty"`
	TransactionAlerts *bool   `json:"transactionAlerts,omitempty"`
	TicketReminders   *bool   `json:"ticketReminders,omitempty"`
	LineupUpdates     *bool   `json:"lineupUpdates,omitempty"`
	SecurityAlerts    *bool   `json:"securityAlerts,omitempty"`
	WeeklyDigest      *bool   `json:"weeklyDigest,omitempty"`
	QuietHoursEnabled *bool   `json:"quietHoursEnabled,omitempty"`
	QuietHoursStart   *string `json:"quietHoursStart,omitempty"`
	QuietHoursEnd     *string `json:"quietHoursEnd,omitempty"`
	PreferredLanguage *string `json:"preferredLanguage,omitempty"`
}

// EmailLogStatus represents the status of an email log entry
type EmailLogStatus string

const (
	EmailLogStatusPending   EmailLogStatus = "PENDING"
	EmailLogStatusSent      EmailLogStatus = "SENT"
	EmailLogStatusDelivered EmailLogStatus = "DELIVERED"
	EmailLogStatusFailed    EmailLogStatus = "FAILED"
	EmailLogStatusBounced   EmailLogStatus = "BOUNCED"
)

// EmailLog represents a log entry for sent emails
type EmailLog struct {
	ID          uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID      *uuid.UUID      `json:"userId,omitempty" gorm:"type:uuid;index"`
	ToEmail     string          `json:"toEmail" gorm:"not null;index"`
	Template    EmailTemplate   `json:"template" gorm:"not null;index"`
	Subject     string          `json:"subject" gorm:"not null"`
	Status      EmailLogStatus  `json:"status" gorm:"default:'PENDING';index"`
	MessageID   string          `json:"messageId,omitempty" gorm:"index"`    // External message ID from email provider
	Error       string          `json:"error,omitempty"`                     // Error message if failed
	Metadata    EmailLogMeta    `json:"metadata" gorm:"type:jsonb;default:'{}'"` // Additional context
	SentAt      *time.Time      `json:"sentAt,omitempty"`
	DeliveredAt *time.Time      `json:"deliveredAt,omitempty"`
	OpenedAt    *time.Time      `json:"openedAt,omitempty"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

func (EmailLog) TableName() string {
	return "email_logs"
}

// EmailLogMeta contains additional metadata for email logs
type EmailLogMeta struct {
	FestivalID   string `json:"festivalId,omitempty"`
	FestivalName string `json:"festivalName,omitempty"`
	TicketID     string `json:"ticketId,omitempty"`
	TransactionID string `json:"transactionId,omitempty"`
	IPAddress    string `json:"ipAddress,omitempty"`
	UserAgent    string `json:"userAgent,omitempty"`
	Retries      int    `json:"retries,omitempty"`
}

// EmailLogResponse represents the API response for an email log
type EmailLogResponse struct {
	ID        uuid.UUID      `json:"id"`
	ToEmail   string         `json:"toEmail"`
	Template  EmailTemplate  `json:"template"`
	Subject   string         `json:"subject"`
	Status    EmailLogStatus `json:"status"`
	SentAt    *string        `json:"sentAt,omitempty"`
	CreatedAt string         `json:"createdAt"`
}

// ToResponse converts EmailLog to EmailLogResponse
func (e *EmailLog) ToResponse() EmailLogResponse {
	var sentAt *string
	if e.SentAt != nil {
		formatted := e.SentAt.Format(time.RFC3339)
		sentAt = &formatted
	}

	return EmailLogResponse{
		ID:        e.ID,
		ToEmail:   e.ToEmail,
		Template:  e.Template,
		Subject:   e.Subject,
		Status:    e.Status,
		SentAt:    sentAt,
		CreatedAt: e.CreatedAt.Format(time.RFC3339),
	}
}

// SendTestEmailRequest represents a request to send a test email
type SendTestEmailRequest struct {
	Template EmailTemplate `json:"template" binding:"required"`
	ToEmail  string        `json:"toEmail" binding:"required,email"`
}

// Email template data structures

// WelcomeEmailData contains data for the welcome email template
type WelcomeEmailData struct {
	UserName     string
	AppName      string
	SupportEmail string
	LoginURL     string
}

// TicketPurchaseEmailData contains data for the ticket purchase email template
type TicketPurchaseEmailData struct {
	UserName       string
	FestivalName   string
	TicketType     string
	TicketCode     string
	Quantity       int
	TotalAmount    string
	PurchaseDate   string
	FestivalDate   string
	FestivalVenue  string
	TicketURL      string
	QRCodeData     string
}

// TicketConfirmationEmailData contains data for the ticket confirmation email template with QR code
type TicketConfirmationEmailData struct {
	// User info
	UserName      string
	HolderName    string

	// Festival info
	FestivalName   string
	FestivalDate   string
	FestivalVenue  string
	LogoURL        string
	PrimaryColor   string
	SecondaryColor string

	// Ticket info
	TicketType     string
	TicketCode     string
	Quantity       int
	Benefits       []string
	AllowsReentry  bool

	// QR Code
	QRCodeDataURI  string // Base64 data URI for inline embedding (data:image/png;base64,...)
	QRCodeB64      string // Raw base64 string (for attachments)

	// Purchase info
	TotalAmount    string
	PurchaseDate   string
	OrderReference string

	// Validity
	ValidFrom      string
	ValidUntil     string
	GatesOpenTime  string

	// Practical info
	ParkingInfo    string
	TransportInfo  string

	// Links
	TicketURL      string
	CalendarURL    string
	WebsiteURL     string
	FacebookURL    string
	InstagramURL   string
	SupportEmail   string
}

// TicketTransferEmailData contains data for the ticket transfer email template
type TicketTransferEmailData struct {
	RecipientName   string
	SenderName      string
	FestivalName    string
	TicketType      string
	TicketCode      string
	FestivalDate    string
	FestivalVenue   string
	TransferDate    string
	TicketURL       string
	IsRecipient     bool // true for recipient email, false for sender confirmation
}

// TopUpEmailData contains data for the top-up confirmation email template
type TopUpEmailData struct {
	UserName       string
	FestivalName   string
	Amount         string
	NewBalance     string
	TransactionID  string
	TransactionDate string
	PaymentMethod  string
	WalletURL      string
}

// RefundEmailData contains data for the refund processed email template
type RefundEmailData struct {
	UserName        string
	FestivalName    string
	Amount          string
	NewBalance      string
	RefundReason    string
	TransactionID   string
	RefundDate      string
	OriginalTxDate  string
}

// PasswordResetEmailData contains data for the password reset email template
type PasswordResetEmailData struct {
	UserName   string
	ResetURL   string
	ExpiresIn  string
	IPAddress  string
	UserAgent  string
}

// SecurityAlertEmailData contains data for the security alert email template
type SecurityAlertEmailData struct {
	UserName        string
	AlertType       string // e.g., "New Login", "Password Changed", "Suspicious Activity"
	AlertTitle      string
	AlertMessage    string
	ActionRequired  string // What the user should do
	Timestamp       string
	IPAddress       string
	Location        string // Geolocation if available
	DeviceInfo      string
	SecurityURL     string // Link to security settings
	SupportEmail    string
	IsUrgent        bool
}
