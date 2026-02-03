package audit

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// AuditLog represents an audit log entry tracking user actions in the system
type AuditLog struct {
	ID         uuid.UUID   `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID     *uuid.UUID  `json:"userId,omitempty" gorm:"type:uuid;index"`
	Action     AuditAction `json:"action" gorm:"type:varchar(50);not null;index"`
	Resource   string      `json:"resource" gorm:"type:varchar(100);not null;index"`
	ResourceID string      `json:"resourceId,omitempty" gorm:"type:varchar(100);index"`
	Changes    Changes     `json:"changes,omitempty" gorm:"type:jsonb"`
	IP         string      `json:"ip" gorm:"type:varchar(45)"`
	UserAgent  string      `json:"userAgent" gorm:"type:text"`
	Metadata   Metadata    `json:"metadata,omitempty" gorm:"type:jsonb"`
	FestivalID *uuid.UUID  `json:"festivalId,omitempty" gorm:"type:uuid;index"`
	Timestamp  time.Time   `json:"timestamp" gorm:"not null;index;default:now()"`
}

func (AuditLog) TableName() string {
	return "public.audit_logs"
}

// AuditAction represents the type of action being audited
type AuditAction string

const (
	// Authentication actions
	ActionLogin        AuditAction = "LOGIN"
	ActionLogout       AuditAction = "LOGOUT"
	ActionLoginFailed  AuditAction = "LOGIN_FAILED"
	ActionTokenRefresh AuditAction = "TOKEN_REFRESH"

	// User management actions
	ActionUserCreate  AuditAction = "USER_CREATE"
	ActionUserUpdate  AuditAction = "USER_UPDATE"
	ActionUserDelete  AuditAction = "USER_DELETE"
	ActionUserBan     AuditAction = "USER_BAN"
	ActionUserUnban   AuditAction = "USER_UNBAN"
	ActionRoleChange  AuditAction = "ROLE_CHANGE"

	// Festival management actions
	ActionFestivalCreate AuditAction = "FESTIVAL_CREATE"
	ActionFestivalUpdate AuditAction = "FESTIVAL_UPDATE"
	ActionFestivalDelete AuditAction = "FESTIVAL_DELETE"

	// Ticket actions
	ActionTicketCreate   AuditAction = "TICKET_CREATE"
	ActionTicketUpdate   AuditAction = "TICKET_UPDATE"
	ActionTicketValidate AuditAction = "TICKET_VALIDATE"
	ActionTicketTransfer AuditAction = "TICKET_TRANSFER"
	ActionTicketRefund   AuditAction = "TICKET_REFUND"

	// Wallet/Payment actions
	ActionWalletCreate    AuditAction = "WALLET_CREATE"
	ActionWalletTopup     AuditAction = "WALLET_TOPUP"
	ActionWalletPayment   AuditAction = "WALLET_PAYMENT"
	ActionWalletRefund    AuditAction = "WALLET_REFUND"
	ActionWalletTransfer  AuditAction = "WALLET_TRANSFER"

	// Order actions
	ActionOrderCreate AuditAction = "ORDER_CREATE"
	ActionOrderUpdate AuditAction = "ORDER_UPDATE"
	ActionOrderCancel AuditAction = "ORDER_CANCEL"
	ActionOrderRefund AuditAction = "ORDER_REFUND"

	// Stand actions
	ActionStandCreate AuditAction = "STAND_CREATE"
	ActionStandUpdate AuditAction = "STAND_UPDATE"
	ActionStandDelete AuditAction = "STAND_DELETE"

	// Product actions
	ActionProductCreate AuditAction = "PRODUCT_CREATE"
	ActionProductUpdate AuditAction = "PRODUCT_UPDATE"
	ActionProductDelete AuditAction = "PRODUCT_DELETE"

	// Lineup actions
	ActionArtistCreate AuditAction = "ARTIST_CREATE"
	ActionArtistUpdate AuditAction = "ARTIST_UPDATE"
	ActionArtistDelete AuditAction = "ARTIST_DELETE"
	ActionStageCreate  AuditAction = "STAGE_CREATE"
	ActionStageUpdate  AuditAction = "STAGE_UPDATE"
	ActionStageDelete  AuditAction = "STAGE_DELETE"

	// Security actions
	ActionSecurityAlert   AuditAction = "SECURITY_ALERT"
	ActionAccessDenied    AuditAction = "ACCESS_DENIED"
	ActionSuspiciousActivity AuditAction = "SUSPICIOUS_ACTIVITY"

	// Settings/Configuration actions
	ActionSettingsUpdate AuditAction = "SETTINGS_UPDATE"
	ActionAPIKeyCreate   AuditAction = "API_KEY_CREATE"
	ActionAPIKeyRevoke   AuditAction = "API_KEY_REVOKE"

	// Data export actions
	ActionDataExport AuditAction = "DATA_EXPORT"
	ActionReportGenerate AuditAction = "REPORT_GENERATE"

	// Generic CRUD actions
	ActionCreate AuditAction = "CREATE"
	ActionRead   AuditAction = "READ"
	ActionUpdate AuditAction = "UPDATE"
	ActionDelete AuditAction = "DELETE"
)

// IsValid checks if the action is a valid AuditAction
func (a AuditAction) IsValid() bool {
	validActions := map[AuditAction]bool{
		ActionLogin: true, ActionLogout: true, ActionLoginFailed: true, ActionTokenRefresh: true,
		ActionUserCreate: true, ActionUserUpdate: true, ActionUserDelete: true, ActionUserBan: true,
		ActionUserUnban: true, ActionRoleChange: true,
		ActionFestivalCreate: true, ActionFestivalUpdate: true, ActionFestivalDelete: true,
		ActionTicketCreate: true, ActionTicketUpdate: true, ActionTicketValidate: true,
		ActionTicketTransfer: true, ActionTicketRefund: true,
		ActionWalletCreate: true, ActionWalletTopup: true, ActionWalletPayment: true,
		ActionWalletRefund: true, ActionWalletTransfer: true,
		ActionOrderCreate: true, ActionOrderUpdate: true, ActionOrderCancel: true, ActionOrderRefund: true,
		ActionStandCreate: true, ActionStandUpdate: true, ActionStandDelete: true,
		ActionProductCreate: true, ActionProductUpdate: true, ActionProductDelete: true,
		ActionArtistCreate: true, ActionArtistUpdate: true, ActionArtistDelete: true,
		ActionStageCreate: true, ActionStageUpdate: true, ActionStageDelete: true,
		ActionSecurityAlert: true, ActionAccessDenied: true, ActionSuspiciousActivity: true,
		ActionSettingsUpdate: true, ActionAPIKeyCreate: true, ActionAPIKeyRevoke: true,
		ActionDataExport: true, ActionReportGenerate: true,
		ActionCreate: true, ActionRead: true, ActionUpdate: true, ActionDelete: true,
	}
	return validActions[a]
}

// String returns the string representation of the action
func (a AuditAction) String() string {
	return string(a)
}

// Category returns the category of the audit action
func (a AuditAction) Category() string {
	switch a {
	case ActionLogin, ActionLogout, ActionLoginFailed, ActionTokenRefresh:
		return "authentication"
	case ActionUserCreate, ActionUserUpdate, ActionUserDelete, ActionUserBan, ActionUserUnban, ActionRoleChange:
		return "user_management"
	case ActionFestivalCreate, ActionFestivalUpdate, ActionFestivalDelete:
		return "festival_management"
	case ActionTicketCreate, ActionTicketUpdate, ActionTicketValidate, ActionTicketTransfer, ActionTicketRefund:
		return "ticketing"
	case ActionWalletCreate, ActionWalletTopup, ActionWalletPayment, ActionWalletRefund, ActionWalletTransfer:
		return "payments"
	case ActionOrderCreate, ActionOrderUpdate, ActionOrderCancel, ActionOrderRefund:
		return "orders"
	case ActionStandCreate, ActionStandUpdate, ActionStandDelete:
		return "stands"
	case ActionProductCreate, ActionProductUpdate, ActionProductDelete:
		return "products"
	case ActionArtistCreate, ActionArtistUpdate, ActionArtistDelete, ActionStageCreate, ActionStageUpdate, ActionStageDelete:
		return "lineup"
	case ActionSecurityAlert, ActionAccessDenied, ActionSuspiciousActivity:
		return "security"
	case ActionSettingsUpdate, ActionAPIKeyCreate, ActionAPIKeyRevoke:
		return "configuration"
	case ActionDataExport, ActionReportGenerate:
		return "exports"
	default:
		return "general"
	}
}

// Changes represents the before/after state of a resource change
type Changes struct {
	Before map[string]interface{} `json:"before,omitempty"`
	After  map[string]interface{} `json:"after,omitempty"`
}

func (c Changes) Value() (driver.Value, error) {
	if c.Before == nil && c.After == nil {
		return nil, nil
	}
	return json.Marshal(c)
}

func (c *Changes) Scan(value interface{}) error {
	if value == nil {
		*c = Changes{}
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("failed to scan Changes: expected []byte, got %T", value)
	}

	return json.Unmarshal(bytes, c)
}

// Metadata represents additional context for an audit log entry
type Metadata map[string]interface{}

func (m Metadata) Value() (driver.Value, error) {
	if m == nil {
		return nil, nil
	}
	return json.Marshal(m)
}

func (m *Metadata) Scan(value interface{}) error {
	if value == nil {
		*m = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("failed to scan Metadata: expected []byte, got %T", value)
	}

	return json.Unmarshal(bytes, m)
}

// AuditLogFilter represents query filters for audit logs
type AuditLogFilter struct {
	UserID     *uuid.UUID
	FestivalID *uuid.UUID
	Actions    []AuditAction
	Resources  []string
	ResourceID string
	StartTime  *time.Time
	EndTime    *time.Time
	IP         string
	Category   string
}

// CreateAuditLogRequest represents the request to create an audit log entry
type CreateAuditLogRequest struct {
	UserID     *uuid.UUID             `json:"userId,omitempty"`
	Action     AuditAction            `json:"action" binding:"required"`
	Resource   string                 `json:"resource" binding:"required"`
	ResourceID string                 `json:"resourceId,omitempty"`
	Changes    *Changes               `json:"changes,omitempty"`
	IP         string                 `json:"ip,omitempty"`
	UserAgent  string                 `json:"userAgent,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	FestivalID *uuid.UUID             `json:"festivalId,omitempty"`
}

// AuditLogResponse represents the API response for an audit log entry
type AuditLogResponse struct {
	ID         uuid.UUID              `json:"id"`
	UserID     *uuid.UUID             `json:"userId,omitempty"`
	Action     AuditAction            `json:"action"`
	Category   string                 `json:"category"`
	Resource   string                 `json:"resource"`
	ResourceID string                 `json:"resourceId,omitempty"`
	Changes    *Changes               `json:"changes,omitempty"`
	IP         string                 `json:"ip,omitempty"`
	UserAgent  string                 `json:"userAgent,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	FestivalID *uuid.UUID             `json:"festivalId,omitempty"`
	Timestamp  string                 `json:"timestamp"`
}

// ToResponse converts an AuditLog to AuditLogResponse
func (a *AuditLog) ToResponse() AuditLogResponse {
	response := AuditLogResponse{
		ID:         a.ID,
		UserID:     a.UserID,
		Action:     a.Action,
		Category:   a.Action.Category(),
		Resource:   a.Resource,
		ResourceID: a.ResourceID,
		IP:         a.IP,
		UserAgent:  a.UserAgent,
		FestivalID: a.FestivalID,
		Timestamp:  a.Timestamp.Format(time.RFC3339),
	}

	if a.Changes.Before != nil || a.Changes.After != nil {
		response.Changes = &a.Changes
	}

	if a.Metadata != nil {
		response.Metadata = a.Metadata
	}

	return response
}

// AuditLogListResponse represents a paginated list of audit logs
type AuditLogListResponse struct {
	Logs  []AuditLogResponse `json:"logs"`
	Total int64              `json:"total"`
	Page  int                `json:"page"`
	Limit int                `json:"limit"`
}

// AuditLogStats represents aggregated audit log statistics
type AuditLogStats struct {
	TotalLogs       int64                   `json:"totalLogs"`
	ActionCounts    map[AuditAction]int64   `json:"actionCounts"`
	CategoryCounts  map[string]int64        `json:"categoryCounts"`
	ResourceCounts  map[string]int64        `json:"resourceCounts"`
	UniqueUsers     int64                   `json:"uniqueUsers"`
	TopUsers        []UserActionCount       `json:"topUsers,omitempty"`
	Period          string                  `json:"period"`
}

// UserActionCount represents a count of actions by a specific user
type UserActionCount struct {
	UserID uuid.UUID `json:"userId"`
	Count  int64     `json:"count"`
}

// ExportFormat represents supported export formats for audit logs
type ExportFormat string

const (
	ExportFormatCSV  ExportFormat = "csv"
	ExportFormatJSON ExportFormat = "json"
)

// IsValid checks if the export format is valid
func (f ExportFormat) IsValid() bool {
	return f == ExportFormatCSV || f == ExportFormatJSON
}

// ExportRequest represents a request to export audit logs
type ExportRequest struct {
	Filter AuditLogFilter `json:"filter"`
	Format ExportFormat   `json:"format"`
}
