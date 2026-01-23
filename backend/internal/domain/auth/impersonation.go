package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// Impersonation errors
var (
	ErrImpersonationNotFound      = errors.New("impersonation session not found")
	ErrImpersonationExpired       = errors.New("impersonation session has expired")
	ErrCannotImpersonateSuperAdmin = errors.New("cannot impersonate super admin users")
	ErrCannotImpersonateSelf      = errors.New("cannot impersonate yourself")
	ErrNotSuperAdmin              = errors.New("only super admins can impersonate users")
	ErrInvalidImpersonationToken  = errors.New("invalid impersonation token")
)

// ImpersonationSession represents an active impersonation session
type ImpersonationSession struct {
	ID             uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Token          string     `json:"token" gorm:"type:varchar(128);uniqueIndex;not null"`
	AdminID        uuid.UUID  `json:"adminId" gorm:"type:uuid;not null;index"`
	TargetUserID   uuid.UUID  `json:"targetUserId" gorm:"type:uuid;not null;index"`
	AdminEmail     string     `json:"adminEmail" gorm:"type:varchar(255)"`
	TargetUserEmail string    `json:"targetUserEmail" gorm:"type:varchar(255)"`
	TargetUserName  string    `json:"targetUserName" gorm:"type:varchar(255)"`
	Reason         string     `json:"reason" gorm:"type:text"`
	IPAddress      string     `json:"ipAddress" gorm:"type:varchar(45)"`
	UserAgent      string     `json:"userAgent" gorm:"type:text"`
	StartedAt      time.Time  `json:"startedAt" gorm:"default:now()"`
	ExpiresAt      time.Time  `json:"expiresAt" gorm:"not null;index"`
	EndedAt        *time.Time `json:"endedAt,omitempty"`
	IsActive       bool       `json:"isActive" gorm:"default:true;index"`
	ActionsCount   int        `json:"actionsCount" gorm:"default:0"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

func (ImpersonationSession) TableName() string {
	return "public.impersonation_sessions"
}

// IsExpired checks if the session has expired
func (s *ImpersonationSession) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// IsValid checks if the session is still valid
func (s *ImpersonationSession) IsValid() bool {
	return s.IsActive && !s.IsExpired() && s.EndedAt == nil
}

// ImpersonationAuditLog represents an audit log entry for impersonation actions
type ImpersonationAuditLog struct {
	ID               uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	SessionID        uuid.UUID `json:"sessionId" gorm:"type:uuid;not null;index"`
	AdminID          uuid.UUID `json:"adminId" gorm:"type:uuid;not null;index"`
	TargetUserID     uuid.UUID `json:"targetUserId" gorm:"type:uuid;not null;index"`
	Action           string    `json:"action" gorm:"type:varchar(100);not null;index"`
	Resource         string    `json:"resource" gorm:"type:varchar(100)"`
	ResourceID       string    `json:"resourceId" gorm:"type:varchar(100)"`
	Method           string    `json:"method" gorm:"type:varchar(10)"`
	Path             string    `json:"path" gorm:"type:text"`
	RequestBody      string    `json:"requestBody" gorm:"type:jsonb"`
	ResponseStatus   int       `json:"responseStatus"`
	IPAddress        string    `json:"ipAddress" gorm:"type:varchar(45)"`
	UserAgent        string    `json:"userAgent" gorm:"type:text"`
	CreatedAt        time.Time `json:"createdAt" gorm:"index"`
}

func (ImpersonationAuditLog) TableName() string {
	return "public.impersonation_audit_logs"
}

// ImpersonationAuditAction defines audit action types for impersonation
type ImpersonationAuditAction string

const (
	ImpersonationAuditStart   ImpersonationAuditAction = "impersonation_start"
	ImpersonationAuditEnd     ImpersonationAuditAction = "impersonation_end"
	ImpersonationAuditAction_ ImpersonationAuditAction = "impersonation_action"
	ImpersonationAuditExpired ImpersonationAuditAction = "impersonation_expired"
)

// StartImpersonationRequest represents a request to start impersonation
type StartImpersonationRequest struct {
	TargetUserID uuid.UUID `json:"targetUserId" binding:"required"`
	Reason       string    `json:"reason"`
}

// ImpersonationSessionResponse represents the API response for an impersonation session
type ImpersonationSessionResponse struct {
	ID              uuid.UUID  `json:"id"`
	Token           string     `json:"token,omitempty"` // Only returned when starting
	AdminID         uuid.UUID  `json:"adminId"`
	TargetUserID    uuid.UUID  `json:"targetUserId"`
	AdminEmail      string     `json:"adminEmail"`
	TargetUserEmail string     `json:"targetUserEmail"`
	TargetUserName  string     `json:"targetUserName"`
	Reason          string     `json:"reason"`
	IPAddress       string     `json:"ipAddress"`
	StartedAt       string     `json:"startedAt"`
	ExpiresAt       string     `json:"expiresAt"`
	EndedAt         *string    `json:"endedAt,omitempty"`
	IsActive        bool       `json:"isActive"`
	ActionsCount    int        `json:"actionsCount"`
}

// ToResponse converts ImpersonationSession to ImpersonationSessionResponse
func (s *ImpersonationSession) ToResponse(includeToken bool) ImpersonationSessionResponse {
	resp := ImpersonationSessionResponse{
		ID:              s.ID,
		AdminID:         s.AdminID,
		TargetUserID:    s.TargetUserID,
		AdminEmail:      s.AdminEmail,
		TargetUserEmail: s.TargetUserEmail,
		TargetUserName:  s.TargetUserName,
		Reason:          s.Reason,
		IPAddress:       s.IPAddress,
		StartedAt:       s.StartedAt.Format(time.RFC3339),
		ExpiresAt:       s.ExpiresAt.Format(time.RFC3339),
		IsActive:        s.IsActive,
		ActionsCount:    s.ActionsCount,
	}
	if includeToken {
		resp.Token = s.Token
	}
	if s.EndedAt != nil {
		ended := s.EndedAt.Format(time.RFC3339)
		resp.EndedAt = &ended
	}
	return resp
}

// ImpersonationService defines the interface for impersonation operations
type ImpersonationService interface {
	// StartImpersonation starts a new impersonation session
	StartImpersonation(ctx context.Context, adminID uuid.UUID, req StartImpersonationRequest, ipAddress, userAgent string) (*ImpersonationSession, error)

	// ValidateImpersonation validates an impersonation token and returns the session
	ValidateImpersonation(ctx context.Context, token string) (*ImpersonationSession, error)

	// EndImpersonation ends an impersonation session
	EndImpersonation(ctx context.Context, token string) error

	// GetActiveSession gets the active session for an admin
	GetActiveSession(ctx context.Context, adminID uuid.UUID) (*ImpersonationSession, error)

	// ListActiveSessions lists all active impersonation sessions
	ListActiveSessions(ctx context.Context) ([]ImpersonationSession, error)

	// LogImpersonationAction logs an action performed during impersonation
	LogImpersonationAction(ctx context.Context, sessionID uuid.UUID, method, path, requestBody string, responseStatus int, ipAddress, userAgent string)

	// IncrementActionsCount increments the actions count for a session
	IncrementActionsCount(ctx context.Context, sessionID uuid.UUID) error

	// CleanupExpiredSessions marks expired sessions as inactive
	CleanupExpiredSessions(ctx context.Context) error
}

// ImpersonationRepository defines the data access interface
type ImpersonationRepository interface {
	CreateSession(ctx context.Context, session *ImpersonationSession) error
	GetSessionByToken(ctx context.Context, token string) (*ImpersonationSession, error)
	GetSessionByID(ctx context.Context, id uuid.UUID) (*ImpersonationSession, error)
	GetActiveSessionByAdmin(ctx context.Context, adminID uuid.UUID) (*ImpersonationSession, error)
	UpdateSession(ctx context.Context, session *ImpersonationSession) error
	ListActiveSessions(ctx context.Context) ([]ImpersonationSession, error)
	EndSession(ctx context.Context, token string) error
	IncrementActionsCount(ctx context.Context, sessionID uuid.UUID) error
	CleanupExpiredSessions(ctx context.Context) error
	CreateAuditLog(ctx context.Context, log *ImpersonationAuditLog) error
}

// UserInfoProvider provides user information for impersonation
type UserInfoProvider interface {
	GetUserEmail(ctx context.Context, userID uuid.UUID) (string, error)
	GetUserName(ctx context.Context, userID uuid.UUID) (string, error)
	IsSuperAdmin(ctx context.Context, userID uuid.UUID) bool
}

// impersonationService implements ImpersonationService
type impersonationService struct {
	repo         ImpersonationRepository
	rbacService  RBACService
	userProvider UserInfoProvider
	sessionTTL   time.Duration
	tokenCache   sync.Map // token -> *ImpersonationSession for fast validation
}

// NewImpersonationService creates a new impersonation service
func NewImpersonationService(repo ImpersonationRepository, rbacService RBACService, userProvider UserInfoProvider) ImpersonationService {
	return &impersonationService{
		repo:         repo,
		rbacService:  rbacService,
		userProvider: userProvider,
		sessionTTL:   2 * time.Hour, // Default 2 hour session
	}
}

// generateToken generates a secure random token
func generateToken() (string, error) {
	bytes := make([]byte, 64)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func (s *impersonationService) StartImpersonation(ctx context.Context, adminID uuid.UUID, req StartImpersonationRequest, ipAddress, userAgent string) (*ImpersonationSession, error) {
	// Check if admin is a super admin
	if !s.rbacService.IsSuperAdmin(ctx, adminID) {
		log.Warn().
			Str("adminID", adminID.String()).
			Msg("Non-super admin attempted impersonation")
		return nil, ErrNotSuperAdmin
	}

	// Cannot impersonate self
	if adminID == req.TargetUserID {
		return nil, ErrCannotImpersonateSelf
	}

	// Cannot impersonate other super admins
	if s.rbacService.IsSuperAdmin(ctx, req.TargetUserID) {
		log.Warn().
			Str("adminID", adminID.String()).
			Str("targetUserID", req.TargetUserID.String()).
			Msg("Attempted to impersonate super admin")
		return nil, ErrCannotImpersonateSuperAdmin
	}

	// Check for existing active session and end it
	existingSession, err := s.repo.GetActiveSessionByAdmin(ctx, adminID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing session: %w", err)
	}
	if existingSession != nil {
		if err := s.EndImpersonation(ctx, existingSession.Token); err != nil {
			log.Warn().Err(err).Msg("Failed to end existing impersonation session")
		}
	}

	// Generate token
	token, err := generateToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// Get user info
	adminEmail, _ := s.userProvider.GetUserEmail(ctx, adminID)
	targetEmail, _ := s.userProvider.GetUserEmail(ctx, req.TargetUserID)
	targetName, _ := s.userProvider.GetUserName(ctx, req.TargetUserID)

	// Create session
	session := &ImpersonationSession{
		Token:           token,
		AdminID:         adminID,
		TargetUserID:    req.TargetUserID,
		AdminEmail:      adminEmail,
		TargetUserEmail: targetEmail,
		TargetUserName:  targetName,
		Reason:          req.Reason,
		IPAddress:       ipAddress,
		UserAgent:       userAgent,
		StartedAt:       time.Now(),
		ExpiresAt:       time.Now().Add(s.sessionTTL),
		IsActive:        true,
		ActionsCount:    0,
	}

	if err := s.repo.CreateSession(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	// Cache the session
	s.tokenCache.Store(token, session)

	// Log the impersonation start
	auditLog := &ImpersonationAuditLog{
		SessionID:    session.ID,
		AdminID:      adminID,
		TargetUserID: req.TargetUserID,
		Action:       string(ImpersonationAuditStart),
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
	}
	s.repo.CreateAuditLog(ctx, auditLog)

	log.Info().
		Str("adminID", adminID.String()).
		Str("adminEmail", adminEmail).
		Str("targetUserID", req.TargetUserID.String()).
		Str("targetEmail", targetEmail).
		Str("reason", req.Reason).
		Str("sessionID", session.ID.String()).
		Msg("Impersonation session started")

	return session, nil
}

func (s *impersonationService) ValidateImpersonation(ctx context.Context, token string) (*ImpersonationSession, error) {
	if token == "" {
		return nil, ErrInvalidImpersonationToken
	}

	// Check cache first
	if cached, ok := s.tokenCache.Load(token); ok {
		session := cached.(*ImpersonationSession)
		if session.IsValid() {
			return session, nil
		}
		// Session expired or ended, remove from cache
		s.tokenCache.Delete(token)
	}

	// Get from database
	session, err := s.repo.GetSessionByToken(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	if session == nil {
		return nil, ErrImpersonationNotFound
	}

	if !session.IsActive {
		return nil, ErrImpersonationNotFound
	}

	if session.IsExpired() {
		// Mark session as inactive
		session.IsActive = false
		s.repo.UpdateSession(ctx, session)

		// Log expiration
		auditLog := &ImpersonationAuditLog{
			SessionID:    session.ID,
			AdminID:      session.AdminID,
			TargetUserID: session.TargetUserID,
			Action:       string(ImpersonationAuditExpired),
		}
		s.repo.CreateAuditLog(ctx, auditLog)

		return nil, ErrImpersonationExpired
	}

	// Cache valid session
	s.tokenCache.Store(token, session)

	return session, nil
}

func (s *impersonationService) EndImpersonation(ctx context.Context, token string) error {
	session, err := s.repo.GetSessionByToken(ctx, token)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}
	if session == nil {
		return ErrImpersonationNotFound
	}

	if err := s.repo.EndSession(ctx, token); err != nil {
		return fmt.Errorf("failed to end session: %w", err)
	}

	// Remove from cache
	s.tokenCache.Delete(token)

	// Log the impersonation end
	auditLog := &ImpersonationAuditLog{
		SessionID:    session.ID,
		AdminID:      session.AdminID,
		TargetUserID: session.TargetUserID,
		Action:       string(ImpersonationAuditEnd),
	}
	s.repo.CreateAuditLog(ctx, auditLog)

	log.Info().
		Str("adminID", session.AdminID.String()).
		Str("targetUserID", session.TargetUserID.String()).
		Str("sessionID", session.ID.String()).
		Int("actionsCount", session.ActionsCount).
		Msg("Impersonation session ended")

	return nil
}

func (s *impersonationService) GetActiveSession(ctx context.Context, adminID uuid.UUID) (*ImpersonationSession, error) {
	return s.repo.GetActiveSessionByAdmin(ctx, adminID)
}

func (s *impersonationService) ListActiveSessions(ctx context.Context) ([]ImpersonationSession, error) {
	return s.repo.ListActiveSessions(ctx)
}

func (s *impersonationService) LogImpersonationAction(ctx context.Context, sessionID uuid.UUID, method, path, requestBody string, responseStatus int, ipAddress, userAgent string) {
	session, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil || session == nil {
		return
	}

	auditLog := &ImpersonationAuditLog{
		SessionID:      sessionID,
		AdminID:        session.AdminID,
		TargetUserID:   session.TargetUserID,
		Action:         string(ImpersonationAuditAction_),
		Method:         method,
		Path:           path,
		RequestBody:    requestBody,
		ResponseStatus: responseStatus,
		IPAddress:      ipAddress,
		UserAgent:      userAgent,
	}

	if err := s.repo.CreateAuditLog(ctx, auditLog); err != nil {
		log.Error().Err(err).Msg("Failed to create impersonation audit log")
	}
}

func (s *impersonationService) IncrementActionsCount(ctx context.Context, sessionID uuid.UUID) error {
	return s.repo.IncrementActionsCount(ctx, sessionID)
}

func (s *impersonationService) CleanupExpiredSessions(ctx context.Context) error {
	return s.repo.CleanupExpiredSessions(ctx)
}
