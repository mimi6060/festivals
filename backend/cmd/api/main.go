package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mimi6060/festivals/backend/internal/config"
	"github.com/mimi6060/festivals/backend/internal/domain/festival"
	"github.com/mimi6060/festivals/backend/internal/domain/product"
	"github.com/mimi6060/festivals/backend/internal/domain/stand"
	"github.com/mimi6060/festivals/backend/internal/domain/wallet"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/cache"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/database"
	"github.com/mimi6060/festivals/backend/internal/middleware"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Setup logger
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if os.Getenv("ENVIRONMENT") != "production" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}

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

	// Connect to Redis
	rdb, err := cache.Connect(cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to Redis")
	}

	// Setup Gin
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Middleware
	router.Use(gin.Recovery())
	router.Use(middleware.Logger())
	router.Use(middleware.CORS())
	router.Use(middleware.RequestID())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"version": "1.0.0",
		})
	})

	// Initialize repositories
	festivalRepo := festival.NewRepository(db)
	walletRepo := wallet.NewRepository(db)
	standRepo := stand.NewRepository(db)
	productRepo := product.NewRepository(db)

	// Initialize services
	festivalService := festival.NewService(festivalRepo, db)
	walletService := wallet.NewService(walletRepo, cfg.JWTSecret)
	standService := stand.NewService(standRepo)
	productService := product.NewService(productRepo)

	// Initialize handlers
	festivalHandler := festival.NewHandler(festivalService)
	walletHandler := wallet.NewHandler(walletService)
	standHandler := stand.NewHandler(standService)
	productHandler := product.NewHandler(productService)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Public routes
		v1.GET("/festivals/:id/public", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "Festival public info"})
		})

		// Protected routes
		protected := v1.Group("")
		protected.Use(middleware.Auth(cfg.Auth0Domain, cfg.Auth0Audience))
		{
			// User routes
			protected.GET("/me", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "User info"})
			})

			// Festival management routes (admin)
			festivalHandler.RegisterRoutes(protected)

			// Wallet routes (user)
			walletHandler.RegisterRoutes(protected)

			// Festival-scoped routes (requires tenant middleware)
			festivalScoped := protected.Group("/festivals/:festivalId")
			festivalScoped.Use(middleware.Tenant(db))
			{
				festivalScoped.GET("/dashboard", func(c *gin.Context) {
					c.JSON(http.StatusOK, gin.H{"message": "Festival dashboard"})
				})

				// Stand management
				standHandler.RegisterRoutes(festivalScoped)

				// Product management
				productHandler.RegisterRoutes(festivalScoped)
			}
		}
	}

	// Create server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Info().Str("port", cfg.Port).Msg("Starting server")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Failed to start server")
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info().Msg("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	// Close connections
	sqlDB, _ := db.DB()
	sqlDB.Close()
	rdb.Close()

	log.Info().Msg("Server exited properly")
}
