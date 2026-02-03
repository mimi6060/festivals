package admin

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// SuperAdmin represents a platform super administrator
type SuperAdmin struct {
	ID          uuid.UUID        `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID      uuid.UUID        `json:"userId" gorm:"type:uuid;not null;uniqueIndex"`
	Permissions AdminPermissions `json:"permissions" gorm:"type:jsonb;default:'[]'"`
	CreatedAt   time.Time        `json:"createdAt"`
	UpdatedAt   time.Time        `json:"updatedAt"`
}

func (SuperAdmin) TableName() string {
	return "super_admins"
}

// AdminPermissions represents the permissions granted to a super admin
type AdminPermissions []string

// Common permission constants
const (
	PermissionManageAdmins     = "manage_admins"
	PermissionManageSettings   = "manage_settings"
	PermissionViewMetrics      = "view_metrics"
	PermissionViewAuditLogs    = "view_audit_logs"
	PermissionManageFestivals  = "manage_festivals"
	PermissionManageUsers      = "manage_users"
	PermissionFullAccess       = "full_access"
)

// Value implements the driver.Valuer interface for GORM
func (p AdminPermissions) Value() (driver.Value, error) {
	return json.Marshal(p)
}

// Scan implements the sql.Scanner interface for GORM
func (p *AdminPermissions) Scan(value interface{}) error {
	if value == nil {
		*p = []string{}
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, p)
}

// HasPermission checks if the admin has a specific permission
func (s *SuperAdmin) HasPermission(permission string) bool {
	for _, p := range s.Permissions {
		if p == PermissionFullAccess || p == permission {
			return true
		}
	}
	return false
}

// PlatformSettings represents a platform-wide configuration setting
type PlatformSettings struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Key         string    `json:"key" gorm:"uniqueIndex;not null;size:255"`
	Value       string    `json:"value" gorm:"type:text;not null"`
	Description string    `json:"description" gorm:"type:text"`
	UpdatedAt   time.Time `json:"updatedAt"`
	UpdatedBy   uuid.UUID `json:"updatedBy" gorm:"type:uuid"`
}

func (PlatformSettings) TableName() string {
	return "platform_settings"
}

// AuditLog represents an audit log entry for admin actions
type AuditLog struct {
	ID           uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	AdminID      uuid.UUID  `json:"adminId" gorm:"type:uuid;not null;index"`
	Action       string     `json:"action" gorm:"not null;size:100;index"`
	ResourceType string     `json:"resourceType" gorm:"not null;size:100;index"`
	ResourceID   *uuid.UUID `json:"resourceId,omitempty" gorm:"type:uuid;index"`
	Details      AuditDetails `json:"details" gorm:"type:jsonb;default:'{}'"`
	IPAddress    string     `json:"ipAddress" gorm:"size:45"`
	UserAgent    string     `json:"userAgent" gorm:"size:512"`
	CreatedAt    time.Time  `json:"createdAt" gorm:"index"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}

// AuditDetails contains additional details for an audit log entry
type AuditDetails map[string]interface{}

// Value implements the driver.Valuer interface for GORM
func (d AuditDetails) Value() (driver.Value, error) {
	return json.Marshal(d)
}

// Scan implements the sql.Scanner interface for GORM
func (d *AuditDetails) Scan(value interface{}) error {
	if value == nil {
		*d = make(map[string]interface{})
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, d)
}

// Common audit action constants
const (
	ActionCreate        = "CREATE"
	ActionUpdate        = "UPDATE"
	ActionDelete        = "DELETE"
	ActionLogin         = "LOGIN"
	ActionLogout        = "LOGOUT"
	ActionSettingChange = "SETTING_CHANGE"
	ActionPermissionChange = "PERMISSION_CHANGE"
)

// Common resource type constants
const (
	ResourceTypeSuperAdmin      = "super_admin"
	ResourceTypePlatformSetting = "platform_setting"
	ResourceTypeFestival        = "festival"
	ResourceTypeUser            = "user"
)

// SystemMetrics represents aggregated platform metrics
type SystemMetrics struct {
	ActiveFestivals   int64   `json:"activeFestivals"`
	TotalFestivals    int64   `json:"totalFestivals"`
	TotalUsers        int64   `json:"totalUsers"`
	TotalTransactions int64   `json:"totalTransactions"`
	RevenueToday      int64   `json:"revenueToday"`       // In cents
	RevenueThisMonth  int64   `json:"revenueThisMonth"`   // In cents
	ActiveWallets     int64   `json:"activeWallets"`
	TotalTicketsSold  int64   `json:"totalTicketsSold"`
}

// Request/Response types

// CreateSuperAdminRequest represents a request to create a super admin
type CreateSuperAdminRequest struct {
	UserID      uuid.UUID `json:"userId" binding:"required"`
	Permissions []string  `json:"permissions" binding:"required,min=1"`
}

// UpdateSuperAdminRequest represents a request to update a super admin
type UpdateSuperAdminRequest struct {
	Permissions []string `json:"permissions" binding:"required,min=1"`
}

// UpdateSettingRequest represents a request to update a platform setting
type UpdateSettingRequest struct {
	Value       string `json:"value" binding:"required"`
	Description string `json:"description"`
}

// AuditLogFilter represents filters for querying audit logs
type AuditLogFilter struct {
	AdminID      *uuid.UUID
	Action       string
	ResourceType string
	ResourceID   *uuid.UUID
	StartDate    *time.Time
	EndDate      *time.Time
	Page         int
	PerPage      int
}

// SuperAdminResponse represents the API response for a super admin
type SuperAdminResponse struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"userId"`
	Permissions []string  `json:"permissions"`
	CreatedAt   string    `json:"createdAt"`
	UpdatedAt   string    `json:"updatedAt"`
}

// ToResponse converts a SuperAdmin to SuperAdminResponse
func (s *SuperAdmin) ToResponse() SuperAdminResponse {
	return SuperAdminResponse{
		ID:          s.ID,
		UserID:      s.UserID,
		Permissions: s.Permissions,
		CreatedAt:   s.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   s.UpdatedAt.Format(time.RFC3339),
	}
}

// PlatformSettingsResponse represents the API response for platform settings
type PlatformSettingsResponse struct {
	ID          uuid.UUID `json:"id"`
	Key         string    `json:"key"`
	Value       string    `json:"value"`
	Description string    `json:"description"`
	UpdatedAt   string    `json:"updatedAt"`
	UpdatedBy   uuid.UUID `json:"updatedBy"`
}

// ToResponse converts PlatformSettings to PlatformSettingsResponse
func (p *PlatformSettings) ToResponse() PlatformSettingsResponse {
	return PlatformSettingsResponse{
		ID:          p.ID,
		Key:         p.Key,
		Value:       p.Value,
		Description: p.Description,
		UpdatedAt:   p.UpdatedAt.Format(time.RFC3339),
		UpdatedBy:   p.UpdatedBy,
	}
}

// AuditLogResponse represents the API response for an audit log entry
type AuditLogResponse struct {
	ID           uuid.UUID    `json:"id"`
	AdminID      uuid.UUID    `json:"adminId"`
	Action       string       `json:"action"`
	ResourceType string       `json:"resourceType"`
	ResourceID   *uuid.UUID   `json:"resourceId,omitempty"`
	Details      AuditDetails `json:"details"`
	IPAddress    string       `json:"ipAddress"`
	CreatedAt    string       `json:"createdAt"`
}

// ToResponse converts AuditLog to AuditLogResponse
func (a *AuditLog) ToResponse() AuditLogResponse {
	return AuditLogResponse{
		ID:           a.ID,
		AdminID:      a.AdminID,
		Action:       a.Action,
		ResourceType: a.ResourceType,
		ResourceID:   a.ResourceID,
		Details:      a.Details,
		IPAddress:    a.IPAddress,
		CreatedAt:    a.CreatedAt.Format(time.RFC3339),
	}
}

// SystemMetricsResponse represents the API response for system metrics
type SystemMetricsResponse struct {
	ActiveFestivals   int64  `json:"activeFestivals"`
	TotalFestivals    int64  `json:"totalFestivals"`
	TotalUsers        int64  `json:"totalUsers"`
	TotalTransactions int64  `json:"totalTransactions"`
	RevenueToday      string `json:"revenueToday"`
	RevenueThisMonth  string `json:"revenueThisMonth"`
	ActiveWallets     int64  `json:"activeWallets"`
	TotalTicketsSold  int64  `json:"totalTicketsSold"`
}

// ToResponse converts SystemMetrics to SystemMetricsResponse
func (m *SystemMetrics) ToResponse() SystemMetricsResponse {
	return SystemMetricsResponse{
		ActiveFestivals:   m.ActiveFestivals,
		TotalFestivals:    m.TotalFestivals,
		TotalUsers:        m.TotalUsers,
		TotalTransactions: m.TotalTransactions,
		RevenueToday:      formatCurrency(m.RevenueToday),
		RevenueThisMonth:  formatCurrency(m.RevenueThisMonth),
		ActiveWallets:     m.ActiveWallets,
		TotalTicketsSold:  m.TotalTicketsSold,
	}
}

// formatCurrency formats cents to a currency string
func formatCurrency(cents int64) string {
	euros := float64(cents) / 100
	return formatEuros(euros)
}

func formatEuros(euros float64) string {
	if euros == float64(int64(euros)) {
		return formatInt(int64(euros)) + " EUR"
	}
	return formatFloat(euros) + " EUR"
}

func formatInt(n int64) string {
	if n < 0 {
		return "-" + formatInt(-n)
	}
	str := ""
	for n > 0 {
		if str != "" {
			str = "," + str
		}
		chunk := n % 1000
		n = n / 1000
		if n > 0 {
			str = padZeros(chunk) + str
		} else {
			str = intToStr(chunk) + str
		}
	}
	if str == "" {
		return "0"
	}
	return str
}

func formatFloat(f float64) string {
	intPart := int64(f)
	fracPart := int64((f - float64(intPart)) * 100)
	if fracPart < 0 {
		fracPart = -fracPart
	}
	return formatInt(intPart) + "." + padZerosTwo(fracPart)
}

func intToStr(n int64) string {
	if n == 0 {
		return "0"
	}
	str := ""
	for n > 0 {
		str = string(rune('0'+n%10)) + str
		n = n / 10
	}
	return str
}

func padZeros(n int64) string {
	if n < 10 {
		return "00" + intToStr(n)
	}
	if n < 100 {
		return "0" + intToStr(n)
	}
	return intToStr(n)
}

func padZerosTwo(n int64) string {
	if n < 10 {
		return "0" + intToStr(n)
	}
	return intToStr(n)
}
