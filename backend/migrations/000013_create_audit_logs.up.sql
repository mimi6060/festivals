-- Create audit_logs table for comprehensive audit logging
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    changes JSONB,
    ip VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    festival_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Foreign key constraints (soft references to allow audit logs to persist)
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id)
        REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_logs_festival FOREIGN KEY (festival_id)
        REFERENCES public.festivals(id) ON DELETE SET NULL
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource);
CREATE INDEX idx_audit_logs_resource_id ON public.audit_logs(resource_id);
CREATE INDEX idx_audit_logs_festival_id ON public.audit_logs(festival_id);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX idx_audit_logs_ip ON public.audit_logs(ip);

-- Composite indexes for common query patterns
CREATE INDEX idx_audit_logs_user_timestamp ON public.audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_festival_timestamp ON public.audit_logs(festival_id, timestamp DESC);
CREATE INDEX idx_audit_logs_resource_timestamp ON public.audit_logs(resource, timestamp DESC);
CREATE INDEX idx_audit_logs_action_timestamp ON public.audit_logs(action, timestamp DESC);
CREATE INDEX idx_audit_logs_user_action ON public.audit_logs(user_id, action);
CREATE INDEX idx_audit_logs_resource_resourceid ON public.audit_logs(resource, resource_id);

-- GIN index for JSONB columns to enable efficient queries on metadata and changes
CREATE INDEX idx_audit_logs_metadata ON public.audit_logs USING GIN (metadata);
CREATE INDEX idx_audit_logs_changes ON public.audit_logs USING GIN (changes);

-- Partial index for recent logs (last 30 days) - commonly accessed
CREATE INDEX idx_audit_logs_recent ON public.audit_logs(timestamp DESC)
    WHERE timestamp > NOW() - INTERVAL '30 days';

-- Add table and column comments
COMMENT ON TABLE public.audit_logs IS 'Stores audit trail for all user actions and system events';
COMMENT ON COLUMN public.audit_logs.id IS 'Unique identifier for the audit log entry';
COMMENT ON COLUMN public.audit_logs.user_id IS 'Reference to the user who performed the action (NULL for system actions)';
COMMENT ON COLUMN public.audit_logs.action IS 'Type of action performed (e.g., CREATE, UPDATE, DELETE, LOGIN)';
COMMENT ON COLUMN public.audit_logs.resource IS 'Type of resource affected (e.g., user, festival, ticket)';
COMMENT ON COLUMN public.audit_logs.resource_id IS 'Identifier of the specific resource affected';
COMMENT ON COLUMN public.audit_logs.changes IS 'JSONB containing before/after state for change tracking';
COMMENT ON COLUMN public.audit_logs.ip IS 'IP address from which the action was performed';
COMMENT ON COLUMN public.audit_logs.user_agent IS 'User agent string of the client';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Additional context and details about the action';
COMMENT ON COLUMN public.audit_logs.festival_id IS 'Reference to festival for festival-scoped actions';
COMMENT ON COLUMN public.audit_logs.timestamp IS 'When the action occurred';

-- Create a function to automatically cleanup old audit logs (optional retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.audit_logs
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Removes audit logs older than the specified retention period (default: 365 days)';

-- Create a view for common audit queries
CREATE OR REPLACE VIEW public.audit_logs_summary AS
SELECT
    DATE_TRUNC('day', timestamp) as date,
    action,
    resource,
    COUNT(*) as count,
    COUNT(DISTINCT user_id) as unique_users
FROM public.audit_logs
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', timestamp), action, resource
ORDER BY date DESC, count DESC;

COMMENT ON VIEW public.audit_logs_summary IS 'Summarized view of audit logs for the last 30 days';

-- Create a view for security-related events
CREATE OR REPLACE VIEW public.security_audit_logs AS
SELECT
    id,
    user_id,
    action,
    resource,
    resource_id,
    ip,
    user_agent,
    metadata,
    timestamp
FROM public.audit_logs
WHERE action IN (
    'LOGIN',
    'LOGOUT',
    'LOGIN_FAILED',
    'ACCESS_DENIED',
    'SECURITY_ALERT',
    'SUSPICIOUS_ACTIVITY',
    'API_KEY_CREATE',
    'API_KEY_REVOKE',
    'ROLE_CHANGE',
    'USER_BAN',
    'USER_UNBAN'
)
ORDER BY timestamp DESC;

COMMENT ON VIEW public.security_audit_logs IS 'Filtered view of security-related audit events';
