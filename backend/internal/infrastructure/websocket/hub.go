package websocket

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// MessageType represents the type of WebSocket message
type MessageType string

const (
	MessageTypeStats        MessageType = "stats"
	MessageTypeTransaction  MessageType = "transaction"
	MessageTypeAlert        MessageType = "alert"
	MessageTypeEntry        MessageType = "entry"
	MessageTypeRevenueUpdate MessageType = "revenue_update"
	MessageTypePing         MessageType = "ping"
	MessageTypePong         MessageType = "pong"
)

// Message represents a WebSocket message
type Message struct {
	Type      MessageType     `json:"type"`
	FestivalID string         `json:"festival_id,omitempty"`
	Timestamp  time.Time      `json:"timestamp"`
	Data       json.RawMessage `json:"data"`
}

// Hub maintains the set of active clients and broadcasts messages to clients
type Hub struct {
	// Registered clients by festival ID
	clients map[string]map[*Client]bool

	// Channel for registering clients
	register chan *Client

	// Channel for unregistering clients
	unregister chan *Client

	// Channel for broadcasting messages to specific festivals
	broadcast chan *Message

	// Mutex for thread-safe operations
	mu sync.RWMutex

	// Stats tracking
	totalConnections int64
	activeConnections int64
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]bool),
		register:   make(chan *Client, 256),
		unregister: make(chan *Client, 256),
		broadcast:  make(chan *Message, 1024),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	// Start ping ticker for keeping connections alive
	pingTicker := time.NewTicker(30 * time.Second)
	defer pingTicker.Stop()

	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case message := <-h.broadcast:
			h.broadcastMessage(message)

		case <-pingTicker.C:
			h.pingAllClients()
		}
	}
}

// registerClient adds a client to the hub
func (h *Hub) registerClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[client.festivalID]; !ok {
		h.clients[client.festivalID] = make(map[*Client]bool)
	}
	h.clients[client.festivalID][client] = true
	h.totalConnections++
	h.activeConnections++

	log.Info().
		Str("festival_id", client.festivalID).
		Str("client_id", client.id).
		Str("channel", string(client.channel)).
		Int64("active_connections", h.activeConnections).
		Msg("Client connected to WebSocket")
}

// unregisterClient removes a client from the hub
func (h *Hub) unregisterClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if clients, ok := h.clients[client.festivalID]; ok {
		if _, exists := clients[client]; exists {
			delete(clients, client)
			close(client.send)
			h.activeConnections--

			// Clean up empty festival maps
			if len(clients) == 0 {
				delete(h.clients, client.festivalID)
			}

			log.Info().
				Str("festival_id", client.festivalID).
				Str("client_id", client.id).
				Int64("active_connections", h.activeConnections).
				Msg("Client disconnected from WebSocket")
		}
	}
}

// broadcastMessage sends a message to all clients subscribed to a festival
func (h *Hub) broadcastMessage(message *Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	clients, ok := h.clients[message.FestivalID]
	if !ok {
		return
	}

	messageBytes, err := json.Marshal(message)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal broadcast message")
		return
	}

	for client := range clients {
		// Check if message type matches client's subscribed channel
		if !client.shouldReceive(message.Type) {
			continue
		}

		select {
		case client.send <- messageBytes:
		default:
			// Client's send buffer is full, close the connection
			go func(c *Client) {
				h.unregister <- c
			}(client)
		}
	}
}

// pingAllClients sends ping messages to all connected clients
func (h *Hub) pingAllClients() {
	h.mu.RLock()
	defer h.mu.RUnlock()

	pingMsg, _ := json.Marshal(&Message{
		Type:      MessageTypePing,
		Timestamp: time.Now(),
	})

	for _, clients := range h.clients {
		for client := range clients {
			select {
			case client.send <- pingMsg:
			default:
				// Skip if buffer is full
			}
		}
	}
}

// BroadcastToFestival sends a message to all clients of a specific festival
func (h *Hub) BroadcastToFestival(festivalID string, msgType MessageType, data interface{}) error {
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return err
	}

	message := &Message{
		Type:       msgType,
		FestivalID: festivalID,
		Timestamp:  time.Now(),
		Data:       dataBytes,
	}

	h.broadcast <- message
	return nil
}

// BroadcastStats sends stats update to a festival
func (h *Hub) BroadcastStats(festivalID string, stats interface{}) error {
	return h.BroadcastToFestival(festivalID, MessageTypeStats, stats)
}

// BroadcastTransaction sends a transaction update to a festival
func (h *Hub) BroadcastTransaction(festivalID string, transaction interface{}) error {
	return h.BroadcastToFestival(festivalID, MessageTypeTransaction, transaction)
}

// BroadcastAlert sends an alert to a festival
func (h *Hub) BroadcastAlert(festivalID string, alert interface{}) error {
	return h.BroadcastToFestival(festivalID, MessageTypeAlert, alert)
}

// BroadcastEntry sends an entry update to a festival
func (h *Hub) BroadcastEntry(festivalID string, entry interface{}) error {
	return h.BroadcastToFestival(festivalID, MessageTypeEntry, entry)
}

// BroadcastRevenueUpdate sends a revenue update to a festival
func (h *Hub) BroadcastRevenueUpdate(festivalID string, revenue interface{}) error {
	return h.BroadcastToFestival(festivalID, MessageTypeRevenueUpdate, revenue)
}

// GetStats returns hub statistics
func (h *Hub) GetStats() map[string]interface{} {
	h.mu.RLock()
	defer h.mu.RUnlock()

	festivalCounts := make(map[string]int)
	for festivalID, clients := range h.clients {
		festivalCounts[festivalID] = len(clients)
	}

	return map[string]interface{}{
		"total_connections":  h.totalConnections,
		"active_connections": h.activeConnections,
		"festivals":          festivalCounts,
	}
}

// Register adds a client to the hub
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister removes a client from the hub
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}
