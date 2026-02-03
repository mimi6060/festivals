package notification

import (
	"bytes"
	"context"
	"embed"
	"encoding/base64"
	"fmt"
	"html/template"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/rs/zerolog/log"
)

//go:embed templates/*.html
var templateFS embed.FS

// Service handles notification business logic
type Service struct {
	repo         Repository
	emailClient  EmailClient
	templates    *template.Template
	baseURL      string
	supportEmail string
	appName      string
}

// ServiceConfig holds configuration for the notification service
type ServiceConfig struct {
	BaseURL      string
	SupportEmail string
	AppName      string
}

// NewService creates a new notification service
func NewService(repo Repository, emailClient EmailClient, cfg ServiceConfig) (*Service, error) {
	// Parse all templates from embedded filesystem
	tmpl, err := template.ParseFS(templateFS, "templates/*.html")
	if err != nil {
		return nil, fmt.Errorf("failed to parse email templates: %w", err)
	}

	return &Service{
		repo:         repo,
		emailClient:  emailClient,
		templates:    tmpl,
		baseURL:      cfg.BaseURL,
		supportEmail: cfg.SupportEmail,
		appName:      cfg.AppName,
	}, nil
}

// SendWelcomeEmail sends a welcome email to a new user
func (s *Service) SendWelcomeEmail(ctx context.Context, userID uuid.UUID, email, userName string) error {
	data := WelcomeEmailData{
		UserName:     userName,
		AppName:      s.appName,
		SupportEmail: s.supportEmail,
		LoginURL:     fmt.Sprintf("%s/login", s.baseURL),
	}

	return s.sendEmail(ctx, &userID, email, EmailTemplateWelcome, data, nil)
}

// SendTicketPurchaseConfirmation sends a ticket purchase confirmation email
func (s *Service) SendTicketPurchaseConfirmation(ctx context.Context, userID uuid.UUID, toEmail string, data TicketPurchaseEmailData) error {
	// Set default ticket URL if not provided
	if data.TicketURL == "" {
		data.TicketURL = fmt.Sprintf("%s/tickets/%s", s.baseURL, data.TicketCode)
	}

	meta := &EmailLogMeta{
		FestivalName: data.FestivalName,
		TicketID:     data.TicketCode,
	}

	return s.sendEmail(ctx, &userID, toEmail, EmailTemplateTicketPurchased, data, meta)
}

// SendTicketTransferNotification sends ticket transfer notifications to both sender and recipient
func (s *Service) SendTicketTransferNotification(ctx context.Context, senderID uuid.UUID, senderEmail string, recipientEmail string, data TicketTransferEmailData) error {
	meta := &EmailLogMeta{
		FestivalName: data.FestivalName,
		TicketID:     data.TicketCode,
	}

	// Send to recipient
	recipientData := data
	recipientData.IsRecipient = true
	if err := s.sendEmail(ctx, nil, recipientEmail, EmailTemplateTicketTransferred, recipientData, meta); err != nil {
		log.Error().Err(err).Str("recipient", recipientEmail).Msg("Failed to send transfer email to recipient")
	}

	// Send confirmation to sender
	senderData := data
	senderData.IsRecipient = false
	return s.sendEmail(ctx, &senderID, senderEmail, EmailTemplateTicketTransferred, senderData, meta)
}

// SendTopUpConfirmation sends a wallet top-up confirmation email
func (s *Service) SendTopUpConfirmation(ctx context.Context, userID uuid.UUID, toEmail string, data TopUpEmailData) error {
	// Set default wallet URL if not provided
	if data.WalletURL == "" {
		data.WalletURL = fmt.Sprintf("%s/wallet", s.baseURL)
	}

	meta := &EmailLogMeta{
		FestivalName:  data.FestivalName,
		TransactionID: data.TransactionID,
	}

	return s.sendEmail(ctx, &userID, toEmail, EmailTemplateTopUpConfirmed, data, meta)
}

// SendRefundNotification sends a refund processed notification email
func (s *Service) SendRefundNotification(ctx context.Context, userID uuid.UUID, toEmail string, data RefundEmailData) error {
	meta := &EmailLogMeta{
		FestivalName:  data.FestivalName,
		TransactionID: data.TransactionID,
	}

	return s.sendEmail(ctx, &userID, toEmail, EmailTemplateRefundProcessed, data, meta)
}

// SendPasswordResetEmail sends a password reset email
func (s *Service) SendPasswordResetEmail(ctx context.Context, userID *uuid.UUID, toEmail string, data PasswordResetEmailData) error {
	meta := &EmailLogMeta{
		IPAddress: data.IPAddress,
		UserAgent: data.UserAgent,
	}

	return s.sendEmail(ctx, userID, toEmail, EmailTemplatePasswordReset, data, meta)
}

// SendSecurityAlertEmail sends a security alert email
func (s *Service) SendSecurityAlertEmail(ctx context.Context, userID *uuid.UUID, toEmail string, data SecurityAlertEmailData) error {
	// Set defaults if not provided
	if data.SecurityURL == "" {
		data.SecurityURL = fmt.Sprintf("%s/account/security", s.baseURL)
	}
	if data.SupportEmail == "" {
		data.SupportEmail = s.supportEmail
	}

	meta := &EmailLogMeta{
		IPAddress: data.IPAddress,
	}

	return s.sendEmail(ctx, userID, toEmail, EmailTemplateSecurityAlert, data, meta)
}

// SendTicketConfirmationEmail sends a ticket confirmation email with QR code
func (s *Service) SendTicketConfirmationEmail(ctx context.Context, userID uuid.UUID, toEmail string, data TicketConfirmationEmailData) error {
	// Set default support email if not provided
	if data.SupportEmail == "" {
		data.SupportEmail = s.supportEmail
	}

	// Set default ticket URL if not provided
	if data.TicketURL == "" {
		data.TicketURL = fmt.Sprintf("%s/tickets/%s", s.baseURL, data.TicketCode)
	}

	meta := &EmailLogMeta{
		FestivalName: data.FestivalName,
		TicketID:     data.TicketCode,
	}

	return s.sendEmail(ctx, &userID, toEmail, EmailTemplateTicketConfirmation, data, meta)
}

// SendTicketConfirmationEmailWithAttachment sends a ticket confirmation email with QR code as attachment
func (s *Service) SendTicketConfirmationEmailWithAttachment(ctx context.Context, userID uuid.UUID, toEmail string, data TicketConfirmationEmailData, qrCodePNG []byte) error {
	// Set default support email if not provided
	if data.SupportEmail == "" {
		data.SupportEmail = s.supportEmail
	}

	// Set default ticket URL if not provided
	if data.TicketURL == "" {
		data.TicketURL = fmt.Sprintf("%s/tickets/%s", s.baseURL, data.TicketCode)
	}

	// Check user preferences
	shouldSend, err := s.ShouldSendEmail(ctx, userID, EmailTemplateTicketConfirmation)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to check email preferences, sending anyway")
	} else if !shouldSend {
		log.Info().
			Str("template", string(EmailTemplateTicketConfirmation)).
			Str("to", toEmail).
			Msg("Email not sent due to user preferences")
		return nil
	}

	// Render HTML template
	htmlBody, err := s.renderTemplate(EmailTemplateTicketConfirmation, data)
	if err != nil {
		return fmt.Errorf("failed to render email template: %w", err)
	}

	// Generate plain text version
	textBody := s.generatePlainText(EmailTemplateTicketConfirmation, data)

	// Create email log entry
	now := time.Now()
	emailLog := &EmailLog{
		ID:        uuid.New(),
		UserID:    &userID,
		ToEmail:   toEmail,
		Template:  EmailTemplateTicketConfirmation,
		Subject:   EmailTemplateTicketConfirmation.GetSubject(),
		Status:    EmailLogStatusPending,
		CreatedAt: now,
		UpdatedAt: now,
		Metadata: EmailLogMeta{
			FestivalName: data.FestivalName,
			TicketID:     data.TicketCode,
		},
	}

	if err := s.repo.CreateEmailLog(ctx, emailLog); err != nil {
		log.Error().Err(err).Msg("Failed to create email log")
	}

	// Prepare attachment
	attachments := []EmailAttachment{
		{
			Name:        fmt.Sprintf("ticket-%s-qr.png", data.TicketCode),
			ContentType: "image/png",
			Data:        encodeToBase64(qrCodePNG),
		},
	}

	// Send email with attachment
	req := EmailSendRequest{
		To:          []string{toEmail},
		Subject:     EmailTemplateTicketConfirmation.GetSubject(),
		HTMLBody:    htmlBody,
		TextBody:    textBody,
		Attachments: attachments,
	}

	result, err := s.emailClient.SendEmailWithAttachments(ctx, req)
	if err != nil {
		emailLog.Status = EmailLogStatusFailed
		emailLog.Error = err.Error()
		emailLog.UpdatedAt = time.Now()
		_ = s.repo.UpdateEmailLog(ctx, emailLog)

		return errors.Wrap(err, "EMAIL_SEND_FAILED", "Failed to send ticket confirmation email")
	}

	// Update log with success
	emailLog.Status = EmailLogStatusSent
	emailLog.MessageID = result.MessageID
	emailLog.SentAt = &now
	emailLog.UpdatedAt = time.Now()
	_ = s.repo.UpdateEmailLog(ctx, emailLog)

	log.Info().
		Str("template", string(EmailTemplateTicketConfirmation)).
		Str("to", toEmail).
		Str("ticketCode", data.TicketCode).
		Str("messageId", result.MessageID).
		Msg("Ticket confirmation email sent successfully")

	return nil
}

// encodeToBase64 encodes bytes to base64 string
func encodeToBase64(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

// GetUserPreferences retrieves or creates default notification preferences for a user
func (s *Service) GetUserPreferences(ctx context.Context, userID uuid.UUID) (*NotificationPreferences, error) {
	prefs, err := s.repo.GetPreferencesByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Return existing preferences
	if prefs != nil {
		return prefs, nil
	}

	// Create default preferences for new user
	prefs = &NotificationPreferences{
		ID:                uuid.New(),
		UserID:            userID,
		EmailEnabled:      true,
		PushEnabled:       true,
		MarketingEnabled:  false,
		TransactionAlerts: true,
		TicketReminders:   true,
		LineupUpdates:     true,
		SecurityAlerts:    true,
		WeeklyDigest:      false,
		QuietHoursEnabled: false,
		QuietHoursStart:   "22:00",
		QuietHoursEnd:     "08:00",
		PreferredLanguage: "en",
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := s.repo.CreatePreferences(ctx, prefs); err != nil {
		return nil, fmt.Errorf("failed to create default preferences: %w", err)
	}

	return prefs, nil
}

// UpdatePreferences updates notification preferences for a user
func (s *Service) UpdatePreferences(ctx context.Context, userID uuid.UUID, req UpdatePreferencesRequest) (*NotificationPreferences, error) {
	prefs, err := s.GetUserPreferences(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Apply updates
	if req.EmailEnabled != nil {
		prefs.EmailEnabled = *req.EmailEnabled
	}
	if req.PushEnabled != nil {
		prefs.PushEnabled = *req.PushEnabled
	}
	if req.MarketingEnabled != nil {
		prefs.MarketingEnabled = *req.MarketingEnabled
	}
	if req.TransactionAlerts != nil {
		prefs.TransactionAlerts = *req.TransactionAlerts
	}
	if req.TicketReminders != nil {
		prefs.TicketReminders = *req.TicketReminders
	}
	if req.LineupUpdates != nil {
		prefs.LineupUpdates = *req.LineupUpdates
	}
	if req.SecurityAlerts != nil {
		prefs.SecurityAlerts = *req.SecurityAlerts
	}
	if req.WeeklyDigest != nil {
		prefs.WeeklyDigest = *req.WeeklyDigest
	}
	if req.QuietHoursEnabled != nil {
		prefs.QuietHoursEnabled = *req.QuietHoursEnabled
	}
	if req.QuietHoursStart != nil {
		prefs.QuietHoursStart = *req.QuietHoursStart
	}
	if req.QuietHoursEnd != nil {
		prefs.QuietHoursEnd = *req.QuietHoursEnd
	}
	if req.PreferredLanguage != nil {
		prefs.PreferredLanguage = *req.PreferredLanguage
	}

	prefs.UpdatedAt = time.Now()

	if err := s.repo.UpdatePreferences(ctx, prefs); err != nil {
		return nil, fmt.Errorf("failed to update preferences: %w", err)
	}

	return prefs, nil
}

// ShouldSendEmail checks if an email should be sent based on user preferences
func (s *Service) ShouldSendEmail(ctx context.Context, userID uuid.UUID, template EmailTemplate) (bool, error) {
	prefs, err := s.GetUserPreferences(ctx, userID)
	if err != nil {
		return false, err
	}

	// Check if email is globally disabled
	if !prefs.EmailEnabled {
		return false, nil
	}

	// Check template-specific preferences
	switch template {
	case EmailTemplateWelcome, EmailTemplatePasswordReset, EmailTemplateSecurityAlert:
		// Security/account emails are always sent if email is enabled
		return prefs.SecurityAlerts, nil
	case EmailTemplateTicketPurchased, EmailTemplateTicketConfirmation, EmailTemplateTicketTransferred:
		return prefs.TicketReminders, nil
	case EmailTemplateTopUpConfirmed, EmailTemplateRefundProcessed:
		return prefs.TransactionAlerts, nil
	default:
		return true, nil
	}
}

// SendTestEmail sends a test email for a given template (admin use)
func (s *Service) SendTestEmail(ctx context.Context, template EmailTemplate, toEmail string) error {
	var data interface{}

	// Generate sample data for each template type
	switch template {
	case EmailTemplateWelcome:
		data = WelcomeEmailData{
			UserName:     "Test User",
			AppName:      s.appName,
			SupportEmail: s.supportEmail,
			LoginURL:     fmt.Sprintf("%s/login", s.baseURL),
		}
	case EmailTemplateTicketPurchased:
		data = TicketPurchaseEmailData{
			UserName:      "Test User",
			FestivalName:  "Summer Festival 2024",
			TicketType:    "VIP Pass",
			TicketCode:    "TEST-TICKET-123",
			Quantity:      1,
			TotalAmount:   "150.00 EUR",
			PurchaseDate:  time.Now().Format("January 2, 2006"),
			FestivalDate:  "July 15-17, 2024",
			FestivalVenue: "Festival Park, Berlin",
			TicketURL:     fmt.Sprintf("%s/tickets/TEST-TICKET-123", s.baseURL),
		}
	case EmailTemplateTicketConfirmation:
		data = TicketConfirmationEmailData{
			UserName:       "Test User",
			HolderName:     "Test User",
			FestivalName:   "Summer Festival 2024",
			FestivalDate:   "July 15-17, 2024",
			FestivalVenue:  "Festival Park, Berlin",
			PrimaryColor:   "#6366f1",
			SecondaryColor: "#8b5cf6",
			TicketType:     "VIP Pass",
			TicketCode:     "TEST-TICKET-123",
			Quantity:       1,
			Benefits:       []string{"Priority Entry", "VIP Lounge Access", "Free Drink"},
			AllowsReentry:  true,
			QRCodeDataURI:  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
			TotalAmount:    "150.00 EUR",
			PurchaseDate:   time.Now().Format("January 2, 2006"),
			OrderReference: "ORD-TEST-123",
			ValidFrom:      "July 15, 2024 10:00",
			ValidUntil:     "July 17, 2024 23:59",
			GatesOpenTime:  "10:00 AM",
			ParkingInfo:    "Free parking available on-site",
			TransportInfo:  "Bus line 42 stops at the main entrance",
			TicketURL:      fmt.Sprintf("%s/tickets/TEST-TICKET-123", s.baseURL),
			SupportEmail:   s.supportEmail,
		}
	case EmailTemplateTicketTransferred:
		data = TicketTransferEmailData{
			RecipientName: "Jane Doe",
			SenderName:    "Test User",
			FestivalName:  "Summer Festival 2024",
			TicketType:    "VIP Pass",
			TicketCode:    "TEST-TICKET-123",
			FestivalDate:  "July 15-17, 2024",
			FestivalVenue: "Festival Park, Berlin",
			TransferDate:  time.Now().Format("January 2, 2006"),
			TicketURL:     fmt.Sprintf("%s/tickets/TEST-TICKET-123", s.baseURL),
			IsRecipient:   true,
		}
	case EmailTemplateTopUpConfirmed:
		data = TopUpEmailData{
			UserName:        "Test User",
			FestivalName:    "Summer Festival 2024",
			Amount:          "50.00 EUR",
			NewBalance:      "100 Tokens",
			TransactionID:   "TXN-TEST-123",
			TransactionDate: time.Now().Format("January 2, 2006 15:04"),
			PaymentMethod:   "Credit Card",
			WalletURL:       fmt.Sprintf("%s/wallet", s.baseURL),
		}
	case EmailTemplateRefundProcessed:
		data = RefundEmailData{
			UserName:       "Test User",
			FestivalName:   "Summer Festival 2024",
			Amount:         "25.00 EUR",
			NewBalance:     "75 Tokens",
			RefundReason:   "Order cancellation",
			TransactionID:  "TXN-REFUND-123",
			RefundDate:     time.Now().Format("January 2, 2006 15:04"),
			OriginalTxDate: time.Now().Add(-24 * time.Hour).Format("January 2, 2006"),
		}
	case EmailTemplatePasswordReset:
		data = PasswordResetEmailData{
			UserName:  "Test User",
			ResetURL:  fmt.Sprintf("%s/reset-password?token=test-token", s.baseURL),
			ExpiresIn: "1 hour",
			IPAddress: "127.0.0.1",
			UserAgent: "Test Browser",
		}
	case EmailTemplateSecurityAlert:
		data = SecurityAlertEmailData{
			UserName:       "Test User",
			AlertType:      "New Login Detected",
			AlertTitle:     "New Login from Unknown Device",
			AlertMessage:   "A new sign-in to your account was detected from an unrecognized device.",
			ActionRequired: "If this wasn't you, please change your password immediately and review your account activity.",
			Timestamp:      time.Now().Format("January 2, 2006 at 15:04 MST"),
			IPAddress:      "192.168.1.100",
			Location:       "Berlin, Germany",
			DeviceInfo:     "Chrome on Windows",
			SecurityURL:    fmt.Sprintf("%s/account/security", s.baseURL),
			SupportEmail:   s.supportEmail,
			IsUrgent:       false,
		}
	default:
		return fmt.Errorf("unknown template: %s", template)
	}

	return s.sendEmail(ctx, nil, toEmail, template, data, nil)
}

// sendEmail renders a template and sends the email
func (s *Service) sendEmail(ctx context.Context, userID *uuid.UUID, toEmail string, template EmailTemplate, data interface{}, meta *EmailLogMeta) error {
	// Check user preferences if userID is provided
	if userID != nil {
		shouldSend, err := s.ShouldSendEmail(ctx, *userID, template)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to check email preferences, sending anyway")
		} else if !shouldSend {
			log.Info().
				Str("template", string(template)).
				Str("to", toEmail).
				Msg("Email not sent due to user preferences")
			return nil
		}
	}

	// Render HTML template
	htmlBody, err := s.renderTemplate(template, data)
	if err != nil {
		return fmt.Errorf("failed to render email template: %w", err)
	}

	// Generate plain text version (simplified)
	textBody := s.generatePlainText(template, data)

	// Create email log entry
	now := time.Now()
	emailLog := &EmailLog{
		ID:        uuid.New(),
		UserID:    userID,
		ToEmail:   toEmail,
		Template:  template,
		Subject:   template.GetSubject(),
		Status:    EmailLogStatusPending,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if meta != nil {
		emailLog.Metadata = *meta
	}

	if err := s.repo.CreateEmailLog(ctx, emailLog); err != nil {
		log.Error().Err(err).Msg("Failed to create email log")
		// Continue sending even if logging fails
	}

	// Send email
	result, err := s.emailClient.SendEmail(ctx, toEmail, template.GetSubject(), htmlBody, textBody)
	if err != nil {
		emailLog.Status = EmailLogStatusFailed
		emailLog.Error = err.Error()
		emailLog.UpdatedAt = time.Now()
		_ = s.repo.UpdateEmailLog(ctx, emailLog)

		return errors.Wrap(err, "EMAIL_SEND_FAILED", "Failed to send email")
	}

	// Update log with success
	emailLog.Status = EmailLogStatusSent
	emailLog.MessageID = result.MessageID
	emailLog.SentAt = &now
	emailLog.UpdatedAt = time.Now()
	_ = s.repo.UpdateEmailLog(ctx, emailLog)

	log.Info().
		Str("template", string(template)).
		Str("to", toEmail).
		Str("messageId", result.MessageID).
		Msg("Email sent successfully")

	return nil
}

// renderTemplate renders an email template with the given data
func (s *Service) renderTemplate(template EmailTemplate, data interface{}) (string, error) {
	templatePath := template.GetTemplatePath()
	if templatePath == "" {
		return "", fmt.Errorf("no template path for template: %s", template)
	}

	var buf bytes.Buffer
	if err := s.templates.ExecuteTemplate(&buf, templatePath, data); err != nil {
		return "", fmt.Errorf("failed to execute template %s: %w", templatePath, err)
	}

	return buf.String(), nil
}

// generatePlainText generates a plain text version of the email
func (s *Service) generatePlainText(template EmailTemplate, data interface{}) string {
	// Generate simple plain text versions based on template type
	switch template {
	case EmailTemplateWelcome:
		if d, ok := data.(WelcomeEmailData); ok {
			return fmt.Sprintf("Welcome to %s, %s!\n\nThank you for joining us. You can log in at: %s\n\nIf you have any questions, contact us at %s",
				d.AppName, d.UserName, d.LoginURL, d.SupportEmail)
		}
	case EmailTemplateTicketPurchased:
		if d, ok := data.(TicketPurchaseEmailData); ok {
			return fmt.Sprintf("Hi %s,\n\nYour ticket purchase is confirmed!\n\nFestival: %s\nTicket: %s\nCode: %s\nTotal: %s\n\nView your ticket at: %s",
				d.UserName, d.FestivalName, d.TicketType, d.TicketCode, d.TotalAmount, d.TicketURL)
		}
	case EmailTemplateTicketConfirmation:
		if d, ok := data.(TicketConfirmationEmailData); ok {
			reentryInfo := "No re-entry allowed"
			if d.AllowsReentry {
				reentryInfo = "Re-entry is permitted"
			}
			return fmt.Sprintf("Hi %s,\n\nYour ticket for %s is ready!\n\n"+
				"TICKET DETAILS\n"+
				"--------------\n"+
				"Festival: %s\n"+
				"Ticket Type: %s\n"+
				"Ticket Code: %s\n"+
				"Date: %s\n"+
				"Venue: %s\n\n"+
				"PURCHASE SUMMARY\n"+
				"----------------\n"+
				"Quantity: %d\n"+
				"Total: %s\n"+
				"Order Reference: %s\n\n"+
				"PRACTICAL INFO\n"+
				"--------------\n"+
				"Gates Open: %s\n"+
				"Valid From: %s\n"+
				"Valid Until: %s\n"+
				"%s\n\n"+
				"View your ticket with QR code at: %s\n\n"+
				"IMPORTANT: Save your QR code! You'll need it to enter the festival.\n\n"+
				"Questions? Contact us at %s",
				d.UserName, d.FestivalName,
				d.FestivalName, d.TicketType, d.TicketCode, d.FestivalDate, d.FestivalVenue,
				d.Quantity, d.TotalAmount, d.OrderReference,
				d.GatesOpenTime, d.ValidFrom, d.ValidUntil, reentryInfo,
				d.TicketURL, d.SupportEmail)
		}
	case EmailTemplateTicketTransferred:
		if d, ok := data.(TicketTransferEmailData); ok {
			if d.IsRecipient {
				return fmt.Sprintf("Hi %s,\n\n%s has transferred a ticket to you!\n\nFestival: %s\nTicket: %s\nCode: %s\n\nView your ticket at: %s",
					d.RecipientName, d.SenderName, d.FestivalName, d.TicketType, d.TicketCode, d.TicketURL)
			}
			return fmt.Sprintf("Hi %s,\n\nYou have successfully transferred your ticket to %s.\n\nFestival: %s\nTicket: %s",
				d.SenderName, d.RecipientName, d.FestivalName, d.TicketType)
		}
	case EmailTemplateTopUpConfirmed:
		if d, ok := data.(TopUpEmailData); ok {
			return fmt.Sprintf("Hi %s,\n\nYour wallet top-up is confirmed!\n\nFestival: %s\nAmount: %s\nNew Balance: %s\nTransaction: %s\n\nView your wallet at: %s",
				d.UserName, d.FestivalName, d.Amount, d.NewBalance, d.TransactionID, d.WalletURL)
		}
	case EmailTemplateRefundProcessed:
		if d, ok := data.(RefundEmailData); ok {
			return fmt.Sprintf("Hi %s,\n\nYour refund has been processed.\n\nFestival: %s\nAmount: %s\nNew Balance: %s\nReason: %s",
				d.UserName, d.FestivalName, d.Amount, d.NewBalance, d.RefundReason)
		}
	case EmailTemplatePasswordReset:
		if d, ok := data.(PasswordResetEmailData); ok {
			return fmt.Sprintf("Hi %s,\n\nA password reset was requested for your account.\n\nReset your password: %s\n\nThis link expires in %s.\n\nIf you didn't request this, please ignore this email.",
				d.UserName, d.ResetURL, d.ExpiresIn)
		}
	case EmailTemplateSecurityAlert:
		if d, ok := data.(SecurityAlertEmailData); ok {
			urgency := ""
			if d.IsUrgent {
				urgency = "[URGENT] "
			}
			return fmt.Sprintf("%sHi %s,\n\nSecurity Alert: %s\n\n%s\n\nTime: %s\nIP Address: %s\nLocation: %s\nDevice: %s\n\n%s\n\nReview your security settings: %s\n\nIf you need help, contact: %s",
				urgency, d.UserName, d.AlertTitle, d.AlertMessage, d.Timestamp, d.IPAddress, d.Location, d.DeviceInfo, d.ActionRequired, d.SecurityURL, d.SupportEmail)
		}
	}

	return "This is a notification from Festivals."
}

// GetEmailLogs retrieves email logs for a user
func (s *Service) GetEmailLogs(ctx context.Context, userID uuid.UUID, page, perPage int) ([]EmailLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetEmailLogsByUser(ctx, userID, offset, perPage)
}
