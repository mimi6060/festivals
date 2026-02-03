# Environment Variables Reference

Complete reference for all environment variables used in the Festivals platform.

## Quick Reference

### Required Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | API, Worker | PostgreSQL connection string |
| `REDIS_URL` | API, Worker | Redis connection string |
| `AUTH0_DOMAIN` | API, Admin | Auth0 tenant domain |
| `AUTH0_AUDIENCE` | API | Auth0 API identifier |
| `AUTH0_CLIENT_ID` | Admin | Auth0 application client ID |
| `AUTH0_CLIENT_SECRET` | Admin | Auth0 application client secret |
| `AUTH0_SECRET` | Admin | Session encryption secret |

## Application Configuration

### General

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `development` | Environment name (`development`, `staging`, `production`) |
| `PORT` | `8080` | HTTP server port |
| `LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `LOG_FORMAT` | `console` | Log format (`console`, `json`) |
| `APP_VERSION` | - | Application version (set at build time) |
| `SERVICE_NAME` | `festivals-api` | Service name for logging/tracing |

### Example

```bash
ENVIRONMENT=production
PORT=8080
LOG_LEVEL=info
LOG_FORMAT=json
SERVICE_NAME=festivals-api
```

## Database Configuration

### PostgreSQL

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | Full connection string |
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `festivals` | Database name |
| `DB_USER` | `festivals` | Database username |
| `DB_PASSWORD` | - | Database password |
| `DB_SSL_MODE` | `disable` | SSL mode (`disable`, `require`, `verify-full`) |
| `DB_MAX_OPEN_CONNS` | `25` | Maximum open connections |
| `DB_MAX_IDLE_CONNS` | `5` | Maximum idle connections |
| `DB_CONN_MAX_LIFETIME` | `5m` | Connection maximum lifetime |

### Connection String Format

```
postgres://user:password@host:port/database?sslmode=disable
```

### Example

```bash
# Option 1: Full URL
DATABASE_URL=postgres://festivals:secretpass@localhost:5432/festivals?sslmode=disable

# Option 2: Individual variables
DB_HOST=localhost
DB_PORT=5432
DB_NAME=festivals
DB_USER=festivals
DB_PASSWORD=secretpass
DB_SSL_MODE=disable
DB_MAX_OPEN_CONNS=25
DB_MAX_IDLE_CONNS=5
```

## Redis Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | - | Full Redis connection string |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | - | Redis password |
| `REDIS_DB` | `0` | Redis database number |
| `REDIS_TLS` | `false` | Enable TLS connection |
| `REDIS_POOL_SIZE` | `10` | Connection pool size |

### Connection String Format

```
redis://:password@host:port/db
```

### Example

```bash
# Option 1: Full URL
REDIS_URL=redis://:secretpass@localhost:6379/0

# Option 2: Individual variables
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secretpass
REDIS_DB=0
```

## Authentication (Auth0)

### API Service

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH0_DOMAIN` | Yes | Auth0 tenant domain (e.g., `your-tenant.auth0.com`) |
| `AUTH0_AUDIENCE` | Yes | API identifier (e.g., `https://api.festivals.app`) |
| `AUTH0_ISSUER` | No | Token issuer URL (defaults to `https://{domain}/`) |
| `JWKS_CACHE_TTL` | No | JWKS cache TTL (default: `1h`) |

### Admin Dashboard

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH0_SECRET` | Yes | Random string for session encryption (min 32 chars) |
| `AUTH0_BASE_URL` | Yes | Admin application URL |
| `AUTH0_ISSUER_BASE_URL` | Yes | Auth0 issuer URL (`https://{domain}`) |
| `AUTH0_CLIENT_ID` | Yes | Auth0 application client ID |
| `AUTH0_CLIENT_SECRET` | Yes | Auth0 application client secret |

### Example

```bash
# API
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.festivals.app

# Admin
AUTH0_SECRET=a-very-long-random-string-at-least-32-characters
AUTH0_BASE_URL=https://admin.festivals.app
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=abcd1234
AUTH0_CLIENT_SECRET=your-client-secret
```

## Payment Processing (Stripe)

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook endpoint signing secret |
| `STRIPE_PUBLISHABLE_KEY` | No | Public key (for frontend) |

### Example

```bash
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
```

## Object Storage

### MinIO / S3

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_TYPE` | `local` | Storage type (`local`, `s3`, `minio`) |
| `MINIO_ENDPOINT` | `localhost:9000` | MinIO endpoint |
| `MINIO_ACCESS_KEY` | - | Access key ID |
| `MINIO_SECRET_KEY` | - | Secret access key |
| `MINIO_BUCKET` | `festivals` | Bucket name |
| `MINIO_USE_SSL` | `false` | Use SSL/TLS |
| `MINIO_REGION` | `us-east-1` | Region (for S3 compatibility) |

### AWS S3

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `eu-west-1` | AWS region |
| `AWS_ACCESS_KEY_ID` | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | - | AWS secret key |
| `S3_BUCKET` | - | S3 bucket name |
| `CLOUDFRONT_URL` | - | CloudFront distribution URL |

### Example

```bash
# MinIO (development)
STORAGE_TYPE=minio
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
MINIO_BUCKET=festivals
MINIO_USE_SSL=false

# AWS S3 (production)
STORAGE_TYPE=s3
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIAXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxx
S3_BUCKET=festivals-media-production
CLOUDFRONT_URL=https://cdn.festivals.app
```

## Email Configuration

### SMTP

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | - | SMTP server host |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USER` | - | SMTP username |
| `SMTP_PASSWORD` | - | SMTP password |
| `SMTP_FROM` | - | Default sender address |
| `SMTP_FROM_NAME` | `Festivals` | Default sender name |
| `SMTP_TLS` | `true` | Use TLS |

### SendGrid

| Variable | Description |
|----------|-------------|
| `SENDGRID_API_KEY` | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | Verified sender email |

### Example

```bash
# SMTP
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@festivals.app
SMTP_PASSWORD=xxxxx
SMTP_FROM=noreply@festivals.app
SMTP_FROM_NAME=Festivals
SMTP_TLS=true

# SendGrid
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@festivals.app
```

## SMS Configuration (Twilio)

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |

### Example

```bash
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

## Push Notifications (Firebase)

| Variable | Description |
|----------|-------------|
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CREDENTIALS` | Path to service account JSON |
| `FIREBASE_CREDENTIALS_JSON` | Service account JSON content (base64) |

### Example

```bash
FIREBASE_PROJECT_ID=festivals-app
FIREBASE_CREDENTIALS=/secrets/firebase-credentials.json
# or
FIREBASE_CREDENTIALS_JSON=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

## AI Integration (OpenAI)

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | Model to use (default: `gpt-4`) |
| `OPENAI_MAX_TOKENS` | Max tokens per request |

### Example

```bash
OPENAI_API_KEY=sk-xxxxx
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=1000
```

## Monitoring & Observability

### Metrics

| Variable | Default | Description |
|----------|---------|-------------|
| `METRICS_ENABLED` | `true` | Enable Prometheus metrics |
| `METRICS_PORT` | `9090` | Metrics server port |
| `METRICS_PATH` | `/metrics` | Metrics endpoint path |

### Tracing (OpenTelemetry)

| Variable | Description |
|----------|-------------|
| `OTEL_ENABLED` | Enable OpenTelemetry tracing |
| `OTEL_EXPORTER` | Exporter type (`jaeger`, `otlp`) |
| `OTEL_ENDPOINT` | Collector endpoint |
| `OTEL_SERVICE_NAME` | Service name for traces |

### Error Tracking (Sentry)

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Sentry DSN |
| `SENTRY_ENVIRONMENT` | Environment name |
| `SENTRY_RELEASE` | Release version |
| `SENTRY_SAMPLE_RATE` | Trace sample rate (0.0-1.0) |

### Example

```bash
# Metrics
METRICS_ENABLED=true
METRICS_PORT=9090

# Tracing
OTEL_ENABLED=true
OTEL_EXPORTER=otlp
OTEL_ENDPOINT=http://otel-collector:4317
OTEL_SERVICE_NAME=festivals-api

# Sentry
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SENTRY_ENVIRONMENT=production
SENTRY_SAMPLE_RATE=0.1
```

## Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `FEATURE_NFC_ENABLED` | `true` | Enable NFC features |
| `FEATURE_OFFLINE_MODE` | `true` | Enable offline mode |
| `FEATURE_REFUNDS_ENABLED` | `true` | Enable refund requests |
| `FEATURE_CHATBOT_ENABLED` | `false` | Enable AI chatbot |
| `FEATURE_MAP_ENABLED` | `true` | Enable interactive map |

### Example

```bash
FEATURE_NFC_ENABLED=true
FEATURE_OFFLINE_MODE=true
FEATURE_REFUNDS_ENABLED=true
FEATURE_CHATBOT_ENABLED=true
FEATURE_MAP_ENABLED=true
```

## CORS Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ALLOWED_ORIGINS` | `*` | Allowed origins (comma-separated) |
| `CORS_ALLOWED_METHODS` | `GET,POST,PUT,DELETE,PATCH,OPTIONS` | Allowed methods |
| `CORS_ALLOWED_HEADERS` | `*` | Allowed headers |
| `CORS_MAX_AGE` | `86400` | Preflight cache duration |

### Example

```bash
CORS_ALLOWED_ORIGINS=https://admin.festivals.app,https://festivals.app
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,PATCH,OPTIONS
CORS_MAX_AGE=86400
```

## Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |
| `RATE_LIMIT_REQUESTS` | `100` | Requests per window |
| `RATE_LIMIT_WINDOW` | `1m` | Rate limit window |
| `RATE_LIMIT_BY_IP` | `true` | Rate limit by IP |

### Example

```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=1m
```

## Queue Configuration (Worker)

| Variable | Default | Description |
|----------|---------|-------------|
| `QUEUE_CONCURRENCY` | `10` | Worker concurrency |
| `QUEUE_RETRY_MAX` | `3` | Maximum retry attempts |
| `QUEUE_RETRY_DELAY` | `30s` | Delay between retries |
| `QUEUE_CRITICAL_WEIGHT` | `6` | Critical queue weight |
| `QUEUE_DEFAULT_WEIGHT` | `3` | Default queue weight |
| `QUEUE_LOW_WEIGHT` | `1` | Low priority queue weight |

### Example

```bash
QUEUE_CONCURRENCY=10
QUEUE_RETRY_MAX=3
QUEUE_RETRY_DELAY=30s
```

## Environment Templates

### Development (.env.development)

```bash
ENVIRONMENT=development
PORT=8080
LOG_LEVEL=debug
LOG_FORMAT=console

DATABASE_URL=postgres://festivals:password@localhost:5432/festivals?sslmode=disable
REDIS_URL=redis://localhost:6379/0

AUTH0_DOMAIN=dev-tenant.auth0.com
AUTH0_AUDIENCE=https://api.festivals.dev

STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
MINIO_BUCKET=festivals-dev
MINIO_USE_SSL=false
```

### Production (.env.production)

```bash
ENVIRONMENT=production
PORT=8080
LOG_LEVEL=info
LOG_FORMAT=json

DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}

AUTH0_DOMAIN=${AUTH0_DOMAIN}
AUTH0_AUDIENCE=https://api.festivals.app

STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}

STORAGE_TYPE=s3
AWS_REGION=eu-west-1
S3_BUCKET=festivals-media-production

METRICS_ENABLED=true
SENTRY_DSN=${SENTRY_DSN}
```

## Related Documentation

- [Docker Deployment](./DOCKER.md)
- [Kubernetes Deployment](./KUBERNETES.md)
- [AWS Deployment](./AWS.md)
