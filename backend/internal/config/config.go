package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	// Server
	Port        string
	Environment string

	// Database
	DatabaseURL string

	// Redis
	RedisURL string

	// Auth0
	Auth0Domain   string
	Auth0Audience string

	// JWT/Security
	JWTSecret string

	// Stripe
	StripeSecretKey string

	// Storage
	MinioEndpoint  string
	MinioAccessKey string
	MinioSecretKey string
	MinioBucket    string

	// Mail
	PostalURL    string
	PostalAPIKey string
}

func Load() (*Config, error) {
	// Load .env file if exists
	_ = godotenv.Load()

	return &Config{
		// Server
		Port:        getEnv("PORT", "8080"),
		Environment: getEnv("ENVIRONMENT", "development"),

		// Database
		DatabaseURL: getEnv("DATABASE_URL", "postgres://festivals:password@localhost:5432/festivals?sslmode=disable"),

		// Redis
		RedisURL: getEnv("REDIS_URL", "redis://localhost:6379"),

		// Auth0
		Auth0Domain:   getEnv("AUTH0_DOMAIN", ""),
		Auth0Audience: getEnv("AUTH0_AUDIENCE", ""),

		// JWT/Security
		JWTSecret: getEnv("JWT_SECRET", "your-super-secret-key-change-in-production"),

		// Stripe
		StripeSecretKey: getEnv("STRIPE_SECRET_KEY", ""),

		// Storage
		MinioEndpoint:  getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinioAccessKey: getEnv("MINIO_ACCESS_KEY", "minio"),
		MinioSecretKey: getEnv("MINIO_SECRET_KEY", "minio123"),
		MinioBucket:    getEnv("MINIO_BUCKET", "festivals"),

		// Mail
		PostalURL:    getEnv("POSTAL_URL", "http://localhost:5000"),
		PostalAPIKey: getEnv("POSTAL_API_KEY", ""),
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}
