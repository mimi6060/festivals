# System Architecture

This document provides an overview of the Festivals platform architecture.

## High-Level Overview

```mermaid
graph TB
    subgraph "Clients"
        MOBILE[Mobile App]
        WEB[Admin Dashboard]
        POS[POS Devices]
    end

    subgraph "Edge"
        CDN[CloudFront CDN]
        LB[Load Balancer]
    end

    subgraph "Application Layer"
        API[API Service]
        WORKER[Background Worker]
        WS[WebSocket Server]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL)]
        REDIS[(Redis)]
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

## Components

### Mobile Application

- **Technology:** React Native + Expo
- **Features:**
  - Attendee wallet and payments
  - Ticket management
  - Festival information
  - Offline support

### Admin Dashboard

- **Technology:** Next.js 14 + TypeScript
- **Features:**
  - Festival management
  - Analytics and reporting
  - User management
  - Real-time monitoring

### Backend API

- **Technology:** Go + Gin
- **Features:**
  - RESTful API
  - JWT authentication
  - Rate limiting
  - Request validation

### Background Worker

- **Technology:** Go + Asynq
- **Features:**
  - Email/SMS notifications
  - Report generation
  - Data synchronization
  - Scheduled tasks

## Domain Model

```mermaid
erDiagram
    FESTIVAL ||--o{ WALLET : has
    FESTIVAL ||--o{ STAND : has
    FESTIVAL ||--o{ TICKET_TYPE : has
    FESTIVAL ||--o{ LINEUP : has

    USER ||--o{ WALLET : owns
    USER ||--o{ TICKET : owns

    WALLET ||--o{ TRANSACTION : has
    WALLET ||--o{ NFC_TAG : linked_to

    STAND ||--o{ PRODUCT : sells
    STAND ||--o{ TRANSACTION : receives

    TICKET_TYPE ||--o{ TICKET : creates

    FESTIVAL {
        uuid id PK
        string name
        datetime start_date
        datetime end_date
        string status
    }

    WALLET {
        uuid id PK
        uuid festival_id FK
        uuid user_id FK
        int balance
        string status
    }

    TRANSACTION {
        uuid id PK
        uuid wallet_id FK
        uuid stand_id FK
        string type
        int amount
    }

    STAND {
        uuid id PK
        uuid festival_id FK
        string name
        string type
    }

    TICKET {
        uuid id PK
        uuid ticket_type_id FK
        uuid user_id FK
        string code
        string status
    }
```

## Backend Architecture

### Layer Structure

```
┌─────────────────────────────────────────┐
│              HTTP Handler                │
│  (Request parsing, response formatting)  │
├─────────────────────────────────────────┤
│              Middleware                  │
│  (Auth, logging, rate limiting, etc.)   │
├─────────────────────────────────────────┤
│               Service                    │
│     (Business logic, validation)         │
├─────────────────────────────────────────┤
│              Repository                  │
│         (Data access layer)              │
├─────────────────────────────────────────┤
│             Infrastructure               │
│   (Database, cache, external services)   │
└─────────────────────────────────────────┘
```

### Domain-Driven Design

Each domain follows a consistent structure:

```
internal/domain/wallet/
├── model.go        # Domain entities and value objects
├── repository.go   # Repository interface
├── service.go      # Business logic
├── handler.go      # HTTP handlers
└── service_test.go # Unit tests
```

### Request Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant M as Middleware
    participant H as Handler
    participant S as Service
    participant R as Repository
    participant DB as Database

    C->>M: HTTP Request
    M->>M: Auth validation
    M->>M: Rate limiting
    M->>M: Request logging
    M->>H: Validated request
    H->>H: Parse & validate body
    H->>S: Call service method
    S->>S: Business logic
    S->>R: Data operation
    R->>DB: SQL query
    DB-->>R: Result
    R-->>S: Domain objects
    S-->>H: Result
    H-->>C: JSON response
```

## Data Architecture

### PostgreSQL

Primary data store for all persistent data.

**Key tables:**
- `festivals` - Festival information
- `wallets` - User wallets with balances
- `transactions` - Payment history
- `tickets` - Ticket inventory
- `stands` - Vendor information
- `products` - Product catalog

**Optimizations:**
- Partitioned tables for transactions (by date)
- Indexes on frequently queried columns
- Connection pooling with PgBouncer

### Redis

Used for caching and real-time features.

**Use cases:**
- Session storage
- API response caching
- Rate limiting counters
- Real-time pub/sub
- Job queue (Asynq)

### S3/MinIO

Object storage for media files.

**Stored content:**
- Festival images
- Product photos
- QR code images
- Export files

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as App
    participant AUTH0 as Auth0
    participant API as API

    U->>A: Login
    A->>AUTH0: Authenticate
    AUTH0-->>A: Access Token + Refresh Token
    A->>API: Request with Bearer Token
    API->>API: Validate JWT (JWKS cache)
    API->>API: Extract claims
    API-->>A: Response
```

### Token Claims

Custom claims added via Auth0 Actions:

```json
{
  "sub": "auth0|123456",
  "https://festivals.app/roles": ["ORGANIZER"],
  "https://festivals.app/festival_id": "fest-123",
  "https://festivals.app/stand_ids": ["stand-456"]
}
```

## Payment Flow

```mermaid
sequenceDiagram
    participant POS as POS Device
    participant API as API
    participant DB as Database
    participant STRIPE as Stripe

    Note over POS,API: NFC/QR Payment
    POS->>API: POST /payments
    API->>DB: Check wallet balance
    DB-->>API: Balance: 5000
    API->>DB: BEGIN TRANSACTION
    API->>DB: Debit wallet
    API->>DB: Create transaction
    API->>DB: COMMIT
    API-->>POS: Payment success

    Note over POS,STRIPE: Top-up with Card
    POS->>API: POST /topups
    API->>STRIPE: Create PaymentIntent
    STRIPE-->>API: Payment confirmed
    API->>DB: Credit wallet
    API-->>POS: Top-up success
```

## Offline Support

The platform supports offline operations for areas with poor connectivity.

```mermaid
sequenceDiagram
    participant POS as POS Device
    participant LOCAL as Local Storage
    participant API as API

    Note over POS,LOCAL: Offline Mode
    POS->>LOCAL: Queue transaction
    LOCAL-->>POS: Stored locally

    Note over POS,API: Back Online
    POS->>LOCAL: Get pending transactions
    LOCAL-->>POS: Transactions list
    POS->>API: POST /sync/batch
    API->>API: Validate signatures
    API->>API: Process transactions
    API-->>POS: Sync result
```

### Offline Security

- Transactions signed with device key
- Balance limits enforced locally
- Timestamp validation on sync
- Conflict resolution for double-spends

## Scalability

### Horizontal Scaling

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Nginx/ALB]
    end

    subgraph "API Pods"
        API1[API Pod 1]
        API2[API Pod 2]
        API3[API Pod N]
    end

    subgraph "Worker Pods"
        W1[Worker 1]
        W2[Worker 2]
        W3[Worker N]
    end

    LB --> API1
    LB --> API2
    LB --> API3
```

### Scaling Triggers

| Metric | Scale Up | Scale Down |
|--------|----------|------------|
| CPU | > 70% | < 30% |
| Memory | > 80% | < 40% |
| Queue Length | > 100 | < 10 |
| Request Rate | > 1000 rps | < 200 rps |

## Security Architecture

### Defense in Depth

```
┌─────────────────────────────────────────┐
│         WAF (Web Application Firewall)   │
├─────────────────────────────────────────┤
│         Rate Limiting (per IP/User)      │
├─────────────────────────────────────────┤
│         Authentication (JWT/API Key)     │
├─────────────────────────────────────────┤
│         Authorization (RBAC)             │
├─────────────────────────────────────────┤
│         Input Validation                 │
├─────────────────────────────────────────┤
│         Encrypted Data (TLS, at-rest)    │
└─────────────────────────────────────────┘
```

### Data Protection

- TLS 1.3 for all communications
- AES-256 encryption at rest
- PII handled according to GDPR
- PCI-DSS compliant payment handling

## Observability

### Three Pillars

```mermaid
graph LR
    subgraph "Metrics"
        PROM[Prometheus]
        GRAFANA[Grafana]
    end

    subgraph "Logs"
        LOKI[Loki]
    end

    subgraph "Traces"
        JAEGER[Jaeger]
    end

    APP[Application] --> PROM
    APP --> LOKI
    APP --> JAEGER
    PROM --> GRAFANA
    LOKI --> GRAFANA
    JAEGER --> GRAFANA
```

### Key Metrics

- Request rate and latency (RED method)
- Error rates by endpoint
- Database connection pool
- Cache hit rates
- Business metrics (transactions, scans)

## Technology Stack Summary

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

## Related Documentation

- [Local Setup](./SETUP.md)
- [API Documentation](../api/)
- [Deployment](../deployment/)
