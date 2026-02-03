package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/mimi6060/festivals/backend/internal/middleware"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// TestErrorCodes verifies all error codes have proper HTTP status mappings
func TestErrorCodes(t *testing.T) {
	testCases := []struct {
		code           string
		expectedStatus int
	}{
		// Authentication & Authorization
		{errors.ErrCodeUnauthorized, 401},
		{errors.ErrCodeForbidden, 403},
		{errors.ErrCodeTokenExpired, 401},
		{errors.ErrCodeTokenInvalid, 401},

		// Validation
		{errors.ErrCodeValidation, 400},
		{errors.ErrCodeInvalidInput, 400},
		{errors.ErrCodeInvalidID, 400},
		{errors.ErrCodePayloadTooLarge, 413},

		// Resource
		{errors.ErrCodeNotFound, 404},
		{errors.ErrCodeAlreadyExists, 409},
		{errors.ErrCodeConflict, 409},
		{errors.ErrCodeGone, 410},

		// Business logic
		{errors.ErrCodeInsufficientFunds, 402},
		{errors.ErrCodeWalletFrozen, 422},
		{errors.ErrCodeTicketAlreadyUsed, 409},
		{errors.ErrCodeTicketExpired, 410},
		{errors.ErrCodeOutOfStock, 422},

		// Rate limiting
		{errors.ErrCodeRateLimited, 429},
		{errors.ErrCodeTooManyRequests, 429},

		// External service
		{errors.ErrCodePaymentFailed, 502},
		{errors.ErrCodeServiceUnavailable, 503},

		// Server
		{errors.ErrCodeInternal, 500},
		{errors.ErrCodeDatabaseError, 500},
		{errors.ErrCodeTimeout, 504},
	}

	for _, tc := range testCases {
		t.Run(tc.code, func(t *testing.T) {
			status := errors.GetHTTPStatus(tc.code)
			assert.Equal(t, tc.expectedStatus, status, "Error code %s should map to HTTP status %d", tc.code, tc.expectedStatus)
		})
	}
}

// TestErrorResponseFormat verifies the error response matches the expected format
func TestErrorResponseFormat(t *testing.T) {
	router := setupTestRouter()

	// Add a route that returns an error
	router.GET("/test-error", func(c *gin.Context) {
		err := errors.NewValidationError("Test validation error", map[string]string{
			"email": "Invalid email format",
		})
		middleware.AbortWithAppError(c, err.AppError)
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test-error", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response errors.ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	// Verify response structure
	assert.Equal(t, errors.ErrCodeValidation, response.Error.Code)
	assert.Equal(t, "Test validation error", response.Error.Message)
	assert.NotEmpty(t, response.Error.RequestID)

	// Verify details contain field errors
	assert.NotNil(t, response.Error.Details)
	fields, ok := response.Error.Details["fields"].(map[string]interface{})
	assert.True(t, ok)
	assert.Equal(t, "Invalid email format", fields["email"])
}

// TestNoSensitiveDataInErrors verifies sensitive information is not leaked
func TestNoSensitiveDataInErrors(t *testing.T) {
	router := setupTestRouter()

	// Add a route that returns an error with sensitive details
	router.GET("/test-sensitive", func(c *gin.Context) {
		err := &errors.AppError{
			Code:    errors.ErrCodeInternal,
			Message: "An error occurred",
			Details: map[string]interface{}{
				"password":   "secret123",
				"api_key":    "sk_test_123",
				"token":      "bearer_xyz",
				"safe_field": "this is ok",
			},
		}
		middleware.AbortWithAppError(c, err)
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test-sensitive", nil)
	router.ServeHTTP(w, req)

	body := w.Body.String()

	// Verify sensitive data is not present
	assert.NotContains(t, body, "secret123")
	assert.NotContains(t, body, "sk_test_123")
	assert.NotContains(t, body, "bearer_xyz")

	// Verify safe fields are present
	assert.Contains(t, body, "safe_field")
}

// TestRequestIDPropagation verifies request ID is included in error responses
func TestRequestIDPropagation(t *testing.T) {
	router := setupTestRouter()

	router.GET("/test-request-id", func(c *gin.Context) {
		err := errors.New(errors.ErrCodeNotFound, "Resource not found")
		middleware.AbortWithAppError(c, err)
	})

	// Test with provided request ID
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test-request-id", nil)
	req.Header.Set("X-Request-ID", "test-request-123")
	router.ServeHTTP(w, req)

	var response errors.ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "test-request-123", response.Error.RequestID)
	assert.Equal(t, "test-request-123", w.Header().Get("X-Request-ID"))

	// Test with auto-generated request ID
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/test-request-id", nil)
	router.ServeHTTP(w, req)

	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.NotEmpty(t, response.Error.RequestID)
	assert.Len(t, response.Error.RequestID, 36) // UUID format
}

// TestErrorTypeConversion verifies sentinel errors are properly converted
func TestErrorTypeConversion(t *testing.T) {
	testCases := []struct {
		name         string
		err          error
		expectedCode string
	}{
		{"ErrNotFound", errors.ErrNotFound, errors.ErrCodeNotFound},
		{"ErrUnauthorized", errors.ErrUnauthorized, errors.ErrCodeUnauthorized},
		{"ErrForbidden", errors.ErrForbidden, errors.ErrCodeForbidden},
		{"ErrInsufficientBalance", errors.ErrInsufficientBalance, errors.ErrCodeInsufficientFunds},
		{"ErrTicketAlreadyUsed", errors.ErrTicketAlreadyUsed, errors.ErrCodeTicketAlreadyUsed},
		{"ErrRateLimited", errors.ErrRateLimited, errors.ErrCodeRateLimited},
		{"ErrDatabaseError", errors.ErrDatabaseError, errors.ErrCodeDatabaseError},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			appErr := errors.SentinelToAppError(tc.err)
			require.NotNil(t, appErr)
			assert.Equal(t, tc.expectedCode, appErr.Code)
		})
	}
}

// TestPanicRecovery verifies panic recovery produces proper error responses
func TestPanicRecovery(t *testing.T) {
	router := gin.New()
	router.Use(middleware.RequestID())
	router.Use(middleware.Recovery(middleware.ErrorHandlerConfig{
		Development: false,
		LogErrors:   false,
	}))

	router.GET("/panic", func(c *gin.Context) {
		panic("test panic")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/panic", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var response errors.ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, errors.ErrCodeInternal, response.Error.Code)
	assert.NotEmpty(t, response.Error.RequestID)
	// Should not expose panic details
	assert.NotContains(t, response.Error.Message, "test panic")
}

// TestValidationErrorDetails verifies validation errors include field details
func TestValidationErrorDetails(t *testing.T) {
	router := setupTestRouter()

	router.POST("/validate", func(c *gin.Context) {
		fields := map[string]string{
			"email":    "must be a valid email address",
			"password": "must be at least 8 characters",
			"age":      "must be a positive number",
		}
		err := errors.ValidationErr("Validation failed", fields)
		middleware.AbortWithAppError(c, err)
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/validate", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response errors.ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, errors.ErrCodeValidation, response.Error.Code)
	assert.NotNil(t, response.Error.Details)

	fields, ok := response.Error.Details["fields"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "must be a valid email address", fields["email"])
	assert.Equal(t, "must be at least 8 characters", fields["password"])
	assert.Equal(t, "must be a positive number", fields["age"])
}

// TestErrorKindClassification verifies error kinds are correctly assigned
func TestErrorKindClassification(t *testing.T) {
	testCases := []struct {
		name     string
		appErr   *errors.AppError
		expected errors.ErrorKind
	}{
		{
			"Validation error",
			errors.ValidationErr("invalid input", nil),
			errors.KindValidation,
		},
		{
			"Not found error",
			errors.NotFoundErr("user"),
			errors.KindNotFound,
		},
		{
			"Unauthorized error",
			errors.UnauthorizedErr(""),
			errors.KindUnauthorized,
		},
		{
			"Forbidden error",
			errors.ForbiddenErr(""),
			errors.KindForbidden,
		},
		{
			"Conflict error",
			errors.ConflictErr("duplicate entry"),
			errors.KindConflict,
		},
		{
			"Internal error",
			errors.InternalErr(nil),
			errors.KindInternal,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, tc.appErr.Kind)
		})
	}
}

// TestIsRetryable verifies retryable error detection
func TestIsRetryable(t *testing.T) {
	retryableCodes := []string{
		errors.ErrCodeRateLimited,
		errors.ErrCodeTooManyRequests,
		errors.ErrCodeTimeout,
		errors.ErrCodeServiceUnavailable,
		errors.ErrCodeCircuitOpen,
	}

	nonRetryableCodes := []string{
		errors.ErrCodeValidation,
		errors.ErrCodeNotFound,
		errors.ErrCodeUnauthorized,
		errors.ErrCodeInsufficientFunds,
	}

	for _, code := range retryableCodes {
		assert.True(t, errors.IsRetryable(code), "Code %s should be retryable", code)
	}

	for _, code := range nonRetryableCodes {
		assert.False(t, errors.IsRetryable(code), "Code %s should not be retryable", code)
	}
}

// TestErrorWrapping verifies error wrapping preserves context
func TestErrorWrapping(t *testing.T) {
	baseErr := errors.ErrNotFound
	wrappedErr := errors.Wrap(baseErr, errors.ErrCodeUserNotFound, "User with ID 123 not found")

	assert.Equal(t, errors.ErrCodeUserNotFound, wrappedErr.Code)
	assert.Equal(t, "User with ID 123 not found", wrappedErr.Message)
	assert.True(t, errors.Is(wrappedErr.Err, errors.ErrNotFound))
}

// TestErrorWithDetails verifies error details are properly attached
func TestErrorWithDetails(t *testing.T) {
	err := errors.New(errors.ErrCodeInsufficientFunds, "Insufficient funds").
		WithDetail("required", 100.0).
		WithDetail("available", 50.0)

	assert.Equal(t, 100.0, err.Details["required"])
	assert.Equal(t, 50.0, err.Details["available"])
}

// TestClientVsServerErrors verifies client/server error classification
func TestClientVsServerErrors(t *testing.T) {
	clientErrors := []string{
		errors.ErrCodeValidation,
		errors.ErrCodeNotFound,
		errors.ErrCodeUnauthorized,
		errors.ErrCodeForbidden,
		errors.ErrCodeConflict,
		errors.ErrCodeRateLimited,
	}

	serverErrors := []string{
		errors.ErrCodeInternal,
		errors.ErrCodeDatabaseError,
		errors.ErrCodeServiceUnavailable,
		errors.ErrCodeTimeout,
	}

	for _, code := range clientErrors {
		assert.True(t, errors.IsClientError(code), "Code %s should be a client error", code)
		assert.False(t, errors.IsServerError(code), "Code %s should not be a server error", code)
	}

	for _, code := range serverErrors {
		assert.True(t, errors.IsServerError(code), "Code %s should be a server error", code)
		assert.False(t, errors.IsClientError(code), "Code %s should not be a client error", code)
	}
}

// TestDevelopmentModeDetails verifies development mode includes additional details
func TestDevelopmentModeDetails(t *testing.T) {
	router := gin.New()
	router.Use(middleware.RequestID())
	router.Use(middleware.ErrorHandler(middleware.ErrorHandlerConfig{
		Development:  true,
		IncludeStack: true,
		LogErrors:    false,
	}))

	router.GET("/dev-error", func(c *gin.Context) {
		baseErr := errors.ErrNotFound
		appErr := errors.WrapWithStack(baseErr, errors.ErrCodeNotFound, "Resource not found")
		c.Error(appErr)
		c.Abort()
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/dev-error", nil)
	router.ServeHTTP(w, req)

	// In development mode, we might include more details
	// This test verifies the endpoint still works
	assert.Equal(t, http.StatusNotFound, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	errorObj := response["error"].(map[string]interface{})
	assert.Equal(t, errors.ErrCodeNotFound, errorObj["code"])
}

// TestShouldAlert verifies error alerting classification
func TestShouldAlert(t *testing.T) {
	alertingCodes := []string{
		errors.ErrCodeInternal,
		errors.ErrCodeDatabaseError,
		errors.ErrCodeCacheError,
		errors.ErrCodeExternalService,
		errors.ErrCodeCircuitOpen,
	}

	nonAlertingCodes := []string{
		errors.ErrCodeValidation,
		errors.ErrCodeNotFound,
		errors.ErrCodeUnauthorized,
		errors.ErrCodeRateLimited,
	}

	for _, code := range alertingCodes {
		assert.True(t, errors.ShouldAlert(code), "Code %s should trigger an alert", code)
	}

	for _, code := range nonAlertingCodes {
		assert.False(t, errors.ShouldAlert(code), "Code %s should not trigger an alert", code)
	}
}

// Helper function to setup test router with standard middleware
func setupTestRouter() *gin.Engine {
	router := gin.New()
	router.Use(middleware.RequestID())
	router.Use(middleware.ErrorHandler(middleware.ErrorHandlerConfig{
		Development: false,
		LogErrors:   false,
	}))
	return router
}

// TestAppErrorImplementation verifies AppError implements standard interfaces
func TestAppErrorImplementation(t *testing.T) {
	// Test error interface
	var err error = errors.New(errors.ErrCodeNotFound, "test error")
	assert.NotNil(t, err)
	assert.Contains(t, err.Error(), "test error")

	// Test Unwrap
	baseErr := errors.ErrNotFound
	appErr := errors.Wrap(baseErr, errors.ErrCodeNotFound, "wrapped error")
	assert.True(t, errors.Is(appErr, errors.ErrNotFound))

	// Test As
	var targetErr *errors.AppError
	assert.True(t, errors.As(appErr, &targetErr))
	assert.Equal(t, errors.ErrCodeNotFound, targetErr.Code)
}

// TestErrorHelpers verifies convenience error check functions
func TestErrorHelpers(t *testing.T) {
	notFoundErr := errors.NotFoundErr("user")
	assert.True(t, errors.IsNotFound(notFoundErr))
	assert.False(t, errors.IsValidation(notFoundErr))

	validationErr := errors.ValidationErr("invalid", nil)
	assert.True(t, errors.IsValidation(validationErr))
	assert.False(t, errors.IsNotFound(validationErr))

	unauthorizedErr := errors.UnauthorizedErr("")
	assert.True(t, errors.IsUnauthorized(unauthorizedErr))

	forbiddenErr := errors.ForbiddenErr("")
	assert.True(t, errors.IsForbidden(forbiddenErr))
}

// TestHTTPStatusMapping verifies all error codes have HTTP status mappings
func TestHTTPStatusMapping(t *testing.T) {
	// Get all codes from the CodeToHTTPStatus map
	for code, expectedStatus := range errors.CodeToHTTPStatus {
		status := errors.GetHTTPStatus(code)
		assert.Equal(t, expectedStatus, status,
			"Code %s should map to status %d but got %d", code, expectedStatus, status)
	}

	// Test unknown code defaults to 500
	unknownStatus := errors.GetHTTPStatus("UNKNOWN_CODE")
	assert.Equal(t, 500, unknownStatus)
}

// TestStackTraceCapture verifies stack trace capture functionality
func TestStackTraceCapture(t *testing.T) {
	err := errors.NewWithStack(errors.ErrCodeInternal, "test error")

	assert.NotEmpty(t, err.Stack)
	assert.Contains(t, err.Stack, "TestStackTraceCapture")
}

// TestJoinErrors verifies error joining functionality
func TestJoinErrors(t *testing.T) {
	err1 := errors.New(errors.ErrCodeValidation, "error 1")
	err2 := errors.New(errors.ErrCodeValidation, "error 2")

	joined := errors.Join(err1, err2)
	assert.NotNil(t, joined)
	assert.Contains(t, joined.Error(), "error 1")
	assert.Contains(t, joined.Error(), "error 2")

	// Test with nil errors
	nilJoined := errors.Join(nil, nil)
	assert.Nil(t, nilJoined)

	// Test with single error
	singleJoined := errors.Join(err1, nil)
	assert.Equal(t, err1, singleJoined)
}
