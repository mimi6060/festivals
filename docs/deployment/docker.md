# Docker Deployment Guide

This guide covers deploying the Festivals platform using Docker and Docker Compose.

## Prerequisites

- Docker 24.0+
- Docker Compose 2.20+
- 4GB RAM minimum
- 20GB disk space

## Quick Start

```bash
# Start development environment
docker compose up -d

# Start production environment
docker compose -f docker-compose.prod.yml up -d
```

## Docker Compose Setup

### Development Configuration

The development setup (`docker-compose.yml`) includes:

- Hot-reload for backend code
- Development databases with sample data
- Debug-friendly logging
- Exposed ports for local debugging

```yaml
# docker-compose.yml structure
services:
  api:          # Backend API with hot reload
  admin:        # Next.js admin dashboard
  postgres:     # PostgreSQL database
  redis:        # Redis cache/queue
  minio:        # S3-compatible storage
  adminer:      # Database UI
```

**Start development environment:**

```bash
# Start all services
docker compose up -d

# Start specific services
docker compose up -d api postgres redis

# View logs
docker compose logs -f api

# Rebuild after code changes
docker compose up -d --build api
```

### Production Configuration

The production setup (`docker-compose.prod.yml`) includes:

- Optimized builds
- Resource limits
- Health checks
- Restart policies
- Production logging

```bash
# Create production .env file
cat > .env.prod << 'EOF'
# Database
DATABASE_URL=postgres://festivals:${DB_PASSWORD}@postgres:5432/festivals?sslmode=disable
POSTGRES_USER=festivals
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=festivals

# Redis
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
REDIS_PASSWORD=your-redis-password

# Auth0
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.festivals.app
AUTH0_SECRET=your-auth0-secret
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Storage
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET=festivals

# URLs
API_URL=https://api.festivals.app
ADMIN_URL=https://admin.festivals.app
EOF

# Start production services
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

## Environment Variables

### API Service

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 8080) |
| `ENVIRONMENT` | No | Environment name |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `AUTH0_DOMAIN` | Yes | Auth0 tenant domain |
| `AUTH0_AUDIENCE` | Yes | Auth0 API audience |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook secret |
| `MINIO_ENDPOINT` | Yes | MinIO/S3 endpoint |
| `MINIO_ACCESS_KEY` | Yes | MinIO/S3 access key |
| `MINIO_SECRET_KEY` | Yes | MinIO/S3 secret key |
| `MINIO_BUCKET` | Yes | Storage bucket name |
| `LOG_LEVEL` | No | Log level (default: info) |
| `LOG_FORMAT` | No | Log format (default: json) |

### Admin Service

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | No | Node environment |
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |
| `AUTH0_SECRET` | Yes | Auth0 session secret |
| `AUTH0_BASE_URL` | Yes | Admin app base URL |
| `AUTH0_ISSUER_BASE_URL` | Yes | Auth0 issuer URL |
| `AUTH0_CLIENT_ID` | Yes | Auth0 client ID |
| `AUTH0_CLIENT_SECRET` | Yes | Auth0 client secret |

### Database Service

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_USER` | Yes | Database username |
| `POSTGRES_PASSWORD` | Yes | Database password |
| `POSTGRES_DB` | Yes | Database name |

## Volume Management

### Volume Definitions

```yaml
volumes:
  postgres_data:    # Database files
  redis_data:       # Redis persistence
  minio_data:       # Object storage
  go_modules:       # Go module cache (dev only)
```

### Backup Volumes

```bash
# List volumes
docker volume ls | grep festivals

# Backup PostgreSQL data
docker run --rm \
  -v festivals_postgres_data:/source:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres-$(date +%Y%m%d).tar.gz -C /source .

# Backup Redis data
docker run --rm \
  -v festivals_redis_data:/source:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/redis-$(date +%Y%m%d).tar.gz -C /source .

# Backup MinIO data
docker run --rm \
  -v festivals_minio_data:/source:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/minio-$(date +%Y%m%d).tar.gz -C /source .
```

### Restore Volumes

```bash
# Stop services
docker compose down

# Restore PostgreSQL data
docker run --rm \
  -v festivals_postgres_data:/target \
  -v $(pwd)/backups:/backup \
  alpine sh -c "rm -rf /target/* && tar xzf /backup/postgres-20240115.tar.gz -C /target"

# Restart services
docker compose up -d
```

### Volume Cleanup

```bash
# Remove unused volumes (WARNING: destructive)
docker volume prune

# Remove specific volume
docker volume rm festivals_postgres_data

# Remove all project volumes
docker compose down -v
```

## Building Images

### Build All Images

```bash
# Development builds
docker compose build

# Production builds
docker compose -f docker-compose.prod.yml build

# Build specific service
docker compose build api

# Build with no cache
docker compose build --no-cache api
```

### Multi-Architecture Builds

```bash
# Setup buildx
docker buildx create --name multiarch --use

# Build for multiple architectures
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/your-org/festivals-api:latest \
  --push \
  ./backend
```

### Push to Registry

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag and push
docker tag festivals-api:latest ghcr.io/your-org/festivals-api:v1.0.0
docker push ghcr.io/your-org/festivals-api:v1.0.0

# Push all images
docker compose -f docker-compose.prod.yml push
```

## Resource Management

### Setting Resource Limits

```yaml
# docker-compose.prod.yml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Recommended Resources

| Service | CPU Limit | Memory Limit | CPU Reserved | Memory Reserved |
|---------|-----------|--------------|--------------|-----------------|
| API | 2 cores | 1 GB | 0.5 cores | 256 MB |
| Worker | 1 core | 512 MB | 0.25 cores | 128 MB |
| Admin | 1 core | 512 MB | 0.25 cores | 128 MB |
| PostgreSQL | 2 cores | 2 GB | 0.5 cores | 512 MB |
| Redis | 1 core | 512 MB | 0.25 cores | 128 MB |
| Nginx | 0.5 cores | 128 MB | 0.1 cores | 32 MB |

## Health Checks

### Verify Service Health

```bash
# Check all services
docker compose ps

# API health check
curl http://localhost:8080/health

# Detailed health check
curl http://localhost:8080/health/ready

# Admin health check
curl http://localhost:3000/api/health

# PostgreSQL health check
docker compose exec postgres pg_isready -U festivals

# Redis health check
docker compose exec redis redis-cli ping
```

### Custom Health Check Configuration

```yaml
services:
  api:
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Networking

### Network Configuration

```yaml
networks:
  festivals-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Exposing Services

| Service | Internal Port | External Port | Description |
|---------|---------------|---------------|-------------|
| API | 8080 | 8080 | Backend API |
| Admin | 3000 | 3000 | Admin dashboard |
| PostgreSQL | 5432 | 5432 | Database (dev only) |
| Redis | 6379 | 6379 | Cache (dev only) |
| MinIO | 9000/9001 | 9000/9001 | Object storage (dev only) |
| Nginx | 80/443 | 80/443 | Reverse proxy |

## Scaling

### Horizontal Scaling

```bash
# Scale API service
docker compose up -d --scale api=3

# Scale workers
docker compose up -d --scale worker=5
```

### With Load Balancer

```yaml
# Add to docker-compose.prod.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api
      - admin
```

## Logging

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api

# Last 100 lines
docker compose logs --tail=100 api

# Since timestamp
docker compose logs --since="2024-01-15T10:00:00" api
```

### Log Configuration

```yaml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Send Logs to External Service

```yaml
services:
  api:
    logging:
      driver: "fluentd"
      options:
        fluentd-address: "localhost:24224"
        tag: "festivals.api"
```

## Troubleshooting

### Common Issues

**Container won't start:**

```bash
# Check logs
docker compose logs api

# Check container status
docker compose ps -a

# Inspect container
docker inspect festivals-api-1
```

**Database connection issues:**

```bash
# Verify database is running
docker compose exec postgres pg_isready -U festivals

# Check database logs
docker compose logs postgres

# Connect to database
docker compose exec postgres psql -U festivals -d festivals
```

**Port conflicts:**

```bash
# Find process using port
lsof -i :8080

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
```

### Reset Everything

```bash
# Stop all containers
docker compose down

# Remove all containers, networks, volumes
docker compose down -v --remove-orphans

# Remove all images
docker compose down --rmi all

# Clean system
docker system prune -af --volumes
```

## Security Best Practices

1. **Never commit secrets** - Use `.env` files (add to `.gitignore`)
2. **Use secret management** - Consider Docker secrets or external vault
3. **Limit exposed ports** - Only expose necessary ports in production
4. **Run as non-root** - Configure containers to run as non-root user
5. **Keep images updated** - Regularly update base images
6. **Scan for vulnerabilities** - Use `docker scan` or Trivy

```bash
# Scan image for vulnerabilities
docker scan festivals-api:latest

# Using Trivy
trivy image festivals-api:latest
```
