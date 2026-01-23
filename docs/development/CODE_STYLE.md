# Code Style Guide

This document defines coding standards and best practices for the Festivals platform.

## General Principles

1. **Readability** - Code is read more than written
2. **Simplicity** - Prefer simple solutions over clever ones
3. **Consistency** - Follow established patterns
4. **Documentation** - Document the "why", not the "what"

## Go (Backend)

### Formatting

Use `gofmt` and `goimports` for all Go code.

```bash
# Format code
gofmt -w .
goimports -w .

# Or use golangci-lint
golangci-lint run --fix
```

### Naming Conventions

```go
// Package names: lowercase, single word
package wallet

// Interfaces: verb or noun, -er suffix for single method
type Reader interface {
    Read(p []byte) (n int, err error)
}

type WalletRepository interface {
    FindByID(ctx context.Context, id string) (*Wallet, error)
    Save(ctx context.Context, wallet *Wallet) error
}

// Structs: nouns, PascalCase
type WalletService struct {
    repo   WalletRepository
    cache  Cache
    logger *zerolog.Logger
}

// Functions/Methods: verb prefix for actions
func (s *WalletService) ProcessPayment(ctx context.Context, req PaymentRequest) (*Transaction, error)
func (s *WalletService) GetBalance(ctx context.Context, walletID string) (int, error)

// Constants: PascalCase for exported, camelCase for unexported
const MaxBalance = 100000
const defaultTimeout = 30 * time.Second

// Variables: camelCase
var totalTransactions int
```

### Error Handling

```go
// Good: Wrap errors with context
if err := s.repo.Save(ctx, wallet); err != nil {
    return fmt.Errorf("failed to save wallet: %w", err)
}

// Good: Define domain errors
var (
    ErrInsufficientBalance = errors.New("insufficient balance")
    ErrWalletFrozen        = errors.New("wallet is frozen")
)

// Good: Use error types for complex errors
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// Bad: Ignoring errors
wallet, _ := s.repo.FindByID(ctx, id) // DON'T DO THIS

// Bad: Generic error messages
return errors.New("error") // Not helpful
```

### Context Usage

```go
// Good: Pass context as first parameter
func (s *WalletService) GetBalance(ctx context.Context, walletID string) (int, error)

// Good: Use context for cancellation and timeouts
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()

// Good: Extract values from context
userID := middleware.GetUserID(ctx)

// Bad: Using context.Background() when you have a context
result, err := s.repo.Find(context.Background(), id) // Pass the ctx
```

### Struct Organization

```go
// Good: Group related fields, add comments for sections
type WalletService struct {
    // Dependencies
    repo   WalletRepository
    cache  Cache
    events EventPublisher

    // Configuration
    maxBalance     int
    topupLimit     int
    refundDeadline time.Duration

    // Internal state
    mu     sync.RWMutex
    logger *zerolog.Logger
}

// Good: Use constructor functions
func NewWalletService(repo WalletRepository, cache Cache, opts ...Option) *WalletService {
    s := &WalletService{
        repo:       repo,
        cache:      cache,
        maxBalance: DefaultMaxBalance,
    }
    for _, opt := range opts {
        opt(s)
    }
    return s
}
```

### Testing

```go
// Good: Table-driven tests with descriptive names
func TestProcessPayment(t *testing.T) {
    tests := []struct {
        name    string
        balance int
        amount  int
        wantErr bool
    }{
        {"sufficient balance", 5000, 1500, false},
        {"exact balance", 1500, 1500, false},
        {"insufficient balance", 1000, 1500, true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // ...
        })
    }
}

// Good: Use testify for assertions
assert.Equal(t, expected, actual)
assert.NoError(t, err)
require.NotNil(t, result) // Fails immediately
```

## TypeScript/React

### Formatting

Use Prettier with the following configuration:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Naming Conventions

```typescript
// Components: PascalCase
export function WalletCard({ wallet }: WalletCardProps) {}

// Hooks: camelCase with "use" prefix
export function useWallet(walletId: string) {}

// Types/Interfaces: PascalCase
interface WalletCardProps {
  wallet: Wallet;
  onTopUp: (amount: number) => void;
}

// Constants: SCREAMING_SNAKE_CASE for truly constant values
const MAX_BALANCE = 100000;
const API_BASE_URL = '/api/v1';

// Functions: camelCase, verb prefix for actions
function processPayment(request: PaymentRequest): Promise<Transaction> {}
function formatCurrency(amount: number): string {}

// Boolean variables/props: "is", "has", "should" prefix
const isLoading = true;
const hasError = false;
interface Props {
  isDisabled?: boolean;
  shouldAutoFocus?: boolean;
}
```

### Component Structure

```typescript
// Good: Consistent component structure
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import type { Wallet } from '@/types';

// 1. Types at the top
interface WalletCardProps {
  wallet: Wallet;
  onTopUp: (amount: number) => void;
  className?: string;
}

// 2. Component function
export function WalletCard({ wallet, onTopUp, className }: WalletCardProps) {
  // 3. Hooks first
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

  // 4. Derived values
  const formattedBalance = formatCurrency(wallet.balance);
  const isFrozen = wallet.status === 'frozen';

  // 5. Event handlers
  const handleTopUp = (amount: number) => {
    onTopUp(amount);
    setIsTopUpOpen(false);
  };

  // 6. Return JSX
  return (
    <div className={className}>
      <h3>{wallet.festivalName}</h3>
      <p className="text-2xl font-bold">{formattedBalance}</p>
      <Button onClick={() => setIsTopUpOpen(true)} disabled={isFrozen}>
        Top Up
      </Button>
    </div>
  );
}
```

### Hooks

```typescript
// Good: Custom hooks for reusable logic
export function useWallet(walletId: string) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchWallet() {
      try {
        const data = await api.getWallet(walletId);
        setWallet(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetchWallet();
  }, [walletId]);

  return { wallet, loading, error };
}

// Good: Memoization for expensive computations
const sortedTransactions = useMemo(
  () => transactions.sort((a, b) => b.createdAt - a.createdAt),
  [transactions]
);

// Good: useCallback for stable function references
const handleSubmit = useCallback(
  (data: FormData) => {
    onSubmit(data);
  },
  [onSubmit]
);
```

### Type Safety

```typescript
// Good: Explicit types for function parameters and return values
async function createFestival(data: CreateFestivalInput): Promise<Festival> {
  const response = await api.post('/festivals', data);
  return response.data;
}

// Good: Use type guards
function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

// Good: Use discriminated unions
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

// Good: Avoid `any`
// Bad
function process(data: any) { ... }

// Good
function process(data: unknown) {
  if (isValidData(data)) {
    // data is now typed
  }
}
```

## SQL

### Formatting

```sql
-- Good: Lowercase keywords, consistent indentation
select
    w.id,
    w.balance,
    w.status,
    count(t.id) as transaction_count
from wallets w
left join transactions t on t.wallet_id = w.id
where w.festival_id = $1
    and w.status = 'active'
group by w.id
having count(t.id) > 0
order by w.created_at desc
limit 100;

-- Good: Use meaningful aliases
from wallets w
join users u on u.id = w.user_id
join festivals f on f.id = w.festival_id

-- Bad: Single letter without meaning
from wallets a
join users b on b.id = a.user_id
```

### Naming Conventions

```sql
-- Tables: plural, snake_case
create table transactions (
    -- Columns: snake_case
    id uuid primary key,
    wallet_id uuid not null,
    created_at timestamp not null default now()
);

-- Indexes: idx_{table}_{column(s)}
create index idx_transactions_wallet_id on transactions(wallet_id);
create index idx_transactions_created_at on transactions(created_at);

-- Foreign keys: fk_{table}_{referenced_table}
alter table transactions
    add constraint fk_transactions_wallet
    foreign key (wallet_id) references wallets(id);
```

### Best Practices

```sql
-- Good: Always use parameterized queries
select * from users where id = $1;  -- Go
select * from users where id = ?;   -- Some ORMs

-- Bad: String concatenation (SQL injection risk)
select * from users where id = '" + userId + "';

-- Good: Use transactions for multiple operations
begin;
update wallets set balance = balance - 1500 where id = $1;
insert into transactions (wallet_id, amount, type) values ($1, -1500, 'payment');
commit;

-- Good: Use explicit column lists
insert into wallets (user_id, festival_id, balance)
values ($1, $2, 0);

-- Bad: Relying on column order
insert into wallets values ($1, $2, $3, $4);
```

## Git

### Commit Messages

```
# Format
<type>(<scope>): <subject>

<body>

<footer>

# Types
feat:     New feature
fix:      Bug fix
docs:     Documentation
style:    Formatting (no code change)
refactor: Code refactoring
test:     Adding tests
chore:    Maintenance

# Examples
feat(wallet): add QR code payment support

Implement QR code generation for wallet payments.
The QR code contains a signed payload for offline validation.

Closes #123

---

fix(auth): handle expired refresh tokens correctly

Previously, expired refresh tokens caused a 500 error.
Now returns a proper 401 with TOKEN_EXPIRED code.

---

refactor(payment): extract validation logic

Move payment validation to separate function
for better testability and reuse.
```

### Branch Names

```
feature/wallet-topup-limits
fix/payment-timeout-handling
docs/api-authentication
refactor/simplify-middleware
```

## Linting Configuration

### golangci-lint (.golangci.yml)

```yaml
linters:
  enable:
    - errcheck
    - gosimple
    - govet
    - ineffassign
    - staticcheck
    - unused
    - gofmt
    - goimports
    - misspell
    - unconvert
    - gocritic

linters-settings:
  gocritic:
    enabled-tags:
      - diagnostic
      - style
      - performance

issues:
  exclude-rules:
    - path: _test\.go
      linters:
        - errcheck
```

### ESLint (.eslintrc.js)

```javascript
module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    'react/prop-types': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
```

## Editor Configuration (.editorconfig)

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.go]
indent_style = tab
indent_size = 4

[*.md]
trim_trailing_whitespace = false
```

## Related Documentation

- [Setup Guide](./SETUP.md)
- [Testing Guide](./TESTING.md)
- [Contributing](./CONTRIBUTING.md)
