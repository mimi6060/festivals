-- Enhanced RBAC Permissions Migration
-- Adds role inheritance and granular permission strings support

-- ============================================================================
-- Role Inheritance Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_inheritance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    child_role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_role_inheritance UNIQUE (parent_role_id, child_role_id),
    CONSTRAINT no_self_inheritance CHECK (parent_role_id != child_role_id)
);

-- Role inheritance indexes
CREATE INDEX idx_role_inheritance_parent ON role_inheritance(parent_role_id);
CREATE INDEX idx_role_inheritance_child ON role_inheritance(child_role_id);

COMMENT ON TABLE role_inheritance IS 'Defines inheritance relationships between roles (parent grants permissions to child)';

-- ============================================================================
-- Permission Strings Table
-- ============================================================================
-- This table stores granular permission strings (e.g., "stands.read", "products.write")
CREATE TABLE IF NOT EXISTS permission_strings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_key VARCHAR(100) NOT NULL UNIQUE,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    scope VARCHAR(50) NOT NULL DEFAULT 'festival',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_permission_string UNIQUE (resource, action)
);

-- Permission strings indexes
CREATE INDEX idx_permission_strings_resource ON permission_strings(resource);
CREATE INDEX idx_permission_strings_action ON permission_strings(action);
CREATE INDEX idx_permission_strings_key ON permission_strings(permission_key);

COMMENT ON TABLE permission_strings IS 'Stores granular permission strings in format resource.action';

-- ============================================================================
-- Role Permission Strings Junction Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_permission_strings (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_string_id UUID NOT NULL REFERENCES permission_strings(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_string_id)
);

-- Role permission strings indexes
CREATE INDEX idx_role_perm_strings_role ON role_permission_strings(role_id);
CREATE INDEX idx_role_perm_strings_perm ON role_permission_strings(permission_string_id);

COMMENT ON TABLE role_permission_strings IS 'Junction table linking roles to permission strings';

-- ============================================================================
-- Permission Groups Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS permission_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_permission_groups_name ON permission_groups(name);

COMMENT ON TABLE permission_groups IS 'Logical groupings of permissions for easier management';

-- ============================================================================
-- Permission Group Members Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS permission_group_members (
    group_id UUID NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
    permission_string_id UUID NOT NULL REFERENCES permission_strings(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (group_id, permission_string_id)
);

CREATE INDEX idx_perm_group_members_group ON permission_group_members(group_id);
CREATE INDEX idx_perm_group_members_perm ON permission_group_members(permission_string_id);

-- ============================================================================
-- Add priority ranges to roles table
-- ============================================================================
ALTER TABLE roles ADD COLUMN IF NOT EXISTS priority_min INTEGER DEFAULT 0;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS priority_max INTEGER DEFAULT 1000;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS inherits_from UUID REFERENCES roles(id);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS color VARCHAR(20);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS icon VARCHAR(50);

-- ============================================================================
-- Role assignment tracking enhancements
-- ============================================================================
ALTER TABLE role_assignments ADD COLUMN IF NOT EXISTS granted_permissions TEXT;
ALTER TABLE role_assignments ADD COLUMN IF NOT EXISTS context_data JSONB;
ALTER TABLE role_assignments ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- Insert Granular Permission Strings
-- ============================================================================
INSERT INTO permission_strings (permission_key, resource, action, scope, description) VALUES
-- Festivals
('festivals.read', 'festivals', 'read', 'festival', 'View festival details'),
('festivals.write', 'festivals', 'write', 'festival', 'Edit festival settings'),
('festivals.delete', 'festivals', 'delete', 'festival', 'Delete festival'),
('festivals.create', 'festivals', 'create', 'global', 'Create new festivals'),
('festivals.list', 'festivals', 'list', 'global', 'List all festivals'),
('festivals.export', 'festivals', 'export', 'festival', 'Export festival data'),

-- Stands
('stands.read', 'stands', 'read', 'festival', 'View stand details'),
('stands.write', 'stands', 'write', 'festival', 'Edit stand settings'),
('stands.delete', 'stands', 'delete', 'festival', 'Delete stands'),
('stands.create', 'stands', 'create', 'festival', 'Create new stands'),
('stands.list', 'stands', 'list', 'festival', 'List all stands'),
('stands.export', 'stands', 'export', 'festival', 'Export stand data'),
('stands.import', 'stands', 'import', 'festival', 'Import stand data'),

-- Products
('products.read', 'products', 'read', 'festival', 'View product details'),
('products.write', 'products', 'write', 'festival', 'Edit products'),
('products.delete', 'products', 'delete', 'festival', 'Delete products'),
('products.create', 'products', 'create', 'festival', 'Create new products'),
('products.list', 'products', 'list', 'festival', 'List all products'),
('products.export', 'products', 'export', 'festival', 'Export product data'),
('products.import', 'products', 'import', 'festival', 'Import product data'),

-- Orders
('orders.read', 'orders', 'read', 'festival', 'View order details'),
('orders.write', 'orders', 'write', 'festival', 'Edit orders'),
('orders.delete', 'orders', 'delete', 'festival', 'Delete orders'),
('orders.create', 'orders', 'create', 'festival', 'Create new orders'),
('orders.list', 'orders', 'list', 'festival', 'List all orders'),
('orders.export', 'orders', 'export', 'festival', 'Export order data'),
('orders.process', 'orders', 'process', 'festival', 'Process orders'),
('orders.refund', 'orders', 'refund', 'festival', 'Refund orders'),

-- Wallets
('wallets.read', 'wallets', 'read', 'festival', 'View wallet details'),
('wallets.write', 'wallets', 'write', 'festival', 'Edit wallets'),
('wallets.delete', 'wallets', 'delete', 'festival', 'Delete wallets'),
('wallets.create', 'wallets', 'create', 'festival', 'Create new wallets'),
('wallets.list', 'wallets', 'list', 'festival', 'List all wallets'),
('wallets.export', 'wallets', 'export', 'festival', 'Export wallet data'),
('wallets.topup', 'wallets', 'topup', 'festival', 'Top up wallets'),
('wallets.refund', 'wallets', 'refund', 'festival', 'Refund wallets'),
('wallets.adjust', 'wallets', 'adjust', 'festival', 'Adjust wallet balances'),

-- Staff
('staff.read', 'staff', 'read', 'festival', 'View staff details'),
('staff.write', 'staff', 'write', 'festival', 'Edit staff'),
('staff.delete', 'staff', 'delete', 'festival', 'Delete staff'),
('staff.create', 'staff', 'create', 'festival', 'Create new staff'),
('staff.list', 'staff', 'list', 'festival', 'List all staff'),
('staff.export', 'staff', 'export', 'festival', 'Export staff data'),
('staff.schedule', 'staff', 'schedule', 'festival', 'Manage staff schedules'),
('staff.assign', 'staff', 'assign', 'festival', 'Assign staff to locations'),

-- Reports
('reports.read', 'reports', 'read', 'festival', 'View reports'),
('reports.list', 'reports', 'list', 'festival', 'List all reports'),
('reports.export', 'reports', 'export', 'festival', 'Export reports'),
('reports.create', 'reports', 'create', 'festival', 'Create custom reports'),
('reports.finance', 'reports', 'finance', 'festival', 'View financial reports'),
('reports.sales', 'reports', 'sales', 'festival', 'View sales reports'),
('reports.analytics', 'reports', 'analytics', 'festival', 'View analytics'),

-- Settings
('settings.read', 'settings', 'read', 'festival', 'View settings'),
('settings.write', 'settings', 'write', 'festival', 'Edit settings'),
('settings.general', 'settings', 'general', 'festival', 'Manage general settings'),
('settings.integrations', 'settings', 'integrations', 'festival', 'Manage integrations'),
('settings.branding', 'settings', 'branding', 'festival', 'Manage branding'),
('settings.nfc', 'settings', 'nfc', 'festival', 'Manage NFC settings'),
('settings.payment', 'settings', 'payment', 'festival', 'Manage payment settings'),
('settings.roles', 'settings', 'roles', 'festival', 'Manage role settings'),

-- Tickets
('tickets.read', 'tickets', 'read', 'festival', 'View ticket details'),
('tickets.write', 'tickets', 'write', 'festival', 'Edit tickets'),
('tickets.delete', 'tickets', 'delete', 'festival', 'Delete tickets'),
('tickets.create', 'tickets', 'create', 'festival', 'Create new tickets'),
('tickets.list', 'tickets', 'list', 'festival', 'List all tickets'),
('tickets.export', 'tickets', 'export', 'festival', 'Export ticket data'),
('tickets.scan', 'tickets', 'scan', 'festival', 'Scan tickets'),
('tickets.validate', 'tickets', 'validate', 'festival', 'Validate tickets'),
('tickets.revoke', 'tickets', 'revoke', 'festival', 'Revoke tickets'),

-- Lineup
('lineup.read', 'lineup', 'read', 'festival', 'View lineup'),
('lineup.write', 'lineup', 'write', 'festival', 'Edit lineup'),
('lineup.delete', 'lineup', 'delete', 'festival', 'Delete lineup entries'),
('lineup.create', 'lineup', 'create', 'festival', 'Create lineup entries'),
('lineup.list', 'lineup', 'list', 'festival', 'List lineup'),
('lineup.export', 'lineup', 'export', 'festival', 'Export lineup'),
('lineup.import', 'lineup', 'import', 'festival', 'Import lineup'),

-- Security
('security.read', 'security', 'read', 'festival', 'View security info'),
('security.write', 'security', 'write', 'festival', 'Edit security settings'),
('security.delete', 'security', 'delete', 'festival', 'Delete security rules'),
('security.create', 'security', 'create', 'festival', 'Create security rules'),
('security.list', 'security', 'list', 'festival', 'List security rules'),
('security.alerts', 'security', 'alerts', 'festival', 'Manage security alerts'),
('security.resolve', 'security', 'resolve', 'festival', 'Resolve security incidents'),

-- Audit
('audit.read', 'audit', 'read', 'festival', 'View audit logs'),
('audit.list', 'audit', 'list', 'festival', 'List audit logs'),
('audit.export', 'audit', 'export', 'festival', 'Export audit logs'),

-- Transactions
('transactions.read', 'transactions', 'read', 'festival', 'View transactions'),
('transactions.list', 'transactions', 'list', 'festival', 'List transactions'),
('transactions.export', 'transactions', 'export', 'festival', 'Export transactions'),
('transactions.create', 'transactions', 'create', 'festival', 'Create transactions'),
('transactions.process', 'transactions', 'process', 'festival', 'Process transactions'),
('transactions.refund', 'transactions', 'refund', 'festival', 'Refund transactions'),

-- Refunds
('refunds.read', 'refunds', 'read', 'festival', 'View refunds'),
('refunds.list', 'refunds', 'list', 'festival', 'List refunds'),
('refunds.create', 'refunds', 'create', 'festival', 'Create refunds'),
('refunds.approve', 'refunds', 'approve', 'festival', 'Approve refunds'),
('refunds.reject', 'refunds', 'reject', 'festival', 'Reject refunds'),
('refunds.process', 'refunds', 'process', 'festival', 'Process refunds'),

-- Notifications
('notifications.read', 'notifications', 'read', 'festival', 'View notifications'),
('notifications.write', 'notifications', 'write', 'festival', 'Edit notifications'),
('notifications.delete', 'notifications', 'delete', 'festival', 'Delete notifications'),
('notifications.create', 'notifications', 'create', 'festival', 'Create notifications'),
('notifications.list', 'notifications', 'list', 'festival', 'List notifications'),
('notifications.send', 'notifications', 'send', 'festival', 'Send notifications'),

-- Media
('media.read', 'media', 'read', 'festival', 'View media'),
('media.write', 'media', 'write', 'festival', 'Edit media'),
('media.delete', 'media', 'delete', 'festival', 'Delete media'),
('media.create', 'media', 'create', 'festival', 'Create media'),
('media.list', 'media', 'list', 'festival', 'List media'),
('media.upload', 'media', 'upload', 'festival', 'Upload media'),

-- Map
('map.read', 'map', 'read', 'festival', 'View map'),
('map.write', 'map', 'write', 'festival', 'Edit map'),
('map.delete', 'map', 'delete', 'festival', 'Delete map elements'),
('map.create', 'map', 'create', 'festival', 'Create map elements'),

-- Inventory
('inventory.read', 'inventory', 'read', 'festival', 'View inventory'),
('inventory.write', 'inventory', 'write', 'festival', 'Edit inventory'),
('inventory.adjust', 'inventory', 'adjust', 'festival', 'Adjust inventory'),
('inventory.alert', 'inventory', 'alert', 'festival', 'Manage inventory alerts'),

-- NFC
('nfc.read', 'nfc', 'read', 'festival', 'View NFC data'),
('nfc.write', 'nfc', 'write', 'festival', 'Edit NFC settings'),
('nfc.link', 'nfc', 'link', 'festival', 'Link NFC wristbands'),
('nfc.unlink', 'nfc', 'unlink', 'festival', 'Unlink NFC wristbands'),
('nfc.batch', 'nfc', 'batch', 'festival', 'Batch NFC operations'),

-- API
('api.read', 'api', 'read', 'festival', 'View API keys'),
('api.write', 'api', 'write', 'festival', 'Edit API settings'),
('api.create', 'api', 'create', 'festival', 'Create API keys'),
('api.delete', 'api', 'delete', 'festival', 'Delete API keys'),

-- Users
('users.read', 'users', 'read', 'global', 'View user details'),
('users.write', 'users', 'write', 'global', 'Edit users'),
('users.delete', 'users', 'delete', 'global', 'Delete users'),
('users.create', 'users', 'create', 'global', 'Create users'),
('users.list', 'users', 'list', 'global', 'List users'),
('users.export', 'users', 'export', 'global', 'Export user data'),

-- Roles
('roles.read', 'roles', 'read', 'festival', 'View roles'),
('roles.write', 'roles', 'write', 'festival', 'Edit roles'),
('roles.delete', 'roles', 'delete', 'festival', 'Delete roles'),
('roles.create', 'roles', 'create', 'festival', 'Create roles'),
('roles.list', 'roles', 'list', 'festival', 'List roles'),
('roles.assign', 'roles', 'assign', 'festival', 'Assign roles'),

-- Chatbot
('chatbot.read', 'chatbot', 'read', 'festival', 'View chatbot'),
('chatbot.write', 'chatbot', 'write', 'festival', 'Edit chatbot'),
('chatbot.train', 'chatbot', 'train', 'festival', 'Train chatbot'),
('chatbot.config', 'chatbot', 'config', 'festival', 'Configure chatbot'),

-- Gallery
('gallery.read', 'gallery', 'read', 'festival', 'View gallery'),
('gallery.write', 'gallery', 'write', 'festival', 'Edit gallery'),
('gallery.delete', 'gallery', 'delete', 'festival', 'Delete gallery items'),
('gallery.upload', 'gallery', 'upload', 'festival', 'Upload to gallery'),

-- Artists
('artists.read', 'artists', 'read', 'festival', 'View artists'),
('artists.write', 'artists', 'write', 'festival', 'Edit artists'),
('artists.delete', 'artists', 'delete', 'festival', 'Delete artists'),
('artists.create', 'artists', 'create', 'festival', 'Create artists'),
('artists.list', 'artists', 'list', 'festival', 'List artists')
ON CONFLICT (permission_key) DO NOTHING;

-- ============================================================================
-- Insert Permission Groups
-- ============================================================================
INSERT INTO permission_groups (name, display_name, description) VALUES
('festivals_management', 'Festival Management', 'Full control over festival settings and configuration'),
('stands_management', 'Stands Management', 'Create, edit, and manage stands'),
('products_management', 'Products Management', 'Manage products and inventory'),
('orders_management', 'Orders Management', 'Process and manage orders'),
('wallets_management', 'Wallets Management', 'Manage digital wallets and top-ups'),
('staff_management', 'Staff Management', 'Manage staff members and schedules'),
('reports_access', 'Reports Access', 'View and export reports'),
('settings_management', 'Settings Management', 'Configure festival settings'),
('tickets_management', 'Tickets Management', 'Manage tickets and access control'),
('lineup_management', 'Lineup Management', 'Manage festival lineup and schedules'),
('security_management', 'Security Management', 'Manage security alerts and incidents'),
('audit_access', 'Audit Access', 'View audit logs and history'),
('finance_operations', 'Finance Operations', 'Financial transactions and refunds'),
('notifications_management', 'Notifications Management', 'Send and manage notifications'),
('media_management', 'Media Management', 'Upload and manage media files'),
('nfc_management', 'NFC/Wristband Management', 'Link and manage NFC wristbands'),
('api_management', 'API Management', 'Manage API keys and webhooks'),
('users_management', 'Users Management', 'Manage platform users'),
('roles_management', 'Roles & Permissions Management', 'Manage roles and assign permissions'),
('inventory_management', 'Inventory Management', 'Manage inventory and stock levels'),
('cashier_operations', 'Cashier Operations', 'Basic cashier and POS operations'),
('scanner_operations', 'Scanner Operations', 'Ticket scanning and validation'),
('viewer_access', 'Viewer Access', 'Read-only access to festival data')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Link permission strings to permission groups
-- ============================================================================
-- This can be done programmatically on application start based on the Go definitions

-- ============================================================================
-- Update triggers for updated_at
-- ============================================================================
CREATE TRIGGER update_permission_groups_updated_at
    BEFORE UPDATE ON permission_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Add role inheritance for system roles
-- ============================================================================
-- This is done programmatically in the application to ensure IDs are correct
