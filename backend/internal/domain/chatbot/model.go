package chatbot

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// MessageRole represents the role of a message sender
type MessageRole string

const (
	RoleUser      MessageRole = "user"
	RoleAssistant MessageRole = "assistant"
	RoleSystem    MessageRole = "system"
)

// ConversationStatus represents the status of a conversation
type ConversationStatus string

const (
	StatusActive    ConversationStatus = "ACTIVE"
	StatusClosed    ConversationStatus = "CLOSED"
	StatusEscalated ConversationStatus = "ESCALATED"
)

// Conversation represents a chat conversation
type Conversation struct {
	ID           uuid.UUID          `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID   uuid.UUID          `json:"festivalId" gorm:"type:uuid;not null;index"`
	UserID       uuid.UUID          `json:"userId" gorm:"type:uuid;not null;index"`
	Status       ConversationStatus `json:"status" gorm:"default:'ACTIVE'"`
	Context      ConversationContext `json:"context" gorm:"type:jsonb;default:'{}'"`
	MessageCount int                `json:"messageCount" gorm:"default:0"`
	LastActivity time.Time          `json:"lastActivity"`
	EscalatedTo  *uuid.UUID         `json:"escalatedTo,omitempty" gorm:"type:uuid"`
	EscalatedAt  *time.Time         `json:"escalatedAt,omitempty"`
	Rating       *int               `json:"rating,omitempty"`
	Feedback     string             `json:"feedback,omitempty"`
	CreatedAt    time.Time          `json:"createdAt"`
	UpdatedAt    time.Time          `json:"updatedAt"`
	Messages     []Message          `json:"messages,omitempty" gorm:"foreignKey:ConversationID"`
}

func (Conversation) TableName() string {
	return "chatbot_conversations"
}

// ConversationContext holds contextual information for the conversation
type ConversationContext struct {
	FestivalName   string            `json:"festivalName,omitempty"`
	FestivalDates  string            `json:"festivalDates,omitempty"`
	UserName       string            `json:"userName,omitempty"`
	HasTicket      bool              `json:"hasTicket"`
	TicketType     string            `json:"ticketType,omitempty"`
	WalletBalance  float64           `json:"walletBalance,omitempty"`
	CurrencyName   string            `json:"currencyName,omitempty"`
	CustomData     map[string]string `json:"customData,omitempty"`
}

func (c ConversationContext) Value() (driver.Value, error) {
	return json.Marshal(c)
}

func (c *ConversationContext) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, c)
}

// Message represents a single message in a conversation
type Message struct {
	ID             uuid.UUID   `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ConversationID uuid.UUID   `json:"conversationId" gorm:"type:uuid;not null;index"`
	Role           MessageRole `json:"role" gorm:"not null"`
	Content        string      `json:"content" gorm:"not null"`
	TokenCount     int         `json:"tokenCount,omitempty"`
	Metadata       MessageMeta `json:"metadata,omitempty" gorm:"type:jsonb;default:'{}'"`
	CreatedAt      time.Time   `json:"createdAt"`
}

func (Message) TableName() string {
	return "chatbot_messages"
}

// MessageMeta holds additional metadata for a message
type MessageMeta struct {
	SourceFAQID    *uuid.UUID `json:"sourceFaqId,omitempty"`
	Confidence     float64    `json:"confidence,omitempty"`
	ProcessingTime int64      `json:"processingTime,omitempty"` // milliseconds
	Model          string     `json:"model,omitempty"`
}

func (m MessageMeta) Value() (driver.Value, error) {
	return json.Marshal(m)
}

func (m *MessageMeta) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, m)
}

// FAQEntry represents a FAQ entry with semantic search capability
type FAQEntry struct {
	ID         uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID uuid.UUID       `json:"festivalId" gorm:"type:uuid;not null;index"`
	Question   string          `json:"question" gorm:"not null"`
	Answer     string          `json:"answer" gorm:"not null"`
	Category   string          `json:"category,omitempty"`
	Tags       pq.StringArray  `json:"tags,omitempty" gorm:"type:text[]"`
	Embedding  pq.Float64Array `json:"embedding,omitempty" gorm:"type:vector(1536)"`
	Priority   int             `json:"priority" gorm:"default:0"`
	IsActive   bool            `json:"isActive" gorm:"default:true"`
	HitCount   int             `json:"hitCount" gorm:"default:0"`
	CreatedAt  time.Time       `json:"createdAt"`
	UpdatedAt  time.Time       `json:"updatedAt"`
}

func (FAQEntry) TableName() string {
	return "chatbot_faq"
}

// ChatbotConfig holds the configuration for a festival's chatbot
type ChatbotConfig struct {
	ID                  uuid.UUID   `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID          uuid.UUID   `json:"festivalId" gorm:"type:uuid;unique;not null"`
	IsEnabled           bool        `json:"isEnabled" gorm:"default:true"`
	WelcomeMessage      string      `json:"welcomeMessage"`
	Personality         string      `json:"personality" gorm:"default:'friendly'"` // friendly, professional, casual
	Tone                string      `json:"tone" gorm:"default:'helpful'"`         // helpful, concise, detailed
	Language            string      `json:"language" gorm:"default:'fr'"`
	MaxMessagesPerConv  int         `json:"maxMessagesPerConv" gorm:"default:50"`
	EscalationThreshold int         `json:"escalationThreshold" gorm:"default:3"` // After N failed attempts
	SuggestedQuestions  pq.StringArray `json:"suggestedQuestions,omitempty" gorm:"type:text[]"`
	SystemPrompt        string      `json:"systemPrompt,omitempty"`
	CreatedAt           time.Time   `json:"createdAt"`
	UpdatedAt           time.Time   `json:"updatedAt"`
}

func (ChatbotConfig) TableName() string {
	return "chatbot_config"
}

// ChatAnalytics holds analytics data for chatbot conversations
type ChatAnalytics struct {
	ID                   uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID           uuid.UUID `json:"festivalId" gorm:"type:uuid;not null;index"`
	Date                 time.Time `json:"date" gorm:"type:date;not null;index"`
	TotalConversations   int       `json:"totalConversations" gorm:"default:0"`
	TotalMessages        int       `json:"totalMessages" gorm:"default:0"`
	AvgMessagesPerConv   float64   `json:"avgMessagesPerConv" gorm:"default:0"`
	EscalatedCount       int       `json:"escalatedCount" gorm:"default:0"`
	ResolvedCount        int       `json:"resolvedCount" gorm:"default:0"`
	AvgResponseTime      float64   `json:"avgResponseTime" gorm:"default:0"` // milliseconds
	AvgRating            float64   `json:"avgRating" gorm:"default:0"`
	TopQuestions         pq.StringArray `json:"topQuestions,omitempty" gorm:"type:text[]"`
	CreatedAt            time.Time `json:"createdAt"`
}

func (ChatAnalytics) TableName() string {
	return "chatbot_analytics"
}

// Request/Response DTOs

// StartConversationRequest represents the request to start a new conversation
type StartConversationRequest struct {
	FestivalID string `json:"festivalId" binding:"required"`
}

// SendMessageRequest represents the request to send a message
type SendMessageRequest struct {
	Message string `json:"message" binding:"required,min=1,max=1000"`
}

// SendMessageResponse represents the response after sending a message
type SendMessageResponse struct {
	ConversationID string   `json:"conversationId"`
	Message        Message  `json:"message"`
	Response       Message  `json:"response"`
	Suggestions    []string `json:"suggestions,omitempty"`
}

// ConversationResponse represents a conversation in API responses
type ConversationResponse struct {
	ID           string             `json:"id"`
	FestivalID   string             `json:"festivalId"`
	UserID       string             `json:"userId"`
	Status       ConversationStatus `json:"status"`
	MessageCount int                `json:"messageCount"`
	LastActivity string             `json:"lastActivity"`
	CreatedAt    string             `json:"createdAt"`
	Messages     []MessageResponse  `json:"messages,omitempty"`
}

// MessageResponse represents a message in API responses
type MessageResponse struct {
	ID        string      `json:"id"`
	Role      MessageRole `json:"role"`
	Content   string      `json:"content"`
	CreatedAt string      `json:"createdAt"`
}

// FAQEntryRequest represents the request to create/update a FAQ entry
type FAQEntryRequest struct {
	Question string   `json:"question" binding:"required"`
	Answer   string   `json:"answer" binding:"required"`
	Category string   `json:"category,omitempty"`
	Tags     []string `json:"tags,omitempty"`
	Priority int      `json:"priority,omitempty"`
	IsActive *bool    `json:"isActive,omitempty"`
}

// FAQEntryResponse represents a FAQ entry in API responses
type FAQEntryResponse struct {
	ID        string   `json:"id"`
	Question  string   `json:"question"`
	Answer    string   `json:"answer"`
	Category  string   `json:"category,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	Priority  int      `json:"priority"`
	IsActive  bool     `json:"isActive"`
	HitCount  int      `json:"hitCount"`
	CreatedAt string   `json:"createdAt"`
	UpdatedAt string   `json:"updatedAt"`
}

// ChatbotConfigRequest represents the request to update chatbot config
type ChatbotConfigRequest struct {
	IsEnabled           *bool    `json:"isEnabled,omitempty"`
	WelcomeMessage      *string  `json:"welcomeMessage,omitempty"`
	Personality         *string  `json:"personality,omitempty"`
	Tone                *string  `json:"tone,omitempty"`
	Language            *string  `json:"language,omitempty"`
	MaxMessagesPerConv  *int     `json:"maxMessagesPerConv,omitempty"`
	EscalationThreshold *int     `json:"escalationThreshold,omitempty"`
	SuggestedQuestions  []string `json:"suggestedQuestions,omitempty"`
	SystemPrompt        *string  `json:"systemPrompt,omitempty"`
}

// ChatbotConfigResponse represents the chatbot config in API responses
type ChatbotConfigResponse struct {
	ID                  string   `json:"id"`
	FestivalID          string   `json:"festivalId"`
	IsEnabled           bool     `json:"isEnabled"`
	WelcomeMessage      string   `json:"welcomeMessage"`
	Personality         string   `json:"personality"`
	Tone                string   `json:"tone"`
	Language            string   `json:"language"`
	MaxMessagesPerConv  int      `json:"maxMessagesPerConv"`
	EscalationThreshold int      `json:"escalationThreshold"`
	SuggestedQuestions  []string `json:"suggestedQuestions"`
	SystemPrompt        string   `json:"systemPrompt,omitempty"`
	CreatedAt           string   `json:"createdAt"`
	UpdatedAt           string   `json:"updatedAt"`
}

// EscalateRequest represents the request to escalate a conversation
type EscalateRequest struct {
	Reason string `json:"reason,omitempty"`
}

// RateConversationRequest represents the request to rate a conversation
type RateConversationRequest struct {
	Rating   int    `json:"rating" binding:"required,min=1,max=5"`
	Feedback string `json:"feedback,omitempty"`
}

// ConversationListResponse represents a paginated list of conversations
type ConversationListResponse struct {
	Items      []ConversationResponse `json:"items"`
	Total      int64                  `json:"total"`
	Page       int                    `json:"page"`
	PerPage    int                    `json:"perPage"`
	TotalPages int                    `json:"totalPages"`
}

// AnalyticsResponse represents analytics data in API responses
type AnalyticsResponse struct {
	TotalConversations   int      `json:"totalConversations"`
	TotalMessages        int      `json:"totalMessages"`
	AvgMessagesPerConv   float64  `json:"avgMessagesPerConv"`
	EscalatedCount       int      `json:"escalatedCount"`
	ResolvedCount        int      `json:"resolvedCount"`
	AvgResponseTime      float64  `json:"avgResponseTime"`
	AvgRating            float64  `json:"avgRating"`
	TopQuestions         []string `json:"topQuestions"`
	EscalationRate       float64  `json:"escalationRate"`
	ResolutionRate       float64  `json:"resolutionRate"`
}

// ToResponse converts a Conversation to ConversationResponse
func (c *Conversation) ToResponse() ConversationResponse {
	resp := ConversationResponse{
		ID:           c.ID.String(),
		FestivalID:   c.FestivalID.String(),
		UserID:       c.UserID.String(),
		Status:       c.Status,
		MessageCount: c.MessageCount,
		LastActivity: c.LastActivity.Format(time.RFC3339),
		CreatedAt:    c.CreatedAt.Format(time.RFC3339),
	}

	if len(c.Messages) > 0 {
		resp.Messages = make([]MessageResponse, len(c.Messages))
		for i, m := range c.Messages {
			resp.Messages[i] = m.ToResponse()
		}
	}

	return resp
}

// ToResponse converts a Message to MessageResponse
func (m *Message) ToResponse() MessageResponse {
	return MessageResponse{
		ID:        m.ID.String(),
		Role:      m.Role,
		Content:   m.Content,
		CreatedAt: m.CreatedAt.Format(time.RFC3339),
	}
}

// ToResponse converts a FAQEntry to FAQEntryResponse
func (f *FAQEntry) ToResponse() FAQEntryResponse {
	return FAQEntryResponse{
		ID:        f.ID.String(),
		Question:  f.Question,
		Answer:    f.Answer,
		Category:  f.Category,
		Tags:      f.Tags,
		Priority:  f.Priority,
		IsActive:  f.IsActive,
		HitCount:  f.HitCount,
		CreatedAt: f.CreatedAt.Format(time.RFC3339),
		UpdatedAt: f.UpdatedAt.Format(time.RFC3339),
	}
}

// ToResponse converts a ChatbotConfig to ChatbotConfigResponse
func (c *ChatbotConfig) ToResponse() ChatbotConfigResponse {
	return ChatbotConfigResponse{
		ID:                  c.ID.String(),
		FestivalID:          c.FestivalID.String(),
		IsEnabled:           c.IsEnabled,
		WelcomeMessage:      c.WelcomeMessage,
		Personality:         c.Personality,
		Tone:                c.Tone,
		Language:            c.Language,
		MaxMessagesPerConv:  c.MaxMessagesPerConv,
		EscalationThreshold: c.EscalationThreshold,
		SuggestedQuestions:  c.SuggestedQuestions,
		SystemPrompt:        c.SystemPrompt,
		CreatedAt:           c.CreatedAt.Format(time.RFC3339),
		UpdatedAt:           c.UpdatedAt.Format(time.RFC3339),
	}
}
