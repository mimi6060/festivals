package notification

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/sms"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// SMSTemplate represents a predefined SMS template
type SMSTemplate string

const (
	SMSTemplateTicketReminder     SMSTemplate = "TICKET_REMINDER"
	SMSTemplateSOSConfirmation    SMSTemplate = "SOS_CONFIRMATION"
	SMSTemplateTopUpConfirmation  SMSTemplate = "TOPUP_CONFIRMATION"
	SMSTemplateBroadcast          SMSTemplate = "BROADCAST"
	SMSTemplateWelcome            SMSTemplate = "WELCOME"
	SMSTemplateLineupChange       SMSTemplate = "LINEUP_CHANGE"
	SMSTemplateEmergency          SMSTemplate = "EMERGENCY"
	SMSTemplatePaymentConfirm     SMSTemplate = "PAYMENT_CONFIRM"
)

// SMSTemplateContent contains predefined templates with variable placeholders
var SMSTemplateContent = map[SMSTemplate]string{
	SMSTemplateTicketReminder:    "Hi {{name}}! Reminder: {{festivalName}} starts on {{date}}. Don't forget your ticket! See you there!",
	SMSTemplateSOSConfirmation:   "Your SOS alert has been received. Help is on the way. Stay calm and remain at your current location if safe.",
	SMSTemplateTopUpConfirmation: "Hi {{name}}! Your wallet has been topped up with {{amount}}. New balance: {{balance}}. Enjoy {{festivalName}}!",
	SMSTemplateBroadcast:         "{{message}}",
	SMSTemplateWelcome:           "Welcome to {{festivalName}}! We're excited to have you. Check the app for schedules and updates. Enjoy!",
	SMSTemplateLineupChange:      "Lineup update for {{festivalName}}: {{message}}. Check the app for the full schedule.",
	SMSTemplateEmergency:         "URGENT - {{festivalName}}: {{message}}. Please follow staff instructions.",
	SMSTemplatePaymentConfirm:    "Payment confirmed! Amount: {{amount}}. Transaction: {{transactionId}}. Thank you for your purchase at {{festivalName}}!",
}

// SMSLogStatus represents the status of an SMS log entry
type SMSLogStatus string

const (
	SMSLogStatusPending   SMSLogStatus = "PENDING"
	SMSLogStatusSent      SMSLogStatus = "SENT"
	SMSLogStatusDelivered SMSLogStatus = "DELIVERED"
	SMSLogStatusFailed    SMSLogStatus = "FAILED"
	SMSLogStatusOptedOut  SMSLogStatus = "OPTED_OUT"
)

// SMSLog represents a log entry for sent SMS messages
type SMSLog struct {
	ID          uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID  *uuid.UUID   `json:"festivalId,omitempty" gorm:"type:uuid;index"`
	UserID      *uuid.UUID   `json:"userId,omitempty" gorm:"type:uuid;index"`
	ToPhone     string       `json:"toPhone" gorm:"not null;index"`
	Template    SMSTemplate  `json:"template" gorm:"not null;index"`
	Message     string       `json:"message" gorm:"not null"`
	Status      SMSLogStatus `json:"status" gorm:"default:'PENDING';index"`
	MessageSID  string       `json:"messageSid,omitempty" gorm:"index"`
	Error       string       `json:"error,omitempty"`
	Cost        float64      `json:"cost,omitempty"`
	BroadcastID *uuid.UUID   `json:"broadcastId,omitempty" gorm:"type:uuid;index"`
	SentAt      *time.Time   `json:"sentAt,omitempty"`
	DeliveredAt *time.Time   `json:"deliveredAt,omitempty"`
	CreatedAt   time.Time    `json:"createdAt"`
	UpdatedAt   time.Time    `json:"updatedAt"`
}

func (SMSLog) TableName() string {
	return "sms_logs"
}

// SMSBroadcast represents a bulk SMS broadcast
type SMSBroadcast struct {
	ID           uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID   uuid.UUID    `json:"festivalId" gorm:"type:uuid;not null;index"`
	Template     SMSTemplate  `json:"template" gorm:"not null"`
	Message      string       `json:"message" gorm:"not null"`
	TotalCount   int          `json:"totalCount" gorm:"default:0"`
	SentCount    int          `json:"sentCount" gorm:"default:0"`
	FailedCount  int          `json:"failedCount" gorm:"default:0"`
	OptedOutCount int         `json:"optedOutCount" gorm:"default:0"`
	Status       string       `json:"status" gorm:"default:'PENDING'"` // PENDING, IN_PROGRESS, COMPLETED, CANCELLED
	StartedAt    *time.Time   `json:"startedAt,omitempty"`
	CompletedAt  *time.Time   `json:"completedAt,omitempty"`
	CreatedBy    *uuid.UUID   `json:"createdBy,omitempty" gorm:"type:uuid"`
	CreatedAt    time.Time    `json:"createdAt"`
	UpdatedAt    time.Time    `json:"updatedAt"`
}

func (SMSBroadcast) TableName() string {
	return "sms_broadcasts"
}

// SMSOptOut represents a user who has opted out of SMS notifications
type SMSOptOut struct {
	ID        uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Phone     string     `json:"phone" gorm:"not null;uniqueIndex"`
	UserID    *uuid.UUID `json:"userId,omitempty" gorm:"type:uuid;index"`
	OptedOutAt time.Time `json:"optedOutAt" gorm:"not null"`
	Reason    string     `json:"reason,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
}

func (SMSOptOut) TableName() string {
	return "sms_opt_outs"
}

// SMSService handles SMS notification business logic
type SMSService struct {
	db         *gorm.DB
	smsClient  *sms.TwilioClient
	appName    string
}

// SMSServiceConfig holds configuration for the SMS service
type SMSServiceConfig struct {
	AppName string
}

// NewSMSService creates a new SMS notification service
func NewSMSService(db *gorm.DB, smsClient *sms.TwilioClient, cfg SMSServiceConfig) *SMSService {
	return &SMSService{
		db:        db,
		smsClient: smsClient,
		appName:   cfg.AppName,
	}
}

// SMSVariables represents template variables
type SMSVariables map[string]string

// SendTicketReminder sends a ticket reminder SMS
func (s *SMSService) SendTicketReminder(ctx context.Context, userPhone, userName, festivalName, date string) error {
	variables := SMSVariables{
		"name":         userName,
		"festivalName": festivalName,
		"date":         date,
	}

	return s.sendTemplatedSMS(ctx, nil, nil, userPhone, SMSTemplateTicketReminder, variables)
}

// SendSOSConfirmation sends an SOS confirmation SMS
func (s *SMSService) SendSOSConfirmation(ctx context.Context, userPhone string) error {
	return s.sendTemplatedSMS(ctx, nil, nil, userPhone, SMSTemplateSOSConfirmation, nil)
}

// SendTopUpConfirmation sends a wallet top-up confirmation SMS
func (s *SMSService) SendTopUpConfirmation(ctx context.Context, userID uuid.UUID, userPhone, userName, amount, balance, festivalName string) error {
	variables := SMSVariables{
		"name":         userName,
		"amount":       amount,
		"balance":      balance,
		"festivalName": festivalName,
	}

	return s.sendTemplatedSMS(ctx, nil, &userID, userPhone, SMSTemplateTopUpConfirmation, variables)
}

// SendPaymentConfirmation sends a payment confirmation SMS
func (s *SMSService) SendPaymentConfirmation(ctx context.Context, userPhone, amount, transactionID, festivalName string) error {
	variables := SMSVariables{
		"amount":        amount,
		"transactionId": transactionID,
		"festivalName":  festivalName,
	}

	return s.sendTemplatedSMS(ctx, nil, nil, userPhone, SMSTemplatePaymentConfirm, variables)
}

// SendWelcome sends a welcome SMS
func (s *SMSService) SendWelcome(ctx context.Context, userPhone, festivalName string) error {
	variables := SMSVariables{
		"festivalName": festivalName,
	}

	return s.sendTemplatedSMS(ctx, nil, nil, userPhone, SMSTemplateWelcome, variables)
}

// SendLineupChange sends a lineup change notification
func (s *SMSService) SendLineupChange(ctx context.Context, userPhone, festivalName, message string) error {
	variables := SMSVariables{
		"festivalName": festivalName,
		"message":      message,
	}

	return s.sendTemplatedSMS(ctx, nil, nil, userPhone, SMSTemplateLineupChange, variables)
}

// SendEmergency sends an emergency notification
func (s *SMSService) SendEmergency(ctx context.Context, festivalID uuid.UUID, userPhone, festivalName, message string) error {
	variables := SMSVariables{
		"festivalName": festivalName,
		"message":      message,
	}

	return s.sendTemplatedSMS(ctx, &festivalID, nil, userPhone, SMSTemplateEmergency, variables)
}

// BroadcastRequest represents a request to send a broadcast SMS
type BroadcastRequest struct {
	FestivalID uuid.UUID
	Message    string
	CreatedBy  *uuid.UUID
}

// BroadcastResult represents the result of a broadcast operation
type BroadcastResult struct {
	BroadcastID   uuid.UUID `json:"broadcastId"`
	TotalCount    int       `json:"totalCount"`
	SentCount     int       `json:"sentCount"`
	FailedCount   int       `json:"failedCount"`
	OptedOutCount int       `json:"optedOutCount"`
	Status        string    `json:"status"`
}

// SendBroadcast sends an SMS to all festival participants
func (s *SMSService) SendBroadcast(ctx context.Context, req BroadcastRequest) (*BroadcastResult, error) {
	// Get all phone numbers for festival participants
	var phones []struct {
		Phone  string
		UserID uuid.UUID
	}

	// Query tickets to get all participant phone numbers
	err := s.db.WithContext(ctx).Raw(`
		SELECT DISTINCT u.phone, u.id as user_id
		FROM users u
		INNER JOIN tickets t ON t.user_id = u.id
		WHERE t.festival_id = ? AND u.phone IS NOT NULL AND u.phone != ''
	`, req.FestivalID).Scan(&phones).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get participant phones: %w", err)
	}

	if len(phones) == 0 {
		return &BroadcastResult{
			Status: "COMPLETED",
		}, nil
	}

	// Get opted-out numbers
	var optedOutPhones []string
	err = s.db.WithContext(ctx).Model(&SMSOptOut{}).Pluck("phone", &optedOutPhones).Error
	if err != nil {
		log.Warn().Err(err).Msg("Failed to get opted out phones")
	}
	optedOutSet := make(map[string]bool)
	for _, p := range optedOutPhones {
		optedOutSet[normalizePhone(p)] = true
	}

	// Create broadcast record
	broadcast := &SMSBroadcast{
		ID:         uuid.New(),
		FestivalID: req.FestivalID,
		Template:   SMSTemplateBroadcast,
		Message:    req.Message,
		TotalCount: len(phones),
		Status:     "IN_PROGRESS",
		CreatedBy:  req.CreatedBy,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	now := time.Now()
	broadcast.StartedAt = &now

	if err := s.db.WithContext(ctx).Create(broadcast).Error; err != nil {
		return nil, fmt.Errorf("failed to create broadcast record: %w", err)
	}

	// Send messages
	sentCount := 0
	failedCount := 0
	optedOutCount := 0

	for _, p := range phones {
		normalizedPhone := normalizePhone(p.Phone)

		// Check if opted out
		if optedOutSet[normalizedPhone] {
			optedOutCount++
			s.logSMS(ctx, &req.FestivalID, &p.UserID, p.Phone, SMSTemplateBroadcast, req.Message, SMSLogStatusOptedOut, "", "", &broadcast.ID)
			continue
		}

		// Send SMS
		result, err := s.smsClient.SendSMS(ctx, p.Phone, req.Message)
		if err != nil {
			failedCount++
			errMsg := ""
			if result != nil {
				errMsg = result.Error
			} else {
				errMsg = err.Error()
			}
			s.logSMS(ctx, &req.FestivalID, &p.UserID, p.Phone, SMSTemplateBroadcast, req.Message, SMSLogStatusFailed, "", errMsg, &broadcast.ID)
			log.Error().Err(err).Str("phone", p.Phone).Msg("Failed to send broadcast SMS")
			continue
		}

		sentCount++
		s.logSMS(ctx, &req.FestivalID, &p.UserID, p.Phone, SMSTemplateBroadcast, req.Message, SMSLogStatusSent, result.MessageSID, "", &broadcast.ID)
	}

	// Update broadcast record
	completedAt := time.Now()
	broadcast.SentCount = sentCount
	broadcast.FailedCount = failedCount
	broadcast.OptedOutCount = optedOutCount
	broadcast.Status = "COMPLETED"
	broadcast.CompletedAt = &completedAt
	broadcast.UpdatedAt = time.Now()

	if err := s.db.WithContext(ctx).Save(broadcast).Error; err != nil {
		log.Error().Err(err).Msg("Failed to update broadcast record")
	}

	log.Info().
		Str("broadcastId", broadcast.ID.String()).
		Int("sent", sentCount).
		Int("failed", failedCount).
		Int("optedOut", optedOutCount).
		Msg("Broadcast completed")

	return &BroadcastResult{
		BroadcastID:   broadcast.ID,
		TotalCount:    len(phones),
		SentCount:     sentCount,
		FailedCount:   failedCount,
		OptedOutCount: optedOutCount,
		Status:        "COMPLETED",
	}, nil
}

// sendTemplatedSMS sends an SMS using a template
func (s *SMSService) sendTemplatedSMS(ctx context.Context, festivalID, userID *uuid.UUID, phone string, template SMSTemplate, variables SMSVariables) error {
	// Check opt-out status
	isOptedOut, err := s.IsOptedOut(ctx, phone)
	if err != nil {
		log.Warn().Err(err).Str("phone", phone).Msg("Failed to check opt-out status")
	}
	if isOptedOut {
		log.Info().Str("phone", phone).Str("template", string(template)).Msg("SMS not sent - user opted out")
		s.logSMS(ctx, festivalID, userID, phone, template, "", SMSLogStatusOptedOut, "", "User opted out", nil)
		return nil
	}

	// Render template
	message := s.renderTemplate(template, variables)

	// Send SMS
	result, err := s.smsClient.SendSMS(ctx, phone, message)
	if err != nil {
		errMsg := ""
		if result != nil {
			errMsg = result.Error
		} else {
			errMsg = err.Error()
		}
		s.logSMS(ctx, festivalID, userID, phone, template, message, SMSLogStatusFailed, "", errMsg, nil)
		return fmt.Errorf("failed to send SMS: %w", err)
	}

	s.logSMS(ctx, festivalID, userID, phone, template, message, SMSLogStatusSent, result.MessageSID, "", nil)
	return nil
}

// renderTemplate renders an SMS template with variables
func (s *SMSService) renderTemplate(template SMSTemplate, variables SMSVariables) string {
	content, ok := SMSTemplateContent[template]
	if !ok {
		return ""
	}

	message := content
	for key, value := range variables {
		placeholder := "{{" + key + "}}"
		message = strings.ReplaceAll(message, placeholder, value)
	}

	return message
}

// logSMS creates an SMS log entry
func (s *SMSService) logSMS(ctx context.Context, festivalID, userID *uuid.UUID, phone string, template SMSTemplate, message string, status SMSLogStatus, messageSID, errorMsg string, broadcastID *uuid.UUID) {
	now := time.Now()
	logEntry := &SMSLog{
		ID:          uuid.New(),
		FestivalID:  festivalID,
		UserID:      userID,
		ToPhone:     phone,
		Template:    template,
		Message:     message,
		Status:      status,
		MessageSID:  messageSID,
		Error:       errorMsg,
		BroadcastID: broadcastID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if status == SMSLogStatusSent || status == SMSLogStatusDelivered {
		logEntry.SentAt = &now
	}

	if err := s.db.WithContext(ctx).Create(logEntry).Error; err != nil {
		log.Error().Err(err).Str("phone", phone).Msg("Failed to create SMS log")
	}
}

// IsOptedOut checks if a phone number has opted out
func (s *SMSService) IsOptedOut(ctx context.Context, phone string) (bool, error) {
	var count int64
	normalizedPhone := normalizePhone(phone)
	err := s.db.WithContext(ctx).Model(&SMSOptOut{}).Where("phone = ?", normalizedPhone).Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// OptOut opts out a phone number from SMS notifications
func (s *SMSService) OptOut(ctx context.Context, phone string, userID *uuid.UUID, reason string) error {
	normalizedPhone := normalizePhone(phone)

	optOut := &SMSOptOut{
		ID:        uuid.New(),
		Phone:     normalizedPhone,
		UserID:    userID,
		OptedOutAt: time.Now(),
		Reason:    reason,
		CreatedAt: time.Now(),
	}

	err := s.db.WithContext(ctx).
		Where("phone = ?", normalizedPhone).
		FirstOrCreate(optOut).Error
	if err != nil {
		return fmt.Errorf("failed to opt out: %w", err)
	}

	log.Info().Str("phone", normalizedPhone).Msg("Phone opted out of SMS")
	return nil
}

// OptIn removes a phone number from the opt-out list
func (s *SMSService) OptIn(ctx context.Context, phone string) error {
	normalizedPhone := normalizePhone(phone)

	err := s.db.WithContext(ctx).Where("phone = ?", normalizedPhone).Delete(&SMSOptOut{}).Error
	if err != nil {
		return fmt.Errorf("failed to opt in: %w", err)
	}

	log.Info().Str("phone", normalizedPhone).Msg("Phone opted in to SMS")
	return nil
}

// GetSMSLogs retrieves SMS logs with pagination
func (s *SMSService) GetSMSLogs(ctx context.Context, festivalID *uuid.UUID, page, perPage int) ([]SMSLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	var logs []SMSLog
	var total int64

	query := s.db.WithContext(ctx).Model(&SMSLog{})
	if festivalID != nil {
		query = query.Where("festival_id = ?", festivalID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count SMS logs: %w", err)
	}

	offset := (page - 1) * perPage
	if err := query.Offset(offset).Limit(perPage).Order("created_at DESC").Find(&logs).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list SMS logs: %w", err)
	}

	return logs, total, nil
}

// GetBroadcasts retrieves broadcast history with pagination
func (s *SMSService) GetBroadcasts(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]SMSBroadcast, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	var broadcasts []SMSBroadcast
	var total int64

	query := s.db.WithContext(ctx).Model(&SMSBroadcast{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count broadcasts: %w", err)
	}

	offset := (page - 1) * perPage
	if err := query.Offset(offset).Limit(perPage).Order("created_at DESC").Find(&broadcasts).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list broadcasts: %w", err)
	}

	return broadcasts, total, nil
}

// GetBroadcastByID retrieves a single broadcast by ID
func (s *SMSService) GetBroadcastByID(ctx context.Context, broadcastID uuid.UUID) (*SMSBroadcast, error) {
	var broadcast SMSBroadcast
	err := s.db.WithContext(ctx).Where("id = ?", broadcastID).First(&broadcast).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get broadcast: %w", err)
	}
	return &broadcast, nil
}

// GetSMSStats returns SMS statistics for a festival
func (s *SMSService) GetSMSStats(ctx context.Context, festivalID uuid.UUID) (*SMSStats, error) {
	var stats SMSStats

	// Total sent
	var totalSent int64
	s.db.WithContext(ctx).Model(&SMSLog{}).Where("festival_id = ? AND status IN ?", festivalID, []SMSLogStatus{SMSLogStatusSent, SMSLogStatusDelivered}).Count(&totalSent)
	stats.TotalSent = int(totalSent)

	// Total failed
	var totalFailed int64
	s.db.WithContext(ctx).Model(&SMSLog{}).Where("festival_id = ? AND status = ?", festivalID, SMSLogStatusFailed).Count(&totalFailed)
	stats.TotalFailed = int(totalFailed)

	// Total opted out
	var totalOptedOut int64
	s.db.WithContext(ctx).Model(&SMSLog{}).Where("festival_id = ? AND status = ?", festivalID, SMSLogStatusOptedOut).Count(&totalOptedOut)
	stats.TotalOptedOut = int(totalOptedOut)

	// Total broadcasts
	var totalBroadcasts int64
	s.db.WithContext(ctx).Model(&SMSBroadcast{}).Where("festival_id = ?", festivalID).Count(&totalBroadcasts)
	stats.TotalBroadcasts = int(totalBroadcasts)

	// By template
	var templateStats []struct {
		Template SMSTemplate
		Count    int64
	}
	s.db.WithContext(ctx).Model(&SMSLog{}).
		Select("template, count(*) as count").
		Where("festival_id = ?", festivalID).
		Group("template").
		Find(&templateStats)

	stats.ByTemplate = make(map[string]int)
	for _, ts := range templateStats {
		stats.ByTemplate[string(ts.Template)] = int(ts.Count)
	}

	return &stats, nil
}

// SMSStats represents SMS statistics
type SMSStats struct {
	TotalSent       int            `json:"totalSent"`
	TotalFailed     int            `json:"totalFailed"`
	TotalOptedOut   int            `json:"totalOptedOut"`
	TotalBroadcasts int            `json:"totalBroadcasts"`
	ByTemplate      map[string]int `json:"byTemplate"`
}

// GetBalance retrieves the current Twilio account balance
func (s *SMSService) GetBalance(ctx context.Context) (*sms.BalanceResponse, error) {
	return s.smsClient.GetBalance(ctx)
}

// normalizePhone normalizes a phone number
func normalizePhone(phone string) string {
	// Remove any whitespace, dashes, or parentheses
	phone = strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' || r == '+' {
			return r
		}
		return -1
	}, phone)

	// Ensure it starts with +
	if !strings.HasPrefix(phone, "+") {
		if len(phone) == 10 {
			phone = "+1" + phone
		} else {
			phone = "+" + phone
		}
	}

	return phone
}

// SMSLogResponse represents the API response for an SMS log
type SMSLogResponse struct {
	ID          uuid.UUID    `json:"id"`
	FestivalID  *uuid.UUID   `json:"festivalId,omitempty"`
	UserID      *uuid.UUID   `json:"userId,omitempty"`
	ToPhone     string       `json:"toPhone"`
	Template    SMSTemplate  `json:"template"`
	Message     string       `json:"message"`
	Status      SMSLogStatus `json:"status"`
	MessageSID  string       `json:"messageSid,omitempty"`
	Error       string       `json:"error,omitempty"`
	BroadcastID *uuid.UUID   `json:"broadcastId,omitempty"`
	SentAt      *string      `json:"sentAt,omitempty"`
	CreatedAt   string       `json:"createdAt"`
}

// ToResponse converts SMSLog to SMSLogResponse
func (l *SMSLog) ToResponse() SMSLogResponse {
	var sentAt *string
	if l.SentAt != nil {
		formatted := l.SentAt.Format(time.RFC3339)
		sentAt = &formatted
	}

	return SMSLogResponse{
		ID:          l.ID,
		FestivalID:  l.FestivalID,
		UserID:      l.UserID,
		ToPhone:     l.ToPhone,
		Template:    l.Template,
		Message:     l.Message,
		Status:      l.Status,
		MessageSID:  l.MessageSID,
		Error:       l.Error,
		BroadcastID: l.BroadcastID,
		SentAt:      sentAt,
		CreatedAt:   l.CreatedAt.Format(time.RFC3339),
	}
}

// SMSBroadcastResponse represents the API response for an SMS broadcast
type SMSBroadcastResponse struct {
	ID            uuid.UUID   `json:"id"`
	FestivalID    uuid.UUID   `json:"festivalId"`
	Template      SMSTemplate `json:"template"`
	Message       string      `json:"message"`
	TotalCount    int         `json:"totalCount"`
	SentCount     int         `json:"sentCount"`
	FailedCount   int         `json:"failedCount"`
	OptedOutCount int         `json:"optedOutCount"`
	Status        string      `json:"status"`
	StartedAt     *string     `json:"startedAt,omitempty"`
	CompletedAt   *string     `json:"completedAt,omitempty"`
	CreatedBy     *uuid.UUID  `json:"createdBy,omitempty"`
	CreatedAt     string      `json:"createdAt"`
}

// ToResponse converts SMSBroadcast to SMSBroadcastResponse
func (b *SMSBroadcast) ToResponse() SMSBroadcastResponse {
	var startedAt, completedAt *string
	if b.StartedAt != nil {
		formatted := b.StartedAt.Format(time.RFC3339)
		startedAt = &formatted
	}
	if b.CompletedAt != nil {
		formatted := b.CompletedAt.Format(time.RFC3339)
		completedAt = &formatted
	}

	return SMSBroadcastResponse{
		ID:            b.ID,
		FestivalID:    b.FestivalID,
		Template:      b.Template,
		Message:       b.Message,
		TotalCount:    b.TotalCount,
		SentCount:     b.SentCount,
		FailedCount:   b.FailedCount,
		OptedOutCount: b.OptedOutCount,
		Status:        b.Status,
		StartedAt:     startedAt,
		CompletedAt:   completedAt,
		CreatedBy:     b.CreatedBy,
		CreatedAt:     b.CreatedAt.Format(time.RFC3339),
	}
}
