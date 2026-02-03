package benchmark

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
)

// Wallet represents a wallet for benchmarking
type Wallet struct {
	ID         uuid.UUID `json:"id"`
	UserID     uuid.UUID `json:"user_id"`
	FestivalID uuid.UUID `json:"festival_id"`
	Balance    int64     `json:"balance"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// QRCodePayload represents the data encoded in a wallet QR code
type QRCodePayload struct {
	WalletID   uuid.UUID `json:"w"`
	FestivalID uuid.UUID `json:"f"`
	Timestamp  int64     `json:"t"`
	Signature  string    `json:"s"`
}

// MockWalletRepository provides a mock repository for benchmarking
type MockWalletRepository struct {
	wallets      map[uuid.UUID]*Wallet
	transactions map[uuid.UUID][]*Transaction
}

func NewMockWalletRepository() *MockWalletRepository {
	return &MockWalletRepository{
		wallets:      make(map[uuid.UUID]*Wallet),
		transactions: make(map[uuid.UUID][]*Transaction),
	}
}

func (r *MockWalletRepository) CreateWallet(ctx context.Context, wallet *Wallet) error {
	r.wallets[wallet.ID] = wallet
	return nil
}

func (r *MockWalletRepository) GetWalletByID(ctx context.Context, id uuid.UUID) (*Wallet, error) {
	if w, ok := r.wallets[id]; ok {
		return w, nil
	}
	return nil, nil
}

func (r *MockWalletRepository) UpdateWallet(ctx context.Context, wallet *Wallet) error {
	r.wallets[wallet.ID] = wallet
	return nil
}

// BenchmarkWalletCreate benchmarks wallet creation
func BenchmarkWalletCreate(b *testing.B) {
	repo := NewMockWalletRepository()
	ctx := context.Background()

	userID := uuid.New()
	festivalID := uuid.New()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		wallet := &Wallet{
			ID:         uuid.New(),
			UserID:     userID,
			FestivalID: festivalID,
			Balance:    0,
			Status:     "active",
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}
		repo.CreateWallet(ctx, wallet)
	}
}

// BenchmarkWalletGet benchmarks wallet retrieval
func BenchmarkWalletGet(b *testing.B) {
	repo := NewMockWalletRepository()
	ctx := context.Background()

	// Pre-populate wallets
	walletIDs := make([]uuid.UUID, 1000)
	for i := 0; i < 1000; i++ {
		wallet := &Wallet{
			ID:         uuid.New(),
			UserID:     uuid.New(),
			FestivalID: uuid.New(),
			Balance:    10000,
			Status:     "active",
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}
		repo.CreateWallet(ctx, wallet)
		walletIDs[i] = wallet.ID
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		idx := i % len(walletIDs)
		repo.GetWalletByID(ctx, walletIDs[idx])
	}
}

// BenchmarkWalletTopUp benchmarks wallet top-up operations
func BenchmarkWalletTopUp(b *testing.B) {
	repo := NewMockWalletRepository()
	ctx := context.Background()

	wallet := &Wallet{
		ID:         uuid.New(),
		UserID:     uuid.New(),
		FestivalID: uuid.New(),
		Balance:    0,
		Status:     "active",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	repo.CreateWallet(ctx, wallet)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w, _ := repo.GetWalletByID(ctx, wallet.ID)
		w.Balance += 1000
		w.UpdatedAt = time.Now()
		repo.UpdateWallet(ctx, w)
	}
}

// BenchmarkWalletBalance benchmarks balance lookup
func BenchmarkWalletBalance(b *testing.B) {
	repo := NewMockWalletRepository()
	ctx := context.Background()

	wallet := &Wallet{
		ID:         uuid.New(),
		UserID:     uuid.New(),
		FestivalID: uuid.New(),
		Balance:    10000,
		Status:     "active",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	repo.CreateWallet(ctx, wallet)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w, _ := repo.GetWalletByID(ctx, wallet.ID)
		_ = w.Balance
	}
}

// BenchmarkWalletQRGenerate benchmarks QR code payload generation
func BenchmarkWalletQRGenerate(b *testing.B) {
	secretKey := []byte("test-secret-key-for-benchmarking")
	walletID := uuid.New()
	festivalID := uuid.New()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		payload := QRCodePayload{
			WalletID:   walletID,
			FestivalID: festivalID,
			Timestamp:  time.Now().Unix(),
		}

		// Generate signature
		data := fmt.Sprintf("%s:%s:%d", payload.WalletID, payload.FestivalID, payload.Timestamp)
		h := hmac.New(sha256.New, secretKey)
		h.Write([]byte(data))
		payload.Signature = base64.StdEncoding.EncodeToString(h.Sum(nil))

		// Encode to JSON
		jsonData, _ := json.Marshal(payload)

		// Base64 encode
		_ = base64.StdEncoding.EncodeToString(jsonData)
	}
}

// BenchmarkWalletQRValidate benchmarks QR code validation
func BenchmarkWalletQRValidate(b *testing.B) {
	secretKey := []byte("test-secret-key-for-benchmarking")
	walletID := uuid.New()
	festivalID := uuid.New()

	// Generate a valid QR payload
	payload := QRCodePayload{
		WalletID:   walletID,
		FestivalID: festivalID,
		Timestamp:  time.Now().Unix(),
	}
	data := fmt.Sprintf("%s:%s:%d", payload.WalletID, payload.FestivalID, payload.Timestamp)
	h := hmac.New(sha256.New, secretKey)
	h.Write([]byte(data))
	payload.Signature = base64.StdEncoding.EncodeToString(h.Sum(nil))
	jsonData, _ := json.Marshal(payload)
	encoded := base64.StdEncoding.EncodeToString(jsonData)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Decode base64
		decoded, _ := base64.StdEncoding.DecodeString(encoded)

		// Parse JSON
		var p QRCodePayload
		json.Unmarshal(decoded, &p)

		// Verify signature
		sigData := fmt.Sprintf("%s:%s:%d", p.WalletID, p.FestivalID, p.Timestamp)
		sh := hmac.New(sha256.New, secretKey)
		sh.Write([]byte(sigData))
		expectedSig := base64.StdEncoding.EncodeToString(sh.Sum(nil))

		_ = p.Signature == expectedSig
	}
}

// BenchmarkWalletJSON benchmarks wallet JSON serialization
func BenchmarkWalletJSON(b *testing.B) {
	wallet := &Wallet{
		ID:         uuid.New(),
		UserID:     uuid.New(),
		FestivalID: uuid.New(),
		Balance:    10000,
		Status:     "active",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	b.Run("Marshal", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			json.Marshal(wallet)
		}
	})

	data, _ := json.Marshal(wallet)

	b.Run("Unmarshal", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			var w Wallet
			json.Unmarshal(data, &w)
		}
	})
}

// BenchmarkWalletPayment benchmarks payment processing
func BenchmarkWalletPayment(b *testing.B) {
	repo := NewMockWalletRepository()
	ctx := context.Background()

	wallet := &Wallet{
		ID:         uuid.New(),
		UserID:     uuid.New(),
		FestivalID: uuid.New(),
		Balance:    1000000, // Start with enough balance
		Status:     "active",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	repo.CreateWallet(ctx, wallet)

	paymentAmount := int64(500)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w, _ := repo.GetWalletByID(ctx, wallet.ID)
		if w.Balance >= paymentAmount && w.Status == "active" {
			w.Balance -= paymentAmount
			w.UpdatedAt = time.Now()
			repo.UpdateWallet(ctx, w)
		}
	}
}

// BenchmarkWalletConcurrentAccess benchmarks concurrent wallet access
func BenchmarkWalletConcurrentAccess(b *testing.B) {
	repo := NewMockWalletRepository()
	ctx := context.Background()

	// Create multiple wallets
	wallets := make([]*Wallet, 100)
	for i := 0; i < 100; i++ {
		wallet := &Wallet{
			ID:         uuid.New(),
			UserID:     uuid.New(),
			FestivalID: uuid.New(),
			Balance:    10000,
			Status:     "active",
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}
		repo.CreateWallet(ctx, wallet)
		wallets[i] = wallet
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			idx := i % len(wallets)
			repo.GetWalletByID(ctx, wallets[idx].ID)
			i++
		}
	})
}

// BenchmarkUUIDGeneration benchmarks UUID generation
func BenchmarkUUIDGeneration(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = uuid.New()
	}
}

// BenchmarkTimeNow benchmarks time.Now calls
func BenchmarkTimeNow(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = time.Now()
	}
}

// BenchmarkHMACSHA256 benchmarks HMAC-SHA256 signature generation
func BenchmarkHMACSHA256(b *testing.B) {
	key := []byte("test-secret-key-for-benchmarking")
	data := []byte("wallet-id:festival-id:1234567890")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		h := hmac.New(sha256.New, key)
		h.Write(data)
		_ = h.Sum(nil)
	}
}
