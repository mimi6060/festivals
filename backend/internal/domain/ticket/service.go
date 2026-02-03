package ticket

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// TicketType operations

// CreateTicketType creates a new ticket type for a festival
func (s *Service) CreateTicketType(ctx context.Context, festivalID uuid.UUID, req CreateTicketTypeRequest) (*TicketType, error) {
	// Validate date range
	if req.ValidUntil.Before(req.ValidFrom) {
		return nil, fmt.Errorf("valid until must be after valid from")
	}

	settings := TicketSettings{}
	if req.Settings != nil {
		settings = *req.Settings
	}

	ticketType := &TicketType{
		ID:          uuid.New(),
		FestivalID:  festivalID,
		Name:        req.Name,
		Description: req.Description,
		Price:       req.Price,
		Quantity:    req.Quantity,
		ValidFrom:   req.ValidFrom,
		ValidUntil:  req.ValidUntil,
		Benefits:    req.Benefits,
		Settings:    settings,
		Status:      TicketTypeStatusActive,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.repo.CreateTicketType(ctx, ticketType); err != nil {
		return nil, fmt.Errorf("failed to create ticket type: %w", err)
	}

	return ticketType, nil
}

// UpdateTicketType updates an existing ticket type
func (s *Service) UpdateTicketType(ctx context.Context, id uuid.UUID, req UpdateTicketTypeRequest) (*TicketType, error) {
	ticketType, err := s.repo.GetTicketTypeByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if ticketType == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.Name != nil {
		ticketType.Name = *req.Name
	}
	if req.Description != nil {
		ticketType.Description = *req.Description
	}
	if req.Price != nil {
		ticketType.Price = *req.Price
	}
	if req.Quantity != nil {
		ticketType.Quantity = req.Quantity
	}
	if req.ValidFrom != nil {
		ticketType.ValidFrom = *req.ValidFrom
	}
	if req.ValidUntil != nil {
		ticketType.ValidUntil = *req.ValidUntil
	}
	if req.Benefits != nil {
		ticketType.Benefits = req.Benefits
	}
	if req.Settings != nil {
		ticketType.Settings = *req.Settings
	}
	if req.Status != nil {
		ticketType.Status = *req.Status
	}

	ticketType.UpdatedAt = time.Now()

	if err := s.repo.UpdateTicketType(ctx, ticketType); err != nil {
		return nil, fmt.Errorf("failed to update ticket type: %w", err)
	}

	return ticketType, nil
}

// GetTicketType gets a ticket type by ID
func (s *Service) GetTicketType(ctx context.Context, id uuid.UUID) (*TicketType, error) {
	ticketType, err := s.repo.GetTicketTypeByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if ticketType == nil {
		return nil, errors.ErrNotFound
	}
	return ticketType, nil
}

// ListTicketTypes lists ticket types for a festival
func (s *Service) ListTicketTypes(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]TicketType, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListTicketTypesByFestival(ctx, festivalID, offset, perPage)
}

// DeleteTicketType deletes a ticket type
func (s *Service) DeleteTicketType(ctx context.Context, id uuid.UUID) error {
	ticketType, err := s.repo.GetTicketTypeByID(ctx, id)
	if err != nil {
		return err
	}
	if ticketType == nil {
		return errors.ErrNotFound
	}

	// Check if any tickets have been sold
	if ticketType.QuantitySold > 0 {
		return fmt.Errorf("cannot delete ticket type with sold tickets")
	}

	return s.repo.DeleteTicketType(ctx, id)
}

// Ticket operations

// CreateTicket creates a new ticket with a unique secure code using atomic operations
// This method uses pessimistic locking (SELECT FOR UPDATE) to prevent overselling
func (s *Service) CreateTicket(ctx context.Context, festivalID uuid.UUID, req CreateTicketRequest) (*Ticket, error) {
	// Generate secure unique code first (outside transaction to avoid holding locks)
	code, err := generateSecureCode()
	if err != nil {
		return nil, fmt.Errorf("failed to generate ticket code: %w", err)
	}

	ticket := &Ticket{
		ID:           uuid.New(),
		TicketTypeID: req.TicketTypeID,
		FestivalID:   festivalID,
		UserID:       req.UserID,
		Code:         code,
		HolderName:   req.HolderName,
		HolderEmail:  req.HolderEmail,
		Status:       TicketStatusValid,
		Metadata: TicketMeta{
			PurchaseDate: time.Now().Format(time.RFC3339),
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Use atomic ticket creation with inventory check
	if err := s.repo.CreateTicketAtomic(ctx, festivalID, ticket); err != nil {
		return nil, err
	}

	return ticket, nil
}

// GetTicket gets a ticket by ID
func (s *Service) GetTicket(ctx context.Context, id uuid.UUID) (*Ticket, error) {
	ticket, err := s.repo.GetTicketByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if ticket == nil {
		return nil, errors.ErrNotFound
	}
	return ticket, nil
}

// GetTicketByCode gets a ticket by its unique code
func (s *Service) GetTicketByCode(ctx context.Context, code string) (*Ticket, error) {
	ticket, err := s.repo.GetTicketByCode(ctx, code)
	if err != nil {
		return nil, err
	}
	if ticket == nil {
		return nil, errors.ErrTicketNotFound
	}
	return ticket, nil
}

// GetUserTickets gets all tickets for a user
func (s *Service) GetUserTickets(ctx context.Context, userID uuid.UUID, page, perPage int) ([]Ticket, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListTicketsByUser(ctx, userID, offset, perPage)
}

// ListTicketsByFestival lists all tickets for a festival
func (s *Service) ListTicketsByFestival(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]Ticket, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListTicketsByFestival(ctx, festivalID, offset, perPage)
}

// ListTicketsByUser lists all tickets for a user
func (s *Service) ListTicketsByUser(ctx context.Context, userID uuid.UUID, page, perPage int) ([]Ticket, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListTicketsByUser(ctx, userID, offset, perPage)
}

// ScanTicket scans a ticket for entry/exit validation
func (s *Service) ScanTicket(ctx context.Context, festivalID uuid.UUID, req ScanTicketRequest, scannedBy uuid.UUID) (*ScanResponse, error) {
	now := time.Now()

	// Get ticket by code
	ticket, err := s.repo.GetTicketByCode(ctx, req.Code)
	if err != nil {
		return nil, err
	}

	// Create scan record
	scan := &TicketScan{
		ID:         uuid.New(),
		FestivalID: festivalID,
		ScanType:   req.ScanType,
		ScannedBy:  scannedBy,
		Location:   req.Location,
		DeviceID:   req.DeviceID,
		ScannedAt:  now,
	}

	// Validate ticket exists
	if ticket == nil {
		scan.Result = ScanResultInvalid
		scan.Message = "Ticket not found"
		_ = s.repo.CreateTicketScan(ctx, scan)
		return &ScanResponse{
			Success:   false,
			Result:    ScanResultInvalid,
			Message:   "Ticket not found",
			ScannedAt: now.Format(time.RFC3339),
		}, nil
	}

	scan.TicketID = ticket.ID

	// Validate ticket belongs to this festival
	if ticket.FestivalID != festivalID {
		scan.Result = ScanResultInvalid
		scan.Message = "Ticket does not belong to this festival"
		_ = s.repo.CreateTicketScan(ctx, scan)
		return &ScanResponse{
			Success:   false,
			Result:    ScanResultInvalid,
			Message:   "Ticket does not belong to this festival",
			ScannedAt: now.Format(time.RFC3339),
		}, nil
	}

	// Get ticket type to check validity dates and reentry policy
	ticketType, err := s.repo.GetTicketTypeByID(ctx, ticket.TicketTypeID)
	if err != nil {
		return nil, err
	}

	// Check ticket validity period
	if now.Before(ticketType.ValidFrom) {
		scan.Result = ScanResultInvalid
		scan.Message = "Ticket not yet valid"
		_ = s.repo.CreateTicketScan(ctx, scan)
		return &ScanResponse{
			Success:   false,
			Result:    ScanResultInvalid,
			Message:   "Ticket not yet valid",
			ScannedAt: now.Format(time.RFC3339),
		}, nil
	}

	if now.After(ticketType.ValidUntil) {
		// Mark ticket as expired if not already
		if ticket.Status != TicketStatusExpired {
			ticket.Status = TicketStatusExpired
			ticket.UpdatedAt = now
			_ = s.repo.UpdateTicket(ctx, ticket)
		}

		scan.Result = ScanResultExpired
		scan.Message = "Ticket has expired"
		_ = s.repo.CreateTicketScan(ctx, scan)
		return &ScanResponse{
			Success:   false,
			Ticket:    ticketResponsePtr(ticket),
			Result:    ScanResultExpired,
			Message:   "Ticket has expired",
			ScannedAt: now.Format(time.RFC3339),
		}, nil
	}

	// Check ticket status
	switch ticket.Status {
	case TicketStatusCancelled:
		scan.Result = ScanResultInvalid
		scan.Message = "Ticket has been cancelled"
		_ = s.repo.CreateTicketScan(ctx, scan)
		return &ScanResponse{
			Success:   false,
			Ticket:    ticketResponsePtr(ticket),
			Result:    ScanResultInvalid,
			Message:   "Ticket has been cancelled",
			ScannedAt: now.Format(time.RFC3339),
		}, nil

	case TicketStatusTransferred:
		scan.Result = ScanResultInvalid
		scan.Message = "Ticket has been transferred"
		_ = s.repo.CreateTicketScan(ctx, scan)
		return &ScanResponse{
			Success:   false,
			Ticket:    ticketResponsePtr(ticket),
			Result:    ScanResultInvalid,
			Message:   "Ticket has been transferred",
			ScannedAt: now.Format(time.RFC3339),
		}, nil

	case TicketStatusExpired:
		scan.Result = ScanResultExpired
		scan.Message = "Ticket has expired"
		_ = s.repo.CreateTicketScan(ctx, scan)
		return &ScanResponse{
			Success:   false,
			Ticket:    ticketResponsePtr(ticket),
			Result:    ScanResultExpired,
			Message:   "Ticket has expired",
			ScannedAt: now.Format(time.RFC3339),
		}, nil

	case TicketStatusUsed:
		// Check reentry policy
		if !ticketType.Settings.AllowReentry {
			scan.Result = ScanResultAlready
			scan.Message = "Ticket already used - reentry not allowed"
			_ = s.repo.CreateTicketScan(ctx, scan)
			return &ScanResponse{
				Success:   false,
				Ticket:    ticketResponsePtr(ticket),
				Result:    ScanResultAlready,
				Message:   "Ticket already used - reentry not allowed",
				ScannedAt: now.Format(time.RFC3339),
			}, nil
		}
		// Allow reentry - continue processing
	}

	// Handle different scan types
	switch req.ScanType {
	case ScanTypeEntry:
		// Mark ticket as used on first entry
		if ticket.Status == TicketStatusValid {
			ticket.Status = TicketStatusUsed
			ticket.CheckedInAt = &now
			ticket.CheckedInBy = &scannedBy
			ticket.UpdatedAt = now
			if err := s.repo.UpdateTicket(ctx, ticket); err != nil {
				return nil, fmt.Errorf("failed to update ticket: %w", err)
			}
		}

	case ScanTypeExit:
		// Just log the exit, no status change needed

	case ScanTypeCheck:
		// Just verify, no status change
	}

	// Record successful scan
	scan.Result = ScanResultSuccess
	scan.Message = "Valid ticket"
	if err := s.repo.CreateTicketScan(ctx, scan); err != nil {
		return nil, fmt.Errorf("failed to create scan record: %w", err)
	}

	return &ScanResponse{
		Success:   true,
		Ticket:    ticketResponsePtr(ticket),
		Result:    ScanResultSuccess,
		Message:   "Valid ticket",
		ScannedAt: now.Format(time.RFC3339),
	}, nil
}

// TransferTicket transfers a ticket to a new holder
func (s *Service) TransferTicket(ctx context.Context, userID uuid.UUID, req TransferTicketRequest) (*Ticket, error) {
	// Get ticket
	ticket, err := s.repo.GetTicketByID(ctx, req.TicketID)
	if err != nil {
		return nil, err
	}
	if ticket == nil {
		return nil, errors.ErrTicketNotFound
	}

	// Verify ownership
	if ticket.UserID == nil || *ticket.UserID != userID {
		return nil, errors.ErrForbidden
	}

	// Check ticket status
	if ticket.Status != TicketStatusValid {
		return nil, fmt.Errorf("ticket cannot be transferred in current status: %s", ticket.Status)
	}

	// Get ticket type to check transfer settings
	ticketType, err := s.repo.GetTicketTypeByID(ctx, ticket.TicketTypeID)
	if err != nil {
		return nil, err
	}

	// Check if transfers are allowed
	if !ticketType.Settings.TransferAllowed {
		return nil, fmt.Errorf("transfers are not allowed for this ticket type")
	}

	// Check transfer limit
	if ticketType.Settings.MaxTransfers > 0 && ticket.TransferCount >= ticketType.Settings.MaxTransfers {
		return nil, fmt.Errorf("maximum number of transfers reached (%d)", ticketType.Settings.MaxTransfers)
	}

	// Store original owner if this is the first transfer
	if ticket.Metadata.OriginalOwnerID == nil {
		ticket.Metadata.OriginalOwnerID = ticket.UserID
	}

	// Update ticket
	ticket.UserID = nil // Clear user ID, new user will claim via email
	ticket.HolderName = req.NewHolderName
	ticket.HolderEmail = req.NewHolderEmail
	ticket.TransferCount++
	ticket.UpdatedAt = time.Now()

	if err := s.repo.UpdateTicket(ctx, ticket); err != nil {
		return nil, fmt.Errorf("failed to transfer ticket: %w", err)
	}

	// Note: In a real implementation, send email to new holder with claim link

	return ticket, nil
}

// CancelTicket cancels a ticket
func (s *Service) CancelTicket(ctx context.Context, id uuid.UUID) (*Ticket, error) {
	ticket, err := s.repo.GetTicketByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if ticket == nil {
		return nil, errors.ErrTicketNotFound
	}

	if ticket.Status == TicketStatusUsed {
		return nil, fmt.Errorf("cannot cancel a used ticket")
	}

	ticket.Status = TicketStatusCancelled
	ticket.UpdatedAt = time.Now()

	if err := s.repo.UpdateTicket(ctx, ticket); err != nil {
		return nil, fmt.Errorf("failed to cancel ticket: %w", err)
	}

	// Decrement quantity sold
	if err := s.repo.UpdateQuantitySold(ctx, ticket.TicketTypeID, -1); err != nil {
		// Log error but don't fail the cancellation
		fmt.Printf("warning: failed to update quantity sold: %v\n", err)
	}

	return ticket, nil
}

// Helper functions

// generateSecureCode generates a cryptographically secure unique code
func generateSecureCode() (string, error) {
	bytes := make([]byte, 16) // 128 bits of randomness
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// ticketResponsePtr converts a ticket to a response pointer
func ticketResponsePtr(ticket *Ticket) *TicketResponse {
	if ticket == nil {
		return nil
	}
	resp := ticket.ToResponse()
	return &resp
}
