package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/queue"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/sms"
	"github.com/rs/zerolog/log"
)

// SMSWorker handles SMS sending tasks
type SMSWorker struct {
	twilioClient *sms.TwilioClient
}

// NewSMSWorker creates a new SMS worker
func NewSMSWorker(twilioClient *sms.TwilioClient) *SMSWorker {
	return &SMSWorker{
		twilioClient: twilioClient,
	}
}

// RegisterHandlers registers all SMS task handlers
func (w *SMSWorker) RegisterHandlers(server *queue.Server) {
	server.HandleFunc(queue.TypeSendSMS, w.HandleSendSMS)
	server.HandleFunc(queue.TypeSendBulkSMS, w.HandleSendBulkSMS)
	server.HandleFunc(queue.TypeSendSMSNotification, w.HandleSendSMSNotification)
}

// HandleSendSMS handles sending a single SMS message
func (w *SMSWorker) HandleSendSMS(ctx context.Context, task *asynq.Task) error {
	var payload SendSMSPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	taskID, _ := asynq.GetTaskID(ctx)
	retryCount, _ := asynq.GetRetryCount(ctx)

	log.Info().
		Str("taskId", taskID).
		Str("to", payload.To).
		Int("retry", retryCount).
		Msg("Processing send SMS task")

	// Check if Twilio is configured
	if w.twilioClient == nil {
		log.Warn().
			Str("taskId", taskID).
			Msg("Twilio client not configured, skipping SMS")
		return nil // Don't fail if SMS is not configured
	}

	// Send SMS via Twilio
	result, err := w.twilioClient.SendSMS(ctx, payload.To, payload.Message)
	if err != nil {
		log.Error().
			Err(err).
			Str("taskId", taskID).
			Str("to", payload.To).
			Int("retry", retryCount).
			Msg("Failed to send SMS")

		// Check if this is a permanent failure (invalid number, etc.)
		if isPermanentSMSFailure(err) {
			log.Warn().
				Err(err).
				Str("to", payload.To).
				Msg("Permanent SMS failure, not retrying")
			return nil // Don't retry permanent failures
		}

		return fmt.Errorf("failed to send SMS: %w", err)
	}

	log.Info().
		Str("taskId", taskID).
		Str("messageSID", result.MessageSID).
		Str("to", payload.To).
		Str("status", result.Status).
		Msg("SMS sent successfully")

	return nil
}

// HandleSendBulkSMS handles sending SMS to multiple recipients
func (w *SMSWorker) HandleSendBulkSMS(ctx context.Context, task *asynq.Task) error {
	var payload SendBulkSMSPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	taskID, _ := asynq.GetTaskID(ctx)

	log.Info().
		Str("taskId", taskID).
		Int("recipientCount", len(payload.Recipients)).
		Str("festivalId", payload.FestivalID.String()).
		Msg("Processing bulk SMS task")

	// Check if Twilio is configured
	if w.twilioClient == nil {
		log.Warn().
			Str("taskId", taskID).
			Msg("Twilio client not configured, skipping bulk SMS")
		return nil
	}

	// Extract phone numbers from recipients
	phoneNumbers := make([]string, len(payload.Recipients))
	for i, r := range payload.Recipients {
		phoneNumbers[i] = r.PhoneNumber
	}

	// Send bulk SMS with rate limiting
	result, err := w.twilioClient.SendBulkSMS(ctx, phoneNumbers, payload.Message)
	if err != nil {
		// Context cancelled - partial send is OK
		if ctx.Err() != nil {
			log.Warn().
				Str("taskId", taskID).
				Int("sent", result.TotalSent).
				Int("failed", result.TotalFailed).
				Msg("Bulk SMS cancelled mid-send")
			return nil
		}
		return fmt.Errorf("bulk SMS failed: %w", err)
	}

	log.Info().
		Str("taskId", taskID).
		Int("totalSent", result.TotalSent).
		Int("totalFailed", result.TotalFailed).
		Int("total", len(payload.Recipients)).
		Msg("Bulk SMS completed")

	// Log individual failures for debugging
	for number, errMsg := range result.FailedErrors {
		log.Warn().
			Str("taskId", taskID).
			Str("number", number).
			Str("error", errMsg).
			Msg("Failed to send SMS to recipient")
	}

	// Consider partial success as success (individual retries should be handled separately)
	if result.TotalSent == 0 && result.TotalFailed > 0 {
		return fmt.Errorf("all SMS messages failed to send")
	}

	return nil
}

// HandleSendSMSNotification handles SMS notification tasks (legacy format)
func (w *SMSWorker) HandleSendSMSNotification(ctx context.Context, task *asynq.Task) error {
	var payload SendSMSNotificationPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	taskID, _ := asynq.GetTaskID(ctx)

	log.Info().
		Str("taskId", taskID).
		Str("userId", payload.UserID.String()).
		Str("phoneNumber", payload.PhoneNumber).
		Msg("Processing SMS notification task")

	if w.twilioClient == nil {
		log.Warn().
			Str("taskId", taskID).
			Msg("Twilio client not configured, skipping SMS notification")
		return nil
	}

	result, err := w.twilioClient.SendSMS(ctx, payload.PhoneNumber, payload.Message)
	if err != nil {
		if isPermanentSMSFailure(err) {
			log.Warn().
				Err(err).
				Str("phoneNumber", payload.PhoneNumber).
				Msg("Permanent SMS notification failure, not retrying")
			return nil
		}
		return fmt.Errorf("failed to send SMS notification: %w", err)
	}

	log.Info().
		Str("taskId", taskID).
		Str("messageSID", result.MessageSID).
		Str("userId", payload.UserID.String()).
		Msg("SMS notification sent successfully")

	return nil
}

// isPermanentSMSFailure determines if an SMS error is permanent and should not be retried
func isPermanentSMSFailure(err error) bool {
	if err == nil {
		return false
	}

	errMsg := err.Error()
	// Common Twilio error codes for permanent failures
	permanentErrors := []string{
		"21211", // Invalid 'To' phone number
		"21212", // Invalid phone number
		"21214", // 'To' phone number cannot be reached
		"21217", // Invalid phone number format
		"21408", // Permission denied
		"21610", // Unsubscribed recipient
		"21611", // Cannot send to landline
		"21612", // Cannot send to toll-free number
		"30003", // Unreachable destination handset
		"30004", // Message blocked
		"30005", // Unknown destination handset
		"30006", // Landline or unreachable carrier
		"30007", // Carrier violation
	}

	for _, code := range permanentErrors {
		if contains(errMsg, code) {
			return true
		}
	}

	return false
}

// contains checks if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// SMSResult represents the result of an SMS operation for dead letter handling
type SMSResult struct {
	TaskID      string    `json:"taskId"`
	To          string    `json:"to"`
	MessageSID  string    `json:"messageSid,omitempty"`
	Status      string    `json:"status"`
	Error       string    `json:"error,omitempty"`
	RetryCount  int       `json:"retryCount"`
	ProcessedAt time.Time `json:"processedAt"`
}
