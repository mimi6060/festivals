package errors

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ErrorResponse is the standardized error response format
type ErrorResponse struct {
	Error ErrorBody `json:"error"`
}

// ErrorBody contains the error details
type ErrorBody struct {
	Code      string                 `json:"code"`
	Message   string                 `json:"message"`
	Details   map[string]interface{} `json:"details,omitempty"`
	RequestID string                 `json:"request_id,omitempty"`
	// Development-only fields (not included in production)
	Stack      []string `json:"stack,omitempty"`
	DebugInfo  string   `json:"debug_info,omitempty"`
}

// ResponseOptions configures error response behavior
type ResponseOptions struct {
	// IncludeStack includes stack traces in development mode
	IncludeStack bool
	// IncludeDebugInfo includes additional debug information
	IncludeDebugInfo bool
	// MaxStackFrames limits the number of stack frames in response
	MaxStackFrames int
	// SanitizeMessages replaces internal error messages with generic ones
	SanitizeMessages bool
	// LogErrors enables automatic error logging
	LogErrors bool
}

// DefaultOptions returns the default response options for production
func DefaultOptions() ResponseOptions {
	return ResponseOptions{
		IncludeStack:     false,
		IncludeDebugInfo: false,
		MaxStackFrames:   10,
		SanitizeMessages: true,
		LogErrors:        true,
	}
}

// DevelopmentOptions returns response options suitable for development
func DevelopmentOptions() ResponseOptions {
	return ResponseOptions{
		IncludeStack:     true,
		IncludeDebugInfo: true,
		MaxStackFrames:   20,
		SanitizeMessages: false,
		LogErrors:        true,
	}
}

// Responder handles error response formatting
type Responder struct {
	options ResponseOptions
}

// NewResponder creates a new error responder
func NewResponder(opts ResponseOptions) *Responder {
	return &Responder{options: opts}
}

// DefaultResponder creates a responder with default options
func DefaultResponder() *Responder {
	return NewResponder(DefaultOptions())
}

// RespondError sends an error response
func (r *Responder) RespondError(c *gin.Context, err error) {
	appErr := FromError(err)
	if appErr == nil {
		appErr = &AppError{
			Code:       ErrCodeInternal,
			Message:    "An unexpected error occurred",
			StatusCode: http.StatusInternalServerError,
		}
	}

	// Get request ID from context
	requestID := c.GetString("request_id")
	appErr.RequestID = requestID

	// Build response
	body := ErrorBody{
		Code:      appErr.Code,
		Message:   r.sanitizeMessage(appErr),
		Details:   r.sanitizeDetails(appErr.Details),
		RequestID: requestID,
	}

	// Add stack trace in development mode
	if r.options.IncludeStack && appErr.Stack != "" {
		if stackTrace, ok := GetStackTrace(appErr); ok {
			body.Stack = SimplifyStackForClient(stackTrace, r.options.MaxStackFrames)
		}
	}

	// Add debug info in development mode
	if r.options.IncludeDebugInfo && appErr.Err != nil {
		body.DebugInfo = appErr.Err.Error()
	}

	response := ErrorResponse{Error: body}
	c.AbortWithStatusJSON(appErr.HTTPStatus(), response)
}

// sanitizeMessage returns a safe message for the response
func (r *Responder) sanitizeMessage(err *AppError) string {
	if !r.options.SanitizeMessages {
		return err.Message
	}

	// For server errors, use generic messages
	if IsServerError(err.Code) {
		return "An unexpected error occurred. Please try again later."
	}

	// For client errors, the message is usually safe to show
	return err.Message
}

// sanitizeDetails removes potentially sensitive information from details
func (r *Responder) sanitizeDetails(details map[string]interface{}) map[string]interface{} {
	if details == nil {
		return nil
	}

	// List of keys that might contain sensitive information
	sensitiveKeys := map[string]bool{
		"password":       true,
		"secret":         true,
		"token":          true,
		"api_key":        true,
		"apiKey":         true,
		"authorization":  true,
		"credit_card":    true,
		"creditCard":     true,
		"ssn":            true,
		"social_security": true,
		"private_key":    true,
		"privateKey":     true,
		"internal_error": true,
		"db_error":       true,
	}

	sanitized := make(map[string]interface{})
	for key, value := range details {
		if sensitiveKeys[key] {
			sanitized[key] = "[REDACTED]"
		} else {
			sanitized[key] = value
		}
	}

	return sanitized
}

// Helper functions for common responses

// RespondBadRequest sends a 400 Bad Request response
func RespondBadRequest(c *gin.Context, code, message string, details map[string]interface{}) {
	requestID := c.GetString("request_id")
	c.AbortWithStatusJSON(http.StatusBadRequest, ErrorResponse{
		Error: ErrorBody{
			Code:      code,
			Message:   message,
			Details:   details,
			RequestID: requestID,
		},
	})
}

// RespondUnauthorized sends a 401 Unauthorized response
func RespondUnauthorized(c *gin.Context, message string) {
	requestID := c.GetString("request_id")
	c.AbortWithStatusJSON(http.StatusUnauthorized, ErrorResponse{
		Error: ErrorBody{
			Code:      ErrCodeUnauthorized,
			Message:   message,
			RequestID: requestID,
		},
	})
}

// RespondForbidden sends a 403 Forbidden response
func RespondForbidden(c *gin.Context, message string) {
	requestID := c.GetString("request_id")
	c.AbortWithStatusJSON(http.StatusForbidden, ErrorResponse{
		Error: ErrorBody{
			Code:      ErrCodeForbidden,
			Message:   message,
			RequestID: requestID,
		},
	})
}

// RespondNotFound sends a 404 Not Found response
func RespondNotFound(c *gin.Context, resource string) {
	requestID := c.GetString("request_id")
	message := "Resource not found"
	if resource != "" {
		message = resource + " not found"
	}
	c.AbortWithStatusJSON(http.StatusNotFound, ErrorResponse{
		Error: ErrorBody{
			Code:      ErrCodeNotFound,
			Message:   message,
			RequestID: requestID,
		},
	})
}

// RespondConflict sends a 409 Conflict response
func RespondConflict(c *gin.Context, code, message string) {
	requestID := c.GetString("request_id")
	c.AbortWithStatusJSON(http.StatusConflict, ErrorResponse{
		Error: ErrorBody{
			Code:      code,
			Message:   message,
			RequestID: requestID,
		},
	})
}

// RespondValidationError sends a 400 Bad Request response for validation errors
func RespondValidationError(c *gin.Context, message string, fields map[string]string) {
	requestID := c.GetString("request_id")
	details := make(map[string]interface{})
	if fields != nil {
		details["fields"] = fields
	}
	c.AbortWithStatusJSON(http.StatusBadRequest, ErrorResponse{
		Error: ErrorBody{
			Code:      ErrCodeValidation,
			Message:   message,
			Details:   details,
			RequestID: requestID,
		},
	})
}

// RespondRateLimited sends a 429 Too Many Requests response
func RespondRateLimited(c *gin.Context, retryAfter int) {
	requestID := c.GetString("request_id")
	c.Header("Retry-After", string(rune(retryAfter)))
	c.AbortWithStatusJSON(http.StatusTooManyRequests, ErrorResponse{
		Error: ErrorBody{
			Code:      ErrCodeRateLimited,
			Message:   "Too many requests. Please try again later.",
			Details:   map[string]interface{}{"retry_after": retryAfter},
			RequestID: requestID,
		},
	})
}

// RespondInternalError sends a 500 Internal Server Error response
func RespondInternalError(c *gin.Context) {
	requestID := c.GetString("request_id")
	c.AbortWithStatusJSON(http.StatusInternalServerError, ErrorResponse{
		Error: ErrorBody{
			Code:      ErrCodeInternal,
			Message:   "An unexpected error occurred. Please try again later.",
			RequestID: requestID,
		},
	})
}

// RespondServiceUnavailable sends a 503 Service Unavailable response
func RespondServiceUnavailable(c *gin.Context, retryAfter int) {
	requestID := c.GetString("request_id")
	if retryAfter > 0 {
		c.Header("Retry-After", string(rune(retryAfter)))
	}
	c.AbortWithStatusJSON(http.StatusServiceUnavailable, ErrorResponse{
		Error: ErrorBody{
			Code:      ErrCodeServiceUnavailable,
			Message:   "Service temporarily unavailable. Please try again later.",
			RequestID: requestID,
		},
	})
}

// RespondWithError is a convenience function that auto-converts errors
func RespondWithError(c *gin.Context, err error) {
	DefaultResponder().RespondError(c, err)
}

// ToJSON converts an error response to JSON bytes
func ToJSON(err error, requestID string) ([]byte, error) {
	appErr := FromError(err)
	if appErr == nil {
		appErr = &AppError{
			Code:       ErrCodeInternal,
			Message:    "An unexpected error occurred",
			StatusCode: http.StatusInternalServerError,
		}
	}

	response := ErrorResponse{
		Error: ErrorBody{
			Code:      appErr.Code,
			Message:   appErr.Message,
			Details:   appErr.Details,
			RequestID: requestID,
		},
	}

	return json.Marshal(response)
}

// ParseErrorResponse parses an error response from JSON
func ParseErrorResponse(data []byte) (*ErrorResponse, error) {
	var response ErrorResponse
	if err := json.Unmarshal(data, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

// ErrorResponseFromAppError creates an ErrorResponse from an AppError
func ErrorResponseFromAppError(err *AppError) ErrorResponse {
	return ErrorResponse{
		Error: ErrorBody{
			Code:      err.Code,
			Message:   err.Message,
			Details:   err.Details,
			RequestID: err.RequestID,
		},
	}
}
