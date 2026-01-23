package helpers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/product"
	"github.com/mimi6060/festivals/backend/internal/domain/stand"
	"github.com/mimi6060/festivals/backend/internal/domain/sync"
	"github.com/mimi6060/festivals/backend/internal/domain/wallet"
	"gorm.io/gorm"
)

// ============================================================================
// Offline Mode Simulation
// ============================================================================

// OfflineDevice represents a simulated offline device
type OfflineDevice struct {
	DeviceID    string
	FestivalID  uuid.UUID
	SecretKey   []byte
	LocalQueue  []sync.OfflineTransaction
	SyncedQueue []sync.OfflineTransaction
	IsOnline    bool
}

// NewOfflineDevice creates a new simulated offline device
func NewOfflineDevice(deviceID string, festivalID uuid.UUID, secretKey string) *OfflineDevice {
	return &OfflineDevice{
		DeviceID:    deviceID,
		FestivalID:  festivalID,
		SecretKey:   []byte(secretKey),
		LocalQueue:  make([]sync.OfflineTransaction, 0),
		SyncedQueue: make([]sync.OfflineTransaction, 0),
		IsOnline:    false,
	}
}

// GoOffline simulates the device going offline
func (d *OfflineDevice) GoOffline() {
	d.IsOnline = false
}

// GoOnline simulates the device coming back online
func (d *OfflineDevice) GoOnline() {
	d.IsOnline = true
}

// AddPurchase adds a purchase transaction to the offline queue
func (d *OfflineDevice) AddPurchase(walletID uuid.UUID, amount int64, staffID uuid.UUID, standID *uuid.UUID, productIDs []string) *sync.OfflineTransaction {
	return d.addTransaction(sync.TransactionTypePurchase, walletID, amount, staffID, standID, productIDs)
}

// AddTopUp adds a top-up transaction to the offline queue
func (d *OfflineDevice) AddTopUp(walletID uuid.UUID, amount int64, staffID uuid.UUID) *sync.OfflineTransaction {
	return d.addTransaction(sync.TransactionTypeTopUp, walletID, amount, staffID, nil, nil)
}

// AddCashIn adds a cash-in transaction to the offline queue
func (d *OfflineDevice) AddCashIn(walletID uuid.UUID, amount int64, staffID uuid.UUID) *sync.OfflineTransaction {
	return d.addTransaction(sync.TransactionTypeCashIn, walletID, amount, staffID, nil, nil)
}

// AddRefund adds a refund transaction to the offline queue
func (d *OfflineDevice) AddRefund(walletID uuid.UUID, amount int64, staffID uuid.UUID, standID *uuid.UUID) *sync.OfflineTransaction {
	return d.addTransaction(sync.TransactionTypeRefund, walletID, amount, staffID, standID, nil)
}

// addTransaction adds a transaction to the local queue with proper signature
func (d *OfflineDevice) addTransaction(txType sync.TransactionType, walletID uuid.UUID, amount int64, staffID uuid.UUID, standID *uuid.UUID, productIDs []string) *sync.OfflineTransaction {
	localID := uuid.New().String()
	timestamp := time.Now()

	signature := d.generateSignature(localID, walletID, amount, txType, timestamp)

	tx := sync.OfflineTransaction{
		LocalID:    localID,
		Type:       txType,
		Amount:     amount,
		WalletID:   walletID,
		StandID:    standID,
		StaffID:    staffID,
		ProductIDs: productIDs,
		Signature:  signature,
		Timestamp:  timestamp,
	}

	d.LocalQueue = append(d.LocalQueue, tx)
	return &tx
}

// generateSignature generates a valid HMAC signature for a transaction
func (d *OfflineDevice) generateSignature(localID string, walletID uuid.UUID, amount int64, txType sync.TransactionType, timestamp time.Time) string {
	data := fmt.Sprintf("%s:%s:%d:%s:%d",
		localID,
		walletID.String(),
		amount,
		txType,
		timestamp.Unix(),
	)

	h := hmac.New(sha256.New, d.SecretKey)
	h.Write([]byte(data))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

// GetPendingTransactions returns transactions that haven't been synced yet
func (d *OfflineDevice) GetPendingTransactions() []sync.OfflineTransaction {
	return d.LocalQueue
}

// GetSyncBatchRequest creates a sync batch request from pending transactions
func (d *OfflineDevice) GetSyncBatchRequest() *sync.SubmitBatchRequest {
	if len(d.LocalQueue) == 0 {
		return nil
	}

	return &sync.SubmitBatchRequest{
		DeviceID:     d.DeviceID,
		FestivalID:   d.FestivalID,
		Transactions: d.LocalQueue,
	}
}

// MarkSynced moves transactions from local queue to synced queue
func (d *OfflineDevice) MarkSynced(localIDs []string) {
	synced := make(map[string]bool)
	for _, id := range localIDs {
		synced[id] = true
	}

	newQueue := make([]sync.OfflineTransaction, 0)
	for _, tx := range d.LocalQueue {
		if synced[tx.LocalID] {
			d.SyncedQueue = append(d.SyncedQueue, tx)
		} else {
			newQueue = append(newQueue, tx)
		}
	}
	d.LocalQueue = newQueue
}

// ClearQueue clears all pending transactions
func (d *OfflineDevice) ClearQueue() {
	d.LocalQueue = make([]sync.OfflineTransaction, 0)
}

// ============================================================================
// Pending Transaction Helpers
// ============================================================================

// PendingTransactionOptions options for creating pending transactions
type PendingTransactionOptions struct {
	Type       *sync.TransactionType
	Amount     *int64
	StandID    *uuid.UUID
	ProductIDs []string
	Timestamp  *time.Time
	// For testing invalid scenarios
	InvalidSignature bool
	TamperedAmount   *int64
}

// CreatePendingTransaction creates a pending offline transaction for testing
func CreatePendingTransaction(t *testing.T, device *OfflineDevice, walletID, staffID uuid.UUID, opts *PendingTransactionOptions) *sync.OfflineTransaction {
	t.Helper()

	txType := sync.TransactionTypePurchase
	amount := int64(500)
	timestamp := time.Now().Add(-5 * time.Minute)

	if opts != nil {
		if opts.Type != nil {
			txType = *opts.Type
		}
		if opts.Amount != nil {
			amount = *opts.Amount
		}
		if opts.Timestamp != nil {
			timestamp = *opts.Timestamp
		}
	}

	localID := uuid.New().String()
	signatureAmount := amount
	if opts != nil && opts.TamperedAmount != nil {
		signatureAmount = *opts.TamperedAmount
	}

	signature := device.generateSignature(localID, walletID, signatureAmount, txType, timestamp)
	if opts != nil && opts.InvalidSignature {
		signature = "invalid-signature"
	}

	tx := sync.OfflineTransaction{
		LocalID:   localID,
		Type:      txType,
		Amount:    amount,
		WalletID:  walletID,
		StaffID:   staffID,
		Signature: signature,
		Timestamp: timestamp,
	}

	if opts != nil {
		if opts.StandID != nil {
			tx.StandID = opts.StandID
		}
		if opts.ProductIDs != nil {
			tx.ProductIDs = opts.ProductIDs
		}
	}

	device.LocalQueue = append(device.LocalQueue, tx)
	return &tx
}

// CreateMultiplePendingTransactions creates multiple pending transactions
func CreateMultiplePendingTransactions(t *testing.T, device *OfflineDevice, walletID, staffID uuid.UUID, count int, amountPerTx int64) []sync.OfflineTransaction {
	t.Helper()

	transactions := make([]sync.OfflineTransaction, count)
	baseTime := time.Now().Add(-time.Duration(count) * time.Minute)

	for i := 0; i < count; i++ {
		txType := sync.TransactionTypePurchase
		timestamp := baseTime.Add(time.Duration(i) * time.Minute)
		amount := amountPerTx

		localID := uuid.New().String()
		signature := device.generateSignature(localID, walletID, amount, txType, timestamp)

		tx := sync.OfflineTransaction{
			LocalID:   localID,
			Type:      txType,
			Amount:    amount,
			WalletID:  walletID,
			StaffID:   staffID,
			Signature: signature,
			Timestamp: timestamp,
		}

		device.LocalQueue = append(device.LocalQueue, tx)
		transactions[i] = tx
	}

	return transactions
}

// ============================================================================
// Sync Trigger Helpers
// ============================================================================

// SyncTrigger provides utilities for triggering and managing sync operations
type SyncTrigger struct {
	SyncService *sync.Service
	DB          *gorm.DB
}

// NewSyncTrigger creates a new sync trigger
func NewSyncTrigger(syncService *sync.Service, db *gorm.DB) *SyncTrigger {
	return &SyncTrigger{
		SyncService: syncService,
		DB:          db,
	}
}

// TriggerSync initiates a sync for the given device
func (st *SyncTrigger) TriggerSync(ctx context.Context, device *OfflineDevice) (*sync.SyncResult, error) {
	req := device.GetSyncBatchRequest()
	if req == nil {
		return nil, nil // Nothing to sync
	}

	result, err := st.SyncService.ProcessSyncBatch(ctx, *req)
	if err != nil {
		return nil, err
	}

	// Mark successful transactions as synced
	var syncedIDs []string
	for _, success := range result.Successes {
		syncedIDs = append(syncedIDs, success.LocalID)
	}
	device.MarkSynced(syncedIDs)

	return result, nil
}

// TriggerSyncWithRetry attempts sync with retries for failed transactions
func (st *SyncTrigger) TriggerSyncWithRetry(ctx context.Context, device *OfflineDevice, maxRetries int) (*sync.SyncResult, error) {
	var lastResult *sync.SyncResult
	var err error

	for i := 0; i < maxRetries; i++ {
		lastResult, err = st.TriggerSync(ctx, device)
		if err != nil {
			return nil, err
		}
		if lastResult == nil || len(device.LocalQueue) == 0 {
			break
		}
		if lastResult.FailedCount == 0 {
			break
		}
		// Small delay between retries
		time.Sleep(100 * time.Millisecond)
	}

	return lastResult, nil
}

// GetBatchStatus retrieves the status of a specific batch
func (st *SyncTrigger) GetBatchStatus(ctx context.Context, batchID uuid.UUID) (*sync.SyncBatch, error) {
	return st.SyncService.GetBatch(ctx, batchID)
}

// GetPendingBatchesForDevice retrieves all pending batches for a device
func (st *SyncTrigger) GetPendingBatchesForDevice(ctx context.Context, deviceID string) ([]sync.SyncBatch, error) {
	return st.SyncService.GetPendingBatches(ctx, deviceID)
}

// ============================================================================
// Mock Network Conditions
// ============================================================================

// NetworkCondition represents simulated network conditions
type NetworkCondition int

const (
	NetworkNormal NetworkCondition = iota
	NetworkSlow
	NetworkUnstable
	NetworkOffline
)

// MockNetwork simulates network conditions for testing
type MockNetwork struct {
	Condition      NetworkCondition
	LatencyMs      int
	FailureRate    float64 // 0.0 - 1.0
	failureCounter int
}

// NewMockNetwork creates a new mock network
func NewMockNetwork(condition NetworkCondition) *MockNetwork {
	mn := &MockNetwork{
		Condition: condition,
	}
	mn.applyCondition()
	return mn
}

// applyCondition sets parameters based on network condition
func (mn *MockNetwork) applyCondition() {
	switch mn.Condition {
	case NetworkNormal:
		mn.LatencyMs = 0
		mn.FailureRate = 0.0
	case NetworkSlow:
		mn.LatencyMs = 500
		mn.FailureRate = 0.0
	case NetworkUnstable:
		mn.LatencyMs = 200
		mn.FailureRate = 0.3
	case NetworkOffline:
		mn.LatencyMs = 0
		mn.FailureRate = 1.0
	}
}

// SetCondition changes the network condition
func (mn *MockNetwork) SetCondition(condition NetworkCondition) {
	mn.Condition = condition
	mn.applyCondition()
}

// SimulateLatency adds simulated network latency
func (mn *MockNetwork) SimulateLatency() {
	if mn.LatencyMs > 0 {
		time.Sleep(time.Duration(mn.LatencyMs) * time.Millisecond)
	}
}

// ShouldFail determines if the current request should fail
func (mn *MockNetwork) ShouldFail() bool {
	if mn.FailureRate == 0.0 {
		return false
	}
	if mn.FailureRate >= 1.0 {
		return true
	}
	// Simple pseudo-random based on counter
	mn.failureCounter++
	return float64(mn.failureCounter%10)/10.0 < mn.FailureRate
}

// IsOnline returns whether the network is considered online
func (mn *MockNetwork) IsOnline() bool {
	return mn.Condition != NetworkOffline
}

// ============================================================================
// Sync Test Fixtures
// ============================================================================

// SyncTestFixtures contains all necessary fixtures for sync testing
type SyncTestFixtures struct {
	User      *TestSetup
	Festival  *TestSetup
	Wallet    *wallet.Wallet
	Stand     *stand.Stand
	Products  []*product.Product
	Staff     *TestSetup
	Device    *OfflineDevice
	SecretKey string
}

// CreateSyncTestFixtures creates a complete test environment for sync testing
func CreateSyncTestFixtures(t *testing.T, db *gorm.DB, secretKey string) *SyncTestFixtures {
	t.Helper()

	// Create user
	testUser := CreateTestUser(t, db, nil)

	// Create admin
	admin := CreateTestAdmin(t, db)

	// Create staff
	staff := CreateTestStaff(t, db)

	// Create festival
	festival := CreateActiveFestival(t, db, &admin.ID)

	// Create wallet with initial balance
	testWallet := CreateTestWalletWithBalance(t, db, testUser.ID, festival.ID, 10000)

	// Create stand
	testStand := CreateTestStand(t, db, festival.ID, nil)

	// Create products
	products := make([]*product.Product, 3)
	for i := 0; i < 3; i++ {
		products[i] = CreateTestProduct(t, db, testStand.ID, &ProductOptions{
			Name:  StringPtr(fmt.Sprintf("Product %d", i+1)),
			Price: Int64Ptr(int64(300 + i*100)),
		})
	}

	// Create offline device
	device := NewOfflineDevice(
		"test-device-"+uuid.New().String()[:8],
		festival.ID,
		secretKey,
	)

	return &SyncTestFixtures{
		User:      &TestSetup{User: testUser},
		Festival:  &TestSetup{Admin: admin, Festival: festival},
		Wallet:    testWallet,
		Stand:     testStand,
		Products:  products,
		Staff:     &TestSetup{Staff: staff},
		Device:    device,
		SecretKey: secretKey,
	}
}

// ============================================================================
// Sync Assertion Helpers
// ============================================================================

// AssertSyncSuccess asserts that a sync result is successful
func AssertSyncSuccess(t *testing.T, result *sync.SyncResult, expectedCount int) {
	t.Helper()
	if result == nil {
		t.Fatal("Expected sync result, got nil")
	}
	if result.Status != sync.SyncStatusCompleted {
		t.Errorf("Expected status COMPLETED, got %s", result.Status)
	}
	if result.SuccessCount != expectedCount {
		t.Errorf("Expected %d successes, got %d", expectedCount, result.SuccessCount)
	}
	if result.FailedCount != 0 {
		t.Errorf("Expected 0 failures, got %d", result.FailedCount)
	}
}

// AssertSyncPartial asserts that a sync result is partially successful
func AssertSyncPartial(t *testing.T, result *sync.SyncResult, expectedSuccess, expectedFailed int) {
	t.Helper()
	if result == nil {
		t.Fatal("Expected sync result, got nil")
	}
	if result.Status != sync.SyncStatusPartial {
		t.Errorf("Expected status PARTIAL, got %s", result.Status)
	}
	if result.SuccessCount != expectedSuccess {
		t.Errorf("Expected %d successes, got %d", expectedSuccess, result.SuccessCount)
	}
	if result.FailedCount != expectedFailed {
		t.Errorf("Expected %d failures, got %d", expectedFailed, result.FailedCount)
	}
}

// AssertSyncFailed asserts that a sync result failed completely
func AssertSyncFailed(t *testing.T, result *sync.SyncResult, expectedFailed int) {
	t.Helper()
	if result == nil {
		t.Fatal("Expected sync result, got nil")
	}
	if result.Status != sync.SyncStatusFailed {
		t.Errorf("Expected status FAILED, got %s", result.Status)
	}
	if result.FailedCount != expectedFailed {
		t.Errorf("Expected %d failures, got %d", expectedFailed, result.FailedCount)
	}
	if result.SuccessCount != 0 {
		t.Errorf("Expected 0 successes, got %d", result.SuccessCount)
	}
}

// AssertWalletBalance asserts the wallet has the expected balance
func AssertWalletBalance(t *testing.T, db *gorm.DB, walletID uuid.UUID, expectedBalance int64) {
	t.Helper()
	var w wallet.Wallet
	if err := db.Where("id = ?", walletID).First(&w).Error; err != nil {
		t.Fatalf("Failed to get wallet: %v", err)
	}
	if w.Balance != expectedBalance {
		t.Errorf("Expected wallet balance %d, got %d", expectedBalance, w.Balance)
	}
}

// AssertTransactionCount asserts the number of transactions for a wallet
func AssertTransactionCount(t *testing.T, db *gorm.DB, walletID uuid.UUID, expectedCount int64) {
	t.Helper()
	var count int64
	if err := db.Model(&wallet.Transaction{}).Where("wallet_id = ?", walletID).Count(&count).Error; err != nil {
		t.Fatalf("Failed to count transactions: %v", err)
	}
	if count != expectedCount {
		t.Errorf("Expected %d transactions, got %d", expectedCount, count)
	}
}

// ============================================================================
// Sync Batch Helpers
// ============================================================================

// CreateSyncBatch creates a sync batch directly in the database for testing
func CreateSyncBatch(t *testing.T, db *gorm.DB, deviceID string, festivalID uuid.UUID, transactions []sync.OfflineTransaction, status sync.SyncStatus) *sync.SyncBatch {
	t.Helper()

	batch := &sync.SyncBatch{
		ID:           uuid.New(),
		DeviceID:     deviceID,
		FestivalID:   festivalID,
		Transactions: transactions,
		Status:       status,
		CreatedAt:    time.Now(),
	}

	if err := db.Create(batch).Error; err != nil {
		t.Fatalf("Failed to create sync batch: %v", err)
	}

	return batch
}

// CreateProcessedSyncBatch creates a processed sync batch for testing
func CreateProcessedSyncBatch(t *testing.T, db *gorm.DB, deviceID string, festivalID uuid.UUID, transactions []sync.OfflineTransaction, result *sync.SyncResultData) *sync.SyncBatch {
	t.Helper()

	now := time.Now()
	batch := &sync.SyncBatch{
		ID:           uuid.New(),
		DeviceID:     deviceID,
		FestivalID:   festivalID,
		Transactions: transactions,
		Status:       sync.SyncStatusCompleted,
		CreatedAt:    now.Add(-5 * time.Minute),
		ProcessedAt:  &now,
		Result:       result,
	}

	if err := db.Create(batch).Error; err != nil {
		t.Fatalf("Failed to create processed sync batch: %v", err)
	}

	return batch
}

// ============================================================================
// Time Helpers for Sync Tests
// ============================================================================

// TimeInPast returns a time in the past
func TimeInPast(minutes int) time.Time {
	return time.Now().Add(-time.Duration(minutes) * time.Minute)
}

// TimeInFuture returns a time in the future
func TimeInFuture(minutes int) time.Time {
	return time.Now().Add(time.Duration(minutes) * time.Minute)
}

// OldTimestamp returns a timestamp older than the default max batch age
func OldTimestamp() time.Time {
	return time.Now().Add(-25 * time.Hour)
}

// RecentTimestamp returns a recent valid timestamp
func RecentTimestamp() time.Time {
	return time.Now().Add(-5 * time.Minute)
}

// ============================================================================
// Transaction Type Helpers
// ============================================================================

// PurchaseType returns a pointer to TransactionTypePurchase
func PurchaseType() *sync.TransactionType {
	t := sync.TransactionTypePurchase
	return &t
}

// TopUpType returns a pointer to TransactionTypeTopUp
func TopUpType() *sync.TransactionType {
	t := sync.TransactionTypeTopUp
	return &t
}

// RefundType returns a pointer to TransactionTypeRefund
func RefundType() *sync.TransactionType {
	t := sync.TransactionTypeRefund
	return &t
}

// CashInType returns a pointer to TransactionTypeCashIn
func CashInType() *sync.TransactionType {
	t := sync.TransactionTypeCashIn
	return &t
}
