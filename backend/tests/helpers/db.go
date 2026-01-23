package helpers

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	tcredis "github.com/testcontainers/testcontainers-go/modules/redis"
	"github.com/testcontainers/testcontainers-go/wait"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// TestDB holds the test database connection and containers
type TestDB struct {
	DB          *gorm.DB
	Redis       *redis.Client
	PostgresC   testcontainers.Container
	RedisC      testcontainers.Container
	DSN         string
	RedisAddr   string
}

// SetupTestDB creates a new test database using testcontainers
func SetupTestDB(t *testing.T) *TestDB {
	t.Helper()
	ctx := context.Background()

	// Start PostgreSQL container
	postgresC, err := tcpostgres.Run(ctx,
		"postgres:15-alpine",
		tcpostgres.WithDatabase("festivals_test"),
		tcpostgres.WithUsername("test"),
		tcpostgres.WithPassword("test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("Failed to start PostgreSQL container: %v", err)
	}

	// Get PostgreSQL connection string
	pgHost, err := postgresC.Host(ctx)
	if err != nil {
		t.Fatalf("Failed to get PostgreSQL host: %v", err)
	}
	pgPort, err := postgresC.MappedPort(ctx, "5432")
	if err != nil {
		t.Fatalf("Failed to get PostgreSQL port: %v", err)
	}

	pgDSN := fmt.Sprintf("host=%s port=%s user=test password=test dbname=festivals_test sslmode=disable",
		pgHost, pgPort.Port())

	// Connect to PostgreSQL
	db, err := gorm.Open(postgres.Open(pgDSN), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}

	// Start Redis container
	redisC, err := tcredis.Run(ctx,
		"redis:7-alpine",
		testcontainers.WithWaitStrategy(
			wait.ForLog("Ready to accept connections").
				WithStartupTimeout(30*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("Failed to start Redis container: %v", err)
	}

	// Get Redis connection string
	redisHost, err := redisC.Host(ctx)
	if err != nil {
		t.Fatalf("Failed to get Redis host: %v", err)
	}
	redisPort, err := redisC.MappedPort(ctx, "6379")
	if err != nil {
		t.Fatalf("Failed to get Redis port: %v", err)
	}

	redisAddr := fmt.Sprintf("%s:%s", redisHost, redisPort.Port())

	// Connect to Redis
	rdb := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Fatalf("Failed to connect to Redis: %v", err)
	}

	// Run migrations
	if err := RunMigrations(db); err != nil {
		t.Fatalf("Failed to run migrations: %v", err)
	}

	return &TestDB{
		DB:          db,
		Redis:       rdb,
		PostgresC:   postgresC,
		RedisC:      redisC,
		DSN:         pgDSN,
		RedisAddr:   redisAddr,
	}
}

// TeardownTestDB cleans up the test database
func (tdb *TestDB) TeardownTestDB(t *testing.T) {
	t.Helper()
	ctx := context.Background()

	// Close Redis connection
	if tdb.Redis != nil {
		tdb.Redis.Close()
	}

	// Close database connection
	if tdb.DB != nil {
		sqlDB, _ := tdb.DB.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
	}

	// Stop containers
	if tdb.PostgresC != nil {
		if err := tdb.PostgresC.Terminate(ctx); err != nil {
			t.Logf("Failed to terminate PostgreSQL container: %v", err)
		}
	}

	if tdb.RedisC != nil {
		if err := tdb.RedisC.Terminate(ctx); err != nil {
			t.Logf("Failed to terminate Redis container: %v", err)
		}
	}
}

// CleanupTables truncates all test tables
func (tdb *TestDB) CleanupTables(t *testing.T) {
	t.Helper()
	tables := []string{
		"orders",
		"ticket_scans",
		"tickets",
		"ticket_types",
		"transactions",
		"wallets",
		"products",
		"stands",
		"role_assignments",
		"role_permissions",
		"roles",
		"permissions",
		"public.festivals",
		"public.users",
	}

	for _, table := range tables {
		if err := tdb.DB.Exec(fmt.Sprintf("TRUNCATE TABLE %s CASCADE", table)).Error; err != nil {
			// Table might not exist yet, which is fine
			t.Logf("Warning: Could not truncate %s: %v", table, err)
		}
	}
}

// RunMigrations creates the database schema for testing
func RunMigrations(db *gorm.DB) error {
	// Enable uuid-ossp extension
	if err := db.Exec("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"").Error; err != nil {
		return fmt.Errorf("failed to create uuid extension: %w", err)
	}

	// Create users table
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS public.users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email VARCHAR(255) UNIQUE NOT NULL,
			name VARCHAR(255) NOT NULL,
			phone VARCHAR(50),
			avatar VARCHAR(500),
			role VARCHAR(50) DEFAULT 'USER',
			auth0_id VARCHAR(255) UNIQUE NOT NULL,
			status VARCHAR(50) DEFAULT 'ACTIVE',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create users table: %w", err)
	}

	// Create festivals table
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS public.festivals (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(255) NOT NULL,
			slug VARCHAR(255) UNIQUE NOT NULL,
			description TEXT,
			start_date DATE NOT NULL,
			end_date DATE NOT NULL,
			location VARCHAR(500),
			timezone VARCHAR(100) DEFAULT 'Europe/Brussels',
			currency_name VARCHAR(50) DEFAULT 'Jetons',
			exchange_rate DECIMAL(10,4) DEFAULT 0.10,
			stripe_account_id VARCHAR(255),
			settings JSONB DEFAULT '{}',
			status VARCHAR(50) DEFAULT 'DRAFT',
			created_by UUID REFERENCES public.users(id),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create festivals table: %w", err)
	}

	// Create permissions table
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS public.permissions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			resource VARCHAR(50) NOT NULL,
			action VARCHAR(50) NOT NULL,
			scope VARCHAR(50) DEFAULT 'festival',
			description TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(resource, action)
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create permissions table: %w", err)
	}

	// Create roles table
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS public.roles (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(100) NOT NULL,
			display_name VARCHAR(100) NOT NULL,
			description TEXT,
			type VARCHAR(20) DEFAULT 'custom',
			festival_id UUID REFERENCES public.festivals(id),
			is_active BOOLEAN DEFAULT true,
			priority INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(name, festival_id)
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create roles table: %w", err)
	}

	// Create role_permissions table
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS public.role_permissions (
			role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
			permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY(role_id, permission_id)
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create role_permissions table: %w", err)
	}

	// Create role_assignments table
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS public.role_assignments (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES public.users(id),
			role_id UUID NOT NULL REFERENCES public.roles(id),
			festival_id UUID REFERENCES public.festivals(id),
			stand_id UUID,
			assigned_by UUID NOT NULL,
			assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			expires_at TIMESTAMP,
			is_active BOOLEAN DEFAULT true,
			notes TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(user_id, role_id, festival_id)
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create role_assignments table: %w", err)
	}

	// Create stands table
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS stands (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			festival_id UUID NOT NULL REFERENCES public.festivals(id),
			name VARCHAR(255) NOT NULL,
			description TEXT,
			category VARCHAR(100),
			location VARCHAR(255),
			status VARCHAR(50) DEFAULT 'ACTIVE',
			settings JSONB DEFAULT '{}',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create stands table: %w", err)
	}

	// Create products table
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS products (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			stand_id UUID NOT NULL REFERENCES stands(id),
			name VARCHAR(255) NOT NULL,
			description TEXT,
			price BIGINT NOT NULL,
			category VARCHAR(100),
			image_url VARCHAR(500),
			stock INTEGER,
			status VARCHAR(50) DEFAULT 'ACTIVE',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create products table: %w", err)
	}

	// Create wallets table
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS wallets (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL,
			festival_id UUID NOT NULL REFERENCES public.festivals(id),
			balance BIGINT DEFAULT 0,
			status VARCHAR(50) DEFAULT 'ACTIVE',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(user_id, festival_id)
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create wallets table: %w", err)
	}

	// Create transactions table
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS transactions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			wallet_id UUID NOT NULL REFERENCES wallets(id),
			type VARCHAR(50) NOT NULL,
			amount BIGINT NOT NULL,
			balance_before BIGINT NOT NULL,
			balance_after BIGINT NOT NULL,
			reference VARCHAR(255),
			stand_id UUID,
			staff_id UUID,
			metadata JSONB DEFAULT '{}',
			status VARCHAR(50) DEFAULT 'COMPLETED',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create transactions table: %w", err)
	}

	// Create orders table
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS orders (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			festival_id UUID NOT NULL REFERENCES public.festivals(id),
			user_id UUID NOT NULL,
			wallet_id UUID NOT NULL REFERENCES wallets(id),
			stand_id UUID NOT NULL REFERENCES stands(id),
			items JSONB NOT NULL,
			total_amount BIGINT NOT NULL,
			status VARCHAR(50) DEFAULT 'PENDING',
			payment_method VARCHAR(50) NOT NULL,
			transaction_id UUID REFERENCES transactions(id),
			staff_id UUID,
			notes TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create orders table: %w", err)
	}

	// Create ticket_types table
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS ticket_types (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			festival_id UUID NOT NULL REFERENCES public.festivals(id),
			name VARCHAR(255) NOT NULL,
			description TEXT,
			price BIGINT NOT NULL,
			quantity INTEGER,
			quantity_sold INTEGER DEFAULT 0,
			valid_from TIMESTAMP NOT NULL,
			valid_until TIMESTAMP NOT NULL,
			benefits TEXT[],
			settings JSONB DEFAULT '{}',
			status VARCHAR(50) DEFAULT 'ACTIVE',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create ticket_types table: %w", err)
	}

	// Create tickets table
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS tickets (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
			festival_id UUID NOT NULL REFERENCES public.festivals(id),
			user_id UUID,
			order_id UUID,
			code VARCHAR(255) UNIQUE NOT NULL,
			holder_name VARCHAR(255),
			holder_email VARCHAR(255),
			status VARCHAR(50) DEFAULT 'VALID',
			checked_in_at TIMESTAMP,
			checked_in_by UUID,
			transfer_count INTEGER DEFAULT 0,
			metadata JSONB DEFAULT '{}',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create tickets table: %w", err)
	}

	// Create ticket_scans table
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS ticket_scans (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			ticket_id UUID NOT NULL REFERENCES tickets(id),
			festival_id UUID NOT NULL REFERENCES public.festivals(id),
			scan_type VARCHAR(50) NOT NULL,
			scanned_by UUID NOT NULL,
			location VARCHAR(255),
			device_id VARCHAR(255),
			result VARCHAR(50) NOT NULL,
			message TEXT,
			scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create ticket_scans table: %w", err)
	}

	// Create indexes
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_wallets_festival_id ON wallets(festival_id)",
		"CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id)",
		"CREATE INDEX IF NOT EXISTS idx_ticket_types_festival_id ON ticket_types(festival_id)",
		"CREATE INDEX IF NOT EXISTS idx_tickets_festival_id ON tickets(festival_id)",
		"CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_tickets_code ON tickets(code)",
		"CREATE INDEX IF NOT EXISTS idx_ticket_scans_ticket_id ON ticket_scans(ticket_id)",
		"CREATE INDEX IF NOT EXISTS idx_orders_festival_id ON orders(festival_id)",
		"CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_orders_stand_id ON orders(stand_id)",
		"CREATE INDEX IF NOT EXISTS idx_orders_wallet_id ON orders(wallet_id)",
		"CREATE INDEX IF NOT EXISTS idx_products_stand_id ON products(stand_id)",
		"CREATE INDEX IF NOT EXISTS idx_stands_festival_id ON stands(festival_id)",
		"CREATE INDEX IF NOT EXISTS idx_role_assignments_user_id ON public.role_assignments(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_role_assignments_role_id ON public.role_assignments(role_id)",
	}

	for _, idx := range indexes {
		if err := db.Exec(idx).Error; err != nil {
			return fmt.Errorf("failed to create index: %w", err)
		}
	}

	return nil
}

// WithTx runs a function within a transaction and rolls back after
func (tdb *TestDB) WithTx(t *testing.T, fn func(tx *gorm.DB)) {
	t.Helper()
	tx := tdb.DB.Begin()
	defer tx.Rollback()
	fn(tx)
}
