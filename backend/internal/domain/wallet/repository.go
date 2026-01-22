package wallet

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	// Wallet operations
	CreateWallet(ctx context.Context, wallet *Wallet) error
	GetWalletByID(ctx context.Context, id uuid.UUID) (*Wallet, error)
	GetWalletByUserAndFestival(ctx context.Context, userID, festivalID uuid.UUID) (*Wallet, error)
	GetWalletsByUser(ctx context.Context, userID uuid.UUID) ([]Wallet, error)
	UpdateWallet(ctx context.Context, wallet *Wallet) error

	// Transaction operations
	CreateTransaction(ctx context.Context, tx *Transaction) error
	GetTransactionByID(ctx context.Context, id uuid.UUID) (*Transaction, error)
	GetTransactionsByWallet(ctx context.Context, walletID uuid.UUID, offset, limit int) ([]Transaction, int64, error)
	UpdateTransaction(ctx context.Context, tx *Transaction) error

	// Atomic operations
	ProcessPayment(ctx context.Context, walletID uuid.UUID, amount int64, txData *Transaction) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
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
	var transactions []Transaction
	var total int64

	query := r.db.WithContext(ctx).Model(&Transaction{}).Where("wallet_id = ?", walletID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count transactions: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&transactions).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list transactions: %w", err)
	}

	return transactions, total, nil
}

func (r *repository) UpdateTransaction(ctx context.Context, tx *Transaction) error {
	return r.db.WithContext(ctx).Save(tx).Error
}

// ProcessPayment atomically processes a payment (debit from wallet)
func (r *repository) ProcessPayment(ctx context.Context, walletID uuid.UUID, amount int64, txData *Transaction) error {
	return r.db.WithContext(ctx).Transaction(func(dbTx *gorm.DB) error {
		// Lock the wallet row for update
		var wallet Wallet
		if err := dbTx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", walletID).
			First(&wallet).Error; err != nil {
			return fmt.Errorf("failed to lock wallet: %w", err)
		}

		// Check sufficient balance
		if wallet.Balance < amount {
			return fmt.Errorf("insufficient balance")
		}

		// Check wallet status
		if wallet.Status != WalletStatusActive {
			return fmt.Errorf("wallet is not active")
		}

		// Update balance
		newBalance := wallet.Balance - amount
		if err := dbTx.Model(&wallet).Update("balance", newBalance).Error; err != nil {
			return fmt.Errorf("failed to update balance: %w", err)
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
