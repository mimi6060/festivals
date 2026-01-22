# Authentication Guide

## Overview

The Festivals API supports multiple authentication methods to accommodate different use cases:

1. **JWT Bearer Token** - For user and admin authentication
2. **API Key** - For external integrations and webhooks
3. **OAuth 2.0** - For third-party applications

## JWT Bearer Token

### Obtaining a Token

Users obtain JWT tokens through the login endpoint:

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

### Using the Token

Include the token in the Authorization header:

```bash
curl -X GET https://api.festivals.io/v1/me \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Token Structure

The JWT contains the following claims:

| Claim | Description |
|-------|-------------|
| `sub` | User ID (UUID) |
| `email` | User email address |
| `roles` | Array of user roles |
| `permissions` | Array of granted permissions |
| `festival_id` | Current festival context (optional) |
| `exp` | Token expiration timestamp |
| `iat` | Token issued at timestamp |

### Token Refresh

Refresh expired tokens without re-authentication:

```bash
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

**Response:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

### Token Expiration

| Token Type | Validity |
|------------|----------|
| Access Token | 1 hour |
| Refresh Token | 7 days |

## API Key Authentication

### Creating an API Key

API keys are created through the admin dashboard or API:

```bash
POST /festivals/{festivalId}/api/keys
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "My Integration",
  "permissions": ["read:wallets", "write:payments"],
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "My Integration",
    "key": "fst_live_abc123xyz789...",
    "keyPrefix": "fst_live_abc123",
    "permissions": ["read:wallets", "write:payments"],
    "expiresAt": "2025-12-31T23:59:59Z",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Important:** The full API key is only shown once. Store it securely.

### Using API Keys

Include the API key in the X-API-Key header:

```bash
curl -X GET https://api.festivals.io/v1/wallets/123 \
  -H "X-API-Key: fst_live_abc123xyz789..."
```

### API Key Permissions

| Permission | Description |
|------------|-------------|
| `read:festivals` | Read festival data |
| `write:festivals` | Create/update festivals |
| `read:wallets` | Read wallet balances |
| `write:payments` | Process payments |
| `read:tickets` | Read ticket data |
| `write:tickets` | Create/update tickets |
| `read:analytics` | Access analytics data |

### Key Rotation

Rotate an API key to get a new key value while keeping the same configuration:

```bash
POST /festivals/{festivalId}/api/keys/{keyId}/rotate
Authorization: Bearer <admin-token>
```

### Revoking Keys

Immediately revoke an API key:

```bash
POST /festivals/{festivalId}/api/keys/{keyId}/revoke
Authorization: Bearer <admin-token>
```

## OAuth 2.0

For third-party applications, we support OAuth 2.0 authorization code flow.

### Authorization URL

```
https://auth.festivals.io/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://yourapp.com/callback&
  scope=read:wallets write:payments&
  state=random_state_string
```

### Token Exchange

```bash
POST https://auth.festivals.io/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTHORIZATION_CODE&
client_id=YOUR_CLIENT_ID&
client_secret=YOUR_CLIENT_SECRET&
redirect_uri=https://yourapp.com/callback
```

## User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `admin` | Platform administrator | Full access |
| `organizer` | Festival organizer | Festival management |
| `manager` | Festival manager | Limited festival admin |
| `staff` | Festival staff | Point-of-sale operations |
| `user` | Regular attendee | Personal data only |

## Permission Matrix

| Resource | admin | organizer | manager | staff | user |
|----------|-------|-----------|---------|-------|------|
| Festivals | CRUD | CRUD (own) | R | R | R |
| Wallets | CRUD | CRUD | R | RU | R (own) |
| Payments | CRUD | CRUD | R | C | R (own) |
| Tickets | CRUD | CRUD | RU | R | R (own) |
| Users | CRUD | R | R | - | R (own) |
| Analytics | R | R (own) | R | - | - |

*CRUD = Create, Read, Update, Delete*

## Security Best Practices

1. **Never expose tokens in URLs** - Use headers for authentication
2. **Store tokens securely** - Use secure storage mechanisms
3. **Use HTTPS** - Always use encrypted connections
4. **Rotate API keys regularly** - Set up key rotation schedules
5. **Use minimal permissions** - Request only needed scopes
6. **Monitor API usage** - Set up alerts for unusual activity
7. **Handle token expiration** - Implement proper refresh logic

## Error Responses

### 401 Unauthorized

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

Common causes:
- Missing Authorization header
- Expired access token
- Malformed token
- Revoked API key

### 403 Forbidden

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions"
  }
}
```

Common causes:
- Missing required permission
- Resource belongs to another user/festival
- Role not authorized for action

## Testing Authentication

### cURL Example

```bash
# Login
curl -X POST https://api.festivals.io/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Use token
export TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
curl -X GET https://api.festivals.io/v1/me \
  -H "Authorization: Bearer $TOKEN"
```

### Postman

1. Import the Postman collection
2. Set up environment variables for `base_url` and `token`
3. Use the "Login" request to obtain a token
4. Subsequent requests will use the token automatically

## Support

For authentication issues:
- Check the [Error Codes](./errors.md) documentation
- Review [Rate Limiting](./rate-limiting.md) for 429 errors
- Contact support@festivals.io for assistance
