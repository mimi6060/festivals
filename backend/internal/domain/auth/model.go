package auth

import (
	"time"

	"github.com/google/uuid"
)

// ============================================================================
// RBAC Core Types
// ============================================================================

// Resource represents a resource that can be protected
type Resource string

const (
	ResourceFestival     Resource = "festival"
	ResourceStand        Resource = "stand"
	ResourceProduct      Resource = "product"
	ResourceTicket       Resource = "ticket"
	ResourceLineup       Resource = "lineup"
	ResourceWallet       Resource = "wallet"
	ResourceTransaction  Resource = "transaction"
	ResourceRefund       Resource = "refund"
	ResourceUser         Resource = "user"
	ResourceStaff        Resource = "staff"
	ResourceReport       Resource = "report"
	ResourceSecurity     Resource = "security"
	ResourceSettings     Resource = "settings"
	ResourceRole         Resource = "role"
	ResourceAudit        Resource = "audit"
	ResourceNotification Resource = "notification"
	ResourceMedia        Resource = "media"
)

// AllResources returns all available resources
func AllResources() []Resource {
	return []Resource{
		ResourceFestival,
		ResourceStand,
		ResourceProduct,
		ResourceTicket,
		ResourceLineup,
		ResourceWallet,
		ResourceTransaction,
		ResourceRefund,
		ResourceUser,
		ResourceStaff,
		ResourceReport,
		ResourceSecurity,
		ResourceSettings,
		ResourceRole,
		ResourceAudit,
		ResourceNotification,
		ResourceMedia,
	}
}

// Action represents an action that can be performed on a resource
type Action string

const (
	ActionCreate Action = "create"
	ActionRead   Action = "read"
	ActionUpdate Action = "update"
	ActionDelete Action = "delete"
	ActionList   Action = "list"
	ActionExport Action = "export"
	ActionImport Action = "import"
	ActionApprove Action = "approve"
	ActionReject  Action = "reject"
	ActionScan    Action = "scan"
	ActionProcess Action = "process"
)

// AllActions returns all available actions
func AllActions() []Action {
	return []Action{
		ActionCreate,
		ActionRead,
		ActionUpdate,
		ActionDelete,
		ActionList,
		ActionExport,
		ActionImport,
		ActionApprove,
		ActionReject,
		ActionScan,
		ActionProcess,
	}
}

// Scope defines the scope of a permission
type Scope string

const (
	ScopeGlobal   Scope = "global"   // Platform-wide access
	ScopeFestival Scope = "festival" // Festival-specific access
	ScopeStand    Scope = "stand"    // Stand-specific access
	ScopeOwn      Scope = "own"      // Own resources only
)

// ============================================================================
// Permission Model
// ============================================================================

// Permission represents a granular permission
type Permission struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Resource    Resource  `json:"resource" gorm:"type:varchar(50);not null;index"`
	Action      Action    `json:"action" gorm:"type:varchar(50);not null;index"`
	Scope       Scope     `json:"scope" gorm:"type:varchar(50);not null;default:'festival'"`
	Description string    `json:"description" gorm:"type:text"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (Permission) TableName() string {
	return "public.permissions"
}

// PermissionKey returns a unique key for the permission
func (p *Permission) PermissionKey() string {
	return string(p.Resource) + ":" + string(p.Action)
}

// ============================================================================
// Role Model
// ============================================================================

// RoleType defines whether a role is system or custom
type RoleType string

const (
	RoleTypeSystem RoleType = "system"
	RoleTypeCustom RoleType = "custom"
)

// PredefinedRoleName represents predefined role names
type PredefinedRoleName string

const (
	RoleSuperAdmin      PredefinedRoleName = "SUPER_ADMIN"
	RoleFestivalOwner   PredefinedRoleName = "FESTIVAL_OWNER"
	RoleFestivalAdmin   PredefinedRoleName = "FESTIVAL_ADMIN"
	RoleFinanceManager  PredefinedRoleName = "FINANCE_MANAGER"
	RoleLineupManager   PredefinedRoleName = "LINEUP_MANAGER"
	RoleSecurityManager PredefinedRoleName = "SECURITY_MANAGER"
	RoleCashier         PredefinedRoleName = "CASHIER"
	RoleScanner         PredefinedRoleName = "SCANNER"
	RoleViewer          PredefinedRoleName = "VIEWER"
)

// Role represents a role in the RBAC system
type Role struct {
	ID          uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name        string       `json:"name" gorm:"type:varchar(100);not null;uniqueIndex:idx_role_name_festival"`
	DisplayName string       `json:"displayName" gorm:"type:varchar(100);not null"`
	Description string       `json:"description" gorm:"type:text"`
	Type        RoleType     `json:"type" gorm:"type:varchar(20);not null;default:'custom'"`
	FestivalID  *uuid.UUID   `json:"festivalId,omitempty" gorm:"type:uuid;index;uniqueIndex:idx_role_name_festival"` // NULL for global roles
	Permissions []Permission `json:"permissions" gorm:"many2many:role_permissions;"`
	IsActive    bool         `json:"isActive" gorm:"default:true"`
	Priority    int          `json:"priority" gorm:"default:0"` // Higher priority overrides lower
	CreatedAt   time.Time    `json:"createdAt"`
	UpdatedAt   time.Time    `json:"updatedAt"`
}

func (Role) TableName() string {
	return "public.roles"
}

// IsSystemRole checks if this is a system-defined role
func (r *Role) IsSystemRole() bool {
	return r.Type == RoleTypeSystem
}

// IsGlobalRole checks if this is a global (platform-wide) role
func (r *Role) IsGlobalRole() bool {
	return r.FestivalID == nil
}

// ============================================================================
// Role Assignment Model
// ============================================================================

// RoleAssignment represents a user's role assignment
type RoleAssignment struct {
	ID         uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID     uuid.UUID  `json:"userId" gorm:"type:uuid;not null;index;uniqueIndex:idx_user_role_festival"`
	RoleID     uuid.UUID  `json:"roleId" gorm:"type:uuid;not null;index;uniqueIndex:idx_user_role_festival"`
	FestivalID *uuid.UUID `json:"festivalId,omitempty" gorm:"type:uuid;index;uniqueIndex:idx_user_role_festival"` // NULL for global assignments
	StandID    *uuid.UUID `json:"standId,omitempty" gorm:"type:uuid;index"`                                       // For stand-specific assignments
	AssignedBy uuid.UUID  `json:"assignedBy" gorm:"type:uuid;not null"`
	AssignedAt time.Time  `json:"assignedAt" gorm:"default:now()"`
	ExpiresAt  *time.Time `json:"expiresAt,omitempty"` // Optional expiration
	IsActive   bool       `json:"isActive" gorm:"default:true"`
	Notes      string     `json:"notes,omitempty" gorm:"type:text"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`

	// Relationships
	Role *Role `json:"role,omitempty" gorm:"foreignKey:RoleID"`
}

func (RoleAssignment) TableName() string {
	return "public.role_assignments"
}

// IsExpired checks if the assignment has expired
func (ra *RoleAssignment) IsExpired() bool {
	if ra.ExpiresAt == nil {
		return false
	}
	return ra.ExpiresAt.Before(time.Now())
}

// IsEffective checks if the assignment is currently effective
func (ra *RoleAssignment) IsEffective() bool {
	return ra.IsActive && !ra.IsExpired()
}

// ============================================================================
// Role Permission Join Table
// ============================================================================

// RolePermission represents the many-to-many relationship between roles and permissions
type RolePermission struct {
	RoleID       uuid.UUID `json:"roleId" gorm:"type:uuid;primaryKey"`
	PermissionID uuid.UUID `json:"permissionId" gorm:"type:uuid;primaryKey"`
	CreatedAt    time.Time `json:"createdAt"`
}

func (RolePermission) TableName() string {
	return "public.role_permissions"
}

// ============================================================================
// Audit Trail
// ============================================================================

// AuditAction represents the type of audit action
type AuditAction string

const (
	AuditActionRoleCreated       AuditAction = "role_created"
	AuditActionRoleUpdated       AuditAction = "role_updated"
	AuditActionRoleDeleted       AuditAction = "role_deleted"
	AuditActionRoleAssigned      AuditAction = "role_assigned"
	AuditActionRoleRevoked       AuditAction = "role_revoked"
	AuditActionPermissionGranted AuditAction = "permission_granted"
	AuditActionPermissionRevoked AuditAction = "permission_revoked"
	AuditActionAccessDenied      AuditAction = "access_denied"
	AuditActionAccessGranted     AuditAction = "access_granted"
)

// RBACauditLog represents an audit log entry for RBAC operations
type RBACAuditLog struct {
	ID           uuid.UUID   `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Action       AuditAction `json:"action" gorm:"type:varchar(50);not null;index"`
	ActorID      uuid.UUID   `json:"actorId" gorm:"type:uuid;not null;index"`
	TargetUserID *uuid.UUID  `json:"targetUserId,omitempty" gorm:"type:uuid;index"`
	RoleID       *uuid.UUID  `json:"roleId,omitempty" gorm:"type:uuid;index"`
	FestivalID   *uuid.UUID  `json:"festivalId,omitempty" gorm:"type:uuid;index"`
	Resource     *Resource   `json:"resource,omitempty" gorm:"type:varchar(50)"`
	ResourceID   *string     `json:"resourceId,omitempty" gorm:"type:varchar(100)"`
	OldValue     string      `json:"oldValue,omitempty" gorm:"type:jsonb"`
	NewValue     string      `json:"newValue,omitempty" gorm:"type:jsonb"`
	IPAddress    string      `json:"ipAddress,omitempty" gorm:"type:varchar(45)"`
	UserAgent    string      `json:"userAgent,omitempty" gorm:"type:text"`
	Reason       string      `json:"reason,omitempty" gorm:"type:text"`
	CreatedAt    time.Time   `json:"createdAt" gorm:"index"`
}

func (RBACAuditLog) TableName() string {
	return "public.rbac_audit_logs"
}

// ============================================================================
// Request/Response DTOs
// ============================================================================

// CreateRoleRequest represents a request to create a new role
type CreateRoleRequest struct {
	Name          string      `json:"name" binding:"required,min=2,max=100"`
	DisplayName   string      `json:"displayName" binding:"required,min=2,max=100"`
	Description   string      `json:"description"`
	FestivalID    *uuid.UUID  `json:"festivalId,omitempty"`
	PermissionIDs []uuid.UUID `json:"permissionIds"`
	Priority      int         `json:"priority"`
}

// UpdateRoleRequest represents a request to update a role
type UpdateRoleRequest struct {
	DisplayName   *string     `json:"displayName,omitempty"`
	Description   *string     `json:"description,omitempty"`
	PermissionIDs []uuid.UUID `json:"permissionIds,omitempty"`
	IsActive      *bool       `json:"isActive,omitempty"`
	Priority      *int        `json:"priority,omitempty"`
}

// AssignRoleRequest represents a request to assign a role to a user
type AssignRoleRequest struct {
	UserID     uuid.UUID  `json:"userId" binding:"required"`
	RoleID     uuid.UUID  `json:"roleId" binding:"required"`
	FestivalID *uuid.UUID `json:"festivalId,omitempty"`
	StandID    *uuid.UUID `json:"standId,omitempty"`
	ExpiresAt  *time.Time `json:"expiresAt,omitempty"`
	Notes      string     `json:"notes,omitempty"`
}

// RemoveRoleRequest represents a request to remove a role from a user
type RemoveRoleRequest struct {
	UserID     uuid.UUID  `json:"userId" binding:"required"`
	RoleID     uuid.UUID  `json:"roleId" binding:"required"`
	FestivalID *uuid.UUID `json:"festivalId,omitempty"`
	Reason     string     `json:"reason,omitempty"`
}

// CheckPermissionRequest represents a request to check permissions
type CheckPermissionRequest struct {
	UserID     uuid.UUID  `json:"userId" binding:"required"`
	Resource   Resource   `json:"resource" binding:"required"`
	Action     Action     `json:"action" binding:"required"`
	FestivalID *uuid.UUID `json:"festivalId,omitempty"`
	StandID    *uuid.UUID `json:"standId,omitempty"`
}

// RoleResponse represents the API response for a role
type RoleResponse struct {
	ID          uuid.UUID            `json:"id"`
	Name        string               `json:"name"`
	DisplayName string               `json:"displayName"`
	Description string               `json:"description"`
	Type        RoleType             `json:"type"`
	FestivalID  *uuid.UUID           `json:"festivalId,omitempty"`
	Permissions []PermissionResponse `json:"permissions"`
	IsActive    bool                 `json:"isActive"`
	Priority    int                  `json:"priority"`
	CreatedAt   string               `json:"createdAt"`
	UpdatedAt   string               `json:"updatedAt"`
}

// ToResponse converts a Role to RoleResponse
func (r *Role) ToResponse() RoleResponse {
	permissions := make([]PermissionResponse, len(r.Permissions))
	for i, p := range r.Permissions {
		permissions[i] = p.ToResponse()
	}
	return RoleResponse{
		ID:          r.ID,
		Name:        r.Name,
		DisplayName: r.DisplayName,
		Description: r.Description,
		Type:        r.Type,
		FestivalID:  r.FestivalID,
		Permissions: permissions,
		IsActive:    r.IsActive,
		Priority:    r.Priority,
		CreatedAt:   r.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   r.UpdatedAt.Format(time.RFC3339),
	}
}

// PermissionResponse represents the API response for a permission
type PermissionResponse struct {
	ID          uuid.UUID `json:"id"`
	Resource    Resource  `json:"resource"`
	Action      Action    `json:"action"`
	Scope       Scope     `json:"scope"`
	Description string    `json:"description"`
}

// ToResponse converts a Permission to PermissionResponse
func (p *Permission) ToResponse() PermissionResponse {
	return PermissionResponse{
		ID:          p.ID,
		Resource:    p.Resource,
		Action:      p.Action,
		Scope:       p.Scope,
		Description: p.Description,
	}
}

// RoleAssignmentResponse represents the API response for a role assignment
type RoleAssignmentResponse struct {
	ID         uuid.UUID     `json:"id"`
	UserID     uuid.UUID     `json:"userId"`
	RoleID     uuid.UUID     `json:"roleId"`
	Role       *RoleResponse `json:"role,omitempty"`
	FestivalID *uuid.UUID    `json:"festivalId,omitempty"`
	StandID    *uuid.UUID    `json:"standId,omitempty"`
	AssignedBy uuid.UUID     `json:"assignedBy"`
	AssignedAt string        `json:"assignedAt"`
	ExpiresAt  *string       `json:"expiresAt,omitempty"`
	IsActive   bool          `json:"isActive"`
	Notes      string        `json:"notes,omitempty"`
}

// ToResponse converts a RoleAssignment to RoleAssignmentResponse
func (ra *RoleAssignment) ToResponse() RoleAssignmentResponse {
	resp := RoleAssignmentResponse{
		ID:         ra.ID,
		UserID:     ra.UserID,
		RoleID:     ra.RoleID,
		FestivalID: ra.FestivalID,
		StandID:    ra.StandID,
		AssignedBy: ra.AssignedBy,
		AssignedAt: ra.AssignedAt.Format(time.RFC3339),
		IsActive:   ra.IsActive,
		Notes:      ra.Notes,
	}
	if ra.ExpiresAt != nil {
		exp := ra.ExpiresAt.Format(time.RFC3339)
		resp.ExpiresAt = &exp
	}
	if ra.Role != nil {
		roleResp := ra.Role.ToResponse()
		resp.Role = &roleResp
	}
	return resp
}

// UserPermissionsResponse represents the aggregated permissions for a user
type UserPermissionsResponse struct {
	UserID      uuid.UUID              `json:"userId"`
	FestivalID  *uuid.UUID             `json:"festivalId,omitempty"`
	Roles       []RoleResponse         `json:"roles"`
	Permissions []PermissionResponse   `json:"permissions"`
	EffectiveAt string                 `json:"effectiveAt"`
}

// PermissionMatrixResponse represents a matrix of permissions for display
type PermissionMatrixResponse struct {
	Resources   []Resource                       `json:"resources"`
	Actions     []Action                         `json:"actions"`
	Permissions map[string]map[string]bool       `json:"permissions"` // resource -> action -> granted
}

// AuditLogResponse represents the API response for an audit log entry
type AuditLogResponse struct {
	ID           uuid.UUID   `json:"id"`
	Action       AuditAction `json:"action"`
	ActorID      uuid.UUID   `json:"actorId"`
	TargetUserID *uuid.UUID  `json:"targetUserId,omitempty"`
	RoleID       *uuid.UUID  `json:"roleId,omitempty"`
	FestivalID   *uuid.UUID  `json:"festivalId,omitempty"`
	Resource     *Resource   `json:"resource,omitempty"`
	ResourceID   *string     `json:"resourceId,omitempty"`
	OldValue     string      `json:"oldValue,omitempty"`
	NewValue     string      `json:"newValue,omitempty"`
	IPAddress    string      `json:"ipAddress,omitempty"`
	Reason       string      `json:"reason,omitempty"`
	CreatedAt    string      `json:"createdAt"`
}

// ToResponse converts RBACAuditLog to AuditLogResponse
func (a *RBACAuditLog) ToResponse() AuditLogResponse {
	return AuditLogResponse{
		ID:           a.ID,
		Action:       a.Action,
		ActorID:      a.ActorID,
		TargetUserID: a.TargetUserID,
		RoleID:       a.RoleID,
		FestivalID:   a.FestivalID,
		Resource:     a.Resource,
		ResourceID:   a.ResourceID,
		OldValue:     a.OldValue,
		NewValue:     a.NewValue,
		IPAddress:    a.IPAddress,
		Reason:       a.Reason,
		CreatedAt:    a.CreatedAt.Format(time.RFC3339),
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

// GetPredefinedRoles returns the configuration for predefined roles
func GetPredefinedRoles() map[PredefinedRoleName]PredefinedRoleConfig {
	return map[PredefinedRoleName]PredefinedRoleConfig{
		RoleSuperAdmin: {
			DisplayName: "Super Admin",
			Description: "Full platform access - can manage all festivals and system settings",
			Priority:    1000,
			IsGlobal:    true,
			Permissions: getAllPermissions(),
		},
		RoleFestivalOwner: {
			DisplayName: "Festival Owner",
			Description: "Owner of a festival - full access to their festival",
			Priority:    900,
			IsGlobal:    false,
			Permissions: getFestivalOwnerPermissions(),
		},
		RoleFestivalAdmin: {
			DisplayName: "Festival Admin",
			Description: "Administrator for a festival - almost full access except ownership transfer",
			Priority:    800,
			IsGlobal:    false,
			Permissions: getFestivalAdminPermissions(),
		},
		RoleFinanceManager: {
			DisplayName: "Finance Manager",
			Description: "Manages finances, transactions, refunds, and reports",
			Priority:    700,
			IsGlobal:    false,
			Permissions: getFinanceManagerPermissions(),
		},
		RoleLineupManager: {
			DisplayName: "Lineup Manager",
			Description: "Manages festival lineup and scheduling",
			Priority:    600,
			IsGlobal:    false,
			Permissions: getLineupManagerPermissions(),
		},
		RoleSecurityManager: {
			DisplayName: "Security Manager",
			Description: "Manages security, access control, and scanning",
			Priority:    600,
			IsGlobal:    false,
			Permissions: getSecurityManagerPermissions(),
		},
		RoleCashier: {
			DisplayName: "Cashier",
			Description: "Can process sales and view basic information",
			Priority:    300,
			IsGlobal:    false,
			Permissions: getCashierPermissions(),
		},
		RoleScanner: {
			DisplayName: "Scanner",
			Description: "Can scan tickets and check entries",
			Priority:    200,
			IsGlobal:    false,
			Permissions: getScannerPermissions(),
		},
		RoleViewer: {
			DisplayName: "Viewer",
			Description: "Read-only access to festival information",
			Priority:    100,
			IsGlobal:    false,
			Permissions: getViewerPermissions(),
		},
	}
}

// PredefinedRoleConfig holds the configuration for a predefined role
type PredefinedRoleConfig struct {
	DisplayName string
	Description string
	Priority    int
	IsGlobal    bool
	Permissions []PermissionConfig
}

// PermissionConfig holds the configuration for a permission
type PermissionConfig struct {
	Resource Resource
	Action   Action
	Scope    Scope
}

// Helper functions to define permissions for each role

func getAllPermissions() []PermissionConfig {
	var perms []PermissionConfig
	for _, resource := range AllResources() {
		for _, action := range AllActions() {
			perms = append(perms, PermissionConfig{
				Resource: resource,
				Action:   action,
				Scope:    ScopeGlobal,
			})
		}
	}
	return perms
}

func getFestivalOwnerPermissions() []PermissionConfig {
	resources := []Resource{
		ResourceFestival, ResourceStand, ResourceProduct, ResourceTicket,
		ResourceLineup, ResourceWallet, ResourceTransaction, ResourceRefund,
		ResourceStaff, ResourceReport, ResourceSecurity, ResourceSettings,
		ResourceRole, ResourceAudit, ResourceNotification, ResourceMedia,
	}
	var perms []PermissionConfig
	for _, resource := range resources {
		for _, action := range AllActions() {
			perms = append(perms, PermissionConfig{
				Resource: resource,
				Action:   action,
				Scope:    ScopeFestival,
			})
		}
	}
	return perms
}

func getFestivalAdminPermissions() []PermissionConfig {
	// Same as owner but without ability to delete festival or transfer ownership
	resources := []Resource{
		ResourceStand, ResourceProduct, ResourceTicket, ResourceLineup,
		ResourceWallet, ResourceTransaction, ResourceRefund, ResourceStaff,
		ResourceReport, ResourceSecurity, ResourceSettings, ResourceRole,
		ResourceAudit, ResourceNotification, ResourceMedia,
	}
	var perms []PermissionConfig
	for _, resource := range resources {
		for _, action := range AllActions() {
			perms = append(perms, PermissionConfig{
				Resource: resource,
				Action:   action,
				Scope:    ScopeFestival,
			})
		}
	}
	// Limited festival permissions
	perms = append(perms,
		PermissionConfig{Resource: ResourceFestival, Action: ActionRead, Scope: ScopeFestival},
		PermissionConfig{Resource: ResourceFestival, Action: ActionUpdate, Scope: ScopeFestival},
	)
	return perms
}

func getFinanceManagerPermissions() []PermissionConfig {
	return []PermissionConfig{
		// Transactions
		{Resource: ResourceTransaction, Action: ActionCreate, Scope: ScopeFestival},
		{Resource: ResourceTransaction, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceTransaction, Action: ActionList, Scope: ScopeFestival},
		{Resource: ResourceTransaction, Action: ActionExport, Scope: ScopeFestival},
		// Refunds
		{Resource: ResourceRefund, Action: ActionCreate, Scope: ScopeFestival},
		{Resource: ResourceRefund, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceRefund, Action: ActionList, Scope: ScopeFestival},
		{Resource: ResourceRefund, Action: ActionApprove, Scope: ScopeFestival},
		{Resource: ResourceRefund, Action: ActionReject, Scope: ScopeFestival},
		{Resource: ResourceRefund, Action: ActionProcess, Scope: ScopeFestival},
		// Wallets
		{Resource: ResourceWallet, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceWallet, Action: ActionList, Scope: ScopeFestival},
		{Resource: ResourceWallet, Action: ActionUpdate, Scope: ScopeFestival},
		// Reports
		{Resource: ResourceReport, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceReport, Action: ActionList, Scope: ScopeFestival},
		{Resource: ResourceReport, Action: ActionExport, Scope: ScopeFestival},
		// Festival read
		{Resource: ResourceFestival, Action: ActionRead, Scope: ScopeFestival},
		// Stands read (for context)
		{Resource: ResourceStand, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceStand, Action: ActionList, Scope: ScopeFestival},
	}
}

func getLineupManagerPermissions() []PermissionConfig {
	return []PermissionConfig{
		// Lineup full access
		{Resource: ResourceLineup, Action: ActionCreate, Scope: ScopeFestival},
		{Resource: ResourceLineup, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceLineup, Action: ActionUpdate, Scope: ScopeFestival},
		{Resource: ResourceLineup, Action: ActionDelete, Scope: ScopeFestival},
		{Resource: ResourceLineup, Action: ActionList, Scope: ScopeFestival},
		{Resource: ResourceLineup, Action: ActionImport, Scope: ScopeFestival},
		{Resource: ResourceLineup, Action: ActionExport, Scope: ScopeFestival},
		// Media for lineup
		{Resource: ResourceMedia, Action: ActionCreate, Scope: ScopeFestival},
		{Resource: ResourceMedia, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceMedia, Action: ActionUpdate, Scope: ScopeFestival},
		{Resource: ResourceMedia, Action: ActionDelete, Scope: ScopeFestival},
		{Resource: ResourceMedia, Action: ActionList, Scope: ScopeFestival},
		// Festival read
		{Resource: ResourceFestival, Action: ActionRead, Scope: ScopeFestival},
		// Notifications for lineup announcements
		{Resource: ResourceNotification, Action: ActionCreate, Scope: ScopeFestival},
		{Resource: ResourceNotification, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceNotification, Action: ActionList, Scope: ScopeFestival},
	}
}

func getSecurityManagerPermissions() []PermissionConfig {
	return []PermissionConfig{
		// Security full access
		{Resource: ResourceSecurity, Action: ActionCreate, Scope: ScopeFestival},
		{Resource: ResourceSecurity, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceSecurity, Action: ActionUpdate, Scope: ScopeFestival},
		{Resource: ResourceSecurity, Action: ActionDelete, Scope: ScopeFestival},
		{Resource: ResourceSecurity, Action: ActionList, Scope: ScopeFestival},
		// Tickets for validation
		{Resource: ResourceTicket, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceTicket, Action: ActionList, Scope: ScopeFestival},
		{Resource: ResourceTicket, Action: ActionScan, Scope: ScopeFestival},
		{Resource: ResourceTicket, Action: ActionUpdate, Scope: ScopeFestival},
		// Staff management
		{Resource: ResourceStaff, Action: ActionCreate, Scope: ScopeFestival},
		{Resource: ResourceStaff, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceStaff, Action: ActionUpdate, Scope: ScopeFestival},
		{Resource: ResourceStaff, Action: ActionDelete, Scope: ScopeFestival},
		{Resource: ResourceStaff, Action: ActionList, Scope: ScopeFestival},
		// Festival and audit read
		{Resource: ResourceFestival, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceAudit, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceAudit, Action: ActionList, Scope: ScopeFestival},
	}
}

func getCashierPermissions() []PermissionConfig {
	return []PermissionConfig{
		// Transactions - can create and view
		{Resource: ResourceTransaction, Action: ActionCreate, Scope: ScopeStand},
		{Resource: ResourceTransaction, Action: ActionRead, Scope: ScopeStand},
		{Resource: ResourceTransaction, Action: ActionList, Scope: ScopeStand},
		{Resource: ResourceTransaction, Action: ActionProcess, Scope: ScopeStand},
		// Products read
		{Resource: ResourceProduct, Action: ActionRead, Scope: ScopeStand},
		{Resource: ResourceProduct, Action: ActionList, Scope: ScopeStand},
		// Wallets - can read for payment
		{Resource: ResourceWallet, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceWallet, Action: ActionUpdate, Scope: ScopeFestival}, // For charging
		// Stand read
		{Resource: ResourceStand, Action: ActionRead, Scope: ScopeStand},
		// Festival read
		{Resource: ResourceFestival, Action: ActionRead, Scope: ScopeFestival},
	}
}

func getScannerPermissions() []PermissionConfig {
	return []PermissionConfig{
		// Tickets - can scan and read
		{Resource: ResourceTicket, Action: ActionRead, Scope: ScopeFestival},
		{Resource: ResourceTicket, Action: ActionScan, Scope: ScopeFestival},
		{Resource: ResourceTicket, Action: ActionUpdate, Scope: ScopeFestival}, // For marking as used
		// Festival read
		{Resource: ResourceFestival, Action: ActionRead, Scope: ScopeFestival},
		// Security read
		{Resource: ResourceSecurity, Action: ActionRead, Scope: ScopeFestival},
	}
}

func getViewerPermissions() []PermissionConfig {
	resources := []Resource{
		ResourceFestival, ResourceStand, ResourceProduct, ResourceTicket,
		ResourceLineup, ResourceReport,
	}
	var perms []PermissionConfig
	for _, resource := range resources {
		perms = append(perms, PermissionConfig{
			Resource: resource,
			Action:   ActionRead,
			Scope:    ScopeFestival,
		})
		perms = append(perms, PermissionConfig{
			Resource: resource,
			Action:   ActionList,
			Scope:    ScopeFestival,
		})
	}
	return perms
}
