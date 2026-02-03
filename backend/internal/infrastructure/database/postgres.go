package database

import (
	"fmt"

	"github.com/rs/zerolog/log"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect(databaseURL string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database connection: %w", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	log.Info().Msg("Connected to PostgreSQL")

	return db, nil
}

// SetTenantSchema sets the PostgreSQL search_path to the tenant schema
func SetTenantSchema(db *gorm.DB, festivalID string) *gorm.DB {
	schemaName := fmt.Sprintf("festival_%s", festivalID)
	return db.Exec(fmt.Sprintf("SET search_path TO %s, public", schemaName))
}

// CreateTenantSchema creates a new schema for a festival
func CreateTenantSchema(db *gorm.DB, festivalID string) error {
	schemaName := fmt.Sprintf("festival_%s", festivalID)

	// Create schema
	if err := db.Exec(fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", schemaName)).Error; err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}

	// Set search path
	db = SetTenantSchema(db, festivalID)

	// Run tenant-specific migrations here
	// This will be expanded with actual models

	log.Info().Str("schema", schemaName).Msg("Created tenant schema")

	return nil
}

// DropTenantSchema drops a festival schema (use with caution)
func DropTenantSchema(db *gorm.DB, festivalID string) error {
	schemaName := fmt.Sprintf("festival_%s", festivalID)

	if err := db.Exec(fmt.Sprintf("DROP SCHEMA IF EXISTS %s CASCADE", schemaName)).Error; err != nil {
		return fmt.Errorf("failed to drop schema: %w", err)
	}

	log.Info().Str("schema", schemaName).Msg("Dropped tenant schema")

	return nil
}
