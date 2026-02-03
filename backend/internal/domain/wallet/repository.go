package wallet

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// Default query timeout for wallet operations
const defaultQueryTimeout = 10 * time.Second

type Repository interface {
	// Wallet operations
	CreateWallet(ctx context.Context, wallet *Wallet) error
	GetWalletByID(ctx context.Context, id uuid.UUID) (*Wallet, error)
	GetWalletByUserAndFestival(ctx context.Context, userID, festivalID uuid.UUID) (*Wallet, error)
	GetWalletsByUser(ctx context.Context, userID uuid.UUID) ([]Wallet, error)
	GetWalletsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Wallet, int64, error)
	UpdateWallet(ctx context.Context, wallet *Wallet) error

	// Transaction operations
	CreateTransaction(ctx context.Context, tx *Transaction) error
	CreateTransactionsBatch(ctx context.Context, txs []Transaction) error
	GetTransactionByID(ctx context.Context, id uuid.UUID) (*Transaction, error)
	GetTransactionsByWallet(ctx context.Context, walletID uuid.UUID, offset, limit int) ([]Transaction, int64, error)
	GetTransactionsByWalletWithDateRange(ctx context.Context, walletID uuid.UUID, start, end time.Time, offset, limit int) ([]Transaction, int64, error)
	GetTransactionsByStand(ctx context.Context, standID uuid.UUID, start, end time.Time, offset, limit int) ([]Transaction, int64, error)
	UpdateTransaction(ctx context.Context, tx *Transaction) error

	// Atomic operations
	ProcessPayment(ctx context.Context, walletID uuid.UUID, amount int64, txData *Transaction) error
	ProcessPaymentWithRetry(ctx context.Context, walletID uuid.UUID, amount int64, txData *Transaction, maxRetries int) error
	TopUpAtomic(ctx context.Context, walletID uuid.UUID, amount int64, txData *Transaction) error
	RefundAtomic(ctx context.Context, walletID uuid.UUID, amount int64, refundTx *Transaction, originalTxID uuid.UUID) error

	// Aggregation operations
	GetWalletStats(ctx context.Context, festivalID uuid.UUID) (*WalletStats, error)
	GetTransactionSummary(ctx context.Context, walletID uuid.UUID, start, end time.Time) (*TransactionSummary, error)
}

// WalletStats contains aggregated wallet statistics
type WalletStats struct {
	TotalWallets   int64   `json:"total_wallets"`
	ActiveWallets  int64   `json:"active_wallets"`
	TotalBalance   int64   `json:"total_balance"`
	AverageBalance float64 `json:"average_balance"`
}

// TransactionSummary contains aggregated transaction statistics
type TransactionSummary struct {
	TotalTransactions int64 `json:"total_transactions"`
	TotalCredits      int64 `json:"total_credits"`
	TotalDebits       int64 `json:"total_debits"`
	NetAmount         int64 `json:"net_amount"`
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// withTimeout creates a context with the default query timeout
func (r *repository) withTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, defaultQueryTimeout)
}

// setQueryTimeout sets a statement timeout for the query
func (r *repository) setQueryTimeout(db *gorm.DB, timeout time.Duration) *gorm.DB {
	return db.Exec(fmt.Sprintf("SET LOCAL statement_timeout = '%dms'", timeout.Milliseconds()))
}

func (r *repository) CreateWallet(ctx context.Context, wallet *Wallet) error {
	return r.db.WithContext(ctx).Create(wallet).Error
}

func (r *repository) GetWalletByID(ctx context.Context, id uuid.UUID) (*Wallet, error) {
	var wallet Wallet
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&wallet).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get wallet: %w", err)
	}
	return &wallet, nil
}

func (r *repository) GetWalletByUserAndFestival(ctx context.Context, userID, festivalID uuid.UUID) (*Wallet, error) {
	var wallet Wallet
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND festival_id = ?", userID, festivalID).
		First(&wallet).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get wallet: %w", err)
	}
	return &wallet, nil
}

func (r *repository) GetWalletsByUser(ctx context.Context, userID uuid.UUID) ([]Wallet, error) {
	var wallets []Wallet
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&wallets).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get wallets: %w", err)
	}
	return wallets, nil
}

func (r *repository) UpdateWallet(ctx context.Context, wallet *Wallet) error {
	return r.db.WithContext(ctx).Save(wallet).Error
}

func (r *repository) CreateTransaction(ctx context.Context, tx *Transaction) error {
	return r.db.WithContext(ctx).Create(tx).Error
}

func (r *repository) GetTransactionByID(ctx context.Context, id uuid.UUID) (*Transaction, error) {
	var tx Transaction
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&tx).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get transaction: %w", err)
	}
	return &tx, nil
}

func (r *repository) GetTransactionsByWallet(ctx context.Context, walletID uuid.UUID, offset, limit int) ([]Transaction, int64, error) {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	var transactions []Transaction
	var total int64

	// Use optimized counting with index hint
	// The idx_transactions_wallet_created index will be used
	countQuery := r.db.WithContext(ctx).Model(&Transaction{}).Where("wallet_id = ?", walletID)
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count transactions: %w", err)
	}

	// Fetch data using the composite index (wallet_id, created_at DESC)
	if err := r.db.WithContext(ctx).
		Where("wallet_id = ?", walletID).
		Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&transactions).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list transactions: %w", err)
	}

	return transactions, total, nil
}

// GetTransactionsByWalletWithDateRange returns transactions within a date range
// Uses the composite index idx_transactions_wallet_created_at for optimal performance
func (r *repository) GetTransactionsByWalletWithDateRange(ctx context.Context, walletID uuid.UUID, start, end time.Time, offset, limit int) ([]Transaction, int64, error) {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	var transactions []Transaction
	var total int64

	query := r.db.WithContext(ctx).Model(&Transaction{}).
		Where("wallet_id = ? AND created_at >= ? AND created_at < ?", walletID, start, end)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count transactions: %w", err)
	}

	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&transactions).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list transactions: %w", err)
	}

	return transactions, total, nil
}

// GetTransactionsByStand returns transactions for a stand within a date range
// Uses the composite index idx_transactions_stand_created_at for optimal performance
func (r *repository) GetTransactionsByStand(ctx context.Context, standID uuid.UUID, start, end time.Time, offset, limit int) ([]Transaction, int64, error) {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	var transactions []Transaction
	var total int64

	query := r.db.WithContext(ctx).Model(&Transaction{}).
		Where("stand_id = ? AND created_at >= ? AND created_at < ?", standID, start, end)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count transactions: %w", err)
	}

	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&transactions).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list transactions: %w", err)
	}

	return transactions, total, nil
}

func (r *repository) UpdateTransaction(ctx context.Context, tx *Transaction) error {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()
	return r.db.WithContext(ctx).Save(tx).Error
}

// CreateTransactionsBatch creates multiple transactions in a single batch
// Optimized for bulk inserts using GORM's CreateInBatches
func (r *repository) CreateTransactionsBatch(ctx context.Context, txs []Transaction) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second) // Longer timeout for batch
	defer cancel()

	// Batch size of 100 for optimal performance
	return r.db.WithContext(ctx).CreateInBatches(&txs, 100).Error
}

// GetWalletsByFestival returns paginated wallets for a festival
// Uses the idx_wallets_festival_status index
func (r *repository) GetWalletsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Wallet, int64, error) {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	var wallets []Wallet
	var total int64

	query := r.db.WithContext(ctx).Model(&Wallet{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count wallets: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&wallets).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list wallets: %w", err)
	}

	return wallets, total, nil
}

// GetWalletStats returns aggregated wallet statistics for a festival
// Optimized aggregation query using the idx_wallets_festival_status index
func (r *repository) GetWalletStats(ctx context.Context, festivalID uuid.UUID) (*WalletStats, error) {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	var stats WalletStats

	// Single optimized aggregation query
	err := r.db.WithContext(ctx).Model(&Wallet{}).
		Select(`
			COUNT(*) as total_wallets,
			COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_wallets,
			COALESCE(SUM(balance), 0) as total_balance,
			COALESCE(AVG(balance), 0) as average_balance
		`).
		Where("festival_id = ?", festivalID).
		Scan(&stats).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get wallet stats: %w", err)
	}

	return &stats, nil
}

// GetTransactionSummary returns aggregated transaction statistics for a wallet
func (r *repository) GetTransactionSummary(ctx context.Context, walletID uuid.UUID, start, end time.Time) (*TransactionSummary, error) {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	var summary TransactionSummary

	err := r.db.WithContext(ctx).Model(&Transaction{}).
		Select(`
			COUNT(*) as total_transactions,
			COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_credits,
			COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_debits,
			COALESCE(SUM(amount), 0) as net_amount
		`).
		Where("wallet_id = ? AND created_at >= ? AND created_at < ?", walletID, start, end).
		Scan(&summary).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get transaction summary: %w", err)
	}

	return &summary, nil
}

// ProcessPayment atomically processes a payment (debit from wallet)
func (r *repository) ProcessPayment(ctx context.Context, walletID uuid.UUID, amount int64, txData *Transaction) error {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	return r.db.WithContext(ctx).Transaction(func(dbTx *gorm.DB) error {
		// Lock the wallet row for update using SKIP LOCKED for better concurrency
		var wallet Wallet
		if err := dbTx.Raw("SELECT * FROM wallets WHERE id = ? FOR UPDATE", walletID).
			Scan(&wallet).Error; err != nil {
			return fmt.Errorf("failed to lock wallet: %w", err)
		}

		// Check if wallet was found
		if wallet.ID == uuid.Nil {
			return fmt.Errorf("wallet not found")
		}

		// Check sufficient balance
		if wallet.Balance < amount {
			return fmt.Errorf("insufficient balance")
		}

		// Check wallet status
		if wallet.Status != WalletStatusActive {
			return fmt.Errorf("wallet is not active")
		}

		// Update balance using optimistic update
		newBalance := wallet.Balance - amount
		result := dbTx.Model(&Wallet{}).
			Where("id = ? AND balance = ?", walletID, wallet.Balance).
			Update("balance", newBalance)

		if result.Error != nil {
			return fmt.Errorf("failed to update balance: %w", result.Error)
		}

		if result.RowsAffected == 0 {
			return fmt.Errorf("concurrent modification detected, please retry")
		}

		// Set transaction balances
		txData.BalanceBefore = wallet.Balance
		txData.BalanceAfter = newBalance
		txData.Amount = -amount // Negative for debit

		// Create transaction record
		if err := dbTx.Create(txData).Error; err != nil {
			return fmt.Errorf("failed to create transaction: %w", err)
		}

		return nil
	})
}

// TopUpAtomic atomically adds funds to a wallet
func (r *repository) TopUpAtomic(ctx context.Context, walletID uuid.UUID, amount int64, txData *Transaction) error {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	return r.db.WithContext(ctx).Transaction(func(dbTx *gorm.DB) error {
		// Lock the wallet row for update
		var wallet Wallet
		if err := dbTx.Raw("SELECT * FROM wallets WHERE id = ? FOR UPDATE", walletID).
			Scan(&wallet).Error; err != nil {
			return fmt.Errorf("failed to lock wallet: %w", err)
		}

		// Check if wallet was found
		if wallet.ID == uuid.Nil {
			return fmt.Errorf("wallet not found")
		}

		// Check wallet status
		if wallet.Status != WalletStatusActive {
			return fmt.Errorf("wallet is not active")
		}

		// Calculate new balance
		newBalance := wallet.Balance + amount

		// Set transaction balances
		txData.BalanceBefore = wallet.Balance
		txData.BalanceAfter = newBalance

		// Update wallet balance
		result := dbTx.Model(&Wallet{}).
			Where("id = ? AND balance = ?", walletID, wallet.Balance).
			Updates(map[string]interface{}{
				"balance":    newBalance,
				"updated_at": time.Now(),
			})

		if result.Error != nil {
			return fmt.Errorf("failed to update balance: %w", result.Error)
		}

		if result.RowsAffected == 0 {
			return fmt.Errorf("concurrent modification detected, please retry")
		}

		// Create transaction record
		if err := dbTx.Create(txData).Error; err != nil {
			return fmt.Errorf("failed to create transaction: %w", err)
		}

		return nil
	})
}

// RefundAtomic atomically processes a refund
func (r *repository) RefundAtomic(ctx context.Context, walletID uuid.UUID, amount int64, refundTx *Transaction, originalTxID uuid.UUID) error {
	ctx, cancel := r.withTimeout(ctx)
	defer cancel()

	return r.db.WithContext(ctx).Transaction(func(dbTx *gorm.DB) error {
		// Lock the wallet row for update
		var wallet Wallet
		if err := dbTx.Raw("SELECT * FROM wallets WHERE id = ? FOR UPDATE", walletID).
			Scan(&wallet).Error; err != nil {
			return fmt.Errorf("failed to lock wallet: %w", err)
		}

		// Check if wallet was found
		if wallet.ID == uuid.Nil {
			return fmt.Errorf("wallet not found")
		}

		// Calculate new balance
		newBalance := wallet.Balance + amount

		// Set transaction balances
		refundTx.BalanceBefore = wallet.Balance
		refundTx.BalanceAfter = newBalance

		// Update wallet balance
		result := dbTx.Model(&Wallet{}).
			Where("id = ? AND balance = ?", walletID, wallet.Balance).
			Updates(map[string]interface{}{
				"balance":    newBalance,
				"updated_at": time.Now(),
			})

		if result.Error != nil {
			return fmt.Errorf("failed to update balance: %w", result.Error)
		}

		if result.RowsAffected == 0 {
			return fmt.Errorf("concurrent modification detected, please retry")
		}

		// Create refund transaction record
		if err := dbTx.Create(refundTx).Error; err != nil {
			return fmt.Errorf("failed to create refund transaction: %w", err)
		}

		// Mark original transaction as refunded
		if err := dbTx.Model(&Transaction{}).
			Where("id = ?", originalTxID).
			Update("status", TransactionStatusRefunded).Error; err != nil {
			return fmt.Errorf("failed to update original transaction: %w", err)
		}

		return nil
	})
}

// ProcessPaymentWithRetry processes a payment with automatic retry on deadlock
func (r *repository) ProcessPaymentWithRetry(ctx context.Context, walletID uuid.UUID, amount int64, txData *Transaction, maxRetries int) error {
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		err := r.ProcessPayment(ctx, walletID, amount, txData)
		if err == nil {
			return nil
		}

		lastErr = err

		// Check if error is retryable (deadlock or serialization failure)
		errStr := err.Error()
		if !isRetryableError(errStr) {
			return err
		}

		log.Warn().
			Err(err).
			Int("attempt", i+1).
			Int("max_retries", maxRetries).
			Str("wallet_id", walletID.String()).
			Msg("Payment processing failed with retryable error, retrying")

		// Exponential backoff
		time.Sleep(time.Duration(1<<uint(i)) * 10 * time.Millisecond)
	}

	return fmt.Errorf("payment processing failed after %d retries: %w", maxRetries, lastErr)
}

// isRetryableError checks if the error is retryable (deadlock or serialization failure)
func isRetryableError(errStr string) bool {
	retryablePatterns := []string{
		"deadlock",
		"40001", // serialization_failure
		"40P01", // deadlock_detected
		"concurrent modification",
	}

	for _, pattern := range retryablePatterns {
		if containsString(errStr, pattern) {
			return true
		}
	}
	return false
}

func containsString(s, substr string) bool {
	return len(s) >= len(substr) && findSubstring(s, substr)
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
