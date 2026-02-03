package notification

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/email"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/sms"
	"github.com/rs/zerolog/log"
)

// Channel represents a notification delivery channel
type Channel string

const (
	ChannelEmail  Channel = "email"
	ChannelSMS    Channel = "sms"
	ChannelPush   Channel = "push"
	ChannelInApp  Channel = "in_app"
)

// EventType represents a notification event type
type EventType string

const (
	EventTypeTransactional    EventType = "transactional"
	EventTypeMarketing        EventType = "marketing"
	EventTypeSecurityAlert    EventType = "security_alert"
	EventTypeTicketReminder   EventType = "ticket_reminder"
	EventTypeLineupUpdate     EventType = "lineup_update"
	EventTypeEmergency        EventType = "emergency"
	EventTypeSOSConfirmation  EventType = "sos_confirmation"
	EventTypePaymentConfirm   EventType = "payment_confirm"
	EventTypeRefund           EventType = "refund"
	EventTypeWelcome          EventType = "welcome"
	EventTypeBroadcast        EventType = "broadcast"
)

// Priority represents notification priority
type Priority string

const (
	PriorityLow      Priority = "low"
	PriorityNormal   Priority = "normal"
	PriorityHigh     Priority = "high"
	PriorityCritical Priority = "critical"
)

// NotificationRequest represents a request to send a notification
type NotificationRequest struct {
	ID          uuid.UUID              `json:"id"`
	UserID      uuid.UUID              `json:"userId"`
	FestivalID  *uuid.UUID             `json:"festivalId,omitempty"`
	EventType   EventType              `json:"eventType"`
	Priority    Priority               `json:"priority"`
	Channels    []Channel              `json:"channels"`      // Requested channels
	Title       string                 `json:"title"`
	Message     string                 `json:"message"`
	Data        map[string]interface{} `json:"data,omitempty"` // Template data
	Metadata    map[string]string      `json:"metadata,omitempty"`
	ScheduledAt *time.Time             `json:"scheduledAt,omitempty"`
	ExpiresAt   *time.Time             `json:"expiresAt,omitempty"`

	// Channel-specific fields
	Email     *EmailNotification     `json:"email,omitempty"`
	SMS       *SMSNotification       `json:"sms,omitempty"`
	Push      *PushNotificationData  `json:"push,omitempty"`
	InApp     *InAppNotification     `json:"inApp,omitempty"`
}

// EmailNotification contains email-specific data
type EmailNotification struct {
	To          string        `json:"to"`
	Subject     string        `json:"subject,omitempty"`
	Template    EmailTemplate `json:"template,omitempty"`
	HTMLBody    string        `json:"htmlBody,omitempty"`
	TextBody    string        `json:"textBody,omitempty"`
	Attachments []Attachment  `json:"attachments,omitempty"`
}

// Attachment represents an email attachment
type Attachment struct {
	Name        string `json:"name"`
	ContentType string `json:"contentType"`
	Data        []byte `json:"data"`
}

// SMSNotification contains SMS-specific data
type SMSNotification struct {
	To       string      `json:"to"`
	Template SMSTemplate `json:"template,omitempty"`
	Message  string      `json:"message,omitempty"`
}

// PushNotificationData contains push-specific data
type PushNotificationData struct {
	Title       string                 `json:"title"`
	Body        string                 `json:"body"`
	ImageURL    string                 `json:"imageUrl,omitempty"`
	Badge       *int                   `json:"badge,omitempty"`
	Sound       string                 `json:"sound,omitempty"`
	Data        map[string]string      `json:"data,omitempty"`
	Topic       string                 `json:"topic,omitempty"`
	DeviceToken string                 `json:"deviceToken,omitempty"`
	CollapseKey string                 `json:"collapseKey,omitempty"`
	TTL         *int                   `json:"ttl,omitempty"` // Time to live in seconds
}

// InAppNotification contains in-app notification data
type InAppNotification struct {
	Type        string                 `json:"type"` // toast, banner, modal
	Title       string                 `json:"title"`
	Body        string                 `json:"body"`
	ActionURL   string                 `json:"actionUrl,omitempty"`
	ActionText  string                 `json:"actionText,omitempty"`
	ImageURL    string                 `json:"imageUrl,omitempty"`
	Dismissible bool                   `json:"dismissible"`
	Duration    int                    `json:"duration,omitempty"` // Auto-dismiss duration in ms
	Data        map[string]interface{} `json:"data,omitempty"`
}

// DeliveryResult represents the result of delivering a notification
type DeliveryResult struct {
	Channel    Channel   `json:"channel"`
	Success    bool      `json:"success"`
	MessageID  string    `json:"messageId,omitempty"`
	Error      string    `json:"error,omitempty"`
	DeliveredAt time.Time `json:"deliveredAt,omitempty"`
}

// NotificationResult represents the overall result of a notification request
type NotificationResult struct {
	ID            uuid.UUID        `json:"id"`
	RequestID     uuid.UUID        `json:"requestId"`
	Results       []DeliveryResult `json:"results"`
	AllSucceeded  bool             `json:"allSucceeded"`
	PartialFailed bool             `json:"partialFailed"`
	AllFailed     bool             `json:"allFailed"`
	ProcessedAt   time.Time        `json:"processedAt"`
}

// NotificationHub is the central hub for sending notifications across multiple channels
type NotificationHub struct {
	emailClient    *email.PostalClient
	smsClient      *sms.TwilioClient
	pushService    *PushService
	prefsService   *PreferencesService
	repo           Repository
	templates      *template.Template
	inAppCallbacks []func(userID uuid.UUID, notification *InAppNotification)

	// Configuration
	config HubConfig

	// Metrics
	mu             sync.RWMutex
	sentCount      map[Channel]int64
	failedCount    map[Channel]int64
}

// HubConfig holds configuration for the notification hub
type HubConfig struct {
	AppName           string
	BaseURL           string
	SupportEmail      string
	DefaultPriority   Priority
	EnableBatching    bool
	BatchInterval     time.Duration
	MaxBatchSize      int
	RetryAttempts     int
	RetryDelay        time.Duration
}

// NewNotificationHub creates a new notification hub
func NewNotificationHub(
	emailClient *email.PostalClient,
	smsClient *sms.TwilioClient,
	pushService *PushService,
	prefsService *PreferencesService,
	repo Repository,
	config HubConfig,
) (*NotificationHub, error) {
	// Parse email templates
	tmpl, err := template.ParseFS(templateFS, "templates/*.html")
	if err != nil {
		log.Warn().Err(err).Msg("Failed to parse email templates, continuing without templates")
		tmpl = template.New("empty")
	}

	if config.DefaultPriority == "" {
		config.DefaultPriority = PriorityNormal
	}
	if config.RetryAttempts == 0 {
		config.RetryAttempts = 3
	}
	if config.RetryDelay == 0 {
		config.RetryDelay = time.Second
	}

	return &NotificationHub{
		emailClient:    emailClient,
		smsClient:      smsClient,
		pushService:    pushService,
		prefsService:   prefsService,
		repo:           repo,
		templates:      tmpl,
		config:         config,
		inAppCallbacks: make([]func(uuid.UUID, *InAppNotification), 0),
		sentCount:      make(map[Channel]int64),
		failedCount:    make(map[Channel]int64),
	}, nil
}

// Send sends a notification through all requested channels
func (h *NotificationHub) Send(ctx context.Context, req *NotificationRequest) (*NotificationResult, error) {
	if req.ID == uuid.Nil {
		req.ID = uuid.New()
	}
	if req.Priority == "" {
		req.Priority = h.config.DefaultPriority
	}

	result := &NotificationResult{
		ID:          uuid.New(),
		RequestID:   req.ID,
		Results:     make([]DeliveryResult, 0),
		ProcessedAt: time.Now(),
	}

	// Check if notification is expired
	if req.ExpiresAt != nil && time.Now().After(*req.ExpiresAt) {
		log.Info().
			Str("requestId", req.ID.String()).
			Msg("Notification expired, skipping")
		result.AllFailed = true
		return result, nil
	}

	// Get user preferences
	prefs, err := h.prefsService.GetUserPreferences(ctx, req.UserID)
	if err != nil {
		log.Warn().Err(err).
			Str("userId", req.UserID.String()).
			Msg("Failed to get user preferences, using defaults")
		prefs = h.prefsService.GetDefaultPreferences(req.UserID)
	}

	// Check quiet hours
	if !h.canSendDuringQuietHours(req, prefs) {
		log.Info().
			Str("requestId", req.ID.String()).
			Str("userId", req.UserID.String()).
			Msg("Notification blocked due to quiet hours")
		result.AllFailed = true
		return result, nil
	}

	// Filter channels based on preferences
	allowedChannels := h.filterChannelsByPreferences(req.Channels, req.EventType, prefs)
	if len(allowedChannels) == 0 {
		log.Info().
			Str("requestId", req.ID.String()).
			Str("userId", req.UserID.String()).
			Msg("No channels available after preference filtering")
		result.AllFailed = true
		return result, nil
	}

	// Send to each channel
	successCount := 0
	failureCount := 0

	for _, channel := range allowedChannels {
		deliveryResult := h.deliverToChannel(ctx, channel, req, prefs)
		result.Results = append(result.Results, deliveryResult)

		h.mu.Lock()
		if deliveryResult.Success {
			successCount++
			h.sentCount[channel]++
		} else {
			failureCount++
			h.failedCount[channel]++
		}
		h.mu.Unlock()
	}

	// Set result flags
	result.AllSucceeded = failureCount == 0 && successCount > 0
	result.AllFailed = successCount == 0
	result.PartialFailed = successCount > 0 && failureCount > 0

	log.Info().
		Str("requestId", req.ID.String()).
		Str("userId", req.UserID.String()).
		Int("successCount", successCount).
		Int("failureCount", failureCount).
		Msg("Notification processed")

	return result, nil
}

// SendBatch sends multiple notifications
func (h *NotificationHub) SendBatch(ctx context.Context, requests []*NotificationRequest) ([]*NotificationResult, error) {
	results := make([]*NotificationResult, 0, len(requests))

	for _, req := range requests {
		result, err := h.Send(ctx, req)
		if err != nil {
			log.Error().Err(err).
				Str("requestId", req.ID.String()).
				Msg("Failed to process notification in batch")
			// Continue processing other notifications
		}
		if result != nil {
			results = append(results, result)
		}
	}

	return results, nil
}

// deliverToChannel delivers a notification to a specific channel
func (h *NotificationHub) deliverToChannel(ctx context.Context, channel Channel, req *NotificationRequest, prefs *UserPreferences) DeliveryResult {
	result := DeliveryResult{
		Channel:     channel,
		DeliveredAt: time.Now(),
	}

	var err error
	var messageID string

	switch channel {
	case ChannelEmail:
		messageID, err = h.deliverEmail(ctx, req, prefs)
	case ChannelSMS:
		messageID, err = h.deliverSMS(ctx, req)
	case ChannelPush:
		messageID, err = h.deliverPush(ctx, req)
	case ChannelInApp:
		err = h.deliverInApp(ctx, req)
	default:
		err = fmt.Errorf("unsupported channel: %s", channel)
	}

	if err != nil {
		result.Success = false
		result.Error = err.Error()
		log.Error().Err(err).
			Str("channel", string(channel)).
			Str("requestId", req.ID.String()).
			Msg("Failed to deliver notification")
	} else {
		result.Success = true
		result.MessageID = messageID
	}

	return result
}

// deliverEmail delivers a notification via email
func (h *NotificationHub) deliverEmail(ctx context.Context, req *NotificationRequest, prefs *UserPreferences) (string, error) {
	if h.emailClient == nil {
		return "", fmt.Errorf("email client not configured")
	}

	emailData := req.Email
	if emailData == nil || emailData.To == "" {
		return "", fmt.Errorf("email recipient not specified")
	}

	// Render template if specified
	var htmlBody, textBody string
	if emailData.Template != "" && emailData.Template.IsValid() {
		var err error
		htmlBody, err = h.renderEmailTemplate(emailData.Template, req.Data)
		if err != nil {
			log.Warn().Err(err).
				Str("template", string(emailData.Template)).
				Msg("Failed to render email template, using message")
			htmlBody = req.Message
		}
		textBody = h.generatePlainText(emailData.Template, req.Data)
	} else {
		htmlBody = emailData.HTMLBody
		if htmlBody == "" {
			htmlBody = req.Message
		}
		textBody = emailData.TextBody
		if textBody == "" {
			textBody = req.Message
		}
	}

	// Determine subject
	subject := emailData.Subject
	if subject == "" && emailData.Template != "" {
		subject = emailData.Template.GetSubject()
	}
	if subject == "" {
		subject = req.Title
	}

	// Send email
	result, err := h.emailClient.SendEmail(ctx, emailData.To, subject, htmlBody, textBody)
	if err != nil {
		return "", fmt.Errorf("failed to send email: %w", err)
	}

	return result.MessageID, nil
}

// deliverSMS delivers a notification via SMS
func (h *NotificationHub) deliverSMS(ctx context.Context, req *NotificationRequest) (string, error) {
	if h.smsClient == nil {
		return "", fmt.Errorf("SMS client not configured")
	}

	smsData := req.SMS
	if smsData == nil || smsData.To == "" {
		return "", fmt.Errorf("SMS recipient not specified")
	}

	// Get message content
	message := smsData.Message
	if message == "" {
		message = req.Message
	}

	// Send SMS
	result, err := h.smsClient.SendSMS(ctx, smsData.To, message)
	if err != nil {
		return "", fmt.Errorf("failed to send SMS: %w", err)
	}

	return result.MessageSID, nil
}

// deliverPush delivers a notification via push notification
func (h *NotificationHub) deliverPush(ctx context.Context, req *NotificationRequest) (string, error) {
	if h.pushService == nil {
		return "", fmt.Errorf("push service not configured")
	}

	pushData := req.Push
	if pushData == nil {
		pushData = &PushNotificationData{
			Title: req.Title,
			Body:  req.Message,
		}
	}

	// Build push notification
	notification := &PushNotification{
		Title:       pushData.Title,
		Body:        pushData.Body,
		ImageURL:    pushData.ImageURL,
		Badge:       pushData.Badge,
		Sound:       pushData.Sound,
		Data:        pushData.Data,
		CollapseKey: pushData.CollapseKey,
	}

	if pushData.TTL != nil {
		notification.TTL = time.Duration(*pushData.TTL) * time.Second
	}

	// Send to user's device(s)
	if pushData.DeviceToken != "" {
		return h.pushService.SendToDevice(ctx, pushData.DeviceToken, notification)
	}

	// Send to user's registered devices
	return h.pushService.SendToUser(ctx, req.UserID, notification)
}

// deliverInApp delivers an in-app notification
func (h *NotificationHub) deliverInApp(ctx context.Context, req *NotificationRequest) error {
	inAppData := req.InApp
	if inAppData == nil {
		inAppData = &InAppNotification{
			Type:        "toast",
			Title:       req.Title,
			Body:        req.Message,
			Dismissible: true,
			Duration:    5000,
		}
	}

	// Call registered callbacks
	for _, callback := range h.inAppCallbacks {
		callback(req.UserID, inAppData)
	}

	return nil
}

// RegisterInAppCallback registers a callback for in-app notifications
func (h *NotificationHub) RegisterInAppCallback(callback func(userID uuid.UUID, notification *InAppNotification)) {
	h.inAppCallbacks = append(h.inAppCallbacks, callback)
}

// filterChannelsByPreferences filters channels based on user preferences
func (h *NotificationHub) filterChannelsByPreferences(channels []Channel, eventType EventType, prefs *UserPreferences) []Channel {
	if prefs == nil {
		return channels
	}

	allowed := make([]Channel, 0, len(channels))

	for _, channel := range channels {
		if h.isChannelAllowed(channel, eventType, prefs) {
			allowed = append(allowed, channel)
		}
	}

	return allowed
}

// isChannelAllowed checks if a channel is allowed based on preferences
func (h *NotificationHub) isChannelAllowed(channel Channel, eventType EventType, prefs *UserPreferences) bool {
	// Emergency and security notifications always allowed
	if eventType == EventTypeEmergency || eventType == EventTypeSecurityAlert {
		return true
	}

	switch channel {
	case ChannelEmail:
		if !prefs.GlobalEmailEnabled {
			return false
		}
	case ChannelSMS:
		if !prefs.GlobalSMSEnabled {
			return false
		}
	case ChannelPush:
		if !prefs.GlobalPushEnabled {
			return false
		}
	case ChannelInApp:
		if !prefs.GlobalInAppEnabled {
			return false
		}
	}

	// Check event type preferences
	return h.isEventTypeAllowed(eventType, channel, prefs)
}

// isEventTypeAllowed checks if an event type is allowed for a channel
func (h *NotificationHub) isEventTypeAllowed(eventType EventType, channel Channel, prefs *UserPreferences) bool {
	// Get channel preference for this event type
	channelPref, ok := prefs.ChannelPreferences[eventType]
	if !ok {
		// Default to allowing if not specifically configured
		return true
	}

	switch channel {
	case ChannelEmail:
		return channelPref.Email
	case ChannelSMS:
		return channelPref.SMS
	case ChannelPush:
		return channelPref.Push
	case ChannelInApp:
		return channelPref.InApp
	}

	return true
}

// canSendDuringQuietHours checks if notifications can be sent during quiet hours
func (h *NotificationHub) canSendDuringQuietHours(req *NotificationRequest, prefs *UserPreferences) bool {
	// Critical and emergency notifications bypass quiet hours
	if req.Priority == PriorityCritical || req.EventType == EventTypeEmergency || req.EventType == EventTypeSecurityAlert {
		return true
	}

	if prefs == nil || !prefs.QuietHoursEnabled {
		return true
	}

	return !h.prefsService.IsInQuietHours(prefs)
}

// renderEmailTemplate renders an email template
func (h *NotificationHub) renderEmailTemplate(templateType EmailTemplate, data map[string]interface{}) (string, error) {
	templatePath := templateType.GetTemplatePath()
	if templatePath == "" {
		return "", fmt.Errorf("no template path for template: %s", templateType)
	}

	var buf bytes.Buffer
	if err := h.templates.ExecuteTemplate(&buf, templatePath, data); err != nil {
		return "", fmt.Errorf("failed to execute template %s: %w", templatePath, err)
	}

	return buf.String(), nil
}

// generatePlainText generates plain text version of an email
func (h *NotificationHub) generatePlainText(templateType EmailTemplate, data map[string]interface{}) string {
	// Simplified plain text generation
	if data == nil {
		return "This is a notification from " + h.config.AppName
	}

	var text string
	if userName, ok := data["UserName"].(string); ok {
		text = fmt.Sprintf("Hi %s,\n\n", userName)
	}

	if message, ok := data["Message"].(string); ok {
		text += message
	}

	return text
}

// GetStats returns hub statistics
func (h *NotificationHub) GetStats() map[string]interface{} {
	h.mu.RLock()
	defer h.mu.RUnlock()

	stats := make(map[string]interface{})

	sentCopy := make(map[Channel]int64)
	for k, v := range h.sentCount {
		sentCopy[k] = v
	}
	stats["sent"] = sentCopy

	failedCopy := make(map[Channel]int64)
	for k, v := range h.failedCount {
		failedCopy[k] = v
	}
	stats["failed"] = failedCopy

	return stats
}

// ResetStats resets hub statistics
func (h *NotificationHub) ResetStats() {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.sentCount = make(map[Channel]int64)
	h.failedCount = make(map[Channel]int64)
}

// Convenience methods for common notification types

// SendWelcome sends a welcome notification
func (h *NotificationHub) SendWelcome(ctx context.Context, userID uuid.UUID, email, phone, userName string, festivalName string) (*NotificationResult, error) {
	channels := []Channel{ChannelEmail}
	if phone != "" {
		channels = append(channels, ChannelSMS)
	}

	return h.Send(ctx, &NotificationRequest{
		UserID:    userID,
		EventType: EventTypeWelcome,
		Priority:  PriorityNormal,
		Channels:  channels,
		Title:     "Welcome to " + festivalName,
		Message:   fmt.Sprintf("Welcome %s! We're excited to have you at %s.", userName, festivalName),
		Data: map[string]interface{}{
			"UserName":     userName,
			"FestivalName": festivalName,
			"AppName":      h.config.AppName,
			"SupportEmail": h.config.SupportEmail,
			"LoginURL":     h.config.BaseURL + "/login",
		},
		Email: &EmailNotification{
			To:       email,
			Template: EmailTemplateWelcome,
		},
		SMS: &SMSNotification{
			To:       phone,
			Template: SMSTemplateWelcome,
		},
	})
}

// SendPaymentConfirmation sends a payment confirmation notification
func (h *NotificationHub) SendPaymentConfirmation(ctx context.Context, userID uuid.UUID, email, phone string, amount, transactionID, festivalName string) (*NotificationResult, error) {
	channels := []Channel{ChannelEmail, ChannelPush, ChannelInApp}
	if phone != "" {
		channels = append(channels, ChannelSMS)
	}

	return h.Send(ctx, &NotificationRequest{
		UserID:    userID,
		EventType: EventTypePaymentConfirm,
		Priority:  PriorityNormal,
		Channels:  channels,
		Title:     "Payment Confirmed",
		Message:   fmt.Sprintf("Your payment of %s has been confirmed.", amount),
		Data: map[string]interface{}{
			"Amount":        amount,
			"TransactionID": transactionID,
			"FestivalName":  festivalName,
		},
		Email: &EmailNotification{
			To:       email,
			Template: EmailTemplateTopUpConfirmed,
		},
		SMS: &SMSNotification{
			To:       phone,
			Template: SMSTemplatePaymentConfirm,
		},
		Push: &PushNotificationData{
			Title: "Payment Confirmed",
			Body:  fmt.Sprintf("Your payment of %s has been confirmed.", amount),
			Data: map[string]string{
				"type":          "payment_confirm",
				"transactionId": transactionID,
			},
		},
		InApp: &InAppNotification{
			Type:        "toast",
			Title:       "Payment Confirmed",
			Body:        fmt.Sprintf("Your payment of %s has been confirmed.", amount),
			Dismissible: true,
			Duration:    5000,
		},
	})
}

// SendSecurityAlert sends a security alert notification
func (h *NotificationHub) SendSecurityAlert(ctx context.Context, userID uuid.UUID, email, phone, title, message string) (*NotificationResult, error) {
	channels := []Channel{ChannelEmail, ChannelPush, ChannelInApp}
	if phone != "" {
		channels = append(channels, ChannelSMS)
	}

	return h.Send(ctx, &NotificationRequest{
		UserID:    userID,
		EventType: EventTypeSecurityAlert,
		Priority:  PriorityHigh,
		Channels:  channels,
		Title:     title,
		Message:   message,
		Email: &EmailNotification{
			To:      email,
			Subject: "[Security Alert] " + title,
		},
		SMS: &SMSNotification{
			To:      phone,
			Message: fmt.Sprintf("Security Alert: %s - %s", title, message),
		},
		Push: &PushNotificationData{
			Title: title,
			Body:  message,
			Sound: "default",
			Data: map[string]string{
				"type": "security_alert",
			},
		},
		InApp: &InAppNotification{
			Type:        "banner",
			Title:       title,
			Body:        message,
			Dismissible: false,
		},
	})
}

// SendEmergencyBroadcast sends an emergency broadcast to all channels
func (h *NotificationHub) SendEmergencyBroadcast(ctx context.Context, festivalID uuid.UUID, userID uuid.UUID, email, phone, festivalName, message string) (*NotificationResult, error) {
	return h.Send(ctx, &NotificationRequest{
		UserID:     userID,
		FestivalID: &festivalID,
		EventType:  EventTypeEmergency,
		Priority:   PriorityCritical,
		Channels:   []Channel{ChannelEmail, ChannelSMS, ChannelPush, ChannelInApp},
		Title:      "Emergency Alert: " + festivalName,
		Message:    message,
		Email: &EmailNotification{
			To:      email,
			Subject: "[URGENT] Emergency Alert - " + festivalName,
		},
		SMS: &SMSNotification{
			To:       phone,
			Template: SMSTemplateEmergency,
		},
		Push: &PushNotificationData{
			Title: "Emergency Alert",
			Body:  message,
			Sound: "emergency",
			Data: map[string]string{
				"type":       "emergency",
				"festivalId": festivalID.String(),
			},
		},
		InApp: &InAppNotification{
			Type:        "modal",
			Title:       "Emergency Alert",
			Body:        message,
			Dismissible: false,
		},
	})
}
