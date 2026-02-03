-- Create impersonation_sessions table
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(128) NOT NULL UNIQUE,
    admin_id UUID NOT NULL,
    target_user_id UUID NOT NULL,
    admin_email VARCHAR(255),
    target_user_email VARCHAR(255),
    target_user_name VARCHAR(255),
    reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    actions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for impersonation_sessions
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_token ON public.impersonation_sessions(token);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_admin_id ON public.impersonation_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target_user_id ON public.impersonation_sessions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_is_active ON public.impersonation_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_expires_at ON public.impersonation_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active_lookup ON public.impersonation_sessions(admin_id, is_active, expires_at) WHERE is_active = TRUE AND ended_at IS NULL;

-- Create impersonation_audit_logs table for detailed action logging
CREATE TABLE IF NOT EXISTS public.impersonation_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.impersonation_sessions(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL,
    target_user_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(100),
    method VARCHAR(10),
    path TEXT,
    request_body JSONB,
    response_status INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for impersonation_audit_logs
CREATE INDEX IF NOT EXISTS idx_impersonation_audit_logs_session_id ON public.impersonation_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_audit_logs_admin_id ON public.impersonation_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_audit_logs_target_user_id ON public.impersonation_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_audit_logs_action ON public.impersonation_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_impersonation_audit_logs_created_at ON public.impersonation_audit_logs(created_at);

-- Add foreign key constraint to users table if it exists
-- Note: Commented out as the users table structure may vary
-- ALTER TABLE public.impersonation_sessions
--     ADD CONSTRAINT fk_impersonation_sessions_admin_id
--     FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE;
-- ALTER TABLE public.impersonation_sessions
--     ADD CONSTRAINT fk_impersonation_sessions_target_user_id
--     FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_impersonation_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_impersonation_session_updated_at ON public.impersonation_sessions;
CREATE TRIGGER trigger_impersonation_session_updated_at
    BEFORE UPDATE ON public.impersonation_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_impersonation_session_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.impersonation_sessions IS 'Stores admin impersonation sessions for debugging purposes. Only super_admin users can impersonate.';
COMMENT ON TABLE public.impersonation_audit_logs IS 'Audit trail of all actions performed during impersonation sessions.';
COMMENT ON COLUMN public.impersonation_sessions.token IS 'Unique token used for X-Impersonation-Token header';
COMMENT ON COLUMN public.impersonation_sessions.admin_id IS 'The super admin user performing the impersonation';
COMMENT ON COLUMN public.impersonation_sessions.target_user_id IS 'The user being impersonated';
COMMENT ON COLUMN public.impersonation_sessions.actions_count IS 'Number of API requests made during this impersonation session';
