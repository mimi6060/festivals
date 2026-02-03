package support

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for support ticket data operations
type Repository interface {
	// Support Ticket operations
	CreateTicket(ctx context.Context, ticket *SupportTicket) error
	GetTicketByID(ctx context.Context, id uuid.UUID) (*SupportTicket, error)
	GetTicketsByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]SupportTicket, int64, error)
	GetTicketsByFestival(ctx context.Context, festivalID uuid.UUID, filters TicketFilters, offset, limit int) ([]SupportTicket, int64, error)
	UpdateTicket(ctx context.Context, ticket *SupportTicket) error
	UpdateTicketStatus(ctx context.Context, id uuid.UUID, status TicketStatus) error
	AssignTicket(ctx context.Context, id uuid.UUID, assignedTo *uuid.UUID) error
	GetOpenTickets(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]SupportTicket, int64, error)
	GetTicketStats(ctx context.Context, festivalID uuid.UUID) (*TicketStats, error)

	// Ticket Message operations
	AddMessage(ctx context.Context, message *TicketMessage) error
	GetMessages(ctx context.Context, ticketID uuid.UUID, offset, limit int) ([]TicketMessage, int64, error)

	// FAQ operations
	CreateFAQ(ctx context.Context, faq *FAQItem) error
	GetFAQByID(ctx context.Context, id uuid.UUID) (*FAQItem, error)
	GetFAQsByFestival(ctx context.Context, festivalID uuid.UUID, publishedOnly bool, offset, limit int) ([]FAQItem, int64, error)
	GetFAQsByCategory(ctx context.Context, festivalID uuid.UUID, category string, publishedOnly bool) ([]FAQItem, error)
	UpdateFAQ(ctx context.Context, faq *FAQItem) error
	DeleteFAQ(ctx context.Context, id uuid.UUID) error
}

// TicketFilters represents filters for listing support tickets
type TicketFilters struct {
	Status     *TicketStatus
	Priority   *TicketPriority
	Category   *TicketCategory
	AssignedTo *uuid.UUID
	UserID     *uuid.UUID
}
