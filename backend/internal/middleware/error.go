package middleware

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/rs/zerolog/log"
)

// ErrorHandlerConfig configures the error handler middleware
type ErrorHandlerConfig struct {
	// Development enables detailed error responses
	Development bool
	// IncludeStack includes stack traces in development mode
	IncludeStack bool
	// LogErrors enables automatic error logging
	LogErrors bool
	// OnError is called for each error (useful for metrics/alerting)
	OnError func(c *gin.Context, err *errors.AppError)
	// SentryEnabled enables Sentry error reporting
	SentryEnabled bool
}

// DefaultErrorHandlerConfig returns the default configuration
func DefaultErrorHandlerConfig() ErrorHandlerConfig {
	return ErrorHandlerConfig{
		Development:   false,
		IncludeStack:  false,
		LogErrors:     true,
		SentryEnabled: false,
	}
}

// ErrorHandler creates the global error handler middleware
func ErrorHandler(cfg ErrorHandlerConfig) gin.HandlerFunc {
	var responder *errors.Responder
	if cfg.Development {
		responder = errors.NewResponder(errors.DevelopmentOptions())
	} else {
		responder = errors.NewResponder(errors.DefaultOptions())
	}

	return func(c *gin.Context) {
		// Process request
		c.Next()

		// Check for errors set during request handling
		if len(c.Errors) > 0 {
			// Get the last error
			err := c.Errors.Last().Err

			// Convert to AppError
			appErr := errors.FromError(err)
			if appErr == nil {
				appErr = &errors.AppError{
					Code:    errors.ErrCodeInternal,
					Message: "An unexpected error occurred",
				}
			}

			// Add request ID
			appErr.RequestID = c.GetString("request_id")

			// Log the error
			if cfg.LogErrors {
				logError(c, appErr)
			}

			// Call error callback
			if cfg.OnError != nil {
				cfg.OnError(c, appErr)
			}

			// Send response if not already sent
			if !c.Writer.Written() {
				responder.RespondError(c, appErr)
			}
		}
	}
}

// Recovery creates a panic recovery middleware with proper error handling
func Recovery(cfg ErrorHandlerConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recovered := recover(); recovered != nil {
				// Capture stack trace
				stack := string(debug.Stack())

				// Create error from panic
				recoveredErr := errors.NewRecoveredError(recovered)
				recoveredErr.Stack = stack
				recoveredErr.RequestID = c.GetString("request_id")

				// Log the panic
				logPanic(c, recovered, stack)

				// Check for broken pipe (client disconnected)
				if isBrokenPipeError(recovered) {
					c.Abort()
					return
				}

				// Send error response
				var responder *errors.Responder
				if cfg.Development {
					responder = errors.NewResponder(errors.DevelopmentOptions())
				} else {
					responder = errors.NewResponder(errors.DefaultOptions())
				}
				responder.RespondError(c, recoveredErr)

				// Call error callback
				if cfg.OnError != nil {
					cfg.OnError(c, recoveredErr.AppError)
				}
			}
		}()

		c.Next()
	}
}

// isBrokenPipeError checks if the error is a broken pipe error
func isBrokenPipeError(recovered interface{}) bool {
	if err, ok := recovered.(error); ok {
		errStr := err.Error()
		return strings.Contains(errStr, "broken pipe") ||
			strings.Contains(errStr, "connection reset by peer")
	}
	return false
}

// logError logs an error with context
func logError(c *gin.Context, err *errors.AppError) {
	requestID := c.GetString("request_id")

	// Build log event
	event := log.Error()

	// Add common fields
	event = event.
		Str("request_id", requestID).
		Str("error_code", err.Code).
		Str("error_message", err.Message).
		Str("method", c.Request.Method).
		Str("path", c.Request.URL.Path).
		Str("client_ip", c.ClientIP()).
		Int("status", err.HTTPStatus())

	// Add user ID if available
	if userID := c.GetString("user_id"); userID != "" {
		event = event.Str("user_id", userID)
	}

	// Add festival ID if available
	if festivalID := c.GetString("festival_id"); festivalID != "" {
		event = event.Str("festival_id", festivalID)
	}

	// Add operation if available
	if err.Op != "" {
		event = event.Str("operation", err.Op)
	}

	// Add details if available
	if len(err.Details) > 0 {
		event = event.Interface("details", err.Details)
	}

	// Add original error if available
	if err.Err != nil {
		event = event.Str("original_error", err.Err.Error())
	}

	// Add stack trace for server errors
	if errors.IsServerError(err.Code) && err.Stack != "" {
		event = event.Str("stack_trace", err.Stack)
	}

	event.Msg("Request error")
}

// logPanic logs a panic with full stack trace
func logPanic(c *gin.Context, recovered interface{}, stack string) {
	requestID := c.GetString("request_id")

	log.Error().
		Str("request_id", requestID).
		Str("method", c.Request.Method).
		Str("path", c.Request.URL.Path).
		Str("client_ip", c.ClientIP()).
		Str("user_agent", c.Request.UserAgent()).
		Interface("panic_value", recovered).
		Str("stack_trace", stack).
		Msg("Panic recovered")
}

// ErrorContextKey is the key for storing error context
const ErrorContextKey = "error_context"

// ErrorContext provides additional context for errors
type ErrorContext struct {
	Operation    string
	ResourceType string
	ResourceID   string
	UserID       string
	FestivalID   string
	Extra        map[string]interface{}
}

// SetErrorContext sets error context for the current request
func SetErrorContext(c *gin.Context, ctx ErrorContext) {
	c.Set(ErrorContextKey, ctx)
}

// GetErrorContext retrieves error context from the request
func GetErrorContext(c *gin.Context) (ErrorContext, bool) {
	val, exists := c.Get(ErrorContextKey)
	if !exists {
		return ErrorContext{}, false
	}
	ctx, ok := val.(ErrorContext)
	return ctx, ok
}

// EnrichError enriches an error with context from the request
func EnrichError(c *gin.Context, err *errors.AppError) *errors.AppError {
	if err == nil {
		return nil
	}

	// Add request ID
	err.RequestID = c.GetString("request_id")

	// Get error context if available
	if ctx, ok := GetErrorContext(c); ok {
		if ctx.Operation != "" {
			err.Op = ctx.Operation
		}
		if err.Details == nil {
			err.Details = make(map[string]interface{})
		}
		if ctx.ResourceType != "" {
			err.Details["resource_type"] = ctx.ResourceType
		}
		if ctx.ResourceID != "" {
			err.Details["resource_id"] = ctx.ResourceID
		}
		for k, v := range ctx.Extra {
			err.Details[k] = v
		}
	}

	return err
}

// RequestBodyLogger middleware that logs request body for debugging errors
// WARNING: Only use in development, can expose sensitive data
func RequestBodyLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Read the body
		bodyBytes, _ := io.ReadAll(c.Request.Body)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

		// Store for later logging
		c.Set("request_body", string(bodyBytes))

		c.Next()
	}
}

// ResponseCapture is a response writer that captures the response
type ResponseCapture struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

// Write captures the response body
func (r *ResponseCapture) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}

// ErrorMetrics middleware that tracks error metrics
func ErrorMetrics(metricsCallback func(code string, status int, duration time.Duration)) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		duration := time.Since(start)
		status := c.Writer.Status()

		// Extract error code if there was an error
		code := "success"
		if len(c.Errors) > 0 {
			if appErr := errors.FromError(c.Errors.Last().Err); appErr != nil {
				code = appErr.Code
			} else {
				code = errors.ErrCodeInternal
			}
		} else if status >= 400 {
			code = fmt.Sprintf("HTTP_%d", status)
		}

		if metricsCallback != nil {
			metricsCallback(code, status, duration)
		}
	}
}

// AbortWithError is a helper to abort with a typed error
func AbortWithError(c *gin.Context, err error) {
	appErr := errors.FromError(err)
	if appErr == nil {
		appErr = &errors.AppError{
			Code:       errors.ErrCodeInternal,
			Message:    "An unexpected error occurred",
			StatusCode: http.StatusInternalServerError,
		}
	}

	// Enrich error with context
	EnrichError(c, appErr)

	c.Error(appErr)
	c.Abort()
}

// AbortWithAppError is a helper to abort with an AppError
func AbortWithAppError(c *gin.Context, err *errors.AppError) {
	EnrichError(c, err)
	c.Error(err)
	c.Abort()
}

// MustBind binds the request body and aborts with a validation error if it fails
func MustBind(c *gin.Context, obj interface{}) bool {
	if err := c.ShouldBindJSON(obj); err != nil {
		validationErr := errors.NewValidationError("Invalid request body", nil)
		validationErr.Details = map[string]interface{}{
			"parse_error": err.Error(),
		}
		AbortWithAppError(c, validationErr.AppError)
		return false
	}
	return true
}

// MustBindQuery binds query parameters and aborts with a validation error if it fails
func MustBindQuery(c *gin.Context, obj interface{}) bool {
	if err := c.ShouldBindQuery(obj); err != nil {
		validationErr := errors.NewValidationError("Invalid query parameters", nil)
		validationErr.Details = map[string]interface{}{
			"parse_error": err.Error(),
		}
		AbortWithAppError(c, validationErr.AppError)
		return false
	}
	return true
}

// MustParseUUID parses a UUID from a path parameter and aborts with an error if invalid
func MustParseUUID(c *gin.Context, param string) (string, bool) {
	value := c.Param(param)
	if value == "" {
		err := errors.New(errors.ErrCodeInvalidID, fmt.Sprintf("Missing %s parameter", param))
		AbortWithAppError(c, err)
		return "", false
	}

	// Basic UUID validation (8-4-4-4-12 format)
	if len(value) != 36 {
		err := errors.New(errors.ErrCodeInvalidUUID, fmt.Sprintf("Invalid %s format", param))
		AbortWithAppError(c, err)
		return "", false
	}

	return value, true
}
