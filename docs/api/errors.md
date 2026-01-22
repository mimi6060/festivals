# Error Codes Reference

## Error Response Format

All errors follow a consistent JSON structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Machine-readable error code |
| `message` | string | Human-readable error description |
| `details` | object | Additional context (optional) |

## HTTP Status Codes

| Status | Meaning | Description |
|--------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 204 | No Content | Request succeeded, no content to return |
| 400 | Bad Request | Invalid request format or validation error |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 422 | Unprocessable Entity | Semantic validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

## General Error Codes

### Authentication Errors (401)

| Code | Message | Description |
|------|---------|-------------|
| `UNAUTHORIZED` | Invalid or missing authentication | Token not provided or invalid |
| `TOKEN_EXPIRED` | Access token has expired | Token needs to be refreshed |
| `TOKEN_INVALID` | Invalid token format | Malformed or corrupted token |
| `TOKEN_REVOKED` | Token has been revoked | Token was explicitly revoked |

### Authorization Errors (403)

| Code | Message | Description |
|------|---------|-------------|
| `FORBIDDEN` | Access denied | Not authorized for this action |
| `INSUFFICIENT_PERMISSIONS` | Insufficient permissions | Missing required permission |
| `ROLE_REQUIRED` | Role required | Action requires specific role |
| `RESOURCE_OWNER_ONLY` | Resource owner only | Only owner can access |

### Validation Errors (400)

| Code | Message | Description |
|------|---------|-------------|
| `VALIDATION_ERROR` | Validation failed | Request body validation failed |
| `INVALID_ID` | Invalid ID format | UUID format is invalid |
| `MISSING_REQUIRED_FIELD` | Required field missing | Required field not provided |
| `INVALID_FORMAT` | Invalid format | Field format is incorrect |
| `VALUE_OUT_OF_RANGE` | Value out of range | Numeric value outside limits |
| `INVALID_DATE` | Invalid date format | Date format is incorrect |
| `INVALID_EMAIL` | Invalid email format | Email format is incorrect |

### Not Found Errors (404)

| Code | Message | Description |
|------|---------|-------------|
| `NOT_FOUND` | Resource not found | Generic not found |
| `FESTIVAL_NOT_FOUND` | Festival not found | Festival ID doesn't exist |
| `WALLET_NOT_FOUND` | Wallet not found | Wallet ID doesn't exist |
| `TICKET_NOT_FOUND` | Ticket not found | Ticket ID or code doesn't exist |
| `USER_NOT_FOUND` | User not found | User ID doesn't exist |
| `STAND_NOT_FOUND` | Stand not found | Stand ID doesn't exist |
| `PRODUCT_NOT_FOUND` | Product not found | Product ID doesn't exist |

### Conflict Errors (409)

| Code | Message | Description |
|------|---------|-------------|
| `ALREADY_EXISTS` | Resource already exists | Duplicate resource |
| `DUPLICATE_EMAIL` | Email already registered | User email exists |
| `TAG_EXISTS` | NFC tag already registered | NFC UID registered |
| `ALREADY_ASSIGNED` | Already assigned | Staff already assigned to stand |

## Domain-Specific Error Codes

### Wallet Errors

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `INSUFFICIENT_BALANCE` | 400 | Insufficient wallet balance | Not enough funds for transaction |
| `WALLET_FROZEN` | 403 | Wallet is frozen | Wallet operations disabled |
| `WALLET_INACTIVE` | 400 | Wallet is inactive | Wallet not activated |
| `INVALID_AMOUNT` | 400 | Invalid amount | Amount must be positive |
| `MAX_BALANCE_EXCEEDED` | 400 | Maximum balance exceeded | Would exceed max balance |
| `TOPUP_LIMIT_EXCEEDED` | 400 | Topup limit exceeded | Daily topup limit reached |

### Payment Errors

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `PAYMENT_FAILED` | 400 | Payment processing failed | Generic payment failure |
| `CARD_DECLINED` | 400 | Card was declined | Card payment declined |
| `TRANSACTION_NOT_FOUND` | 404 | Transaction not found | Transaction ID invalid |
| `ALREADY_REFUNDED` | 400 | Transaction already refunded | Cannot refund again |
| `REFUND_EXCEEDED` | 400 | Refund amount exceeds original | Refund too large |
| `STAND_CLOSED` | 400 | Stand is closed | Stand not accepting payments |

### NFC Errors

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `TAG_NOT_FOUND` | 404 | NFC tag not found | Tag UID not registered |
| `TAG_ALREADY_ACTIVE` | 400 | Tag already activated | Cannot reactivate |
| `TAG_BLOCKED` | 403 | Tag is blocked | Tag blocked from use |
| `TAG_INACTIVE` | 400 | Tag is inactive | Tag not activated |
| `ACTIVATION_FAILED` | 400 | Tag activation failed | Could not activate tag |
| `INVALID_UID` | 400 | Invalid NFC UID | UID format is invalid |
| `TOKEN_GENERATION_FAILED` | 500 | Token generation failed | Offline token error |

### Ticket Errors

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `TICKET_NOT_FOUND` | 404 | Ticket not found | Ticket code invalid |
| `TICKET_ALREADY_USED` | 400 | Ticket already used | Ticket was already scanned |
| `TICKET_EXPIRED` | 400 | Ticket has expired | Ticket past validity date |
| `TICKET_CANCELLED` | 400 | Ticket is cancelled | Ticket was cancelled |
| `SOLD_OUT` | 400 | Ticket type sold out | No more tickets available |
| `NOT_AVAILABLE` | 400 | Tickets not available | Sales not open |
| `TRANSFER_NOT_ALLOWED` | 400 | Transfer not allowed | Ticket type non-transferable |
| `MAX_TRANSFERS_EXCEEDED` | 400 | Maximum transfers exceeded | Transfer limit reached |
| `INVALID_SCAN_TYPE` | 400 | Invalid scan type | Must be entry or exit |

### Refund Errors

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `REFUND_NOT_FOUND` | 404 | Refund request not found | Refund ID invalid |
| `REFUND_ALREADY_PROCESSED` | 400 | Refund already processed | Cannot modify |
| `REFUND_REJECTED` | 400 | Refund was rejected | Refund not approved |
| `INVALID_BANK_DETAILS` | 400 | Invalid bank details | IBAN/account invalid |
| `REFUND_PERIOD_ENDED` | 400 | Refund period ended | Too late to request refund |

### Stand Errors

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `STAND_NOT_FOUND` | 404 | Stand not found | Stand ID invalid |
| `STAND_INACTIVE` | 400 | Stand is inactive | Stand not operational |
| `INVALID_PIN` | 401 | Invalid PIN | Staff PIN incorrect |
| `STAFF_ALREADY_ASSIGNED` | 409 | Staff already assigned | Already on this stand |

### Sync Errors

| Code | HTTP | Message | Description |
|------|------|---------|-------------|
| `SYNC_FAILED` | 400 | Sync failed | Batch sync error |
| `INVALID_SIGNATURE` | 400 | Invalid signature | Transaction signature invalid |
| `DUPLICATE_TRANSACTION` | 409 | Duplicate transaction | Transaction already synced |
| `STALE_TRANSACTION` | 400 | Transaction too old | Outside sync window |

## Error Examples

### Validation Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "fields": [
        {
          "field": "email",
          "error": "must be a valid email address"
        },
        {
          "field": "amount",
          "error": "must be greater than 0"
        }
      ]
    }
  }
}
```

### Insufficient Balance

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Wallet has insufficient balance for this transaction",
    "details": {
      "required": 1500,
      "available": 1000,
      "currency": "EUR"
    }
  }
}
```

### Rate Limit Exceeded

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait before retrying.",
    "details": {
      "retryAfter": 60,
      "limit": 100,
      "window": "1 minute"
    }
  }
}
```

## Handling Errors

### Best Practices

1. **Check HTTP status first** - Use status codes for control flow
2. **Parse error codes** - Use `error.code` for programmatic handling
3. **Display messages** - Use `error.message` for user feedback
4. **Log details** - Include `error.details` in logs for debugging
5. **Retry on 5xx** - Server errors may be temporary
6. **Don't retry on 4xx** - Client errors require changes

### JavaScript Example

```javascript
async function apiRequest(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error.message);
    error.code = data.error.code;
    error.details = data.error.details;
    error.status = response.status;
    throw error;
  }

  return data;
}

// Usage
try {
  const result = await apiRequest('/payments', {
    method: 'POST',
    body: JSON.stringify(paymentData)
  });
} catch (error) {
  switch (error.code) {
    case 'INSUFFICIENT_BALANCE':
      showTopUpPrompt(error.details.required - error.details.available);
      break;
    case 'WALLET_FROZEN':
      showContactSupportMessage();
      break;
    default:
      showGenericError(error.message);
  }
}
```

### Go Example

```go
type APIError struct {
    Code    string                 `json:"code"`
    Message string                 `json:"message"`
    Details map[string]interface{} `json:"details"`
}

func handleError(resp *http.Response) error {
    var errResp struct {
        Error APIError `json:"error"`
    }
    json.NewDecoder(resp.Body).Decode(&errResp)

    switch errResp.Error.Code {
    case "INSUFFICIENT_BALANCE":
        return ErrInsufficientBalance
    case "WALLET_FROZEN":
        return ErrWalletFrozen
    default:
        return fmt.Errorf("API error: %s", errResp.Error.Message)
    }
}
```

## Support

If you encounter unexpected errors:
1. Check the error code and message
2. Review the request parameters
3. Check the [API status page](https://status.festivals.io)
4. Contact support@festivals.io with the request ID
