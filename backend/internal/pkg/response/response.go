package response

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

type Response struct {
	Data interface{} `json:"data,omitempty"`
	Meta *Meta       `json:"meta,omitempty"`
}

type Meta struct {
	Total   int `json:"total,omitempty"`
	Page    int `json:"page,omitempty"`
	PerPage int `json:"per_page,omitempty"`
}

type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Data: data})
}

func OKWithMeta(c *gin.Context, data interface{}, meta *Meta) {
	c.JSON(http.StatusOK, Response{Data: data, Meta: meta})
}

func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, Response{Data: data})
}

func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

func BadRequest(c *gin.Context, code, message string, details interface{}) {
	c.JSON(http.StatusBadRequest, ErrorResponse{
		Error: ErrorDetail{Code: code, Message: message, Details: details},
	})
}

func Unauthorized(c *gin.Context, message string) {
	c.JSON(http.StatusUnauthorized, ErrorResponse{
		Error: ErrorDetail{Code: "UNAUTHORIZED", Message: message},
	})
}

func Forbidden(c *gin.Context, message string) {
	c.JSON(http.StatusForbidden, ErrorResponse{
		Error: ErrorDetail{Code: "FORBIDDEN", Message: message},
	})
}

func NotFound(c *gin.Context, message string) {
	c.JSON(http.StatusNotFound, ErrorResponse{
		Error: ErrorDetail{Code: "NOT_FOUND", Message: message},
	})
}

func Conflict(c *gin.Context, code, message string) {
	c.JSON(http.StatusConflict, ErrorResponse{
		Error: ErrorDetail{Code: code, Message: message},
	})
}

// InternalError logs the actual error server-side and returns a generic message to the client
// SECURITY: Never expose internal error details to clients - they may contain sensitive information
// such as database schemas, file paths, or internal service names.
func InternalError(c *gin.Context, internalMessage string) {
	// Get request ID for correlation
	requestID := c.GetString("request_id")
	if requestID == "" {
		requestID = c.GetHeader("X-Request-ID")
	}

	// Log the actual error server-side with context for debugging
	log.Error().
		Str("request_id", requestID).
		Str("path", c.Request.URL.Path).
		Str("method", c.Request.Method).
		Str("client_ip", c.ClientIP()).
		Str("error", internalMessage).
		Msg("Internal server error")

	// Return generic error message to client
	c.JSON(http.StatusInternalServerError, ErrorResponse{
		Error: ErrorDetail{
			Code:    "INTERNAL_ERROR",
			Message: "An unexpected error occurred. Please try again later.",
		},
	})
}

// InternalErrorWithCode is like InternalError but allows specifying a custom error code
// for monitoring/metrics purposes while still hiding the actual error from clients
func InternalErrorWithCode(c *gin.Context, code, internalMessage string) {
	requestID := c.GetString("request_id")
	if requestID == "" {
		requestID = c.GetHeader("X-Request-ID")
	}

	log.Error().
		Str("request_id", requestID).
		Str("path", c.Request.URL.Path).
		Str("method", c.Request.Method).
		Str("client_ip", c.ClientIP()).
		Str("error_code", code).
		Str("error", internalMessage).
		Msg("Internal server error")

	c.JSON(http.StatusInternalServerError, ErrorResponse{
		Error: ErrorDetail{
			Code:    code,
			Message: "An unexpected error occurred. Please try again later.",
		},
	})
}

// ServiceUnavailable indicates a temporary service issue
func ServiceUnavailable(c *gin.Context, internalMessage string) {
	requestID := c.GetString("request_id")
	if requestID == "" {
		requestID = c.GetHeader("X-Request-ID")
	}

	log.Warn().
		Str("request_id", requestID).
		Str("path", c.Request.URL.Path).
		Str("error", internalMessage).
		Msg("Service unavailable")

	c.JSON(http.StatusServiceUnavailable, ErrorResponse{
		Error: ErrorDetail{
			Code:    "SERVICE_UNAVAILABLE",
			Message: "The service is temporarily unavailable. Please try again later.",
		},
	})
}

// TooManyRequests sends a 429 Too Many Requests response with Retry-After header
func TooManyRequests(c *gin.Context, retryAfterSeconds int) {
	c.Header("Retry-After", strconv.Itoa(retryAfterSeconds))
	c.JSON(http.StatusTooManyRequests, ErrorResponse{
		Error: ErrorDetail{
			Code:    "RATE_LIMITED",
			Message: "Too many requests. Please try again later.",
			Details: map[string]interface{}{"retry_after_seconds": retryAfterSeconds},
		},
	})
}

// UnprocessableEntity sends a 422 Unprocessable Entity response for validation errors
func UnprocessableEntity(c *gin.Context, message string, fields map[string]string) {
	details := map[string]interface{}{}
	if fields != nil {
		details["validation_errors"] = fields
	}
	c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
		Error: ErrorDetail{Code: "VALIDATION_ERROR", Message: message, Details: details},
	})
}

// Gone sends a 410 Gone response for deleted or expired resources
func Gone(c *gin.Context, message string) {
	c.JSON(http.StatusGone, ErrorResponse{
		Error: ErrorDetail{Code: "RESOURCE_GONE", Message: message},
	})
}

// PaymentRequired sends a 402 Payment Required response
func PaymentRequired(c *gin.Context, message string) {
	c.JSON(http.StatusPaymentRequired, ErrorResponse{
		Error: ErrorDetail{Code: "PAYMENT_REQUIRED", Message: message},
	})
}

// Accepted sends a 202 Accepted response for async operations
func Accepted(c *gin.Context, data interface{}) {
	c.JSON(http.StatusAccepted, Response{Data: data})
}

// ============================================================================
// Standardized Error Handling Helpers
// ============================================================================

// ErrorCode represents a standardized error code
type ErrorCode string

const (
	ErrCodeValidation       ErrorCode = "VALIDATION_ERROR"
	ErrCodeNotFound         ErrorCode = "NOT_FOUND"
	ErrCodeUnauthorized     ErrorCode = "UNAUTHORIZED"
	ErrCodeForbidden        ErrorCode = "FORBIDDEN"
	ErrCodeConflict         ErrorCode = "CONFLICT"
	ErrCodeBadRequest       ErrorCode = "BAD_REQUEST"
	ErrCodeInternalError    ErrorCode = "INTERNAL_ERROR"
	ErrCodeServiceUnavail   ErrorCode = "SERVICE_UNAVAILABLE"
	ErrCodeRateLimited      ErrorCode = "RATE_LIMITED"
	ErrCodePaymentRequired  ErrorCode = "PAYMENT_REQUIRED"
	ErrCodeResourceGone     ErrorCode = "RESOURCE_GONE"
	ErrCodeInvalidID        ErrorCode = "INVALID_ID"
	ErrCodeInsufficientBal  ErrorCode = "INSUFFICIENT_BALANCE"
	ErrCodeDuplicate        ErrorCode = "DUPLICATE"
)

// StandardError provides a consistent error format for API responses
type StandardError struct {
	HTTPStatus int
	Code       ErrorCode
	Message    string
	Details    interface{}
}

// Error implements the error interface
func (e StandardError) Error() string {
	return e.Message
}

// NewStandardError creates a new standardized error
func NewStandardError(status int, code ErrorCode, message string, details interface{}) *StandardError {
	return &StandardError{
		HTTPStatus: status,
		Code:       code,
		Message:    message,
		Details:    details,
	}
}

// SendError sends a standardized error response
func SendError(c *gin.Context, err *StandardError) {
	if err.HTTPStatus >= 500 {
		// Log internal errors
		requestID := c.GetString("request_id")
		if requestID == "" {
			requestID = c.GetHeader("X-Request-ID")
		}
		log.Error().
			Str("request_id", requestID).
			Str("path", c.Request.URL.Path).
			Str("method", c.Request.Method).
			Str("error_code", string(err.Code)).
			Msg(err.Message)

		// Don't expose internal error details to clients
		c.JSON(err.HTTPStatus, ErrorResponse{
			Error: ErrorDetail{
				Code:    string(err.Code),
				Message: "An unexpected error occurred. Please try again later.",
			},
		})
		return
	}

	c.JSON(err.HTTPStatus, ErrorResponse{
		Error: ErrorDetail{
			Code:    string(err.Code),
			Message: err.Message,
			Details: err.Details,
		},
	})
}

// HandleError is a helper that maps common domain errors to HTTP responses
// It provides a consistent way to handle errors across all handlers
func HandleError(c *gin.Context, err error, resourceName string) {
	if err == nil {
		return
	}

	errMsg := err.Error()

	// Map common error patterns to standardized responses
	switch {
	case errMsg == "record not found" || errMsg == "not found":
		NotFound(c, resourceName+" not found")
	case errMsg == "unauthorized" || errMsg == "invalid credentials":
		Unauthorized(c, "Authentication required")
	case errMsg == "forbidden" || errMsg == "access denied":
		Forbidden(c, "Access denied")
	case errMsg == "already exists" || errMsg == "duplicate":
		Conflict(c, "DUPLICATE", resourceName+" already exists")
	case errMsg == "insufficient balance":
		BadRequest(c, "INSUFFICIENT_BALANCE", "Insufficient balance", nil)
	case errMsg == "validation error" || errMsg == "invalid input":
		BadRequest(c, "VALIDATION_ERROR", errMsg, nil)
	default:
		InternalError(c, errMsg)
	}
}
