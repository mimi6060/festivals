package websocket

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512

	// Size of the send buffer
	sendBufferSize = 256
)

// Channel represents the type of real-time data a client subscribes to
type Channel string

const (
	ChannelDashboard Channel = "dashboard" // Stats, transactions, revenue
	ChannelAlerts    Channel = "alerts"    // Alerts only
	ChannelAll       Channel = "all"       // All updates
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// In production, implement proper origin checking
		return true
	},
}

// Client represents a WebSocket client connection
type Client struct {
	id         string
	hub        *Hub
	conn       *websocket.Conn
	send       chan []byte
	festivalID string
	channel    Channel
	userID     string
	metadata   map[string]string
}

// ClientConfig holds configuration for creating a new client
type ClientConfig struct {
	FestivalID string
	Channel    Channel
	UserID     string
	Metadata   map[string]string
}

// NewClient creates a new WebSocket client
func NewClient(hub *Hub, conn *websocket.Conn, config ClientConfig) *Client {
	if config.Channel == "" {
		config.Channel = ChannelAll
	}

	return &Client{
		id:         uuid.New().String(),
		hub:        hub,
		conn:       conn,
		send:       make(chan []byte, sendBufferSize),
		festivalID: config.FestivalID,
		channel:    config.Channel,
		userID:     config.UserID,
		metadata:   config.Metadata,
	}
}

// shouldReceive checks if the client should receive a message of the given type
func (c *Client) shouldReceive(msgType MessageType) bool {
	switch c.channel {
	case ChannelAll:
		return true
	case ChannelDashboard:
		return msgType == MessageTypeStats ||
			msgType == MessageTypeTransaction ||
			msgType == MessageTypeRevenueUpdate ||
			msgType == MessageTypeEntry ||
			msgType == MessageTypePing
	case ChannelAlerts:
		return msgType == MessageTypeAlert || msgType == MessageTypePing
	default:
		return true
	}
}

// ReadPump pumps messages from the WebSocket connection to the hub
func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Error().Err(err).Str("client_id", c.id).Msg("WebSocket read error")
			}
			break
		}

		// Handle incoming messages (e.g., pong, subscription changes)
		c.handleMessage(message)
	}
}

// WritePump pumps messages from the hub to the WebSocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current WebSocket message
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage processes incoming messages from the client
func (c *Client) handleMessage(message []byte) {
	var msg Message
	if err := json.Unmarshal(message, &msg); err != nil {
		return
	}

	switch msg.Type {
	case MessageTypePong:
		// Client responded to ping
		log.Debug().Str("client_id", c.id).Msg("Received pong from client")
	default:
		// Log unknown message types
		log.Debug().
			Str("client_id", c.id).
			Str("type", string(msg.Type)).
			Msg("Received unknown message type")
	}
}

// ServeWs handles WebSocket requests from the peer
func ServeWs(hub *Hub, c *gin.Context, config ClientConfig) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Error().Err(err).Msg("Failed to upgrade to WebSocket")
		return
	}

	client := NewClient(hub, conn, config)
	hub.Register(client)

	// Allow collection of memory referenced by the caller by doing all work in
	// new goroutines
	go client.WritePump()
	go client.ReadPump()
}

// WebSocketHandler returns a gin handler for WebSocket connections
func WebSocketHandler(hub *Hub, channel Channel) gin.HandlerFunc {
	return func(c *gin.Context) {
		festivalID := c.Param("festivalId")
		if festivalID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "festival_id is required"})
			return
		}

		// Get user ID from context if authenticated
		userID, _ := c.Get("userID")
		userIDStr, _ := userID.(string)

		config := ClientConfig{
			FestivalID: festivalID,
			Channel:    channel,
			UserID:     userIDStr,
			Metadata: map[string]string{
				"ip":         c.ClientIP(),
				"user_agent": c.Request.UserAgent(),
			},
		}

		ServeWs(hub, c, config)
	}
}

// DashboardHandler returns a handler for dashboard WebSocket connections
func DashboardHandler(hub *Hub) gin.HandlerFunc {
	return WebSocketHandler(hub, ChannelDashboard)
}

// AlertsHandler returns a handler for alerts WebSocket connections
func AlertsHandler(hub *Hub) gin.HandlerFunc {
	return WebSocketHandler(hub, ChannelAlerts)
}
