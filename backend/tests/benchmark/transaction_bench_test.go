package benchmark

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

// Transaction represents a wallet transaction for benchmarking
type Transaction struct {
	ID            uuid.UUID       `json:"id"`
	WalletID      uuid.UUID       `json:"wallet_id"`
	Type          string          `json:"type"`
	Amount        int64           `json:"amount"`
	BalanceBefore int64           `json:"balance_before"`
	BalanceAfter  int64           `json:"balance_after"`
	Reference     string          `json:"reference,omitempty"`
	StandID       *uuid.UUID      `json:"stand_id,omitempty"`
	StaffID       *uuid.UUID      `json:"staff_id,omitempty"`
	Metadata      TransactionMeta `json:"metadata"`
	Status        string          `json:"status"`
	CreatedAt     time.Time       `json:"created_at"`
}

// TransactionMeta holds additional transaction metadata
type TransactionMeta struct {
	ProductIDs    []uuid.UUID `json:"product_ids,omitempty"`
	PaymentMethod string      `json:"payment_method,omitempty"`
	Description   string      `json:"description,omitempty"`
}

// MockTransactionRepository provides a mock repository for benchmarking
type MockTransactionRepository struct {
	mu           sync.RWMutex
	transactions map[uuid.UUID]*Transaction
	walletTxs    map[uuid.UUID][]*Transaction
}

func NewMockTransactionRepository() *MockTransactionRepository {
	return &MockTransactionRepository{
		transactions: make(map[uuid.UUID]*Transaction),
		walletTxs:    make(map[uuid.UUID][]*Transaction),
	}
}

func (r *MockTransactionRepository) Create(ctx context.Context, tx *Transaction) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.transactions[tx.ID] = tx
	r.walletTxs[tx.WalletID] = append(r.walletTxs[tx.WalletID], tx)
	return nil
}

func (r *MockTransactionRepository) GetByID(ctx context.Context, id uuid.UUID) (*Transaction, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.transactions[id], nil
}

func (r *MockTransactionRepository) GetByWallet(ctx context.Context, walletID uuid.UUID, offset, limit int) ([]*Transaction, int64, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	txs := r.walletTxs[walletID]
	total := int64(len(txs))

	if offset >= len(txs) {
		return nil, total, nil
	}

	end := offset + limit
	if end > len(txs) {
		end = len(txs)
	}

	return txs[offset:end], total, nil
}

func (r *MockTransactionRepository) BulkCreate(ctx context.Context, txs []*Transaction) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, tx := range txs {
		r.transactions[tx.ID] = tx
		r.walletTxs[tx.WalletID] = append(r.walletTxs[tx.WalletID], tx)
	}
	return nil
}

// BenchmarkTransactionCreate benchmarks transaction creation
func BenchmarkTransactionCreate(b *testing.B) {
	repo := NewMockTransactionRepository()
	ctx := context.Background()
	walletID := uuid.New()
	standID := uuid.New()
	staffID := uuid.New()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tx := &Transaction{
			ID:            uuid.New(),
			WalletID:      walletID,
			Type:          "purchase",
			Amount:        -500,
			BalanceBefore: 10000,
			BalanceAfter:  9500,
			StandID:       &standID,
			StaffID:       &staffID,
			Metadata: TransactionMeta{
				ProductIDs: []uuid.UUID{uuid.New(), uuid.New()},
			},
			Status:    "completed",
			CreatedAt: time.Now(),
		}
		repo.Create(ctx, tx)
	}
}

// BenchmarkTransactionGet benchmarks transaction retrieval
func BenchmarkTransactionGet(b *testing.B) {
	repo := NewMockTransactionRepository()
	ctx := context.Background()

	// Pre-populate transactions
	txIDs := make([]uuid.UUID, 1000)
	walletID := uuid.New()

	for i := 0; i < 1000; i++ {
		tx := &Transaction{
			ID:            uuid.New(),
			WalletID:      walletID,
			Type:          "purchase",
			Amount:        -500,
			BalanceBefore: int64(10000 - i*500),
			BalanceAfter:  int64(10000 - (i+1)*500),
			Status:        "completed",
			CreatedAt:     time.Now(),
		}
		repo.Create(ctx, tx)
		txIDs[i] = tx.ID
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		idx := i % len(txIDs)
		repo.GetByID(ctx, txIDs[idx])
	}
}

// BenchmarkTransactionList benchmarks listing transactions
func BenchmarkTransactionList(b *testing.B) {
	repo := NewMockTransactionRepository()
	ctx := context.Background()
	walletID := uuid.New()

	// Pre-populate transactions
	for i := 0; i < 1000; i++ {
		tx := &Transaction{
			ID:            uuid.New(),
			WalletID:      walletID,
			Type:          "purchase",
			Amount:        -500,
			BalanceBefore: int64(10000 - i*500),
			BalanceAfter:  int64(10000 - (i+1)*500),
			Status:        "completed",
			CreatedAt:     time.Now().Add(-time.Duration(i) * time.Minute),
		}
		repo.Create(ctx, tx)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		repo.GetByWallet(ctx, walletID, 0, 20)
	}
}

// BenchmarkTransactionListPaginated benchmarks paginated transaction listing
func BenchmarkTransactionListPaginated(b *testing.B) {
	repo := NewMockTransactionRepository()
	ctx := context.Background()
	walletID := uuid.New()

	// Pre-populate transactions
	for i := 0; i < 10000; i++ {
		tx := &Transaction{
			ID:            uuid.New(),
			WalletID:      walletID,
			Type:          "purchase",
			Amount:        -500,
			BalanceBefore: int64(1000000 - i*500),
			BalanceAfter:  int64(1000000 - (i+1)*500),
			Status:        "completed",
			CreatedAt:     time.Now().Add(-time.Duration(i) * time.Minute),
		}
		repo.Create(ctx, tx)
	}

	pages := []int{1, 10, 50, 100, 500}

	for _, page := range pages {
		b.Run("page_"+string(rune(page)), func(b *testing.B) {
			offset := (page - 1) * 20
			for i := 0; i < b.N; i++ {
				repo.GetByWallet(ctx, walletID, offset, 20)
			}
		})
	}
}

// BenchmarkBatchTransactionCreate benchmarks bulk transaction creation
func BenchmarkBatchTransactionCreate(b *testing.B) {
	ctx := context.Background()
	walletID := uuid.New()

	batchSizes := []int{10, 50, 100, 500, 1000}

	for _, size := range batchSizes {
		b.Run("batch_"+string(rune(size)), func(b *testing.B) {
			repo := NewMockTransactionRepository()

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				txs := make([]*Transaction, size)
				for j := 0; j < size; j++ {
					txs[j] = &Transaction{
						ID:            uuid.New(),
						WalletID:      walletID,
						Type:          "purchase",
						Amount:        -500,
						BalanceBefore: 10000,
						BalanceAfter:  9500,
						Status:        "completed",
						CreatedAt:     time.Now(),
					}
				}
				repo.BulkCreate(ctx, txs)
			}
		})
	}
}

// BenchmarkTransactionJSON benchmarks transaction JSON serialization
func BenchmarkTransactionJSON(b *testing.B) {
	standID := uuid.New()
	staffID := uuid.New()
	tx := &Transaction{
		ID:            uuid.New(),
		WalletID:      uuid.New(),
		Type:          "purchase",
		Amount:        -1500,
		BalanceBefore: 10000,
		BalanceAfter:  8500,
		StandID:       &standID,
		StaffID:       &staffID,
		Metadata: TransactionMeta{
			ProductIDs:    []uuid.UUID{uuid.New(), uuid.New(), uuid.New()},
			PaymentMethod: "wallet",
			Description:   "Food and beverage purchase",
		},
		Status:    "completed",
		CreatedAt: time.Now(),
	}

	b.Run("Marshal", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			json.Marshal(tx)
		}
	})

	data, _ := json.Marshal(tx)

	b.Run("Unmarshal", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			var t Transaction
			json.Unmarshal(data, &t)
		}
	})
}

// BenchmarkTransactionListJSON benchmarks transaction list JSON serialization
func BenchmarkTransactionListJSON(b *testing.B) {
	txs := make([]*Transaction, 100)
	for i := 0; i < 100; i++ {
		txs[i] = &Transaction{
			ID:            uuid.New(),
			WalletID:      uuid.New(),
			Type:          "purchase",
			Amount:        -500,
			BalanceBefore: 10000,
			BalanceAfter:  9500,
			Metadata: TransactionMeta{
				ProductIDs: []uuid.UUID{uuid.New()},
			},
			Status:    "completed",
			CreatedAt: time.Now(),
		}
	}

	b.Run("Marshal100", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			json.Marshal(txs)
		}
	})

	data, _ := json.Marshal(txs)

	b.Run("Unmarshal100", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			var t []*Transaction
			json.Unmarshal(data, &t)
		}
	})
}

// BenchmarkTransactionRefund benchmarks refund processing
func BenchmarkTransactionRefund(b *testing.B) {
	repo := NewMockTransactionRepository()
	ctx := context.Background()
	walletID := uuid.New()
	staffID := uuid.New()

	// Create original transactions to refund
	origTxs := make([]*Transaction, 1000)
	for i := 0; i < 1000; i++ {
		tx := &Transaction{
			ID:            uuid.New(),
			WalletID:      walletID,
			Type:          "purchase",
			Amount:        -500,
			BalanceBefore: 10000,
			BalanceAfter:  9500,
			Status:        "completed",
			CreatedAt:     time.Now(),
		}
		repo.Create(ctx, tx)
		origTxs[i] = tx
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		idx := i % len(origTxs)
		origTx := origTxs[idx]

		refundTx := &Transaction{
			ID:            uuid.New(),
			WalletID:      walletID,
			Type:          "refund",
			Amount:        -origTx.Amount, // Reverse the amount
			BalanceBefore: 9500,
			BalanceAfter:  10000,
			Reference:     origTx.ID.String(),
			StaffID:       &staffID,
			Metadata: TransactionMeta{
				Description: "Refund for transaction",
			},
			Status:    "completed",
			CreatedAt: time.Now(),
		}
		repo.Create(ctx, refundTx)
	}
}

// BenchmarkTransactionConcurrent benchmarks concurrent transaction creation
func BenchmarkTransactionConcurrent(b *testing.B) {
	repo := NewMockTransactionRepository()
	ctx := context.Background()
	walletID := uuid.New()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			tx := &Transaction{
				ID:            uuid.New(),
				WalletID:      walletID,
				Type:          "purchase",
				Amount:        -500,
				BalanceBefore: 10000,
				BalanceAfter:  9500,
				Status:        "completed",
				CreatedAt:     time.Now(),
			}
			repo.Create(ctx, tx)
		}
	})
}

// BenchmarkTransactionAggregation benchmarks transaction aggregation
func BenchmarkTransactionAggregation(b *testing.B) {
	repo := NewMockTransactionRepository()
	ctx := context.Background()
	walletID := uuid.New()

	// Pre-populate transactions
	for i := 0; i < 10000; i++ {
		txType := "purchase"
		amount := int64(-500)
		if i%10 == 0 {
			txType = "topup"
			amount = 5000
		}
		tx := &Transaction{
			ID:        uuid.New(),
			WalletID:  walletID,
			Type:      txType,
			Amount:    amount,
			Status:    "completed",
			CreatedAt: time.Now().Add(-time.Duration(i) * time.Minute),
		}
		repo.Create(ctx, tx)
	}

	b.Run("SumAmounts", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			txs, _, _ := repo.GetByWallet(ctx, walletID, 0, 10000)
			var total int64
			for _, tx := range txs {
				total += tx.Amount
			}
			_ = total
		}
	})

	b.Run("CountByType", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			txs, _, _ := repo.GetByWallet(ctx, walletID, 0, 10000)
			counts := make(map[string]int)
			for _, tx := range txs {
				counts[tx.Type]++
			}
			_ = counts
		}
	})
}
