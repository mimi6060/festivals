# API Error Handling

This document describes the error handling conventions used throughout the Festivals API.

## Error Response Format

All API errors follow a standardized JSON format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {},
    "request_id": "uuid"
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Machine-readable error code (e.g., `VALIDATION_ERROR`) |
| `message` | string | Human-readable error description |
| `details` | object | Additional context (optional, varies by error type) |
| `request_id` | string | Unique request identifier for debugging |

## Error Codes Reference

### Authentication & Authorization Errors (HTTP 401, 403)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required or invalid credentials |
| `FORBIDDEN` | 403 | Authenticated but not authorized for this action |
| `TOKEN_EXPIRED` | 401 | JWT token has expired |
| `TOKEN_INVALID` | 401 | JWT token is malformed or invalid |
| `SESSION_EXPIRED` | 401 | User session has expired |
| `INVALID_CREDENTIALS` | 401 | Username/password combination is incorrect |
| `ACCOUNT_LOCKED` | 403 | Account is temporarily locked |
| `ACCOUNT_BANNED` | 403 | Account has been banned |
| `MFA_REQUIRED` | 401 | Multi-factor authentication required |
| `MFA_INVALID` | 401 | MFA code is invalid |

### Validation Errors (HTTP 400)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | General validation failure |
| `INVALID_INPUT` | 400 | Request input is invalid |
| `MISSING_FIELD` | 400 | Required field is missing |
| `INVALID_FORMAT` | 400 | Field format is invalid |
| `INVALID_ID` | 400 | ID parameter is invalid |
| `INVALID_UUID` | 400 | UUID format is invalid |
| `INVALID_EMAIL` | 400 | Email format is invalid |
| `INVALID_PHONE` | 400 | Phone number format is invalid |
| `INVALID_DATE` | 400 | Date format is invalid |
| `INVALID_RANGE` | 400 | Value is outside allowed range |
| `INVALID_ROLE` | 400 | Role value is invalid |
| `INVALID_STATUS` | 400 | Status value is invalid |
| `INVALID_AMOUNT` | 400 | Amount value is invalid |
| `PAYLOAD_TOO_LARGE` | 413 | Request payload exceeds limit |

#### Validation Error Details

Validation errors include field-specific details:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "email": "must be a valid email address",
        "password": "must be at least 8 characters",
        "age": "must be a positive number"
      }
    },
    "request_id": "abc123"
  }
}
```

### Resource Errors (HTTP 404, 409, 410)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Requested resource not found |
| `ALREADY_EXISTS` | 409 | Resource already exists |
| `CONFLICT` | 409 | Operation conflicts with current state |
| `RESOURCE_LOCKED` | 423 | Resource is locked |
| `GONE` | 410 | Resource no longer exists |
| `RESOURCE_EXPIRED` | 410 | Resource has expired |

### Business Logic Errors (HTTP 402, 409, 422)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INSUFFICIENT_FUNDS` | 402 | Wallet balance is insufficient |
| `WALLET_FROZEN` | 422 | Wallet is frozen |
| `WALLET_INACTIVE` | 422 | Wallet is not active |
| `TRANSACTION_FAILED` | 422 | Transaction processing failed |
| `DUPLICATE_TRANSACTION` | 409 | Transaction already processed |
| `TRANSACTION_NOT_FOUND` | 404 | Transaction not found |
| `REFUND_NOT_ALLOWED` | 422 | Refund is not allowed |
| `TICKET_NOT_FOUND` | 404 | Ticket not found |
| `TICKET_ALREADY_USED` | 409 | Ticket has already been scanned |
| `TICKET_EXPIRED` | 410 | Ticket has expired |
| `TICKET_INVALID` | 400 | Ticket is invalid |
| `FESTIVAL_NOT_FOUND` | 404 | Festival not found |
| `FESTIVAL_CLOSED` | 422 | Festival is not active |
| `FESTIVAL_NOT_STARTED` | 422 | Festival has not started yet |
| `STAND_NOT_FOUND` | 404 | Stand not found |
| `STAND_CLOSED` | 422 | Stand is currently closed |
| `PRODUCT_NOT_FOUND` | 404 | Product not found |
| `PRODUCT_UNAVAILABLE` | 422 | Product is not available |
| `OUT_OF_STOCK` | 422 | Product is out of stock |
| `ORDER_NOT_FOUND` | 404 | Order not found |
| `ORDER_CANCELLED` | 409 | Order has been cancelled |
| `QR_CODE_EXPIRED` | 410 | QR code has expired |
| `QR_CODE_INVALID` | 400 | QR code is invalid |
| `USER_NOT_FOUND` | 404 | User not found |
| `USER_BANNED` | 403 | User account is banned |
| `NOT_BANNED` | 400 | User is not banned |
| `CAPACITY_EXCEEDED` | 422 | Venue capacity exceeded |
| `BOOKING_NOT_ALLOWED` | 422 | Booking is not allowed |

#### Insufficient Funds Error Details

```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Insufficient funds to complete the transaction",
    "details": {
      "required": 50.00,
      "available": 25.00,
      "shortage": 25.00
    },
    "request_id": "abc123"
  }
}
```

### Rate Limiting Errors (HTTP 429)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `RATE_LIMITED` | 429 | Too many requests |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `QUOTA_EXCEEDED` | 429 | API quota exceeded |
| `CONCURRENCY_LIMIT` | 429 | Concurrent request limit reached |
| `DAILY_LIMIT_EXCEEDED` | 429 | Daily request limit exceeded |

#### Rate Limit Error Details

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "retry_after": 60,
      "limit": 100,
      "remaining": 0
    },
    "request_id": "abc123"
  }
}
```

The `Retry-After` header is also set with the number of seconds to wait.

### External Service Errors (HTTP 502, 503)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `PAYMENT_FAILED` | 502 | Payment processing failed |
| `PAYMENT_DECLINED` | 422 | Payment was declined |
| `PAYMENT_PROCESSING` | 202 | Payment is being processed |
| `EMAIL_FAILED` | 502 | Email delivery failed |
| `SMS_FAILED` | 502 | SMS delivery failed |
| `NOTIFICATION_FAILED` | 502 | Push notification failed |
| `STORAGE_FAILED` | 502 | Storage operation failed |
| `EXTERNAL_SERVICE_ERROR` | 502 | External service error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `INTEGRATION_ERROR` | 502 | Third-party integration error |
| `WEBHOOK_FAILED` | 502 | Webhook delivery failed |
| `API_KEY_INVALID` | 401 | API key is invalid |
| `API_KEY_EXPIRED` | 401 | API key has expired |
| `API_KEY_REVOKED` | 401 | API key has been revoked |

### Server Errors (HTTP 500, 503, 504)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INTERNAL_ERROR` | 500 | Internal server error |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `CACHE_ERROR` | 500 | Cache operation failed |
| `TIMEOUT` | 504 | Operation timed out |
| `UNAVAILABLE` | 503 | Service unavailable |
| `MAINTENANCE_MODE` | 503 | System under maintenance |
| `CIRCUIT_OPEN` | 503 | Circuit breaker is open |
| `RESOURCE_EXHAUSTED` | 503 | Server resources exhausted |

### File/Upload Errors (HTTP 400, 413)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `FILE_NOT_FOUND` | 404 | File not found |
| `FILE_TOO_LARGE` | 413 | File exceeds size limit |
| `INVALID_FILE_TYPE` | 400 | File type not allowed |
| `UPLOAD_FAILED` | 500 | File upload failed |
| `PROCESSING_FAILED` | 500 | File processing failed |

## Handling Errors

### Client-Side Best Practices

1. **Always check the `code` field** for programmatic error handling
2. **Display the `message` field** to users (it's user-friendly)
3. **Log the `request_id`** for debugging and support requests
4. **Check `details`** for additional context (validation errors, amounts, etc.)

### Retryable Errors

The following error codes indicate transient failures that may succeed on retry:

- `RATE_LIMITED`
- `TOO_MANY_REQUESTS`
- `TIMEOUT`
- `SERVICE_UNAVAILABLE`
- `UNAVAILABLE`
- `CIRCUIT_OPEN`
- `RESOURCE_EXHAUSTED`
- `CONCURRENCY_LIMIT`

Implement exponential backoff when retrying these errors.

### Example Error Handling (JavaScript)

```javascript
async function makeRequest(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.json();

    switch (error.error.code) {
      case 'UNAUTHORIZED':
      case 'TOKEN_EXPIRED':
        // Redirect to login
        redirectToLogin();
        break;

      case 'VALIDATION_ERROR':
        // Show field errors
        showFieldErrors(error.error.details.fields);
        break;

      case 'RATE_LIMITED':
        // Wait and retry
        const retryAfter = error.error.details.retry_after || 60;
        await sleep(retryAfter * 1000);
        return makeRequest(url, options);

      case 'INSUFFICIENT_FUNDS':
        // Show balance information
        showInsufficientFunds(error.error.details);
        break;

      default:
        // Show generic error message
        showError(error.error.message);
    }

    // Log for debugging
    console.error('API Error:', error.error.code, error.error.request_id);
    throw new ApiError(error.error);
  }

  return response.json();
}
```

### Example Error Handling (Go)

```go
func handleAPIError(resp *http.Response) error {
    var errResp errors.ErrorResponse
    if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
        return fmt.Errorf("failed to decode error response: %w", err)
    }

    switch errResp.Error.Code {
    case errors.ErrCodeUnauthorized, errors.ErrCodeTokenExpired:
        return refreshTokenAndRetry()

    case errors.ErrCodeRateLimited:
        retryAfter := errResp.Error.Details["retry_after"].(float64)
        time.Sleep(time.Duration(retryAfter) * time.Second)
        return retryRequest()

    case errors.ErrCodeValidation:
        return ValidationError{Fields: errResp.Error.Details["fields"]}

    default:
        return fmt.Errorf("API error [%s]: %s (request_id: %s)",
            errResp.Error.Code,
            errResp.Error.Message,
            errResp.Error.RequestID)
    }
}
```

## Request ID

Every API response includes a `request_id` in the error response and the `X-Request-ID` header. Use this ID when:

1. Contacting support about an error
2. Searching logs for debugging
3. Correlating errors across services

You can also provide your own request ID by including the `X-Request-ID` header in your request.

## Development vs Production

In development mode, error responses may include additional debugging information:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "details": {},
    "request_id": "abc123",
    "stack": [
      "main.handleRequest (handler.go:42)",
      "service.ProcessOrder (service.go:156)"
    ],
    "debug_info": "database connection timeout after 30s"
  }
}
```

**Never expose stack traces or debug information in production.**

## Error Monitoring

Critical errors (5xx) are automatically reported to our error tracking system (Sentry). The following information is captured:

- Error code and message
- Request ID
- User ID (if authenticated)
- Festival ID (if applicable)
- Request method and path
- Stack trace
- Additional context

## Best Practices for API Consumers

1. **Don't rely on HTTP status codes alone** - Always check the error `code` field
2. **Implement proper retry logic** with exponential backoff for transient errors
3. **Handle authentication errors gracefully** - Implement token refresh flows
4. **Display user-friendly messages** - Use the `message` field for user-facing errors
5. **Log request IDs** - Always log the `request_id` for debugging
6. **Check details for context** - Validation errors, amounts, limits are in `details`
