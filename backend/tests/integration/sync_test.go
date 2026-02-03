package integration

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/product"
	"github.com/mimi6060/festivals/backend/internal/domain/stand"
	"github.com/mimi6060/festivals/backend/internal/domain/sync"
	"github.com/mimi6060/festivals/backend/internal/domain/wallet"
	"github.com/mimi6060/festivals/backend/tests/helpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// Sync Test Suite Setup
// ============================================================================

// SyncTestSuite extends the base test suite with sync-specific services
type SyncTestSuite struct {
	*TestSuite
	SyncService *sync.Service
	SyncRepo    sync.Repository
}

// SetupSyncTestSuite initializes the sync test suite
func SetupSyncTestSuite(t *testing.T) *SyncTestSuite {
	t.Helper()
	baseSuite := SetupTestSuite(t)

	// Create sync_batches table for tests
	if err := baseSuite.DB.Exec(`
		CREATE TABLE IF NOT EXISTS sync_batches (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			device_id VARCHAR(255) NOT NULL,
			festival_id UUID NOT NULL REFERENCES public.festivals(id),
			transactions JSONB NOT NULL,
			status VARCHAR(50) DEFAULT 'PENDING',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			processed_at TIMESTAMP,
			result JSONB
		)
	`).Error; err != nil {
		t.Fatalf("Failed to create sync_batches table: %v", err)
	}

	// Create indexes for sync_batches
	baseSuite.DB.Exec("CREATE INDEX IF NOT EXISTS idx_sync_batches_device_id ON sync_batches(device_id)")
	baseSuite.DB.Exec("CREATE INDEX IF NOT EXISTS idx_sync_batches_festival_id ON sync_batches(festival_id)")
	baseSuite.DB.Exec("CREATE INDEX IF NOT EXISTS idx_sync_batches_status ON sync_batches(status)")

	// Initialize sync repository and service
	syncRepo := sync.NewRepository(baseSuite.DB)
	walletRepo := wallet.NewRepository(baseSuite.DB)
	// Use a properly-sized test secret key (32+ characters) - DO NOT USE IN PRODUCTION
	syncService := sync.NewService(syncRepo, walletRepo, "TEST_ONLY_not_for_production_use_32chars_min_sync_secret")

	return &SyncTestSuite{
		TestSuite:   baseSuite,
		SyncService: syncService,
		SyncRepo:    syncRepo,
	}
}

// CleanupSyncDatabase cleans sync-specific tables in addition to base tables
func (s *SyncTestSuite) CleanupSyncDatabase(t *testing.T) {
	t.Helper()
	// Clean sync tables first
	if err := s.DB.Exec("TRUNCATE TABLE sync_batches CASCADE").Error; err != nil {
		t.Logf("Warning: Could not truncate sync_batches: %v", err)
	}
	// Then clean base tables
	s.CleanupDatabase(t)
}

// ============================================================================
// Wallet Sync Tests
// ============================================================================

func TestWalletSyncPushLocalChanges(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Push local purchase transaction to server", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 10000)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Create offline transaction
		localID := uuid.New().String()
		timestamp := time.Now().Add(-5 * time.Minute)
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
			StandID:   &testStand.ID,
			StaffID:   staff.ID,
			Signature: signature,
			Timestamp: timestamp,
		}

		req := sync.SubmitBatchRequest{
			DeviceID:     "device-001",
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		// Execute
		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		// Assert
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result.Status)
		assert.Equal(t, 1, result.TotalCount)
		assert.Equal(t, 1, result.SuccessCount)
		assert.Equal(t, 0, result.FailedCount)
		assert.Len(t, result.Successes, 1)
		assert.Equal(t, localID, result.Successes[0].LocalID)
		assert.NotEqual(t, uuid.Nil, result.Successes[0].ServerTxID)

		// Verify wallet balance was updated
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(9000), updatedWallet.Balance) // 10000 - 1000
	})

	t.Run("Push multiple transactions in a single batch", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 10000)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Create multiple offline transactions
		transactions := make([]sync.OfflineTransaction, 3)
		for i := 0; i < 3; i++ {
			localID := uuid.New().String()
			timestamp := time.Now().Add(-time.Duration(5-i) * time.Minute)
			signature := suite.SyncService.GenerateOfflineSignature(
				localID,
				testWallet.ID,
				500,
				sync.TransactionTypePurchase,
				timestamp,
			)
			transactions[i] = sync.OfflineTransaction{
				LocalID:   localID,
				Type:      sync.TransactionTypePurchase,
				Amount:    500,
				WalletID:  testWallet.ID,
				StandID:   &testStand.ID,
				StaffID:   staff.ID,
				Signature: signature,
				Timestamp: timestamp,
			}
		}

		req := sync.SubmitBatchRequest{
			DeviceID:     "device-002",
			FestivalID:   testFestival.ID,
			Transactions: transactions,
		}

		// Execute
		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		// Assert
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result.Status)
		assert.Equal(t, 3, result.TotalCount)
		assert.Equal(t, 3, result.SuccessCount)
		assert.Equal(t, 0, result.FailedCount)

		// Verify wallet balance
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(8500), updatedWallet.Balance) // 10000 - 3*500
	})
}

func TestWalletSyncPullServerState(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Get batch status shows completed transactions", func(t *testing.T) {
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
			500,
			sync.TransactionTypePurchase,
			timestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-003",
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

		// Process the batch
		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)
		require.NoError(t, err)

		// Pull server state by getting batch
		batch, err := suite.SyncService.GetBatch(ctx, result.BatchID)

		// Assert
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, batch.Status)
		assert.NotNil(t, batch.ProcessedAt)
		assert.NotNil(t, batch.Result)
		assert.Equal(t, 1, batch.Result.SuccessCount)
	})
}

// ============================================================================
// Transaction Sync Tests
// ============================================================================

func TestTransactionSyncWithConflictResolution(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Transaction rejected due to insufficient balance", func(t *testing.T) {
		// Setup - wallet with low balance
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 500)
		staff := helpers.CreateTestStaff(t, suite.DB)

		localID := uuid.New().String()
		timestamp := time.Now().Add(-1 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID,
			testWallet.ID,
			1000, // More than balance
			sync.TransactionTypePurchase,
			timestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-004",
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

		// Execute
		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		// Assert
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusFailed, result.Status)
		assert.Equal(t, 1, result.FailedCount)
		assert.Len(t, result.Conflicts, 1)
		assert.Contains(t, result.Conflicts[0].Reason, "insufficient balance")
	})

	t.Run("Refund transaction succeeds", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)
		staff := helpers.CreateTestStaff(t, suite.DB)

		localID := uuid.New().String()
		timestamp := time.Now().Add(-1 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID,
			testWallet.ID,
			500,
			sync.TransactionTypeRefund,
			timestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-005",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{
					LocalID:   localID,
					Type:      sync.TransactionTypeRefund,
					Amount:    500,
					WalletID:  testWallet.ID,
					StandID:   &testStand.ID,
					StaffID:   staff.ID,
					Signature: signature,
					Timestamp: timestamp,
				},
			},
		}

		// Execute
		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		// Assert
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result.Status)
		assert.Equal(t, 1, result.SuccessCount)

		// Verify balance increased
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(5500), updatedWallet.Balance) // 5000 + 500
	})
}

// ============================================================================
// Product/Stand Catalog Sync Tests
// ============================================================================

func TestProductStandCatalogSync(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	t.Run("Verify products are available for offline transactions", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, &helpers.StandOptions{
			Name:     helpers.StringPtr("Beer Stand"),
			Category: helpers.StringPtr(string(stand.StandCategoryBar)),
		})

		// Create multiple products
		for i := 0; i < 5; i++ {
			helpers.CreateTestProduct(t, suite.DB, testStand.ID, &helpers.ProductOptions{
				Name:     helpers.StringPtr("Beer " + string(rune('A'+i))),
				Price:    helpers.Int64Ptr(int64(300 + i*50)),
				Category: helpers.StringPtr(string(product.ProductCategoryBeer)),
			})
		}

		// Fetch products for the stand
		var products []product.Product
		err := suite.DB.Where("stand_id = ? AND status = ?", testStand.ID, product.ProductStatusActive).Find(&products).Error
		require.NoError(t, err)

		// Assert catalog is complete
		assert.Len(t, products, 5)
		for _, p := range products {
			assert.Equal(t, testStand.ID, p.StandID)
			assert.Equal(t, product.ProductStatusActive, p.Status)
		}
	})

	t.Run("Verify stands are available for offline transactions", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)

		// Create multiple stands
		standCategories := []string{
			string(stand.StandCategoryBar),
			string(stand.StandCategoryFood),
			string(stand.StandCategoryMerchandise),
		}
		for i, cat := range standCategories {
			helpers.CreateTestStand(t, suite.DB, testFestival.ID, &helpers.StandOptions{
				Name:     helpers.StringPtr("Stand " + string(rune('A'+i))),
				Category: &cat,
			})
		}

		// Fetch stands for the festival
		var stands []stand.Stand
		err := suite.DB.Where("festival_id = ? AND status = ?", testFestival.ID, stand.StandStatusActive).Find(&stands).Error
		require.NoError(t, err)

		// Assert catalog is complete
		assert.Len(t, stands, 3)
		for _, s := range stands {
			assert.Equal(t, testFestival.ID, s.FestivalID)
			assert.Equal(t, stand.StandStatusActive, s.Status)
		}
	})
}

// ============================================================================
// Offline Queue Processing Tests
// ============================================================================

func TestOfflineQueueProcessing(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Process queue with mixed transaction types", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 10000)
		testStand := helpers.CreateTestStand(t, suite.DB, testFestival.ID, nil)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Create queue with different transaction types
		now := time.Now()
		transactions := []sync.OfflineTransaction{}

		// Purchase
		purchaseID := uuid.New().String()
		purchaseSig := suite.SyncService.GenerateOfflineSignature(
			purchaseID, testWallet.ID, 1000, sync.TransactionTypePurchase, now.Add(-3*time.Minute),
		)
		transactions = append(transactions, sync.OfflineTransaction{
			LocalID:   purchaseID,
			Type:      sync.TransactionTypePurchase,
			Amount:    1000,
			WalletID:  testWallet.ID,
			StandID:   &testStand.ID,
			StaffID:   staff.ID,
			Signature: purchaseSig,
			Timestamp: now.Add(-3 * time.Minute),
		})

		// Top-up
		topUpID := uuid.New().String()
		topUpSig := suite.SyncService.GenerateOfflineSignature(
			topUpID, testWallet.ID, 2000, sync.TransactionTypeTopUp, now.Add(-2*time.Minute),
		)
		transactions = append(transactions, sync.OfflineTransaction{
			LocalID:   topUpID,
			Type:      sync.TransactionTypeTopUp,
			Amount:    2000,
			WalletID:  testWallet.ID,
			StaffID:   staff.ID,
			Signature: topUpSig,
			Timestamp: now.Add(-2 * time.Minute),
		})

		// Another purchase
		purchase2ID := uuid.New().String()
		purchase2Sig := suite.SyncService.GenerateOfflineSignature(
			purchase2ID, testWallet.ID, 500, sync.TransactionTypePurchase, now.Add(-1*time.Minute),
		)
		transactions = append(transactions, sync.OfflineTransaction{
			LocalID:   purchase2ID,
			Type:      sync.TransactionTypePurchase,
			Amount:    500,
			WalletID:  testWallet.ID,
			StandID:   &testStand.ID,
			StaffID:   staff.ID,
			Signature: purchase2Sig,
			Timestamp: now.Add(-1 * time.Minute),
		})

		req := sync.SubmitBatchRequest{
			DeviceID:     "device-006",
			FestivalID:   testFestival.ID,
			Transactions: transactions,
		}

		// Execute
		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		// Assert
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result.Status)
		assert.Equal(t, 3, result.TotalCount)
		assert.Equal(t, 3, result.SuccessCount)

		// Verify final balance: 10000 - 1000 + 2000 - 500 = 10500
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(10500), updatedWallet.Balance)
	})

	t.Run("Queue processing preserves order", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Create transactions that depend on order
		now := time.Now()
		transactions := []sync.OfflineTransaction{}

		for i := 0; i < 5; i++ {
			localID := uuid.New().String()
			timestamp := now.Add(-time.Duration(5-i) * time.Minute)
			sig := suite.SyncService.GenerateOfflineSignature(
				localID, testWallet.ID, 500, sync.TransactionTypePurchase, timestamp,
			)
			transactions = append(transactions, sync.OfflineTransaction{
				LocalID:   localID,
				Type:      sync.TransactionTypePurchase,
				Amount:    500,
				WalletID:  testWallet.ID,
				StaffID:   staff.ID,
				Signature: sig,
				Timestamp: timestamp,
			})
		}

		req := sync.SubmitBatchRequest{
			DeviceID:     "device-007",
			FestivalID:   testFestival.ID,
			Transactions: transactions,
		}

		// Execute
		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		// Assert all processed
		require.NoError(t, err)
		assert.Equal(t, 5, result.SuccessCount)

		// Final balance: 5000 - 5*500 = 2500
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(2500), updatedWallet.Balance)
	})
}

// ============================================================================
// Idempotency Tests
// ============================================================================

func TestIdempotency(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Same transaction sent twice is only processed once", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Create transaction
		localID := uuid.New().String()
		timestamp := time.Now().Add(-2 * time.Minute)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, testWallet.ID, 1000, sync.TransactionTypePurchase, timestamp,
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

		req := sync.SubmitBatchRequest{
			DeviceID:     "device-008",
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		// First submission
		result1, err := suite.SyncService.ProcessSyncBatch(ctx, req)
		require.NoError(t, err)
		assert.Equal(t, 1, result1.SuccessCount)
		serverTxID1 := result1.Successes[0].ServerTxID

		// Check balance after first submission
		var walletAfterFirst wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&walletAfterFirst).Error
		require.NoError(t, err)
		assert.Equal(t, int64(4000), walletAfterFirst.Balance)

		// Second submission (duplicate)
		result2, err := suite.SyncService.ProcessSyncBatch(ctx, req)
		require.NoError(t, err)
		assert.Equal(t, 1, result2.SuccessCount)
		serverTxID2 := result2.Successes[0].ServerTxID

		// Same server transaction ID should be returned
		assert.Equal(t, serverTxID1, serverTxID2)

		// Balance should not have changed
		var walletAfterSecond wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&walletAfterSecond).Error
		require.NoError(t, err)
		assert.Equal(t, int64(4000), walletAfterSecond.Balance)
	})

	t.Run("Batch with duplicate local IDs is deduplicated", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Create same transaction twice in single batch
		localID := uuid.New().String()
		timestamp := time.Now().Add(-2 * time.Minute)
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

		// Submit first batch
		req1 := sync.SubmitBatchRequest{
			DeviceID:     "device-009",
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		result1, err := suite.SyncService.ProcessSyncBatch(ctx, req1)
		require.NoError(t, err)
		assert.Equal(t, 1, result1.SuccessCount)

		// Submit same transaction again
		req2 := sync.SubmitBatchRequest{
			DeviceID:     "device-009",
			FestivalID:   testFestival.ID,
			Transactions: []sync.OfflineTransaction{offlineTx},
		}

		result2, err := suite.SyncService.ProcessSyncBatch(ctx, req2)
		require.NoError(t, err)
		// Should succeed but transaction was already processed
		assert.Equal(t, 1, result2.SuccessCount)

		// Balance only debited once
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(4500), updatedWallet.Balance) // 5000 - 500
	})
}

// ============================================================================
// Partial Sync Failure Recovery Tests
// ============================================================================

func TestPartialSyncFailureRecovery(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Batch with mixed success and failures", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 2000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		now := time.Now()
		transactions := []sync.OfflineTransaction{}

		// Valid transaction 1
		tx1ID := uuid.New().String()
		tx1Sig := suite.SyncService.GenerateOfflineSignature(
			tx1ID, testWallet.ID, 500, sync.TransactionTypePurchase, now.Add(-3*time.Minute),
		)
		transactions = append(transactions, sync.OfflineTransaction{
			LocalID:   tx1ID,
			Type:      sync.TransactionTypePurchase,
			Amount:    500,
			WalletID:  testWallet.ID,
			StaffID:   staff.ID,
			Signature: tx1Sig,
			Timestamp: now.Add(-3 * time.Minute),
		})

		// Transaction with invalid signature
		tx2ID := uuid.New().String()
		transactions = append(transactions, sync.OfflineTransaction{
			LocalID:   tx2ID,
			Type:      sync.TransactionTypePurchase,
			Amount:    500,
			WalletID:  testWallet.ID,
			StaffID:   staff.ID,
			Signature: "invalid-signature",
			Timestamp: now.Add(-2 * time.Minute),
		})

		// Valid transaction 2
		tx3ID := uuid.New().String()
		tx3Sig := suite.SyncService.GenerateOfflineSignature(
			tx3ID, testWallet.ID, 500, sync.TransactionTypePurchase, now.Add(-1*time.Minute),
		)
		transactions = append(transactions, sync.OfflineTransaction{
			LocalID:   tx3ID,
			Type:      sync.TransactionTypePurchase,
			Amount:    500,
			WalletID:  testWallet.ID,
			StaffID:   staff.ID,
			Signature: tx3Sig,
			Timestamp: now.Add(-1 * time.Minute),
		})

		req := sync.SubmitBatchRequest{
			DeviceID:     "device-010",
			FestivalID:   testFestival.ID,
			Transactions: transactions,
		}

		// Execute
		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		// Assert
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusPartial, result.Status)
		assert.Equal(t, 3, result.TotalCount)
		assert.Equal(t, 2, result.SuccessCount)
		assert.Equal(t, 1, result.FailedCount)
		assert.Len(t, result.Conflicts, 1)
		assert.Contains(t, result.Conflicts[0].Reason, "invalid signature")

		// Verify only valid transactions were processed
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(1000), updatedWallet.Balance) // 2000 - 500 - 500
	})

	t.Run("Transaction too old is rejected", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		// Configure max batch age
		suite.SyncService.SetMaxBatchAge(1 * time.Hour)

		// Create old transaction (25 hours ago)
		localID := uuid.New().String()
		timestamp := time.Now().Add(-25 * time.Hour)
		signature := suite.SyncService.GenerateOfflineSignature(
			localID, testWallet.ID, 500, sync.TransactionTypePurchase, timestamp,
		)

		req := sync.SubmitBatchRequest{
			DeviceID:   "device-011",
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

		// Execute
		result, err := suite.SyncService.ProcessSyncBatch(ctx, req)

		// Assert
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusFailed, result.Status)
		assert.Equal(t, 1, result.FailedCount)
		assert.Contains(t, result.Conflicts[0].Reason, "too old")

		// Reset max batch age
		suite.SyncService.SetMaxBatchAge(24 * time.Hour)
	})

	t.Run("Recover from partial failure by retrying failed transactions", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 1500)
		staff := helpers.CreateTestStaff(t, suite.DB)

		now := time.Now()

		// First batch: one transaction that will fail due to insufficient balance
		failingTxID := uuid.New().String()
		failingSig := suite.SyncService.GenerateOfflineSignature(
			failingTxID, testWallet.ID, 2000, sync.TransactionTypePurchase, now.Add(-2*time.Minute),
		)

		req1 := sync.SubmitBatchRequest{
			DeviceID:   "device-012",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{
					LocalID:   failingTxID,
					Type:      sync.TransactionTypePurchase,
					Amount:    2000, // More than available (1500)
					WalletID:  testWallet.ID,
					StaffID:   staff.ID,
					Signature: failingSig,
					Timestamp: now.Add(-2 * time.Minute),
				},
			},
		}

		result1, err := suite.SyncService.ProcessSyncBatch(ctx, req1)
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusFailed, result1.Status)
		assert.Equal(t, 1, result1.FailedCount)

		// Top up wallet to allow the transaction to succeed
		topUpTxID := uuid.New().String()
		topUpSig := suite.SyncService.GenerateOfflineSignature(
			topUpTxID, testWallet.ID, 1000, sync.TransactionTypeTopUp, now.Add(-1*time.Minute),
		)

		req2 := sync.SubmitBatchRequest{
			DeviceID:   "device-012",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{
					LocalID:   topUpTxID,
					Type:      sync.TransactionTypeTopUp,
					Amount:    1000,
					WalletID:  testWallet.ID,
					StaffID:   staff.ID,
					Signature: topUpSig,
					Timestamp: now.Add(-1 * time.Minute),
				},
			},
		}

		result2, err := suite.SyncService.ProcessSyncBatch(ctx, req2)
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result2.Status)

		// Balance should now be 2500
		var updatedWallet wallet.Wallet
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(2500), updatedWallet.Balance) // 1500 + 1000

		// Retry the failed transaction with a new local ID
		retryTxID := uuid.New().String()
		retrySig := suite.SyncService.GenerateOfflineSignature(
			retryTxID, testWallet.ID, 2000, sync.TransactionTypePurchase, now,
		)

		req3 := sync.SubmitBatchRequest{
			DeviceID:   "device-012",
			FestivalID: testFestival.ID,
			Transactions: []sync.OfflineTransaction{
				{
					LocalID:   retryTxID,
					Type:      sync.TransactionTypePurchase,
					Amount:    2000,
					WalletID:  testWallet.ID,
					StaffID:   staff.ID,
					Signature: retrySig,
					Timestamp: now,
				},
			},
		}

		result3, err := suite.SyncService.ProcessSyncBatch(ctx, req3)
		require.NoError(t, err)
		assert.Equal(t, sync.SyncStatusCompleted, result3.Status)
		assert.Equal(t, 1, result3.SuccessCount)

		// Final balance should be 500
		err = suite.DB.Where("id = ?", testWallet.ID).First(&updatedWallet).Error
		require.NoError(t, err)
		assert.Equal(t, int64(500), updatedWallet.Balance) // 2500 - 2000
	})
}

// ============================================================================
// Pending Batches Tests
// ============================================================================

func TestPendingBatches(t *testing.T) {
	suite := SetupSyncTestSuite(t)
	defer suite.CleanupSyncDatabase(t)

	ctx := context.Background()

	t.Run("Get pending batches for device", func(t *testing.T) {
		// Setup
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		testFestival := helpers.CreateActiveFestival(t, suite.DB, &testUser.ID)
		testWallet := helpers.CreateTestWalletWithBalance(t, suite.DB, testUser.ID, testFestival.ID, 5000)
		staff := helpers.CreateTestStaff(t, suite.DB)

		deviceID := "device-013"

		// Create and process a batch
		localID := uuid.New().String()
		timestamp := time.Now().Add(-1 * time.Minute)
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

		_, err := suite.SyncService.ProcessSyncBatch(ctx, req)
		require.NoError(t, err)

		// Get pending batches (should be empty since all processed)
		pendingBatches, err := suite.SyncService.GetPendingBatches(ctx, deviceID)
		require.NoError(t, err)
		assert.Empty(t, pendingBatches) // All batches were processed immediately
	})
}
