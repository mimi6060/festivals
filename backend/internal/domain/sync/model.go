package sync

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// SyncBatch represents a batch of offline transactions submitted by a device
type SyncBatch struct {
	ID           uuid.UUID            `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	DeviceID     string               `json:"deviceId" gorm:"not null;index"`
	FestivalID   uuid.UUID            `json:"festivalId" gorm:"type:uuid;not null;index"`
	Transactions OfflineTransactions  `json:"transactions" gorm:"type:jsonb;not null"`
	Status       SyncStatus           `json:"status" gorm:"default:'PENDING'"`
	CreatedAt    time.Time            `json:"createdAt"`
	ProcessedAt  *time.Time           `json:"processedAt,omitempty"`
	Result       *SyncResultData      `json:"result,omitempty" gorm:"type:jsonb"`
}

func (SyncBatch) TableName() string {
	return "sync_batches"
}

// OfflineTransaction represents a single transaction made offline
type OfflineTransaction struct {
	LocalID     string          `json:"localId"`                // Client-generated unique ID
	Type        TransactionType `json:"type"`                   // PURCHASE, REFUND, TOP_UP
	Amount      int64           `json:"amount"`                 // Amount in cents
	WalletID    uuid.UUID       `json:"walletId"`               // Target wallet
	StandID     *uuid.UUID      `json:"standId,omitempty"`      // Stand where transaction occurred
	StaffID     uuid.UUID       `json:"staffId"`                // Staff who made the transaction
	ProductIDs  []string        `json:"productIds,omitempty"`   // Products involved
	Signature   string          `json:"signature"`              // Cryptographic signature for validation
	Timestamp   time.Time       `json:"timestamp"`              // When transaction was made offline
	Processed   bool            `json:"processed"`              // Whether this has been processed
	ServerTxID  *uuid.UUID      `json:"serverTxId,omitempty"`   // Server-side transaction ID after processing
	Error       string          `json:"error,omitempty"`        // Error message if processing failed
}

// OfflineTransactions is a slice of OfflineTransaction that implements SQL Scanner/Valuer
type OfflineTransactions []OfflineTransaction

func (t OfflineTransactions) Value() (driver.Value, error) {
	return json.Marshal(t)
}

func (t *OfflineTransactions) Scan(value interface{}) error {
	if value == nil {
		*t = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("failed to scan OfflineTransactions: expected []byte, got %T", value)
	}
	return json.Unmarshal(bytes, t)
}

// TransactionType represents the type of offline transaction
type TransactionType string

const (
	TransactionTypePurchase TransactionType = "PURCHASE"
	TransactionTypeRefund   TransactionType = "REFUND"
	TransactionTypeTopUp    TransactionType = "TOP_UP"
	TransactionTypeCashIn   TransactionType = "CASH_IN"
)

// SyncStatus represents the status of a sync batch
type SyncStatus string

const (
	SyncStatusPending    SyncStatus = "PENDING"
	SyncStatusProcessing SyncStatus = "PROCESSING"
	SyncStatusCompleted  SyncStatus = "COMPLETED"
	SyncStatusFailed     SyncStatus = "FAILED"
	SyncStatusPartial    SyncStatus = "PARTIAL" // Some transactions succeeded, some failed
)

// SyncResult represents the result of processing a sync batch
type SyncResult struct {
	BatchID      uuid.UUID          `json:"batchId"`
	Status       SyncStatus         `json:"status"`
	TotalCount   int                `json:"totalCount"`
	SuccessCount int                `json:"successCount"`
	FailedCount  int                `json:"failedCount"`
	Conflicts    []SyncConflict     `json:"conflicts,omitempty"`
	Successes    []SyncSuccess      `json:"successes,omitempty"`
	ProcessedAt  time.Time          `json:"processedAt"`
}

// SyncResultData is the database-storable version of SyncResult
type SyncResultData struct {
	TotalCount   int            `json:"totalCount"`
	SuccessCount int            `json:"successCount"`
	FailedCount  int            `json:"failedCount"`
	Conflicts    []SyncConflict `json:"conflicts,omitempty"`
	Successes    []SyncSuccess  `json:"successes,omitempty"`
}

func (r SyncResultData) Value() (driver.Value, error) {
	return json.Marshal(r)
}

func (r *SyncResultData) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("failed to scan SyncResultData: expected []byte, got %T", value)
	}
	return json.Unmarshal(bytes, r)
}

// SyncConflict represents a conflict that occurred during sync
type SyncConflict struct {
	LocalID    string `json:"localId"`
	Reason     string `json:"reason"`
	Resolution string `json:"resolution,omitempty"` // How the conflict was resolved
}

// SyncSuccess represents a successfully processed transaction
type SyncSuccess struct {
	LocalID    string    `json:"localId"`
	ServerTxID uuid.UUID `json:"serverTxId"`
}

// SubmitBatchRequest represents a request to submit a batch of offline transactions
type SubmitBatchRequest struct {
	DeviceID     string               `json:"deviceId" binding:"required"`
	FestivalID   uuid.UUID            `json:"festivalId" binding:"required"`
	Transactions []OfflineTransaction `json:"transactions" binding:"required,min=1"`
}

// BatchStatusResponse represents the API response for batch status
type BatchStatusResponse struct {
	ID           uuid.UUID           `json:"id"`
	DeviceID     string              `json:"deviceId"`
	FestivalID   uuid.UUID           `json:"festivalId"`
	Status       SyncStatus          `json:"status"`
	TotalCount   int                 `json:"totalCount"`
	SuccessCount int                 `json:"successCount,omitempty"`
	FailedCount  int                 `json:"failedCount,omitempty"`
	Conflicts    []SyncConflict      `json:"conflicts,omitempty"`
	CreatedAt    string              `json:"createdAt"`
	ProcessedAt  string              `json:"processedAt,omitempty"`
}

func (b *SyncBatch) ToResponse() BatchStatusResponse {
	resp := BatchStatusResponse{
		ID:         b.ID,
		DeviceID:   b.DeviceID,
		FestivalID: b.FestivalID,
		Status:     b.Status,
		TotalCount: len(b.Transactions),
		CreatedAt:  b.CreatedAt.Format(time.RFC3339),
	}

	if b.ProcessedAt != nil {
		resp.ProcessedAt = b.ProcessedAt.Format(time.RFC3339)
	}

	if b.Result != nil {
		resp.SuccessCount = b.Result.SuccessCount
		resp.FailedCount = b.Result.FailedCount
		resp.Conflicts = b.Result.Conflicts
	}

	return resp
}

// PendingBatchResponse represents a pending batch for a device
type PendingBatchResponse struct {
	ID         uuid.UUID  `json:"id"`
	Status     SyncStatus `json:"status"`
	TotalCount int        `json:"totalCount"`
	CreatedAt  string     `json:"createdAt"`
}
