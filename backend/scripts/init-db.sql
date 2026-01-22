-- Initialize the database schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Public schema (shared across all tenants)

-- Platforms table (global config)
CREATE TABLE IF NOT EXISTS public.platforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Super admins table
CREATE TABLE IF NOT EXISTS public.superadmins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth0_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Festivals table (metadata, schema name reference)
CREATE TABLE IF NOT EXISTS public.festivals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    location VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'Europe/Brussels',
    currency_name VARCHAR(50) DEFAULT 'Jetons',
    exchange_rate DECIMAL(10,4) DEFAULT 0.10,
    stripe_account_id VARCHAR(255),
    settings JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'DRAFT',
    created_by UUID REFERENCES public.superadmins(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_festivals_slug ON public.festivals(slug);
CREATE INDEX IF NOT EXISTS idx_festivals_status ON public.festivals(status);
CREATE INDEX IF NOT EXISTS idx_festivals_dates ON public.festivals(start_date, end_date);

-- Insert default platform config
INSERT INTO public.platforms (name, settings)
VALUES ('Festivals Platform', '{"version": "1.0.0", "commission_rate": 0.01}')
ON CONFLICT DO NOTHING;

-- Function to create tenant schema
CREATE OR REPLACE FUNCTION create_tenant_schema(festival_uuid UUID)
RETURNS VOID AS $$
DECLARE
    schema_name TEXT;
BEGIN
    schema_name := 'festival_' || REPLACE(festival_uuid::TEXT, '-', '_');

    -- Create schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

    -- Create tenant tables
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            auth0_id VARCHAR(255) UNIQUE,
            email VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            phone VARCHAR(50),
            roles JSONB DEFAULT ''[]'',
            parent_id UUID REFERENCES %I.users(id),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name, schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.wallets (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES %I.users(id),
            balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(user_id)
        )', schema_name, schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.transactions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            wallet_id UUID NOT NULL REFERENCES %I.wallets(id),
            type VARCHAR(20) NOT NULL,
            amount BIGINT NOT NULL,
            balance_after BIGINT NOT NULL,
            reference VARCHAR(255),
            stand_id UUID,
            operator_id UUID,
            idempotency_key VARCHAR(255) UNIQUE NOT NULL,
            offline_created BOOLEAN DEFAULT FALSE,
            synced_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name, schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.tickets (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES %I.users(id),
            type VARCHAR(50) NOT NULL,
            qr_code TEXT UNIQUE NOT NULL,
            status VARCHAR(20) DEFAULT ''VALID'',
            options JSONB DEFAULT ''{}'',
            invited_by UUID REFERENCES %I.users(id),
            used_at TIMESTAMPTZ,
            used_by UUID REFERENCES %I.users(id),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name, schema_name, schema_name, schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.stands (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL,
            location JSONB,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.products (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            stand_id UUID REFERENCES %I.stands(id),
            name VARCHAR(255) NOT NULL,
            price BIGINT NOT NULL,
            vat_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
            category VARCHAR(50),
            stock INTEGER,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name, schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.stages (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            capacity INTEGER,
            location JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.artists (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES %I.users(id),
            name VARCHAR(255) NOT NULL,
            type VARCHAR(50),
            rider JSONB DEFAULT ''{}'',
            guest_quota INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name, schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.slots (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            stage_id UUID NOT NULL REFERENCES %I.stages(id),
            artist_id UUID NOT NULL REFERENCES %I.artists(id),
            start_time TIMESTAMPTZ NOT NULL,
            end_time TIMESTAMPTZ NOT NULL,
            status VARCHAR(20) DEFAULT ''PENDING'',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name, schema_name, schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.incidents (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            reporter_id UUID NOT NULL REFERENCES %I.users(id),
            reporter_type VARCHAR(20) NOT NULL,
            type VARCHAR(50) NOT NULL,
            location JSONB NOT NULL,
            description TEXT,
            status VARCHAR(20) DEFAULT ''OPEN'',
            assigned_to UUID REFERENCES %I.users(id),
            resolved_at TIMESTAMPTZ,
            resolution_notes TEXT,
            is_abuse BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name, schema_name, schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.audit_log (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES %I.users(id),
            action VARCHAR(100) NOT NULL,
            entity_type VARCHAR(50),
            entity_id UUID,
            old_values JSONB,
            new_values JSONB,
            ip_address INET,
            user_agent TEXT,
            impersonated_by UUID REFERENCES public.superadmins(id),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name, schema_name);

    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_users_email ON %I.users(email)', REPLACE(schema_name, 'festival_', ''), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_transactions_wallet ON %I.transactions(wallet_id)', REPLACE(schema_name, 'festival_', ''), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_transactions_created ON %I.transactions(created_at)', REPLACE(schema_name, 'festival_', ''), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tickets_qr ON %I.tickets(qr_code)', REPLACE(schema_name, 'festival_', ''), schema_name);

END;
$$ LANGUAGE plpgsql;
