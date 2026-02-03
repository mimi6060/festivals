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

	// QR Code
	QRCodeSecret string
	QRCodeSize   int

	// Stripe
	StripeSecretKey      string
	StripeWebhookSecret  string
	StripePlatformFee    int64 // Platform fee in basis points (100 = 1%)

	// Storage
	MinioEndpoint  string
	MinioAccessKey string
	MinioSecretKey string
	MinioBucket    string

	// Mail - Postal (Primary)
	PostalURL    string
	PostalAPIKey string

	// Mail - SendGrid (Fallback)
	SendGridAPIKey string

	// Mail - Common
	EmailFromAddress string
	EmailFromName    string

	// Twilio SMS
	TwilioAccountSID string
	TwilioAuthToken  string
	TwilioFromNumber string
	TwilioRateLimit  int // Messages per second, 0 for no limit

	// OpenAI
	OpenAIAPIKey     string
	OpenAIModel      string
	OpenAIEmbedModel string

	// Security Alert Integrations
	SlackWebhookURL     string
	SecurityAlertEmails []string
	AlertWebhookURLs    []string
	AlertWebhookSecret  string
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

		// QR Code
		QRCodeSecret: getEnv("QRCODE_SECRET", "your-qrcode-secret-key-change-in-production"),
		QRCodeSize:   getEnvInt("QRCODE_SIZE", 256),

		// Stripe
		StripeSecretKey:     getEnv("STRIPE_SECRET_KEY", ""),
		StripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", ""),
		StripePlatformFee:   int64(getEnvInt("STRIPE_PLATFORM_FEE", 100)), // Default 1%

		// Storage
		MinioEndpoint:  getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinioAccessKey: getEnv("MINIO_ACCESS_KEY", "minio"),
		MinioSecretKey: getEnv("MINIO_SECRET_KEY", "minio123"),
		MinioBucket:    getEnv("MINIO_BUCKET", "festivals"),

		// Mail - Postal (Primary)
		PostalURL:    getEnv("POSTAL_URL", "http://localhost:5000"),
		PostalAPIKey: getEnv("POSTAL_API_KEY", ""),

		// Mail - SendGrid (Fallback)
		SendGridAPIKey: getEnv("SENDGRID_API_KEY", ""),

		// Mail - Common
		EmailFromAddress: getEnv("EMAIL_FROM_ADDRESS", "noreply@festivals.app"),
		EmailFromName:    getEnv("EMAIL_FROM_NAME", "Festivals"),

		// Twilio SMS
		TwilioAccountSID: getEnv("TWILIO_ACCOUNT_SID", ""),
		TwilioAuthToken:  getEnv("TWILIO_AUTH_TOKEN", ""),
		TwilioFromNumber: getEnv("TWILIO_FROM_NUMBER", ""),
		TwilioRateLimit:  getEnvInt("TWILIO_RATE_LIMIT", 10),

		// OpenAI
		OpenAIAPIKey:     getEnv("OPENAI_API_KEY", ""),
		OpenAIModel:      getEnv("OPENAI_MODEL", "gpt-4o"),
		OpenAIEmbedModel: getEnv("OPENAI_EMBED_MODEL", "text-embedding-3-small"),

		// Security Alert Integrations
		SlackWebhookURL:     getEnv("SLACK_WEBHOOK_URL", ""),
		SecurityAlertEmails: getEnvStringSlice("SECURITY_ALERT_EMAILS", nil),
		AlertWebhookURLs:    getEnvStringSlice("ALERT_WEBHOOK_URLS", nil),
		AlertWebhookSecret:  getEnv("ALERT_WEBHOOK_SECRET", ""),
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

func getEnvStringSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		var result []string
		for _, item := range splitByComma(value) {
			trimmed := trimWhitespace(item)
			if trimmed != "" {
				result = append(result, trimmed)
			}
		}
		return result
	}
	return defaultValue
}

func splitByComma(s string) []string {
	var result []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			result = append(result, s[start:i])
			start = i + 1
		}
	}
	result = append(result, s[start:])
	return result
}

func trimWhitespace(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}
