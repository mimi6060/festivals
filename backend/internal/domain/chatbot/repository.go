package chatbot

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

// Repository defines the interface for chatbot data access
type Repository interface {
	// Conversation operations
	CreateConversation(ctx context.Context, conv *Conversation) error
	GetConversationByID(ctx context.Context, id uuid.UUID) (*Conversation, error)
	GetConversationWithMessages(ctx context.Context, id uuid.UUID) (*Conversation, error)
	GetUserActiveConversation(ctx context.Context, userID, festivalID uuid.UUID) (*Conversation, error)
	ListConversations(ctx context.Context, festivalID uuid.UUID, status *ConversationStatus, offset, limit int) ([]Conversation, int64, error)
	UpdateConversation(ctx context.Context, conv *Conversation) error
	DeleteConversation(ctx context.Context, id uuid.UUID) error

	// Message operations
	CreateMessage(ctx context.Context, msg *Message) error
	GetMessagesByConversation(ctx context.Context, convID uuid.UUID, offset, limit int) ([]Message, error)
	CountMessagesInConversation(ctx context.Context, convID uuid.UUID) (int64, error)

	// FAQ operations
	CreateFAQEntry(ctx context.Context, faq *FAQEntry) error
	GetFAQByID(ctx context.Context, id uuid.UUID) (*FAQEntry, error)
	ListFAQEntries(ctx context.Context, festivalID uuid.UUID, category string, activeOnly bool, offset, limit int) ([]FAQEntry, int64, error)
	UpdateFAQEntry(ctx context.Context, faq *FAQEntry) error
	DeleteFAQEntry(ctx context.Context, id uuid.UUID) error
	SearchFAQByEmbedding(ctx context.Context, festivalID uuid.UUID, embedding []float64, limit int) ([]FAQEntry, error)
	IncrementFAQHitCount(ctx context.Context, id uuid.UUID) error

	// Config operations
	GetConfig(ctx context.Context, festivalID uuid.UUID) (*ChatbotConfig, error)
	CreateOrUpdateConfig(ctx context.Context, config *ChatbotConfig) error

	// Analytics operations
	GetAnalytics(ctx context.Context, festivalID uuid.UUID, days int) (*ChatAnalytics, error)
	SaveAnalytics(ctx context.Context, analytics *ChatAnalytics) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new chatbot repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Conversation operations

func (r *repository) CreateConversation(ctx context.Context, conv *Conversation) error {
	return r.db.WithContext(ctx).Create(conv).Error
}

func (r *repository) GetConversationByID(ctx context.Context, id uuid.UUID) (*Conversation, error) {
	var conv Conversation
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&conv).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get conversation: %w", err)
	}
	return &conv, nil
}

func (r *repository) GetConversationWithMessages(ctx context.Context, id uuid.UUID) (*Conversation, error) {
	var conv Conversation
	err := r.db.WithContext(ctx).
		Preload("Messages", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC")
		}).
		Where("id = ?", id).
		First(&conv).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get conversation with messages: %w", err)
	}
	return &conv, nil
}

func (r *repository) GetUserActiveConversation(ctx context.Context, userID, festivalID uuid.UUID) (*Conversation, error) {
	var conv Conversation
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND festival_id = ? AND status = ?", userID, festivalID, StatusActive).
		Order("created_at DESC").
		First(&conv).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get user active conversation: %w", err)
	}
	return &conv, nil
}

func (r *repository) ListConversations(ctx context.Context, festivalID uuid.UUID, status *ConversationStatus, offset, limit int) ([]Conversation, int64, error) {
	var conversations []Conversation
	var total int64

	query := r.db.WithContext(ctx).Model(&Conversation{}).Where("festival_id = ?", festivalID)

	if status != nil {
		query = query.Where("status = ?", *status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count conversations: %w", err)
	}

	if err := query.
		Offset(offset).
		Limit(limit).
		Order("last_activity DESC").
		Find(&conversations).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list conversations: %w", err)
	}

	return conversations, total, nil
}

func (r *repository) UpdateConversation(ctx context.Context, conv *Conversation) error {
	return r.db.WithContext(ctx).Save(conv).Error
}

func (r *repository) DeleteConversation(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Delete messages first
		if err := tx.Where("conversation_id = ?", id).Delete(&Message{}).Error; err != nil {
			return err
		}
		// Delete conversation
		return tx.Where("id = ?", id).Delete(&Conversation{}).Error
	})
}

// Message operations

func (r *repository) CreateMessage(ctx context.Context, msg *Message) error {
	return r.db.WithContext(ctx).Create(msg).Error
}

func (r *repository) GetMessagesByConversation(ctx context.Context, convID uuid.UUID, offset, limit int) ([]Message, error) {
	var messages []Message
	err := r.db.WithContext(ctx).
		Where("conversation_id = ?", convID).
		Order("created_at ASC").
		Offset(offset).
		Limit(limit).
		Find(&messages).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get messages: %w", err)
	}
	return messages, nil
}

func (r *repository) CountMessagesInConversation(ctx context.Context, convID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&Message{}).Where("conversation_id = ?", convID).Count(&count).Error
	return count, err
}

// FAQ operations

func (r *repository) CreateFAQEntry(ctx context.Context, faq *FAQEntry) error {
	return r.db.WithContext(ctx).Create(faq).Error
}

func (r *repository) GetFAQByID(ctx context.Context, id uuid.UUID) (*FAQEntry, error) {
	var faq FAQEntry
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&faq).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get FAQ entry: %w", err)
	}
	return &faq, nil
}

func (r *repository) ListFAQEntries(ctx context.Context, festivalID uuid.UUID, category string, activeOnly bool, offset, limit int) ([]FAQEntry, int64, error) {
	var faqs []FAQEntry
	var total int64

	query := r.db.WithContext(ctx).Model(&FAQEntry{}).Where("festival_id = ?", festivalID)

	if category != "" {
		query = query.Where("category = ?", category)
	}

	if activeOnly {
		query = query.Where("is_active = ?", true)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count FAQ entries: %w", err)
	}

	if err := query.
		Offset(offset).
		Limit(limit).
		Order("priority DESC, hit_count DESC").
		Find(&faqs).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list FAQ entries: %w", err)
	}

	return faqs, total, nil
}

func (r *repository) UpdateFAQEntry(ctx context.Context, faq *FAQEntry) error {
	return r.db.WithContext(ctx).Save(faq).Error
}

func (r *repository) DeleteFAQEntry(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&FAQEntry{}).Error
}

func (r *repository) SearchFAQByEmbedding(ctx context.Context, festivalID uuid.UUID, embedding []float64, limit int) ([]FAQEntry, error) {
	var faqs []FAQEntry

	// Convert embedding to PostgreSQL vector format
	embeddingArray := pq.Float64Array(embedding)

	// Use cosine similarity for vector search
	// Note: This requires pgvector extension to be installed
	err := r.db.WithContext(ctx).
		Raw(`
			SELECT id, festival_id, question, answer, category, tags, priority, is_active, hit_count, created_at, updated_at
			FROM chatbot_faq
			WHERE festival_id = ? AND is_active = true
			ORDER BY embedding <=> ?::vector
			LIMIT ?
		`, festivalID, embeddingArray, limit).
		Scan(&faqs).Error

	if err != nil {
		// Fallback to basic search if vector search fails
		return r.fallbackSearch(ctx, festivalID, limit)
	}

	return faqs, nil
}

func (r *repository) fallbackSearch(ctx context.Context, festivalID uuid.UUID, limit int) ([]FAQEntry, error) {
	var faqs []FAQEntry
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND is_active = ?", festivalID, true).
		Order("priority DESC, hit_count DESC").
		Limit(limit).
		Find(&faqs).Error
	return faqs, err
}

func (r *repository) IncrementFAQHitCount(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&FAQEntry{}).
		Where("id = ?", id).
		UpdateColumn("hit_count", gorm.Expr("hit_count + 1")).
		Error
}

// Config operations

func (r *repository) GetConfig(ctx context.Context, festivalID uuid.UUID) (*ChatbotConfig, error) {
	var config ChatbotConfig
	err := r.db.WithContext(ctx).Where("festival_id = ?", festivalID).First(&config).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get chatbot config: %w", err)
	}
	return &config, nil
}

func (r *repository) CreateOrUpdateConfig(ctx context.Context, config *ChatbotConfig) error {
	return r.db.WithContext(ctx).Save(config).Error
}

// Analytics operations

func (r *repository) GetAnalytics(ctx context.Context, festivalID uuid.UUID, days int) (*ChatAnalytics, error) {
	var analytics ChatAnalytics

	// Aggregate analytics for the specified number of days
	err := r.db.WithContext(ctx).
		Raw(`
			SELECT
				? as festival_id,
				COALESCE(SUM(total_conversations), 0) as total_conversations,
				COALESCE(SUM(total_messages), 0) as total_messages,
				COALESCE(AVG(avg_messages_per_conv), 0) as avg_messages_per_conv,
				COALESCE(SUM(escalated_count), 0) as escalated_count,
				COALESCE(SUM(resolved_count), 0) as resolved_count,
				COALESCE(AVG(avg_response_time), 0) as avg_response_time,
				COALESCE(AVG(avg_rating), 0) as avg_rating
			FROM chatbot_analytics
			WHERE festival_id = ? AND date >= CURRENT_DATE - INTERVAL '1 day' * ?
		`, festivalID, festivalID, days).
		Scan(&analytics).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get analytics: %w", err)
	}

	return &analytics, nil
}

func (r *repository) SaveAnalytics(ctx context.Context, analytics *ChatAnalytics) error {
	return r.db.WithContext(ctx).Save(analytics).Error
}
