# Contributing Guidelines

Thank you for your interest in contributing to the Festivals platform! This document provides guidelines for contributing to the project.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please read and follow our Code of Conduct.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Set up the development environment (see [SETUP.md](./SETUP.md))
4. Create a feature branch
5. Make your changes
6. Submit a pull request

## Development Workflow

### Branch Naming

Use descriptive branch names:

```
feature/add-wallet-topup
fix/payment-timeout-error
docs/update-api-documentation
refactor/simplify-auth-middleware
```

### Commit Messages

Follow conventional commit format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(wallet): add QR code payment support

Implement QR code generation for wallet payments.
This allows users to pay by scanning a QR code.

Closes #123
```

```
fix(auth): handle expired refresh tokens

Previously, expired refresh tokens caused a 500 error.
Now returns a proper 401 with TOKEN_EXPIRED code.
```

### Pull Request Process

1. **Create a draft PR** early for visibility
2. **Write a clear description** of what and why
3. **Include testing instructions**
4. **Link related issues**
5. **Request review** when ready
6. **Address feedback** promptly
7. **Keep PR focused** - one feature/fix per PR

### PR Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings

## Related Issues
Closes #123
```

## Code Standards

### Go

- Follow [Effective Go](https://golang.org/doc/effective_go.html)
- Use `golangci-lint` for linting
- Write table-driven tests
- Keep functions small and focused
- Document exported types and functions

```go
// Good
// ProcessPayment handles a payment transaction between a wallet and stand.
// It validates the wallet balance, creates a transaction record,
// and updates the wallet balance atomically.
func (s *WalletService) ProcessPayment(ctx context.Context, req PaymentRequest) (*Transaction, error) {
    // Implementation
}

// Bad - no documentation
func (s *WalletService) ProcessPayment(ctx context.Context, req PaymentRequest) (*Transaction, error) {
    // Implementation
}
```

### TypeScript/React

- Use TypeScript for type safety
- Follow React best practices
- Use functional components with hooks
- Keep components small and focused
- Use Tailwind CSS for styling

```typescript
// Good - typed, clear interface
interface WalletCardProps {
  wallet: Wallet;
  onTopUp: (amount: number) => void;
}

export function WalletCard({ wallet, onTopUp }: WalletCardProps) {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h3>{wallet.festivalName}</h3>
      <p className="text-2xl font-bold">{formatCurrency(wallet.balance)}</p>
      <Button onClick={() => onTopUp(1000)}>Top Up</Button>
    </div>
  );
}
```

### SQL

- Use lowercase keywords
- Use meaningful table and column names
- Always include indexes for foreign keys
- Use transactions for multi-step operations

```sql
-- Good
create table transactions (
    id uuid primary key default gen_random_uuid(),
    wallet_id uuid not null references wallets(id),
    stand_id uuid references stands(id),
    type varchar(20) not null,
    amount integer not null,
    created_at timestamp not null default now()
);

create index idx_transactions_wallet_id on transactions(wallet_id);
create index idx_transactions_created_at on transactions(created_at);
```

## Testing Requirements

### Coverage Targets

| Component | Minimum Coverage |
|-----------|------------------|
| Backend services | 80% |
| Backend handlers | 70% |
| Frontend components | 60% |
| Critical paths | 90% |

### Test Types

1. **Unit Tests** - Test individual functions/components
2. **Integration Tests** - Test service interactions
3. **E2E Tests** - Test complete user flows

### Running Tests

```bash
# Backend
cd backend
go test ./... -v
go test ./... -cover

# Frontend
cd admin
npm test
npm run test:coverage
```

## Documentation

### When to Update Docs

- Adding new API endpoints
- Changing configuration options
- Adding new features
- Changing deployment procedures
- Fixing significant bugs

### Documentation Locations

| Type | Location |
|------|----------|
| API docs | `docs/api/` |
| Deployment | `docs/deployment/` |
| Operations | `docs/operations/` |
| Development | `docs/development/` |

## Review Process

### What Reviewers Look For

1. **Correctness** - Does the code do what it claims?
2. **Design** - Is the approach appropriate?
3. **Readability** - Is the code easy to understand?
4. **Tests** - Are there adequate tests?
5. **Documentation** - Is it documented appropriately?
6. **Security** - Are there security concerns?
7. **Performance** - Are there performance implications?

### Review Response Times

| Priority | Response Time |
|----------|---------------|
| Critical fix | 4 hours |
| Normal PR | 1 business day |
| Documentation | 2 business days |

## Issue Reporting

### Bug Reports

Include:
- Clear title
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details
- Logs/screenshots if applicable

### Feature Requests

Include:
- Clear title
- Use case description
- Proposed solution
- Alternative solutions considered

## Release Process

### Versioning

We use semantic versioning (SemVer):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)

### Release Checklist

1. Update CHANGELOG.md
2. Update version numbers
3. Create release PR
4. Get approval from maintainers
5. Merge and tag release
6. Deploy to staging
7. Run smoke tests
8. Deploy to production

## Getting Help

- Check existing documentation
- Search existing issues
- Ask in the #dev channel
- Create a new issue

## Recognition

Contributors are recognized in:
- CONTRIBUTORS.md file
- Release notes
- Annual contributor awards

Thank you for contributing!
