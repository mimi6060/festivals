package nfc

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// NFCTag represents an NFC tag/wristband linked to a wallet
type NFCTag struct {
	ID          uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UID         string     `json:"uid" gorm:"uniqueIndex;not null"` // Hardware UID of the NFC tag
	WalletID    *uuid.UUID `json:"walletId,omitempty" gorm:"type:uuid;index"`
	UserID      *uuid.UUID `json:"userId,omitempty" gorm:"type:uuid;index"`
	FestivalID  uuid.UUID  `json:"festivalId" gorm:"type:uuid;not null;index"`
	Status      NFCStatus  `json:"status" gorm:"default:'UNASSIGNED'"`
	ActivatedAt *time.Time `json:"activatedAt,omitempty"`
	BlockedAt   *time.Time `json:"blockedAt,omitempty"`
	BlockReason string     `json:"blockReason,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

func (NFCTag) TableName() string {
	return "nfc_tags"
}

// NFCStatus represents the status of an NFC tag
type NFCStatus string

const (
	NFCStatusUnassigned NFCStatus = "UNASSIGNED" // Tag is registered but not linked to a wallet
	NFCStatusActive     NFCStatus = "ACTIVE"     // Tag is active and linked to a wallet
	NFCStatusBlocked    NFCStatus = "BLOCKED"    // Tag is blocked (lost/stolen/suspicious)
	NFCStatusLost       NFCStatus = "LOST"       // Tag reported as lost
)

// NFCActivationRequest represents a request to activate/link an NFC tag to a wallet
type NFCActivationRequest struct {
	UID        string    `json:"uid" binding:"required"`        // NFC tag hardware UID
	WalletID   uuid.UUID `json:"walletId" binding:"required"`   // Wallet to link to
	FestivalID uuid.UUID `json:"festivalId" binding:"required"` // Festival context
}

// NFCTransferRequest represents a request to transfer an NFC tag to a new wallet
type NFCTransferRequest struct {
	NewWalletID uuid.UUID `json:"newWalletId" binding:"required"` // New wallet to link to
	Reason      string    `json:"reason,omitempty"`               // Reason for transfer
}

// NFCBlockRequest represents a request to block an NFC tag
type NFCBlockRequest struct {
	Reason string `json:"reason" binding:"required"` // Reason for blocking (lost, stolen, suspicious)
}

// NFCTransaction represents a transaction that can be processed offline with NFC
// These are synced when connectivity is restored
type NFCTransaction struct {
	ID            uuid.UUID            `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	NFCUID        string               `json:"nfcUid" gorm:"not null;index"`
	WalletID      uuid.UUID            `json:"walletId" gorm:"type:uuid;not null;index"`
	FestivalID    uuid.UUID            `json:"festivalId" gorm:"type:uuid;not null;index"`
	Amount        int64                `json:"amount" gorm:"not null"`
	StandID       *uuid.UUID           `json:"standId,omitempty" gorm:"type:uuid"`
	StaffID       *uuid.UUID           `json:"staffId,omitempty" gorm:"type:uuid"`
	DeviceID      string               `json:"deviceId" gorm:"not null"`             // POS device identifier
	OfflineToken  string               `json:"offlineToken" gorm:"not null"`         // Signed token for offline validation
	ProcessedAt   time.Time            `json:"processedAt" gorm:"not null"`          // When transaction was processed offline
	SyncedAt      *time.Time           `json:"syncedAt,omitempty"`                   // When synced to server
	Status        NFCTransactionStatus `json:"status" gorm:"default:'PENDING_SYNC'"`
	Metadata      NFCTransactionMeta   `json:"metadata" gorm:"type:jsonb;default:'{}'"`
	CreatedAt     time.Time            `json:"createdAt"`
}

func (NFCTransaction) TableName() string {
	return "nfc_transactions"
}

// NFCTransactionStatus represents the sync status of an offline NFC transaction
type NFCTransactionStatus string

const (
	NFCTransactionStatusPendingSync NFCTransactionStatus = "PENDING_SYNC" // Awaiting sync to server
	NFCTransactionStatusSynced      NFCTransactionStatus = "SYNCED"       // Successfully synced
	NFCTransactionStatusFailed      NFCTransactionStatus = "FAILED"       // Sync failed (insufficient balance, blocked, etc.)
	NFCTransactionStatusRejected    NFCTransactionStatus = "REJECTED"     // Rejected due to invalid token
)

// NFCTransactionMeta contains additional metadata for NFC transactions
type NFCTransactionMeta struct {
	ProductIDs  []string `json:"productIds,omitempty"`
	Description string   `json:"description,omitempty"`
	Location    string   `json:"location,omitempty"`
}

// Value implements the driver.Valuer interface for GORM
func (m NFCTransactionMeta) Value() (driver.Value, error) {
	return json.Marshal(m)
}

// Scan implements the sql.Scanner interface for GORM
func (m *NFCTransactionMeta) Scan(value interface{}) error {
	if value == nil {
		*m = NFCTransactionMeta{}
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("failed to scan NFCTransactionMeta: expected []byte, got %T", value)
	}
	return json.Unmarshal(bytes, m)
}

// OfflineToken represents the signed payload for offline transactions
type OfflineToken struct {
	WalletID      uuid.UUID `json:"w"`  // Wallet ID
	FestivalID    uuid.UUID `json:"f"`  // Festival ID
	NFCUID        string    `json:"n"`  // NFC tag UID
	MaxAmount     int64     `json:"m"`  // Maximum transaction amount allowed offline
	Balance       int64     `json:"b"`  // Current balance at token generation
	ValidUntil    int64     `json:"v"`  // Unix timestamp when token expires
	Signature     string    `json:"s"`  // HMAC signature
}

// NFCTagResponse represents the API response for an NFC tag
type NFCTagResponse struct {
	ID          uuid.UUID  `json:"id"`
	UID         string     `json:"uid"`
	WalletID    *uuid.UUID `json:"walletId,omitempty"`
	UserID      *uuid.UUID `json:"userId,omitempty"`
	FestivalID  uuid.UUID  `json:"festivalId"`
	Status      NFCStatus  `json:"status"`
	ActivatedAt *string    `json:"activatedAt,omitempty"`
	BlockedAt   *string    `json:"blockedAt,omitempty"`
	BlockReason string     `json:"blockReason,omitempty"`
	CreatedAt   string     `json:"createdAt"`
	UpdatedAt   string     `json:"updatedAt"`
}

func (t *NFCTag) ToResponse() NFCTagResponse {
	resp := NFCTagResponse{
		ID:          t.ID,
		UID:         t.UID,
		WalletID:    t.WalletID,
		UserID:      t.UserID,
		FestivalID:  t.FestivalID,
		Status:      t.Status,
		BlockReason: t.BlockReason,
		CreatedAt:   t.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   t.UpdatedAt.Format(time.RFC3339),
	}

	if t.ActivatedAt != nil {
		formatted := t.ActivatedAt.Format(time.RFC3339)
		resp.ActivatedAt = &formatted
	}

	if t.BlockedAt != nil {
		formatted := t.BlockedAt.Format(time.RFC3339)
		resp.BlockedAt = &formatted
	}

	return resp
}

// NFCValidationResponse represents the response when validating an NFC tag for payment
type NFCValidationResponse struct {
	Valid       bool       `json:"valid"`
	WalletID    *uuid.UUID `json:"walletId,omitempty"`
	Balance     int64      `json:"balance,omitempty"`
	Status      NFCStatus  `json:"status"`
	Message     string     `json:"message,omitempty"`
}

// OfflineTokenResponse represents the response containing an offline token
type OfflineTokenResponse struct {
	Token      string    `json:"token"`      // Base64-encoded signed token
	ValidUntil time.Time `json:"validUntil"` // When the token expires
	MaxAmount  int64     `json:"maxAmount"`  // Maximum offline transaction amount
}
