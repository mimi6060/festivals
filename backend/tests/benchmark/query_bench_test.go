package benchmark

import (
	"bytes"
	"context"
	"encoding/json"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

// MockDatabase simulates database operations for benchmarking
type MockDatabase struct {
	mu       sync.RWMutex
	wallets  map[uuid.UUID]*Wallet
	users    map[uuid.UUID][]*Wallet
	txByID   map[uuid.UUID]*Transaction
	txByWallet map[uuid.UUID][]*Transaction
}

func NewMockDatabase() *MockDatabase {
	return &MockDatabase{
		wallets:  make(map[uuid.UUID]*Wallet),
		users:    make(map[uuid.UUID][]*Wallet),
		txByID:   make(map[uuid.UUID]*Transaction),
		txByWallet: make(map[uuid.UUID][]*Transaction),
	}
}

func (db *MockDatabase) InsertWallet(wallet *Wallet) {
	db.mu.Lock()
	defer db.mu.Unlock()
	db.wallets[wallet.ID] = wallet
	db.users[wallet.UserID] = append(db.users[wallet.UserID], wallet)
}

func (db *MockDatabase) InsertTransaction(tx *Transaction) {
	db.mu.Lock()
	defer db.mu.Unlock()
	db.txByID[tx.ID] = tx
	db.txByWallet[tx.WalletID] = append(db.txByWallet[tx.WalletID], tx)
}

func (db *MockDatabase) QueryWalletByID(id uuid.UUID) *Wallet {
	db.mu.RLock()
	defer db.mu.RUnlock()
	return db.wallets[id]
}

func (db *MockDatabase) QueryWalletsByUser(userID uuid.UUID) []*Wallet {
	db.mu.RLock()
	defer db.mu.RUnlock()
	return db.users[userID]
}

func (db *MockDatabase) QueryTransactionsByWallet(walletID uuid.UUID, offset, limit int) []*Transaction {
	db.mu.RLock()
	defer db.mu.RUnlock()

	txs := db.txByWallet[walletID]
	if offset >= len(txs) {
		return nil
	}

	end := offset + limit
	if end > len(txs) {
		end = len(txs)
	}

	return txs[offset:end]
}

func (db *MockDatabase) QueryTransactionsWithFilter(walletID uuid.UUID, txType string, minAmount, maxAmount int64) []*Transaction {
	db.mu.RLock()
	defer db.mu.RUnlock()

	var result []*Transaction
	for _, tx := range db.txByWallet[walletID] {
		if txType != "" && tx.Type != txType {
			continue
		}
		if tx.Amount < minAmount || tx.Amount > maxAmount {
			continue
		}
		result = append(result, tx)
	}
	return result
}

// BenchmarkQueryWalletByID benchmarks primary key lookup
func BenchmarkQueryWalletByID(b *testing.B) {
	db := NewMockDatabase()

	// Pre-populate
	walletIDs := make([]uuid.UUID, 10000)
	for i := 0; i < 10000; i++ {
		wallet := &Wallet{
			ID:         uuid.New(),
			UserID:     uuid.New(),
			FestivalID: uuid.New(),
			Balance:    10000,
			Status:     "active",
			CreatedAt:  time.Now(),
		}
		db.InsertWallet(wallet)
		walletIDs[i] = wallet.ID
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		idx := i % len(walletIDs)
		_ = db.QueryWalletByID(walletIDs[idx])
	}
}

// BenchmarkQueryWalletByUser benchmarks secondary index lookup
func BenchmarkQueryWalletByUser(b *testing.B) {
	db := NewMockDatabase()

	// Pre-populate with multiple wallets per user
	userIDs := make([]uuid.UUID, 1000)
	for i := 0; i < 1000; i++ {
		userID := uuid.New()
		userIDs[i] = userID

		// Each user has 5-10 wallets
		numWallets := 5 + (i % 6)
		for j := 0; j < numWallets; j++ {
			wallet := &Wallet{
				ID:         uuid.New(),
				UserID:     userID,
				FestivalID: uuid.New(),
				Balance:    10000,
				Status:     "active",
				CreatedAt:  time.Now(),
			}
			db.InsertWallet(wallet)
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		idx := i % len(userIDs)
		_ = db.QueryWalletsByUser(userIDs[idx])
	}
}

// BenchmarkQueryTransactions benchmarks transaction listing
func BenchmarkQueryTransactions(b *testing.B) {
	db := NewMockDatabase()
	walletID := uuid.New()

	wallet := &Wallet{
		ID:         walletID,
		UserID:     uuid.New(),
		FestivalID: uuid.New(),
		Balance:    10000,
		Status:     "active",
	}
	db.InsertWallet(wallet)

	// Create many transactions
	for i := 0; i < 10000; i++ {
		tx := &Transaction{
			ID:        uuid.New(),
			WalletID:  walletID,
			Type:      "purchase",
			Amount:    -500,
			Status:    "completed",
			CreatedAt: time.Now().Add(-time.Duration(i) * time.Minute),
		}
		db.InsertTransaction(tx)
	}

	pageSizes := []int{10, 20, 50, 100}

	for _, pageSize := range pageSizes {
		b.Run("limit_"+string(rune(pageSize)), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_ = db.QueryTransactionsByWallet(walletID, 0, pageSize)
			}
		})
	}
}

// BenchmarkQueryTransactionsFiltered benchmarks filtered queries
func BenchmarkQueryTransactionsFiltered(b *testing.B) {
	db := NewMockDatabase()
	walletID := uuid.New()

	wallet := &Wallet{
		ID:         walletID,
		UserID:     uuid.New(),
		FestivalID: uuid.New(),
		Balance:    10000,
		Status:     "active",
	}
	db.InsertWallet(wallet)

	// Create mixed transactions
	types := []string{"purchase", "topup", "refund", "cash_in"}
	for i := 0; i < 10000; i++ {
		tx := &Transaction{
			ID:        uuid.New(),
			WalletID:  walletID,
			Type:      types[i%len(types)],
			Amount:    int64(-1000 + (i % 2000)),
			Status:    "completed",
			CreatedAt: time.Now().Add(-time.Duration(i) * time.Minute),
		}
		db.InsertTransaction(tx)
	}

	b.Run("FilterByType", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_ = db.QueryTransactionsWithFilter(walletID, "purchase", -10000, 10000)
		}
	})

	b.Run("FilterByAmount", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_ = db.QueryTransactionsWithFilter(walletID, "", -500, 0)
		}
	})

	b.Run("FilterByBoth", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_ = db.QueryTransactionsWithFilter(walletID, "purchase", -1000, -100)
		}
	})
}

// BenchmarkQueryWithPreload benchmarks queries with related data
func BenchmarkQueryWithPreload(b *testing.B) {
	db := NewMockDatabase()

	// Pre-populate
	walletIDs := make([]uuid.UUID, 100)
	for i := 0; i < 100; i++ {
		walletID := uuid.New()
		walletIDs[i] = walletID

		wallet := &Wallet{
			ID:         walletID,
			UserID:     uuid.New(),
			FestivalID: uuid.New(),
			Balance:    10000,
			Status:     "active",
		}
		db.InsertWallet(wallet)

		// Add transactions
		for j := 0; j < 100; j++ {
			tx := &Transaction{
				ID:        uuid.New(),
				WalletID:  walletID,
				Type:      "purchase",
				Amount:    -500,
				Status:    "completed",
				CreatedAt: time.Now(),
			}
			db.InsertTransaction(tx)
		}
	}

	b.Run("WalletOnly", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			idx := i % len(walletIDs)
			_ = db.QueryWalletByID(walletIDs[idx])
		}
	})

	b.Run("WalletWithTransactions", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			idx := i % len(walletIDs)
			wallet := db.QueryWalletByID(walletIDs[idx])
			_ = db.QueryTransactionsByWallet(wallet.ID, 0, 10)
		}
	})
}

// BenchmarkBulkInsert benchmarks bulk insert operations
func BenchmarkBulkInsert(b *testing.B) {
	batchSizes := []int{1, 10, 50, 100, 500, 1000}
	walletID := uuid.New()

	for _, size := range batchSizes {
		b.Run("size_"+string(rune(size)), func(b *testing.B) {
			db := NewMockDatabase()

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				for j := 0; j < size; j++ {
					tx := &Transaction{
						ID:        uuid.New(),
						WalletID:  walletID,
						Type:      "purchase",
						Amount:    -500,
						Status:    "completed",
						CreatedAt: time.Now(),
					}
					db.InsertTransaction(tx)
				}
			}
		})
	}
}

// BenchmarkQuerySorting benchmarks sorting operations
func BenchmarkQuerySorting(b *testing.B) {
	// Create test data
	txs := make([]*Transaction, 1000)
	for i := 0; i < 1000; i++ {
		txs[i] = &Transaction{
			ID:        uuid.New(),
			WalletID:  uuid.New(),
			Type:      "purchase",
			Amount:    int64(-1000 + i),
			Status:    "completed",
			CreatedAt: time.Now().Add(-time.Duration(i) * time.Minute),
		}
	}

	b.Run("SortByCreatedAt", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			// Copy slice to avoid modifying original
			sorted := make([]*Transaction, len(txs))
			copy(sorted, txs)
			sort.Slice(sorted, func(i, j int) bool {
				return sorted[i].CreatedAt.After(sorted[j].CreatedAt)
			})
		}
	})

	b.Run("SortByAmount", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			sorted := make([]*Transaction, len(txs))
			copy(sorted, txs)
			sort.Slice(sorted, func(i, j int) bool {
				return sorted[i].Amount > sorted[j].Amount
			})
		}
	})
}

// BenchmarkQueryAggregation benchmarks aggregation operations
func BenchmarkQueryAggregation(b *testing.B) {
	db := NewMockDatabase()
	walletID := uuid.New()

	wallet := &Wallet{
		ID:         walletID,
		UserID:     uuid.New(),
		FestivalID: uuid.New(),
		Balance:    10000,
		Status:     "active",
	}
	db.InsertWallet(wallet)

	for i := 0; i < 10000; i++ {
		tx := &Transaction{
			ID:        uuid.New(),
			WalletID:  walletID,
			Type:      []string{"purchase", "topup", "refund"}[i%3],
			Amount:    int64(-1000 + (i % 2000)),
			Status:    "completed",
			CreatedAt: time.Now(),
		}
		db.InsertTransaction(tx)
	}

	b.Run("Sum", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			txs := db.QueryTransactionsByWallet(walletID, 0, 10000)
			var sum int64
			for _, tx := range txs {
				sum += tx.Amount
			}
			_ = sum
		}
	})

	b.Run("GroupByType", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			txs := db.QueryTransactionsByWallet(walletID, 0, 10000)
			groups := make(map[string]int64)
			for _, tx := range txs {
				groups[tx.Type] += tx.Amount
			}
			_ = groups
		}
	})

	b.Run("Count", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			txs := db.QueryTransactionsByWallet(walletID, 0, 10000)
			_ = len(txs)
		}
	})
}

// BenchmarkConcurrentQueries benchmarks concurrent query execution
func BenchmarkConcurrentQueries(b *testing.B) {
	db := NewMockDatabase()

	// Pre-populate
	walletIDs := make([]uuid.UUID, 100)
	for i := 0; i < 100; i++ {
		walletID := uuid.New()
		walletIDs[i] = walletID

		wallet := &Wallet{
			ID:         walletID,
			UserID:     uuid.New(),
			FestivalID: uuid.New(),
			Balance:    10000,
			Status:     "active",
		}
		db.InsertWallet(wallet)

		for j := 0; j < 100; j++ {
			tx := &Transaction{
				ID:        uuid.New(),
				WalletID:  walletID,
				Type:      "purchase",
				Amount:    -500,
				Status:    "completed",
				CreatedAt: time.Now(),
			}
			db.InsertTransaction(tx)
		}
	}

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			idx := i % len(walletIDs)
			wallet := db.QueryWalletByID(walletIDs[idx])
			_ = db.QueryTransactionsByWallet(wallet.ID, 0, 10)
			i++
		}
	})
}

// BenchmarkJSONResponse benchmarks JSON response serialization
func BenchmarkJSONResponse(b *testing.B) {
	wallet := &Wallet{
		ID:         uuid.New(),
		UserID:     uuid.New(),
		FestivalID: uuid.New(),
		Balance:    10000,
		Status:     "active",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	txs := make([]*Transaction, 20)
	for i := 0; i < 20; i++ {
		txs[i] = &Transaction{
			ID:            uuid.New(),
			WalletID:      wallet.ID,
			Type:          "purchase",
			Amount:        -500,
			BalanceBefore: 10000,
			BalanceAfter:  9500,
			Status:        "completed",
			CreatedAt:     time.Now(),
		}
	}

	response := struct {
		Wallet       *Wallet        `json:"wallet"`
		Transactions []*Transaction `json:"transactions"`
		Total        int64          `json:"total"`
		Page         int            `json:"page"`
		PerPage      int            `json:"per_page"`
	}{
		Wallet:       wallet,
		Transactions: txs,
		Total:        100,
		Page:         1,
		PerPage:      20,
	}

	b.Run("StandardMarshal", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			json.Marshal(response)
		}
	})

	b.Run("EncoderToBuffer", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			buf := &bytes.Buffer{}
			encoder := json.NewEncoder(buf)
			encoder.Encode(response)
		}
	})

	b.Run("PreallocatedBuffer", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			buf := bytes.NewBuffer(make([]byte, 0, 4096))
			encoder := json.NewEncoder(buf)
			encoder.Encode(response)
		}
	})
}

// BenchmarkStringOperations benchmarks common string operations
func BenchmarkStringOperations(b *testing.B) {
	ids := make([]uuid.UUID, 100)
	for i := range ids {
		ids[i] = uuid.New()
	}

	b.Run("UUIDToString", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			for _, id := range ids {
				_ = id.String()
			}
		}
	})

	b.Run("StringConcat", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			result := ""
			for _, id := range ids {
				result += id.String() + ","
			}
			_ = result
		}
	})

	b.Run("StringsBuilder", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			var sb strings.Builder
			for _, id := range ids {
				sb.WriteString(id.String())
				sb.WriteString(",")
			}
			_ = sb.String()
		}
	})

	b.Run("BytesBuffer", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			var buf bytes.Buffer
			for _, id := range ids {
				buf.WriteString(id.String())
				buf.WriteString(",")
			}
			_ = buf.String()
		}
	})
}

// BenchmarkContextOperations benchmarks context operations
func BenchmarkContextOperations(b *testing.B) {
	b.Run("Background", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_ = context.Background()
		}
	})

	b.Run("WithCancel", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			ctx, cancel := context.WithCancel(context.Background())
			cancel()
			_ = ctx
		}
	})

	b.Run("WithTimeout", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			cancel()
			_ = ctx
		}
	})

	b.Run("WithValue", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			ctx := context.WithValue(context.Background(), "key", "value")
			_ = ctx
		}
	})
}
