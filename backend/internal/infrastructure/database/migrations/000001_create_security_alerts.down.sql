-- Drop indexes
DROP INDEX IF EXISTS idx_security_zones_active;
DROP INDEX IF EXISTS idx_security_zones_type;
DROP INDEX IF EXISTS idx_security_zones_festival_id;

DROP INDEX IF EXISTS idx_security_alerts_active;
DROP INDEX IF EXISTS idx_security_alerts_created_at;
DROP INDEX IF EXISTS idx_security_alerts_assigned_to;
DROP INDEX IF EXISTS idx_security_alerts_type;
DROP INDEX IF EXISTS idx_security_alerts_severity;
DROP INDEX IF EXISTS idx_security_alerts_status;
DROP INDEX IF EXISTS idx_security_alerts_user_id;
DROP INDEX IF EXISTS idx_security_alerts_festival_id;

-- Drop tables
DROP TABLE IF EXISTS security_zones;
DROP TABLE IF EXISTS security_alerts;
