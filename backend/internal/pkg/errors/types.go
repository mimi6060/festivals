package errors

import (
	"fmt"
	"net/http"
)

// AppError is the base application error type with full context
type AppError struct {
	// Core error information
	Code    string `json:"code"`
	Message string `json:"message"`

	// Additional context
	Details    map[string]interface{} `json:"details,omitempty"`
	RequestID  string                 `json:"request_id,omitempty"`

	// Internal fields (not exposed in JSON response)
	Err        error    `json:"-"`
	Stack      string   `json:"-"`
	StatusCode int      `json:"-"`
	Op         string   `json:"-"` // Operation that caused the error
	Kind       ErrorKind `json:"-"` // Error category
}

// ErrorKind represents the category of error
type ErrorKind int

const (
	KindUnexpected ErrorKind = iota
	KindValidation
	KindNotFound
	KindUnauthorized
	KindForbidden
	KindConflict
	KindRateLimit
	KindExternal
	KindInternal
	KindBusiness
)

// String returns a human-readable representation of the error kind
func (k ErrorKind) String() string {
	switch k {
	case KindValidation:
		return "validation"
	case KindNotFound:
		return "not_found"
	case KindUnauthorized:
		return "unauthorized"
	case KindForbidden:
		return "forbidden"
	case KindConflict:
		return "conflict"
	case KindRateLimit:
		return "rate_limit"
	case KindExternal:
		return "external"
	case KindInternal:
		return "internal"
	case KindBusiness:
		return "business"
	default:
		return "unexpected"
	}
}

// Error implements the error interface
func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap returns the underlying error
func (e *AppError) Unwrap() error {
	return e.Err
}

// Is reports whether the error matches the target
func (e *AppError) Is(target error) bool {
	t, ok := target.(*AppError)
	if !ok {
		return false
	}
	return e.Code == t.Code
}

// HTTPStatus returns the HTTP status code for this error
func (e *AppError) HTTPStatus() int {
	if e.StatusCode != 0 {
		return e.StatusCode
	}
	return GetHTTPStatus(e.Code)
}

// WithDetails adds details to the error
func (e *AppError) WithDetails(details map[string]interface{}) *AppError {
	e.Details = details
	return e
}

// WithDetail adds a single detail to the error
func (e *AppError) WithDetail(key string, value interface{}) *AppError {
	if e.Details == nil {
		e.Details = make(map[string]interface{})
	}
	e.Details[key] = value
	return e
}

// WithRequestID adds a request ID to the error
func (e *AppError) WithRequestID(requestID string) *AppError {
	e.RequestID = requestID
	return e
}

// WithOp adds the operation name to the error
func (e *AppError) WithOp(op string) *AppError {
	e.Op = op
	return e
}

// WithStatusCode overrides the default HTTP status code
func (e *AppError) WithStatusCode(status int) *AppError {
	e.StatusCode = status
	return e
}

// LogFields returns a map of fields suitable for structured logging
func (e *AppError) LogFields() map[string]interface{} {
	fields := map[string]interface{}{
		"error_code":    e.Code,
		"error_message": e.Message,
		"error_kind":    e.Kind.String(),
	}

	if e.Op != "" {
		fields["operation"] = e.Op
	}
	if e.RequestID != "" {
		fields["request_id"] = e.RequestID
	}
	if e.Err != nil {
		fields["original_error"] = e.Err.Error()
	}
	if len(e.Details) > 0 {
		fields["details"] = e.Details
	}
	if e.Stack != "" {
		fields["stack_trace"] = e.Stack
	}

	return fields
}

// Specific error type constructors

// ValidationError creates a validation error
type ValidationError struct {
	*AppError
	Fields map[string]string `json:"fields,omitempty"`
}

// NewValidationError creates a new validation error
func NewValidationError(message string, fields map[string]string) *ValidationError {
	return &ValidationError{
		AppError: &AppError{
			Code:       ErrCodeValidation,
			Message:    message,
			Kind:       KindValidation,
			StatusCode: http.StatusBadRequest,
		},
		Fields: fields,
	}
}

// NotFoundError creates a not found error
type NotFoundError struct {
	*AppError
	Resource   string `json:"resource,omitempty"`
	ResourceID string `json:"resource_id,omitempty"`
}

// NewNotFoundError creates a new not found error
func NewNotFoundError(resource, resourceID string) *NotFoundError {
	return &NotFoundError{
		AppError: &AppError{
			Code:       ErrCodeNotFound,
			Message:    fmt.Sprintf("%s not found", resource),
			Kind:       KindNotFound,
			StatusCode: http.StatusNotFound,
		},
		Resource:   resource,
		ResourceID: resourceID,
	}
}

// UnauthorizedError creates an unauthorized error
type UnauthorizedError struct {
	*AppError
	Reason string `json:"reason,omitempty"`
}

// NewUnauthorizedError creates a new unauthorized error
func NewUnauthorizedError(message string) *UnauthorizedError {
	return &UnauthorizedError{
		AppError: &AppError{
			Code:       ErrCodeUnauthorized,
			Message:    message,
			Kind:       KindUnauthorized,
			StatusCode: http.StatusUnauthorized,
		},
	}
}

// ForbiddenError creates a forbidden error
type ForbiddenError struct {
	*AppError
	RequiredPermission string `json:"required_permission,omitempty"`
}

// NewForbiddenError creates a new forbidden error
func NewForbiddenError(message string) *ForbiddenError {
	return &ForbiddenError{
		AppError: &AppError{
			Code:       ErrCodeForbidden,
			Message:    message,
			Kind:       KindForbidden,
			StatusCode: http.StatusForbidden,
		},
	}
}

// ConflictError creates a conflict error
type ConflictError struct {
	*AppError
	ConflictType string `json:"conflict_type,omitempty"`
}

// NewConflictError creates a new conflict error
func NewConflictError(message, conflictType string) *ConflictError {
	return &ConflictError{
		AppError: &AppError{
			Code:       ErrCodeConflict,
			Message:    message,
			Kind:       KindConflict,
			StatusCode: http.StatusConflict,
		},
		ConflictType: conflictType,
	}
}

// RateLimitError creates a rate limit error
type RateLimitError struct {
	*AppError
	RetryAfter int `json:"retry_after,omitempty"` // Seconds until retry is allowed
	Limit      int `json:"limit,omitempty"`
	Remaining  int `json:"remaining,omitempty"`
}

// NewRateLimitError creates a new rate limit error
func NewRateLimitError(retryAfter int) *RateLimitError {
	return &RateLimitError{
		AppError: &AppError{
			Code:       ErrCodeRateLimited,
			Message:    "Too many requests. Please try again later.",
			Kind:       KindRateLimit,
			StatusCode: http.StatusTooManyRequests,
		},
		RetryAfter: retryAfter,
	}
}

// InsufficientFundsError creates an insufficient funds error
type InsufficientFundsError struct {
	*AppError
	Required  float64 `json:"required,omitempty"`
	Available float64 `json:"available,omitempty"`
}

// NewInsufficientFundsError creates a new insufficient funds error
func NewInsufficientFundsError(required, available float64) *InsufficientFundsError {
	return &InsufficientFundsError{
		AppError: &AppError{
			Code:       ErrCodeInsufficientFunds,
			Message:    "Insufficient funds to complete the transaction",
			Kind:       KindBusiness,
			StatusCode: http.StatusPaymentRequired,
			Details: map[string]interface{}{
				"required":  required,
				"available": available,
				"shortage":  required - available,
			},
		},
		Required:  required,
		Available: available,
	}
}

// ExternalServiceError creates an external service error
type ExternalServiceError struct {
	*AppError
	Service string `json:"service,omitempty"`
}

// NewExternalServiceError creates a new external service error
func NewExternalServiceError(service, message string, err error) *ExternalServiceError {
	return &ExternalServiceError{
		AppError: &AppError{
			Code:       ErrCodeExternalService,
			Message:    message,
			Err:        err,
			Kind:       KindExternal,
			StatusCode: http.StatusBadGateway,
		},
		Service: service,
	}
}

// InternalError creates an internal server error
type InternalError struct {
	*AppError
}

// NewInternalError creates a new internal error (use sparingly - prefer specific errors)
func NewInternalError(message string, err error) *InternalError {
	return &InternalError{
		AppError: &AppError{
			Code:       ErrCodeInternal,
			Message:    message,
			Err:        err,
			Kind:       KindInternal,
			StatusCode: http.StatusInternalServerError,
		},
	}
}

// BusinessError creates a business logic error
type BusinessError struct {
	*AppError
}

// NewBusinessError creates a new business logic error
func NewBusinessError(code, message string) *BusinessError {
	return &BusinessError{
		AppError: &AppError{
			Code:       code,
			Message:    message,
			Kind:       KindBusiness,
			StatusCode: GetHTTPStatus(code),
		},
	}
}

// DatabaseError creates a database error
type DatabaseError struct {
	*AppError
	Operation string `json:"-"` // Not exposed to clients
}

// NewDatabaseError creates a new database error
func NewDatabaseError(operation string, err error) *DatabaseError {
	return &DatabaseError{
		AppError: &AppError{
			Code:       ErrCodeDatabaseError,
			Message:    "A database error occurred",
			Err:        err,
			Kind:       KindInternal,
			StatusCode: http.StatusInternalServerError,
		},
		Operation: operation,
	}
}

// TimeoutError creates a timeout error
type TimeoutError struct {
	*AppError
	TimeoutMS int64 `json:"timeout_ms,omitempty"`
}

// NewTimeoutError creates a new timeout error
func NewTimeoutError(timeoutMS int64) *TimeoutError {
	return &TimeoutError{
		AppError: &AppError{
			Code:       ErrCodeTimeout,
			Message:    "Request timed out",
			Kind:       KindInternal,
			StatusCode: http.StatusGatewayTimeout,
		},
		TimeoutMS: timeoutMS,
	}
}
