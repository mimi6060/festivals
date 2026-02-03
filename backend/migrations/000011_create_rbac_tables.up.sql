-- RBAC (Role-Based Access Control) Tables
-- Migration: 000010_create_rbac_tables

-- ============================================================================
-- Permissions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    scope VARCHAR(50) NOT NULL DEFAULT 'festival',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_permission UNIQUE (resource, action)
);

-- Permissions indexes
CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_action ON permissions(action);
CREATE INDEX idx_permissions_scope ON permissions(scope);

COMMENT ON TABLE permissions IS 'Stores granular permissions for resources and actions';
COMMENT ON COLUMN permissions.resource IS 'Resource type: festival, stand, product, ticket, lineup, wallet, transaction, refund, user, staff, report, security, settings, role, audit, notification, media';
COMMENT ON COLUMN permissions.action IS 'Action type: create, read, update, delete, list, export, import, approve, reject, scan, process';
COMMENT ON COLUMN permissions.scope IS 'Permission scope: global, festival, stand, own';

-- ============================================================================
-- Roles Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL DEFAULT 'custom',
    festival_id UUID REFERENCES festivals(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_role_name_festival UNIQUE (name, festival_id)
);

-- Roles indexes
CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_festival_id ON roles(festival_id);
CREATE INDEX idx_roles_type ON roles(type);
CREATE INDEX idx_roles_is_active ON roles(is_active);
CREATE INDEX idx_roles_priority ON roles(priority DESC);

COMMENT ON TABLE roles IS 'Stores roles for RBAC system';
COMMENT ON COLUMN roles.name IS 'Unique role identifier within festival scope';
COMMENT ON COLUMN roles.display_name IS 'Human-readable role name';
COMMENT ON COLUMN roles.type IS 'Role type: system (predefined) or custom';
COMMENT ON COLUMN roles.festival_id IS 'NULL for global roles, UUID for festival-specific roles';
COMMENT ON COLUMN roles.priority IS 'Higher priority roles override lower priority roles';

-- ============================================================================
-- Role Permissions Junction Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- Role permissions indexes
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

COMMENT ON TABLE role_permissions IS 'Junction table linking roles to their permissions';

-- ============================================================================
-- Role Assignments Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    festival_id UUID REFERENCES festivals(id) ON DELETE CASCADE,
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    assigned_by UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_role_festival UNIQUE (user_id, role_id, festival_id)
);

-- Role assignments indexes
CREATE INDEX idx_role_assignments_user ON role_assignments(user_id);
CREATE INDEX idx_role_assignments_role ON role_assignments(role_id);
CREATE INDEX idx_role_assignments_festival ON role_assignments(festival_id);
CREATE INDEX idx_role_assignments_stand ON role_assignments(stand_id);
CREATE INDEX idx_role_assignments_is_active ON role_assignments(is_active);
CREATE INDEX idx_role_assignments_expires_at ON role_assignments(expires_at);
CREATE INDEX idx_role_assignments_assigned_by ON role_assignments(assigned_by);
CREATE INDEX idx_role_assignments_assigned_at ON role_assignments(assigned_at DESC);

-- Composite index for common queries
CREATE INDEX idx_role_assignments_user_active ON role_assignments(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_role_assignments_festival_active ON role_assignments(festival_id, is_active) WHERE is_active = true;

COMMENT ON TABLE role_assignments IS 'Stores user role assignments with optional festival/stand scope';
COMMENT ON COLUMN role_assignments.festival_id IS 'NULL for global assignments';
COMMENT ON COLUMN role_assignments.stand_id IS 'Optional stand-level scope for cashier/staff roles';
COMMENT ON COLUMN role_assignments.expires_at IS 'Optional expiration for temporary role assignments';

-- ============================================================================
-- RBAC Audit Log Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS rbac_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(50) NOT NULL,
    actor_id UUID NOT NULL REFERENCES users(id),
    target_user_id UUID REFERENCES users(id),
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    festival_id UUID REFERENCES festivals(id) ON DELETE SET NULL,
    resource VARCHAR(50),
    resource_id VARCHAR(100),
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log indexes
CREATE INDEX idx_rbac_audit_action ON rbac_audit_logs(action);
CREATE INDEX idx_rbac_audit_actor ON rbac_audit_logs(actor_id);
CREATE INDEX idx_rbac_audit_target_user ON rbac_audit_logs(target_user_id);
CREATE INDEX idx_rbac_audit_role ON rbac_audit_logs(role_id);
CREATE INDEX idx_rbac_audit_festival ON rbac_audit_logs(festival_id);
CREATE INDEX idx_rbac_audit_resource ON rbac_audit_logs(resource);
CREATE INDEX idx_rbac_audit_created_at ON rbac_audit_logs(created_at DESC);

-- Composite index for common audit queries
CREATE INDEX idx_rbac_audit_actor_created ON rbac_audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_rbac_audit_festival_created ON rbac_audit_logs(festival_id, created_at DESC);

COMMENT ON TABLE rbac_audit_logs IS 'Audit trail for all RBAC operations';
COMMENT ON COLUMN rbac_audit_logs.action IS 'Type of action: role_created, role_updated, role_deleted, role_assigned, role_revoked, permission_granted, permission_revoked, access_denied, access_granted';
COMMENT ON COLUMN rbac_audit_logs.old_value IS 'Previous state (JSON)';
COMMENT ON COLUMN rbac_audit_logs.new_value IS 'New state (JSON)';

-- ============================================================================
-- Trigger for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_assignments_updated_at
    BEFORE UPDATE ON role_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Seed Default Permissions
-- ============================================================================
INSERT INTO permissions (resource, action, scope, description) VALUES
-- Festival permissions
('festival', 'create', 'global', 'Can create new festivals'),
('festival', 'read', 'festival', 'Can view festival details'),
('festival', 'update', 'festival', 'Can update festival settings'),
('festival', 'delete', 'festival', 'Can delete festival'),
('festival', 'list', 'global', 'Can list all festivals'),

-- Stand permissions
('stand', 'create', 'festival', 'Can create stands'),
('stand', 'read', 'festival', 'Can view stand details'),
('stand', 'update', 'festival', 'Can update stand settings'),
('stand', 'delete', 'festival', 'Can delete stands'),
('stand', 'list', 'festival', 'Can list all stands'),

-- Product permissions
('product', 'create', 'festival', 'Can create products'),
('product', 'read', 'festival', 'Can view product details'),
('product', 'update', 'festival', 'Can update products'),
('product', 'delete', 'festival', 'Can delete products'),
('product', 'list', 'festival', 'Can list all products'),
('product', 'import', 'festival', 'Can import products'),
('product', 'export', 'festival', 'Can export products'),

-- Ticket permissions
('ticket', 'create', 'festival', 'Can create tickets'),
('ticket', 'read', 'festival', 'Can view ticket details'),
('ticket', 'update', 'festival', 'Can update tickets'),
('ticket', 'delete', 'festival', 'Can delete tickets'),
('ticket', 'list', 'festival', 'Can list all tickets'),
('ticket', 'scan', 'festival', 'Can scan tickets'),
('ticket', 'export', 'festival', 'Can export tickets'),

-- Lineup permissions
('lineup', 'create', 'festival', 'Can create lineup entries'),
('lineup', 'read', 'festival', 'Can view lineup'),
('lineup', 'update', 'festival', 'Can update lineup'),
('lineup', 'delete', 'festival', 'Can delete lineup entries'),
('lineup', 'list', 'festival', 'Can list lineup'),
('lineup', 'import', 'festival', 'Can import lineup'),
('lineup', 'export', 'festival', 'Can export lineup'),

-- Wallet permissions
('wallet', 'create', 'festival', 'Can create wallets'),
('wallet', 'read', 'festival', 'Can view wallet details'),
('wallet', 'update', 'festival', 'Can update wallet balance'),
('wallet', 'delete', 'festival', 'Can delete wallets'),
('wallet', 'list', 'festival', 'Can list all wallets'),

-- Transaction permissions
('transaction', 'create', 'festival', 'Can create transactions'),
('transaction', 'read', 'festival', 'Can view transaction details'),
('transaction', 'update', 'festival', 'Can update transactions'),
('transaction', 'delete', 'festival', 'Can delete transactions'),
('transaction', 'list', 'festival', 'Can list all transactions'),
('transaction', 'export', 'festival', 'Can export transactions'),
('transaction', 'process', 'festival', 'Can process transactions'),

-- Refund permissions
('refund', 'create', 'festival', 'Can create refunds'),
('refund', 'read', 'festival', 'Can view refund details'),
('refund', 'update', 'festival', 'Can update refunds'),
('refund', 'delete', 'festival', 'Can delete refunds'),
('refund', 'list', 'festival', 'Can list all refunds'),
('refund', 'approve', 'festival', 'Can approve refunds'),
('refund', 'reject', 'festival', 'Can reject refunds'),
('refund', 'process', 'festival', 'Can process refunds'),

-- User permissions
('user', 'create', 'global', 'Can create users'),
('user', 'read', 'global', 'Can view user details'),
('user', 'update', 'global', 'Can update users'),
('user', 'delete', 'global', 'Can delete users'),
('user', 'list', 'global', 'Can list all users'),

-- Staff permissions
('staff', 'create', 'festival', 'Can create staff'),
('staff', 'read', 'festival', 'Can view staff details'),
('staff', 'update', 'festival', 'Can update staff'),
('staff', 'delete', 'festival', 'Can delete staff'),
('staff', 'list', 'festival', 'Can list all staff'),

-- Report permissions
('report', 'create', 'festival', 'Can create reports'),
('report', 'read', 'festival', 'Can view reports'),
('report', 'export', 'festival', 'Can export reports'),
('report', 'list', 'festival', 'Can list reports'),

-- Security permissions
('security', 'create', 'festival', 'Can create security rules'),
('security', 'read', 'festival', 'Can view security settings'),
('security', 'update', 'festival', 'Can update security settings'),
('security', 'delete', 'festival', 'Can delete security rules'),
('security', 'list', 'festival', 'Can list security rules'),

-- Settings permissions
('settings', 'read', 'festival', 'Can view settings'),
('settings', 'update', 'festival', 'Can update settings'),

-- Role permissions
('role', 'create', 'festival', 'Can create roles'),
('role', 'read', 'festival', 'Can view roles'),
('role', 'update', 'festival', 'Can update roles'),
('role', 'delete', 'festival', 'Can delete roles'),
('role', 'list', 'festival', 'Can list roles'),

-- Audit permissions
('audit', 'read', 'festival', 'Can view audit logs'),
('audit', 'list', 'festival', 'Can list audit logs'),
('audit', 'export', 'festival', 'Can export audit logs'),

-- Notification permissions
('notification', 'create', 'festival', 'Can create notifications'),
('notification', 'read', 'festival', 'Can view notifications'),
('notification', 'update', 'festival', 'Can update notifications'),
('notification', 'delete', 'festival', 'Can delete notifications'),
('notification', 'list', 'festival', 'Can list notifications'),

-- Media permissions
('media', 'create', 'festival', 'Can upload media'),
('media', 'read', 'festival', 'Can view media'),
('media', 'update', 'festival', 'Can update media'),
('media', 'delete', 'festival', 'Can delete media'),
('media', 'list', 'festival', 'Can list media')
ON CONFLICT (resource, action) DO NOTHING;

-- ============================================================================
-- Seed Predefined Roles
-- ============================================================================

-- SUPER_ADMIN (Global role with all permissions)
INSERT INTO roles (name, display_name, description, type, festival_id, priority, is_active)
VALUES ('SUPER_ADMIN', 'Super Admin', 'Full platform access - can manage all festivals and system settings', 'system', NULL, 1000, true)
ON CONFLICT (name, festival_id) DO NOTHING;

-- Assign all permissions to SUPER_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'SUPER_ADMIN' AND r.festival_id IS NULL
ON CONFLICT DO NOTHING;

-- FESTIVAL_OWNER
INSERT INTO roles (name, display_name, description, type, festival_id, priority, is_active)
VALUES ('FESTIVAL_OWNER', 'Festival Owner', 'Owner of a festival - full access to their festival', 'system', NULL, 900, true)
ON CONFLICT (name, festival_id) DO NOTHING;

-- FESTIVAL_ADMIN
INSERT INTO roles (name, display_name, description, type, festival_id, priority, is_active)
VALUES ('FESTIVAL_ADMIN', 'Festival Admin', 'Administrator for a festival - almost full access except ownership transfer', 'system', NULL, 800, true)
ON CONFLICT (name, festival_id) DO NOTHING;

-- FINANCE_MANAGER
INSERT INTO roles (name, display_name, description, type, festival_id, priority, is_active)
VALUES ('FINANCE_MANAGER', 'Finance Manager', 'Manages finances, transactions, refunds, and reports', 'system', NULL, 700, true)
ON CONFLICT (name, festival_id) DO NOTHING;

-- LINEUP_MANAGER
INSERT INTO roles (name, display_name, description, type, festival_id, priority, is_active)
VALUES ('LINEUP_MANAGER', 'Lineup Manager', 'Manages festival lineup and scheduling', 'system', NULL, 600, true)
ON CONFLICT (name, festival_id) DO NOTHING;

-- SECURITY_MANAGER
INSERT INTO roles (name, display_name, description, type, festival_id, priority, is_active)
VALUES ('SECURITY_MANAGER', 'Security Manager', 'Manages security, access control, and scanning', 'system', NULL, 600, true)
ON CONFLICT (name, festival_id) DO NOTHING;

-- CASHIER
INSERT INTO roles (name, display_name, description, type, festival_id, priority, is_active)
VALUES ('CASHIER', 'Cashier', 'Can process sales and view basic information', 'system', NULL, 300, true)
ON CONFLICT (name, festival_id) DO NOTHING;

-- SCANNER
INSERT INTO roles (name, display_name, description, type, festival_id, priority, is_active)
VALUES ('SCANNER', 'Scanner', 'Can scan tickets and check entries', 'system', NULL, 200, true)
ON CONFLICT (name, festival_id) DO NOTHING;

-- VIEWER
INSERT INTO roles (name, display_name, description, type, festival_id, priority, is_active)
VALUES ('VIEWER', 'Viewer', 'Read-only access to festival information', 'system', NULL, 100, true)
ON CONFLICT (name, festival_id) DO NOTHING;

-- Assign permissions to FESTIVAL_OWNER (all festival-scope permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'FESTIVAL_OWNER'
  AND r.festival_id IS NULL
  AND p.scope = 'festival'
ON CONFLICT DO NOTHING;

-- Assign permissions to FESTIVAL_ADMIN (all except festival delete)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'FESTIVAL_ADMIN'
  AND r.festival_id IS NULL
  AND p.scope = 'festival'
  AND NOT (p.resource = 'festival' AND p.action = 'delete')
ON CONFLICT DO NOTHING;

-- Assign permissions to FINANCE_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'FINANCE_MANAGER'
  AND r.festival_id IS NULL
  AND (
    (p.resource = 'transaction' AND p.action IN ('create', 'read', 'list', 'export', 'process'))
    OR (p.resource = 'refund' AND p.action IN ('create', 'read', 'list', 'approve', 'reject', 'process'))
    OR (p.resource = 'wallet' AND p.action IN ('read', 'list', 'update'))
    OR (p.resource = 'report' AND p.action IN ('read', 'list', 'export'))
    OR (p.resource = 'festival' AND p.action = 'read')
    OR (p.resource = 'stand' AND p.action IN ('read', 'list'))
  )
ON CONFLICT DO NOTHING;

-- Assign permissions to LINEUP_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'LINEUP_MANAGER'
  AND r.festival_id IS NULL
  AND (
    (p.resource = 'lineup')
    OR (p.resource = 'media')
    OR (p.resource = 'festival' AND p.action = 'read')
    OR (p.resource = 'notification' AND p.action IN ('create', 'read', 'list'))
  )
ON CONFLICT DO NOTHING;

-- Assign permissions to SECURITY_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'SECURITY_MANAGER'
  AND r.festival_id IS NULL
  AND (
    (p.resource = 'security')
    OR (p.resource = 'ticket' AND p.action IN ('read', 'list', 'scan', 'update'))
    OR (p.resource = 'staff')
    OR (p.resource = 'festival' AND p.action = 'read')
    OR (p.resource = 'audit' AND p.action IN ('read', 'list'))
  )
ON CONFLICT DO NOTHING;

-- Assign permissions to CASHIER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'CASHIER'
  AND r.festival_id IS NULL
  AND (
    (p.resource = 'transaction' AND p.action IN ('create', 'read', 'list', 'process'))
    OR (p.resource = 'product' AND p.action IN ('read', 'list'))
    OR (p.resource = 'wallet' AND p.action IN ('read', 'update'))
    OR (p.resource = 'stand' AND p.action = 'read')
    OR (p.resource = 'festival' AND p.action = 'read')
  )
ON CONFLICT DO NOTHING;

-- Assign permissions to SCANNER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'SCANNER'
  AND r.festival_id IS NULL
  AND (
    (p.resource = 'ticket' AND p.action IN ('read', 'scan', 'update'))
    OR (p.resource = 'festival' AND p.action = 'read')
    OR (p.resource = 'security' AND p.action = 'read')
  )
ON CONFLICT DO NOTHING;

-- Assign permissions to VIEWER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'VIEWER'
  AND r.festival_id IS NULL
  AND p.action IN ('read', 'list')
  AND p.resource IN ('festival', 'stand', 'product', 'ticket', 'lineup', 'report')
ON CONFLICT DO NOTHING;
