package errors

import "errors"

var (
	// Auth errors
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")

	// Resource errors
	ErrNotFound      = errors.New("resource not found")
	ErrAlreadyExists = errors.New("resource already exists")

	// Validation errors
	ErrValidation = errors.New("validation error")

	// Business logic errors
	ErrInsufficientBalance   = errors.New("insufficient balance")
	ErrWalletNotFound        = errors.New("wallet not found")
	ErrTicketNotFound        = errors.New("ticket not found")
	ErrTicketAlreadyUsed     = errors.New("ticket already used")
	ErrTicketExpired         = errors.New("ticket expired")
	ErrFestivalNotFound      = errors.New("festival not found")
	ErrDuplicateTransaction  = errors.New("duplicate transaction")
	ErrTransactionNotAllowed = errors.New("transaction not allowed")

	// External service errors
	ErrPaymentFailed  = errors.New("payment failed")
	ErrEmailFailed    = errors.New("email sending failed")
	ErrExternalService = errors.New("external service error")
)

// AppError is a custom error type with additional context
type AppError struct {
	Err     error
	Code    string
	Message string
	Details map[string]interface{}
}

func (e *AppError) Error() string {
	return e.Message
}

func (e *AppError) Unwrap() error {
	return e.Err
}

func New(code, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
	}
}

func Wrap(err error, code, message string) *AppError {
	return &AppError{
		Err:     err,
		Code:    code,
		Message: message,
	}
}

func (e *AppError) WithDetails(details map[string]interface{}) *AppError {
	e.Details = details
	return e
}
