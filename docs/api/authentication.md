# Authentication Guide

## Overview

The Festivals API supports multiple authentication methods to accommodate different use cases:

1. **JWT Bearer Token** - For user and admin authentication (via Auth0)
2. **API Key** - For external integrations and webhooks
3. **OAuth 2.0** - For third-party applications (via Auth0)

Authentication is powered by [Auth0](https://auth0.com), providing secure, scalable identity management with support for social logins, multi-factor authentication, and enterprise connections.

## Auth0 Integration

### Configuration

The backend validates JWT tokens issued by Auth0. Required environment variables:

```bash
# Auth0 Configuration
AUTH0_DOMAIN=your-tenant.eu.auth0.com
AUTH0_AUDIENCE=https://api.festivals.app
```

### Token Validation Flow

```
1. Client obtains token from Auth0 (via login, social auth, etc.)
2. Client includes token in Authorization header
3. Backend fetches JWKS from Auth0 (cached for 1 hour)
4. Backend validates token signature, expiration, and audience
5. Backend extracts claims and permissions from token
6. Request proceeds with user context
```

### JWKS Caching

The backend caches Auth0's JSON Web Key Set (JWKS) for performance:

- **Cache TTL**: 1 hour (configurable)
- **Cache Location**: In-memory + Redis (if available)
- **Auto-refresh**: On cache miss or key rotation
- **Endpoint**: `https://{AUTH0_DOMAIN}/.well-known/jwks.json`

### Custom Claims

Auth0 tokens include custom claims under the `https://festivals.app` namespace:

| Claim | Description |
|-------|-------------|
| `https://festivals.app/roles` | User's assigned roles |
| `https://festivals.app/festival_id` | Current festival context |
| `https://festivals.app/stand_ids` | Assigned stand IDs (for staff) |
| `https://festivals.app/organizer_for` | Festivals user can organize |

> **Note**: For Auth0 setup instructions, see [Auth0 Setup Guide](../setup/AUTH0.md).

---

## JWT Bearer Token

### Obtaining a Token

Users obtain JWT tokens through Auth0's Universal Login or the login endpoint:

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

#### Standard Claims (OIDC)

| Claim | Description |
|-------|-------------|
| `sub` | User ID (Auth0 user_id) |
| `iss` | Token issuer (Auth0 domain) |
| `aud` | Token audience (API identifier) |
| `exp` | Token expiration timestamp |
| `iat` | Token issued at timestamp |
| `scope` | Space-separated list of scopes |

#### Standard Profile Claims

| Claim | Description |
|-------|-------------|
| `email` | User email address |
| `email_verified` | Whether email is verified |
| `name` | User's full name |
| `picture` | Profile picture URL |

#### Custom Claims (Festivals-specific)

| Claim | Description |
|-------|-------------|
| `https://festivals.app/roles` | Array of user roles |
| `https://festivals.app/festival_id` | Current festival context (optional) |
| `https://festivals.app/stand_ids` | Assigned stand IDs (for staff) |
| `https://festivals.app/organizer_for` | Festival IDs user can organize |

#### Permissions

| Claim | Description |
|-------|-------------|
| `permissions` | Array of granted API permissions (from RBAC) |

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

## OAuth 2.0 (via Auth0)

For third-party applications, we support OAuth 2.0 authorization code flow through Auth0.

### Authorization URL

```
https://{AUTH0_DOMAIN}/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://yourapp.com/callback&
  audience=https://api.festivals.app&
  scope=openid profile email read:wallets write:payments&
  state=random_state_string
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `response_type` | Yes | Use `code` for authorization code flow |
| `client_id` | Yes | Your Auth0 application client ID |
| `redirect_uri` | Yes | Must be registered in Auth0 app settings |
| `audience` | Yes | API identifier: `https://api.festivals.app` |
| `scope` | Yes | Space-separated list of scopes (include `openid`) |
| `state` | Recommended | Random string to prevent CSRF attacks |
| `code_challenge` | Recommended | For PKCE flow (required for mobile/SPA) |
| `code_challenge_method` | Recommended | Use `S256` for PKCE |

### Token Exchange

```bash
POST https://{AUTH0_DOMAIN}/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTHORIZATION_CODE&
client_id=YOUR_CLIENT_ID&
client_secret=YOUR_CLIENT_SECRET&
redirect_uri=https://yourapp.com/callback
```

### PKCE Flow (for Mobile/SPA)

For public clients (mobile apps, SPAs), use PKCE:

```bash
# Generate code verifier (43-128 characters)
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-43)

# Generate code challenge
CODE_CHALLENGE=$(echo -n $CODE_VERIFIER | openssl sha256 -binary | base64 | tr -d '=' | tr '+/' '-_')

# Authorization request includes:
# code_challenge={CODE_CHALLENGE}
# code_challenge_method=S256

# Token exchange includes:
# code_verifier={CODE_VERIFIER}
```

### Machine-to-Machine (M2M) Authentication

For backend services and integrations:

```bash
POST https://{AUTH0_DOMAIN}/oauth/token
Content-Type: application/json

{
  "client_id": "YOUR_M2M_CLIENT_ID",
  "client_secret": "YOUR_M2M_CLIENT_SECRET",
  "audience": "https://api.festivals.app",
  "grant_type": "client_credentials"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400
}
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

## Backend Middleware Implementation

### Auth Middleware Configuration

The Go backend uses the following configuration for Auth0:

```go
import "festivals/internal/middleware"

// Configure auth middleware
authConfig := middleware.AuthConfig{
    Domain:      os.Getenv("AUTH0_DOMAIN"),      // e.g., "festivals.eu.auth0.com"
    Audiences:   []string{os.Getenv("AUTH0_AUDIENCE")}, // e.g., ["https://api.festivals.app"]
    Issuer:      "",                              // Auto-generated from domain
    CacheTTL:    time.Hour,                       // JWKS cache duration
    RedisClient: redisClient,                     // Optional: for distributed caching
    Development: os.Getenv("ENVIRONMENT") == "development",
}

// Apply middleware
router.Use(middleware.Auth(authConfig))
```

### Claims Extraction

The middleware extracts claims and makes them available in the request context:

```go
// In your handler
func MyHandler(c *gin.Context) {
    // Get user ID (Auth0 sub claim)
    userID := middleware.GetUserID(c)

    // Get email
    email := middleware.GetEmail(c)

    // Get roles (from custom claim)
    roles := middleware.GetRoles(c)

    // Get permissions (from RBAC)
    permissions := middleware.GetPermissions(c)

    // Get festival context
    festivalID := middleware.GetFestivalID(c)

    // Get full claims object
    claims := middleware.GetClaims(c)
}
```

### Permission Checking

```go
// Check for specific role
if middleware.HasRole(c, "FESTIVAL_OWNER") {
    // Allow festival owner actions
}

// Check for any of multiple roles
if middleware.HasAnyRole(c, "FESTIVAL_OWNER", "FESTIVAL_ADMIN") {
    // Allow admin actions
}

// Check for specific permission
if middleware.HasPermission(c, "write:festivals") {
    // Allow festival updates
}
```

### Development Mode

In development mode (`ENVIRONMENT=development`), the middleware:

- Accepts tokens without full signature verification
- Allows testing with self-generated tokens
- Logs additional debugging information

> **Warning**: Never enable development mode in production.

### Error Handling

The middleware returns structured error responses:

```json
// 401 Unauthorized
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authorization header required"
  }
}

// Token expired
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Token has expired. Please refresh your authentication."
  }
}
```

---

## Security Features

### Brute Force Protection

The backend includes brute force protection for authentication endpoints:

```go
bfConfig := middleware.BruteForceConfig{
    RedisClient:        redisClient,
    MaxAttempts:        5,              // Max failed attempts
    LockoutDuration:    15 * time.Minute,
    AttemptWindow:      15 * time.Minute,
    EnableIPBlocking:   true,
    EnableUserBlocking: true,
    ProgressiveLockout: true,           // Double lockout on repeat violations
}

router.Use(middleware.BruteForceProtection(bfConfig))
```

### Session Management

For additional security, the backend supports server-side session management:

```go
sessionConfig := middleware.SessionConfig{
    RedisClient:     redisClient,
    SessionDuration: 24 * time.Hour,
    MaxSessions:     5,                 // Max concurrent sessions per user
    EnableRotation:  true,              // Rotate session ID on privilege change
}

sessionManager := middleware.NewSessionManager(sessionConfig)
```

### Refresh Token Security

Refresh tokens include security features:

- **Token Rotation**: New refresh token on each use
- **Family Tracking**: Detect token reuse attacks
- **Automatic Revocation**: Revoke family on suspicious activity

---

## Related Documentation

- [Auth0 Setup Guide](../setup/AUTH0.md) - Complete Auth0 configuration
- [Auth0 Configuration Reference](../setup/auth0-config.json) - Example configuration
- [RBAC System](../../backend/internal/domain/auth/README.md) - Role-based access control
- [Security Documentation](../../backend/docs/security/SECURITY.md) - Security best practices

## Support

For authentication issues:
- Check the [Error Codes](./errors.md) documentation
- Review [Rate Limiting](./rate-limiting.md) for 429 errors
- Check [Auth0 Logs](https://manage.auth0.com/#/logs) for Auth0-specific issues
- Contact support@festivals.io for assistance
