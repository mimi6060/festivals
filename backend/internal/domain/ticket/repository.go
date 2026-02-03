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
	CreateTicketAtomic(ctx context.Context, festivalID uuid.UUID, ticket *Ticket) error // Atomic ticket creation with inventory check
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

// CreateTicketAtomic creates a ticket with atomic inventory check to prevent overselling
// This method uses pessimistic locking (SELECT FOR UPDATE) to ensure only one ticket
// can be created at a time for a given ticket type, preventing race conditions
func (r *repository) CreateTicketAtomic(ctx context.Context, festivalID uuid.UUID, ticket *Ticket) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Lock the ticket type row for update to prevent concurrent modifications
		var ticketType TicketType
		if err := tx.Raw("SELECT * FROM ticket_types WHERE id = ? FOR UPDATE", ticket.TicketTypeID).
			Scan(&ticketType).Error; err != nil {
			return fmt.Errorf("failed to lock ticket type: %w", err)
		}

		// Check if ticket type exists
		if ticketType.ID == uuid.Nil {
			return fmt.Errorf("ticket type not found")
		}

		// Verify ticket type belongs to the festival
		if ticketType.FestivalID != festivalID {
			return fmt.Errorf("ticket type does not belong to this festival")
		}

		// Check ticket type status
		if ticketType.Status != TicketTypeStatusActive {
			return fmt.Errorf("ticket type is not available")
		}

		// Check availability with locked row - prevents race conditions
		if ticketType.Quantity != nil && ticketType.QuantitySold >= *ticketType.Quantity {
			return fmt.Errorf("tickets sold out")
		}

		// Create the ticket
		if err := tx.Create(ticket).Error; err != nil {
			return fmt.Errorf("failed to create ticket: %w", err)
		}

		// Atomically increment quantity sold
		newQuantitySold := ticketType.QuantitySold + 1
		result := tx.Model(&TicketType{}).
			Where("id = ? AND quantity_sold = ?", ticket.TicketTypeID, ticketType.QuantitySold).
			Update("quantity_sold", newQuantitySold)

		if result.Error != nil {
			return fmt.Errorf("failed to update quantity sold: %w", result.Error)
		}

		if result.RowsAffected == 0 {
			return fmt.Errorf("concurrent modification detected, please retry")
		}

		// Update status to sold out if needed
		if ticketType.Quantity != nil && newQuantitySold >= *ticketType.Quantity {
			if err := tx.Model(&TicketType{}).
				Where("id = ?", ticket.TicketTypeID).
				Update("status", TicketTypeStatusSoldOut).Error; err != nil {
				return fmt.Errorf("failed to update ticket type status: %w", err)
			}
		}

		return nil
	})
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
