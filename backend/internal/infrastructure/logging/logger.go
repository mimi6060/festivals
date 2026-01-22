package logging

import (
	"context"
	"io"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// ContextKey is a type for context keys
type ContextKey string

const (
	// RequestIDKey is the context key for request ID
	RequestIDKey ContextKey = "request_id"
	// LoggerKey is the context key for the logger
	LoggerKey ContextKey = "logger"
)

// Config holds logger configuration
type Config struct {
	// Level is the minimum log level (debug, info, warn, error)
	Level string
	// Environment is the environment (development, production)
	Environment string
	// ServiceName is the name of the service
	ServiceName string
	// Version is the application version
	Version string
	// Output is the writer for logs (defaults to os.Stdout)
	Output io.Writer
}

// Logger wraps zerolog.Logger with additional functionality
type Logger struct {
	zl      zerolog.Logger
	config  Config
}

// Init initializes the global logger with the given configuration
func Init(config Config) *Logger {
	// Set time format
	zerolog.TimeFieldFormat = time.RFC3339Nano

	// Parse log level
	level := parseLevel(config.Level)
	zerolog.SetGlobalLevel(level)

	// Set output
	var output io.Writer = os.Stdout
	if config.Output != nil {
		output = config.Output
	}

	// Configure output format based on environment
	if config.Environment != "production" {
		output = zerolog.ConsoleWriter{
			Out:        output,
			TimeFormat: time.RFC3339,
		}
	}

	// Create logger with base fields
	zl := zerolog.New(output).With().
		Timestamp().
		Str("service", config.ServiceName).
		Str("version", config.Version).
		Logger()

	// Set global logger
	log.Logger = zl

	return &Logger{
		zl:     zl,
		config: config,
	}
}

// parseLevel converts a string log level to zerolog.Level
func parseLevel(level string) zerolog.Level {
	switch level {
	case "debug":
		return zerolog.DebugLevel
	case "info":
		return zerolog.InfoLevel
	case "warn":
		return zerolog.WarnLevel
	case "error":
		return zerolog.ErrorLevel
	case "fatal":
		return zerolog.FatalLevel
	case "panic":
		return zerolog.PanicLevel
	default:
		return zerolog.InfoLevel
	}
}

// WithRequestID adds a request ID to the logger context
func (l *Logger) WithRequestID(requestID string) *Logger {
	return &Logger{
		zl:     l.zl.With().Str("request_id", requestID).Logger(),
		config: l.config,
	}
}

// WithField adds a field to the logger
func (l *Logger) WithField(key string, value interface{}) *Logger {
	return &Logger{
		zl:     l.zl.With().Interface(key, value).Logger(),
		config: l.config,
	}
}

// WithFields adds multiple fields to the logger
func (l *Logger) WithFields(fields map[string]interface{}) *Logger {
	ctx := l.zl.With()
	for k, v := range fields {
		ctx = ctx.Interface(k, v)
	}
	return &Logger{
		zl:     ctx.Logger(),
		config: l.config,
	}
}

// Debug logs a debug message
func (l *Logger) Debug(msg string) {
	l.zl.Debug().Msg(msg)
}

// Info logs an info message
func (l *Logger) Info(msg string) {
	l.zl.Info().Msg(msg)
}

// Warn logs a warning message
func (l *Logger) Warn(msg string) {
	l.zl.Warn().Msg(msg)
}

// Error logs an error message
func (l *Logger) Error(err error, msg string) {
	l.zl.Error().Err(err).Msg(msg)
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(err error, msg string) {
	l.zl.Fatal().Err(err).Msg(msg)
}

// Zerolog returns the underlying zerolog.Logger
func (l *Logger) Zerolog() zerolog.Logger {
	return l.zl
}

// FromContext extracts a logger from context
func FromContext(ctx context.Context) *Logger {
	if logger, ok := ctx.Value(LoggerKey).(*Logger); ok {
		return logger
	}
	// Return a default logger if none found
	return &Logger{zl: log.Logger}
}

// ToContext adds a logger to context
func ToContext(ctx context.Context, logger *Logger) context.Context {
	return context.WithValue(ctx, LoggerKey, logger)
}

// RequestIDFromContext extracts the request ID from context
func RequestIDFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(RequestIDKey).(string); ok {
		return id
	}
	return ""
}

// GinLogger returns a Gin middleware for structured logging
func GinLogger(logger *Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Get or generate request ID
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)

		// Create request-scoped logger
		reqLogger := logger.WithRequestID(requestID).WithFields(map[string]interface{}{
			"method": c.Request.Method,
			"path":   c.Request.URL.Path,
			"ip":     c.ClientIP(),
		})

		// Store logger in context
		ctx := ToContext(c.Request.Context(), reqLogger)
		ctx = context.WithValue(ctx, RequestIDKey, requestID)
		c.Request = c.Request.WithContext(ctx)

		// Process request
		c.Next()

		// Log request completion
		latency := time.Since(start)
		status := c.Writer.Status()

		event := reqLogger.zl.Info()
		if status >= 500 {
			event = reqLogger.zl.Error()
		} else if status >= 400 {
			event = reqLogger.zl.Warn()
		}

		event.
			Int("status", status).
			Dur("latency", latency).
			Int("size", c.Writer.Size()).
			Str("user_agent", c.Request.UserAgent()).
			Msg("Request completed")
	}
}

// GinRecovery returns a Gin recovery middleware with structured logging
func GinRecovery(logger *Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				requestID := c.GetString("request_id")

				logger.zl.Error().
					Str("request_id", requestID).
					Interface("error", err).
					Str("method", c.Request.Method).
					Str("path", c.Request.URL.Path).
					Msg("Panic recovered")

				c.AbortWithStatus(500)
			}
		}()
		c.Next()
	}
}

// LogError logs an error with context
func LogError(ctx context.Context, err error, msg string) {
	logger := FromContext(ctx)
	requestID := RequestIDFromContext(ctx)

	logger.zl.Error().
		Err(err).
		Str("request_id", requestID).
		Msg(msg)
}

// LogInfo logs an info message with context
func LogInfo(ctx context.Context, msg string, fields map[string]interface{}) {
	logger := FromContext(ctx)
	requestID := RequestIDFromContext(ctx)

	event := logger.zl.Info().Str("request_id", requestID)
	for k, v := range fields {
		event = event.Interface(k, v)
	}
	event.Msg(msg)
}

// LogDebug logs a debug message with context
func LogDebug(ctx context.Context, msg string, fields map[string]interface{}) {
	logger := FromContext(ctx)
	requestID := RequestIDFromContext(ctx)

	event := logger.zl.Debug().Str("request_id", requestID)
	for k, v := range fields {
		event = event.Interface(k, v)
	}
	event.Msg(msg)
}

// LogWarn logs a warning message with context
func LogWarn(ctx context.Context, msg string, fields map[string]interface{}) {
	logger := FromContext(ctx)
	requestID := RequestIDFromContext(ctx)

	event := logger.zl.Warn().Str("request_id", requestID)
	for k, v := range fields {
		event = event.Interface(k, v)
	}
	event.Msg(msg)
}
