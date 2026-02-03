package errors

import (
	"context"
	"net/http"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/gin-gonic/gin"
)

// SentryConfig holds configuration for Sentry integration
type SentryConfig struct {
	// DSN is the Sentry DSN
	DSN string
	// Environment (e.g., "production", "staging", "development")
	Environment string
	// Release version
	Release string
	// SampleRate for error sampling (0.0-1.0)
	SampleRate float64
	// EnableTracing enables performance tracing
	EnableTracing bool
	// TracesSampleRate for traces sampling (0.0-1.0)
	TracesSampleRate float64
	// Debug enables debug logging
	Debug bool
	// ServerName identifies this server
	ServerName string
	// BeforeSend allows modifying events before sending
	BeforeSend func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event
}

// SentryReporter handles Sentry error reporting
type SentryReporter struct {
	enabled bool
	config  SentryConfig
}

// NewSentryReporter creates a new Sentry reporter
func NewSentryReporter(cfg SentryConfig) (*SentryReporter, error) {
	if cfg.DSN == "" {
		return &SentryReporter{enabled: false}, nil
	}

	// Set default sample rate
	if cfg.SampleRate == 0 {
		cfg.SampleRate = 1.0
	}

	// Set default traces sample rate
	if cfg.TracesSampleRate == 0 {
		cfg.TracesSampleRate = 0.1
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:              cfg.DSN,
		Environment:      cfg.Environment,
		Release:          cfg.Release,
		SampleRate:       cfg.SampleRate,
		EnableTracing:    cfg.EnableTracing,
		TracesSampleRate: cfg.TracesSampleRate,
		Debug:            cfg.Debug,
		ServerName:       cfg.ServerName,
		BeforeSend:       cfg.BeforeSend,
		AttachStacktrace: true,
	})
	if err != nil {
		return nil, err
	}

	return &SentryReporter{
		enabled: true,
		config:  cfg,
	}, nil
}

// Close flushes and closes the Sentry client
func (s *SentryReporter) Close(timeout time.Duration) {
	if s.enabled {
		sentry.Flush(timeout)
	}
}

// CaptureError sends an error to Sentry
func (s *SentryReporter) CaptureError(err error) {
	if !s.enabled || err == nil {
		return
	}

	sentry.CaptureException(err)
}

// CaptureAppError sends an AppError to Sentry with additional context
func (s *SentryReporter) CaptureAppError(err *AppError) {
	if !s.enabled || err == nil {
		return
	}

	// Create a new scope for this error
	sentry.WithScope(func(scope *sentry.Scope) {
		// Set error level based on kind
		scope.SetLevel(getSentryLevel(err))

		// Set tags for grouping
		scope.SetTag("error_code", err.Code)
		scope.SetTag("error_kind", err.Kind.String())

		if err.Op != "" {
			scope.SetTag("operation", err.Op)
		}

		// Set request ID as a tag
		if err.RequestID != "" {
			scope.SetTag("request_id", err.RequestID)
		}

		// Set extra context
		if len(err.Details) > 0 {
			for k, v := range err.Details {
				scope.SetExtra(k, v)
			}
		}

		// Set fingerprint for error grouping
		fingerprint := []string{err.Code}
		if err.Op != "" {
			fingerprint = append(fingerprint, err.Op)
		}
		scope.SetFingerprint(fingerprint)

		// Capture the error
		if err.Err != nil {
			sentry.CaptureException(err.Err)
		} else {
			sentry.CaptureMessage(err.Message)
		}
	})
}

// CaptureAppErrorWithContext sends an AppError with request context
func (s *SentryReporter) CaptureAppErrorWithContext(ctx context.Context, err *AppError) {
	if !s.enabled || err == nil {
		return
	}

	hub := sentry.GetHubFromContext(ctx)
	if hub == nil {
		hub = sentry.CurrentHub().Clone()
	}

	hub.WithScope(func(scope *sentry.Scope) {
		// Set error level based on kind
		scope.SetLevel(getSentryLevel(err))

		// Set tags for grouping
		scope.SetTag("error_code", err.Code)
		scope.SetTag("error_kind", err.Kind.String())

		if err.Op != "" {
			scope.SetTag("operation", err.Op)
		}

		// Set request ID as a tag
		if err.RequestID != "" {
			scope.SetTag("request_id", err.RequestID)
		}

		// Set extra context
		if len(err.Details) > 0 {
			for k, v := range err.Details {
				scope.SetExtra(k, v)
			}
		}

		// Set fingerprint for error grouping
		fingerprint := []string{err.Code}
		if err.Op != "" {
			fingerprint = append(fingerprint, err.Op)
		}
		scope.SetFingerprint(fingerprint)

		// Capture the error
		if err.Err != nil {
			hub.CaptureException(err.Err)
		} else {
			hub.CaptureMessage(err.Message)
		}
	})
}

// CaptureGinError captures an error from a Gin context
func (s *SentryReporter) CaptureGinError(c *gin.Context, err *AppError) {
	if !s.enabled || err == nil {
		return
	}

	hub := sentry.GetHubFromContext(c.Request.Context())
	if hub == nil {
		hub = sentry.CurrentHub().Clone()
	}

	hub.WithScope(func(scope *sentry.Scope) {
		// Set error level
		scope.SetLevel(getSentryLevel(err))

		// Set request information
		scope.SetRequest(c.Request)

		// Set tags
		scope.SetTag("error_code", err.Code)
		scope.SetTag("error_kind", err.Kind.String())
		scope.SetTag("http_method", c.Request.Method)
		scope.SetTag("http_path", c.Request.URL.Path)

		if err.Op != "" {
			scope.SetTag("operation", err.Op)
		}

		// Set request ID
		requestID := c.GetString("request_id")
		if requestID != "" {
			scope.SetTag("request_id", requestID)
		}

		// Set user information if available
		if userID := c.GetString("user_id"); userID != "" {
			scope.SetUser(sentry.User{
				ID:        userID,
				IPAddress: c.ClientIP(),
			})
		}

		// Set festival context if available
		if festivalID := c.GetString("festival_id"); festivalID != "" {
			scope.SetTag("festival_id", festivalID)
		}

		// Set extra context
		if len(err.Details) > 0 {
			for k, v := range err.Details {
				scope.SetExtra(k, v)
			}
		}

		// Set fingerprint
		fingerprint := []string{err.Code, c.Request.Method, c.FullPath()}
		scope.SetFingerprint(fingerprint)

		// Capture the error
		if err.Err != nil {
			hub.CaptureException(err.Err)
		} else {
			hub.CaptureMessage(err.Message)
		}
	})
}

// CapturePanic captures a panic
func (s *SentryReporter) CapturePanic(recovered interface{}, stack string) {
	if !s.enabled {
		return
	}

	sentry.WithScope(func(scope *sentry.Scope) {
		scope.SetLevel(sentry.LevelFatal)
		scope.SetTag("error_code", ErrCodeInternal)
		scope.SetTag("panic", "true")
		scope.SetExtra("stack_trace", stack)
		scope.SetExtra("panic_value", recovered)

		if err, ok := recovered.(error); ok {
			sentry.CaptureException(err)
		} else {
			sentry.CaptureMessage("Panic recovered")
		}
	})
}

// getSentryLevel maps error kind to Sentry level
func getSentryLevel(err *AppError) sentry.Level {
	if err == nil {
		return sentry.LevelError
	}

	switch err.Kind {
	case KindValidation:
		return sentry.LevelWarning
	case KindNotFound:
		return sentry.LevelInfo
	case KindUnauthorized, KindForbidden:
		return sentry.LevelWarning
	case KindRateLimit:
		return sentry.LevelWarning
	case KindConflict, KindBusiness:
		return sentry.LevelWarning
	case KindExternal:
		return sentry.LevelError
	case KindInternal:
		return sentry.LevelError
	default:
		// Determine based on HTTP status
		status := err.HTTPStatus()
		if status >= 500 {
			return sentry.LevelError
		}
		return sentry.LevelWarning
	}
}

// ShouldReport determines if an error should be reported to Sentry
func ShouldReport(err *AppError) bool {
	if err == nil {
		return false
	}

	// Always report server errors
	if IsServerError(err.Code) {
		return true
	}

	// Don't report validation errors
	if err.Kind == KindValidation {
		return false
	}

	// Don't report not found errors (too noisy)
	if err.Kind == KindNotFound {
		return false
	}

	// Don't report rate limit errors
	if err.Kind == KindRateLimit {
		return false
	}

	// Don't report authentication errors (handled separately)
	if err.Kind == KindUnauthorized || err.Kind == KindForbidden {
		return false
	}

	// Report everything else
	return true
}

// GinSentryMiddleware creates a Gin middleware for Sentry integration
func GinSentryMiddleware(reporter *SentryReporter) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Create a hub for this request
		hub := sentry.CurrentHub().Clone()
		c.Request = c.Request.WithContext(sentry.SetHubOnContext(c.Request.Context(), hub))

		// Start a transaction for tracing
		options := []sentry.SpanOption{
			sentry.WithOpName("http.server"),
			sentry.ContinueFromRequest(c.Request),
			sentry.WithTransactionSource(sentry.SourceURL),
		}

		transaction := sentry.StartTransaction(
			c.Request.Context(),
			c.Request.Method+" "+c.FullPath(),
			options...,
		)
		defer transaction.Finish()

		// Store transaction in context
		c.Request = c.Request.WithContext(transaction.Context())

		// Set basic tags
		hub.Scope().SetTag("http_method", c.Request.Method)
		hub.Scope().SetTag("http_path", c.Request.URL.Path)

		c.Next()

		// Capture any errors
		if len(c.Errors) > 0 {
			err := c.Errors.Last().Err
			appErr := FromError(err)
			if appErr != nil && ShouldReport(appErr) {
				reporter.CaptureGinError(c, appErr)
			}
		}

		// Set final status
		transaction.Status = httpStatusToSentryStatus(c.Writer.Status())
	}
}

// httpStatusToSentryStatus converts HTTP status to Sentry status
func httpStatusToSentryStatus(status int) sentry.SpanStatus {
	switch {
	case status >= 200 && status < 300:
		return sentry.SpanStatusOK
	case status == 400:
		return sentry.SpanStatusInvalidArgument
	case status == 401:
		return sentry.SpanStatusUnauthenticated
	case status == 403:
		return sentry.SpanStatusPermissionDenied
	case status == 404:
		return sentry.SpanStatusNotFound
	case status == 409:
		return sentry.SpanStatusAborted
	case status == 429:
		return sentry.SpanStatusResourceExhausted
	case status >= 400 && status < 500:
		return sentry.SpanStatusInvalidArgument
	case status == 501:
		return sentry.SpanStatusUnimplemented
	case status == 503:
		return sentry.SpanStatusUnavailable
	case status == 504:
		return sentry.SpanStatusDeadlineExceeded
	case status >= 500:
		return sentry.SpanStatusInternalError
	default:
		return sentry.SpanStatusUnknown
	}
}

// SetSentryUser sets the Sentry user from request context
func SetSentryUser(c *gin.Context) {
	hub := sentry.GetHubFromContext(c.Request.Context())
	if hub == nil {
		return
	}

	userID := c.GetString("user_id")
	if userID == "" {
		return
	}

	hub.Scope().SetUser(sentry.User{
		ID:        userID,
		Email:     c.GetString("email"),
		IPAddress: c.ClientIP(),
	})
}

// AddSentryBreadcrumb adds a breadcrumb for debugging
func AddSentryBreadcrumb(c *gin.Context, category, message string, data map[string]interface{}) {
	hub := sentry.GetHubFromContext(c.Request.Context())
	if hub == nil {
		hub = sentry.CurrentHub()
	}

	hub.AddBreadcrumb(&sentry.Breadcrumb{
		Category:  category,
		Message:   message,
		Data:      data,
		Level:     sentry.LevelInfo,
		Timestamp: time.Now(),
	}, nil)
}

// WrapHTTPHandler wraps an http.Handler with Sentry error recovery
func WrapHTTPHandler(reporter *SentryReporter, handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				reporter.CapturePanic(recovered, CaptureStackString(2))
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()
		handler.ServeHTTP(w, r)
	})
}
