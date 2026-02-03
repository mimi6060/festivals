# Testing Guide

This guide covers testing practices, tools, and strategies for the Festivals platform.

## Testing Pyramid

```
        ┌─────────┐
       /  E2E     \        ← Fewer, slower, more comprehensive
      /   Tests    \
     ┌─────────────┐
    /  Integration  \      ← Service interactions
   /     Tests       \
  ┌───────────────────┐
 /     Unit Tests      \   ← Many, fast, isolated
└───────────────────────┘
```

| Level | Count | Speed | Coverage |
|-------|-------|-------|----------|
| Unit | Many | Fast | Functions/Components |
| Integration | Some | Medium | Service interactions |
| E2E | Few | Slow | User workflows |

## Backend Testing (Go)

### Running Tests

```bash
cd backend

# Run all tests
go test ./...

# Run with verbose output
go test -v ./...

# Run with coverage
go test -cover ./...

# Generate coverage report
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Run specific package
go test ./internal/domain/wallet/...

# Run specific test
go test -run TestProcessPayment ./internal/domain/wallet/

# Run integration tests
go test -tags=integration ./tests/integration/...
```

### Unit Tests

#### Table-Driven Tests

```go
func TestWalletService_ProcessPayment(t *testing.T) {
    tests := []struct {
        name          string
        walletBalance int
        paymentAmount int
        wantErr       error
        wantBalance   int
    }{
        {
            name:          "successful payment",
            walletBalance: 5000,
            paymentAmount: 1500,
            wantErr:       nil,
            wantBalance:   3500,
        },
        {
            name:          "insufficient balance",
            walletBalance: 1000,
            paymentAmount: 1500,
            wantErr:       ErrInsufficientBalance,
            wantBalance:   1000,
        },
        {
            name:          "zero amount",
            walletBalance: 5000,
            paymentAmount: 0,
            wantErr:       ErrInvalidAmount,
            wantBalance:   5000,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Setup
            repo := NewMockWalletRepository()
            repo.wallet = &Wallet{Balance: tt.walletBalance}
            service := NewWalletService(repo)

            // Execute
            _, err := service.ProcessPayment(context.Background(), PaymentRequest{
                Amount: tt.paymentAmount,
            })

            // Assert
            if !errors.Is(err, tt.wantErr) {
                t.Errorf("got error %v, want %v", err, tt.wantErr)
            }
            if repo.wallet.Balance != tt.wantBalance {
                t.Errorf("got balance %d, want %d", repo.wallet.Balance, tt.wantBalance)
            }
        })
    }
}
```

#### Mocking

```go
// Repository mock
type MockWalletRepository struct {
    wallet      *Wallet
    findCalled  bool
    saveCalled  bool
    saveErr     error
}

func (m *MockWalletRepository) FindByID(ctx context.Context, id string) (*Wallet, error) {
    m.findCalled = true
    return m.wallet, nil
}

func (m *MockWalletRepository) Save(ctx context.Context, wallet *Wallet) error {
    m.saveCalled = true
    return m.saveErr
}

// Using mockgen
//go:generate mockgen -source=repository.go -destination=repository_mock.go -package=wallet

func TestWithMockgen(t *testing.T) {
    ctrl := gomock.NewController(t)
    defer ctrl.Finish()

    mockRepo := NewMockWalletRepository(ctrl)
    mockRepo.EXPECT().
        FindByID(gomock.Any(), "wallet-123").
        Return(&Wallet{Balance: 5000}, nil)

    service := NewWalletService(mockRepo)
    // ...
}
```

### Integration Tests

```go
// +build integration

package integration

import (
    "testing"
    "database/sql"
    _ "github.com/lib/pq"
)

func TestFestivalCreation(t *testing.T) {
    // Setup test database
    db, cleanup := setupTestDB(t)
    defer cleanup()

    // Create repository with real database
    repo := NewFestivalRepository(db)
    service := NewFestivalService(repo)

    // Test
    festival, err := service.Create(context.Background(), CreateFestivalRequest{
        Name:      "Test Festival",
        StartDate: time.Now().Add(24 * time.Hour),
        EndDate:   time.Now().Add(48 * time.Hour),
    })

    require.NoError(t, err)
    assert.Equal(t, "Test Festival", festival.Name)
    assert.Equal(t, StatusDraft, festival.Status)

    // Verify in database
    var count int
    err = db.QueryRow("SELECT COUNT(*) FROM festivals WHERE id = $1", festival.ID).Scan(&count)
    require.NoError(t, err)
    assert.Equal(t, 1, count)
}

func setupTestDB(t *testing.T) (*sql.DB, func()) {
    db, err := sql.Open("postgres", os.Getenv("TEST_DATABASE_URL"))
    require.NoError(t, err)

    // Run migrations
    runMigrations(db)

    return db, func() {
        // Cleanup
        db.Exec("TRUNCATE festivals, wallets, transactions CASCADE")
        db.Close()
    }
}
```

### HTTP Handler Tests

```go
func TestPaymentHandler(t *testing.T) {
    gin.SetMode(gin.TestMode)

    mockService := &MockPaymentService{}
    handler := NewPaymentHandler(mockService)

    router := gin.New()
    router.POST("/payments", handler.ProcessPayment)

    tests := []struct {
        name       string
        body       map[string]interface{}
        wantStatus int
        wantCode   string
    }{
        {
            name: "valid payment",
            body: map[string]interface{}{
                "walletId": "123",
                "amount":   1500,
                "standId":  "456",
            },
            wantStatus: 200,
        },
        {
            name: "missing amount",
            body: map[string]interface{}{
                "walletId": "123",
                "standId":  "456",
            },
            wantStatus: 400,
            wantCode:   "VALIDATION_ERROR",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            body, _ := json.Marshal(tt.body)
            req := httptest.NewRequest("POST", "/payments", bytes.NewReader(body))
            req.Header.Set("Content-Type", "application/json")

            w := httptest.NewRecorder()
            router.ServeHTTP(w, req)

            assert.Equal(t, tt.wantStatus, w.Code)

            if tt.wantCode != "" {
                var resp map[string]interface{}
                json.Unmarshal(w.Body.Bytes(), &resp)
                assert.Equal(t, tt.wantCode, resp["error"].(map[string]interface{})["code"])
            }
        })
    }
}
```

## Frontend Testing

### Running Tests

```bash
cd admin

# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run with coverage
npm run test:coverage

# Run specific file
npm test -- WalletCard.test.tsx
```

### Component Tests (React Testing Library)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { WalletCard } from './WalletCard';

describe('WalletCard', () => {
  const mockWallet = {
    id: '123',
    balance: 5000,
    festivalName: 'Summer Festival',
  };

  it('displays wallet balance', () => {
    render(<WalletCard wallet={mockWallet} onTopUp={jest.fn()} />);

    expect(screen.getByText('Summer Festival')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
  });

  it('calls onTopUp when button clicked', () => {
    const onTopUp = jest.fn();
    render(<WalletCard wallet={mockWallet} onTopUp={onTopUp} />);

    fireEvent.click(screen.getByRole('button', { name: /top up/i }));

    expect(onTopUp).toHaveBeenCalledWith(1000);
  });
});
```

### Hook Tests

```typescript
import { renderHook, act } from '@testing-library/react';
import { useWallet } from './useWallet';

describe('useWallet', () => {
  it('fetches wallet on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useWallet('123'));

    expect(result.current.loading).toBe(true);

    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.wallet).toEqual(expect.objectContaining({
      id: '123',
    }));
  });
});
```

### API Mocking (MSW)

```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/wallets/:id', (req, res, ctx) => {
    return res(
      ctx.json({
        data: {
          id: req.params.id,
          balance: 5000,
        },
      })
    );
  }),

  rest.post('/api/payments', async (req, res, ctx) => {
    const body = await req.json();
    if (body.amount > 10000) {
      return res(
        ctx.status(400),
        ctx.json({
          error: {
            code: 'INSUFFICIENT_BALANCE',
            message: 'Insufficient balance',
          },
        })
      );
    }
    return res(ctx.json({ data: { id: 'tx-123' } }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## E2E Testing

### Playwright Setup

```bash
cd admin

# Install Playwright
npm install -D @playwright/test

# Install browsers
npx playwright install
```

### E2E Tests

```typescript
// tests/e2e/payment.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Payment Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name=email]', 'test@example.com');
    await page.fill('[name=password]', 'password');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');
  });

  test('can complete a payment', async ({ page }) => {
    // Navigate to POS
    await page.goto('/pos');

    // Add items
    await page.click('[data-testid=product-beer]');
    await page.click('[data-testid=product-beer]');

    // Check cart
    expect(await page.textContent('[data-testid=cart-total]')).toBe('$10.00');

    // Scan wallet
    await page.click('[data-testid=scan-wallet]');
    await page.fill('[data-testid=wallet-code]', 'WALLET123');
    await page.click('[data-testid=confirm-scan]');

    // Complete payment
    await page.click('[data-testid=complete-payment]');

    // Verify success
    await expect(page.locator('[data-testid=payment-success]')).toBeVisible();
  });
});
```

### Running E2E Tests

```bash
# Run all e2e tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific file
npx playwright test payment.spec.ts

# Generate report
npx playwright show-report
```

## Load Testing

### k6 Setup

```bash
# Install k6
brew install k6
```

### Load Test Script

```javascript
// tests/load/api.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up
    { duration: '5m', target: 50 },   // Steady state
    { duration: '1m', target: 100 },  // Spike
    { duration: '2m', target: 100 },  // Hold spike
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% under 500ms
    errors: ['rate<0.01'],              // Error rate < 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  // Get festival
  const festivalRes = http.get(`${BASE_URL}/api/v1/festivals`);
  check(festivalRes, {
    'festivals status 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);

  // Get wallet
  const walletRes = http.get(`${BASE_URL}/api/v1/me/wallets`, {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },
  });
  check(walletRes, {
    'wallet status 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);
}
```

### Running Load Tests

```bash
# Run load test
k6 run tests/load/api.js

# With environment variables
k6 run -e BASE_URL=https://staging-api.festivals.app -e TOKEN=xxx tests/load/api.js

# Output to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 tests/load/api.js
```

## Test Data Management

### Fixtures

```go
// Backend fixtures
func LoadFixtures(db *sql.DB) error {
    fixtures := []string{
        "fixtures/festivals.sql",
        "fixtures/wallets.sql",
        "fixtures/products.sql",
    }

    for _, f := range fixtures {
        data, err := os.ReadFile(f)
        if err != nil {
            return err
        }
        if _, err := db.Exec(string(data)); err != nil {
            return err
        }
    }
    return nil
}
```

### Factory Functions

```typescript
// Frontend factories
export function createMockWallet(overrides?: Partial<Wallet>): Wallet {
  return {
    id: '123',
    userId: 'user-123',
    festivalId: 'fest-123',
    balance: 5000,
    status: 'active',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockTransaction(overrides?: Partial<Transaction>): Transaction {
  return {
    id: 'tx-123',
    walletId: '123',
    type: 'payment',
    amount: 1500,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.23'

      - name: Run tests
        run: |
          cd backend
          go test -v -cover ./...
        env:
          TEST_DATABASE_URL: postgres://postgres:postgres@localhost:5432/test

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install and test
        run: |
          cd admin
          npm ci
          npm test -- --coverage

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run E2E tests
        run: |
          docker-compose up -d
          npx playwright test
```

## Related Documentation

- [Setup Guide](./SETUP.md)
- [Code Style](./CODE_STYLE.md)
- [Contributing](./CONTRIBUTING.md)
