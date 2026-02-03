package ticket

import (
	"context"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/qrcode"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

// QRService handles QR code generation and validation for tickets
type QRService struct {
	repo      Repository
	generator *qrcode.Generator
}

// NewQRService creates a new ticket QR code service
func NewQRService(repo Repository, generator *qrcode.Generator) *QRService {
	return &QRService{
		repo:      repo,
		generator: generator,
	}
}

// QRCodeResult contains the generated QR code and metadata
type QRCodeResult struct {
	TicketID   uuid.UUID `json:"ticketId"`
	TicketCode string    `json:"ticketCode"`
	FestivalID uuid.UUID `json:"festivalId"`
	QRData     string    `json:"qrData"`     // Base64 encoded QR payload
	QRImage    []byte    `json:"-"`          // PNG image bytes
	QRImageB64 string    `json:"qrImageB64"` // Base64 encoded PNG image
	ExpiresAt  time.Time `json:"expiresAt"`
	GeneratedAt time.Time `json:"generatedAt"`
}

// GenerateQRCode generates a QR code for a specific ticket
func (s *QRService) GenerateQRCode(ctx context.Context, ticketID uuid.UUID) (*QRCodeResult, error) {
	// Get ticket
	ticket, err := s.repo.GetTicketByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}
	if ticket == nil {
		return nil, errors.ErrTicketNotFound
	}

	// Get ticket type for validity period
	ticketType, err := s.repo.GetTicketTypeByID(ctx, ticket.TicketTypeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get ticket type: %w", err)
	}
	if ticketType == nil {
		return nil, fmt.Errorf("ticket type not found")
	}

	// Check ticket status
	if ticket.Status != TicketStatusValid && ticket.Status != TicketStatusUsed {
		return nil, fmt.Errorf("cannot generate QR code for ticket with status: %s", ticket.Status)
	}

	// Determine user ID (use nil UUID if no user assigned)
	userID := uuid.Nil
	if ticket.UserID != nil {
		userID = *ticket.UserID
	}

	// Generate QR code
	qrImage, err := s.generator.GenerateTicketQR(
		ticket.ID,
		userID,
		ticket.FestivalID,
		ticket.Code,
		ticketType.ValidUntil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to generate QR code: %w", err)
	}

	// Generate QR data string for storage/verification
	qrData, err := s.generator.GenerateQRDataOnly(
		ticket.ID,
		userID,
		ticket.FestivalID,
		ticket.Code,
		ticketType.ValidUntil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to generate QR data: %w", err)
	}

	return &QRCodeResult{
		TicketID:    ticket.ID,
		TicketCode:  ticket.Code,
		FestivalID:  ticket.FestivalID,
		QRData:      qrData,
		QRImage:     qrImage,
		QRImageB64:  base64.StdEncoding.EncodeToString(qrImage),
		ExpiresAt:   ticketType.ValidUntil,
		GeneratedAt: time.Now(),
	}, nil
}

// GenerateQRCodeByCode generates a QR code for a ticket identified by its code
func (s *QRService) GenerateQRCodeByCode(ctx context.Context, ticketCode string) (*QRCodeResult, error) {
	// Get ticket by code
	ticket, err := s.repo.GetTicketByCode(ctx, ticketCode)
	if err != nil {
		return nil, err
	}
	if ticket == nil {
		return nil, errors.ErrTicketNotFound
	}

	return s.GenerateQRCode(ctx, ticket.ID)
}

// ValidateQRCode validates a QR code payload and returns the associated ticket
func (s *QRService) ValidateQRCode(ctx context.Context, qrData string) (*Ticket, *qrcode.Payload, error) {
	// Verify and decode the QR payload
	payload, err := s.generator.VerifyAndDecodePayload(qrData)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid QR code: %w", err)
	}

	// Get ticket from database
	ticket, err := s.repo.GetTicketByID(ctx, payload.TicketID)
	if err != nil {
		return nil, nil, err
	}
	if ticket == nil {
		return nil, nil, errors.ErrTicketNotFound
	}

	// Verify ticket code matches
	if ticket.Code != payload.TicketCode {
		return nil, nil, fmt.Errorf("ticket code mismatch")
	}

	// Verify festival ID matches
	if ticket.FestivalID != payload.FestivalID {
		return nil, nil, fmt.Errorf("festival ID mismatch")
	}

	return ticket, payload, nil
}

// RegenerateQRCode regenerates a QR code for a ticket (creates new signature with current timestamp)
func (s *QRService) RegenerateQRCode(ctx context.Context, ticketID uuid.UUID) (*QRCodeResult, error) {
	// Simply generate a new QR code - it will have a new timestamp
	return s.GenerateQRCode(ctx, ticketID)
}

// BulkGenerateQRCodes generates QR codes for multiple tickets
func (s *QRService) BulkGenerateQRCodes(ctx context.Context, ticketIDs []uuid.UUID) (map[uuid.UUID]*QRCodeResult, []error) {
	results := make(map[uuid.UUID]*QRCodeResult)
	var errors []error

	for _, ticketID := range ticketIDs {
		result, err := s.GenerateQRCode(ctx, ticketID)
		if err != nil {
			errors = append(errors, fmt.Errorf("ticket %s: %w", ticketID.String(), err))
			continue
		}
		results[ticketID] = result
	}

	return results, errors
}

// GenerateQRCodeForEmail generates a QR code optimized for email embedding
// Returns the QR code as a base64 data URI suitable for inline images
func (s *QRService) GenerateQRCodeForEmail(ctx context.Context, ticketID uuid.UUID) (string, error) {
	result, err := s.GenerateQRCode(ctx, ticketID)
	if err != nil {
		return "", err
	}

	// Return as data URI for inline embedding
	return fmt.Sprintf("data:image/png;base64,%s", result.QRImageB64), nil
}

// GetQRCodeAsPNG returns the QR code as raw PNG bytes
func (s *QRService) GetQRCodeAsPNG(ctx context.Context, ticketID uuid.UUID) ([]byte, string, error) {
	result, err := s.GenerateQRCode(ctx, ticketID)
	if err != nil {
		return nil, "", err
	}

	filename := fmt.Sprintf("ticket-%s-qr.png", result.TicketCode)
	return result.QRImage, filename, nil
}

// TicketQRInfo contains ticket information along with QR code data for confirmation emails
type TicketQRInfo struct {
	Ticket       *Ticket
	TicketType   *TicketType
	QRCodeB64    string
	QRDataURI    string
	ExpiresAt    time.Time
}

// GetTicketQRInfo retrieves complete ticket information with QR code for email/display
func (s *QRService) GetTicketQRInfo(ctx context.Context, ticketID uuid.UUID) (*TicketQRInfo, error) {
	// Get ticket
	ticket, err := s.repo.GetTicketByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}
	if ticket == nil {
		return nil, errors.ErrTicketNotFound
	}

	// Get ticket type
	ticketType, err := s.repo.GetTicketTypeByID(ctx, ticket.TicketTypeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get ticket type: %w", err)
	}

	// Generate QR code
	qrResult, err := s.GenerateQRCode(ctx, ticketID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate QR code: %w", err)
	}

	return &TicketQRInfo{
		Ticket:     ticket,
		TicketType: ticketType,
		QRCodeB64:  qrResult.QRImageB64,
		QRDataURI:  fmt.Sprintf("data:image/png;base64,%s", qrResult.QRImageB64),
		ExpiresAt:  qrResult.ExpiresAt,
	}, nil
}
