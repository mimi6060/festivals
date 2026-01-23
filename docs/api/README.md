# Festivals Platform API Documentation

## Overview

The Festivals Platform API provides a RESTful interface for managing music festivals, including ticketing, cashless payments (wallets), stands/vendors, products, and lineup management.

## Base URL

```
Production: https://api.festivals.app/api/v1
Staging:    https://api-staging.festivals.app/api/v1
Local:      http://localhost:8080/api/v1
```

## API Version

Current version: `v1`

All endpoints are prefixed with `/api/v1/`.

---

## Authentication

The API uses **JWT (JSON Web Token)** authentication via **Auth0**.

### Request Headers

All protected endpoints require the `Authorization` header with a Bearer token:

```http
Authorization: Bearer <access_token>
```

### Obtaining an Access Token

Access tokens are obtained through Auth0's authentication flow:

1. **User Login**: Users authenticate via the mobile app or web admin portal
2. **Token Exchange**: Auth0 returns an access token
3. **API Requests**: Include the token in the Authorization header

### Token Claims

The JWT contains the following custom claims:

| Claim | Description |
|-------|-------------|
| `sub` | User ID (UUID) |
| `https://festivals.app/roles` | Array of user roles |
| `https://festivals.app/festival_id` | Current festival context (if applicable) |
| `permissions` | Array of permissions |
| `scope` | OAuth scopes |

### User Roles

| Role | Description |
|------|-------------|
| `admin` | Platform administrator |
| `organizer` | Festival organizer |
| `staff` | Festival staff member |
| `user` | Regular attendee |

### Example Request

```bash
curl -X GET "https://api.festivals.app/api/v1/me" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Error Handling

All errors follow a consistent JSON format:

### Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Error Fields

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Machine-readable error code |
| `message` | string | Human-readable error description |
| `details` | object | Additional error context (optional) |

### HTTP Status Codes

| Status | Description |
|--------|-------------|
| `200 OK` | Request succeeded |
| `201 Created` | Resource created successfully |
| `204 No Content` | Request succeeded, no content to return |
| `400 Bad Request` | Invalid request (validation error, bad format) |
| `401 Unauthorized` | Missing or invalid authentication |
| `403 Forbidden` | Authenticated but not authorized |
| `404 Not Found` | Resource not found |
| `409 Conflict` | Resource conflict (duplicate, etc.) |
| `500 Internal Server Error` | Server error |

### Common Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `INVALID_ID` | Invalid UUID format |
| `NOT_FOUND` | Resource not found |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Permission denied |
| `ALREADY_EXISTS` | Resource already exists |
| `INSUFFICIENT_BALANCE` | Wallet balance too low |
| `WALLET_FROZEN` | Wallet is frozen |
| `INTERNAL_ERROR` | Internal server error |

### Error Examples

**Validation Error (400)**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": "Key: 'CreateFestivalRequest.Name' Error:Field validation for 'Name' failed on the 'required' tag"
  }
}
```

**Not Found (404)**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Festival not found"
  }
}
```

**Unauthorized (401)**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid token"
  }
}
```

---

## Pagination

List endpoints support pagination using query parameters.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `per_page` | integer | 20 | Items per page (max: 100) |

### Paginated Response Format

```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "per_page": 20
  }
}
```

### Meta Fields

| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total number of items |
| `page` | integer | Current page number |
| `per_page` | integer | Items per page |

### Example Request

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals?page=2&per_page=10" \
  -H "Authorization: Bearer <token>"
```

### Calculating Pagination

- **Total Pages**: `ceil(total / per_page)`
- **Has Next**: `page * per_page < total`
- **Has Previous**: `page > 1`

---

## Rate Limiting

The API implements rate limiting to ensure fair usage and protect against abuse.

### Rate Limits

| Tier | Requests/Minute | Requests/Hour |
|------|-----------------|---------------|
| Anonymous | 60 | 600 |
| Authenticated | 300 | 3,000 |
| Staff | 600 | 6,000 |
| Admin | 1,200 | 12,000 |

### Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1609459200
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed |
| `X-RateLimit-Remaining` | Requests remaining in window |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |

### Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later."
  }
}
```

---

## Common Response Formats

### Success Response (Single Resource)

```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Example Resource",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Success Response (List)

```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Resource 1"
    },
    {
      "id": "223e4567-e89b-12d3-a456-426614174001",
      "name": "Resource 2"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "per_page": 20
  }
}
```

---

## Request/Response Content Types

All requests and responses use JSON:

```http
Content-Type: application/json
Accept: application/json
```

---

## CORS (Cross-Origin Resource Sharing)

The API supports CORS for browser-based clients:

- Allowed origins: Configured per environment
- Allowed methods: GET, POST, PATCH, DELETE, OPTIONS
- Allowed headers: Authorization, Content-Type, X-Request-ID
- Exposed headers: X-RateLimit-*, X-Request-ID

---

## Request IDs

Every request is assigned a unique request ID for tracking and debugging:

```http
X-Request-ID: req_abc123xyz
```

Include this ID when reporting issues to support.

---

## Health Check

Check API availability:

```bash
curl -X GET "https://api.festivals.app/health"
```

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

---

## Interactive Documentation

Access the Swagger UI for interactive API exploration:

- **Local**: [http://localhost:8080/swagger/index.html](http://localhost:8080/swagger/index.html)
- **Staging**: [https://api-staging.festivals.app/swagger/index.html](https://api-staging.festivals.app/swagger/index.html)
- **Production**: [https://api.festivals.app/swagger/index.html](https://api.festivals.app/swagger/index.html)

---

## OpenAPI Specification

Download the OpenAPI 3.0 specification:

- [openapi.yaml](./openapi.yaml) - OpenAPI 3.0 specification

---

## API Documentation Files

### Endpoint Documentation

| Document | Description |
|----------|-------------|
| [endpoints/festivals.md](./endpoints/festivals.md) | Festival management endpoints |
| [endpoints/wallets.md](./endpoints/wallets.md) | Wallet and payment endpoints |
| [endpoints/tickets.md](./endpoints/tickets.md) | Ticket management endpoints |
| [endpoints/stands.md](./endpoints/stands.md) | Stand/vendor endpoints |
| [endpoints/products.md](./endpoints/products.md) | Product management endpoints |
| [endpoints/orders.md](./endpoints/orders.md) | Order management endpoints |

### Legacy Endpoint Docs (Detailed)

| Document | Description |
|----------|-------------|
| [festivals.md](./festivals.md) | Festival management (detailed) |
| [wallets.md](./wallets.md) | Wallet and payments (detailed) |
| [tickets.md](./tickets.md) | Ticket management (detailed) |
| [stands.md](./stands.md) | Stand/vendor (detailed) |
| [products.md](./products.md) | Product management (detailed) |
| [lineup.md](./lineup.md) | Artist and lineup endpoints |

### Guides and References

| Document | Description |
|----------|-------------|
| [authentication.md](./authentication.md) | Authentication guide |
| [errors.md](./errors.md) | Error codes reference |
| [webhooks.md](./webhooks.md) | Webhook configuration |
| [rate-limiting.md](./rate-limiting.md) | Rate limiting details |
| [examples/common-operations.md](./examples/common-operations.md) | cURL examples |

---

## Postman Collection

Import the Postman collection for easy API testing:

- [Festivals.postman_collection.json](./postman/Festivals.postman_collection.json)

---

## SDKs and Libraries

- **JavaScript/TypeScript**: `@festivals/api-client`
- **React Native**: `@festivals/mobile-sdk`
- **Go**: `github.com/mimi6060/festivals/sdk/go`

---

## Support

For API support:
- Email: api-support@festivals.app
- Documentation: https://docs.festivals.app
- Status Page: https://status.festivals.app
