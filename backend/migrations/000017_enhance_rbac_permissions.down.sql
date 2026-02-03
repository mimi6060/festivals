-- Rollback enhanced RBAC permissions migration

-- Drop triggers
DROP TRIGGER IF EXISTS update_permission_groups_updated_at ON permission_groups;

-- Drop new columns from roles table
ALTER TABLE roles DROP COLUMN IF EXISTS priority_min;
ALTER TABLE roles DROP COLUMN IF EXISTS priority_max;
ALTER TABLE roles DROP COLUMN IF EXISTS inherits_from;
ALTER TABLE roles DROP COLUMN IF EXISTS color;
ALTER TABLE roles DROP COLUMN IF EXISTS icon;

-- Drop new columns from role_assignments table
ALTER TABLE role_assignments DROP COLUMN IF EXISTS granted_permissions;
ALTER TABLE role_assignments DROP COLUMN IF EXISTS context_data;
ALTER TABLE role_assignments DROP COLUMN IF EXISTS last_activity_at;

-- Drop junction tables
DROP TABLE IF EXISTS permission_group_members;
DROP TABLE IF EXISTS role_permission_strings;

-- Drop main tables
DROP TABLE IF EXISTS permission_groups;
DROP TABLE IF EXISTS permission_strings;
DROP TABLE IF EXISTS role_inheritance;
