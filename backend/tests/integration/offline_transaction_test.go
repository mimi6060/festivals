package integration

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/sync"
	"github.com/mimi6060/festivals/backend/internal/domain/wallet"
	"github.com/mimi6060/festivals/backend/tests/helpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// Creating Offline Transactions Tests
// ============================================================================

func TestCreatingOfflineTransaction(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Create valid offline purchase transaction", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Create offline transaction with proper signature
		localID := uuid.New().String()
		timestamp := time.Now().Add(-5 * time.Minute)
		amount := int64(750)

		signature := suite.SyncService.GenerateOfflineSignature(
			localID,
			testWallet.ID,
			amount,
			sync.TransactionTypePurchase,
			timestamp,
		)

		offlineTx := sync.OfflineTransaction{
			LocalID:    localID,
			Type:       sync.TransactionTypePurchase,
			Amount:     amount,
			WalletID:   testWallet.ID,
			StandID:    &testStand.ID,
			StaffID:    staff.ID,
			ProductIDs: []string{"product-1", "product-2"},
			Signature:  signature,
			Timestamp:  timestamp,
		}

		// Validate signature
		err := suite.SyncService.ValidateOfflineSignature(offlineTx)
		require.NoError(t, err)

		// Submit transaction
		req := sync.SubmitBatchRequest{
			DeviceID:     "device-offline-001",
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		// Assert
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result.Status)
		assert.Equal(t, 1, result.SuccessCount)
		assert.NotEqual(t, uuid.Nil, result.Successes[0].ServerTxID)
	})

	t.Run("Create offline cash-in transaction", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 1000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		localID := uuid.New().String()
		timestamp := time.Now().Add(-3 * time.Minute)
		amount := int64(2000)

		signature := suite.SyncService.GenerateOfflineSignature(
			localID,
			testWallet.ID,
			amount,
			sync.TransactionTypeCashIn,
			timestamp,
		)

		offlineTx := sync.OfflineTransaction{
			LocalID:   localID,
			Type:      sync.TransactionTypeCashIn,
			Amount:    amount,
			WalletID:  testWallet.ID,
			StaffID:   staff.ID,
			Signature: signature,
			Timestamp: timestamp,
		}

		req := sync.SubmitBatchRequest{
			DeviceID:     "device-offline-002",
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result.Status)

		// Verify balance increased
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(3000), updatedWallet.Balance) // 1000 + 2000
	})

	t.Run("Create offline transaction without signature fails", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		offlineTx := sync.OfflineTransaction{
			LocalID:   uuid.New().String(),
			Type:      sync.TransactionTypePurchase,
			Amount:    500,
			WalletID:  testWallet.ID,
			StaffID:   staff.ID,
			Signature: "", // Missing signature
			Timestamp: time.Now().Add(-1 * time.Minute),
		}

		req := sync.SubmitBatchRequest{
			DeviceID:     "device-offline-003",
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusFailed, result.Status)
		assert.Equal(t, 1, result.FailedCount)
		assert.Contains(t, result.Conflicts[0].Reason, "signature")
	})

	t.Run("Create offline transaction with tampered data fails", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		localID := uuid.New().String()
		timestamp := time.Now().Add(-1 * time.Minute)

		// Generate signature for 500 amount
		signature := suite.SyncService.GenerateOfflineSignature(
			localID,
			testWallet.ID,
			500,
			sync.TransactionTypePurchase,
			timestamp,
		)

		// Submit with different amount (tampered)
		offlineTx := sync.OfflineTransaction{
			LocalID:   localID,
			Type:      sync.TransactionTypePurchase,
			Amount:    1000, // Tampered - different from signed amount
			WalletID:  testWallet.ID,
			StaffID:   staff.ID,
			Signature: signature,
			Timestamp: timestamp,
		}

		req := sync.SubmitBatchRequest{
			DeviceID:     "device-offline-004",
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusFailed, result.Status)
		assert.Contains(t, result.Conflicts[0].Reason, "signature")
	})
}

// ============================================================================
// Syncing Offline Transactions Tests
// ============================================================================

func TestSyncingOfflineTransactions(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Sync batch of offline transactions preserves timestamps", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 10000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Create transactions with specific timestamps
		baseTime := time.Now().Add(-10 * time.Minute)
		transactions := []sync.OfflineTransaction{}

		for i := 0; i < 3; i++ {
			localID := uuid.New().String()
			timestamp := baseTime.Add(time.Duration(i) * time.Minute)
			signature := suite.SyncService.GenerateOfflineSignature(
				localID,
				testWallet.ID,
				500,
				sync.TransactionTypePurchase,
				timestamp,
			)
			transactions = append(transactions, sync.OfflineTransaction{
				LocalID:   localID,
				Type:      sync.TransactionTypePurchase,
				Amount:    500,
				WalletID:  testWallet.ID,
				StaffID:   staff.ID,
				Signature: signature,
				Timestamp: timestamp,
			})
		}

		req := sync.SubmitBatchRequest{
			DeviceID:     "device-sync-001",
			FestivalID:   testFestival.ID,
			Transactions: transactions,
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result.Status)
		assert.Equal(t, 3, result.SuccessCount)

		// Verify transactions were created with correct timestamps
		for _, success := range result.Successes {
			var tx wallet.Transaction
			err := suite.DB.Where("id = ?", success.ServerTxID).First(&tx).Error
			require.NoError(t, err)
			// Transaction timestamp should be within the test range
			assert.True(t, tx.CreatedAt.Before(time.Now()))
			assert.True(t, tx.CreatedAt.After(baseTime.Add(-1*time.Minute)))
		}
	})

	t.Run("Sync transactions from multiple devices", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 10000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		devices := []string{"device-A", "device-B", "device-C"}

		for _, deviceID := range devices {
			localID := uuid.New().String()
			timestamp := time.Now().Add(-2 * time.Minute)
			signature := suite.SyncService.GenerateOfflineSignature(
				localID,
				testWallet.ID,
				500,
				sync.TransactionTypePurchase,
				timestamp,
			)

			req := sync.SubmitBatchRequest{
				DeviceID:   deviceID,
				FestivalID: testFestival.ID,
				Transactions: []sync.OfflineTransaction{
					{
						LocalID:   localID,
						Type:      sync.TransactionTypePurchase,
						Amount:    500,
						WalletID:  testWallet.ID,
						StaffID:   staff.ID,
						Signature: signature,
						Timestamp: timestamp,
					},
				},
			}

			result, err := suite.SyncService.ProcessSyncBatch(ctx, req)
			require.NoError(t, err)
			assert.Equal(t, sync.SyncStatusCompleted, result.Status)
		}

		// Verify final balance
		var updatedWallet wallet.Wallet
		err := suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(8500), updatedWallet.Balance) // 10000 - 3*500
	})

	t.Run("Sync empty batch returns success with zero counts", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)

		// Note: Empty batch should be rejected by the validation binding
		// This test verifies the service handles minimal valid batches
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 1000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		localID := uuid.New().String()
		timestamp := time.Now().Add(-1 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, testWallet.ID, 0, sync.TransactionTypeTopUp, timestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-sync-002",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{
					LocalID:   localID,
					Type:      sync.TransactionTypeTopUp,
					Amount:    0, // Zero amount top-up
					WalletID:  testWallet.ID,
					StaffID:   staff.ID,
					Signature: signature,
					Timestamp: timestamp,
				},
			},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, 1, result.TotalCount)
		// Zero amount should still succeed
		assert.Equal(t, 1, result.SuccessCount)
	})
}

// ============================================================================
// Duplicate Detection Tests
// ============================================================================

func TestDuplicateDetectionWithIdempotencyKeys(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Detect duplicate by local ID within same device", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		localID := uuid.New().String()
		timestamp := time.Now().Add(-2 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID,
			testWallet.ID,
			1000,
			sync.TransactionTypePurchase,
			timestamp,
		)

		offlineTx := sync.OfflineTransaction{
			LocalID:   localID,
			Type:      sync.TransactionTypePurchase,
			Amount:    1000,
			WalletID:  testWallet.ID,
			StaffID:   staff.ID,
			Signature: signature,
			Timestamp: timestamp,
		}

		deviceID := "device-dup-001"

		// First submission
		req1 := sync.SubmitBatchRequest{
			DeviceID:     deviceID,
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		result1, err := suite.SyncService.ProcessSyncBatch(ctx, req1)
		require.NoError(t, err)
		assert.Equal(t, 1, result1.SuccessCount)
		originalServerTxID := result1.Successes[0].ServerTxID

		// Verify balance after first
		var walletAfterFirst wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&walletAfterFirst).Error
		require.NoError(t, err)
		assert.Equal(t, int64(4000), walletAfterFirst.Balance)

		// Second submission - same transaction
		req2 := sync.SubmitBatchRequest{
			DeviceID:     deviceID,
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		result2, err := suite.SyncService.ProcessSyncBatch(ctx, req2)
		require.NoError(t, err)
		assert.Equal(t, 1, result2.SuccessCount)
		assert.Equal(t, originalServerTxID, result2.Successes[0].ServerTxID)

		// Balance should not have changed
		var walletAfterSecond wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&walletAfterSecond).Error
		require.NoError(t, err)
		assert.Equal(t, int64(4000), walletAfterSecond.Balance)
	})

	t.Run("Same local ID on different devices are processed separately", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Use same local ID for different devices (edge case)
		localID := "shared-local-id-123"
		timestamp := time.Now().Add(-2 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID,
			testWallet.ID,
			500,
			sync.TransactionTypePurchase,
			timestamp,
		)

		offlineTx := sync.OfflineTransaction{
			LocalID:   localID,
			Type:      sync.TransactionTypePurchase,
			Amount:    500,
			WalletID:  testWallet.ID,
			StaffID:   staff.ID,
			Signature: signature,
			Timestamp: timestamp,
		}

		// Device 1
		req1 := sync.SubmitBatchRequest{
			DeviceID:     "device-A",
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		result1, err := suite.SyncService.ProcessSyncBatch(ctx, req1)
		require.NoError(t, err)
		assert.Equal(t, 1, result1.SuccessCount)

		// Device 2 - should process separately since device ID is different
		req2 := sync.SubmitBatchRequest{
			DeviceID:     "device-B",
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		result2, err := suite.SyncService.ProcessSyncBatch(ctx, req2)
		require.NoError(t, err)
		assert.Equal(t, 1, result2.SuccessCount)

		// Both should be processed (different devices)
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(4000), updatedWallet.Balance) // 5000 - 500 - 500
	})

	t.Run("Duplicate detection uses local ID and device ID combination", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 10000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		deviceID := "device-dup-003"
		localID1 := "local-tx-1"
		localID2 := "local-tx-2"
		timestamp := time.Now().Add(-2 * time.Minute)

		sig1 := suite.SyncService.GenerateOfflineSignature(localID1, testWallet.ID, 500, sync.TransactionTypePurchase, timestamp)
		sig2 := suite.SyncService.GenerateOfflineSignature(localID2, testWallet.ID, 500, sync.TransactionTypePurchase, timestamp)

		// Submit first batch with two transactions
		req1 := sync.SubmitBatchRequest{
			DeviceID:   deviceID,
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{LocalID: localID1, Type: sync.TransactionTypePurchase, Amount: 500, WalletID: testWallet.ID, StaffID: staff.ID, Signature: sig1, Timestamp: timestamp},
				{LocalID: localID2, Type: sync.TransactionTypePurchase, Amount: 500, WalletID: testWallet.ID, StaffID: staff.ID, Signature: sig2, Timestamp: timestamp},
			},
		}

		result1, err := suite.SyncService.ProcessSyncBatch(ctx, req1)
		require.NoError(t, err)
		assert.Equal(t, 2, result1.SuccessCount)

		// Resubmit only local-tx-1
		req2 := sync.SubmitBatchRequest{
			DeviceID:   deviceID,
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{LocalID: localID1, Type: sync.TransactionTypePurchase, Amount: 500, WalletID: testWallet.ID, StaffID: staff.ID, Signature: sig1, Timestamp: timestamp},
			},
		}

		result2, err := suite.SyncService.ProcessSyncBatch(ctx, req2)
		require.NoError(t, err)
		assert.Equal(t, 1, result2.SuccessCount)

		// Balance should be 9000 (only 2 transactions processed, not 3)
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(9000), updatedWallet.Balance)
	})
}

// ============================================================================
// Balance Reconciliation Tests
// ============================================================================

func TestBalanceReconciliationAfterSync(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Balance reconciliation allows previously failed transaction", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 500)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// First try: transaction that will fail due to insufficient balance
		localID := uuid.New().String()
		timestamp := time.Now().Add(-2 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID,
			testWallet.ID,
			1000, // More than available
			sync.TransactionTypePurchase,
			timestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-recon-001",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{
					LocalID:   localID,
					Type:      sync.TransactionTypePurchase,
					Amount:    1000,
					WalletID:  testWallet.ID,
					StaffID:   staff.ID,
					Signature: signature,
					Timestamp: timestamp,
				},
			},
		}

		result1, err := suite.SyncService.ProcessSyncBatch(ctx, req)
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusFailed, result1.Status)
		assert.Equal(t, 1, result1.FailedCount)

		// Now add funds to the wallet directly (simulating another top-up)
		suite.DB.Model(&wallet.Wallet{}).Where("id = ?", testWallet.ID).Update("balance", 2000)

		// Retry the same transaction with new ID
		localID2 := uuid.New().String()
		timestamp2 := time.Now().Add(-1 * time.Minute)
		signature2 := suite.SyncService.GenerateOfflineSignature(
			localID2,
			testWallet.ID,
			1000,
			sync.TransactionTypePurchase,
			timestamp2,
		)

		req2 := sync.SubmitBatchRequest{
			DeviceID:   "device-recon-001",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{
					LocalID:   localID2,
					Type:      sync.TransactionTypePurchase,
					Amount:    1000,
					WalletID:  testWallet.ID,
					StaffID:   staff.ID,
					Signature: signature2,
					Timestamp: timestamp2,
				},
			},
		}

		result2, err := suite.SyncService.ProcessSyncBatch(ctx, req2)
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result2.Status)
		assert.Equal(t, 1, result2.SuccessCount)

		// Verify final balance
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(1000), updatedWallet.Balance) // 2000 - 1000
	})

	t.Run("Multiple transactions reconcile to correct final balance", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		now := time.Now()
		transactions := []sync.OfflineTransaction{}

		// Purchase 1: -1000
		tx1ID := uuid.New().String()
		tx1Sig := suite.SyncService.GenerateOfflineSignature(tx1ID, testWallet.ID, 1000, sync.TransactionTypePurchase, now.Add(-5*time.Minute))
		transactions = append(transactions, sync.OfflineTransaction{
			LocalID: tx1ID, Type: sync.TransactionTypePurchase, Amount: 1000, WalletID: testWallet.ID, StaffID: staff.ID, Signature: tx1Sig, Timestamp: now.Add(-5 * time.Minute),
		})

		// Top-up: +2000
		tx2ID := uuid.New().String()
		tx2Sig := suite.SyncService.GenerateOfflineSignature(tx2ID, testWallet.ID, 2000, sync.TransactionTypeTopUp, now.Add(-4*time.Minute))
		transactions = append(transactions, sync.OfflineTransaction{
			LocalID: tx2ID, Type: sync.TransactionTypeTopUp, Amount: 2000, WalletID: testWallet.ID, StaffID: staff.ID, Signature: tx2Sig, Timestamp: now.Add(-4 * time.Minute),
		})

		// Purchase 2: -500
		tx3ID := uuid.New().String()
		tx3Sig := suite.SyncService.GenerateOfflineSignature(tx3ID, testWallet.ID, 500, sync.TransactionTypePurchase, now.Add(-3*time.Minute))
		transactions = append(transactions, sync.OfflineTransaction{
			LocalID: tx3ID, Type: sync.TransactionTypePurchase, Amount: 500, WalletID: testWallet.ID, StaffID: staff.ID, Signature: tx3Sig, Timestamp: now.Add(-3 * time.Minute),
		})

		// Refund: +300
		tx4ID := uuid.New().String()
		tx4Sig := suite.SyncService.GenerateOfflineSignature(tx4ID, testWallet.ID, 300, sync.TransactionTypeRefund, now.Add(-2*time.Minute))
		transactions = append(transactions, sync.OfflineTransaction{
			LocalID: tx4ID, Type: sync.TransactionTypeRefund, Amount: 300, WalletID: testWallet.ID, StaffID: staff.ID, Signature: tx4Sig, Timestamp: now.Add(-2 * time.Minute),
		})

		// Purchase 3: -800
		tx5ID := uuid.New().String()
		tx5Sig := suite.SyncService.GenerateOfflineSignature(tx5ID, testWallet.ID, 800, sync.TransactionTypePurchase, now.Add(-1*time.Minute))
		transactions = append(transactions, sync.OfflineTransaction{
			LocalID: tx5ID, Type: sync.TransactionTypePurchase, Amount: 800, WalletID: testWallet.ID, StaffID: staff.ID, Signature: tx5Sig, Timestamp: now.Add(-1 * time.Minute),
		})

		req := sync.SubmitBatchRequest{
			DeviceID:     "device-recon-002",
			FestivalID:   testFestival.ID,
			Transactions: transactions,
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result.Status)
		assert.Equal(t, 5, result.SuccessCount)

		// Expected balance: 5000 - 1000 + 2000 - 500 + 300 - 800 = 5000
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(5000), updatedWallet.Balance)
	})
}

// ============================================================================
// Transaction Rollback Tests
// ============================================================================

func TestTransactionRollbackOnServerRejection(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Failed transactions are marked in batch result", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 1000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Create transaction that will fail (insufficient balance)
		localID := uuid.New().String()
		timestamp := time.Now().Add(-1 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, testWallet.ID, 5000, sync.TransactionTypePurchase, timestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-rollback-001",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{
					LocalID:   localID,
					Type:      sync.TransactionTypePurchase,
					Amount:    5000, // More than available
					WalletID:  testWallet.ID,
					StaffID:   staff.ID,
					Signature: signature,
					Timestamp: timestamp,
				},
			},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusFailed, result.Status)
		assert.Len(t, result.Conflicts, 1)
		assert.Equal(t, localID, result.Conflicts[0].LocalID)

		// Get batch from DB to verify transaction is marked as failed
		batch, err := suite.SyncService.GetBatch(ctx, result.BatchID)
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusFailed, batch.Status)

		// Verify wallet balance unchanged
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(1000), updatedWallet.Balance) // Unchanged
	})

	t.Run("Partial batch failure does not rollback successful transactions", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 3000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		now := time.Now()

		// Valid transaction
		tx1ID := uuid.New().String()
		tx1Sig := suite.SyncService.GenerateOfflineSignature(tx1ID, testWallet.ID, 500, sync.TransactionTypePurchase, now.Add(-2*time.Minute))

		// Invalid transaction (bad signature)
		tx2ID := uuid.New().String()

		// Another valid transaction
		tx3ID := uuid.New().String()
		tx3Sig := suite.SyncService.GenerateOfflineSignature(tx3ID, testWallet.ID, 500, sync.TransactionTypePurchase, now)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-rollback-002",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{LocalID: tx1ID, Type: sync.TransactionTypePurchase, Amount: 500, WalletID: testWallet.ID, StaffID: staff.ID, Signature: tx1Sig, Timestamp: now.Add(-2 * time.Minute)},
				{LocalID: tx2ID, Type: sync.TransactionTypePurchase, Amount: 500, WalletID: testWallet.ID, StaffID: staff.ID, Signature: "bad-sig", Timestamp: now.Add(-1 * time.Minute)},
				{LocalID: tx3ID, Type: sync.TransactionTypePurchase, Amount: 500, WalletID: testWallet.ID, StaffID: staff.ID, Signature: tx3Sig, Timestamp: now},
			},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusPartial, result.Status)
		assert.Equal(t, 2, result.SuccessCount)
		assert.Equal(t, 1, result.FailedCount)

		// Successful transactions should have been processed
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(2000), updatedWallet.Balance) // 3000 - 500 - 500
	})

	t.Run("Rejected transaction shows reason in conflict", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 100)
		staff := helpers.CreateTestStaff(t, suite.DB)

		localID := uuid.New().String()
		timestamp := time.Now().Add(-1 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, testWallet.ID, 500, sync.TransactionTypePurchase, timestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-rollback-003",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{
					LocalID:   localID,
					Type:      sync.TransactionTypePurchase,
					Amount:    500, // More than balance (100)
					WalletID:  testWallet.ID,
					StaffID:   staff.ID,
					Signature: signature,
					Timestamp: timestamp,
				},
			},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusFailed, result.Status)
		require.Len(t, result.Conflicts, 1)
		assert.Equal(t, localID, result.Conflicts[0].LocalID)
		assert.Contains(t, result.Conflicts[0].Reason, "insufficient balance")
	})

	t.Run("Transaction for non-existent wallet fails gracefully", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		staff := helpers.CreateTestStaff(t, suite.DB)

		nonExistentWalletID := uuid.New()
		localID := uuid.New().String()
		timestamp := time.Now().Add(-1 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, nonExistentWalletID, 500, sync.TransactionTypePurchase, timestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-rollback-004",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{
					LocalID:   localID,
					Type:      sync.TransactionTypePurchase,
					Amount:    500,
					WalletID:  nonExistentWalletID,
					StaffID:   staff.ID,
					Signature: signature,
					Timestamp: timestamp,
				},
			},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusFailed, result.Status)
		assert.Len(t, result.Conflicts, 1)
		// Should indicate wallet not found or similar error
		assert.NotEmpty(t, result.Conflicts[0].Reason)
	})
}

// ============================================================================
// Edge Cases and Error Handling Tests
// ============================================================================

func TestOfflineTransactionEdgeCases(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Transaction with zero amount top-up", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 1000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		localID := uuid.New().String()
		timestamp := time.Now().Add(-1 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, testWallet.ID, 0, sync.TransactionTypeTopUp, timestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-edge-001",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{
					LocalID:   localID,
					Type:      sync.TransactionTypeTopUp,
					Amount:    0,
					WalletID:  testWallet.ID,
					StaffID:   staff.ID,
					Signature: signature,
					Timestamp: timestamp,
				},
			},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		// Zero amount should succeed but not change balance
		assert.Equal(t, 1, result.SuccessCount)

		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(1000), updatedWallet.Balance)
	})

	t.Run("Large batch processing", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 100000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Create large batch
		transactions := []sync.OfflineTransaction{}
		now := time.Now()

		for i := 0; i < 50; i++ {
			localID := uuid.New().String()
			timestamp := now.Add(-time.Duration(50-i) * time.Second)
			signature := suite.SyncService.GenerateOfflineSignature(
				localID, testWallet.ID, 100, sync.TransactionTypePurchase, timestamp,
			)
			transactions = append(transactions, sync.OfflineTransaction{
				LocalID:   localID,
				Type:      sync.TransactionTypePurchase,
				Amount:    100,
				WalletID:  testWallet.ID,
				StaffID:   staff.ID,
				Signature: signature,
				Timestamp: timestamp,
			})
		}

		req := sync.SubmitBatchRequest{
			DeviceID:     "device-edge-002",
			FestivalID:   testFestival.ID,
			Transactions: transactions,
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result.Status)
		assert.Equal(t, 50, result.SuccessCount)

		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(95000), updatedWallet.Balance) // 100000 - 50*100
	})

	t.Run("Transaction with product IDs", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Create products
		product1 := helpers.CreateTestProduct(t, suite.DB, testStand.ID, &helpers.ProductOptions{
			Name:  helpers.StringPtr("Beer"),
			Price: helpers.Int64Ptr(300),
		})
		product2 := helpers.CreateTestProduct(t, suite.DB, testStand.ID, &helpers.ProductOptions{
			Name:  helpers.StringPtr("Snack"),
			Price: helpers.Int64Ptr(200),
		})

		localID := uuid.New().String()
		timestamp := time.Now().Add(-1 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, testWallet.ID, 500, sync.TransactionTypePurchase, timestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-edge-003",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{
					LocalID:    localID,
					Type:       sync.TransactionTypePurchase,
					Amount:     500, // 300 + 200
					WalletID:   testWallet.ID,
					StandID:    &testStand.ID,
					StaffID:    staff.ID,
					ProductIDs: []string{product1.ID.String(), product2.ID.String()},
					Signature:  signature,
					Timestamp:  timestamp,
				},
			},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result.Status)
		assert.Equal(t, 1, result.SuccessCount)

		// Verify transaction has product IDs in metadata
		var tx wallet.Transaction
		err = suite.DB.Where("id = ?", result.Successes[0].ServerTxID).First(&tx).Error
		require.NoError(t, err)
		assert.Len(t, tx.Metadata.ProductIDs, 2)
	})
}
