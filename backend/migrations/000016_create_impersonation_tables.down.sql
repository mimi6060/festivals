-- Drop trigger
DROP TRIGGER IF EXISTS trigger_impersonation_session_updated_at ON public.impersonation_sessions;

-- Drop function
DROP FUNCTION IF EXISTS update_impersonation_session_updated_at();

-- Drop tables (audit logs first due to foreign key)
DROP TABLE IF EXISTS public.impersonation_audit_logs;
DROP TABLE IF EXISTS public.impersonation_sessions;
