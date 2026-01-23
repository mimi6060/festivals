package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hibiken/asynq"
	"github.com/mimi6060/festivals/backend/internal/config"
	"github.com/mimi6060/festivals/backend/internal/domain/reports"
	"github.com/mimi6060/festivals/backend/internal/domain/sync"
	"github.com/mimi6060/festivals/backend/internal/domain/wallet"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/cache"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/database"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/queue"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/sms"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/storage"
	"github.com/mimi6060/festivals/backend/internal/jobs"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Setup logger
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if os.Getenv("ENVIRONMENT") != "production" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}

	log.Info().Msg("Starting Festivals Worker...")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// Connect to database
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	log.Info().Msg("Connected to database")

	// Connect to Redis
	rdb, err := cache.Connect(cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to Redis")
	}
	log.Info().Msg("Connected to Redis")

	// Initialize storage service
	var storageService reports.StorageService
	if cfg.MinioEndpoint != "" {
		minioStorage, err := storage.NewMinioStorage(storage.MinioConfig{
			Endpoint:  cfg.MinioEndpoint,
			AccessKey: cfg.MinioAccessKey,
			SecretKey: cfg.MinioSecretKey,
			Bucket:    cfg.MinioBucket,
			UseSSL:    cfg.Environment == "production",
		})
		if err != nil {
			log.Warn().Err(err).Msg("Failed to initialize MinIO storage, falling back to local storage")
		} else {
			storageService = minioStorage
			log.Info().Msg("Connected to MinIO storage")
		}
	}

	// Initialize Twilio SMS client
	var twilioClient *sms.TwilioClient
	if cfg.TwilioAccountSID != "" && cfg.TwilioAuthToken != "" {
		twilioClient = sms.NewTwilioClient(sms.TwilioConfig{
			AccountSID: cfg.TwilioAccountSID,
			AuthToken:  cfg.TwilioAuthToken,
			FromNumber: cfg.TwilioFromNumber,
			RateLimit:  cfg.TwilioRateLimit,
			Timeout:    30 * time.Second,
		})
		log.Info().Msg("Initialized Twilio SMS client")
	} else {
		log.Warn().Msg("Twilio not configured, SMS sending will be disabled")
	}

	// Initialize asynq client for enqueuing tasks from workers
	asynqClient, err := queue.NewClient(cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create asynq client")
	}
	defer asynqClient.Close()

	// Initialize repositories
	walletRepo := wallet.NewRepository(db)
	reportsRepo := reports.NewRepository(db)
	syncRepo := sync.NewRepository(db)

	// Initialize services
	reportsService := reports.NewService(reportsRepo, storageService, asynqClient.Client, "/tmp/festivals/reports")
	syncService := sync.NewService(syncRepo, walletRepo, cfg.JWTSecret)

	// Create asynq server with configuration
	serverCfg := queue.ServerConfig{
		RedisURL:    cfg.RedisURL,
		Concurrency: getEnvInt("WORKER_CONCURRENCY", 10),
		LogLevel:    getLogLevel(cfg.Environment),
	}

	server, err := queue.NewServer(serverCfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create asynq server")
	}

	// Initialize workers
	emailWorker := jobs.NewEmailWorker(cfg)
	smsWorker := jobs.NewSMSWorker(twilioClient)
	reportWorker := jobs.NewReportWorker(reportsService)
	syncWorker := jobs.NewSyncWorker(syncService)
	cleanupWorker := jobs.NewCleanupWorker(db, rdb, storageService)
	analyticsWorker := jobs.NewAnalyticsWorker(db, rdb)

	// Register handlers
	log.Info().Msg("Registering job handlers...")

	emailWorker.RegisterHandlers(server)
	smsWorker.RegisterHandlers(server)
	reportWorker.RegisterHandlers(server)
	syncWorker.RegisterHandlers(server)
	cleanupWorker.RegisterHandlers(server)
	analyticsWorker.RegisterHandlers(server)

	log.Info().Msg("All job handlers registered")

	// Initialize scheduler for periodic tasks
	scheduler, err := queue.NewScheduler(cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create scheduler")
	}

	// Register periodic cleanup tasks
	registerPeriodicTasks(scheduler)

	// Start scheduler in goroutine
	go func() {
		log.Info().Msg("Starting scheduler...")
		if err := scheduler.Run(); err != nil {
			log.Error().Err(err).Msg("Scheduler error")
		}
	}()

	// Start server in goroutine
	serverDone := make(chan error, 1)
	go func() {
		log.Info().
			Int("concurrency", serverCfg.Concurrency).
			Msg("Starting worker server...")
		serverDone <- server.Run()
	}()

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-quit:
		log.Info().Str("signal", sig.String()).Msg("Received shutdown signal")
	case err := <-serverDone:
		if err != nil {
			log.Error().Err(err).Msg("Server stopped with error")
		}
	}

	// Graceful shutdown
	log.Info().Msg("Shutting down worker...")

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Shutdown scheduler
	scheduler.Shutdown()
	log.Info().Msg("Scheduler stopped")

	// Shutdown server (waits for active tasks to complete)
	server.Shutdown()
	log.Info().Msg("Server stopped")

	// Close database connection
	sqlDB, _ := db.DB()
	if err := sqlDB.Close(); err != nil {
		log.Error().Err(err).Msg("Error closing database connection")
	} else {
		log.Info().Msg("Database connection closed")
	}

	// Close Redis connection
	if err := rdb.Close(); err != nil {
		log.Error().Err(err).Msg("Error closing Redis connection")
	} else {
		log.Info().Msg("Redis connection closed")
	}

	// Wait for context or immediate completion
	select {
	case <-ctx.Done():
		log.Warn().Msg("Shutdown timed out")
	default:
	}

	log.Info().Msg("Worker shutdown complete")
}

// registerPeriodicTasks registers all periodic/scheduled tasks
func registerPeriodicTasks(scheduler *queue.Scheduler) {
	// Cleanup expired sessions every hour
	cleanupSessionsTask := asynq.NewTask(queue.TypeCleanupExpiredSessions, nil)
	if _, err := scheduler.RegisterPeriodicTask("0 * * * *", cleanupSessionsTask); err != nil {
		log.Error().Err(err).Msg("Failed to register cleanup sessions task")
	} else {
		log.Info().Msg("Registered periodic task: cleanup expired sessions (hourly)")
	}

	// Cleanup temporary files every 6 hours
	cleanupTempFilesTask := asynq.NewTask(queue.TypeCleanupTempFiles, nil)
	if _, err := scheduler.RegisterPeriodicTask("0 */6 * * *", cleanupTempFilesTask); err != nil {
		log.Error().Err(err).Msg("Failed to register cleanup temp files task")
	} else {
		log.Info().Msg("Registered periodic task: cleanup temp files (every 6 hours)")
	}

	// Cleanup expired QR codes daily at 3 AM
	cleanupQRCodesTask := asynq.NewTask(queue.TypeCleanupExpiredQRCodes, nil)
	if _, err := scheduler.RegisterPeriodicTask("0 3 * * *", cleanupQRCodesTask); err != nil {
		log.Error().Err(err).Msg("Failed to register cleanup QR codes task")
	} else {
		log.Info().Msg("Registered periodic task: cleanup expired QR codes (daily at 3 AM)")
	}

	// Archive old transactions weekly on Sunday at 4 AM
	archiveTransactionsTask := asynq.NewTask(queue.TypeArchiveOldTransactions, nil)
	if _, err := scheduler.RegisterPeriodicTask("0 4 * * 0", archiveTransactionsTask); err != nil {
		log.Error().Err(err).Msg("Failed to register archive transactions task")
	} else {
		log.Info().Msg("Registered periodic task: archive old transactions (weekly on Sunday at 4 AM)")
	}

	// Process analytics aggregation every 15 minutes
	analyticsTask := asynq.NewTask(queue.TypeProcessAnalytics, nil)
	if _, err := scheduler.RegisterPeriodicTask("*/15 * * * *", analyticsTask); err != nil {
		log.Error().Err(err).Msg("Failed to register analytics processing task")
	} else {
		log.Info().Msg("Registered periodic task: process analytics (every 15 minutes)")
	}
}

// getLogLevel returns the appropriate asynq log level based on environment
func getLogLevel(env string) asynq.LogLevel {
	switch env {
	case "production":
		return asynq.WarnLevel
	case "development":
		return asynq.DebugLevel
	default:
		return asynq.InfoLevel
	}
}

// getEnvInt gets an integer environment variable with a default value
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		var result int
		if _, err := parseEnvInt(value, &result); err == nil {
			return result
		}
	}
	return defaultValue
}

// parseEnvInt parses an integer from a string
func parseEnvInt(s string, result *int) (bool, error) {
	var n int
	for _, c := range s {
		if c < '0' || c > '9' {
			return false, nil
		}
		n = n*10 + int(c-'0')
	}
	*result = n
	return true, nil
}
