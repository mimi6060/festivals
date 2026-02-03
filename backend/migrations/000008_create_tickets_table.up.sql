-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_type_id UUID NOT NULL,
    festival_id UUID NOT NULL,
    user_id UUID,
    order_id UUID,
    code VARCHAR(100) NOT NULL,
    holder_name VARCHAR(255),
    holder_email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'VALID',
    checked_in_at TIMESTAMP WITH TIME ZONE,
    checked_in_by UUID,
    transfer_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_tickets_ticket_type FOREIGN KEY (ticket_type_id)
        REFERENCES ticket_types(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tickets_festival FOREIGN KEY (festival_id)
        REFERENCES festivals(id) ON DELETE CASCADE,
    CONSTRAINT fk_tickets_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_tickets_checked_in_by FOREIGN KEY (checked_in_by)
        REFERENCES users(id) ON DELETE SET NULL
);

-- Add unique constraint on code
ALTER TABLE tickets ADD CONSTRAINT tickets_code_unique UNIQUE (code);

-- Create indexes
CREATE INDEX idx_tickets_ticket_type_id ON tickets(ticket_type_id);
CREATE INDEX idx_tickets_festival_id ON tickets(festival_id);
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_order_id ON tickets(order_id);
CREATE INDEX idx_tickets_code ON tickets(code);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_holder_email ON tickets(holder_email);
CREATE INDEX idx_tickets_checked_in_at ON tickets(checked_in_at);

-- Composite indexes for common queries
CREATE INDEX idx_tickets_festival_status ON tickets(festival_id, status);
CREATE INDEX idx_tickets_user_festival ON tickets(user_id, festival_id);

-- Create ticket_scans table
CREATE TABLE IF NOT EXISTS ticket_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL,
    festival_id UUID NOT NULL,
    scan_type VARCHAR(10) NOT NULL,
    scanned_by UUID NOT NULL,
    location VARCHAR(255),
    device_id VARCHAR(100),
    result VARCHAR(20) NOT NULL,
    message TEXT,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_ticket_scans_ticket FOREIGN KEY (ticket_id)
        REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_ticket_scans_festival FOREIGN KEY (festival_id)
        REFERENCES festivals(id) ON DELETE CASCADE,
    CONSTRAINT fk_ticket_scans_scanned_by FOREIGN KEY (scanned_by)
        REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for ticket_scans
CREATE INDEX idx_ticket_scans_ticket_id ON ticket_scans(ticket_id);
CREATE INDEX idx_ticket_scans_festival_id ON ticket_scans(festival_id);
CREATE INDEX idx_ticket_scans_scanned_by ON ticket_scans(scanned_by);
CREATE INDEX idx_ticket_scans_scanned_at ON ticket_scans(scanned_at);
CREATE INDEX idx_ticket_scans_result ON ticket_scans(result);

-- Composite index for scan history queries
CREATE INDEX idx_ticket_scans_festival_time ON ticket_scans(festival_id, scanned_at DESC);

-- Add comments
COMMENT ON TABLE tickets IS 'Stores individual tickets purchased by users';
COMMENT ON COLUMN tickets.code IS 'Unique ticket code for QR scanning';
COMMENT ON COLUMN tickets.status IS 'Ticket status: VALID, USED, EXPIRED, CANCELLED, TRANSFERRED';
COMMENT ON COLUMN tickets.metadata IS 'JSON metadata: originalOwnerId, purchaseDate, paymentRef, notes';

COMMENT ON TABLE ticket_scans IS 'Stores ticket scan events for entry/exit tracking';
COMMENT ON COLUMN ticket_scans.scan_type IS 'Scan type: ENTRY, EXIT, CHECK';
COMMENT ON COLUMN ticket_scans.result IS 'Scan result: SUCCESS, FAILED, ALREADY_USED, EXPIRED, INVALID';
