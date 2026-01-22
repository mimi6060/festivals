# Festivals Backend API

Backend API for the Festivals platform, built with Go.

## Stack

- **Go 1.22+** - Programming language
- **Gin** - HTTP framework
- **GORM** - ORM
- **PostgreSQL** - Database (multi-tenant by schema)
- **Redis** - Cache and job queue
- **Asynq** - Background job processing

## Getting Started

### Prerequisites

- Go 1.22+
- Docker & Docker Compose
- Make

### Development Setup

1. Copy environment file:
```bash
cp .env.example .env
```

2. Start infrastructure:
```bash
docker-compose up -d postgres redis minio
```

3. Run the API:
```bash
make dev
```

### Using Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop all services
docker-compose down
```

## Project Structure

```
backend/
├── cmd/
│   ├── api/          # API entry point
│   └── worker/       # Background worker entry point
├── internal/
│   ├── config/       # Configuration
│   ├── domain/       # Business logic by domain
│   │   ├── auth/
│   │   ├── festival/
│   │   ├── ticket/
│   │   ├── wallet/
│   │   └── ...
│   ├── infrastructure/
│   │   ├── database/
│   │   ├── cache/
│   │   ├── storage/
│   │   └── queue/
│   ├── middleware/
│   └── pkg/
│       ├── validator/
│       ├── response/
│       └── errors/
├── api/              # OpenAPI spec
├── scripts/          # Database scripts
├── Dockerfile
├── Makefile
└── go.mod
```

## API Endpoints

### Health
- `GET /health` - Health check

### Public
- `GET /api/v1/festivals/:id/public` - Public festival info

### Protected (requires JWT)
- `GET /api/v1/me` - Current user info
- `GET /api/v1/me/wallet` - User wallet

### Festival-scoped (requires tenant)
- `GET /api/v1/festivals/:festivalId` - Festival info

## Multi-tenancy

Each festival has its own PostgreSQL schema (`festival_<uuid>`).
The tenant middleware automatically sets the search_path based on the festival ID.

## License

Proprietary - All rights reserved
