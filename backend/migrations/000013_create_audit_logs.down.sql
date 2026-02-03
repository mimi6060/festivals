-- Drop views
DROP VIEW IF EXISTS public.security_audit_logs;
DROP VIEW IF EXISTS public.audit_logs_summary;

-- Drop function
DROP FUNCTION IF EXISTS cleanup_old_audit_logs;

-- Drop indexes
DROP INDEX IF EXISTS idx_audit_logs_recent;
DROP INDEX IF EXISTS idx_audit_logs_changes;
DROP INDEX IF EXISTS idx_audit_logs_metadata;
DROP INDEX IF EXISTS idx_audit_logs_resource_resourceid;
DROP INDEX IF EXISTS idx_audit_logs_user_action;
DROP INDEX IF EXISTS idx_audit_logs_action_timestamp;
DROP INDEX IF EXISTS idx_audit_logs_resource_timestamp;
DROP INDEX IF EXISTS idx_audit_logs_festival_timestamp;
DROP INDEX IF EXISTS idx_audit_logs_user_timestamp;
DROP INDEX IF EXISTS idx_audit_logs_ip;
DROP INDEX IF EXISTS idx_audit_logs_timestamp;
DROP INDEX IF EXISTS idx_audit_logs_festival_id;
DROP INDEX IF EXISTS idx_audit_logs_resource_id;
DROP INDEX IF EXISTS idx_audit_logs_resource;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_user_id;

-- Drop audit_logs table
DROP TABLE IF EXISTS public.audit_logs;
