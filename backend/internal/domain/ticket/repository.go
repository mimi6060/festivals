package ticket

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	// TicketType operations
	CreateTicketType(ctx context.Context, ticketType *TicketType) error
	GetTicketTypeByID(ctx context.Context, id uuid.UUID) (*TicketType, error)
	ListTicketTypesByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]TicketType, int64, error)
	UpdateTicketType(ctx context.Context, ticketType *TicketType) error
	DeleteTicketType(ctx context.Context, id uuid.UUID) error
	UpdateQuantitySold(ctx context.Context, ticketTypeID uuid.UUID, delta int) error

	// Ticket operations
	CreateTicket(ctx context.Context, ticket *Ticket) error
	GetTicketByID(ctx context.Context, id uuid.UUID) (*Ticket, error)
	GetTicketByCode(ctx context.Context, code string) (*Ticket, error)
	ListTicketsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Ticket, int64, error)
	ListTicketsByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]Ticket, int64, error)
	UpdateTicket(ctx context.Context, ticket *Ticket) error

	// TicketScan operations
	CreateTicketScan(ctx context.Context, scan *TicketScan) error
	GetTicketScansByTicket(ctx context.Context, ticketID uuid.UUID, offset, limit int) ([]TicketScan, int64, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// TicketType operations

func (r *repository) CreateTicketType(ctx context.Context, ticketType *TicketType) error {
	return r.db.WithContext(ctx).Create(ticketType).Error
}

func (r *repository) GetTicketTypeByID(ctx context.Context, id uuid.UUID) (*TicketType, error) {
	var ticketType TicketType
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&ticketType).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get ticket type: %w", err)
	}
	return &ticketType, nil
}

func (r *repository) ListTicketTypesByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]TicketType, int64, error) {
	var ticketTypes []TicketType
	var total int64

	query := r.db.WithContext(ctx).Model(&TicketType{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count ticket types: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&ticketTypes).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list ticket types: %w", err)
	}

	return ticketTypes, total, nil
}

func (r *repository) UpdateTicketType(ctx context.Context, ticketType *TicketType) error {
	return r.db.WithContext(ctx).Save(ticketType).Error
}

func (r *repository) DeleteTicketType(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&TicketType{}).Error
}

func (r *repository) UpdateQuantitySold(ctx context.Context, ticketTypeID uuid.UUID, delta int) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var ticketType TicketType
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", ticketTypeID).
			First(&ticketType).Error; err != nil {
			return fmt.Errorf("failed to lock ticket type: %w", err)
		}

		newQuantitySold := ticketType.QuantitySold + delta
		if newQuantitySold < 0 {
			return fmt.Errorf("quantity sold cannot be negative")
		}

		// Check if we exceed available quantity
		if ticketType.Quantity != nil && newQuantitySold > *ticketType.Quantity {
			return fmt.Errorf("not enough tickets available")
		}

		if err := tx.Model(&ticketType).Update("quantity_sold", newQuantitySold).Error; err != nil {
			return fmt.Errorf("failed to update quantity sold: %w", err)
		}

		// Update status to sold out if needed
		if ticketType.Quantity != nil && newQuantitySold >= *ticketType.Quantity {
			if err := tx.Model(&ticketType).Update("status", TicketTypeStatusSoldOut).Error; err != nil {
				return fmt.Errorf("failed to update ticket type status: %w", err)
			}
		}

		return nil
	})
}

// Ticket operations

func (r *repository) CreateTicket(ctx context.Context, ticket *Ticket) error {
	return r.db.WithContext(ctx).Create(ticket).Error
}

func (r *repository) GetTicketByID(ctx context.Context, id uuid.UUID) (*Ticket, error) {
	var ticket Ticket
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&ticket).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get ticket: %w", err)
	}
	return &ticket, nil
}

func (r *repository) GetTicketByCode(ctx context.Context, code string) (*Ticket, error) {
	var ticket Ticket
	err := r.db.WithContext(ctx).Where("code = ?", code).First(&ticket).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get ticket by code: %w", err)
	}
	return &ticket, nil
}

func (r *repository) ListTicketsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Ticket, int64, error) {
	var tickets []Ticket
	var total int64

	query := r.db.WithContext(ctx).Model(&Ticket{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count tickets: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&tickets).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list tickets: %w", err)
	}

	return tickets, total, nil
}

func (r *repository) ListTicketsByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]Ticket, int64, error) {
	var tickets []Ticket
	var total int64

	query := r.db.WithContext(ctx).Model(&Ticket{}).Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count user tickets: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&tickets).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list user tickets: %w", err)
	}

	return tickets, total, nil
}

func (r *repository) UpdateTicket(ctx context.Context, ticket *Ticket) error {
	return r.db.WithContext(ctx).Save(ticket).Error
}

// TicketScan operations

func (r *repository) CreateTicketScan(ctx context.Context, scan *TicketScan) error {
	return r.db.WithContext(ctx).Create(scan).Error
}

func (r *repository) GetTicketScansByTicket(ctx context.Context, ticketID uuid.UUID, offset, limit int) ([]TicketScan, int64, error) {
	var scans []TicketScan
	var total int64

	query := r.db.WithContext(ctx).Model(&TicketScan{}).Where("ticket_id = ?", ticketID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count ticket scans: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("scanned_at DESC").Find(&scans).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list ticket scans: %w", err)
	}

	return scans, total, nil
}
