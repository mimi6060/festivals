# Festivals Platform

A complete festival management platform with cashless payments, ticketing, and real-time analytics.

## Architecture Overview

```mermaid
graph TB
    subgraph "Clients"
        MOBILE[Mobile App<br/>React Native + Expo]
        WEB[Admin Dashboard<br/>Next.js 14]
        POS[POS Devices]
    end

    subgraph "Edge Layer"
        CDN[CloudFront CDN]
        LB[Load Balancer]
    end

    subgraph "Application Layer"
        API[API Service<br/>Go + Gin]
        WORKER[Background Worker<br/>Go + Asynq]
        WS[WebSocket Server]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL 16)]
        REDIS[(Redis 7)]
        S3[(S3/MinIO)]
    end

    subgraph "External Services"
        AUTH0[Auth0]
        STRIPE[Stripe]
        TWILIO[Twilio]
        FIREBASE[Firebase]
    end

    MOBILE --> CDN
    WEB --> CDN
    POS --> LB
    CDN --> LB
    LB --> API
    LB --> WS
    API --> PG
    API --> REDIS
    API --> S3
    API --> AUTH0
    API --> STRIPE
    WORKER --> PG
    WORKER --> REDIS
    WORKER --> TWILIO
    WORKER --> FIREBASE
```

## Features

- **Cashless Payments** - NFC wristbands and QR code payments
- **Digital Wallets** - Top-up, balance management, refunds
- **Ticketing** - Multi-tier tickets with QR validation
- **Lineup Management** - Artist schedules and stages
- **Real-time Analytics** - Live dashboards and reports
- **Offline Support** - Works without connectivity
- **Multi-festival** - Manage multiple events

## Quick Start

### Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| Go | 1.23+ | Backend API |
| Node.js | 20+ | Admin & Mobile |
| Docker | 24+ | Local services |
| Docker Compose | 2.20+ | Orchestration |

### 1. Clone and Setup

```bash
git clone https://github.com/your-org/festivals.git
cd festivals

# Copy environment files
cp .env.example .env
cp admin/.env.example admin/.env.local
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL, Redis, MinIO
docker-compose up -d postgres redis minio

# Wait for services to be ready
docker-compose logs -f postgres
```

### 3. Start Backend API

```bash
cd backend

# Install dependencies and run migrations
go mod download
go run cmd/migrate/main.go up

# Seed development data
go run cmd/seed/main.go

# Start API server
go run cmd/api/main.go
```

API available at: http://localhost:8080

### 4. Start Admin Dashboard

```bash
cd admin

npm install
npm run dev
```

Admin available at: http://localhost:3000

### 5. Start Mobile App (Optional)

```bash
cd mobile

npm install
npm start
```

## Project Structure

```
festivals/
├── backend/                 # Go backend
│   ├── cmd/
│   │   ├── api/            # API entry point
│   │   └── worker/         # Background worker
│   ├── internal/
│   │   ├── config/         # Configuration
│   │   ├── domain/         # Business logic (DDD)
│   │   │   ├── festival/
│   │   │   ├── wallet/
│   │   │   ├── ticket/
│   │   │   └── ...
│   │   ├── infrastructure/ # External services
│   │   └── middleware/     # HTTP middleware
│   └── tests/              # Integration tests
├── admin/                   # Next.js admin dashboard
│   └── src/
│       ├── app/            # App Router pages
│       ├── components/     # React components
│       └── lib/            # Utilities
├── mobile/                  # React Native app
│   ├── app/                # Expo Router
│   └── components/         # RN components
├── helm/                    # Kubernetes Helm charts
├── docs/                    # Documentation
└── docker-compose.yml       # Local development
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Mobile | React Native, Expo, TypeScript |
| Admin | Next.js 14, TypeScript, Tailwind CSS |
| API | Go 1.23, Gin, GORM |
| Worker | Go, Asynq |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Storage | S3/MinIO |
| Auth | Auth0 |
| Payments | Stripe |
| Container | Docker, Kubernetes |
| CI/CD | GitHub Actions |
| Monitoring | Prometheus, Grafana, Loki |

## Documentation

### Development
- [Setup Guide](docs/development/SETUP.md) - Local development setup
- [Architecture](docs/development/ARCHITECTURE.md) - System design
- [Contributing](docs/development/CONTRIBUTING.md) - How to contribute
- [Testing](docs/development/TESTING.md) - Testing guide
- [Code Style](docs/development/CODE_STYLE.md) - Coding standards

### API
- [API Overview](docs/api/README.md) - API introduction
- [Authentication](docs/api/authentication.md) - Auth0 JWT setup
- [Errors](docs/api/errors.md) - Error handling
- [Rate Limiting](docs/api/rate-limiting.md) - Rate limits
- [Webhooks](docs/api/webhooks.md) - Webhook events
- [Versioning](docs/api/VERSIONING.md) - API versions

### Deployment
- [Docker](docs/deployment/docker.md) - Container setup
- [Kubernetes](docs/deployment/kubernetes.md) - K8s deployment
- [AWS](docs/deployment/AWS.md) - AWS deployment
- [Environment](docs/deployment/ENVIRONMENT.md) - Configuration
- [Scaling](docs/deployment/scaling.md) - Scaling strategies
- [Backup](docs/deployment/backup.md) - Backup procedures

### Operations
- [Monitoring](docs/operations/MONITORING.md) - Metrics & dashboards
- [Logging](docs/operations/LOGGING.md) - Log management
- [Alerting](docs/operations/ALERTING.md) - Alert configuration
- [Runbook](docs/operations/RUNBOOK.md) - Operational procedures
- [Disaster Recovery](docs/operations/DISASTER_RECOVERY.md) - DR guide

### SDK
- [JavaScript SDK](docs/sdk/JAVASCRIPT.md) - JS/TS integration
- [Mobile SDK](docs/sdk/MOBILE.md) - Mobile integration

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/festivals` | List festivals |
| `GET /api/v1/festivals/:id` | Get festival details |
| `POST /api/v1/wallets/:id/topup` | Top up wallet |
| `POST /api/v1/payments` | Process payment |
| `GET /api/v1/tickets` | List user tickets |
| `POST /api/v1/tickets/:id/validate` | Validate ticket |

Full API documentation: [OpenAPI Spec](docs/api/openapi.yaml)

## Environment Variables

### Backend

```bash
PORT=8080
ENVIRONMENT=development
DATABASE_URL=postgres://festivals:password@localhost:5432/festivals
REDIS_URL=redis://localhost:6379
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.festivals.app
STRIPE_SECRET_KEY=sk_test_xxx
```

### Admin Dashboard

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
AUTH0_SECRET=your-secret
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
```

See [Environment Guide](docs/deployment/ENVIRONMENT.md) for complete reference.

## Testing

```bash
# Backend tests
cd backend
go test ./...
go test -cover ./...

# Admin tests
cd admin
npm test
npm run test:coverage

# E2E tests
npm run test:e2e
```

See [Testing Guide](docs/development/TESTING.md) for details.

## Deployment

### Docker Compose (Development)

```bash
docker-compose up
```

### Kubernetes (Production)

```bash
helm install festivals ./helm/festivals \
  --namespace festivals \
  --values values-production.yaml
```

See [Deployment Guide](docs/deployment/kubernetes.md) for production setup.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [Contributing Guide](docs/development/CONTRIBUTING.md) for details.

## License

This project is proprietary software. All rights reserved.

## Support

- Documentation: [docs/](docs/)
- Issues: GitHub Issues
- Email: support@festivals.app
