package errors

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Wrap wraps an error with additional context
func Wrap(err error, code, message string) *AppError {
	if err == nil {
		return nil
	}

	// If it's already an AppError, update it
	var appErr *AppError
	if errors.As(err, &appErr) {
		if code != "" {
			appErr.Code = code
		}
		if message != "" {
			appErr.Message = message
		}
		return appErr
	}

	return &AppError{
		Code:       code,
		Message:    message,
		Err:        err,
		StatusCode: GetHTTPStatus(code),
	}
}

// WrapWithOp wraps an error with operation context
func WrapWithOp(err error, op string) *AppError {
	if err == nil {
		return nil
	}

	// If it's already an AppError, add the operation
	var appErr *AppError
	if errors.As(err, &appErr) {
		if appErr.Op == "" {
			appErr.Op = op
		} else {
			appErr.Op = op + ": " + appErr.Op
		}
		return appErr
	}

	return &AppError{
		Code:    ErrCodeInternal,
		Message: "An unexpected error occurred",
		Err:     err,
		Op:      op,
	}
}

// WrapWithDetails wraps an error with additional details
func WrapWithDetails(err error, details map[string]interface{}) *AppError {
	if err == nil {
		return nil
	}

	var appErr *AppError
	if errors.As(err, &appErr) {
		if appErr.Details == nil {
			appErr.Details = details
		} else {
			for k, v := range details {
				appErr.Details[k] = v
			}
		}
		return appErr
	}

	return &AppError{
		Code:    ErrCodeInternal,
		Message: err.Error(),
		Err:     err,
		Details: details,
	}
}

// New creates a new AppError
func New(code, message string) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		StatusCode: GetHTTPStatus(code),
	}
}

// Newf creates a new AppError with a formatted message
func Newf(code, format string, args ...interface{}) *AppError {
	return &AppError{
		Code:       code,
		Message:    fmt.Sprintf(format, args...),
		StatusCode: GetHTTPStatus(code),
	}
}

// FromError converts a standard error to an AppError
func FromError(err error) *AppError {
	if err == nil {
		return nil
	}

	// Already an AppError
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr
	}

	// Check for specific error types and convert appropriately
	return classifyError(err)
}

// classifyError attempts to classify a generic error into a specific AppError
func classifyError(err error) *AppError {
	if err == nil {
		return nil
	}

	errStr := err.Error()

	// Context errors
	if errors.Is(err, context.DeadlineExceeded) {
		return &AppError{
			Code:       ErrCodeTimeout,
			Message:    "Request timed out",
			Err:        err,
			Kind:       KindInternal,
			StatusCode: http.StatusGatewayTimeout,
		}
	}

	if errors.Is(err, context.Canceled) {
		return &AppError{
			Code:       ErrCodeInternal,
			Message:    "Request was cancelled",
			Err:        err,
			Kind:       KindInternal,
			StatusCode: http.StatusInternalServerError,
		}
	}

	// Database not found errors
	if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
		return &AppError{
			Code:       ErrCodeNotFound,
			Message:    "Resource not found",
			Err:        err,
			Kind:       KindNotFound,
			StatusCode: http.StatusNotFound,
		}
	}

	// PostgreSQL specific errors
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return classifyPgError(pgErr)
	}

	// Check for common error patterns
	lowerErr := strings.ToLower(errStr)

	if strings.Contains(lowerErr, "not found") {
		return &AppError{
			Code:       ErrCodeNotFound,
			Message:    "Resource not found",
			Err:        err,
			Kind:       KindNotFound,
			StatusCode: http.StatusNotFound,
		}
	}

	if strings.Contains(lowerErr, "unauthorized") || strings.Contains(lowerErr, "authentication") {
		return &AppError{
			Code:       ErrCodeUnauthorized,
			Message:    "Authentication required",
			Err:        err,
			Kind:       KindUnauthorized,
			StatusCode: http.StatusUnauthorized,
		}
	}

	if strings.Contains(lowerErr, "forbidden") || strings.Contains(lowerErr, "permission denied") {
		return &AppError{
			Code:       ErrCodeForbidden,
			Message:    "Access denied",
			Err:        err,
			Kind:       KindForbidden,
			StatusCode: http.StatusForbidden,
		}
	}

	if strings.Contains(lowerErr, "already exists") || strings.Contains(lowerErr, "duplicate") {
		return &AppError{
			Code:       ErrCodeAlreadyExists,
			Message:    "Resource already exists",
			Err:        err,
			Kind:       KindConflict,
			StatusCode: http.StatusConflict,
		}
	}

	if strings.Contains(lowerErr, "timeout") || strings.Contains(lowerErr, "deadline exceeded") {
		return &AppError{
			Code:       ErrCodeTimeout,
			Message:    "Operation timed out",
			Err:        err,
			Kind:       KindInternal,
			StatusCode: http.StatusGatewayTimeout,
		}
	}

	if strings.Contains(lowerErr, "connection refused") || strings.Contains(lowerErr, "connection reset") {
		return &AppError{
			Code:       ErrCodeServiceUnavailable,
			Message:    "Service temporarily unavailable",
			Err:        err,
			Kind:       KindExternal,
			StatusCode: http.StatusServiceUnavailable,
		}
	}

	// Default to internal error
	return &AppError{
		Code:       ErrCodeInternal,
		Message:    "An unexpected error occurred",
		Err:        err,
		Kind:       KindInternal,
		StatusCode: http.StatusInternalServerError,
	}
}

// classifyPgError converts PostgreSQL errors to AppErrors
func classifyPgError(pgErr *pgconn.PgError) *AppError {
	switch pgErr.Code {
	// Class 23 - Integrity Constraint Violation
	case "23505": // unique_violation
		return &AppError{
			Code:       ErrCodeAlreadyExists,
			Message:    "Resource already exists",
			Err:        pgErr,
			Kind:       KindConflict,
			StatusCode: http.StatusConflict,
			Details: map[string]interface{}{
				"constraint": pgErr.ConstraintName,
			},
		}
	case "23503": // foreign_key_violation
		return &AppError{
			Code:       ErrCodeConflict,
			Message:    "Referenced resource not found or constraint violated",
			Err:        pgErr,
			Kind:       KindConflict,
			StatusCode: http.StatusConflict,
			Details: map[string]interface{}{
				"constraint": pgErr.ConstraintName,
			},
		}
	case "23502": // not_null_violation
		return &AppError{
			Code:       ErrCodeValidation,
			Message:    "Required field is missing",
			Err:        pgErr,
			Kind:       KindValidation,
			StatusCode: http.StatusBadRequest,
			Details: map[string]interface{}{
				"column": pgErr.ColumnName,
			},
		}
	case "23514": // check_violation
		return &AppError{
			Code:       ErrCodeValidation,
			Message:    "Data validation failed",
			Err:        pgErr,
			Kind:       KindValidation,
			StatusCode: http.StatusBadRequest,
			Details: map[string]interface{}{
				"constraint": pgErr.ConstraintName,
			},
		}

	// Class 40 - Transaction Rollback
	case "40001": // serialization_failure
		return &AppError{
			Code:       ErrCodeConflict,
			Message:    "Concurrent modification detected. Please retry.",
			Err:        pgErr,
			Kind:       KindConflict,
			StatusCode: http.StatusConflict,
		}
	case "40P01": // deadlock_detected
		return &AppError{
			Code:       ErrCodeConflict,
			Message:    "Concurrent modification detected. Please retry.",
			Err:        pgErr,
			Kind:       KindConflict,
			StatusCode: http.StatusConflict,
		}

	// Class 53 - Insufficient Resources
	case "53000", "53100", "53200", "53300":
		return &AppError{
			Code:       ErrCodeResourceExhausted,
			Message:    "Server resources exhausted. Please try again later.",
			Err:        pgErr,
			Kind:       KindInternal,
			StatusCode: http.StatusServiceUnavailable,
		}

	// Class 57 - Operator Intervention
	case "57014": // query_canceled
		return &AppError{
			Code:       ErrCodeTimeout,
			Message:    "Query timed out",
			Err:        pgErr,
			Kind:       KindInternal,
			StatusCode: http.StatusGatewayTimeout,
		}

	default:
		return &AppError{
			Code:       ErrCodeDatabaseError,
			Message:    "A database error occurred",
			Err:        pgErr,
			Kind:       KindInternal,
			StatusCode: http.StatusInternalServerError,
		}
	}
}

// Is checks if err matches target (for use with errors.Is)
func Is(err, target error) bool {
	return errors.Is(err, target)
}

// As finds the first error in err's chain that matches target (for use with errors.As)
func As(err error, target interface{}) bool {
	return errors.As(err, target)
}

// Cause returns the underlying cause of the error
func Cause(err error) error {
	for err != nil {
		unwrapper, ok := err.(interface{ Unwrap() error })
		if !ok {
			return err
		}
		unwrapped := unwrapper.Unwrap()
		if unwrapped == nil {
			return err
		}
		err = unwrapped
	}
	return err
}

// GetCode extracts the error code from an error
func GetCode(err error) string {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.Code
	}
	return ErrCodeInternal
}

// GetMessage extracts a safe message from an error (suitable for clients)
func GetMessage(err error) string {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.Message
	}
	// Don't expose internal error messages to clients
	return "An unexpected error occurred"
}

// Join combines multiple errors into one (similar to Go 1.20's errors.Join)
func Join(errs ...error) error {
	var nonNilErrs []error
	for _, err := range errs {
		if err != nil {
			nonNilErrs = append(nonNilErrs, err)
		}
	}

	switch len(nonNilErrs) {
	case 0:
		return nil
	case 1:
		return nonNilErrs[0]
	default:
		return &multiError{errs: nonNilErrs}
	}
}

type multiError struct {
	errs []error
}

func (m *multiError) Error() string {
	var msgs []string
	for _, err := range m.errs {
		msgs = append(msgs, err.Error())
	}
	return strings.Join(msgs, "; ")
}

func (m *multiError) Unwrap() []error {
	return m.errs
}
