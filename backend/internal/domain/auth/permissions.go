package auth

import (
	"fmt"
	"strings"
)

// ============================================================================
// Permission String Type for Granular Permissions
// ============================================================================

// PermissionString represents a granular permission in format "resource.action"
type PermissionString string

// All granular permissions organized by resource
const (
	// Festival permissions
	PermFestivalsRead   PermissionString = "festivals.read"
	PermFestivalsWrite  PermissionString = "festivals.write"
	PermFestivalsDelete PermissionString = "festivals.delete"
	PermFestivalsCreate PermissionString = "festivals.create"
	PermFestivalsList   PermissionString = "festivals.list"
	PermFestivalsExport PermissionString = "festivals.export"

	// Stand permissions
	PermStandsRead   PermissionString = "stands.read"
	PermStandsWrite  PermissionString = "stands.write"
	PermStandsDelete PermissionString = "stands.delete"
	PermStandsCreate PermissionString = "stands.create"
	PermStandsList   PermissionString = "stands.list"
	PermStandsExport PermissionString = "stands.export"
	PermStandsImport PermissionString = "stands.import"

	// Product permissions
	PermProductsRead   PermissionString = "products.read"
	PermProductsWrite  PermissionString = "products.write"
	PermProductsDelete PermissionString = "products.delete"
	PermProductsCreate PermissionString = "products.create"
	PermProductsList   PermissionString = "products.list"
	PermProductsExport PermissionString = "products.export"
	PermProductsImport PermissionString = "products.import"

	// Order permissions
	PermOrdersRead    PermissionString = "orders.read"
	PermOrdersWrite   PermissionString = "orders.write"
	PermOrdersDelete  PermissionString = "orders.delete"
	PermOrdersCreate  PermissionString = "orders.create"
	PermOrdersList    PermissionString = "orders.list"
	PermOrdersExport  PermissionString = "orders.export"
	PermOrdersProcess PermissionString = "orders.process"
	PermOrdersRefund  PermissionString = "orders.refund"

	// Wallet permissions
	PermWalletsRead    PermissionString = "wallets.read"
	PermWalletsWrite   PermissionString = "wallets.write"
	PermWalletsDelete  PermissionString = "wallets.delete"
	PermWalletsCreate  PermissionString = "wallets.create"
	PermWalletsList    PermissionString = "wallets.list"
	PermWalletsExport  PermissionString = "wallets.export"
	PermWalletsTopup   PermissionString = "wallets.topup"
	PermWalletsRefund  PermissionString = "wallets.refund"
	PermWalletsAdjust  PermissionString = "wallets.adjust"

	// Staff permissions
	PermStaffRead     PermissionString = "staff.read"
	PermStaffWrite    PermissionString = "staff.write"
	PermStaffDelete   PermissionString = "staff.delete"
	PermStaffCreate   PermissionString = "staff.create"
	PermStaffList     PermissionString = "staff.list"
	PermStaffExport   PermissionString = "staff.export"
	PermStaffSchedule PermissionString = "staff.schedule"
	PermStaffAssign   PermissionString = "staff.assign"

	// Reports permissions
	PermReportsRead     PermissionString = "reports.read"
	PermReportsList     PermissionString = "reports.list"
	PermReportsExport   PermissionString = "reports.export"
	PermReportsCreate   PermissionString = "reports.create"
	PermReportsFinance  PermissionString = "reports.finance"
	PermReportsSales    PermissionString = "reports.sales"
	PermReportsAnalytics PermissionString = "reports.analytics"

	// Settings permissions
	PermSettingsRead        PermissionString = "settings.read"
	PermSettingsWrite       PermissionString = "settings.write"
	PermSettingsGeneral     PermissionString = "settings.general"
	PermSettingsIntegrations PermissionString = "settings.integrations"
	PermSettingsBranding    PermissionString = "settings.branding"
	PermSettingsNFC         PermissionString = "settings.nfc"
	PermSettingsPayment     PermissionString = "settings.payment"
	PermSettingsRoles       PermissionString = "settings.roles"

	// Ticket permissions
	PermTicketsRead    PermissionString = "tickets.read"
	PermTicketsWrite   PermissionString = "tickets.write"
	PermTicketsDelete  PermissionString = "tickets.delete"
	PermTicketsCreate  PermissionString = "tickets.create"
	PermTicketsList    PermissionString = "tickets.list"
	PermTicketsExport  PermissionString = "tickets.export"
	PermTicketsScan    PermissionString = "tickets.scan"
	PermTicketsValidate PermissionString = "tickets.validate"
	PermTicketsRevoke  PermissionString = "tickets.revoke"

	// Lineup permissions
	PermLineupRead   PermissionString = "lineup.read"
	PermLineupWrite  PermissionString = "lineup.write"
	PermLineupDelete PermissionString = "lineup.delete"
	PermLineupCreate PermissionString = "lineup.create"
	PermLineupList   PermissionString = "lineup.list"
	PermLineupExport PermissionString = "lineup.export"
	PermLineupImport PermissionString = "lineup.import"

	// Security permissions
	PermSecurityRead    PermissionString = "security.read"
	PermSecurityWrite   PermissionString = "security.write"
	PermSecurityDelete  PermissionString = "security.delete"
	PermSecurityCreate  PermissionString = "security.create"
	PermSecurityList    PermissionString = "security.list"
	PermSecurityAlerts  PermissionString = "security.alerts"
	PermSecurityResolve PermissionString = "security.resolve"

	// Audit permissions
	PermAuditRead   PermissionString = "audit.read"
	PermAuditList   PermissionString = "audit.list"
	PermAuditExport PermissionString = "audit.export"

	// Transaction permissions
	PermTransactionsRead    PermissionString = "transactions.read"
	PermTransactionsList    PermissionString = "transactions.list"
	PermTransactionsExport  PermissionString = "transactions.export"
	PermTransactionsCreate  PermissionString = "transactions.create"
	PermTransactionsProcess PermissionString = "transactions.process"
	PermTransactionsRefund  PermissionString = "transactions.refund"

	// Refund permissions
	PermRefundsRead    PermissionString = "refunds.read"
	PermRefundsList    PermissionString = "refunds.list"
	PermRefundsCreate  PermissionString = "refunds.create"
	PermRefundsApprove PermissionString = "refunds.approve"
	PermRefundsReject  PermissionString = "refunds.reject"
	PermRefundsProcess PermissionString = "refunds.process"

	// Notification permissions
	PermNotificationsRead   PermissionString = "notifications.read"
	PermNotificationsWrite  PermissionString = "notifications.write"
	PermNotificationsDelete PermissionString = "notifications.delete"
	PermNotificationsCreate PermissionString = "notifications.create"
	PermNotificationsList   PermissionString = "notifications.list"
	PermNotificationsSend   PermissionString = "notifications.send"

	// Media permissions
	PermMediaRead   PermissionString = "media.read"
	PermMediaWrite  PermissionString = "media.write"
	PermMediaDelete PermissionString = "media.delete"
	PermMediaCreate PermissionString = "media.create"
	PermMediaList   PermissionString = "media.list"
	PermMediaUpload PermissionString = "media.upload"

	// Map permissions
	PermMapRead   PermissionString = "map.read"
	PermMapWrite  PermissionString = "map.write"
	PermMapDelete PermissionString = "map.delete"
	PermMapCreate PermissionString = "map.create"

	// Inventory permissions
	PermInventoryRead   PermissionString = "inventory.read"
	PermInventoryWrite  PermissionString = "inventory.write"
	PermInventoryAdjust PermissionString = "inventory.adjust"
	PermInventoryAlert  PermissionString = "inventory.alert"

	// NFC/Wristband permissions
	PermNFCRead      PermissionString = "nfc.read"
	PermNFCWrite     PermissionString = "nfc.write"
	PermNFCLink      PermissionString = "nfc.link"
	PermNFCUnlink    PermissionString = "nfc.unlink"
	PermNFCBatch     PermissionString = "nfc.batch"

	// API/Webhooks permissions
	PermAPIRead   PermissionString = "api.read"
	PermAPIWrite  PermissionString = "api.write"
	PermAPICreate PermissionString = "api.create"
	PermAPIDelete PermissionString = "api.delete"

	// Users permissions
	PermUsersRead   PermissionString = "users.read"
	PermUsersWrite  PermissionString = "users.write"
	PermUsersDelete PermissionString = "users.delete"
	PermUsersCreate PermissionString = "users.create"
	PermUsersList   PermissionString = "users.list"
	PermUsersExport PermissionString = "users.export"

	// Role permissions
	PermRolesRead   PermissionString = "roles.read"
	PermRolesWrite  PermissionString = "roles.write"
	PermRolesDelete PermissionString = "roles.delete"
	PermRolesCreate PermissionString = "roles.create"
	PermRolesList   PermissionString = "roles.list"
	PermRolesAssign PermissionString = "roles.assign"

	// Chatbot permissions
	PermChatbotRead   PermissionString = "chatbot.read"
	PermChatbotWrite  PermissionString = "chatbot.write"
	PermChatbotTrain  PermissionString = "chatbot.train"
	PermChatbotConfig PermissionString = "chatbot.config"

	// Gallery permissions
	PermGalleryRead   PermissionString = "gallery.read"
	PermGalleryWrite  PermissionString = "gallery.write"
	PermGalleryDelete PermissionString = "gallery.delete"
	PermGalleryUpload PermissionString = "gallery.upload"

	// Artists permissions
	PermArtistsRead   PermissionString = "artists.read"
	PermArtistsWrite  PermissionString = "artists.write"
	PermArtistsDelete PermissionString = "artists.delete"
	PermArtistsCreate PermissionString = "artists.create"
	PermArtistsList   PermissionString = "artists.list"
)

// String returns the string representation of the permission
func (p PermissionString) String() string {
	return string(p)
}

// Resource returns the resource part of the permission (e.g., "stands" from "stands.read")
func (p PermissionString) Resource() string {
	parts := strings.Split(string(p), ".")
	if len(parts) >= 1 {
		return parts[0]
	}
	return ""
}

// Action returns the action part of the permission (e.g., "read" from "stands.read")
func (p PermissionString) Action() string {
	parts := strings.Split(string(p), ".")
	if len(parts) >= 2 {
		return parts[1]
	}
	return ""
}

// ============================================================================
// Permission Groups
// ============================================================================

// PermissionGroup represents a logical grouping of permissions
type PermissionGroup struct {
	Name         string             `json:"name"`
	DisplayName  string             `json:"displayName"`
	Description  string             `json:"description"`
	Permissions  []PermissionString `json:"permissions"`
}

// GetPermissionGroups returns all predefined permission groups
func GetPermissionGroups() []PermissionGroup {
	return []PermissionGroup{
		{
			Name:        "festivals_management",
			DisplayName: "Festival Management",
			Description: "Full control over festival settings and configuration",
			Permissions: []PermissionString{
				PermFestivalsRead, PermFestivalsWrite, PermFestivalsDelete,
				PermFestivalsCreate, PermFestivalsList, PermFestivalsExport,
			},
		},
		{
			Name:        "stands_management",
			DisplayName: "Stands Management",
			Description: "Create, edit, and manage stands",
			Permissions: []PermissionString{
				PermStandsRead, PermStandsWrite, PermStandsDelete,
				PermStandsCreate, PermStandsList, PermStandsExport, PermStandsImport,
			},
		},
		{
			Name:        "products_management",
			DisplayName: "Products Management",
			Description: "Manage products and inventory",
			Permissions: []PermissionString{
				PermProductsRead, PermProductsWrite, PermProductsDelete,
				PermProductsCreate, PermProductsList, PermProductsExport, PermProductsImport,
			},
		},
		{
			Name:        "orders_management",
			DisplayName: "Orders Management",
			Description: "Process and manage orders",
			Permissions: []PermissionString{
				PermOrdersRead, PermOrdersWrite, PermOrdersDelete,
				PermOrdersCreate, PermOrdersList, PermOrdersExport,
				PermOrdersProcess, PermOrdersRefund,
			},
		},
		{
			Name:        "wallets_management",
			DisplayName: "Wallets Management",
			Description: "Manage digital wallets and top-ups",
			Permissions: []PermissionString{
				PermWalletsRead, PermWalletsWrite, PermWalletsDelete,
				PermWalletsCreate, PermWalletsList, PermWalletsExport,
				PermWalletsTopup, PermWalletsRefund, PermWalletsAdjust,
			},
		},
		{
			Name:        "staff_management",
			DisplayName: "Staff Management",
			Description: "Manage staff members and schedules",
			Permissions: []PermissionString{
				PermStaffRead, PermStaffWrite, PermStaffDelete,
				PermStaffCreate, PermStaffList, PermStaffExport,
				PermStaffSchedule, PermStaffAssign,
			},
		},
		{
			Name:        "reports_access",
			DisplayName: "Reports Access",
			Description: "View and export reports",
			Permissions: []PermissionString{
				PermReportsRead, PermReportsList, PermReportsExport,
				PermReportsCreate, PermReportsFinance, PermReportsSales, PermReportsAnalytics,
			},
		},
		{
			Name:        "settings_management",
			DisplayName: "Settings Management",
			Description: "Configure festival settings",
			Permissions: []PermissionString{
				PermSettingsRead, PermSettingsWrite, PermSettingsGeneral,
				PermSettingsIntegrations, PermSettingsBranding, PermSettingsNFC,
				PermSettingsPayment, PermSettingsRoles,
			},
		},
		{
			Name:        "tickets_management",
			DisplayName: "Tickets Management",
			Description: "Manage tickets and access control",
			Permissions: []PermissionString{
				PermTicketsRead, PermTicketsWrite, PermTicketsDelete,
				PermTicketsCreate, PermTicketsList, PermTicketsExport,
				PermTicketsScan, PermTicketsValidate, PermTicketsRevoke,
			},
		},
		{
			Name:        "lineup_management",
			DisplayName: "Lineup Management",
			Description: "Manage festival lineup and schedules",
			Permissions: []PermissionString{
				PermLineupRead, PermLineupWrite, PermLineupDelete,
				PermLineupCreate, PermLineupList, PermLineupExport, PermLineupImport,
			},
		},
		{
			Name:        "security_management",
			DisplayName: "Security Management",
			Description: "Manage security alerts and incidents",
			Permissions: []PermissionString{
				PermSecurityRead, PermSecurityWrite, PermSecurityDelete,
				PermSecurityCreate, PermSecurityList, PermSecurityAlerts, PermSecurityResolve,
			},
		},
		{
			Name:        "audit_access",
			DisplayName: "Audit Access",
			Description: "View audit logs and history",
			Permissions: []PermissionString{
				PermAuditRead, PermAuditList, PermAuditExport,
			},
		},
		{
			Name:        "finance_operations",
			DisplayName: "Finance Operations",
			Description: "Financial transactions and refunds",
			Permissions: []PermissionString{
				PermTransactionsRead, PermTransactionsList, PermTransactionsExport,
				PermTransactionsCreate, PermTransactionsProcess, PermTransactionsRefund,
				PermRefundsRead, PermRefundsList, PermRefundsCreate,
				PermRefundsApprove, PermRefundsReject, PermRefundsProcess,
			},
		},
		{
			Name:        "notifications_management",
			DisplayName: "Notifications Management",
			Description: "Send and manage notifications",
			Permissions: []PermissionString{
				PermNotificationsRead, PermNotificationsWrite, PermNotificationsDelete,
				PermNotificationsCreate, PermNotificationsList, PermNotificationsSend,
			},
		},
		{
			Name:        "media_management",
			DisplayName: "Media Management",
			Description: "Upload and manage media files",
			Permissions: []PermissionString{
				PermMediaRead, PermMediaWrite, PermMediaDelete,
				PermMediaCreate, PermMediaList, PermMediaUpload,
			},
		},
		{
			Name:        "nfc_management",
			DisplayName: "NFC/Wristband Management",
			Description: "Link and manage NFC wristbands",
			Permissions: []PermissionString{
				PermNFCRead, PermNFCWrite, PermNFCLink, PermNFCUnlink, PermNFCBatch,
			},
		},
		{
			Name:        "api_management",
			DisplayName: "API Management",
			Description: "Manage API keys and webhooks",
			Permissions: []PermissionString{
				PermAPIRead, PermAPIWrite, PermAPICreate, PermAPIDelete,
			},
		},
		{
			Name:        "users_management",
			DisplayName: "Users Management",
			Description: "Manage platform users",
			Permissions: []PermissionString{
				PermUsersRead, PermUsersWrite, PermUsersDelete,
				PermUsersCreate, PermUsersList, PermUsersExport,
			},
		},
		{
			Name:        "roles_management",
			DisplayName: "Roles & Permissions Management",
			Description: "Manage roles and assign permissions",
			Permissions: []PermissionString{
				PermRolesRead, PermRolesWrite, PermRolesDelete,
				PermRolesCreate, PermRolesList, PermRolesAssign,
			},
		},
		{
			Name:        "inventory_management",
			DisplayName: "Inventory Management",
			Description: "Manage inventory and stock levels",
			Permissions: []PermissionString{
				PermInventoryRead, PermInventoryWrite, PermInventoryAdjust, PermInventoryAlert,
			},
		},
		{
			Name:        "map_management",
			DisplayName: "Map Management",
			Description: "Manage festival map and POIs",
			Permissions: []PermissionString{
				PermMapRead, PermMapWrite, PermMapDelete, PermMapCreate,
			},
		},
		{
			Name:        "artists_management",
			DisplayName: "Artists Management",
			Description: "Manage artists and performers",
			Permissions: []PermissionString{
				PermArtistsRead, PermArtistsWrite, PermArtistsDelete,
				PermArtistsCreate, PermArtistsList,
			},
		},
		{
			Name:        "chatbot_management",
			DisplayName: "Chatbot Management",
			Description: "Configure and train chatbot",
			Permissions: []PermissionString{
				PermChatbotRead, PermChatbotWrite, PermChatbotTrain, PermChatbotConfig,
			},
		},
		{
			Name:        "cashier_operations",
			DisplayName: "Cashier Operations",
			Description: "Basic cashier and POS operations",
			Permissions: []PermissionString{
				PermProductsRead, PermProductsList,
				PermOrdersCreate, PermOrdersProcess,
				PermTransactionsCreate, PermTransactionsProcess,
				PermWalletsRead,
				PermStandsRead,
			},
		},
		{
			Name:        "scanner_operations",
			DisplayName: "Scanner Operations",
			Description: "Ticket scanning and validation",
			Permissions: []PermissionString{
				PermTicketsRead, PermTicketsScan, PermTicketsValidate,
				PermSecurityRead,
			},
		},
		{
			Name:        "viewer_access",
			DisplayName: "Viewer Access",
			Description: "Read-only access to festival data",
			Permissions: []PermissionString{
				PermFestivalsRead, PermStandsRead, PermStandsList,
				PermProductsRead, PermProductsList, PermOrdersRead, PermOrdersList,
				PermReportsRead, PermReportsList, PermLineupRead, PermLineupList,
			},
		},
	}
}

// GetPermissionGroup returns a permission group by name
func GetPermissionGroup(name string) *PermissionGroup {
	for _, group := range GetPermissionGroups() {
		if group.Name == name {
			return &group
		}
	}
	return nil
}

// ============================================================================
// Role-to-Permission Mappings
// ============================================================================

// RolePermissionMapping maps predefined roles to their permissions
var RolePermissionMapping = map[PredefinedRoleName][]PermissionString{
	RoleSuperAdmin: getAllPermissionStrings(),

	RoleFestivalOwner: getFestivalOwnerPermissionStrings(),

	RoleFestivalAdmin: getFestivalAdminPermissionStrings(),

	RoleFinanceManager: {
		// Transactions
		PermTransactionsRead, PermTransactionsList, PermTransactionsExport,
		PermTransactionsCreate, PermTransactionsProcess,
		// Refunds
		PermRefundsRead, PermRefundsList, PermRefundsCreate,
		PermRefundsApprove, PermRefundsReject, PermRefundsProcess,
		// Wallets
		PermWalletsRead, PermWalletsList, PermWalletsExport, PermWalletsAdjust,
		// Reports
		PermReportsRead, PermReportsList, PermReportsExport,
		PermReportsFinance, PermReportsSales, PermReportsAnalytics,
		// Basic read access
		PermFestivalsRead, PermStandsRead, PermStandsList,
		PermOrdersRead, PermOrdersList,
	},

	RoleLineupManager: {
		// Lineup full access
		PermLineupRead, PermLineupWrite, PermLineupDelete,
		PermLineupCreate, PermLineupList, PermLineupExport, PermLineupImport,
		// Artists
		PermArtistsRead, PermArtistsWrite, PermArtistsDelete,
		PermArtistsCreate, PermArtistsList,
		// Media for lineup
		PermMediaRead, PermMediaWrite, PermMediaDelete,
		PermMediaCreate, PermMediaList, PermMediaUpload,
		// Notifications for announcements
		PermNotificationsRead, PermNotificationsCreate, PermNotificationsSend,
		// Basic read access
		PermFestivalsRead,
	},

	RoleSecurityManager: {
		// Security full access
		PermSecurityRead, PermSecurityWrite, PermSecurityDelete,
		PermSecurityCreate, PermSecurityList, PermSecurityAlerts, PermSecurityResolve,
		// Tickets for scanning
		PermTicketsRead, PermTicketsList, PermTicketsScan, PermTicketsValidate,
		// Staff management
		PermStaffRead, PermStaffWrite, PermStaffDelete,
		PermStaffCreate, PermStaffList, PermStaffSchedule, PermStaffAssign,
		// Audit access
		PermAuditRead, PermAuditList,
		// Basic read access
		PermFestivalsRead,
	},

	RoleCashier: {
		// Transactions - basic operations
		PermTransactionsCreate, PermTransactionsProcess, PermTransactionsRead,
		// Orders
		PermOrdersCreate, PermOrdersProcess, PermOrdersRead, PermOrdersList,
		// Products read
		PermProductsRead, PermProductsList,
		// Wallets - read and basic operations
		PermWalletsRead,
		// Stands - own stand
		PermStandsRead,
		// Festival read
		PermFestivalsRead,
	},

	RoleScanner: {
		// Tickets - scan operations
		PermTicketsRead, PermTicketsScan, PermTicketsValidate,
		// Security read
		PermSecurityRead,
		// Festival read
		PermFestivalsRead,
	},

	RoleViewer: {
		// Read-only access
		PermFestivalsRead,
		PermStandsRead, PermStandsList,
		PermProductsRead, PermProductsList,
		PermOrdersRead, PermOrdersList,
		PermTicketsRead, PermTicketsList,
		PermLineupRead, PermLineupList,
		PermReportsRead, PermReportsList,
	},
}

// getAllPermissionStrings returns all defined permissions
func getAllPermissionStrings() []PermissionString {
	return []PermissionString{
		// Festivals
		PermFestivalsRead, PermFestivalsWrite, PermFestivalsDelete,
		PermFestivalsCreate, PermFestivalsList, PermFestivalsExport,
		// Stands
		PermStandsRead, PermStandsWrite, PermStandsDelete,
		PermStandsCreate, PermStandsList, PermStandsExport, PermStandsImport,
		// Products
		PermProductsRead, PermProductsWrite, PermProductsDelete,
		PermProductsCreate, PermProductsList, PermProductsExport, PermProductsImport,
		// Orders
		PermOrdersRead, PermOrdersWrite, PermOrdersDelete,
		PermOrdersCreate, PermOrdersList, PermOrdersExport,
		PermOrdersProcess, PermOrdersRefund,
		// Wallets
		PermWalletsRead, PermWalletsWrite, PermWalletsDelete,
		PermWalletsCreate, PermWalletsList, PermWalletsExport,
		PermWalletsTopup, PermWalletsRefund, PermWalletsAdjust,
		// Staff
		PermStaffRead, PermStaffWrite, PermStaffDelete,
		PermStaffCreate, PermStaffList, PermStaffExport,
		PermStaffSchedule, PermStaffAssign,
		// Reports
		PermReportsRead, PermReportsList, PermReportsExport,
		PermReportsCreate, PermReportsFinance, PermReportsSales, PermReportsAnalytics,
		// Settings
		PermSettingsRead, PermSettingsWrite, PermSettingsGeneral,
		PermSettingsIntegrations, PermSettingsBranding, PermSettingsNFC,
		PermSettingsPayment, PermSettingsRoles,
		// Tickets
		PermTicketsRead, PermTicketsWrite, PermTicketsDelete,
		PermTicketsCreate, PermTicketsList, PermTicketsExport,
		PermTicketsScan, PermTicketsValidate, PermTicketsRevoke,
		// Lineup
		PermLineupRead, PermLineupWrite, PermLineupDelete,
		PermLineupCreate, PermLineupList, PermLineupExport, PermLineupImport,
		// Security
		PermSecurityRead, PermSecurityWrite, PermSecurityDelete,
		PermSecurityCreate, PermSecurityList, PermSecurityAlerts, PermSecurityResolve,
		// Audit
		PermAuditRead, PermAuditList, PermAuditExport,
		// Transactions
		PermTransactionsRead, PermTransactionsList, PermTransactionsExport,
		PermTransactionsCreate, PermTransactionsProcess, PermTransactionsRefund,
		// Refunds
		PermRefundsRead, PermRefundsList, PermRefundsCreate,
		PermRefundsApprove, PermRefundsReject, PermRefundsProcess,
		// Notifications
		PermNotificationsRead, PermNotificationsWrite, PermNotificationsDelete,
		PermNotificationsCreate, PermNotificationsList, PermNotificationsSend,
		// Media
		PermMediaRead, PermMediaWrite, PermMediaDelete,
		PermMediaCreate, PermMediaList, PermMediaUpload,
		// Map
		PermMapRead, PermMapWrite, PermMapDelete, PermMapCreate,
		// Inventory
		PermInventoryRead, PermInventoryWrite, PermInventoryAdjust, PermInventoryAlert,
		// NFC
		PermNFCRead, PermNFCWrite, PermNFCLink, PermNFCUnlink, PermNFCBatch,
		// API
		PermAPIRead, PermAPIWrite, PermAPICreate, PermAPIDelete,
		// Users
		PermUsersRead, PermUsersWrite, PermUsersDelete,
		PermUsersCreate, PermUsersList, PermUsersExport,
		// Roles
		PermRolesRead, PermRolesWrite, PermRolesDelete,
		PermRolesCreate, PermRolesList, PermRolesAssign,
		// Chatbot
		PermChatbotRead, PermChatbotWrite, PermChatbotTrain, PermChatbotConfig,
		// Gallery
		PermGalleryRead, PermGalleryWrite, PermGalleryDelete, PermGalleryUpload,
		// Artists
		PermArtistsRead, PermArtistsWrite, PermArtistsDelete,
		PermArtistsCreate, PermArtistsList,
	}
}

// getFestivalOwnerPermissionStrings returns permissions for festival owner
func getFestivalOwnerPermissionStrings() []PermissionString {
	// Festival owner has all permissions except global user management
	all := getAllPermissionStrings()
	excluded := map[PermissionString]bool{
		PermUsersDelete: true, // Cannot delete users globally
	}

	var perms []PermissionString
	for _, p := range all {
		if !excluded[p] {
			perms = append(perms, p)
		}
	}
	return perms
}

// getFestivalAdminPermissionStrings returns permissions for festival admin
func getFestivalAdminPermissionStrings() []PermissionString {
	// Festival admin has most permissions but cannot delete festival or manage ownership
	all := getAllPermissionStrings()
	excluded := map[PermissionString]bool{
		PermFestivalsDelete: true,
		PermUsersDelete:     true,
		PermUsersCreate:     true, // Cannot create global users
		PermSettingsRoles:   true, // Cannot manage top-level role settings
	}

	var perms []PermissionString
	for _, p := range all {
		if !excluded[p] {
			perms = append(perms, p)
		}
	}
	return perms
}

// ============================================================================
// Utility Functions
// ============================================================================

// ConvertToResourceAction converts a PermissionString to Resource and Action types
func ConvertToResourceAction(perm PermissionString) (Resource, Action) {
	resource := perm.Resource()
	action := perm.Action()

	// Map permission resource to auth Resource type
	resourceMap := map[string]Resource{
		"festivals":     ResourceFestival,
		"stands":        ResourceStand,
		"products":      ResourceProduct,
		"orders":        ResourceTransaction, // Orders map to transactions
		"wallets":       ResourceWallet,
		"staff":         ResourceStaff,
		"reports":       ResourceReport,
		"settings":      ResourceSettings,
		"tickets":       ResourceTicket,
		"lineup":        ResourceLineup,
		"security":      ResourceSecurity,
		"audit":         ResourceAudit,
		"transactions":  ResourceTransaction,
		"refunds":       ResourceRefund,
		"notifications": ResourceNotification,
		"media":         ResourceMedia,
		"users":         ResourceUser,
		"roles":         ResourceRole,
	}

	// Map permission action to auth Action type
	actionMap := map[string]Action{
		"read":    ActionRead,
		"write":   ActionUpdate,
		"delete":  ActionDelete,
		"create":  ActionCreate,
		"list":    ActionList,
		"export":  ActionExport,
		"import":  ActionImport,
		"process": ActionProcess,
		"approve": ActionApprove,
		"reject":  ActionReject,
		"scan":    ActionScan,
	}

	r, _ := resourceMap[resource]
	a, _ := actionMap[action]

	return r, a
}

// CreatePermissionString creates a PermissionString from resource and action
func CreatePermissionString(resource, action string) PermissionString {
	return PermissionString(fmt.Sprintf("%s.%s", resource, action))
}

// GetPermissionsForRole returns all permission strings for a predefined role
func GetPermissionsForRole(roleName PredefinedRoleName) []PermissionString {
	if perms, ok := RolePermissionMapping[roleName]; ok {
		return perms
	}
	return nil
}

// HasPermissionInSet checks if a permission is in a set of permissions
func HasPermissionInSet(perm PermissionString, permissions []PermissionString) bool {
	for _, p := range permissions {
		if p == perm {
			return true
		}
	}
	return false
}

// GetWildcardPermissions returns all permissions matching a wildcard pattern (e.g., "stands.*")
func GetWildcardPermissions(pattern string) []PermissionString {
	if !strings.HasSuffix(pattern, ".*") {
		return nil
	}

	resource := strings.TrimSuffix(pattern, ".*")
	var result []PermissionString

	for _, perm := range getAllPermissionStrings() {
		if perm.Resource() == resource {
			result = append(result, perm)
		}
	}

	return result
}

// AllPermissionStrings returns all available permission strings
func AllPermissionStrings() []PermissionString {
	return getAllPermissionStrings()
}
