# Festivals Platform - Deployment Documentation

This documentation covers all aspects of deploying and operating the Festivals platform in various environments.

## Architecture Overview

The Festivals platform consists of the following components:

| Component | Technology | Description |
|-----------|------------|-------------|
| **API** | Go 1.23 | Backend REST API handling all business logic |
| **Admin** | Next.js 14 | Admin dashboard for festival management |
| **Worker** | Go 1.23 | Background job processor for async tasks |
| **Database** | PostgreSQL 16 | Primary data store |
| **Cache** | Redis 7 | Caching and job queue |
| **Storage** | MinIO/S3 | Object storage for files and media |

## Deployment Options

### 1. Docker Compose (Recommended for Development/Small Scale)

Best for:
- Local development
- Small deployments (< 1000 concurrent users)
- Single-server setups

See: [Docker Deployment Guide](./docker.md)

### 2. Kubernetes (Recommended for Production)

Best for:
- Production environments
- High availability requirements
- Auto-scaling needs
- Multi-region deployments

See: [Kubernetes Deployment Guide](./kubernetes.md)

## Environment Requirements

### Minimum Hardware (Development)

| Resource | Requirement |
|----------|-------------|
| CPU | 2 cores |
| RAM | 4 GB |
| Storage | 20 GB SSD |

### Recommended Hardware (Production)

| Resource | Requirement |
|----------|-------------|
| CPU | 8+ cores |
| RAM | 16+ GB |
| Storage | 100+ GB SSD |
| Network | 1 Gbps |

## Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-org/festivals.git
cd festivals

# Copy environment template
cp .env.example .env

# Start all services
docker compose up -d

# Access services
# API: http://localhost:8080
# Admin: http://localhost:3000
# Database UI: http://localhost:8082
```

### Production Deployment

```bash
# Using Kustomize
kubectl apply -k k8s/overlays/production

# Using Helm
helm install festivals ./helm/festivals -f values-production.yaml -n festivals
```

## Documentation Index

| Document | Description |
|----------|-------------|
| [Docker](./docker.md) | Docker Compose setup and configuration |
| [Kubernetes](./kubernetes.md) | Helm charts and Kustomize overlays |
| [CI/CD](./ci-cd.md) | GitHub Actions and deployment pipelines |
| [Monitoring](./monitoring.md) | Prometheus, Grafana, and alerting |
| [Backup](./backup.md) | Database backup and disaster recovery |

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://:password@host:6379` |
| `AUTH0_DOMAIN` | Auth0 tenant domain | `your-tenant.auth0.com` |
| `AUTH0_AUDIENCE` | Auth0 API audience | `https://api.festivals.app` |
| `STRIPE_SECRET_KEY` | Stripe API secret key | `sk_live_...` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `LOG_FORMAT` | `json` | Log format (json, text) |
| `PORT` | `8080` | API server port |
| `ENVIRONMENT` | `development` | Environment name |

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] Database migrations prepared
- [ ] SSL certificates ready
- [ ] DNS records configured
- [ ] Secrets stored securely (not in git)
- [ ] Backup strategy in place
- [ ] Monitoring configured

### Post-Deployment

- [ ] Health checks passing
- [ ] Smoke tests executed
- [ ] Metrics being collected
- [ ] Logs flowing to aggregator
- [ ] Alerts configured
- [ ] Documentation updated

## Support

For deployment issues:

1. Check the [troubleshooting guide](./troubleshooting.md)
2. Review application logs
3. Check monitoring dashboards
4. Contact the DevOps team

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01 | Initial deployment documentation |
