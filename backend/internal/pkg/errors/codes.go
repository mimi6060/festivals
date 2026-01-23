package errors

// Error codes for standardized API responses
const (
	// Authentication & Authorization errors (1xxx)
	ErrCodeUnauthorized       = "UNAUTHORIZED"
	ErrCodeForbidden          = "FORBIDDEN"
	ErrCodeTokenExpired       = "TOKEN_EXPIRED"
	ErrCodeTokenInvalid       = "TOKEN_INVALID"
	ErrCodeSessionExpired     = "SESSION_EXPIRED"
	ErrCodeInvalidCredentials = "INVALID_CREDENTIALS"
	ErrCodeAccountLocked      = "ACCOUNT_LOCKED"
	ErrCodeAccountBanned      = "ACCOUNT_BANNED"
	ErrCodeMFARequired        = "MFA_REQUIRED"
	ErrCodeMFAInvalid         = "MFA_INVALID"

	// Validation errors (2xxx)
	ErrCodeValidation      = "VALIDATION_ERROR"
	ErrCodeInvalidInput    = "INVALID_INPUT"
	ErrCodeMissingField    = "MISSING_FIELD"
	ErrCodeInvalidFormat   = "INVALID_FORMAT"
	ErrCodeInvalidID       = "INVALID_ID"
	ErrCodeInvalidUUID     = "INVALID_UUID"
	ErrCodeInvalidEmail    = "INVALID_EMAIL"
	ErrCodeInvalidPhone    = "INVALID_PHONE"
	ErrCodeInvalidDate     = "INVALID_DATE"
	ErrCodeInvalidRange    = "INVALID_RANGE"
	ErrCodeInvalidRole     = "INVALID_ROLE"
	ErrCodeInvalidStatus   = "INVALID_STATUS"
	ErrCodeInvalidAmount   = "INVALID_AMOUNT"
	ErrCodePayloadTooLarge = "PAYLOAD_TOO_LARGE"

	// Resource errors (3xxx)
	ErrCodeNotFound        = "NOT_FOUND"
	ErrCodeAlreadyExists   = "ALREADY_EXISTS"
	ErrCodeConflict        = "CONFLICT"
	ErrCodeResourceLocked  = "RESOURCE_LOCKED"
	ErrCodeGone            = "GONE"
	ErrCodeResourceExpired = "RESOURCE_EXPIRED"

	// Business logic errors (4xxx)
	ErrCodeInsufficientFunds    = "INSUFFICIENT_FUNDS"
	ErrCodeWalletFrozen         = "WALLET_FROZEN"
	ErrCodeWalletInactive       = "WALLET_INACTIVE"
	ErrCodeTransactionFailed    = "TRANSACTION_FAILED"
	ErrCodeDuplicateTransaction = "DUPLICATE_TRANSACTION"
	ErrCodeTransactionNotFound  = "TRANSACTION_NOT_FOUND"
	ErrCodeRefundNotAllowed     = "REFUND_NOT_ALLOWED"
	ErrCodeTicketNotFound       = "TICKET_NOT_FOUND"
	ErrCodeTicketAlreadyUsed    = "TICKET_ALREADY_USED"
	ErrCodeTicketExpired        = "TICKET_EXPIRED"
	ErrCodeTicketInvalid        = "TICKET_INVALID"
	ErrCodeFestivalNotFound     = "FESTIVAL_NOT_FOUND"
	ErrCodeFestivalClosed       = "FESTIVAL_CLOSED"
	ErrCodeFestivalNotStarted   = "FESTIVAL_NOT_STARTED"
	ErrCodeStandNotFound        = "STAND_NOT_FOUND"
	ErrCodeStandClosed          = "STAND_CLOSED"
	ErrCodeProductNotFound      = "PRODUCT_NOT_FOUND"
	ErrCodeProductUnavailable   = "PRODUCT_UNAVAILABLE"
	ErrCodeOutOfStock           = "OUT_OF_STOCK"
	ErrCodeOrderNotFound        = "ORDER_NOT_FOUND"
	ErrCodeOrderCancelled       = "ORDER_CANCELLED"
	ErrCodeQRCodeExpired        = "QR_CODE_EXPIRED"
	ErrCodeQRCodeInvalid        = "QR_CODE_INVALID"
	ErrCodeUserNotFound         = "USER_NOT_FOUND"
	ErrCodeUserBanned           = "USER_BANNED"
	ErrCodeNotBanned            = "NOT_BANNED"
	ErrCodeCapacityExceeded     = "CAPACITY_EXCEEDED"
	ErrCodeBookingNotAllowed    = "BOOKING_NOT_ALLOWED"

	// Rate limiting errors (5xxx)
	ErrCodeRateLimited        = "RATE_LIMITED"
	ErrCodeTooManyRequests    = "TOO_MANY_REQUESTS"
	ErrCodeQuotaExceeded      = "QUOTA_EXCEEDED"
	ErrCodeConcurrencyLimit   = "CONCURRENCY_LIMIT"
	ErrCodeDailyLimitExceeded = "DAILY_LIMIT_EXCEEDED"

	// External service errors (6xxx)
	ErrCodePaymentFailed       = "PAYMENT_FAILED"
	ErrCodePaymentDeclined     = "PAYMENT_DECLINED"
	ErrCodePaymentProcessing   = "PAYMENT_PROCESSING"
	ErrCodeEmailFailed         = "EMAIL_FAILED"
	ErrCodeSMSFailed           = "SMS_FAILED"
	ErrCodeNotificationFailed  = "NOTIFICATION_FAILED"
	ErrCodeStorageFailed       = "STORAGE_FAILED"
	ErrCodeExternalService     = "EXTERNAL_SERVICE_ERROR"
	ErrCodeServiceUnavailable  = "SERVICE_UNAVAILABLE"
	ErrCodeIntegrationError    = "INTEGRATION_ERROR"
	ErrCodeWebhookFailed       = "WEBHOOK_FAILED"
	ErrCodeAPIKeyInvalid       = "API_KEY_INVALID"
	ErrCodeAPIKeyExpired       = "API_KEY_EXPIRED"
	ErrCodeAPIKeyRevoked       = "API_KEY_REVOKED"

	// Server errors (7xxx)
	ErrCodeInternal         = "INTERNAL_ERROR"
	ErrCodeDatabaseError    = "DATABASE_ERROR"
	ErrCodeCacheError       = "CACHE_ERROR"
	ErrCodeTimeout          = "TIMEOUT"
	ErrCodeUnavailable      = "UNAVAILABLE"
	ErrCodeMaintenanceMode  = "MAINTENANCE_MODE"
	ErrCodeCircuitOpen      = "CIRCUIT_OPEN"
	ErrCodeResourceExhausted = "RESOURCE_EXHAUSTED"

	// File/Upload errors (8xxx)
	ErrCodeFileNotFound     = "FILE_NOT_FOUND"
	ErrCodeFileTooLarge     = "FILE_TOO_LARGE"
	ErrCodeInvalidFileType  = "INVALID_FILE_TYPE"
	ErrCodeUploadFailed     = "UPLOAD_FAILED"
	ErrCodeProcessingFailed = "PROCESSING_FAILED"
)

// HTTP status code mapping
var CodeToHTTPStatus = map[string]int{
	// Authentication & Authorization (401, 403)
	ErrCodeUnauthorized:       401,
	ErrCodeForbidden:          403,
	ErrCodeTokenExpired:       401,
	ErrCodeTokenInvalid:       401,
	ErrCodeSessionExpired:     401,
	ErrCodeInvalidCredentials: 401,
	ErrCodeAccountLocked:      403,
	ErrCodeAccountBanned:      403,
	ErrCodeMFARequired:        401,
	ErrCodeMFAInvalid:         401,

	// Validation (400)
	ErrCodeValidation:      400,
	ErrCodeInvalidInput:    400,
	ErrCodeMissingField:    400,
	ErrCodeInvalidFormat:   400,
	ErrCodeInvalidID:       400,
	ErrCodeInvalidUUID:     400,
	ErrCodeInvalidEmail:    400,
	ErrCodeInvalidPhone:    400,
	ErrCodeInvalidDate:     400,
	ErrCodeInvalidRange:    400,
	ErrCodeInvalidRole:     400,
	ErrCodeInvalidStatus:   400,
	ErrCodeInvalidAmount:   400,
	ErrCodePayloadTooLarge: 413,

	// Resource (404, 409, 410)
	ErrCodeNotFound:        404,
	ErrCodeAlreadyExists:   409,
	ErrCodeConflict:        409,
	ErrCodeResourceLocked:  423,
	ErrCodeGone:            410,
	ErrCodeResourceExpired: 410,

	// Business logic (400, 402, 409, 422)
	ErrCodeInsufficientFunds:    402,
	ErrCodeWalletFrozen:         422,
	ErrCodeWalletInactive:       422,
	ErrCodeTransactionFailed:    422,
	ErrCodeDuplicateTransaction: 409,
	ErrCodeTransactionNotFound:  404,
	ErrCodeRefundNotAllowed:     422,
	ErrCodeTicketNotFound:       404,
	ErrCodeTicketAlreadyUsed:    409,
	ErrCodeTicketExpired:        410,
	ErrCodeTicketInvalid:        400,
	ErrCodeFestivalNotFound:     404,
	ErrCodeFestivalClosed:       422,
	ErrCodeFestivalNotStarted:   422,
	ErrCodeStandNotFound:        404,
	ErrCodeStandClosed:          422,
	ErrCodeProductNotFound:      404,
	ErrCodeProductUnavailable:   422,
	ErrCodeOutOfStock:           422,
	ErrCodeOrderNotFound:        404,
	ErrCodeOrderCancelled:       409,
	ErrCodeQRCodeExpired:        410,
	ErrCodeQRCodeInvalid:        400,
	ErrCodeUserNotFound:         404,
	ErrCodeUserBanned:           403,
	ErrCodeNotBanned:            400,
	ErrCodeCapacityExceeded:     422,
	ErrCodeBookingNotAllowed:    422,

	// Rate limiting (429)
	ErrCodeRateLimited:        429,
	ErrCodeTooManyRequests:    429,
	ErrCodeQuotaExceeded:      429,
	ErrCodeConcurrencyLimit:   429,
	ErrCodeDailyLimitExceeded: 429,

	// External service (502, 503)
	ErrCodePaymentFailed:       502,
	ErrCodePaymentDeclined:     422,
	ErrCodePaymentProcessing:   202,
	ErrCodeEmailFailed:         502,
	ErrCodeSMSFailed:           502,
	ErrCodeNotificationFailed:  502,
	ErrCodeStorageFailed:       502,
	ErrCodeExternalService:     502,
	ErrCodeServiceUnavailable:  503,
	ErrCodeIntegrationError:    502,
	ErrCodeWebhookFailed:       502,
	ErrCodeAPIKeyInvalid:       401,
	ErrCodeAPIKeyExpired:       401,
	ErrCodeAPIKeyRevoked:       401,

	// Server (500, 503)
	ErrCodeInternal:          500,
	ErrCodeDatabaseError:     500,
	ErrCodeCacheError:        500,
	ErrCodeTimeout:           504,
	ErrCodeUnavailable:       503,
	ErrCodeMaintenanceMode:   503,
	ErrCodeCircuitOpen:       503,
	ErrCodeResourceExhausted: 503,

	// File/Upload (400, 413)
	ErrCodeFileNotFound:     404,
	ErrCodeFileTooLarge:     413,
	ErrCodeInvalidFileType:  400,
	ErrCodeUploadFailed:     500,
	ErrCodeProcessingFailed: 500,
}

// GetHTTPStatus returns the HTTP status code for an error code
func GetHTTPStatus(code string) int {
	if status, ok := CodeToHTTPStatus[code]; ok {
		return status
	}
	return 500 // Default to internal server error
}

// IsClientError returns true if the error code represents a client error (4xx)
func IsClientError(code string) bool {
	status := GetHTTPStatus(code)
	return status >= 400 && status < 500
}

// IsServerError returns true if the error code represents a server error (5xx)
func IsServerError(code string) bool {
	status := GetHTTPStatus(code)
	return status >= 500
}

// IsRetryable returns true if the error is potentially retryable
func IsRetryable(code string) bool {
	switch code {
	case ErrCodeRateLimited, ErrCodeTooManyRequests, ErrCodeTimeout,
		ErrCodeServiceUnavailable, ErrCodeUnavailable, ErrCodeCircuitOpen,
		ErrCodeResourceExhausted, ErrCodeConcurrencyLimit:
		return true
	default:
		return false
	}
}

// ShouldAlert returns true if the error should trigger an alert
func ShouldAlert(code string) bool {
	switch code {
	case ErrCodeInternal, ErrCodeDatabaseError, ErrCodeCacheError,
		ErrCodeExternalService, ErrCodeCircuitOpen:
		return true
	default:
		return IsServerError(code)
	}
}
