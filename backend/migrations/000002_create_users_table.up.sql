-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(50),
    avatar VARCHAR(500),
    role VARCHAR(20) DEFAULT 'USER',
    auth0_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraints
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
ALTER TABLE users ADD CONSTRAINT users_auth0_id_unique UNIQUE (auth0_id);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth0_id ON users(auth0_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- Add comment
COMMENT ON TABLE users IS 'Stores user account information';
COMMENT ON COLUMN users.role IS 'User role: USER, STAFF, ADMIN, SUPER_ADMIN';
COMMENT ON COLUMN users.status IS 'Account status: ACTIVE, INACTIVE, SUSPENDED';
