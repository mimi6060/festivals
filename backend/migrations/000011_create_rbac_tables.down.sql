-- Rollback RBAC Tables
-- Migration: 000010_create_rbac_tables

-- Drop triggers
DROP TRIGGER IF EXISTS update_role_assignments_updated_at ON role_assignments;
DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;

-- Drop audit logs table
DROP TABLE IF EXISTS rbac_audit_logs;

-- Drop role assignments table
DROP TABLE IF EXISTS role_assignments;

-- Drop role permissions junction table
DROP TABLE IF EXISTS role_permissions;

-- Drop roles table
DROP TABLE IF EXISTS roles;

-- Drop permissions table
DROP TABLE IF EXISTS permissions;

-- Note: We don't drop the update_updated_at_column function
-- as it might be used by other tables
