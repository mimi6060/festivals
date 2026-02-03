-- Drop indexes
DROP INDEX IF EXISTS idx_ticket_types_valid_until;
DROP INDEX IF EXISTS idx_ticket_types_valid_from;
DROP INDEX IF EXISTS idx_ticket_types_status;
DROP INDEX IF EXISTS idx_ticket_types_festival_id;

-- Drop ticket_types table
DROP TABLE IF EXISTS ticket_types;
