package ticket

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// TicketType represents a type of ticket for a festival (e.g., VIP, Regular, Day Pass)
type TicketType struct {
	ID            uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID    uuid.UUID       `json:"festivalId" gorm:"type:uuid;not null;index"`
	Name          string          `json:"name" gorm:"not null"`
	Description   string          `json:"description"`
	Price         int64           `json:"price" gorm:"not null"` // Price in cents
	Quantity      *int            `json:"quantity,omitempty"`    // nil = unlimited
	QuantitySold  int             `json:"quantitySold" gorm:"default:0"`
	ValidFrom     time.Time       `json:"validFrom"`
	ValidUntil    time.Time       `json:"validUntil"`
	Benefits      []string        `json:"benefits" gorm:"type:text[];serializer:json"`
	Settings      TicketSettings  `json:"settings" gorm:"type:jsonb;default:'{}'"`
	Status        TicketTypeStatus `json:"status" gorm:"default:'ACTIVE'"`
	CreatedAt     time.Time       `json:"createdAt"`
	UpdatedAt     time.Time       `json:"updatedAt"`
}

func (TicketType) TableName() string {
	return "ticket_types"
}

type TicketTypeStatus string

const (
	TicketTypeStatusActive   TicketTypeStatus = "ACTIVE"
	TicketTypeStatusInactive TicketTypeStatus = "INACTIVE"
	TicketTypeStatusSoldOut  TicketTypeStatus = "SOLD_OUT"
)

type TicketSettings struct {
	AllowReentry      bool   `json:"allowReentry"`      // Can re-enter festival
	IncludesTopUp     bool   `json:"includesTopUp"`     // Includes initial wallet balance
	TopUpAmount       int64  `json:"topUpAmount"`       // Amount in cents if included
	RequiresID        bool   `json:"requiresId"`        // Requires identity verification
	TransferAllowed   bool   `json:"transferAllowed"`   // Can be transferred to another person
	MaxTransfers      int    `json:"maxTransfers"`      // Maximum number of transfers
	Color             string `json:"color,omitempty"`   // UI color for the ticket
	AccessZones       []string `json:"accessZones,omitempty"` // Zones this ticket can access
}

// Ticket represents an individual ticket purchased by a user
type Ticket struct {
	ID            uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	TicketTypeID  uuid.UUID    `json:"ticketTypeId" gorm:"type:uuid;not null;index"`
	FestivalID    uuid.UUID    `json:"festivalId" gorm:"type:uuid;not null;index"`
	UserID        *uuid.UUID   `json:"userId,omitempty" gorm:"type:uuid;index"`
	OrderID       *uuid.UUID   `json:"orderId,omitempty" gorm:"type:uuid;index"`
	Code          string       `json:"code" gorm:"unique;not null;index"` // Unique ticket code for QR
	HolderName    string       `json:"holderName,omitempty"`
	HolderEmail   string       `json:"holderEmail,omitempty"`
	Status        TicketStatus `json:"status" gorm:"default:'VALID'"`
	CheckedInAt   *time.Time   `json:"checkedInAt,omitempty"`
	CheckedInBy   *uuid.UUID   `json:"checkedInBy,omitempty" gorm:"type:uuid"`
	TransferCount int          `json:"transferCount" gorm:"default:0"`
	Metadata      TicketMeta   `json:"metadata" gorm:"type:jsonb;default:'{}'"`
	CreatedAt     time.Time    `json:"createdAt"`
	UpdatedAt     time.Time    `json:"updatedAt"`
}

func (Ticket) TableName() string {
	return "tickets"
}

type TicketStatus string

const (
	TicketStatusValid       TicketStatus = "VALID"
	TicketStatusUsed        TicketStatus = "USED"
	TicketStatusExpired     TicketStatus = "EXPIRED"
	TicketStatusCancelled   TicketStatus = "CANCELLED"
	TicketStatusTransferred TicketStatus = "TRANSFERRED"
)

type TicketMeta struct {
	OriginalOwnerID *uuid.UUID `json:"originalOwnerId,omitempty"`
	PurchaseDate    string     `json:"purchaseDate,omitempty"`
	PaymentRef      string     `json:"paymentRef,omitempty"`
	Notes           string     `json:"notes,omitempty"`
}

// TicketScan represents a ticket scan event (entry/exit)
type TicketScan struct {
	ID         uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	TicketID   uuid.UUID    `json:"ticketId" gorm:"type:uuid;not null;index"`
	FestivalID uuid.UUID    `json:"festivalId" gorm:"type:uuid;not null;index"`
	ScanType   ScanType     `json:"scanType" gorm:"not null"`
	ScannedBy  uuid.UUID    `json:"scannedBy" gorm:"type:uuid;not null"`
	Location   string       `json:"location,omitempty"`
	DeviceID   string       `json:"deviceId,omitempty"`
	Result     ScanResult   `json:"result" gorm:"not null"`
	Message    string       `json:"message,omitempty"`
	ScannedAt  time.Time    `json:"scannedAt"`
}

func (TicketScan) TableName() string {
	return "ticket_scans"
}

type ScanType string

const (
	ScanTypeEntry ScanType = "ENTRY"
	ScanTypeExit  ScanType = "EXIT"
	ScanTypeCheck ScanType = "CHECK" // Just verifying, no entry/exit
)

type ScanResult string

const (
	ScanResultSuccess ScanResult = "SUCCESS"
	ScanResultFailed  ScanResult = "FAILED"
	ScanResultAlready ScanResult = "ALREADY_USED"
	ScanResultExpired ScanResult = "EXPIRED"
	ScanResultInvalid ScanResult = "INVALID"
)

// Request/Response types

type CreateTicketTypeRequest struct {
	Name        string         `json:"name" binding:"required"`
	Description string         `json:"description"`
	Price       int64          `json:"price" binding:"required,min=0"`
	Quantity    *int           `json:"quantity"`
	ValidFrom   time.Time      `json:"validFrom" binding:"required"`
	ValidUntil  time.Time      `json:"validUntil" binding:"required"`
	Benefits    []string       `json:"benefits"`
	Settings    *TicketSettings `json:"settings"`
}

type UpdateTicketTypeRequest struct {
	Name        *string          `json:"name,omitempty"`
	Description *string          `json:"description,omitempty"`
	Price       *int64           `json:"price,omitempty"`
	Quantity    *int             `json:"quantity,omitempty"`
	ValidFrom   *time.Time       `json:"validFrom,omitempty"`
	ValidUntil  *time.Time       `json:"validUntil,omitempty"`
	Benefits    []string         `json:"benefits,omitempty"`
	Settings    *TicketSettings  `json:"settings,omitempty"`
	Status      *TicketTypeStatus `json:"status,omitempty"`
}

type CreateTicketRequest struct {
	TicketTypeID uuid.UUID  `json:"ticketTypeId" binding:"required"`
	UserID       *uuid.UUID `json:"userId"`
	HolderName   string     `json:"holderName"`
	HolderEmail  string     `json:"holderEmail"`
}

type ScanTicketRequest struct {
	Code     string   `json:"code" binding:"required"`
	ScanType ScanType `json:"scanType" binding:"required"`
	Location string   `json:"location"`
	DeviceID string   `json:"deviceId"`
}

type TransferTicketRequest struct {
	TicketID    uuid.UUID `json:"ticketId" binding:"required"`
	NewHolderEmail string `json:"newHolderEmail" binding:"required,email"`
	NewHolderName  string `json:"newHolderName" binding:"required"`
}

// Response types

type TicketTypeResponse struct {
	ID           uuid.UUID        `json:"id"`
	FestivalID   uuid.UUID        `json:"festivalId"`
	Name         string           `json:"name"`
	Description  string           `json:"description"`
	Price        int64            `json:"price"`
	PriceDisplay string           `json:"priceDisplay"`
	Quantity     *int             `json:"quantity,omitempty"`
	QuantitySold int              `json:"quantitySold"`
	Available    int              `json:"available"`
	ValidFrom    string           `json:"validFrom"`
	ValidUntil   string           `json:"validUntil"`
	Benefits     []string         `json:"benefits"`
	Settings     TicketSettings   `json:"settings"`
	Status       TicketTypeStatus `json:"status"`
	CreatedAt    string           `json:"createdAt"`
}

func (tt *TicketType) ToResponse() TicketTypeResponse {
	available := -1 // unlimited
	if tt.Quantity != nil {
		available = *tt.Quantity - tt.QuantitySold
	}

	return TicketTypeResponse{
		ID:           tt.ID,
		FestivalID:   tt.FestivalID,
		Name:         tt.Name,
		Description:  tt.Description,
		Price:        tt.Price,
		PriceDisplay: formatPrice(tt.Price),
		Quantity:     tt.Quantity,
		QuantitySold: tt.QuantitySold,
		Available:    available,
		ValidFrom:    tt.ValidFrom.Format(time.RFC3339),
		ValidUntil:   tt.ValidUntil.Format(time.RFC3339),
		Benefits:     tt.Benefits,
		Settings:     tt.Settings,
		Status:       tt.Status,
		CreatedAt:    tt.CreatedAt.Format(time.RFC3339),
	}
}

type TicketResponse struct {
	ID           uuid.UUID    `json:"id"`
	TicketTypeID uuid.UUID    `json:"ticketTypeId"`
	FestivalID   uuid.UUID    `json:"festivalId"`
	UserID       *uuid.UUID   `json:"userId,omitempty"`
	Code         string       `json:"code"`
	HolderName   string       `json:"holderName,omitempty"`
	HolderEmail  string       `json:"holderEmail,omitempty"`
	Status       TicketStatus `json:"status"`
	CheckedInAt  *string      `json:"checkedInAt,omitempty"`
	CreatedAt    string       `json:"createdAt"`
}

func (t *Ticket) ToResponse() TicketResponse {
	var checkedInAt *string
	if t.CheckedInAt != nil {
		formatted := t.CheckedInAt.Format(time.RFC3339)
		checkedInAt = &formatted
	}

	return TicketResponse{
		ID:           t.ID,
		TicketTypeID: t.TicketTypeID,
		FestivalID:   t.FestivalID,
		UserID:       t.UserID,
		Code:         t.Code,
		HolderName:   t.HolderName,
		HolderEmail:  t.HolderEmail,
		Status:       t.Status,
		CheckedInAt:  checkedInAt,
		CreatedAt:    t.CreatedAt.Format(time.RFC3339),
	}
}

type ScanResponse struct {
	Success   bool         `json:"success"`
	Ticket    *TicketResponse `json:"ticket,omitempty"`
	Result    ScanResult   `json:"result"`
	Message   string       `json:"message"`
	ScannedAt string       `json:"scannedAt"`
}

func formatPrice(cents int64) string {
	euros := float64(cents) / 100
	return fmt.Sprintf("%.2f €", euros)
}
