# Local Development Setup

This guide covers setting up a local development environment for the Festivals platform.

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Go | 1.23+ | Backend API |
| Node.js | 20+ | Admin dashboard |
| Docker | 24+ | Local services |
| Docker Compose | 2.20+ | Service orchestration |
| Git | 2.40+ | Version control |

### Optional Tools

| Tool | Purpose |
|------|---------|
| Make | Build automation |
| direnv | Environment management |
| golangci-lint | Go linting |
| Postman | API testing |

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/festivals.git
cd festivals
```

### 2. Environment Setup

```bash
# Copy environment templates
cp .env.example .env
cp admin/.env.example admin/.env.local

# Edit environment variables
vim .env
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL, Redis, MinIO
docker-compose up -d postgres redis minio

# Wait for services to be ready
docker-compose logs -f postgres  # Wait for "ready to accept connections"
```

### 4. Start Backend API

```bash
cd backend

# Install dependencies
go mod download

# Run database migrations
go run cmd/migrate/main.go up

# Start the API server
go run cmd/api/main.go
```

API available at: http://localhost:8080

### 5. Start Admin Dashboard

```bash
cd admin

# Install dependencies
npm install

# Start development server
npm run dev
```

Admin available at: http://localhost:3000

## Detailed Setup

### Backend API

#### Directory Structure

```
backend/
├── cmd/
│   ├── api/            # API entry point
│   └── worker/         # Background worker
├── internal/
│   ├── config/         # Configuration
│   ├── domain/         # Business logic
│   │   ├── festival/
│   │   ├── wallet/
│   │   ├── ticket/
│   │   └── ...
│   ├── infrastructure/ # External services
│   │   ├── database/
│   │   ├── cache/
│   │   └── storage/
│   ├── middleware/     # HTTP middleware
│   └── pkg/            # Shared packages
├── tests/              # Integration tests
└── go.mod
```

#### Running with Hot Reload

```bash
# Install air for hot reload
go install github.com/cosmtrek/air@latest

# Run with hot reload
air
```

#### Environment Variables

```bash
# .env
PORT=8080
ENVIRONMENT=development
LOG_LEVEL=debug
LOG_FORMAT=console

DATABASE_URL=postgres://festivals:password@localhost:5432/festivals?sslmode=disable
REDIS_URL=redis://localhost:6379

AUTH0_DOMAIN=dev-tenant.auth0.com
AUTH0_AUDIENCE=https://api.festivals.dev

MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
MINIO_BUCKET=festivals-dev
```

### Admin Dashboard

#### Directory Structure

```
admin/
├── src/
│   ├── app/            # Next.js App Router
│   │   ├── (auth)/     # Authentication pages
│   │   ├── (dashboard)/ # Dashboard pages
│   │   └── api/        # API routes
│   ├── components/     # React components
│   ├── lib/            # Utilities
│   └── styles/         # CSS/Tailwind
├── public/             # Static assets
└── package.json
```

#### Environment Variables

```bash
# admin/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8080

AUTH0_SECRET=development-secret-at-least-32-chars
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://dev-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
```

### Mobile App

#### Directory Structure

```
mobile/
├── app/                # Expo Router pages
│   ├── (tabs)/         # Tab navigation
│   ├── (auth)/         # Auth screens
│   └── (staff)/        # Staff features
├── components/         # React Native components
├── hooks/              # Custom hooks
├── services/           # API services
└── package.json
```

#### Setup

```bash
cd mobile

# Install dependencies
npm install

# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

## Database Setup

### Initial Schema

```bash
# Run migrations
cd backend
go run cmd/migrate/main.go up

# Or using Docker
docker-compose exec api go run cmd/migrate/main.go up
```

### Seed Data

```bash
# Load development seed data
go run cmd/seed/main.go

# This creates:
# - Test festival
# - Test users (admin, organizer, staff, user)
# - Sample products and stands
```

### Reset Database

```bash
# Drop and recreate
docker-compose exec postgres psql -U festivals -c "DROP DATABASE festivals;"
docker-compose exec postgres psql -U festivals -c "CREATE DATABASE festivals;"

# Re-run migrations
go run cmd/migrate/main.go up
go run cmd/seed/main.go
```

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run specific package
go test ./internal/domain/wallet/...

# Run integration tests (requires database)
go test -tags=integration ./tests/...
```

### Admin Tests

```bash
cd admin

# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run e2e tests
npm run test:e2e
```

### Mobile Tests

```bash
cd mobile

# Run tests
npm test
```

## Docker Development

### Full Stack

```bash
# Start all services with hot reload
docker-compose up

# View logs
docker-compose logs -f api

# Rebuild after changes
docker-compose up --build api
```

### Accessing Services

| Service | URL |
|---------|-----|
| API | http://localhost:8080 |
| Admin | http://localhost:3000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| MinIO Console | http://localhost:9001 |
| Adminer | http://localhost:8082 |

### Database Access

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U festivals

# Or use Adminer
# http://localhost:8082
# System: PostgreSQL
# Server: postgres
# Username: festivals
# Password: password
# Database: festivals
```

## IDE Setup

### VS Code

Recommended extensions:

```json
// .vscode/extensions.json
{
  "recommendations": [
    "golang.go",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma"
  ]
}
```

Settings:

```json
// .vscode/settings.json
{
  "go.lintTool": "golangci-lint",
  "go.lintFlags": ["--fast"],
  "editor.formatOnSave": true,
  "[go]": {
    "editor.defaultFormatter": "golang.go"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### GoLand/WebStorm

- Enable Go modules support
- Configure ESLint and Prettier
- Set up run configurations for API and Admin

## Common Tasks

### Generate API Client

```bash
# Generate TypeScript client from OpenAPI spec
npx openapi-typescript docs/api/openapi.yaml -o admin/src/lib/api/types.ts
```

### Add Database Migration

```bash
cd backend

# Create new migration
go run cmd/migrate/main.go create add_feature_table

# Edit the migration file
vim migrations/YYYYMMDDHHMMSS_add_feature_table.sql

# Apply migration
go run cmd/migrate/main.go up
```

### Update Dependencies

```bash
# Backend
cd backend
go get -u ./...
go mod tidy

# Admin
cd admin
npm update

# Mobile
cd mobile
npm update
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :8080

# Kill process
kill -9 <PID>
```

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Module Not Found (Go)

```bash
# Clear module cache
go clean -modcache

# Re-download dependencies
go mod download
```

### Node Modules Issues

```bash
# Remove and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Related Documentation

- [Architecture](./ARCHITECTURE.md)
- [Testing Guide](./TESTING.md)
- [Contributing](./CONTRIBUTING.md)
- [Code Style](./CODE_STYLE.md)
