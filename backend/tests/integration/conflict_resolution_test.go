package integration

import (
	"context"
	"sync/atomic"
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
// Server-Wins Strategy Tests
// ============================================================================

func TestServerWinsStrategyForWallets(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Server balance takes precedence over stale offline balance", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Simulate offline transaction created when balance was 5000
		localID := uuid.New().String()
		timestamp := time.Now().Add(-10 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, testWallet.ID, 2000, sync.TransactionTypePurchase, timestamp,
		)

		offlineTx := sync.OfflineTransaction{
			LocalID:   localID,
			Type:      sync.TransactionTypePurchase,
			Amount:    2000,
			WalletID:  testWallet.ID,
			StaffID:   staff.ID,
			Signature: signature,
			Timestamp: timestamp,
		}

		// Meanwhile, server balance changed (another online transaction reduced it)
		suite.DB.Model(&wallet.Wallet{}).Where("id = ?", testWallet.ID).Update("balance", 1500)

		// Now sync the offline transaction
		req := sync.SubmitBatchRequest{
			DeviceID:     "device-conflict-001",
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		// Server state wins - transaction fails due to actual balance
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusFailed, result.Status)
		assert.Equal(t, 1, result.FailedCount)
		assert.Contains(t, result.Conflicts[0].Reason, "insufficient balance")

		// Wallet balance unchanged
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(1500), updatedWallet.Balance)
	})

	t.Run("Offline top-up succeeds even if server balance higher", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 3000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Offline top-up
		localID := uuid.New().String()
		timestamp := time.Now().Add(-5 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, testWallet.ID, 2000, sync.TransactionTypeTopUp, timestamp,
		)

		offlineTx := sync.OfflineTransaction{
			LocalID:   localID,
			Type:      sync.TransactionTypeTopUp,
			Amount:    2000,
			WalletID:  testWallet.ID,
			StaffID:   staff.ID,
			Signature: signature,
			Timestamp: timestamp,
		}

		// Server balance was already increased
		suite.DB.Model(&wallet.Wallet{}).Where("id = ?", testWallet.ID).Update("balance", 4000)

		req := sync.SubmitBatchRequest{
			DeviceID:     "device-conflict-002",
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		// Top-up should succeed regardless
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result.Status)

		// Balance should be 4000 + 2000 = 6000
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(6000), updatedWallet.Balance)
	})

	t.Run("Server rejects transaction if wallet status changed", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		localID := uuid.New().String()
		timestamp := time.Now().Add(-5 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, testWallet.ID, 500, sync.TransactionTypePurchase, timestamp,
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

		// Wallet was frozen on server
		suite.DB.Model(&wallet.Wallet{}).Where("id = ?", testWallet.ID).Update("status", wallet.WalletStatusFrozen)

		req := sync.SubmitBatchRequest{
			DeviceID:     "device-conflict-003",
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		// Should fail because wallet is frozen
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusFailed, result.Status)
		assert.Contains(t, result.Conflicts[0].Reason, "not active")
	})
}

// ============================================================================
// Merge Strategy Tests
// ============================================================================

func TestMergeStrategyForTransactions(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Multiple offline transactions from same device are merged correctly", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 10000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		now := time.Now()
		transactions := []sync.OfflineTransaction{}

		// Create multiple transactions in sequence
		for i := 0; i < 5; i++ {
			localID := uuid.New().String()
			timestamp := now.Add(-time.Duration(5-i) * time.Minute)
			signature := suite.SyncService.GenerateOfflineSignature(
				localID, testWallet.ID, 500, sync.TransactionTypePurchase, timestamp,
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
			DeviceID:     "device-merge-001",
			FestivalID:   testFestival.ID,
			Transactions: transactions,
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result.Status)
		assert.Equal(t, 5, result.SuccessCount)

		// All transactions merged - total debit = 2500
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(7500), updatedWallet.Balance)

		// Verify all 5 server transactions created
		var count int64
		suite.DB.Model(&wallet.Transaction{}).Where("wallet_id = ?", testWallet.ID).Count(&count)
		assert.Equal(t, int64(5), count)
	})

	t.Run("Transactions from different festivals are processed separately", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		festival1 := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		festival2 := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		wallet1 := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, festival1.ID, 5000)
		wallet2 := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, festival2.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		now := time.Now()

		// Transaction for festival 1
		tx1ID := uuid.New().String()
		tx1Sig := suite.SyncService.GenerateOfflineSignature(tx1ID, wallet1.ID, 500, sync.TransactionTypePurchase, now)

		req1 := sync.SubmitBatchRequest{
			DeviceID:   "device-merge-002",
			FestivalID: festival1.ID,
			Transactions: []sync.OfflineTransaction{
				{LocalID: tx1ID, Type: sync.TransactionTypePurchase, Amount: 500, WalletID: wallet1.ID, StaffID: staff.ID, Signature: tx1Sig, Timestamp: now},
			},
		}

		// Transaction for festival 2
		tx2ID := uuid.New().String()
		tx2Sig := suite.SyncService.GenerateOfflineSignature(tx2ID, wallet2.ID, 700, sync.TransactionTypePurchase, now)

		req2 := sync.SubmitBatchRequest{
			DeviceID:   "device-merge-002",
			FestivalID: festival2.ID,
			Transactions: []sync.OfflineTransaction{
				{LocalID: tx2ID, Type: sync.TransactionTypePurchase, Amount: 700, WalletID: wallet2.ID, StaffID: staff.ID, Signature: tx2Sig, Timestamp: now},
			},
		}

		// Process both
		result1, err := suite.SyncService.ProcessSyncBatch(ctx, req1)
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result1.Status)

		result2, err := suite.SyncService.ProcessSyncBatch(ctx, req2)
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result2.Status)

		// Verify wallets updated independently
		var w1, w2 wallet.Wallet
		suite.DB.Where("id = ?", wallet1.ID).First(&w1)
		suite.DB.Where("id = ?", wallet2.ID).First(&w2)

		assert.Equal(t, int64(4500), w1.Balance) // 5000 - 500
		assert.Equal(t, int64(4300), w2.Balance) // 5000 - 700
	})

	t.Run("Mixed transaction types are processed in order", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 1000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		now := time.Now()

		// Purchase: -300
		tx1ID := uuid.New().String()
		tx1Sig := suite.SyncService.GenerateOfflineSignature(tx1ID, testWallet.ID, 300, sync.TransactionTypePurchase, now.Add(-4*time.Minute))

		// Top-up: +500
		tx2ID := uuid.New().String()
		tx2Sig := suite.SyncService.GenerateOfflineSignature(tx2ID, testWallet.ID, 500, sync.TransactionTypeTopUp, now.Add(-3*time.Minute))

		// Purchase: -800
		tx3ID := uuid.New().String()
		tx3Sig := suite.SyncService.GenerateOfflineSignature(tx3ID, testWallet.ID, 800, sync.TransactionTypePurchase, now.Add(-2*time.Minute))

		// Refund: +200
		tx4ID := uuid.New().String()
		tx4Sig := suite.SyncService.GenerateOfflineSignature(tx4ID, testWallet.ID, 200, sync.TransactionTypeRefund, now.Add(-1*time.Minute))

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-merge-003",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{LocalID: tx1ID, Type: sync.TransactionTypePurchase, Amount: 300, WalletID: testWallet.ID, StaffID: staff.ID, Signature: tx1Sig, Timestamp: now.Add(-4 * time.Minute)},
				{LocalID: tx2ID, Type: sync.TransactionTypeTopUp, Amount: 500, WalletID: testWallet.ID, StaffID: staff.ID, Signature: tx2Sig, Timestamp: now.Add(-3 * time.Minute)},
				{LocalID: tx3ID, Type: sync.TransactionTypePurchase, Amount: 800, WalletID: testWallet.ID, StaffID: staff.ID, Signature: tx3Sig, Timestamp: now.Add(-2 * time.Minute)},
				{LocalID: tx4ID, Type: sync.TransactionTypeRefund, Amount: 200, WalletID: testWallet.ID, StaffID: staff.ID, Signature: tx4Sig, Timestamp: now.Add(-1 * time.Minute)},
			},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result.Status)
		assert.Equal(t, 4, result.SuccessCount)

		// Final: 1000 - 300 + 500 - 800 + 200 = 600
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(600), updatedWallet.Balance)
	})
}

// ============================================================================
// Timestamp-Based Conflict Detection Tests
// ============================================================================

func TestTimestampBasedConflictDetection(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Old transactions are rejected when max age exceeded", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Set strict max age
		suite.SyncService.SetMaxBatchAge(1 * time.Hour)

		// Create very old transaction (2 hours ago)
		localID := uuid.New().String()
		timestamp := time.Now().Add(-2 * time.Hour)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, testWallet.ID, 500, sync.TransactionTypePurchase, timestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-ts-001",
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
		assert.Equal(t, sync.SyncStatusFailed, result.Status)
		assert.Contains(t, result.Conflicts[0].Reason, "too old")

		// Reset
		suite.SyncService.SetMaxBatchAge(24 * time.Hour)
	})

	t.Run("Recent transactions within max age are accepted", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		suite.SyncService.SetMaxBatchAge(1 * time.Hour)

		// Create recent transaction (30 minutes ago)
		localID := uuid.New().String()
		timestamp := time.Now().Add(-30 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, testWallet.ID, 500, sync.TransactionTypePurchase, timestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-ts-002",
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

		suite.SyncService.SetMaxBatchAge(24 * time.Hour)
	})

	t.Run("Batch with mixed old and new transactions", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		suite.SyncService.SetMaxBatchAge(1 * time.Hour)

		now := time.Now()

		// Old transaction (2 hours ago)
		oldID := uuid.New().String()
		oldTimestamp := now.Add(-2 * time.Hour)
		oldSig := suite.SyncService.GenerateOfflineSignature(oldID, testWallet.ID, 300, sync.TransactionTypePurchase, oldTimestamp)

		// New transaction (10 minutes ago)
		newID := uuid.New().String()
		newTimestamp := now.Add(-10 * time.Minute)
		newSig := suite.SyncService.GenerateOfflineSignature(newID, testWallet.ID, 400, sync.TransactionTypePurchase, newTimestamp)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-ts-003",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{LocalID: oldID, Type: sync.TransactionTypePurchase, Amount: 300, WalletID: testWallet.ID, StaffID: staff.ID, Signature: oldSig, Timestamp: oldTimestamp},
				{LocalID: newID, Type: sync.TransactionTypePurchase, Amount: 400, WalletID: testWallet.ID, StaffID: staff.ID, Signature: newSig, Timestamp: newTimestamp},
			},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusPartial, result.Status)
		assert.Equal(t, 1, result.SuccessCount)
		assert.Equal(t, 1, result.FailedCount)

		// Only new transaction processed
		var updatedWallet wallet.Wallet
		suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet)
		assert.Equal(t, int64(4600), updatedWallet.Balance) // 5000 - 400

		suite.SyncService.SetMaxBatchAge(24 * time.Hour)
	})

	t.Run("Transaction timestamp preserved in server record", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		localID := uuid.New().String()
		originalTimestamp := time.Now().Add(-15 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, testWallet.ID, 500, sync.TransactionTypePurchase, originalTimestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-ts-004",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{
					LocalID:   localID,
					Type:      sync.TransactionTypePurchase,
					Amount:    500,
					WalletID:  testWallet.ID,
					StaffID:   staff.ID,
					Signature: signature,
					Timestamp: originalTimestamp,
				},
			},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)
		require.NoError(t, err)

		// Verify server transaction has original timestamp
		var tx wallet.Transaction
		err = suite.DB.Where("id = ?", result.Successes[0].ServerTxID).First(&tx).Error
		require.NoError(t, err)

		// The transaction timestamp should match the original offline timestamp
		assert.True(t, tx.CreatedAt.Sub(originalTimestamp) < time.Second)
	})
}

// ============================================================================
// Concurrent Modifications Tests
// ============================================================================

func TestConcurrentModifications(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Concurrent syncs from same device are serialized", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 10000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		deviceID := "device-concurrent-001"
		var successCount int32

		// Create 5 concurrent sync requests
		done := make(chan bool, 5)

		for i := 0; i < 5; i++ {
			go func(idx int) {
				localID := uuid.New().String()
				timestamp := time.Now().Add(-time.Duration(idx) * time.Minute)
				signature := suite.SyncService.GenerateOfflineSignature(
					localID, testWallet.ID, 500, sync.TransactionTypePurchase, timestamp,
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
				if err == nil && result.SuccessCount == 1 {
					atomic.AddInt32(&successCount, 1)
				}
				done <- true
			}(i)
		}

		// Wait for all goroutines
		for i := 0; i < 5; i++ {
			<-done
		}

		// All should succeed
		assert.Equal(t, int32(5), successCount)

		// Final balance should be 10000 - 5*500 = 7500
		var updatedWallet wallet.Wallet
		err := suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(7500), updatedWallet.Balance)
	})

	t.Run("Concurrent syncs from different devices", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 10000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		var successCount int32
		done := make(chan bool, 5)

		// 5 different devices syncing concurrently
		for i := 0; i < 5; i++ {
			go func(idx int) {
				deviceID := "device-concurrent-" + string(rune('A'+idx))
				localID := uuid.New().String()
				timestamp := time.Now().Add(-time.Duration(idx) * time.Minute)
				signature := suite.SyncService.GenerateOfflineSignature(
					localID, testWallet.ID, 500, sync.TransactionTypePurchase, timestamp,
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
				if err == nil && result.SuccessCount == 1 {
					atomic.AddInt32(&successCount, 1)
				}
				done <- true
			}(i)
		}

		// Wait for all
		for i := 0; i < 5; i++ {
			<-done
		}

		assert.Equal(t, int32(5), successCount)

		// Final balance
		var updatedWallet wallet.Wallet
		err := suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(7500), updatedWallet.Balance)
	})

	t.Run("Concurrent modifications to different wallets", func(t *testing.T) {
		// Setup - create multiple users with wallets
		testFestival := helpers.CreateActiveFestival(t, suite.DB, nil)
		staff := helpers.CreateTestStaff(t, suite.DB)

		users := make([]*helpers.TestSetup, 3)
		walletIDs := make([]uuid.UUID, 3)

		for i := 0; i < 3; i++ {
			testUser := helpers.CreateTestUser(t, suite.DB, nil)
			testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
			users[i] = &helpers.TestSetup{User: testUser, Wallet: testWallet}
			walletIDs[i] = testWallet.ID
		}

		var successCount int32
		done := make(chan bool, 9)

		// 3 transactions per wallet, all concurrent
		for i := 0; i < 3; i++ {
			for j := 0; j < 3; j++ {
				go func(walletIdx, txIdx int) {
					walletID := walletIDs[walletIdx]
					localID := uuid.New().String()
					timestamp := time.Now().Add(-time.Duration(txIdx) * time.Minute)
					signature := suite.SyncService.GenerateOfflineSignature(
						localID, walletID, 300, sync.TransactionTypePurchase, timestamp,
					)

					req := sync.SubmitBatchRequest{
						DeviceID:   "device-" + string(rune('A'+walletIdx)) + "-" + string(rune('0'+txIdx)),
						FestivalID: testFestival.ID,
						Transactions: []sync.OfflineTransaction{
							{
								LocalID:   localID,
								Type:      sync.TransactionTypePurchase,
								Amount:    300,
								WalletID:  walletID,
								StaffID:   staff.ID,
								Signature: signature,
								Timestamp: timestamp,
							},
						},
					}

					result, err := suite.SyncService.ProcessSyncBatch(ctx, req)
					if err == nil && result.SuccessCount == 1 {
						atomic.AddInt32(&successCount, 1)
					}
					done <- true
				}(i, j)
			}
		}

		// Wait for all
		for i := 0; i < 9; i++ {
			<-done
		}

		assert.Equal(t, int32(9), successCount)

		// Each wallet should have 5000 - 3*300 = 4100
		for i := 0; i < 3; i++ {
			var w wallet.Wallet
			suite.DB.Where("id = ?", walletIDs[i]).First(&w)
			assert.Equal(t, int64(4100), w.Balance)
		}
	})

	t.Run("Race condition: balance depleted mid-batch", func(t *testing.T) {
		// This tests that the database lock prevents race conditions
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 1000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		var successCount int32
		var failCount int32
		done := make(chan bool, 5)

		// Try to debit 500 five times when only 1000 available
		for i := 0; i < 5; i++ {
			go func(idx int) {
				localID := uuid.New().String()
				timestamp := time.Now().Add(-time.Duration(idx) * time.Second)
				signature := suite.SyncService.GenerateOfflineSignature(
					localID, testWallet.ID, 500, sync.TransactionTypePurchase, timestamp,
				)

				req := sync.SubmitBatchRequest{
					DeviceID:   "device-race-" + string(rune('A'+idx)),
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
				if err == nil {
					if result.SuccessCount == 1 {
						atomic.AddInt32(&successCount, 1)
					} else {
						atomic.AddInt32(&failCount, 1)
					}
				}
				done <- true
			}(i)
		}

		for i := 0; i < 5; i++ {
			<-done
		}

		// Only 2 should succeed (1000 / 500 = 2)
		assert.Equal(t, int32(2), successCount)
		assert.Equal(t, int32(3), failCount)

		// Final balance should be 0
		var updatedWallet wallet.Wallet
		err := suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(0), updatedWallet.Balance)
	})
}

// ============================================================================
// Conflict Resolution Priority Tests
// ============================================================================

func TestConflictResolutionPriority(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Signature validation failure has highest priority", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 0) // Zero balance
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Transaction with bad signature (would also fail due to zero balance)
		req := sync.SubmitBatchRequest{
			DeviceID:   "device-priority-001",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{
					LocalID:   uuid.New().String(),
					Type:      sync.TransactionTypePurchase,
					Amount:    500,
					WalletID:  testWallet.ID,
					StaffID:   staff.ID,
					Signature: "bad-signature", // Invalid
					Timestamp: time.Now().Add(-1 * time.Minute),
				},
			},
		}

		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusFailed, result.Status)
		// Should fail on signature, not balance
		assert.Contains(t, result.Conflicts[0].Reason, "signature")
	})

	t.Run("Age check comes before balance check", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 0) // Zero balance
		staff := helpers.CreateTestStaff(t, suite.DB)

		suite.SyncService.SetMaxBatchAge(1 * time.Hour)

		// Old transaction with valid signature (would also fail due to zero balance)
		localID := uuid.New().String()
		timestamp := time.Now().Add(-2 * time.Hour)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, testWallet.ID, 500, sync.TransactionTypePurchase, timestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-priority-002",
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
		assert.Equal(t, sync.SyncStatusFailed, result.Status)
		// Should fail on age, not balance
		assert.Contains(t, result.Conflicts[0].Reason, "too old")

		suite.SyncService.SetMaxBatchAge(24 * time.Hour)
	})
}
