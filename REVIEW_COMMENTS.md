# Festivals MVP - Code Review Comments

**Date:** 2026-02-03
**Reviewer:** Claude (Automated Review)
**Project:** Festivals MVP Platform

---

## Executive Summary

This comprehensive code review analyzes the Festivals MVP project across backend (Go), admin frontend (Next.js/TypeScript), and mobile app (React Native/TypeScript). The codebase demonstrates solid architectural foundations with Clean Architecture in the backend and modern React patterns in the frontend. Security measures are well-implemented, though some improvements are recommended.

### Overall Assessment

| Category | Rating | Summary |
|----------|--------|---------|
| Code Quality | Good | Well-structured, follows conventions, some duplication |
| Architecture | Very Good | Clean Architecture implemented correctly |
| Security | Good | Strong security middleware, some areas need attention |
| Performance | Good | Caching implemented, some optimization opportunities |
| Testing | Moderate | Good unit tests, integration coverage could be improved |
| Best Practices | Good | Follows Go/TypeScript idioms, good error handling |

---

## Critical Issues

### [SECURITY] File: backend/internal/config/config.go (Line 135)

**Severity:** High

**Issue:** Default database credentials in development mode could accidentally be deployed to production if environment variables are not properly configured.

**Current code:**
```go
DatabaseURL: getEnv("DATABASE_URL", "postgres://festivals:password@localhost:5432/festivals?sslmode=disable"),
```

**Suggested fix:**
```go
DatabaseURL: getEnvRequired("DATABASE_URL", isProduction),
```

**Why:** While the code validates JWT and QR secrets in production, the database URL has a default value that includes credentials. If `ENVIRONMENT` is misconfigured, this could expose a development-like connection string. Add database URL to required secrets validation in production.

---

### [SECURITY] File: admin/src/middleware.ts (Lines 56-64)

**Severity:** High

**Issue:** In development mode without Auth0, the middleware sets mock user headers with ADMIN role, which could be exploited if accidentally deployed.

**Current code:**
```typescript
if (!auth0Configured) {
  const response = NextResponse.next()
  response.headers.set('X-Auth-Mode', 'dev-mock')
  response.headers.set('X-Mock-User-Id', 'dev-user-1')
  response.headers.set('X-Mock-User-Email', 'dev@festival.local')
  response.headers.set('X-Mock-User-Name', 'Dev User')
  response.headers.set('X-Mock-User-Roles', 'ADMIN')
  return response
}
```

**Suggested fix:**
```typescript
if (!auth0Configured) {
  // Double-check we're truly in development
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: Auth0 not configured in production - blocking all requests')
    return new NextResponse(
      JSON.stringify({ error: 'Authentication service not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const response = NextResponse.next()
  response.headers.set('X-Auth-Mode', 'dev-mock')
  // ... rest of mock headers
  return response
}
```

**Why:** The production check at line 47-53 relies on `isProduction()` function. Adding a redundant check before setting mock headers provides defense-in-depth against configuration errors.

---

## Major Issues

### [CODE QUALITY] File: admin/src/app/(dashboard)/festivals/[id]/page.tsx (Lines 108-159)

**Severity:** Major

**Issue:** Hardcoded mock data fallback in production components creates maintenance burden and inconsistent behavior.

**Current code:**
```typescript
const loadFestival = async () => {
  try {
    const data = await festivalsApi.get(festivalId)
    setFestival(data)
    setCurrentFestival(data)
  } catch (error) {
    console.error('Failed to load festival:', error)
    // Use store data if API fails
    if (!currentFestival || currentFestival.id !== festivalId) {
      // Mock data for development
      const mockFestival: Festival = {
        id: festivalId,
        name: 'Summer Fest 2026',
        // ... 10+ lines of hardcoded data
      }
```

**Suggested fix:**
```typescript
const loadFestival = async () => {
  try {
    const data = await festivalsApi.get(festivalId)
    setFestival(data)
    setCurrentFestival(data)
  } catch (error) {
    console.error('Failed to load festival:', error)

    // Use cached data from store if available
    if (currentFestival && currentFestival.id === festivalId) {
      setFestival(currentFestival)
      return
    }

    // In development only, use mock service
    if (process.env.NODE_ENV === 'development') {
      const mockFestival = await getMockFestival(festivalId)
      setFestival(mockFestival)
      return
    }

    // In production, show error state
    setError(error)
  }
}
```

**Why:** Mock data should be extracted to a dedicated mock service and only enabled in development. This prevents accidental display of mock data in production and makes the code more maintainable.

---

### [ARCHITECTURE] File: backend/internal/domain/festival/service.go (Lines 81-91)

**Severity:** Major

**Issue:** The service directly interacts with database infrastructure (creating tenant schemas), violating Clean Architecture principles where the domain layer should not know about infrastructure details.

**Current code:**
```go
// Create festival in database
if err := s.repo.Create(ctx, festival); err != nil {
    return nil, fmt.Errorf("failed to create festival: %w", err)
}

// Create tenant schema
if err := database.CreateTenantSchema(s.db, festival.ID.String()); err != nil {
    // Rollback: delete the festival
    _ = s.repo.Delete(ctx, festival.ID)
    return nil, fmt.Errorf("failed to create tenant schema: %w", err)
}
```

**Suggested fix:**
```go
// Define interface in domain layer
type TenantManager interface {
    CreateTenant(ctx context.Context, festivalID uuid.UUID) error
    DeleteTenant(ctx context.Context, festivalID uuid.UUID) error
}

// Inject TenantManager in service constructor
type Service struct {
    repo          Repository
    tenantManager TenantManager
}

// Use in Create method
if err := s.tenantManager.CreateTenant(ctx, festival.ID); err != nil {
    _ = s.repo.Delete(ctx, festival.ID)
    return nil, fmt.Errorf("failed to create tenant: %w", err)
}
```

**Why:** The domain service should depend on abstractions (interfaces) rather than concrete infrastructure implementations. This makes the code more testable and follows the Dependency Inversion Principle.

---

### [PERFORMANCE] File: mobile/stores/walletStore.ts (Lines 66-104)

**Severity:** Major

**Issue:** Mock data generation inside the store creates unnecessary computational overhead and mixes concerns. Additionally, the store has excessive mock data that increases bundle size.

**Current code:**
```typescript
// Mock transaction data generator
const generateMockTransactions = (page: number, filter?: TransactionType | null): Transaction[] => {
  const types: TransactionType[] = filter ? [filter] : ['TOP_UP', 'PURCHASE', 'REFUND'];
  const mockData: Transaction[] = [];
  // ... 35+ lines of mock generation
```

**Suggested fix:**
```typescript
// Move mock data to a separate file only imported in development
// mobile/lib/mocks/walletMocks.ts
export const generateMockTransactions = (page: number, filter?: TransactionType | null): Transaction[] => {
  // ... mock logic
}

// In walletStore.ts
import { generateMockTransactions } from '@/lib/mocks/walletMocks';

// Use tree-shaking friendly conditional
const getMockTransactions = __DEV__
  ? (await import('@/lib/mocks/walletMocks')).generateMockTransactions
  : () => [];
```

**Why:** Mock data should be lazy-loaded and excluded from production builds to reduce bundle size. The current approach adds unnecessary code to the production bundle.

---

### [TESTING] File: backend/internal/domain/wallet/service_test.go (Line 16)

**Severity:** Major

**Issue:** Test secret key is a hardcoded weak value that could be accidentally used elsewhere.

**Current code:**
```go
const testSecretKey = "test-secret-key-for-signing"
```

**Suggested fix:**
```go
// Use a clearly marked test-only key with sufficient entropy
const testSecretKey = "TEST-ONLY-DO-NOT-USE-IN-PRODUCTION-" +
    "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"

// Or generate dynamically in TestMain
var testSecretKey string

func TestMain(m *testing.M) {
    b := make([]byte, 32)
    if _, err := rand.Read(b); err != nil {
        panic(err)
    }
    testSecretKey = hex.EncodeToString(b)
    os.Exit(m.Run())
}
```

**Why:** Test keys should be clearly distinguishable from production keys and meet minimum security requirements to catch any code that incorrectly validates key strength.

---

## Minor Issues

### [CODE QUALITY] File: backend/internal/domain/user/service.go (Lines 106-115, 117-127, 129-139)

**Severity:** Minor

**Issue:** Repetitive nil-check pattern across multiple Get methods creates code duplication.

**Current code:**
```go
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
    user, err := s.repo.GetByID(ctx, id)
    if err != nil {
        return nil, err
    }
    if user == nil {
        return nil, errors.ErrNotFound
    }
    return user, nil
}

func (s *Service) GetByAuth0ID(ctx context.Context, auth0ID string) (*User, error) {
    user, err := s.repo.GetByAuth0ID(ctx, auth0ID)
    if err != nil {
        return nil, err
    }
    if user == nil {
        return nil, errors.ErrNotFound
    }
    return user, nil
}
```

**Suggested fix:**
```go
// Helper function to reduce duplication
func (s *Service) getUser(user *User, err error) (*User, error) {
    if err != nil {
        return nil, err
    }
    if user == nil {
        return nil, errors.ErrNotFound
    }
    return user, nil
}

func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
    return s.getUser(s.repo.GetByID(ctx, id))
}

func (s *Service) GetByAuth0ID(ctx context.Context, auth0ID string) (*User, error) {
    return s.getUser(s.repo.GetByAuth0ID(ctx, auth0ID))
}
```

**Why:** DRY principle - reduces code duplication and makes the pattern consistent across all getter methods.

---

### [CODE QUALITY] File: admin/src/lib/api.ts (Lines 26-61)

**Severity:** Minor

**Issue:** The API client lacks request timeout configuration and retry logic for transient failures.

**Current code:**
```typescript
const response = await fetch(`${API_BASE}${endpoint}`, {
  ...options,
  headers,
  credentials: 'include',
})
```

**Suggested fix:**
```typescript
const DEFAULT_TIMEOUT = 30000; // 30 seconds

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit & { timeout?: number; retries?: number } = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, retries = 0, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    // ... rest of error handling
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError(408, { error: { code: 'TIMEOUT', message: 'Request timed out' } });
    }
    // Implement retry logic for network errors
    if (retries > 0 && isRetryableError(error)) {
      return apiClient(endpoint, { ...options, retries: retries - 1 });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Why:** Without timeout handling, slow or hung requests can block the UI indefinitely. Retry logic improves resilience against transient network failures.

---

### [SECURITY] File: mobile/lib/offline/crypto.ts (Lines 35-49)

**Severity:** Minor

**Issue:** The HMAC implementation using double-hashing is not a proper HMAC and is cryptographically weaker than standard HMAC-SHA256.

**Current code:**
```typescript
export const generateHMACSHA256 = async (
  message: string,
  key: string
): Promise<string> => {
  // Combine message with key for HMAC-like behavior
  // Note: expo-crypto doesn't have native HMAC, so we use double hashing
  const combined = `${key}|${message}|${key}`;

  const signature = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
```

**Suggested fix:**
```typescript
// Consider using a proper HMAC library
import { createHmac } from 'crypto-js/hmac-sha256';

// Or implement proper HMAC if native is unavailable
export const generateHMACSHA256 = async (
  message: string,
  key: string
): Promise<string> => {
  // Use a proper HMAC library when available
  // expo-crypto limitation documented

  // For offline transactions, consider using a different approach
  // such as pre-generated tokens from the server
  console.warn('Using fallback HMAC implementation - for offline use only');

  const combined = `${key}|${message}|${key}`;
  // ... existing code with clear documentation
};
```

**Why:** The current implementation, while documented, doesn't provide the same security guarantees as proper HMAC. Consider using a polyfill library for proper HMAC-SHA256 implementation.

---

### [BEST PRACTICES] File: backend/internal/domain/notification/service.go (Lines 516-587)

**Severity:** Minor

**Issue:** The `sendEmail` function is quite long (70+ lines) and handles multiple responsibilities including preference checking, template rendering, logging, and email sending.

**Current code:**
```go
func (s *Service) sendEmail(ctx context.Context, userID *uuid.UUID, toEmail string, template EmailTemplate, data interface{}, meta *EmailLogMeta) error {
    // Check user preferences if userID is provided
    if userID != nil {
        shouldSend, err := s.ShouldSendEmail(ctx, *userID, template)
        // ... 70+ lines
```

**Suggested fix:**
```go
func (s *Service) sendEmail(ctx context.Context, userID *uuid.UUID, toEmail string, template EmailTemplate, data interface{}, meta *EmailLogMeta) error {
    // Check preferences
    if !s.checkShouldSendEmail(ctx, userID, template, toEmail) {
        return nil
    }

    // Prepare email content
    content, err := s.prepareEmailContent(template, data)
    if err != nil {
        return err
    }

    // Create and send email with logging
    return s.executeEmailSend(ctx, userID, toEmail, template, content, meta)
}

func (s *Service) checkShouldSendEmail(ctx context.Context, userID *uuid.UUID, template EmailTemplate, toEmail string) bool {
    // Extracted preference check logic
}

func (s *Service) prepareEmailContent(template EmailTemplate, data interface{}) (*emailContent, error) {
    // Extracted rendering logic
}

func (s *Service) executeEmailSend(ctx context.Context, ...) error {
    // Extracted send and logging logic
}
```

**Why:** Smaller, focused functions are easier to test, understand, and maintain. Each extracted function has a single responsibility.

---

### [PERFORMANCE] File: backend/internal/domain/festival/repository.go (Lines 57-71)

**Severity:** Minor

**Issue:** The List function executes two separate queries (Count and Find) which could be optimized.

**Current code:**
```go
func (r *repository) List(ctx context.Context, offset, limit int) ([]Festival, int64, error) {
    var festivals []Festival
    var total int64

    query := r.db.WithContext(ctx).Model(&Festival{})

    if err := query.Count(&total).Error; err != nil {
        return nil, 0, fmt.Errorf("failed to count festivals: %w", err)
    }

    if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&festivals).Error; err != nil {
        return nil, 0, fmt.Errorf("failed to list festivals: %w", err)
    }
```

**Suggested fix:**
```go
func (r *repository) List(ctx context.Context, offset, limit int) ([]Festival, int64, error) {
    var festivals []Festival
    var total int64

    // Use a single query with window function for better performance
    // Or use a transaction to ensure consistency
    err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
        if err := tx.Model(&Festival{}).Count(&total).Error; err != nil {
            return err
        }

        return tx.Model(&Festival{}).
            Offset(offset).
            Limit(limit).
            Order("created_at DESC").
            Find(&festivals).Error
    })

    if err != nil {
        return nil, 0, fmt.Errorf("failed to list festivals: %w", err)
    }

    return festivals, total, nil
}
```

**Why:** Running the queries in a transaction ensures consistency between the count and the returned data. For high-traffic endpoints, consider caching the count.

---

### [CODE QUALITY] File: admin/src/stores/authStore.ts (Lines 1-32)

**Severity:** Minor

**Issue:** The auth store persists to localStorage but stores minimal user information. The `persist` middleware saves auth state which could lead to stale data.

**Current code:**
```typescript
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
)
```

**Suggested fix:**
```typescript
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      lastUpdated: null,

      setUser: (user) => set({
        user,
        isAuthenticated: !!user,
        lastUpdated: Date.now(),
      }),

      logout: () => set({
        user: null,
        isAuthenticated: false,
        lastUpdated: null,
      }),

      // Check if cached user data is stale (older than 5 minutes)
      isStale: () => {
        const { lastUpdated } = get();
        if (!lastUpdated) return true;
        return Date.now() - lastUpdated > 5 * 60 * 1000;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        lastUpdated: state.lastUpdated
      }),
    }
  )
)
```

**Why:** Adding staleness checks prevents the UI from showing outdated user information after token refresh or role changes.

---

### [BEST PRACTICES] File: admin/src/components/dashboard/StatCard.tsx (Lines 26-38)

**Severity:** Minor

**Issue:** The trend icon and color logic could be extracted for reusability and testing.

**Current code:**
```typescript
const getTrendIcon = () => {
  if (!change) return null
  if (change.value > 0) return TrendingUp
  if (change.value < 0) return TrendingDown
  return Minus
}

const getTrendColor = () => {
  if (!change) return ''
  if (change.value > 0) return 'text-green-600'
  if (change.value < 0) return 'text-red-600'
  return 'text-gray-500'
}
```

**Suggested fix:**
```typescript
// Extract to utils for reusability
export function getTrendConfig(value: number | undefined) {
  if (value === undefined) return null;

  if (value > 0) return {
    icon: TrendingUp,
    color: 'text-green-600',
    prefix: '+'
  };
  if (value < 0) return {
    icon: TrendingDown,
    color: 'text-red-600',
    prefix: ''
  };
  return {
    icon: Minus,
    color: 'text-gray-500',
    prefix: ''
  };
}

// In component
const trendConfig = change ? getTrendConfig(change.value) : null;
```

**Why:** Extracting this logic makes it reusable across other components that display trends and easier to unit test.

---

## Suggestions

### [SUGGESTION] File: backend/internal/middleware/security.go (Lines 109-113)

**Severity:** Suggestion

**Issue:** The in-memory CSRF token store could grow unbounded if the cleanup routine fails or Redis is unavailable.

**Current code:**
```go
var (
    csrfTokens     = make(map[string]time.Time)
    csrfTokensLock sync.RWMutex
)
```

**Suggested improvement:**
```go
var (
    csrfTokens     = make(map[string]time.Time)
    csrfTokensLock sync.RWMutex
    maxCSRFTokens  = 10000 // Maximum tokens to store in memory
)

// In storeCSRFToken function
func storeCSRFToken(c *gin.Context, cfg SecurityConfig, token string) {
    if cfg.RedisClient != nil {
        key := "csrf:" + token
        cfg.RedisClient.Set(c.Request.Context(), key, c.ClientIP(), cfg.CSRFTokenExpiry)
        return
    }

    csrfTokensLock.Lock()
    defer csrfTokensLock.Unlock()

    // Prevent unbounded growth
    if len(csrfTokens) >= maxCSRFTokens {
        // Remove oldest 10% of tokens
        cleanupOldestTokens(csrfTokens, maxCSRFTokens/10)
    }

    csrfTokens[token] = time.Now().Add(cfg.CSRFTokenExpiry)
}
```

**Why:** Adding a maximum size prevents memory exhaustion if the cleanup routine fails to run.

---

### [SUGGESTION] File: backend/internal/pkg/security/encryption.go (Lines 294-315)

**Severity:** Suggestion

**Issue:** The `PasswordHasher` struct has well-documented parameters, but there's no validation that the configured memory won't exceed available system resources.

**Current code:**
```go
type PasswordHasher struct {
    Time    uint32
    Memory  uint32  // 64 * 1024 = 64MB
    Threads uint8
    KeyLen  uint32
    SaltLen uint32
    BcryptCost int
}
```

**Suggested improvement:**
```go
// NewPasswordHasher creates a hasher with validated parameters
func NewPasswordHasher(opts ...PasswordHasherOption) (*PasswordHasher, error) {
    h := DefaultPasswordHasher()

    for _, opt := range opts {
        opt(h)
    }

    // Validate memory doesn't exceed reasonable limits
    maxMemoryMB := uint32(256) // 256MB max
    if h.Memory > maxMemoryMB*1024 {
        return nil, fmt.Errorf("memory parameter %d KB exceeds maximum %d MB",
            h.Memory, maxMemoryMB)
    }

    return h, nil
}
```

**Why:** Validating Argon2 parameters prevents accidental misconfiguration that could cause OOM errors under load.

---

### [SUGGESTION] File: mobile/lib/offline/transaction.ts (Lines 291-302)

**Severity:** Suggestion

**Issue:** The processed transaction ID storage keeps the last 1000 IDs but doesn't consider time-based expiration.

**Current code:**
```typescript
export const addProcessedTransactionId = async (transactionId: string): Promise<void> => {
  const ids = await getProcessedTransactionIds();
  ids.add(transactionId);

  // Keep only last 1000 IDs to prevent unlimited growth
  const idsArray = Array.from(ids);
  const trimmedIds = idsArray.slice(-1000);
```

**Suggested improvement:**
```typescript
interface ProcessedTransaction {
  id: string;
  timestamp: number;
}

export const addProcessedTransactionId = async (transactionId: string): Promise<void> => {
  const stored = await getProcessedTransactions();

  // Remove entries older than 7 days
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recent = stored.filter(t => t.timestamp > sevenDaysAgo);

  // Add new entry
  recent.push({ id: transactionId, timestamp: Date.now() });

  // Keep last 1000 if still too many
  const trimmed = recent.slice(-1000);

  await AsyncStorage.setItem(
    PROCESSED_TRANSACTION_IDS_KEY,
    JSON.stringify(trimmed)
  );
};
```

**Why:** Time-based expiration is more appropriate for transaction deduplication since very old transaction IDs are unlikely to be replayed.

---

### [SUGGESTION] General - Error Handling Consistency

**Severity:** Suggestion

**Issue:** Error messages across the codebase use different formats (some with error codes, some without).

**Suggested improvement:**

Create standardized error types:

```go
// backend/internal/pkg/errors/errors.go
type AppError struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    Details any    `json:"details,omitempty"`
    Cause   error  `json:"-"`
}

var (
    ErrNotFound     = &AppError{Code: "NOT_FOUND", Message: "Resource not found"}
    ErrForbidden    = &AppError{Code: "FORBIDDEN", Message: "Access denied"}
    ErrValidation   = &AppError{Code: "VALIDATION_ERROR", Message: "Invalid input"}
    ErrInternal     = &AppError{Code: "INTERNAL_ERROR", Message: "An internal error occurred"}
)
```

```typescript
// admin/src/lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ErrorCodes = {
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;
```

**Why:** Consistent error handling makes debugging easier and improves the user experience by providing actionable error messages.

---

## Test Coverage Gaps

### Missing Tests

1. **backend/internal/domain/festival/service.go** - No tests for `Delete` method's tenant schema cleanup
2. **backend/internal/middleware/security.go** - Limited tests for CSRF token validation edge cases
3. **admin/src/hooks/useAuth.ts** - No unit tests for role/permission checking functions
4. **mobile/lib/offline/crypto.ts** - No tests for signature verification with invalid signatures

### Recommended Test Additions

```go
// backend/internal/domain/festival/service_test.go
func TestService_Delete_CleansUpTenantSchema(t *testing.T) {
    // Test that deleting a festival also removes the tenant schema
}

func TestService_Create_RollsBackOnSchemaFailure(t *testing.T) {
    // Test transaction rollback when tenant schema creation fails
}
```

```typescript
// admin/src/hooks/__tests__/useAuth.test.ts
describe('useAuth', () => {
  describe('hasPermission', () => {
    it('should return true for admin with any permission', () => {})
    it('should check role permissions correctly', () => {})
    it('should return false when user is null', () => {})
  })
})
```

---

## Summary of Recommendations

### Immediate Actions (High Priority)
1. Add database URL validation in production
2. Add redundant production check before setting mock auth headers
3. Review HMAC implementation in mobile offline crypto

### Short-term Improvements (Medium Priority)
1. Extract mock data to separate files with tree-shaking
2. Refactor festival service to use TenantManager interface
3. Add timeout and retry logic to API client
4. Add bounds checking to in-memory CSRF token store

### Long-term Improvements (Low Priority)
1. Standardize error handling across all layers
2. Increase test coverage for edge cases
3. Extract common patterns to reusable utilities
4. Consider adding OpenTelemetry tracing for better observability

---

## Positive Observations

The codebase demonstrates several best practices worth highlighting:

1. **Strong Security Foundation**: The security middleware is comprehensive with CSRF protection, input sanitization, rate limiting, and proper header management.

2. **Well-Structured Architecture**: Clean Architecture is properly implemented in the backend with clear separation between domain, service, and infrastructure layers.

3. **Good Test Coverage for Core Functionality**: The wallet service tests demonstrate thorough coverage of business logic including edge cases.

4. **Consistent Code Style**: Both Go and TypeScript code follows language idioms and conventions consistently.

5. **Comprehensive Rate Limiting**: The rate limiting implementation includes sliding window, token bucket, adaptive, and cost-based algorithms with proper Redis integration.

6. **Proper Cryptographic Practices**: Password hashing uses Argon2id with appropriate parameters, and encryption supports key rotation.

7. **Thoughtful Offline Support**: The mobile app's offline transaction system includes signature verification and duplicate detection.

---

*Report generated by automated code review. Manual review recommended for critical security items.*
