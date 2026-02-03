package webhooks

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for webhook data operations
type Repository interface {
	// Webhook operations
	CreateWebhook(ctx context.Context, webhook *Webhook) error
	GetByID(ctx context.Context, id uuid.UUID) (*Webhook, error)
	GetByFestival(ctx context.Context, festivalID uuid.UUID) ([]Webhook, error)
	GetActiveByFestivalAndEvent(ctx context.Context, festivalID uuid.UUID, event string) ([]Webhook, error)
	Update(ctx context.Context, webhook *Webhook) error
	Delete(ctx context.Context, id uuid.UUID) error

	// Delivery operations
	CreateDelivery(ctx context.Context, delivery *WebhookDelivery) error
	GetDeliveriesByWebhook(ctx context.Context, webhookID uuid.UUID, limit, offset int) ([]WebhookDelivery, int64, error)
	GetDeliveryByID(ctx context.Context, id uuid.UUID) (*WebhookDelivery, error)
}
