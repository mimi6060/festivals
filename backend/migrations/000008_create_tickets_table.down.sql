-- Drop ticket_scans indexes and table
DROP INDEX IF EXISTS idx_ticket_scans_festival_time;
DROP INDEX IF EXISTS idx_ticket_scans_result;
DROP INDEX IF EXISTS idx_ticket_scans_scanned_at;
DROP INDEX IF EXISTS idx_ticket_scans_scanned_by;
DROP INDEX IF EXISTS idx_ticket_scans_festival_id;
DROP INDEX IF EXISTS idx_ticket_scans_ticket_id;
DROP TABLE IF EXISTS ticket_scans;

-- Drop tickets indexes and table
DROP INDEX IF EXISTS idx_tickets_user_festival;
DROP INDEX IF EXISTS idx_tickets_festival_status;
DROP INDEX IF EXISTS idx_tickets_checked_in_at;
DROP INDEX IF EXISTS idx_tickets_holder_email;
DROP INDEX IF EXISTS idx_tickets_status;
DROP INDEX IF EXISTS idx_tickets_code;
DROP INDEX IF EXISTS idx_tickets_order_id;
DROP INDEX IF EXISTS idx_tickets_user_id;
DROP INDEX IF EXISTS idx_tickets_festival_id;
DROP INDEX IF EXISTS idx_tickets_ticket_type_id;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_code_unique;
DROP TABLE IF EXISTS tickets;
