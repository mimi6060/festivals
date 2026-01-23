package errors

import (
	"errors"
	"net/http"
)

// Standard sentinel errors for common cases
// These are kept for backwards compatibility and simple error checking
var (
	// Auth errors
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")

	// Request errors
	ErrBadRequest = errors.New("bad request")

	// Resource errors
	ErrNotFound      = errors.New("resource not found")
	ErrAlreadyExists = errors.New("resource already exists")

	// Validation errors
	ErrValidation = errors.New("validation error")

	// Business logic errors
	ErrInsufficientBalance   = errors.New("insufficient balance")
	ErrWalletNotFound        = errors.New("wallet not found")
	ErrWalletFrozen          = errors.New("wallet is frozen")
	ErrTicketNotFound        = errors.New("ticket not found")
	ErrTicketAlreadyUsed     = errors.New("ticket already used")
	ErrTicketExpired         = errors.New("ticket expired")
	ErrFestivalNotFound      = errors.New("festival not found")
	ErrFestivalClosed        = errors.New("festival is closed")
	ErrDuplicateTransaction  = errors.New("duplicate transaction")
	ErrTransactionNotAllowed = errors.New("transaction not allowed")
	ErrStandNotFound         = errors.New("stand not found")
	ErrStandClosed           = errors.New("stand is closed")
	ErrProductNotFound       = errors.New("product not found")
	ErrOutOfStock            = errors.New("product out of stock")
	ErrOrderNotFound         = errors.New("order not found")
	ErrUserNotFound          = errors.New("user not found")
	ErrUserBanned            = errors.New("user is banned")
	ErrQRCodeExpired         = errors.New("QR code expired")
	ErrQRCodeInvalid         = errors.New("QR code invalid")

	// External service errors
	ErrPaymentFailed   = errors.New("payment failed")
	ErrEmailFailed     = errors.New("email sending failed")
	ErrSMSFailed       = errors.New("SMS sending failed")
	ErrExternalService = errors.New("external service error")
	ErrStorageFailed   = errors.New("storage operation failed")

	// Rate limiting errors
	ErrRateLimited = errors.New("rate limited")

	// Internal errors
	ErrInternal      = errors.New("internal error")
	ErrDatabaseError = errors.New("database error")
	ErrCacheError    = errors.New("cache error")
	ErrTimeout       = errors.New("operation timed out")
)

// SentinelToAppError converts a sentinel error to an AppError with proper code and message
func SentinelToAppError(err error) *AppError {
	if err == nil {
		return nil
	}

	// Check for common sentinel errors
	switch {
	case errors.Is(err, ErrUnauthorized):
		return &AppError{
			Code:       ErrCodeUnauthorized,
			Message:    "Authentication required",
			Err:        err,
			Kind:       KindUnauthorized,
			StatusCode: http.StatusUnauthorized,
		}
	case errors.Is(err, ErrForbidden):
		return &AppError{
			Code:       ErrCodeForbidden,
			Message:    "Access denied",
			Err:        err,
			Kind:       KindForbidden,
			StatusCode: http.StatusForbidden,
		}
	case errors.Is(err, ErrBadRequest):
		return &AppError{
			Code:       ErrCodeValidation,
			Message:    "Invalid request",
			Err:        err,
			Kind:       KindValidation,
			StatusCode: http.StatusBadRequest,
		}
	case errors.Is(err, ErrNotFound):
		return &AppError{
			Code:       ErrCodeNotFound,
			Message:    "Resource not found",
			Err:        err,
			Kind:       KindNotFound,
			StatusCode: http.StatusNotFound,
		}
	case errors.Is(err, ErrAlreadyExists):
		return &AppError{
			Code:       ErrCodeAlreadyExists,
			Message:    "Resource already exists",
			Err:        err,
			Kind:       KindConflict,
			StatusCode: http.StatusConflict,
		}
	case errors.Is(err, ErrValidation):
		return &AppError{
			Code:       ErrCodeValidation,
			Message:    "Validation failed",
			Err:        err,
			Kind:       KindValidation,
			StatusCode: http.StatusBadRequest,
		}
	case errors.Is(err, ErrInsufficientBalance):
		return &AppError{
			Code:       ErrCodeInsufficientFunds,
			Message:    "Insufficient balance to complete the transaction",
			Err:        err,
			Kind:       KindBusiness,
			StatusCode: http.StatusPaymentRequired,
		}
	case errors.Is(err, ErrWalletNotFound):
		return &AppError{
			Code:       ErrCodeNotFound,
			Message:    "Wallet not found",
			Err:        err,
			Kind:       KindNotFound,
			StatusCode: http.StatusNotFound,
		}
	case errors.Is(err, ErrWalletFrozen):
		return &AppError{
			Code:       ErrCodeWalletFrozen,
			Message:    "Wallet is frozen and cannot be used",
			Err:        err,
			Kind:       KindBusiness,
			StatusCode: http.StatusUnprocessableEntity,
		}
	case errors.Is(err, ErrTicketNotFound):
		return &AppError{
			Code:       ErrCodeTicketNotFound,
			Message:    "Ticket not found",
			Err:        err,
			Kind:       KindNotFound,
			StatusCode: http.StatusNotFound,
		}
	case errors.Is(err, ErrTicketAlreadyUsed):
		return &AppError{
			Code:       ErrCodeTicketAlreadyUsed,
			Message:    "Ticket has already been used",
			Err:        err,
			Kind:       KindConflict,
			StatusCode: http.StatusConflict,
		}
	case errors.Is(err, ErrTicketExpired):
		return &AppError{
			Code:       ErrCodeTicketExpired,
			Message:    "Ticket has expired",
			Err:        err,
			Kind:       KindBusiness,
			StatusCode: http.StatusGone,
		}
	case errors.Is(err, ErrFestivalNotFound):
		return &AppError{
			Code:       ErrCodeFestivalNotFound,
			Message:    "Festival not found",
			Err:        err,
			Kind:       KindNotFound,
			StatusCode: http.StatusNotFound,
		}
	case errors.Is(err, ErrFestivalClosed):
		return &AppError{
			Code:       ErrCodeFestivalClosed,
			Message:    "Festival is not currently active",
			Err:        err,
			Kind:       KindBusiness,
			StatusCode: http.StatusUnprocessableEntity,
		}
	case errors.Is(err, ErrDuplicateTransaction):
		return &AppError{
			Code:       ErrCodeDuplicateTransaction,
			Message:    "This transaction has already been processed",
			Err:        err,
			Kind:       KindConflict,
			StatusCode: http.StatusConflict,
		}
	case errors.Is(err, ErrTransactionNotAllowed):
		return &AppError{
			Code:       ErrCodeRefundNotAllowed,
			Message:    "This transaction is not allowed",
			Err:        err,
			Kind:       KindBusiness,
			StatusCode: http.StatusUnprocessableEntity,
		}
	case errors.Is(err, ErrStandNotFound):
		return &AppError{
			Code:       ErrCodeStandNotFound,
			Message:    "Stand not found",
			Err:        err,
			Kind:       KindNotFound,
			StatusCode: http.StatusNotFound,
		}
	case errors.Is(err, ErrStandClosed):
		return &AppError{
			Code:       ErrCodeStandClosed,
			Message:    "Stand is currently closed",
			Err:        err,
			Kind:       KindBusiness,
			StatusCode: http.StatusUnprocessableEntity,
		}
	case errors.Is(err, ErrProductNotFound):
		return &AppError{
			Code:       ErrCodeProductNotFound,
			Message:    "Product not found",
			Err:        err,
			Kind:       KindNotFound,
			StatusCode: http.StatusNotFound,
		}
	case errors.Is(err, ErrOutOfStock):
		return &AppError{
			Code:       ErrCodeOutOfStock,
			Message:    "Product is out of stock",
			Err:        err,
			Kind:       KindBusiness,
			StatusCode: http.StatusUnprocessableEntity,
		}
	case errors.Is(err, ErrOrderNotFound):
		return &AppError{
			Code:       ErrCodeOrderNotFound,
			Message:    "Order not found",
			Err:        err,
			Kind:       KindNotFound,
			StatusCode: http.StatusNotFound,
		}
	case errors.Is(err, ErrUserNotFound):
		return &AppError{
			Code:       ErrCodeUserNotFound,
			Message:    "User not found",
			Err:        err,
			Kind:       KindNotFound,
			StatusCode: http.StatusNotFound,
		}
	case errors.Is(err, ErrUserBanned):
		return &AppError{
			Code:       ErrCodeUserBanned,
			Message:    "User account is banned",
			Err:        err,
			Kind:       KindForbidden,
			StatusCode: http.StatusForbidden,
		}
	case errors.Is(err, ErrQRCodeExpired):
		return &AppError{
			Code:       ErrCodeQRCodeExpired,
			Message:    "QR code has expired. Please generate a new one.",
			Err:        err,
			Kind:       KindBusiness,
			StatusCode: http.StatusGone,
		}
	case errors.Is(err, ErrQRCodeInvalid):
		return &AppError{
			Code:       ErrCodeQRCodeInvalid,
			Message:    "QR code is invalid",
			Err:        err,
			Kind:       KindValidation,
			StatusCode: http.StatusBadRequest,
		}
	case errors.Is(err, ErrPaymentFailed):
		return &AppError{
			Code:       ErrCodePaymentFailed,
			Message:    "Payment processing failed",
			Err:        err,
			Kind:       KindExternal,
			StatusCode: http.StatusBadGateway,
		}
	case errors.Is(err, ErrEmailFailed):
		return &AppError{
			Code:       ErrCodeEmailFailed,
			Message:    "Failed to send email",
			Err:        err,
			Kind:       KindExternal,
			StatusCode: http.StatusBadGateway,
		}
	case errors.Is(err, ErrSMSFailed):
		return &AppError{
			Code:       ErrCodeSMSFailed,
			Message:    "Failed to send SMS",
			Err:        err,
			Kind:       KindExternal,
			StatusCode: http.StatusBadGateway,
		}
	case errors.Is(err, ErrExternalService):
		return &AppError{
			Code:       ErrCodeExternalService,
			Message:    "External service error",
			Err:        err,
			Kind:       KindExternal,
			StatusCode: http.StatusBadGateway,
		}
	case errors.Is(err, ErrStorageFailed):
		return &AppError{
			Code:       ErrCodeStorageFailed,
			Message:    "Storage operation failed",
			Err:        err,
			Kind:       KindExternal,
			StatusCode: http.StatusBadGateway,
		}
	case errors.Is(err, ErrRateLimited):
		return &AppError{
			Code:       ErrCodeRateLimited,
			Message:    "Too many requests. Please try again later.",
			Err:        err,
			Kind:       KindRateLimit,
			StatusCode: http.StatusTooManyRequests,
		}
	case errors.Is(err, ErrDatabaseError):
		return &AppError{
			Code:       ErrCodeDatabaseError,
			Message:    "A database error occurred",
			Err:        err,
			Kind:       KindInternal,
			StatusCode: http.StatusInternalServerError,
		}
	case errors.Is(err, ErrCacheError):
		return &AppError{
			Code:       ErrCodeCacheError,
			Message:    "A cache error occurred",
			Err:        err,
			Kind:       KindInternal,
			StatusCode: http.StatusInternalServerError,
		}
	case errors.Is(err, ErrTimeout):
		return &AppError{
			Code:       ErrCodeTimeout,
			Message:    "Operation timed out",
			Err:        err,
			Kind:       KindInternal,
			StatusCode: http.StatusGatewayTimeout,
		}
	case errors.Is(err, ErrInternal):
		return &AppError{
			Code:       ErrCodeInternal,
			Message:    "An internal error occurred",
			Err:        err,
			Kind:       KindInternal,
			StatusCode: http.StatusInternalServerError,
		}
	default:
		// For any other error, try to classify it
		return classifyError(err)
	}
}

// Convenience functions for creating common errors

// NotFoundErr creates a not found error for a specific resource
func NotFoundErr(resource string) *AppError {
	return &AppError{
		Code:       ErrCodeNotFound,
		Message:    resource + " not found",
		Kind:       KindNotFound,
		StatusCode: http.StatusNotFound,
	}
}

// ValidationErr creates a validation error with field details
func ValidationErr(message string, fields map[string]string) *AppError {
	details := make(map[string]interface{})
	if fields != nil {
		details["fields"] = fields
	}
	return &AppError{
		Code:       ErrCodeValidation,
		Message:    message,
		Details:    details,
		Kind:       KindValidation,
		StatusCode: http.StatusBadRequest,
	}
}

// UnauthorizedErr creates an unauthorized error
func UnauthorizedErr(message string) *AppError {
	if message == "" {
		message = "Authentication required"
	}
	return &AppError{
		Code:       ErrCodeUnauthorized,
		Message:    message,
		Kind:       KindUnauthorized,
		StatusCode: http.StatusUnauthorized,
	}
}

// ForbiddenErr creates a forbidden error
func ForbiddenErr(message string) *AppError {
	if message == "" {
		message = "Access denied"
	}
	return &AppError{
		Code:       ErrCodeForbidden,
		Message:    message,
		Kind:       KindForbidden,
		StatusCode: http.StatusForbidden,
	}
}

// ConflictErr creates a conflict error
func ConflictErr(message string) *AppError {
	return &AppError{
		Code:       ErrCodeConflict,
		Message:    message,
		Kind:       KindConflict,
		StatusCode: http.StatusConflict,
	}
}

// BusinessErr creates a business logic error with a specific code
func BusinessErr(code, message string) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		Kind:       KindBusiness,
		StatusCode: GetHTTPStatus(code),
	}
}

// InternalErr creates an internal error (hides details from client)
func InternalErr(err error) *AppError {
	return &AppError{
		Code:       ErrCodeInternal,
		Message:    "An unexpected error occurred",
		Err:        err,
		Kind:       KindInternal,
		StatusCode: http.StatusInternalServerError,
	}
}

// DatabaseErr creates a database error
func DatabaseErr(err error) *AppError {
	return &AppError{
		Code:       ErrCodeDatabaseError,
		Message:    "A database error occurred",
		Err:        err,
		Kind:       KindInternal,
		StatusCode: http.StatusInternalServerError,
	}
}

// ExternalServiceErr creates an external service error
func ExternalServiceErr(service string, err error) *AppError {
	return &AppError{
		Code:       ErrCodeExternalService,
		Message:    "External service temporarily unavailable",
		Err:        err,
		Kind:       KindExternal,
		StatusCode: http.StatusBadGateway,
		Details: map[string]interface{}{
			"service": service,
		},
	}
}

// RateLimitErr creates a rate limit error
func RateLimitErr(retryAfter int) *AppError {
	return &AppError{
		Code:       ErrCodeRateLimited,
		Message:    "Too many requests. Please try again later.",
		Kind:       KindRateLimit,
		StatusCode: http.StatusTooManyRequests,
		Details: map[string]interface{}{
			"retry_after": retryAfter,
		},
	}
}

// IsNotFound checks if an error is a not found error
func IsNotFound(err error) bool {
	if err == nil {
		return false
	}
	var appErr *AppError
	if As(err, &appErr) {
		return appErr.Code == ErrCodeNotFound ||
			appErr.Code == ErrCodeTicketNotFound ||
			appErr.Code == ErrCodeFestivalNotFound ||
			appErr.Code == ErrCodeStandNotFound ||
			appErr.Code == ErrCodeProductNotFound ||
			appErr.Code == ErrCodeOrderNotFound ||
			appErr.Code == ErrCodeUserNotFound ||
			appErr.Code == ErrCodeTransactionNotFound ||
			appErr.Code == ErrCodeFileNotFound
	}
	return Is(err, ErrNotFound) || Is(err, ErrWalletNotFound) ||
		Is(err, ErrTicketNotFound) || Is(err, ErrFestivalNotFound) ||
		Is(err, ErrStandNotFound) || Is(err, ErrProductNotFound) ||
		Is(err, ErrOrderNotFound) || Is(err, ErrUserNotFound)
}

// IsValidation checks if an error is a validation error
func IsValidation(err error) bool {
	if err == nil {
		return false
	}
	var appErr *AppError
	if As(err, &appErr) {
		return appErr.Kind == KindValidation
	}
	return Is(err, ErrValidation) || Is(err, ErrBadRequest)
}

// IsUnauthorized checks if an error is an unauthorized error
func IsUnauthorized(err error) bool {
	if err == nil {
		return false
	}
	var appErr *AppError
	if As(err, &appErr) {
		return appErr.Kind == KindUnauthorized
	}
	return Is(err, ErrUnauthorized)
}

// IsForbidden checks if an error is a forbidden error
func IsForbidden(err error) bool {
	if err == nil {
		return false
	}
	var appErr *AppError
	if As(err, &appErr) {
		return appErr.Kind == KindForbidden
	}
	return Is(err, ErrForbidden)
}
