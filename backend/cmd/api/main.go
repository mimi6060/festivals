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
	"github.com/mimi6060/festivals/backend/internal/domain/payment"
	"github.com/mimi6060/festivals/backend/internal/domain/product"
	"github.com/mimi6060/festivals/backend/internal/domain/realtime"
	"github.com/mimi6060/festivals/backend/internal/domain/stand"
	"github.com/mimi6060/festivals/backend/internal/domain/wallet"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/cache"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/database"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/monitoring"
	stripepay "github.com/mimi6060/festivals/backend/internal/infrastructure/payment"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/websocket"
	"github.com/mimi6060/festivals/backend/internal/middleware"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/mimi6060/festivals/backend/docs"
)

const appVersion = "1.0.0"

// @title Festivals API
// @version 1.0.0
// @description API for managing festivals, cashless payments, tickets, and more.
// @termsOfService https://festivals.io/terms

// @contact.name API Support
// @contact.url https://festivals.io/support
// @contact.email support@festivals.io

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:8080
// @BasePath /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

// @securityDefinitions.apikey ApiKeyAuth
// @in header
// @name X-API-Key
// @description API Key for external integrations

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

	// Initialize Prometheus metrics
	metrics := monitoring.Init("festivals")
	log.Info().Msg("Prometheus metrics initialized")

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

	// Initialize health checker with all components
	healthChecker := monitoring.NewHealthChecker(appVersion)
	healthChecker.Register(monitoring.NewDatabaseChecker(db))
	healthChecker.Register(monitoring.NewRedisChecker(rdb))
	healthHandler := monitoring.NewHealthHandler(healthChecker)

	// Initialize WebSocket hub and realtime service
	wsHub := websocket.NewHub()
	go wsHub.Run()
	realtimeService := realtime.NewService(wsHub, rdb)

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
	router.Use(middleware.MetricsWithConfig(middleware.DefaultMetricsConfig()))

	// Health check endpoints
	healthHandler.RegisterRoutes(router)

	// Prometheus metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.HandlerFor(
		metrics.Registry,
		promhttp.HandlerOpts{
			EnableOpenMetrics: true,
		},
	)))

	// Swagger documentation endpoint
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler,
		ginSwagger.URL("/swagger/doc.json"),
		ginSwagger.DefaultModelsExpandDepth(-1),
		ginSwagger.DocExpansion("list"),
		ginSwagger.PersistAuthorization(true),
	))

	// Redirect root to Swagger UI
	router.GET("/", func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/swagger/index.html")
	})

	// WebSocket endpoints for real-time dashboard
	wsGroup := router.Group("/ws")
	{
		// Dashboard WebSocket - real-time stats, transactions, revenue
		wsGroup.GET("/dashboard/:festivalId", websocket.DashboardHandler(wsHub))

		// Alerts WebSocket - real-time alerts only
		wsGroup.GET("/alerts/:festivalId", websocket.AlertsHandler(wsHub))
	}

	// WebSocket stats endpoint (for monitoring)
	router.GET("/ws/stats", func(c *gin.Context) {
		c.JSON(http.StatusOK, realtimeService.GetHubStats())
	})

	// Initialize repositories
	festivalRepo := festival.NewRepository(db)
	walletRepo := wallet.NewRepository(db)
	standRepo := stand.NewRepository(db)
	productRepo := product.NewRepository(db)

	// Initialize Stripe client
	var stripeClient *stripepay.StripeClient
	if cfg.StripeSecretKey != "" {
		stripeClient = stripepay.NewStripeClient(cfg.StripeSecretKey, cfg.StripeWebhookSecret)
		if cfg.StripePlatformFee > 0 {
			stripeClient.SetPlatformFeePercent(cfg.StripePlatformFee)
		}
		log.Info().Msg("Stripe client initialized")
	} else {
		log.Warn().Msg("Stripe not configured - payment features disabled")
	}

	// Initialize services
	festivalService := festival.NewService(festivalRepo, db)
	walletService := wallet.NewService(walletRepo, cfg.JWTSecret)
	standService := stand.NewService(standRepo)
	productService := product.NewService(productRepo)

	// Initialize payment service (if Stripe is configured)
	var paymentHandler *payment.Handler
	if stripeClient != nil {
		baseURL := "http://localhost:" + cfg.Port
		if cfg.Environment == "production" {
			baseURL = "https://api.festivals.io" // Update with actual production URL
		}
		paymentService := payment.NewService(db, stripeClient, baseURL)
		paymentService.SetWalletService(walletService)
		paymentHandler = payment.NewHandler(paymentService, stripeClient)
		log.Info().Msg("Payment service initialized")
	}

	// Initialize handlers
	festivalHandler := festival.NewHandler(festivalService)
	walletHandler := wallet.NewHandler(walletService)
	standHandler := stand.NewHandler(standService)
	productHandler := product.NewHandler(productService)

	// Webhook routes (no auth required, signature verification done in handler)
	webhooks := router.Group("/webhooks")
	{
		if paymentHandler != nil {
			paymentHandler.RegisterWebhookRoutes(webhooks)
		}
	}

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Public routes
		v1.GET("/festivals/:id/public", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "Festival public info"})
		})

		// Protected routes
		protected := v1.Group("")
		protected.Use(middleware.AuthWithSimpleConfig(cfg.Auth0Domain, cfg.Auth0Audience))
		{
			// User routes
			protected.GET("/me", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "User info"})
			})

			// Festival management routes (admin)
			festivalHandler.RegisterRoutes(protected)

			// Wallet routes (user)
			walletHandler.RegisterRoutes(protected)

			// Payment routes (Stripe)
			if paymentHandler != nil {
				paymentHandler.RegisterRoutes(protected)
			}

			// Festival-scoped routes (requires tenant middleware)
			festivalScoped := protected.Group("/festivals/:id")
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
