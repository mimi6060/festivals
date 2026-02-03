package webhooks

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// Webhook represents a webhook configuration for a festival
type Webhook struct {
	ID         uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID uuid.UUID      `json:"festivalId" gorm:"type:uuid;not null;index"`
	Name       string         `json:"name" gorm:"not null"`
	URL        string         `json:"url" gorm:"not null"`
	Events     pq.StringArray `json:"events" gorm:"type:text[]"`
	Secret     string         `json:"-" gorm:"not null"` // Used for signing payloads
	IsActive   bool           `json:"isActive" gorm:"default:true"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
}

func (Webhook) TableName() string {
	return "public.webhooks"
}

// WebhookDelivery represents a webhook delivery attempt
type WebhookDelivery struct {
	ID           uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	WebhookID    uuid.UUID  `json:"webhookId" gorm:"type:uuid;not null;index"`
	Event        string     `json:"event" gorm:"not null"`
	Payload      string     `json:"payload" gorm:"type:text"`
	ResponseCode *int       `json:"responseCode,omitempty"`
	ResponseBody *string    `json:"responseBody,omitempty" gorm:"type:text"`
	Duration     *int       `json:"duration,omitempty"` // Milliseconds
	Success      bool       `json:"success" gorm:"default:false"`
	Error        *string    `json:"error,omitempty"`
	DeliveredAt  time.Time  `json:"deliveredAt"`
	Webhook      *Webhook   `json:"-" gorm:"foreignKey:WebhookID"`
}

func (WebhookDelivery) TableName() string {
	return "public.webhook_deliveries"
}

// WebhookEvent represents available webhook events
type WebhookEvent string

const (
	// Ticket events
	EventTicketCreated    WebhookEvent = "ticket.created"
	EventTicketActivated  WebhookEvent = "ticket.activated"
	EventTicketScanned    WebhookEvent = "ticket.scanned"
	EventTicketTransferred WebhookEvent = "ticket.transferred"

	// Order events
	EventOrderCreated   WebhookEvent = "order.created"
	EventOrderCompleted WebhookEvent = "order.completed"
	EventOrderRefunded  WebhookEvent = "order.refunded"
	EventOrderCancelled WebhookEvent = "order.cancelled"

	// Wallet events
	EventWalletTopup    WebhookEvent = "wallet.topup"
	EventWalletPayment  WebhookEvent = "wallet.payment"
	EventWalletRefund   WebhookEvent = "wallet.refund"
	EventWalletFrozen   WebhookEvent = "wallet.frozen"
	EventWalletUnfrozen WebhookEvent = "wallet.unfrozen"

	// Stand events
	EventStandOpened WebhookEvent = "stand.opened"
	EventStandClosed WebhookEvent = "stand.closed"

	// Festival events
	EventFestivalActivated  WebhookEvent = "festival.activated"
	EventFestivalCompleted  WebhookEvent = "festival.completed"

	// All events
	EventAll WebhookEvent = "*"
)

// ValidEvents returns all valid webhook events
func ValidEvents() []WebhookEvent {
	return []WebhookEvent{
		EventTicketCreated,
		EventTicketActivated,
		EventTicketScanned,
		EventTicketTransferred,
		EventOrderCreated,
		EventOrderCompleted,
		EventOrderRefunded,
		EventOrderCancelled,
		EventWalletTopup,
		EventWalletPayment,
		EventWalletRefund,
		EventWalletFrozen,
		EventWalletUnfrozen,
		EventStandOpened,
		EventStandClosed,
		EventFestivalActivated,
		EventFestivalCompleted,
		EventAll,
	}
}

// IsValidEvent checks if an event is valid
func IsValidEvent(event string) bool {
	for _, e := range ValidEvents() {
		if string(e) == event {
			return true
		}
	}
	return false
}

// CreateWebhookRequest represents the request to create a webhook
type CreateWebhookRequest struct {
	Name   string   `json:"name" binding:"required,min=1,max=100"`
	URL    string   `json:"url" binding:"required,url"`
	Events []string `json:"events" binding:"required,min=1"`
}

// UpdateWebhookRequest represents the request to update a webhook
type UpdateWebhookRequest struct {
	Name     *string   `json:"name,omitempty"`
	URL      *string   `json:"url,omitempty"`
	Events   []string  `json:"events,omitempty"`
	IsActive *bool     `json:"isActive,omitempty"`
}

// WebhookResponse represents the API response for a webhook
type WebhookResponse struct {
	ID         uuid.UUID `json:"id"`
	FestivalID uuid.UUID `json:"festivalId"`
	Name       string    `json:"name"`
	URL        string    `json:"url"`
	Events     []string  `json:"events"`
	IsActive   bool      `json:"isActive"`
	CreatedAt  string    `json:"createdAt"`
	UpdatedAt  string    `json:"updatedAt"`
}

// WebhookWithSecretResponse includes the secret (only on creation)
type WebhookWithSecretResponse struct {
	WebhookResponse
	Secret string `json:"secret"`
}

// WebhookDeliveryResponse represents the API response for a delivery
type WebhookDeliveryResponse struct {
	ID           uuid.UUID `json:"id"`
	WebhookID    uuid.UUID `json:"webhookId"`
	Event        string    `json:"event"`
	Payload      string    `json:"payload"`
	ResponseCode *int      `json:"responseCode,omitempty"`
	ResponseBody *string   `json:"responseBody,omitempty"`
	Duration     *int      `json:"duration,omitempty"`
	Success      bool      `json:"success"`
	Error        *string   `json:"error,omitempty"`
	DeliveredAt  string    `json:"deliveredAt"`
}

// TestWebhookRequest represents the request to test a webhook
type TestWebhookRequest struct {
	Event   string      `json:"event"`
	Payload interface{} `json:"payload,omitempty"`
}

// WebhookPayload represents the payload sent to webhooks
type WebhookPayload struct {
	ID         string      `json:"id"`
	Event      string      `json:"event"`
	FestivalID string      `json:"festivalId"`
	Timestamp  string      `json:"timestamp"`
	Data       interface{} `json:"data"`
}

// ToResponse converts a Webhook to WebhookResponse
func (w *Webhook) ToResponse() WebhookResponse {
	return WebhookResponse{
		ID:         w.ID,
		FestivalID: w.FestivalID,
		Name:       w.Name,
		URL:        w.URL,
		Events:     w.Events,
		IsActive:   w.IsActive,
		CreatedAt:  w.CreatedAt.Format(time.RFC3339),
		UpdatedAt:  w.UpdatedAt.Format(time.RFC3339),
	}
}

// ToResponseWithSecret converts a Webhook to WebhookWithSecretResponse
func (w *Webhook) ToResponseWithSecret() WebhookWithSecretResponse {
	return WebhookWithSecretResponse{
		WebhookResponse: w.ToResponse(),
		Secret:          w.Secret,
	}
}

// ToResponse converts a WebhookDelivery to WebhookDeliveryResponse
func (d *WebhookDelivery) ToResponse() WebhookDeliveryResponse {
	return WebhookDeliveryResponse{
		ID:           d.ID,
		WebhookID:    d.WebhookID,
		Event:        d.Event,
		Payload:      d.Payload,
		ResponseCode: d.ResponseCode,
		ResponseBody: d.ResponseBody,
		Duration:     d.Duration,
		Success:      d.Success,
		Error:        d.Error,
		DeliveredAt:  d.DeliveredAt.Format(time.RFC3339),
	}
}
