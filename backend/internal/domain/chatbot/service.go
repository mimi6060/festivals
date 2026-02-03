package chatbot

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/mimi6060/festivals/backend/internal/domain/festival"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/ai"
)

// Service handles chatbot business logic
type Service struct {
	repo         Repository
	aiClient     *ai.Client
	festivalRepo festival.Repository
}

// NewService creates a new chatbot service
func NewService(repo Repository, aiClient *ai.Client, festivalRepo festival.Repository) *Service {
	return &Service{
		repo:         repo,
		aiClient:     aiClient,
		festivalRepo: festivalRepo,
	}
}

// StartConversation starts a new conversation or returns an existing active one
func (s *Service) StartConversation(ctx context.Context, userID, festivalID uuid.UUID) (*Conversation, error) {
	// Check if user already has an active conversation
	existing, err := s.repo.GetUserActiveConversation(ctx, userID, festivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing conversation: %w", err)
	}
	if existing != nil {
		return existing, nil
	}

	// Get festival context
	festivalData, err := s.festivalRepo.GetByID(ctx, festivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to get festival: %w", err)
	}

	// Get chatbot config
	config, err := s.repo.GetConfig(ctx, festivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to get chatbot config: %w", err)
	}

	// Build conversation context
	convContext := ConversationContext{
		FestivalName:  festivalData.Name,
		FestivalDates: fmt.Sprintf("%s - %s", festivalData.StartDate.Format("02/01/2006"), festivalData.EndDate.Format("02/01/2006")),
		CurrencyName:  festivalData.CurrencyName,
	}

	// Create new conversation
	conv := &Conversation{
		ID:           uuid.New(),
		FestivalID:   festivalID,
		UserID:       userID,
		Status:       StatusActive,
		Context:      convContext,
		MessageCount: 0,
		LastActivity: time.Now(),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.repo.CreateConversation(ctx, conv); err != nil {
		return nil, fmt.Errorf("failed to create conversation: %w", err)
	}

	// Add welcome message if configured
	if config != nil && config.WelcomeMessage != "" {
		welcomeMsg := &Message{
			ID:             uuid.New(),
			ConversationID: conv.ID,
			Role:           RoleAssistant,
			Content:        config.WelcomeMessage,
			CreatedAt:      time.Now(),
		}
		if err := s.repo.CreateMessage(ctx, welcomeMsg); err != nil {
			// Non-fatal error, just log it
			fmt.Printf("failed to create welcome message: %v\n", err)
		} else {
			conv.MessageCount++
			conv.Messages = []Message{*welcomeMsg}
		}
	}

	return conv, nil
}

// SendMessage sends a user message and generates an AI response
func (s *Service) SendMessage(ctx context.Context, conversationID uuid.UUID, userMessage string) (*SendMessageResponse, error) {
	startTime := time.Now()

	// Get conversation
	conv, err := s.repo.GetConversationWithMessages(ctx, conversationID)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation: %w", err)
	}
	if conv == nil {
		return nil, fmt.Errorf("conversation not found")
	}
	if conv.Status != StatusActive {
		return nil, fmt.Errorf("conversation is not active")
	}

	// Get chatbot config
	config, err := s.repo.GetConfig(ctx, conv.FestivalID)
	if err != nil {
		return nil, fmt.Errorf("failed to get chatbot config: %w", err)
	}

	// Check message limit
	if config != nil && conv.MessageCount >= config.MaxMessagesPerConv {
		return nil, fmt.Errorf("conversation message limit reached")
	}

	// Save user message
	userMsg := &Message{
		ID:             uuid.New(),
		ConversationID: conversationID,
		Role:           RoleUser,
		Content:        userMessage,
		CreatedAt:      time.Now(),
	}
	if err := s.repo.CreateMessage(ctx, userMsg); err != nil {
		return nil, fmt.Errorf("failed to save user message: %w", err)
	}

	// Search for relevant FAQ entries
	relevantFAQs, err := s.SearchFAQ(ctx, userMessage, conv.FestivalID)
	if err != nil {
		// Non-fatal, continue without FAQ context
		fmt.Printf("FAQ search failed: %v\n", err)
	}

	// Build messages for AI
	aiMessages := s.buildAIMessages(conv, config, userMessage, relevantFAQs)

	// Generate AI response
	response, err := s.aiClient.Chat(ctx, aiMessages)
	if err != nil {
		return nil, fmt.Errorf("failed to generate AI response: %w", err)
	}

	processingTime := time.Since(startTime).Milliseconds()

	// Determine which FAQ was used (if any)
	var sourceFAQID *uuid.UUID
	if len(relevantFAQs) > 0 {
		sourceFAQID = &relevantFAQs[0].ID
		// Increment hit count
		_ = s.repo.IncrementFAQHitCount(ctx, relevantFAQs[0].ID)
	}

	// Save assistant response
	assistantMsg := &Message{
		ID:             uuid.New(),
		ConversationID: conversationID,
		Role:           RoleAssistant,
		Content:        response,
		Metadata: MessageMeta{
			SourceFAQID:    sourceFAQID,
			ProcessingTime: processingTime,
		},
		CreatedAt: time.Now(),
	}
	if err := s.repo.CreateMessage(ctx, assistantMsg); err != nil {
		return nil, fmt.Errorf("failed to save assistant message: %w", err)
	}

	// Update conversation
	conv.MessageCount += 2
	conv.LastActivity = time.Now()
	conv.UpdatedAt = time.Now()
	if err := s.repo.UpdateConversation(ctx, conv); err != nil {
		// Non-fatal error
		fmt.Printf("failed to update conversation: %v\n", err)
	}

	// Generate suggestions
	suggestions := s.GetSuggestedQuestions(ctx, conv.FestivalID)

	return &SendMessageResponse{
		ConversationID: conversationID.String(),
		Message:        *userMsg,
		Response:       *assistantMsg,
		Suggestions:    suggestions,
	}, nil
}

// buildAIMessages builds the message array for the AI API
func (s *Service) buildAIMessages(conv *Conversation, config *ChatbotConfig, userMessage string, faqs []FAQEntry) []ai.Message {
	messages := make([]ai.Message, 0)

	// System prompt
	systemPrompt := s.buildSystemPrompt(conv, config, faqs)
	messages = append(messages, ai.Message{
		Role:    "system",
		Content: systemPrompt,
	})

	// Add conversation history (last N messages)
	historyLimit := 10
	startIdx := 0
	if len(conv.Messages) > historyLimit {
		startIdx = len(conv.Messages) - historyLimit
	}

	for _, msg := range conv.Messages[startIdx:] {
		messages = append(messages, ai.Message{
			Role:    string(msg.Role),
			Content: msg.Content,
		})
	}

	// Add current user message
	messages = append(messages, ai.Message{
		Role:    "user",
		Content: userMessage,
	})

	return messages
}

// buildSystemPrompt builds the system prompt for the AI
func (s *Service) buildSystemPrompt(conv *Conversation, config *ChatbotConfig, faqs []FAQEntry) string {
	var sb strings.Builder

	// Base prompt
	sb.WriteString("Tu es l'assistant virtuel du festival ")
	sb.WriteString(conv.Context.FestivalName)
	sb.WriteString(". ")

	// Personality and tone
	if config != nil {
		switch config.Personality {
		case "friendly":
			sb.WriteString("Tu es amical et chaleureux. ")
		case "professional":
			sb.WriteString("Tu es professionnel et precis. ")
		case "casual":
			sb.WriteString("Tu es decontracte et accessible. ")
		}

		switch config.Tone {
		case "helpful":
			sb.WriteString("Tu cherches toujours a aider au maximum. ")
		case "concise":
			sb.WriteString("Tu reponds de maniere concise et directe. ")
		case "detailed":
			sb.WriteString("Tu donnes des reponses detaillees et completes. ")
		}

		// Custom system prompt
		if config.SystemPrompt != "" {
			sb.WriteString("\n")
			sb.WriteString(config.SystemPrompt)
			sb.WriteString("\n")
		}
	}

	// Festival context
	sb.WriteString("\n\nContexte du festival:\n")
	sb.WriteString(fmt.Sprintf("- Nom: %s\n", conv.Context.FestivalName))
	sb.WriteString(fmt.Sprintf("- Dates: %s\n", conv.Context.FestivalDates))
	if conv.Context.CurrencyName != "" {
		sb.WriteString(fmt.Sprintf("- Monnaie: %s\n", conv.Context.CurrencyName))
	}

	// User context
	if conv.Context.HasTicket {
		sb.WriteString(fmt.Sprintf("- L'utilisateur a un billet de type: %s\n", conv.Context.TicketType))
	}
	if conv.Context.WalletBalance > 0 {
		sb.WriteString(fmt.Sprintf("- Solde wallet: %.2f %s\n", conv.Context.WalletBalance, conv.Context.CurrencyName))
	}

	// FAQ context
	if len(faqs) > 0 {
		sb.WriteString("\n\nInformations pertinentes de la FAQ:\n")
		for i, faq := range faqs {
			if i >= 3 {
				break // Limit to 3 FAQ entries to avoid token overflow
			}
			sb.WriteString(fmt.Sprintf("\nQ: %s\nR: %s\n", faq.Question, faq.Answer))
		}
	}

	// Instructions
	sb.WriteString("\n\nInstructions:\n")
	sb.WriteString("- Reponds toujours en francais\n")
	sb.WriteString("- Si tu ne connais pas la reponse, propose d'escalader vers un humain\n")
	sb.WriteString("- Utilise les informations de la FAQ quand elles sont pertinentes\n")
	sb.WriteString("- Sois precis sur les informations pratiques (horaires, lieux, prix)\n")
	sb.WriteString("- Ne fais pas de promesses que le festival ne peut pas tenir\n")

	return sb.String()
}

// GetSuggestedQuestions returns suggested questions for the festival
func (s *Service) GetSuggestedQuestions(ctx context.Context, festivalID uuid.UUID) []string {
	// Get config for custom suggestions
	config, err := s.repo.GetConfig(ctx, festivalID)
	if err == nil && config != nil && len(config.SuggestedQuestions) > 0 {
		return config.SuggestedQuestions
	}

	// Default suggestions
	return []string{
		"Quels sont les horaires du festival ?",
		"Comment fonctionne le paiement cashless ?",
		"Ou puis-je recharger mon bracelet ?",
		"Y a-t-il des consignes pour les objets ?",
		"Comment obtenir un remboursement ?",
	}
}

// SearchFAQ performs semantic search on FAQ entries
func (s *Service) SearchFAQ(ctx context.Context, query string, festivalID uuid.UUID) ([]FAQEntry, error) {
	// Generate embedding for the query
	embedding, err := s.aiClient.GenerateEmbedding(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to generate embedding: %w", err)
	}

	// Search by embedding similarity
	faqs, err := s.repo.SearchFAQByEmbedding(ctx, festivalID, embedding, 5)
	if err != nil {
		return nil, fmt.Errorf("failed to search FAQ: %w", err)
	}

	return faqs, nil
}

// EscalateConversation escalates a conversation to a human agent
func (s *Service) EscalateConversation(ctx context.Context, conversationID uuid.UUID, reason string) error {
	conv, err := s.repo.GetConversationByID(ctx, conversationID)
	if err != nil {
		return fmt.Errorf("failed to get conversation: %w", err)
	}
	if conv == nil {
		return fmt.Errorf("conversation not found")
	}

	now := time.Now()
	conv.Status = StatusEscalated
	conv.EscalatedAt = &now
	conv.UpdatedAt = now

	// Add escalation message
	escMsg := &Message{
		ID:             uuid.New(),
		ConversationID: conversationID,
		Role:           RoleSystem,
		Content:        fmt.Sprintf("Conversation escaladee vers un agent humain. Raison: %s", reason),
		CreatedAt:      now,
	}
	if err := s.repo.CreateMessage(ctx, escMsg); err != nil {
		return fmt.Errorf("failed to create escalation message: %w", err)
	}

	conv.MessageCount++
	return s.repo.UpdateConversation(ctx, conv)
}

// CloseConversation closes a conversation
func (s *Service) CloseConversation(ctx context.Context, conversationID uuid.UUID) error {
	conv, err := s.repo.GetConversationByID(ctx, conversationID)
	if err != nil {
		return fmt.Errorf("failed to get conversation: %w", err)
	}
	if conv == nil {
		return fmt.Errorf("conversation not found")
	}

	conv.Status = StatusClosed
	conv.UpdatedAt = time.Now()

	return s.repo.UpdateConversation(ctx, conv)
}

// RateConversation rates a conversation
func (s *Service) RateConversation(ctx context.Context, conversationID uuid.UUID, rating int, feedback string) error {
	conv, err := s.repo.GetConversationByID(ctx, conversationID)
	if err != nil {
		return fmt.Errorf("failed to get conversation: %w", err)
	}
	if conv == nil {
		return fmt.Errorf("conversation not found")
	}

	conv.Rating = &rating
	conv.Feedback = feedback
	conv.UpdatedAt = time.Now()

	return s.repo.UpdateConversation(ctx, conv)
}

// GetConversation returns a conversation by ID
func (s *Service) GetConversation(ctx context.Context, conversationID uuid.UUID) (*Conversation, error) {
	return s.repo.GetConversationWithMessages(ctx, conversationID)
}

// ListConversations returns paginated conversations for a festival
func (s *Service) ListConversations(ctx context.Context, festivalID uuid.UUID, status *ConversationStatus, page, perPage int) ([]Conversation, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListConversations(ctx, festivalID, status, offset, perPage)
}

// CreateFAQEntry creates a new FAQ entry
func (s *Service) CreateFAQEntry(ctx context.Context, festivalID uuid.UUID, req FAQEntryRequest) (*FAQEntry, error) {
	// Generate embedding for the question
	embedding, err := s.aiClient.GenerateEmbedding(ctx, req.Question+" "+req.Answer)
	if err != nil {
		// Non-fatal, continue without embedding
		fmt.Printf("failed to generate FAQ embedding: %v\n", err)
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	faq := &FAQEntry{
		ID:         uuid.New(),
		FestivalID: festivalID,
		Question:   req.Question,
		Answer:     req.Answer,
		Category:   req.Category,
		Tags:       pq.StringArray(req.Tags),
		Embedding:  pq.Float64Array(embedding),
		Priority:   req.Priority,
		IsActive:   isActive,
		HitCount:   0,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := s.repo.CreateFAQEntry(ctx, faq); err != nil {
		return nil, fmt.Errorf("failed to create FAQ entry: %w", err)
	}

	return faq, nil
}

// UpdateFAQEntry updates an existing FAQ entry
func (s *Service) UpdateFAQEntry(ctx context.Context, id uuid.UUID, req FAQEntryRequest) (*FAQEntry, error) {
	faq, err := s.repo.GetFAQByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get FAQ entry: %w", err)
	}
	if faq == nil {
		return nil, fmt.Errorf("FAQ entry not found")
	}

	// Update fields
	faq.Question = req.Question
	faq.Answer = req.Answer
	faq.Category = req.Category
	faq.Tags = pq.StringArray(req.Tags)
	faq.Priority = req.Priority
	if req.IsActive != nil {
		faq.IsActive = *req.IsActive
	}
	faq.UpdatedAt = time.Now()

	// Regenerate embedding
	embedding, err := s.aiClient.GenerateEmbedding(ctx, req.Question+" "+req.Answer)
	if err == nil {
		faq.Embedding = pq.Float64Array(embedding)
	}

	if err := s.repo.UpdateFAQEntry(ctx, faq); err != nil {
		return nil, fmt.Errorf("failed to update FAQ entry: %w", err)
	}

	return faq, nil
}

// DeleteFAQEntry deletes a FAQ entry
func (s *Service) DeleteFAQEntry(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteFAQEntry(ctx, id)
}

// ListFAQEntries returns paginated FAQ entries for a festival
func (s *Service) ListFAQEntries(ctx context.Context, festivalID uuid.UUID, category string, activeOnly bool, page, perPage int) ([]FAQEntry, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListFAQEntries(ctx, festivalID, category, activeOnly, offset, perPage)
}

// GetConfig returns the chatbot configuration for a festival
func (s *Service) GetConfig(ctx context.Context, festivalID uuid.UUID) (*ChatbotConfig, error) {
	config, err := s.repo.GetConfig(ctx, festivalID)
	if err != nil {
		return nil, err
	}

	// Return default config if none exists
	if config == nil {
		config = &ChatbotConfig{
			ID:                  uuid.New(),
			FestivalID:          festivalID,
			IsEnabled:           true,
			WelcomeMessage:      "Bonjour ! Je suis l'assistant virtuel du festival. Comment puis-je vous aider ?",
			Personality:         "friendly",
			Tone:                "helpful",
			Language:            "fr",
			MaxMessagesPerConv:  50,
			EscalationThreshold: 3,
			SuggestedQuestions:  pq.StringArray(s.GetSuggestedQuestions(ctx, festivalID)),
			CreatedAt:           time.Now(),
			UpdatedAt:           time.Now(),
		}
	}

	return config, nil
}

// UpdateConfig updates the chatbot configuration
func (s *Service) UpdateConfig(ctx context.Context, festivalID uuid.UUID, req ChatbotConfigRequest) (*ChatbotConfig, error) {
	config, err := s.GetConfig(ctx, festivalID)
	if err != nil {
		return nil, err
	}

	// Apply updates
	if req.IsEnabled != nil {
		config.IsEnabled = *req.IsEnabled
	}
	if req.WelcomeMessage != nil {
		config.WelcomeMessage = *req.WelcomeMessage
	}
	if req.Personality != nil {
		config.Personality = *req.Personality
	}
	if req.Tone != nil {
		config.Tone = *req.Tone
	}
	if req.Language != nil {
		config.Language = *req.Language
	}
	if req.MaxMessagesPerConv != nil {
		config.MaxMessagesPerConv = *req.MaxMessagesPerConv
	}
	if req.EscalationThreshold != nil {
		config.EscalationThreshold = *req.EscalationThreshold
	}
	if req.SuggestedQuestions != nil {
		config.SuggestedQuestions = pq.StringArray(req.SuggestedQuestions)
	}
	if req.SystemPrompt != nil {
		config.SystemPrompt = *req.SystemPrompt
	}
	config.UpdatedAt = time.Now()

	if err := s.repo.CreateOrUpdateConfig(ctx, config); err != nil {
		return nil, fmt.Errorf("failed to update config: %w", err)
	}

	return config, nil
}

// GetAnalytics returns analytics for the chatbot
func (s *Service) GetAnalytics(ctx context.Context, festivalID uuid.UUID, days int) (*AnalyticsResponse, error) {
	if days < 1 {
		days = 7
	}
	if days > 90 {
		days = 90
	}

	analytics, err := s.repo.GetAnalytics(ctx, festivalID, days)
	if err != nil {
		return nil, err
	}

	// Calculate rates
	escalationRate := 0.0
	resolutionRate := 0.0
	if analytics.TotalConversations > 0 {
		escalationRate = float64(analytics.EscalatedCount) / float64(analytics.TotalConversations) * 100
		resolutionRate = float64(analytics.ResolvedCount) / float64(analytics.TotalConversations) * 100
	}

	return &AnalyticsResponse{
		TotalConversations: analytics.TotalConversations,
		TotalMessages:      analytics.TotalMessages,
		AvgMessagesPerConv: analytics.AvgMessagesPerConv,
		EscalatedCount:     analytics.EscalatedCount,
		ResolvedCount:      analytics.ResolvedCount,
		AvgResponseTime:    analytics.AvgResponseTime,
		AvgRating:          analytics.AvgRating,
		TopQuestions:       analytics.TopQuestions,
		EscalationRate:     escalationRate,
		ResolutionRate:     resolutionRate,
	}, nil
}
