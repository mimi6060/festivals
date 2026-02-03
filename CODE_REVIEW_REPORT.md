# Code Review Report - Festivals MVP

**Date:** 2026-02-03
**Reviewer:** Claude Opus 4.5
**Project:** Festivals Platform MVP

---

## Executive Summary

This report covers a comprehensive code review of the Festivals MVP codebase, focusing on security vulnerabilities, error handling, best practices, and potential production issues. The codebase demonstrates solid architecture with good separation of concerns, but several issues need attention before production deployment.

### Summary by Severity

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 9 |
| MEDIUM | 12 |
| LOW | 8 |

---

## CRITICAL Issues

### 1. XSS Vulnerability - Unsanitized HTML Rendering

**File:** `/Users/mac-m3-michel/workspace/festivals/public/src/components/features/FAQSection.tsx`
**Line:** 67

**Description:**
FAQ answers are rendered using `dangerouslySetInnerHTML` without sanitization. If an attacker can inject malicious content into FAQ answers via the admin panel, it will execute in all users' browsers.

```tsx
dangerouslySetInnerHTML={{ __html: faq.answer }}
```

**Recommended Fix:**
Use a sanitization library like DOMPurify:
```tsx
import DOMPurify from 'dompurify';
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(faq.answer) }}
```

---

### 2. Development Mock Authentication Bypass

**File:** `/Users/mac-m3-michel/workspace/festivals/admin/src/middleware.ts`
**Lines:** 57-64

**Description:**
When Auth0 is not configured, the middleware sets mock admin headers that could be exploited in production if Auth0 configuration is accidentally missing.

```typescript
if (!auth0Configured) {
  const response = NextResponse.next()
  response.headers.set('X-Auth-Mode', 'dev-mock')
  response.headers.set('X-Mock-User-Id', 'dev-user-1')
  response.headers.set('X-Mock-User-Roles', 'ADMIN')
  return response
}
```

**Recommended Fix:**
The production check exists (line 48-54) but returns a 503 JSON response. Ensure this code path is properly tested and that Auth0 configuration is mandatory in production builds via build-time validation.

---

### 3. Hardcoded Default Secrets in Configuration

**File:** `/Users/mac-m3-michel/workspace/festivals/backend/internal/config/config.go`
**Lines:** 92, 95

**Description:**
JWT and QR code secrets have hardcoded default values that could be used in production if environment variables are not set.

```go
JWTSecret: getEnv("JWT_SECRET", "your-super-secret-key-change-in-production"),
QRCodeSecret: getEnv("QRCODE_SECRET", "your-qrcode-secret-key-change-in-production"),
```

**Recommended Fix:**
Remove default values for security-critical configuration and fail fast if not set:
```go
func getRequiredEnv(key string) string {
    value := os.Getenv(key)
    if value == "" {
        log.Fatalf("Required environment variable %s is not set", key)
    }
    return value
}
```

---

### 4. Docker Compose Hardcoded Database Credentials

**File:** `/Users/mac-m3-michel/workspace/festivals/docker-compose.yml`
**Lines:** 206-207

**Description:**
Default database credentials are set in docker-compose.yml and could be used in production if environment variables are not overridden.

```yaml
POSTGRES_USER: ${POSTGRES_USER:-festivals}
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-password}
```

**Recommended Fix:**
Remove default values for passwords in production docker-compose file or require explicit configuration.

---

### 5. Monitoring Stack Hardcoded Credentials

**File:** `/Users/mac-m3-michel/workspace/festivals/infrastructure/monitoring/docker-compose.monitoring.yml`
**Line:** 126

**Description:**
PostgreSQL exporter has hardcoded database password in the connection string.

```yaml
DATA_SOURCE_NAME=postgresql://festivals:password@postgres:5432/festivals?sslmode=disable
```

**Recommended Fix:**
Use environment variable substitution:
```yaml
DATA_SOURCE_NAME=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable
```

---

## HIGH Issues

### 1. Admin Panel XSS in Email Template Preview

**File:** `/Users/mac-m3-michel/workspace/festivals/admin/src/app/(dashboard)/festivals/[id]/settings/notifications/page.tsx`
**Line:** 814

**Description:**
Email template HTML preview renders unsanitized HTML. While this is an admin-only feature, a malicious template could still execute scripts.

```tsx
dangerouslySetInnerHTML={{ __html: previewTemplate.htmlBody }}
```

**Recommended Fix:**
Render in a sandboxed iframe or sanitize the content.

---

### 2. Missing Transaction Atomicity in Wallet Top-Up

**File:** `/Users/mac-m3-michel/workspace/festivals/backend/internal/domain/wallet/service.go`
**Lines:** 109-121

**Description:**
Wallet balance update and transaction creation are not wrapped in a database transaction. A failure between these operations could lead to inconsistent state.

```go
if err := s.repo.UpdateWallet(ctx, wallet); err != nil {
    return nil, fmt.Errorf("failed to update wallet: %w", err)
}

if err := s.repo.CreateTransaction(ctx, tx); err != nil {
    return nil, fmt.Errorf("failed to create transaction: %w", err)
}
```

**Recommended Fix:**
Wrap both operations in a database transaction.

---

### 3. Ticket Creation Race Condition

**File:** `/Users/mac-m3-michel/workspace/festivals/backend/internal/domain/ticket/service.go`
**Lines:** 200-210

**Description:**
Ticket creation and quantity sold update are not atomic, which could lead to overselling under high concurrency.

```go
if err := s.repo.CreateTicket(ctx, ticket); err != nil {
    return nil, fmt.Errorf("failed to create ticket: %w", err)
}

// Note: In a real scenario, this should be done in a transaction
if err := s.repo.UpdateQuantitySold(ctx, req.TicketTypeID, 1); err != nil {
```

**Recommended Fix:**
Use database transactions with row-level locking (SELECT ... FOR UPDATE).

---

### 4. Internal Error Details Exposed to Clients

**File:** Multiple files in `/Users/mac-m3-michel/workspace/festivals/backend/internal/domain/`

**Description:**
Many handlers return `err.Error()` directly to clients, potentially exposing internal implementation details, database structure, or sensitive information.

Example from `archive_handler.go:144`:
```go
response.InternalError(c, err.Error())
```

**Recommended Fix:**
Log the actual error internally and return a generic message to clients:
```go
log.Error().Err(err).Msg("Failed to process request")
response.InternalError(c, "An internal error occurred")
```

---

### 5. Missing Rate Limiting on Authentication Endpoints

**File:** `/Users/mac-m3-michel/workspace/festivals/nginx/nginx.conf`

**Description:**
While rate limiting exists for API and general routes, authentication endpoints (`/api/auth`) should have stricter rate limiting to prevent brute force attacks.

**Recommended Fix:**
Add specific rate limiting for auth endpoints:
```nginx
limit_req_zone $binary_remote_addr zone=auth:10m rate=3r/s;

location /api/auth/ {
    limit_req zone=auth burst=5 nodelay;
    # ...
}
```

---

### 6. CORS Configuration Too Permissive

**File:** `/Users/mac-m3-michel/workspace/festivals/nginx/nginx.conf`
**Line:** 88

**Description:**
CORS is configured to allow all origins (`*`), which could allow malicious sites to make authenticated requests.

```nginx
add_header Access-Control-Allow-Origin * always;
```

**Recommended Fix:**
Configure specific allowed origins:
```nginx
set $cors_origin "";
if ($http_origin ~* (https://festivals\.app|https://admin\.festivals\.app)) {
    set $cors_origin $http_origin;
}
add_header Access-Control-Allow-Origin $cors_origin always;
```

---

### 7. Admin Dependency Version Conflict

**File:** `/Users/mac-m3-michel/workspace/festivals/admin/package.json`

**Description:**
The `@auth0/nextjs-auth0@^3.5.0` dependency requires Next.js `^14.2.25` but the project uses `next@14.1.0`, causing npm install to fail.

```
peer next@"^10.0.0 || ^11.0.0 || ^12.3.5 || ^13.5.9 || ^14.2.25 || ^15.2.3" from @auth0/nextjs-auth0@3.8.0
```

**Recommended Fix:**
Update Next.js to `^14.2.25` or downgrade Auth0 package to a compatible version.

---

### 8. Offline Transaction Secret Generation Weakness

**File:** `/Users/mac-m3-michel/workspace/festivals/mobile/lib/offlineTransaction.ts`
**Lines:** 52-66

**Description:**
The offline secret is generated locally and stored on the device. In a real production scenario, this should be provisioned from the server during authentication to ensure the server can validate signatures.

```typescript
if (!secret) {
  // In production, this would come from server during authentication
  // For now, we generate a random secret
  const randomBytes = await Crypto.getRandomBytesAsync(32);
```

**Recommended Fix:**
Implement server-side secret provisioning during user authentication flow.

---

### 9. QR Code Signature Short Validity Window

**File:** `/Users/mac-m3-michel/workspace/festivals/backend/internal/domain/wallet/service.go`
**Lines:** 280-281

**Description:**
QR codes expire after 5 minutes, which may cause issues during network latency or queuing at payment points.

```go
if time.Now().Unix()-payload.Timestamp > 300 {
    return nil, fmt.Errorf("QR code expired")
}
```

**Recommended Fix:**
Consider configurable expiry time or implement a refresh mechanism.

---

## MEDIUM Issues

### 1. Missing Error Boundary in Public Site

**File:** `/Users/mac-m3-michel/workspace/festivals/public/src/`

**Description:**
No React Error Boundary components found in the public site, meaning unhandled errors will crash the entire application.

**Recommended Fix:**
Add error boundaries around major sections of the application.

---

### 2. Cart State Not Validated Against Server

**File:** `/Users/mac-m3-michel/workspace/festivals/public/src/stores/cart.ts`

**Description:**
Cart prices and availability are stored locally and not re-validated before checkout. Prices could change or items could sell out while user is browsing.

**Recommended Fix:**
Validate cart contents against server-side data before proceeding to checkout.

---

### 3. Missing Input Length Validation in Checkout Form

**File:** `/Users/mac-m3-michel/workspace/festivals/public/src/components/features/CheckoutForm.tsx`

**Description:**
Form validation only checks for empty fields and basic email format, but doesn't validate maximum lengths which could cause database issues.

**Recommended Fix:**
Add maxLength validation for name, email, and phone fields.

---

### 4. Phone Number Validation Missing

**File:** `/Users/mac-m3-michel/workspace/festivals/public/src/components/features/CheckoutForm.tsx`
**Lines:** 150-158

**Description:**
Phone number field accepts any input without format validation.

**Recommended Fix:**
Add phone number format validation using a library like libphonenumber-js.

---

### 5. API Error Handling Could Leak Information

**File:** `/Users/mac-m3-michel/workspace/festivals/public/src/lib/api.ts`
**Lines:** 33-35

**Description:**
API errors are passed through with their messages, potentially exposing backend implementation details.

```typescript
const error = await response.json().catch(() => ({ message: 'An error occurred' }))
throw new Error(error.message || `HTTP ${response.status}`)
```

**Recommended Fix:**
Map error codes to user-friendly messages on the client side.

---

### 6. Missing HTTPS Enforcement

**File:** `/Users/mac-m3-michel/workspace/festivals/nginx/nginx.conf`

**Description:**
No HTTPS redirection configured. The server only listens on port 80.

**Recommended Fix:**
Add HTTPS configuration and redirect HTTP to HTTPS in production.

---

### 7. Dockerfile Missing Security Best Practices

**File:** `/Users/mac-m3-michel/workspace/festivals/backend/Dockerfile`

**Description:**
- Running as root user
- No HEALTHCHECK instruction
- No USER instruction to run as non-root

**Recommended Fix:**
```dockerfile
# Add non-root user
RUN addgroup -g 1000 appgroup && adduser -u 1000 -G appgroup -D appuser
USER appuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1
```

---

### 8. Missing Request Timeout in API Client

**File:** `/Users/mac-m3-michel/workspace/festivals/public/src/lib/api.ts`

**Description:**
No request timeout configured, which could lead to hanging requests.

**Recommended Fix:**
Add AbortController with timeout:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);
const response = await fetch(url, { ...options, signal: controller.signal });
clearTimeout(timeoutId);
```

---

### 9. Grafana Default Admin Credentials

**File:** `/Users/mac-m3-michel/workspace/festivals/infrastructure/monitoring/docker-compose.monitoring.yml`
**Lines:** 39-40

**Description:**
Default Grafana credentials of admin/admin if not overridden.

```yaml
- GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER:-admin}
- GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-admin}
```

**Recommended Fix:**
Remove default values and require explicit configuration.

---

### 10. Missing API Versioning in Public Routes

**File:** `/Users/mac-m3-michel/workspace/festivals/public/src/lib/api.ts`

**Description:**
API calls use `/api/public/` without versioning, making it harder to make breaking changes.

**Recommended Fix:**
Add API versioning: `/api/v1/public/`

---

### 11. Cart Total Calculation with Hardcoded Prices

**File:** `/Users/mac-m3-michel/workspace/festivals/public/src/stores/cart.ts`
**Lines:** 109-110

**Description:**
Option prices (camping/parking) are hardcoded in the frontend.

```typescript
if (options.camping) total += 5000 // 50 EUR in cents
if (options.parking) total += 2000 // 20 EUR in cents
```

**Recommended Fix:**
Fetch option prices from the API.

---

### 12. Mobile Sync Network Stability Check Too Short

**File:** `/Users/mac-m3-michel/workspace/festivals/mobile/hooks/useNetworkSync.ts`
**Lines:** 146-148

**Description:**
Only 1 second delay before syncing after coming online may not be enough for network stability.

```typescript
setTimeout(() => {
  forceSync();
}, 1000);
```

**Recommended Fix:**
Implement exponential backoff or increase initial delay.

---

## LOW Issues

### 1. Console.log in Production Code

**File:** `/Users/mac-m3-michel/workspace/festivals/mobile/hooks/useNetworkSync.ts`
**Line:** 100

**Description:**
Console.error statements should be replaced with proper logging service.

---

### 2. TODO Comment in Production Code

**File:** `/Users/mac-m3-michel/workspace/festivals/backend/internal/domain/ticket/service.go`
**Line:** 510

**Description:**
```go
// Note: In a real implementation, send email to new holder with claim link
```

---

### 3. Missing Loading States in Checkout

**File:** `/Users/mac-m3-michel/workspace/festivals/public/src/components/features/CheckoutForm.tsx`

**Description:**
Button shows loading state but no skeleton loading for the form itself.

---

### 4. Inconsistent Error Response Format

**File:** Multiple handlers in backend

**Description:**
Some handlers use `response.InternalError(c, message)` while others use `c.JSON(http.StatusInternalServerError, gin.H{...})`. This creates inconsistent API responses.

**Recommended Fix:**
Use the response helper consistently across all handlers.

---

### 5. Missing Index on Frequently Queried Fields

**File:** `/Users/mac-m3-michel/workspace/festivals/backend/migrations/000003_create_wallets_table.up.sql`

**Description:**
While status index exists, there's no composite index for common queries (user_id + festival_id + status).

**Recommended Fix:**
Add composite index:
```sql
CREATE INDEX idx_wallets_user_festival_status ON wallets(user_id, festival_id, status);
```

---

### 6. Magic Numbers in Code

**File:** `/Users/mac-m3-michel/workspace/festivals/backend/internal/domain/wallet/service.go`
**Line:** 281

**Description:**
Magic number `300` (seconds) used for QR expiry without named constant.

**Recommended Fix:**
```go
const QRCodeExpirySeconds = 300
```

---

### 7. Unused Import Warning Potential

**File:** `/Users/mac-m3-michel/workspace/festivals/backend/internal/middleware/security.go`

**Description:**
Import of `io` is used only in `BodyDump` middleware which may not always be used.

---

### 8. Missing TypeScript Strict Mode

**Files:** TypeScript configuration files

**Description:**
Consider enabling stricter TypeScript options for better type safety:
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`

---

## Infrastructure Notes

### Docker Configuration
- Multi-stage builds properly implemented
- Health checks missing in some services
- Consider adding resource limits to containers

### Database Migrations
- Migrations use proper up/down pattern
- Foreign key constraints properly defined
- Missing some indexes for performance optimization

### Monitoring
- Prometheus, Grafana, AlertManager properly configured
- Missing application-level metrics endpoint configuration
- Consider adding distributed tracing (Jaeger/Zipkin)

---

## Recommendations Summary

### Before Production (Critical/High):
1. Implement HTML sanitization for FAQ and template preview
2. Remove hardcoded secrets and require environment variables
3. Fix admin package dependency conflict
4. Implement database transactions for financial operations
5. Add stricter rate limiting for authentication
6. Fix CORS configuration
7. Implement server-side offline secret provisioning

### Short-term Improvements (Medium):
1. Add React Error Boundaries
2. Implement server-side cart validation
3. Add HTTPS configuration
4. Improve Docker security
5. Add API request timeouts
6. Add API versioning

### Long-term Improvements (Low):
1. Standardize error response format
2. Add comprehensive logging service
3. Implement composite database indexes
4. Add TypeScript strict mode options
5. Replace magic numbers with named constants

---

**Report Generated:** 2026-02-03
**Total Files Reviewed:** 50+
**Lines of Code Analyzed:** ~15,000+
