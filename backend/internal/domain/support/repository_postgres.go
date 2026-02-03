package support

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new PostgreSQL repository for support operations
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Support Ticket operations

func (r *repository) CreateTicket(ctx context.Context, ticket *SupportTicket) error {
	return r.db.WithContext(ctx).Create(ticket).Error
}

func (r *repository) GetTicketByID(ctx context.Context, id uuid.UUID) (*SupportTicket, error) {
	var ticket SupportTicket
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&ticket).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get support ticket: %w", err)
	}
	return &ticket, nil
}

func (r *repository) GetTicketsByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]SupportTicket, int64, error) {
	var tickets []SupportTicket
	var total int64

	query := r.db.WithContext(ctx).Model(&SupportTicket{}).Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count user tickets: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&tickets).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list user tickets: %w", err)
	}

	return tickets, total, nil
}

func (r *repository) GetTicketsByFestival(ctx context.Context, festivalID uuid.UUID, filters TicketFilters, offset, limit int) ([]SupportTicket, int64, error) {
	var tickets []SupportTicket
	var total int64

	query := r.db.WithContext(ctx).Model(&SupportTicket{}).Where("festival_id = ?", festivalID)

	// Apply filters
	if filters.Status != nil {
		query = query.Where("status = ?", *filters.Status)
	}
	if filters.Priority != nil {
		query = query.Where("priority = ?", *filters.Priority)
	}
	if filters.Category != nil {
		query = query.Where("category = ?", *filters.Category)
	}
	if filters.AssignedTo != nil {
		query = query.Where("assigned_to = ?", *filters.AssignedTo)
	}
	if filters.UserID != nil {
		query = query.Where("user_id = ?", *filters.UserID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count festival tickets: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&tickets).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list festival tickets: %w", err)
	}

	return tickets, total, nil
}

func (r *repository) UpdateTicket(ctx context.Context, ticket *SupportTicket) error {
	return r.db.WithContext(ctx).Save(ticket).Error
}

func (r *repository) UpdateTicketStatus(ctx context.Context, id uuid.UUID, status TicketStatus) error {
	result := r.db.WithContext(ctx).Model(&SupportTicket{}).Where("id = ?", id).Update("status", status)
	if result.Error != nil {
		return fmt.Errorf("failed to update ticket status: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("ticket not found")
	}
	return nil
}

func (r *repository) AssignTicket(ctx context.Context, id uuid.UUID, assignedTo *uuid.UUID) error {
	result := r.db.WithContext(ctx).Model(&SupportTicket{}).Where("id = ?", id).Update("assigned_to", assignedTo)
	if result.Error != nil {
		return fmt.Errorf("failed to assign ticket: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("ticket not found")
	}
	return nil
}

func (r *repository) GetOpenTickets(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]SupportTicket, int64, error) {
	var tickets []SupportTicket
	var total int64

	query := r.db.WithContext(ctx).Model(&SupportTicket{}).
		Where("festival_id = ?", festivalID).
		Where("status IN ?", []TicketStatus{TicketStatusOpen, TicketStatusInProgress, TicketStatusWaitingCustomer})

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count open tickets: %w", err)
	}

	// Order by priority (urgent first) and then by creation date
	if err := query.Offset(offset).Limit(limit).
		Order("CASE priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 END").
		Order("created_at ASC").
		Find(&tickets).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list open tickets: %w", err)
	}

	return tickets, total, nil
}

func (r *repository) GetTicketStats(ctx context.Context, festivalID uuid.UUID) (*TicketStats, error) {
	stats := &TicketStats{
		ByCategory: make(map[string]int64),
		ByPriority: make(map[string]int64),
	}

	// Get total count
	if err := r.db.WithContext(ctx).Model(&SupportTicket{}).
		Where("festival_id = ?", festivalID).
		Count(&stats.Total).Error; err != nil {
		return nil, fmt.Errorf("failed to count total tickets: %w", err)
	}

	// Get counts by status
	type StatusCount struct {
		Status TicketStatus
		Count  int64
	}
	var statusCounts []StatusCount
	if err := r.db.WithContext(ctx).Model(&SupportTicket{}).
		Select("status, count(*) as count").
		Where("festival_id = ?", festivalID).
		Group("status").
		Scan(&statusCounts).Error; err != nil {
		return nil, fmt.Errorf("failed to count tickets by status: %w", err)
	}

	for _, sc := range statusCounts {
		switch sc.Status {
		case TicketStatusOpen:
			stats.Open = sc.Count
		case TicketStatusInProgress:
			stats.InProgress = sc.Count
		case TicketStatusWaitingCustomer:
			stats.WaitingCustomer = sc.Count
		case TicketStatusResolved:
			stats.Resolved = sc.Count
		case TicketStatusClosed:
			stats.Closed = sc.Count
		}
	}

	// Get counts by category
	type CategoryCount struct {
		Category TicketCategory
		Count    int64
	}
	var categoryCounts []CategoryCount
	if err := r.db.WithContext(ctx).Model(&SupportTicket{}).
		Select("category, count(*) as count").
		Where("festival_id = ?", festivalID).
		Group("category").
		Scan(&categoryCounts).Error; err != nil {
		return nil, fmt.Errorf("failed to count tickets by category: %w", err)
	}

	for _, cc := range categoryCounts {
		stats.ByCategory[string(cc.Category)] = cc.Count
	}

	// Get counts by priority
	type PriorityCount struct {
		Priority TicketPriority
		Count    int64
	}
	var priorityCounts []PriorityCount
	if err := r.db.WithContext(ctx).Model(&SupportTicket{}).
		Select("priority, count(*) as count").
		Where("festival_id = ?", festivalID).
		Group("priority").
		Scan(&priorityCounts).Error; err != nil {
		return nil, fmt.Errorf("failed to count tickets by priority: %w", err)
	}

	for _, pc := range priorityCounts {
		stats.ByPriority[string(pc.Priority)] = pc.Count
	}

	// Calculate average resolution time (for resolved tickets)
	var avgResolutionTime *float64
	if err := r.db.WithContext(ctx).Model(&SupportTicket{}).
		Select("AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)").
		Where("festival_id = ?", festivalID).
		Where("resolved_at IS NOT NULL").
		Scan(&avgResolutionTime).Error; err != nil {
		return nil, fmt.Errorf("failed to calculate avg resolution time: %w", err)
	}
	stats.AvgResolutionTime = avgResolutionTime

	return stats, nil
}

// Ticket Message operations

func (r *repository) AddMessage(ctx context.Context, message *TicketMessage) error {
	return r.db.WithContext(ctx).Create(message).Error
}

func (r *repository) GetMessages(ctx context.Context, ticketID uuid.UUID, offset, limit int) ([]TicketMessage, int64, error) {
	var messages []TicketMessage
	var total int64

	query := r.db.WithContext(ctx).Model(&TicketMessage{}).Where("ticket_id = ?", ticketID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count messages: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at ASC").Find(&messages).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list messages: %w", err)
	}

	return messages, total, nil
}

// FAQ operations

func (r *repository) CreateFAQ(ctx context.Context, faq *FAQItem) error {
	return r.db.WithContext(ctx).Create(faq).Error
}

func (r *repository) GetFAQByID(ctx context.Context, id uuid.UUID) (*FAQItem, error) {
	var faq FAQItem
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&faq).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get FAQ: %w", err)
	}
	return &faq, nil
}

func (r *repository) GetFAQsByFestival(ctx context.Context, festivalID uuid.UUID, publishedOnly bool, offset, limit int) ([]FAQItem, int64, error) {
	var faqs []FAQItem
	var total int64

	query := r.db.WithContext(ctx).Model(&FAQItem{}).Where("festival_id = ?", festivalID)

	if publishedOnly {
		query = query.Where("is_published = ?", true)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count FAQs: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("\"order\" ASC, created_at ASC").Find(&faqs).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list FAQs: %w", err)
	}

	return faqs, total, nil
}

func (r *repository) GetFAQsByCategory(ctx context.Context, festivalID uuid.UUID, category string, publishedOnly bool) ([]FAQItem, error) {
	var faqs []FAQItem

	query := r.db.WithContext(ctx).Where("festival_id = ? AND category = ?", festivalID, category)

	if publishedOnly {
		query = query.Where("is_published = ?", true)
	}

	if err := query.Order("\"order\" ASC, created_at ASC").Find(&faqs).Error; err != nil {
		return nil, fmt.Errorf("failed to list FAQs by category: %w", err)
	}

	return faqs, nil
}

func (r *repository) UpdateFAQ(ctx context.Context, faq *FAQItem) error {
	return r.db.WithContext(ctx).Save(faq).Error
}

func (r *repository) DeleteFAQ(ctx context.Context, id uuid.UUID) error {
	result := r.db.WithContext(ctx).Where("id = ?", id).Delete(&FAQItem{})
	if result.Error != nil {
		return fmt.Errorf("failed to delete FAQ: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("FAQ not found")
	}
	return nil
}
