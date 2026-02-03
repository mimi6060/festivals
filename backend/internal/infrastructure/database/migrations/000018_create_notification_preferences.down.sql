-- Rollback: Drop notification tables and related objects

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_notification_preferences_updated_at ON user_notification_preferences;

-- Drop functions
DROP FUNCTION IF EXISTS update_notification_preferences_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_notification_logs_type_channel;
DROP INDEX IF EXISTS idx_notification_logs_created_at;
DROP INDEX IF EXISTS idx_notification_logs_status;
DROP INDEX IF EXISTS idx_notification_logs_user_id;
DROP INDEX IF EXISTS idx_notification_preferences_device_tokens;
DROP INDEX IF EXISTS idx_notification_preferences_push_enabled;
DROP INDEX IF EXISTS idx_notification_preferences_user_id;

-- Drop tables
DROP TABLE IF EXISTS notification_logs;
DROP TABLE IF EXISTS user_notification_preferences;
