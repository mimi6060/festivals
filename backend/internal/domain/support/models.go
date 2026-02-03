package support

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// TicketStatus represents the status of a support ticket
type TicketStatus string

const (
	TicketStatusOpen            TicketStatus = "OPEN"
	TicketStatusInProgress      TicketStatus = "IN_PROGRESS"
	TicketStatusWaitingCustomer TicketStatus = "WAITING_CUSTOMER"
	TicketStatusResolved        TicketStatus = "RESOLVED"
	TicketStatusClosed          TicketStatus = "CLOSED"
)

// TicketPriority represents the priority level of a support ticket
type TicketPriority string

const (
	TicketPriorityLow    TicketPriority = "LOW"
	TicketPriorityMedium TicketPriority = "MEDIUM"
	TicketPriorityHigh   TicketPriority = "HIGH"
	TicketPriorityUrgent TicketPriority = "URGENT"
)

// TicketCategory represents the category of a support ticket
type TicketCategory string

const (
	TicketCategoryPayment   TicketCategory = "PAYMENT"
	TicketCategoryRefund    TicketCategory = "REFUND"
	TicketCategoryTechnical TicketCategory = "TECHNICAL"
	TicketCategoryAccess    TicketCategory = "ACCESS"
	TicketCategoryOther     TicketCategory = "OTHER"
)

// SenderType represents who sent a message
type SenderType string

const (
	SenderTypeUser  SenderType = "USER"
	SenderTypeStaff SenderType = "STAFF"
	SenderTypeSystem SenderType = "SYSTEM"
)

// SupportTicket represents a customer support ticket
type SupportTicket struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID  uuid.UUID      `json:"festivalId" gorm:"type:uuid;not null;index"`
	UserID      uuid.UUID      `json:"userId" gorm:"type:uuid;not null;index"`
	Subject     string         `json:"subject" gorm:"not null"`
	Description string         `json:"description" gorm:"type:text;not null"`
	Status      TicketStatus   `json:"status" gorm:"default:'OPEN';index"`
	Priority    TicketPriority `json:"priority" gorm:"default:'MEDIUM'"`
	Category    TicketCategory `json:"category" gorm:"not null"`
	AssignedTo  *uuid.UUID     `json:"assignedTo,omitempty" gorm:"type:uuid;index"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	ResolvedAt  *time.Time     `json:"resolvedAt,omitempty"`
}

func (SupportTicket) TableName() string {
	return "support_tickets"
}

// TicketMessage represents a message in a support ticket thread
type TicketMessage struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	TicketID    uuid.UUID      `json:"ticketId" gorm:"type:uuid;not null;index"`
	SenderID    uuid.UUID      `json:"senderId" gorm:"type:uuid;not null"`
	SenderType  SenderType     `json:"senderType" gorm:"not null"`
	Message     string         `json:"message" gorm:"type:text;not null"`
	Attachments pq.StringArray `json:"attachments,omitempty" gorm:"type:text[]"`
	CreatedAt   time.Time      `json:"createdAt"`
}

func (TicketMessage) TableName() string {
	return "ticket_messages"
}

// FAQItem represents a frequently asked question
type FAQItem struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID  uuid.UUID `json:"festivalId" gorm:"type:uuid;not null;index"`
	Question    string    `json:"question" gorm:"not null"`
	Answer      string    `json:"answer" gorm:"type:text;not null"`
	Category    string    `json:"category" gorm:"not null;index"`
	Order       int       `json:"order" gorm:"default:0"`
	IsPublished bool      `json:"isPublished" gorm:"default:true"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (FAQItem) TableName() string {
	return "faq_items"
}

// Request types

// CreateTicketRequest represents the request to create a new support ticket
type CreateTicketRequest struct {
	Subject     string         `json:"subject" binding:"required,min=5,max=200"`
	Description string         `json:"description" binding:"required,min=10,max=5000"`
	Category    TicketCategory `json:"category" binding:"required"`
	Priority    *TicketPriority `json:"priority,omitempty"`
}

// UpdateTicketStatusRequest represents the request to update ticket status
type UpdateTicketStatusRequest struct {
	Status TicketStatus `json:"status" binding:"required"`
}

// AssignTicketRequest represents the request to assign a ticket to staff
type AssignTicketRequest struct {
	AssignedTo uuid.UUID `json:"assignedTo" binding:"required"`
}

// CreateMessageRequest represents the request to add a message to a ticket
type CreateMessageRequest struct {
	Message     string   `json:"message" binding:"required,min=1,max=5000"`
	Attachments []string `json:"attachments,omitempty"`
}

// CreateFAQRequest represents the request to create a new FAQ item
type CreateFAQRequest struct {
	Question    string `json:"question" binding:"required,min=10,max=500"`
	Answer      string `json:"answer" binding:"required,min=10,max=5000"`
	Category    string `json:"category" binding:"required,max=100"`
	Order       *int   `json:"order,omitempty"`
	IsPublished *bool  `json:"isPublished,omitempty"`
}

// UpdateFAQRequest represents the request to update an FAQ item
type UpdateFAQRequest struct {
	Question    *string `json:"question,omitempty" binding:"omitempty,min=10,max=500"`
	Answer      *string `json:"answer,omitempty" binding:"omitempty,min=10,max=5000"`
	Category    *string `json:"category,omitempty" binding:"omitempty,max=100"`
	Order       *int    `json:"order,omitempty"`
	IsPublished *bool   `json:"isPublished,omitempty"`
}

// Response types

// SupportTicketResponse represents the response for a support ticket
type SupportTicketResponse struct {
	ID          uuid.UUID      `json:"id"`
	FestivalID  uuid.UUID      `json:"festivalId"`
	UserID      uuid.UUID      `json:"userId"`
	Subject     string         `json:"subject"`
	Description string         `json:"description"`
	Status      TicketStatus   `json:"status"`
	Priority    TicketPriority `json:"priority"`
	Category    TicketCategory `json:"category"`
	AssignedTo  *uuid.UUID     `json:"assignedTo,omitempty"`
	CreatedAt   string         `json:"createdAt"`
	UpdatedAt   string         `json:"updatedAt"`
	ResolvedAt  *string        `json:"resolvedAt,omitempty"`
}

func (t *SupportTicket) ToResponse() SupportTicketResponse {
	var resolvedAt *string
	if t.ResolvedAt != nil {
		formatted := t.ResolvedAt.Format(time.RFC3339)
		resolvedAt = &formatted
	}

	return SupportTicketResponse{
		ID:          t.ID,
		FestivalID:  t.FestivalID,
		UserID:      t.UserID,
		Subject:     t.Subject,
		Description: t.Description,
		Status:      t.Status,
		Priority:    t.Priority,
		Category:    t.Category,
		AssignedTo:  t.AssignedTo,
		CreatedAt:   t.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   t.UpdatedAt.Format(time.RFC3339),
		ResolvedAt:  resolvedAt,
	}
}

// TicketMessageResponse represents the response for a ticket message
type TicketMessageResponse struct {
	ID          uuid.UUID  `json:"id"`
	TicketID    uuid.UUID  `json:"ticketId"`
	SenderID    uuid.UUID  `json:"senderId"`
	SenderType  SenderType `json:"senderType"`
	Message     string     `json:"message"`
	Attachments []string   `json:"attachments,omitempty"`
	CreatedAt   string     `json:"createdAt"`
}

func (m *TicketMessage) ToResponse() TicketMessageResponse {
	attachments := []string{}
	if m.Attachments != nil {
		attachments = m.Attachments
	}

	return TicketMessageResponse{
		ID:          m.ID,
		TicketID:    m.TicketID,
		SenderID:    m.SenderID,
		SenderType:  m.SenderType,
		Message:     m.Message,
		Attachments: attachments,
		CreatedAt:   m.CreatedAt.Format(time.RFC3339),
	}
}

// FAQItemResponse represents the response for an FAQ item
type FAQItemResponse struct {
	ID          uuid.UUID `json:"id"`
	FestivalID  uuid.UUID `json:"festivalId"`
	Question    string    `json:"question"`
	Answer      string    `json:"answer"`
	Category    string    `json:"category"`
	Order       int       `json:"order"`
	IsPublished bool      `json:"isPublished"`
	CreatedAt   string    `json:"createdAt"`
	UpdatedAt   string    `json:"updatedAt"`
}

func (f *FAQItem) ToResponse() FAQItemResponse {
	return FAQItemResponse{
		ID:          f.ID,
		FestivalID:  f.FestivalID,
		Question:    f.Question,
		Answer:      f.Answer,
		Category:    f.Category,
		Order:       f.Order,
		IsPublished: f.IsPublished,
		CreatedAt:   f.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   f.UpdatedAt.Format(time.RFC3339),
	}
}

// TicketStats represents statistics about support tickets
type TicketStats struct {
	Total           int64            `json:"total"`
	Open            int64            `json:"open"`
	InProgress      int64            `json:"inProgress"`
	WaitingCustomer int64            `json:"waitingCustomer"`
	Resolved        int64            `json:"resolved"`
	Closed          int64            `json:"closed"`
	ByCategory      map[string]int64 `json:"byCategory"`
	ByPriority      map[string]int64 `json:"byPriority"`
	AvgResolutionTime *float64       `json:"avgResolutionTimeHours,omitempty"`
}
