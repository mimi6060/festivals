package support

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

// Service handles business logic for support operations
type Service struct {
	repo Repository
}

// NewService creates a new support service
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Support Ticket operations

// CreateSupportTicket creates a new support ticket with validation
func (s *Service) CreateSupportTicket(ctx context.Context, festivalID, userID uuid.UUID, req CreateTicketRequest) (*SupportTicket, error) {
	// Validate category
	if !isValidCategory(req.Category) {
		return nil, fmt.Errorf("invalid ticket category: %s", req.Category)
	}

	// Set default priority if not provided
	priority := TicketPriorityMedium
	if req.Priority != nil {
		if !isValidPriority(*req.Priority) {
			return nil, fmt.Errorf("invalid ticket priority: %s", *req.Priority)
		}
		priority = *req.Priority
	}

	now := time.Now()
	ticket := &SupportTicket{
		ID:          uuid.New(),
		FestivalID:  festivalID,
		UserID:      userID,
		Subject:     req.Subject,
		Description: req.Description,
		Status:      TicketStatusOpen,
		Priority:    priority,
		Category:    req.Category,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.CreateTicket(ctx, ticket); err != nil {
		return nil, fmt.Errorf("failed to create support ticket: %w", err)
	}

	return ticket, nil
}

// GetTicket gets a support ticket by ID
func (s *Service) GetTicket(ctx context.Context, id uuid.UUID) (*SupportTicket, error) {
	ticket, err := s.repo.GetTicketByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if ticket == nil {
		return nil, errors.ErrNotFound
	}
	return ticket, nil
}

// GetTicketsByUser gets all support tickets for a user
func (s *Service) GetTicketsByUser(ctx context.Context, userID uuid.UUID, page, perPage int) ([]SupportTicket, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetTicketsByUser(ctx, userID, offset, perPage)
}

// GetTicketsByFestival gets all support tickets for a festival with optional filters
func (s *Service) GetTicketsByFestival(ctx context.Context, festivalID uuid.UUID, filters TicketFilters, page, perPage int) ([]SupportTicket, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetTicketsByFestival(ctx, festivalID, filters, offset, perPage)
}

// ReplyToTicket adds a message to a ticket and optionally updates its status
func (s *Service) ReplyToTicket(ctx context.Context, ticketID, senderID uuid.UUID, senderType SenderType, req CreateMessageRequest) (*TicketMessage, error) {
	// Get ticket to verify it exists and check status
	ticket, err := s.repo.GetTicketByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}
	if ticket == nil {
		return nil, errors.ErrNotFound
	}

	// Cannot add messages to closed tickets
	if ticket.Status == TicketStatusClosed {
		return nil, fmt.Errorf("cannot reply to a closed ticket")
	}

	// Create message
	message := &TicketMessage{
		ID:          uuid.New(),
		TicketID:    ticketID,
		SenderID:    senderID,
		SenderType:  senderType,
		Message:     req.Message,
		Attachments: pq.StringArray(req.Attachments),
		CreatedAt:   time.Now(),
	}

	if err := s.repo.AddMessage(ctx, message); err != nil {
		return nil, fmt.Errorf("failed to add message: %w", err)
	}

	// Update ticket status based on who replied
	var newStatus TicketStatus
	switch senderType {
	case SenderTypeStaff:
		// Staff replied, waiting for customer
		if ticket.Status == TicketStatusOpen || ticket.Status == TicketStatusInProgress {
			newStatus = TicketStatusWaitingCustomer
		}
	case SenderTypeUser:
		// Customer replied, ticket is in progress
		if ticket.Status == TicketStatusWaitingCustomer || ticket.Status == TicketStatusOpen {
			newStatus = TicketStatusInProgress
		}
	}

	if newStatus != "" && newStatus != ticket.Status {
		if err := s.repo.UpdateTicketStatus(ctx, ticketID, newStatus); err != nil {
			// Log error but don't fail the message creation
			fmt.Printf("warning: failed to update ticket status: %v\n", err)
		}
	}

	// Update ticket timestamp
	ticket.UpdatedAt = time.Now()
	_ = s.repo.UpdateTicket(ctx, ticket)

	return message, nil
}

// GetMessages gets all messages for a ticket
func (s *Service) GetMessages(ctx context.Context, ticketID uuid.UUID, page, perPage int) ([]TicketMessage, int64, error) {
	// Verify ticket exists
	ticket, err := s.repo.GetTicketByID(ctx, ticketID)
	if err != nil {
		return nil, 0, err
	}
	if ticket == nil {
		return nil, 0, errors.ErrNotFound
	}

	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	offset := (page - 1) * perPage
	return s.repo.GetMessages(ctx, ticketID, offset, perPage)
}

// UpdateTicketStatus updates the status of a support ticket
func (s *Service) UpdateTicketStatus(ctx context.Context, ticketID uuid.UUID, req UpdateTicketStatusRequest) (*SupportTicket, error) {
	// Validate status
	if !isValidStatus(req.Status) {
		return nil, fmt.Errorf("invalid ticket status: %s", req.Status)
	}

	ticket, err := s.repo.GetTicketByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}
	if ticket == nil {
		return nil, errors.ErrNotFound
	}

	// Validate status transition
	if !isValidStatusTransition(ticket.Status, req.Status) {
		return nil, fmt.Errorf("invalid status transition from %s to %s", ticket.Status, req.Status)
	}

	now := time.Now()
	ticket.Status = req.Status
	ticket.UpdatedAt = now

	// Set resolved time if transitioning to resolved
	if req.Status == TicketStatusResolved && ticket.ResolvedAt == nil {
		ticket.ResolvedAt = &now
	}

	if err := s.repo.UpdateTicket(ctx, ticket); err != nil {
		return nil, fmt.Errorf("failed to update ticket status: %w", err)
	}

	return ticket, nil
}

// AssignToStaff assigns a support ticket to a staff member
func (s *Service) AssignToStaff(ctx context.Context, ticketID uuid.UUID, req AssignTicketRequest) (*SupportTicket, error) {
	ticket, err := s.repo.GetTicketByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}
	if ticket == nil {
		return nil, errors.ErrNotFound
	}

	// Cannot assign closed tickets
	if ticket.Status == TicketStatusClosed {
		return nil, fmt.Errorf("cannot assign a closed ticket")
	}

	ticket.AssignedTo = &req.AssignedTo
	ticket.UpdatedAt = time.Now()

	// If ticket is open, move to in progress when assigned
	if ticket.Status == TicketStatusOpen {
		ticket.Status = TicketStatusInProgress
	}

	if err := s.repo.UpdateTicket(ctx, ticket); err != nil {
		return nil, fmt.Errorf("failed to assign ticket: %w", err)
	}

	return ticket, nil
}

// UnassignTicket removes the assignment from a ticket
func (s *Service) UnassignTicket(ctx context.Context, ticketID uuid.UUID) (*SupportTicket, error) {
	ticket, err := s.repo.GetTicketByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}
	if ticket == nil {
		return nil, errors.ErrNotFound
	}

	ticket.AssignedTo = nil
	ticket.UpdatedAt = time.Now()

	if err := s.repo.UpdateTicket(ctx, ticket); err != nil {
		return nil, fmt.Errorf("failed to unassign ticket: %w", err)
	}

	return ticket, nil
}

// GetOpenTickets gets all open tickets for a festival, ordered by priority
func (s *Service) GetOpenTickets(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]SupportTicket, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetOpenTickets(ctx, festivalID, offset, perPage)
}

// GetTicketStats gets statistics about support tickets for a festival
func (s *Service) GetTicketStats(ctx context.Context, festivalID uuid.UUID) (*TicketStats, error) {
	return s.repo.GetTicketStats(ctx, festivalID)
}

// FAQ operations

// CreateFAQ creates a new FAQ item
func (s *Service) CreateFAQ(ctx context.Context, festivalID uuid.UUID, req CreateFAQRequest) (*FAQItem, error) {
	order := 0
	if req.Order != nil {
		order = *req.Order
	}

	isPublished := true
	if req.IsPublished != nil {
		isPublished = *req.IsPublished
	}

	now := time.Now()
	faq := &FAQItem{
		ID:          uuid.New(),
		FestivalID:  festivalID,
		Question:    req.Question,
		Answer:      req.Answer,
		Category:    req.Category,
		Order:       order,
		IsPublished: isPublished,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.CreateFAQ(ctx, faq); err != nil {
		return nil, fmt.Errorf("failed to create FAQ: %w", err)
	}

	return faq, nil
}

// GetFAQ gets an FAQ item by ID
func (s *Service) GetFAQ(ctx context.Context, id uuid.UUID) (*FAQItem, error) {
	faq, err := s.repo.GetFAQByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if faq == nil {
		return nil, errors.ErrNotFound
	}
	return faq, nil
}

// GetFAQsByFestival gets all FAQ items for a festival
func (s *Service) GetFAQsByFestival(ctx context.Context, festivalID uuid.UUID, publishedOnly bool, page, perPage int) ([]FAQItem, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	offset := (page - 1) * perPage
	return s.repo.GetFAQsByFestival(ctx, festivalID, publishedOnly, offset, perPage)
}

// GetFAQsByCategory gets FAQ items by category
func (s *Service) GetFAQsByCategory(ctx context.Context, festivalID uuid.UUID, category string, publishedOnly bool) ([]FAQItem, error) {
	return s.repo.GetFAQsByCategory(ctx, festivalID, category, publishedOnly)
}

// UpdateFAQ updates an FAQ item
func (s *Service) UpdateFAQ(ctx context.Context, id uuid.UUID, req UpdateFAQRequest) (*FAQItem, error) {
	faq, err := s.repo.GetFAQByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if faq == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.Question != nil {
		faq.Question = *req.Question
	}
	if req.Answer != nil {
		faq.Answer = *req.Answer
	}
	if req.Category != nil {
		faq.Category = *req.Category
	}
	if req.Order != nil {
		faq.Order = *req.Order
	}
	if req.IsPublished != nil {
		faq.IsPublished = *req.IsPublished
	}

	faq.UpdatedAt = time.Now()

	if err := s.repo.UpdateFAQ(ctx, faq); err != nil {
		return nil, fmt.Errorf("failed to update FAQ: %w", err)
	}

	return faq, nil
}

// DeleteFAQ deletes an FAQ item
func (s *Service) DeleteFAQ(ctx context.Context, id uuid.UUID) error {
	faq, err := s.repo.GetFAQByID(ctx, id)
	if err != nil {
		return err
	}
	if faq == nil {
		return errors.ErrNotFound
	}

	return s.repo.DeleteFAQ(ctx, id)
}

// Helper functions

func isValidCategory(category TicketCategory) bool {
	switch category {
	case TicketCategoryPayment, TicketCategoryRefund, TicketCategoryTechnical, TicketCategoryAccess, TicketCategoryOther:
		return true
	default:
		return false
	}
}

func isValidPriority(priority TicketPriority) bool {
	switch priority {
	case TicketPriorityLow, TicketPriorityMedium, TicketPriorityHigh, TicketPriorityUrgent:
		return true
	default:
		return false
	}
}

func isValidStatus(status TicketStatus) bool {
	switch status {
	case TicketStatusOpen, TicketStatusInProgress, TicketStatusWaitingCustomer, TicketStatusResolved, TicketStatusClosed:
		return true
	default:
		return false
	}
}

func isValidStatusTransition(from, to TicketStatus) bool {
	// Define valid transitions
	validTransitions := map[TicketStatus][]TicketStatus{
		TicketStatusOpen:            {TicketStatusInProgress, TicketStatusWaitingCustomer, TicketStatusResolved, TicketStatusClosed},
		TicketStatusInProgress:      {TicketStatusWaitingCustomer, TicketStatusResolved, TicketStatusClosed, TicketStatusOpen},
		TicketStatusWaitingCustomer: {TicketStatusInProgress, TicketStatusResolved, TicketStatusClosed, TicketStatusOpen},
		TicketStatusResolved:        {TicketStatusClosed, TicketStatusOpen, TicketStatusInProgress},
		TicketStatusClosed:          {TicketStatusOpen}, // Can reopen closed tickets
	}

	allowed, ok := validTransitions[from]
	if !ok {
		return false
	}

	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}
