package realtime

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/mimi6060/festivals/backend/internal/infrastructure/websocket"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// StatsUpdate represents real-time stats data
type StatsUpdate struct {
	TotalRevenue         float64   `json:"total_revenue"`
	RevenueChange        float64   `json:"revenue_change"`
	TicketsSold          int64     `json:"tickets_sold"`
	TicketsUsed          int64     `json:"tickets_used"`
	ActiveWallets        int64     `json:"active_wallets"`
	ActiveUsers          int64     `json:"active_users"`
	TodayTransactions    int64     `json:"today_transactions"`
	TransactionVolume    float64   `json:"transaction_volume"`
	AverageWalletBalance float64   `json:"average_wallet_balance"`
	EntriesLastHour      int64     `json:"entries_last_hour"`
	Timestamp            time.Time `json:"timestamp"`
}

// Transaction represents a transaction for real-time feed
type Transaction struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"` // purchase, topup, refund
	Amount      float64   `json:"amount"`
	WalletID    string    `json:"wallet_id,omitempty"`
	StandName   string    `json:"stand_name,omitempty"`
	ProductName string    `json:"product_name,omitempty"`
	StaffName   string    `json:"staff_name,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
}

// Alert represents a real-time alert
type Alert struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"` // info, warning, error
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	ActionURL string    `json:"action_url,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// Entry represents a ticket entry event
type Entry struct {
	ID          string    `json:"id"`
	TicketType  string    `json:"ticket_type"`
	GateName    string    `json:"gate_name"`
	VisitorName string    `json:"visitor_name,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
}

// RevenuePoint represents a point in the revenue chart
type RevenuePoint struct {
	Timestamp time.Time `json:"timestamp"`
	Revenue   float64   `json:"revenue"`
	Label     string    `json:"label"`
}

// Service handles real-time data broadcasting
type Service struct {
	hub   *websocket.Hub
	redis *redis.Client

	// In-memory stats cache per festival
	statsCache   map[string]*StatsUpdate
	statsCacheMu sync.RWMutex

	// Recent transactions per festival
	recentTransactions   map[string][]Transaction
	recentTransactionsMu sync.RWMutex
	maxRecentTransactions int

	// Stats broadcaster settings
	statsBroadcastInterval time.Duration
	stopBroadcaster        chan struct{}

	// Stats provider function (can be set to fetch real stats from DB)
	statsProvider func(festivalID string) (*StatsUpdate, error)
}

// NewService creates a new realtime service
func NewService(hub *websocket.Hub, redisClient *redis.Client) *Service {
	s := &Service{
		hub:                    hub,
		redis:                  redisClient,
		statsCache:             make(map[string]*StatsUpdate),
		recentTransactions:     make(map[string][]Transaction),
		maxRecentTransactions:  50,
		statsBroadcastInterval: 5 * time.Second,
		stopBroadcaster:        make(chan struct{}),
	}

	// Start background stats broadcaster if redis is available
	if redisClient != nil {
		go s.subscribeToRedisUpdates()
	}

	// Start periodic stats broadcaster
	go s.runPeriodicStatsBroadcaster()

	return s
}

// SetStatsProvider sets a function to fetch real stats from database
func (s *Service) SetStatsProvider(provider func(festivalID string) (*StatsUpdate, error)) {
	s.statsProvider = provider
}

// SetStatsBroadcastInterval sets the interval for periodic stats broadcasting
func (s *Service) SetStatsBroadcastInterval(interval time.Duration) {
	s.statsBroadcastInterval = interval
}

// runPeriodicStatsBroadcaster broadcasts stats to all connected festivals periodically
func (s *Service) runPeriodicStatsBroadcaster() {
	ticker := time.NewTicker(s.statsBroadcastInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.broadcastAllFestivalStats()
		case <-s.stopBroadcaster:
			return
		}
	}
}

// broadcastAllFestivalStats broadcasts stats to all connected festivals
func (s *Service) broadcastAllFestivalStats() {
	// Get all festivals with active connections
	hubStats := s.hub.GetStats()
	festivalsRaw, ok := hubStats["festivals"]
	if !ok {
		return
	}

	festivals, ok := festivalsRaw.(map[string]int)
	if !ok {
		return
	}

	for festivalID, clientCount := range festivals {
		if clientCount == 0 {
			continue
		}

		var stats *StatsUpdate

		// Try to get stats from provider first
		if s.statsProvider != nil {
			var err error
			stats, err = s.statsProvider(festivalID)
			if err != nil {
				log.Debug().Err(err).
					Str("festival_id", festivalID).
					Msg("Failed to fetch stats from provider, using cache")
			}
		}

		// Fall back to cache
		if stats == nil {
			stats = s.GetCachedStats(festivalID)
		}

		// If we have stats, broadcast them
		if stats != nil {
			stats.Timestamp = time.Now()
			if err := s.hub.BroadcastStats(festivalID, stats); err != nil {
				log.Error().Err(err).
					Str("festival_id", festivalID).
					Msg("Failed to broadcast periodic stats")
			}
		}
	}
}

// Stop stops the service and all background goroutines
func (s *Service) Stop() {
	close(s.stopBroadcaster)
}

// subscribeToRedisUpdates listens for updates from Redis pub/sub
func (s *Service) subscribeToRedisUpdates() {
	ctx := context.Background()
	pubsub := s.redis.Subscribe(ctx, "festival:updates")
	defer pubsub.Close()

	ch := pubsub.Channel()
	for msg := range ch {
		var update struct {
			FestivalID string          `json:"festival_id"`
			Type       string          `json:"type"`
			Data       json.RawMessage `json:"data"`
		}

		if err := json.Unmarshal([]byte(msg.Payload), &update); err != nil {
			log.Error().Err(err).Msg("Failed to unmarshal Redis message")
			continue
		}

		switch update.Type {
		case "stats":
			var stats StatsUpdate
			if err := json.Unmarshal(update.Data, &stats); err == nil {
				s.UpdateStats(update.FestivalID, &stats)
			}
		case "transaction":
			var tx Transaction
			if err := json.Unmarshal(update.Data, &tx); err == nil {
				s.BroadcastTransaction(update.FestivalID, &tx)
			}
		case "alert":
			var alert Alert
			if err := json.Unmarshal(update.Data, &alert); err == nil {
				s.BroadcastAlert(update.FestivalID, &alert)
			}
		case "entry":
			var entry Entry
			if err := json.Unmarshal(update.Data, &entry); err == nil {
				s.BroadcastEntry(update.FestivalID, &entry)
			}
		}
	}
}

// UpdateStats updates and broadcasts stats for a festival
func (s *Service) UpdateStats(festivalID string, stats *StatsUpdate) {
	stats.Timestamp = time.Now()

	// Update cache
	s.statsCacheMu.Lock()
	s.statsCache[festivalID] = stats
	s.statsCacheMu.Unlock()

	// Broadcast to WebSocket clients
	if err := s.hub.BroadcastStats(festivalID, stats); err != nil {
		log.Error().Err(err).
			Str("festival_id", festivalID).
			Msg("Failed to broadcast stats update")
	}
}

// GetCachedStats returns cached stats for a festival
func (s *Service) GetCachedStats(festivalID string) *StatsUpdate {
	s.statsCacheMu.RLock()
	defer s.statsCacheMu.RUnlock()
	return s.statsCache[festivalID]
}

// BroadcastTransaction broadcasts a transaction to a festival
func (s *Service) BroadcastTransaction(festivalID string, tx *Transaction) {
	tx.Timestamp = time.Now()

	// Add to recent transactions
	s.recentTransactionsMu.Lock()
	if s.recentTransactions[festivalID] == nil {
		s.recentTransactions[festivalID] = make([]Transaction, 0, s.maxRecentTransactions)
	}
	transactions := s.recentTransactions[festivalID]
	transactions = append([]Transaction{*tx}, transactions...)
	if len(transactions) > s.maxRecentTransactions {
		transactions = transactions[:s.maxRecentTransactions]
	}
	s.recentTransactions[festivalID] = transactions
	s.recentTransactionsMu.Unlock()

	// Broadcast to WebSocket clients
	if err := s.hub.BroadcastTransaction(festivalID, tx); err != nil {
		log.Error().Err(err).
			Str("festival_id", festivalID).
			Msg("Failed to broadcast transaction")
	}
}

// GetRecentTransactions returns recent transactions for a festival
func (s *Service) GetRecentTransactions(festivalID string, limit int) []Transaction {
	s.recentTransactionsMu.RLock()
	defer s.recentTransactionsMu.RUnlock()

	transactions := s.recentTransactions[festivalID]
	if transactions == nil {
		return []Transaction{}
	}

	if limit > len(transactions) {
		limit = len(transactions)
	}
	return transactions[:limit]
}

// BroadcastAlert broadcasts an alert to a festival
func (s *Service) BroadcastAlert(festivalID string, alert *Alert) {
	alert.Timestamp = time.Now()

	if err := s.hub.BroadcastAlert(festivalID, alert); err != nil {
		log.Error().Err(err).
			Str("festival_id", festivalID).
			Msg("Failed to broadcast alert")
	}
}

// BroadcastEntry broadcasts an entry event to a festival
func (s *Service) BroadcastEntry(festivalID string, entry *Entry) {
	entry.Timestamp = time.Now()

	if err := s.hub.BroadcastEntry(festivalID, entry); err != nil {
		log.Error().Err(err).
			Str("festival_id", festivalID).
			Msg("Failed to broadcast entry")
	}
}

// BroadcastRevenueUpdate broadcasts a revenue chart update
func (s *Service) BroadcastRevenueUpdate(festivalID string, point *RevenuePoint) {
	if err := s.hub.BroadcastRevenueUpdate(festivalID, point); err != nil {
		log.Error().Err(err).
			Str("festival_id", festivalID).
			Msg("Failed to broadcast revenue update")
	}
}

// PublishToRedis publishes an update to Redis for distributed systems
func (s *Service) PublishToRedis(ctx context.Context, festivalID string, msgType string, data interface{}) error {
	if s.redis == nil {
		return nil
	}

	payload := map[string]interface{}{
		"festival_id": festivalID,
		"type":        msgType,
		"data":        data,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	return s.redis.Publish(ctx, "festival:updates", jsonData).Err()
}

// SimulateStatsUpdate simulates stats updates for demo/testing
func (s *Service) SimulateStatsUpdate(festivalID string) {
	s.UpdateStats(festivalID, &StatsUpdate{
		TotalRevenue:         125430.50,
		RevenueChange:        12.5,
		TicketsSold:          2500,
		TicketsUsed:          1850,
		ActiveWallets:        1650,
		ActiveUsers:          1423,
		TodayTransactions:    450,
		TransactionVolume:    8750.00,
		AverageWalletBalance: 45.30,
		EntriesLastHour:      125,
	})
}

// SimulateTransaction simulates a transaction for demo/testing
func (s *Service) SimulateTransaction(festivalID string) {
	s.BroadcastTransaction(festivalID, &Transaction{
		ID:          "tx_demo_123",
		Type:        "purchase",
		Amount:      15.50,
		StandName:   "Bar Central",
		ProductName: "Beer",
		StaffName:   "Jean Dupont",
	})
}

// GetHub returns the WebSocket hub
func (s *Service) GetHub() *websocket.Hub {
	return s.hub
}

// GetHubStats returns hub statistics
func (s *Service) GetHubStats() map[string]interface{} {
	return s.hub.GetStats()
}
