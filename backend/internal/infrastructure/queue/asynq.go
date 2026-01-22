package queue

import (
	"context"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
	"github.com/rs/zerolog/log"
)

// Task type constants
const (
	// Email tasks
	TypeSendEmail              = "email:send"
	TypeSendWelcomeEmail       = "email:welcome"
	TypeSendTicketEmail        = "email:ticket"
	TypeSendRefundNotification = "email:refund_notification"

	// Report tasks
	TypeGenerateReport         = "report:generate"
	TypeGenerateSalesReport    = "report:sales"
	TypeGenerateAttendanceReport = "report:attendance"

	// Refund tasks
	TypeProcessRefund    = "refund:process"
	TypeProcessBulkRefund = "refund:bulk_process"

	// Cleanup tasks
	TypeCleanupExpiredQRCodes    = "cleanup:expired_qr"
	TypeArchiveOldTransactions   = "cleanup:archive_transactions"
	TypeCleanupTempFiles         = "cleanup:temp_files"
	TypeCleanupExpiredSessions   = "cleanup:expired_sessions"

	// Notification tasks
	TypeSendPushNotification = "notification:push"
	TypeSendSMSNotification  = "notification:sms"

	// Wallet tasks
	TypeProcessWalletTopUp = "wallet:topup"
	TypeReconcileWallets   = "wallet:reconcile"
)

// Queue priority constants
const (
	QueueCritical = "critical"
	QueueDefault  = "default"
	QueueLow      = "low"
)

// Queue configuration
var QueueConfig = map[string]int{
	QueueCritical: 6, // Processed 6 times as often as default
	QueueDefault:  3,
	QueueLow:      1,
}

// Client wraps asynq.Client with additional methods
type Client struct {
	*asynq.Client
}

// NewClient creates a new asynq client
func NewClient(redisURL string) (*Client, error) {
	opt, err := asynq.ParseRedisURI(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	client := asynq.NewClient(opt)
	log.Info().Msg("Asynq client connected")

	return &Client{Client: client}, nil
}

// EnqueueTask enqueues a task with default options
func (c *Client) EnqueueTask(ctx context.Context, task *asynq.Task, opts ...asynq.Option) (*asynq.TaskInfo, error) {
	info, err := c.Enqueue(task, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to enqueue task %s: %w", task.Type(), err)
	}

	log.Debug().
		Str("task_id", info.ID).
		Str("task_type", task.Type()).
		Str("queue", info.Queue).
		Msg("Task enqueued")

	return info, nil
}

// EnqueueCritical enqueues a task to the critical queue
func (c *Client) EnqueueCritical(ctx context.Context, task *asynq.Task, opts ...asynq.Option) (*asynq.TaskInfo, error) {
	opts = append([]asynq.Option{asynq.Queue(QueueCritical)}, opts...)
	return c.EnqueueTask(ctx, task, opts...)
}

// EnqueueLow enqueues a task to the low priority queue
func (c *Client) EnqueueLow(ctx context.Context, task *asynq.Task, opts ...asynq.Option) (*asynq.TaskInfo, error) {
	opts = append([]asynq.Option{asynq.Queue(QueueLow)}, opts...)
	return c.EnqueueTask(ctx, task, opts...)
}

// EnqueueScheduled enqueues a task to be processed at a specific time
func (c *Client) EnqueueScheduled(ctx context.Context, task *asynq.Task, processAt time.Time, opts ...asynq.Option) (*asynq.TaskInfo, error) {
	opts = append([]asynq.Option{asynq.ProcessAt(processAt)}, opts...)
	return c.EnqueueTask(ctx, task, opts...)
}

// EnqueueDelayed enqueues a task to be processed after a delay
func (c *Client) EnqueueDelayed(ctx context.Context, task *asynq.Task, delay time.Duration, opts ...asynq.Option) (*asynq.TaskInfo, error) {
	opts = append([]asynq.Option{asynq.ProcessIn(delay)}, opts...)
	return c.EnqueueTask(ctx, task, opts...)
}

// Server wraps asynq.Server with additional configuration
type Server struct {
	*asynq.Server
	mux *asynq.ServeMux
}

// ServerConfig holds configuration for the asynq server
type ServerConfig struct {
	RedisURL    string
	Concurrency int
	LogLevel    asynq.LogLevel
}

// NewServer creates a new asynq server
func NewServer(cfg ServerConfig) (*Server, error) {
	opt, err := asynq.ParseRedisURI(cfg.RedisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	if cfg.Concurrency == 0 {
		cfg.Concurrency = 10
	}

	server := asynq.NewServer(
		opt,
		asynq.Config{
			Concurrency: cfg.Concurrency,
			Queues:      QueueConfig,
			LogLevel:    cfg.LogLevel,
			ErrorHandler: asynq.ErrorHandlerFunc(func(ctx context.Context, task *asynq.Task, err error) {
				retried, _ := asynq.GetRetryCount(ctx)
				maxRetry, _ := asynq.GetMaxRetry(ctx)
				log.Error().
					Err(err).
					Str("task_type", task.Type()).
					Int("retried", retried).
					Int("max_retry", maxRetry).
					Msg("Task failed")
			}),
			RetryDelayFunc: func(n int, err error, task *asynq.Task) time.Duration {
				// Exponential backoff: 10s, 20s, 40s, 80s, ...
				return time.Duration(10*(1<<uint(n))) * time.Second
			},
		},
	)

	mux := asynq.NewServeMux()

	// Add middleware for logging
	mux.Use(loggingMiddleware)

	log.Info().Int("concurrency", cfg.Concurrency).Msg("Asynq server initialized")

	return &Server{
		Server: server,
		mux:    mux,
	}, nil
}

// Handle registers a handler for a task type
func (s *Server) Handle(taskType string, handler asynq.Handler) {
	s.mux.Handle(taskType, handler)
	log.Debug().Str("task_type", taskType).Msg("Handler registered")
}

// HandleFunc registers a handler function for a task type
func (s *Server) HandleFunc(taskType string, handler func(context.Context, *asynq.Task) error) {
	s.mux.HandleFunc(taskType, handler)
	log.Debug().Str("task_type", taskType).Msg("Handler function registered")
}

// Run starts the server and blocks until shutdown
func (s *Server) Run() error {
	log.Info().Msg("Starting asynq server")
	return s.Server.Run(s.mux)
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown() {
	log.Info().Msg("Shutting down asynq server")
	s.Server.Shutdown()
}

// loggingMiddleware logs task execution
func loggingMiddleware(h asynq.Handler) asynq.Handler {
	return asynq.HandlerFunc(func(ctx context.Context, t *asynq.Task) error {
		start := time.Now()
		taskID, _ := asynq.GetTaskID(ctx)

		log.Debug().
			Str("task_id", taskID).
			Str("task_type", t.Type()).
			Msg("Processing task")

		err := h.ProcessTask(ctx, t)

		duration := time.Since(start)
		if err != nil {
			log.Error().
				Err(err).
				Str("task_id", taskID).
				Str("task_type", t.Type()).
				Dur("duration", duration).
				Msg("Task failed")
		} else {
			log.Info().
				Str("task_id", taskID).
				Str("task_type", t.Type()).
				Dur("duration", duration).
				Msg("Task completed")
		}

		return err
	})
}

// Scheduler wraps asynq.Scheduler for periodic tasks
type Scheduler struct {
	*asynq.Scheduler
}

// NewScheduler creates a new asynq scheduler
func NewScheduler(redisURL string) (*Scheduler, error) {
	opt, err := asynq.ParseRedisURI(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	scheduler := asynq.NewScheduler(opt, nil)
	log.Info().Msg("Asynq scheduler initialized")

	return &Scheduler{Scheduler: scheduler}, nil
}

// RegisterPeriodicTask registers a task to run on a schedule
func (s *Scheduler) RegisterPeriodicTask(cronSpec string, task *asynq.Task, opts ...asynq.Option) (string, error) {
	entryID, err := s.Register(cronSpec, task, opts...)
	if err != nil {
		return "", fmt.Errorf("failed to register periodic task: %w", err)
	}

	log.Info().
		Str("entry_id", entryID).
		Str("task_type", task.Type()).
		Str("cron_spec", cronSpec).
		Msg("Periodic task registered")

	return entryID, nil
}

// Inspector provides methods to inspect the queue state
type Inspector struct {
	*asynq.Inspector
}

// NewInspector creates a new asynq inspector
func NewInspector(redisURL string) (*Inspector, error) {
	opt, err := asynq.ParseRedisURI(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	inspector := asynq.NewInspector(opt)
	log.Info().Msg("Asynq inspector initialized")

	return &Inspector{Inspector: inspector}, nil
}

// GetQueueStats returns statistics for all queues
func (i *Inspector) GetQueueStats() (map[string]*asynq.QueueInfo, error) {
	queues, err := i.Queues()
	if err != nil {
		return nil, err
	}

	stats := make(map[string]*asynq.QueueInfo)
	for _, q := range queues {
		info, err := i.GetQueueInfo(q)
		if err != nil {
			return nil, err
		}
		stats[q] = info
	}

	return stats, nil
}
