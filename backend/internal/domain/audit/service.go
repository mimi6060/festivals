package audit

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/rs/zerolog/log"
)

// Service handles audit log business logic
type Service struct {
	repo Repository
}

// NewService creates a new audit service
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// LogAction creates a new audit log entry
func (s *Service) LogAction(ctx context.Context, req CreateAuditLogRequest) (*AuditLog, error) {
	if !req.Action.IsValid() {
		return nil, errors.ErrValidation
	}

	if req.Resource == "" {
		return nil, fmt.Errorf("resource is required")
	}

	auditLog := &AuditLog{
		ID:         uuid.New(),
		UserID:     req.UserID,
		Action:     req.Action,
		Resource:   req.Resource,
		ResourceID: req.ResourceID,
		IP:         req.IP,
		UserAgent:  req.UserAgent,
		FestivalID: req.FestivalID,
		Timestamp:  time.Now(),
	}

	if req.Changes != nil {
		auditLog.Changes = *req.Changes
	}

	if req.Metadata != nil {
		auditLog.Metadata = req.Metadata
	}

	if err := s.repo.Create(ctx, auditLog); err != nil {
		log.Error().Err(err).
			Str("action", string(req.Action)).
			Str("resource", req.Resource).
			Msg("Failed to create audit log")
		return nil, fmt.Errorf("failed to create audit log: %w", err)
	}

	log.Debug().
		Str("action", string(req.Action)).
		Str("resource", req.Resource).
		Str("resource_id", req.ResourceID).
		Msg("Audit log created")

	return auditLog, nil
}

// LogActionAsync creates a new audit log entry asynchronously (fire and forget)
func (s *Service) LogActionAsync(ctx context.Context, req CreateAuditLogRequest) {
	go func() {
		// Use a new context with timeout to avoid issues with canceled parent context
		asyncCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if _, err := s.LogAction(asyncCtx, req); err != nil {
			log.Error().Err(err).
				Str("action", string(req.Action)).
				Str("resource", req.Resource).
				Msg("Failed to create audit log asynchronously")
		}
	}()
}

// LogBatch creates multiple audit log entries in a batch
func (s *Service) LogBatch(ctx context.Context, requests []CreateAuditLogRequest) error {
	if len(requests) == 0 {
		return nil
	}

	logs := make([]*AuditLog, 0, len(requests))
	for _, req := range requests {
		if !req.Action.IsValid() {
			continue
		}

		auditLog := &AuditLog{
			ID:         uuid.New(),
			UserID:     req.UserID,
			Action:     req.Action,
			Resource:   req.Resource,
			ResourceID: req.ResourceID,
			IP:         req.IP,
			UserAgent:  req.UserAgent,
			FestivalID: req.FestivalID,
			Timestamp:  time.Now(),
		}

		if req.Changes != nil {
			auditLog.Changes = *req.Changes
		}

		if req.Metadata != nil {
			auditLog.Metadata = req.Metadata
		}

		logs = append(logs, auditLog)
	}

	if err := s.repo.CreateBatch(ctx, logs); err != nil {
		return fmt.Errorf("failed to create audit logs batch: %w", err)
	}

	return nil
}

// GetByID retrieves an audit log by ID
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*AuditLog, error) {
	log, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if log == nil {
		return nil, errors.ErrNotFound
	}
	return log, nil
}

// List retrieves a paginated list of audit logs with filters
func (s *Service) List(ctx context.Context, filter AuditLogFilter, page, perPage int) ([]AuditLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.List(ctx, filter, offset, perPage)
}

// GetByUserID retrieves audit logs for a specific user
func (s *Service) GetByUserID(ctx context.Context, userID uuid.UUID, page, perPage int) ([]AuditLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetByUserID(ctx, userID, offset, perPage)
}

// GetByResource retrieves audit logs for a specific resource
func (s *Service) GetByResource(ctx context.Context, resource, resourceID string, page, perPage int) ([]AuditLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetByResource(ctx, resource, resourceID, offset, perPage)
}

// GetByFestivalID retrieves audit logs for a specific festival
func (s *Service) GetByFestivalID(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]AuditLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetByFestivalID(ctx, festivalID, offset, perPage)
}

// GetByAction retrieves audit logs for a specific action
func (s *Service) GetByAction(ctx context.Context, action AuditAction, page, perPage int) ([]AuditLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetByAction(ctx, action, offset, perPage)
}

// GetByTimeRange retrieves audit logs within a time range
func (s *Service) GetByTimeRange(ctx context.Context, start, end time.Time, page, perPage int) ([]AuditLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetByTimeRange(ctx, start, end, offset, perPage)
}

// GetStats retrieves aggregated statistics for audit logs
func (s *Service) GetStats(ctx context.Context, filter AuditLogFilter) (*AuditLogStats, error) {
	return s.repo.GetStats(ctx, filter)
}

// Export exports audit logs in the specified format
func (s *Service) Export(ctx context.Context, req ExportRequest) ([]byte, string, error) {
	if !req.Format.IsValid() {
		return nil, "", fmt.Errorf("invalid export format: %s", req.Format)
	}

	// Get all logs matching the filter (with a reasonable limit)
	logs, _, err := s.repo.List(ctx, req.Filter, 0, 10000)
	if err != nil {
		return nil, "", fmt.Errorf("failed to retrieve audit logs for export: %w", err)
	}

	// Log the export action
	s.LogActionAsync(ctx, CreateAuditLogRequest{
		Action:   ActionDataExport,
		Resource: "audit_logs",
		Metadata: map[string]interface{}{
			"format":     req.Format,
			"count":      len(logs),
			"has_filter": req.Filter.UserID != nil || req.Filter.FestivalID != nil ||
				len(req.Filter.Actions) > 0 || len(req.Filter.Resources) > 0,
		},
	})

	switch req.Format {
	case ExportFormatCSV:
		return s.exportCSV(logs)
	case ExportFormatJSON:
		return s.exportJSON(logs)
	default:
		return nil, "", fmt.Errorf("unsupported export format: %s", req.Format)
	}
}

func (s *Service) exportCSV(logs []AuditLog) ([]byte, string, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// Write header
	header := []string{"ID", "UserID", "Action", "Category", "Resource", "ResourceID", "IP", "UserAgent", "FestivalID", "Timestamp"}
	if err := writer.Write(header); err != nil {
		return nil, "", fmt.Errorf("failed to write CSV header: %w", err)
	}

	// Write rows
	for _, log := range logs {
		userID := ""
		if log.UserID != nil {
			userID = log.UserID.String()
		}
		festivalID := ""
		if log.FestivalID != nil {
			festivalID = log.FestivalID.String()
		}

		row := []string{
			log.ID.String(),
			userID,
			string(log.Action),
			log.Action.Category(),
			log.Resource,
			log.ResourceID,
			log.IP,
			log.UserAgent,
			festivalID,
			log.Timestamp.Format(time.RFC3339),
		}
		if err := writer.Write(row); err != nil {
			return nil, "", fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, "", fmt.Errorf("failed to flush CSV writer: %w", err)
	}

	return buf.Bytes(), "text/csv", nil
}

func (s *Service) exportJSON(logs []AuditLog) ([]byte, string, error) {
	responses := make([]AuditLogResponse, len(logs))
	for i, log := range logs {
		responses[i] = log.ToResponse()
	}

	data, err := json.MarshalIndent(responses, "", "  ")
	if err != nil {
		return nil, "", fmt.Errorf("failed to marshal JSON: %w", err)
	}

	return data, "application/json", nil
}

// CleanupOldLogs deletes audit logs older than the specified retention period
func (s *Service) CleanupOldLogs(ctx context.Context, retentionDays int) (int64, error) {
	if retentionDays < 1 {
		return 0, fmt.Errorf("retention days must be at least 1")
	}

	cutoffTime := time.Now().AddDate(0, 0, -retentionDays)
	deleted, err := s.repo.DeleteOlderThan(ctx, cutoffTime)
	if err != nil {
		return 0, err
	}

	if deleted > 0 {
		log.Info().
			Int64("deleted", deleted).
			Int("retention_days", retentionDays).
			Msg("Cleaned up old audit logs")
	}

	return deleted, nil
}

// Helper functions for creating audit log requests

// NewUserActionLog creates an audit log request for user actions
func NewUserActionLog(userID *uuid.UUID, action AuditAction, resource, resourceID, ip, userAgent string) CreateAuditLogRequest {
	return CreateAuditLogRequest{
		UserID:     userID,
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		IP:         ip,
		UserAgent:  userAgent,
	}
}

// NewChangeLog creates an audit log request that captures before/after changes
func NewChangeLog(userID *uuid.UUID, action AuditAction, resource, resourceID string, before, after map[string]interface{}) CreateAuditLogRequest {
	return CreateAuditLogRequest{
		UserID:     userID,
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		Changes: &Changes{
			Before: before,
			After:  after,
		},
	}
}

// NewFestivalActionLog creates an audit log request for festival-scoped actions
func NewFestivalActionLog(userID, festivalID *uuid.UUID, action AuditAction, resource, resourceID, ip, userAgent string) CreateAuditLogRequest {
	return CreateAuditLogRequest{
		UserID:     userID,
		FestivalID: festivalID,
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		IP:         ip,
		UserAgent:  userAgent,
	}
}

// NewSecurityLog creates an audit log request for security-related events
func NewSecurityLog(userID *uuid.UUID, action AuditAction, resource, ip, userAgent string, metadata map[string]interface{}) CreateAuditLogRequest {
	return CreateAuditLogRequest{
		UserID:    userID,
		Action:    action,
		Resource:  resource,
		IP:        ip,
		UserAgent: userAgent,
		Metadata:  metadata,
	}
}
