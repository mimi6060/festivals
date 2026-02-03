package ticket

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/notification"
)

// TicketEmailService integrates ticket service with notification service for sending ticket confirmation emails
type TicketEmailService struct {
	ticketService       *Service
	qrService           *QRService
	notificationService *notification.Service
	baseURL             string
}

// NewTicketEmailService creates a new ticket email service
func NewTicketEmailService(
	ticketService *Service,
	qrService *QRService,
	notificationService *notification.Service,
	baseURL string,
) *TicketEmailService {
	return &TicketEmailService{
		ticketService:       ticketService,
		qrService:           qrService,
		notificationService: notificationService,
		baseURL:             baseURL,
	}
}

// SendTicketConfirmationEmailRequest contains the data needed to send a ticket confirmation email
type SendTicketConfirmationEmailRequest struct {
	TicketID       uuid.UUID
	UserID         uuid.UUID
	ToEmail        string
	UserName       string
	FestivalName   string
	FestivalDate   string
	FestivalVenue  string
	OrderReference string
	PurchaseDate   string
	GatesOpenTime  string
	ParkingInfo    string
	TransportInfo  string
	LogoURL        string
	PrimaryColor   string
	SecondaryColor string
	SupportEmail   string
	WebsiteURL     string
	CalendarURL    string
}

// SendTicketConfirmationEmail sends a ticket confirmation email with QR code
func (s *TicketEmailService) SendTicketConfirmationEmail(ctx context.Context, req SendTicketConfirmationEmailRequest) error {
	// Get ticket QR info
	qrInfo, err := s.qrService.GetTicketQRInfo(ctx, req.TicketID)
	if err != nil {
		return fmt.Errorf("failed to get ticket QR info: %w", err)
	}

	// Build benefits list
	var benefits []string
	if qrInfo.TicketType != nil && qrInfo.TicketType.Benefits != nil {
		benefits = qrInfo.TicketType.Benefits
	}

	// Determine reentry policy
	allowsReentry := false
	if qrInfo.TicketType != nil {
		allowsReentry = qrInfo.TicketType.Settings.AllowReentry
	}

	// Format validity dates
	validFrom := ""
	validUntil := ""
	if qrInfo.TicketType != nil {
		validFrom = qrInfo.TicketType.ValidFrom.Format("January 2, 2006 15:04")
		validUntil = qrInfo.TicketType.ValidUntil.Format("January 2, 2006 15:04")
	}

	// Get ticket type name
	ticketTypeName := "Standard"
	if qrInfo.TicketType != nil {
		ticketTypeName = qrInfo.TicketType.Name
	}

	// Format price
	totalAmount := "0.00 EUR"
	if qrInfo.TicketType != nil {
		totalAmount = formatPrice(qrInfo.TicketType.Price)
	}

	// Holder name
	holderName := req.UserName
	if qrInfo.Ticket != nil && qrInfo.Ticket.HolderName != "" {
		holderName = qrInfo.Ticket.HolderName
	}

	// Build email data
	emailData := notification.TicketConfirmationEmailData{
		UserName:       req.UserName,
		HolderName:     holderName,
		FestivalName:   req.FestivalName,
		FestivalDate:   req.FestivalDate,
		FestivalVenue:  req.FestivalVenue,
		LogoURL:        req.LogoURL,
		PrimaryColor:   req.PrimaryColor,
		SecondaryColor: req.SecondaryColor,
		TicketType:     ticketTypeName,
		TicketCode:     qrInfo.Ticket.Code,
		Quantity:       1,
		Benefits:       benefits,
		AllowsReentry:  allowsReentry,
		QRCodeDataURI:  qrInfo.QRDataURI,
		QRCodeB64:      qrInfo.QRCodeB64,
		TotalAmount:    totalAmount,
		PurchaseDate:   req.PurchaseDate,
		OrderReference: req.OrderReference,
		ValidFrom:      validFrom,
		ValidUntil:     validUntil,
		GatesOpenTime:  req.GatesOpenTime,
		ParkingInfo:    req.ParkingInfo,
		TransportInfo:  req.TransportInfo,
		TicketURL:      fmt.Sprintf("%s/tickets/%s", s.baseURL, qrInfo.Ticket.Code),
		CalendarURL:    req.CalendarURL,
		WebsiteURL:     req.WebsiteURL,
		SupportEmail:   req.SupportEmail,
	}

	// Send email with inline QR code
	return s.notificationService.SendTicketConfirmationEmail(ctx, req.UserID, req.ToEmail, emailData)
}

// SendTicketConfirmationEmailWithAttachment sends a ticket confirmation email with QR code as attachment
func (s *TicketEmailService) SendTicketConfirmationEmailWithAttachment(ctx context.Context, req SendTicketConfirmationEmailRequest) error {
	// Get ticket QR info
	qrInfo, err := s.qrService.GetTicketQRInfo(ctx, req.TicketID)
	if err != nil {
		return fmt.Errorf("failed to get ticket QR info: %w", err)
	}

	// Get QR code PNG bytes
	qrResult, err := s.qrService.GenerateQRCode(ctx, req.TicketID)
	if err != nil {
		return fmt.Errorf("failed to generate QR code: %w", err)
	}

	// Build benefits list
	var benefits []string
	if qrInfo.TicketType != nil && qrInfo.TicketType.Benefits != nil {
		benefits = qrInfo.TicketType.Benefits
	}

	// Determine reentry policy
	allowsReentry := false
	if qrInfo.TicketType != nil {
		allowsReentry = qrInfo.TicketType.Settings.AllowReentry
	}

	// Format validity dates
	validFrom := ""
	validUntil := ""
	if qrInfo.TicketType != nil {
		validFrom = qrInfo.TicketType.ValidFrom.Format("January 2, 2006 15:04")
		validUntil = qrInfo.TicketType.ValidUntil.Format("January 2, 2006 15:04")
	}

	// Get ticket type name
	ticketTypeName := "Standard"
	if qrInfo.TicketType != nil {
		ticketTypeName = qrInfo.TicketType.Name
	}

	// Format price
	totalAmount := "0.00 EUR"
	if qrInfo.TicketType != nil {
		totalAmount = formatPrice(qrInfo.TicketType.Price)
	}

	// Holder name
	holderName := req.UserName
	if qrInfo.Ticket != nil && qrInfo.Ticket.HolderName != "" {
		holderName = qrInfo.Ticket.HolderName
	}

	// Build email data (no inline QR for attachment version)
	emailData := notification.TicketConfirmationEmailData{
		UserName:       req.UserName,
		HolderName:     holderName,
		FestivalName:   req.FestivalName,
		FestivalDate:   req.FestivalDate,
		FestivalVenue:  req.FestivalVenue,
		LogoURL:        req.LogoURL,
		PrimaryColor:   req.PrimaryColor,
		SecondaryColor: req.SecondaryColor,
		TicketType:     ticketTypeName,
		TicketCode:     qrInfo.Ticket.Code,
		Quantity:       1,
		Benefits:       benefits,
		AllowsReentry:  allowsReentry,
		QRCodeDataURI:  "", // Empty - will use cid:qrcode in template
		QRCodeB64:      qrInfo.QRCodeB64,
		TotalAmount:    totalAmount,
		PurchaseDate:   req.PurchaseDate,
		OrderReference: req.OrderReference,
		ValidFrom:      validFrom,
		ValidUntil:     validUntil,
		GatesOpenTime:  req.GatesOpenTime,
		ParkingInfo:    req.ParkingInfo,
		TransportInfo:  req.TransportInfo,
		TicketURL:      fmt.Sprintf("%s/tickets/%s", s.baseURL, qrInfo.Ticket.Code),
		CalendarURL:    req.CalendarURL,
		WebsiteURL:     req.WebsiteURL,
		SupportEmail:   req.SupportEmail,
	}

	// Send email with QR code as attachment
	return s.notificationService.SendTicketConfirmationEmailWithAttachment(
		ctx, req.UserID, req.ToEmail, emailData, qrResult.QRImage,
	)
}

// SendBulkTicketConfirmationEmails sends ticket confirmation emails for multiple tickets
func (s *TicketEmailService) SendBulkTicketConfirmationEmails(ctx context.Context, ticketIDs []uuid.UUID, commonData SendTicketConfirmationEmailRequest) ([]error, int) {
	var errors []error
	successCount := 0

	for _, ticketID := range ticketIDs {
		req := commonData
		req.TicketID = ticketID

		if err := s.SendTicketConfirmationEmail(ctx, req); err != nil {
			errors = append(errors, fmt.Errorf("ticket %s: %w", ticketID.String(), err))
		} else {
			successCount++
		}
	}

	return errors, successCount
}

// Helper to get current time formatted
func formatCurrentTime() string {
	return time.Now().Format("January 2, 2006")
}
