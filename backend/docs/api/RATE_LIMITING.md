# API Rate Limiting

This document describes the rate limiting policies, headers, and best practices for the Festivals API.

## Overview

Rate limiting protects the API from abuse and ensures fair usage across all clients. The API uses a combination of:

- **Sliding Window Algorithm**: For general rate limiting with smooth traffic patterns
- **Token Bucket Algorithm**: For handling burst traffic
- **Concurrency Limiting**: For limiting simultaneous requests

## Rate Limit Tiers

### By Authentication Status

| Status | Requests/Minute | Requests/Hour | Notes |
|--------|-----------------|---------------|-------|
| Unauthenticated (IP) | 30 | - | Based on client IP address |
| Authenticated (User) | 60 | 1,000 | Based on user ID |

### By Role

Authenticated users receive limits based on their highest role:

| Role | Requests/Minute | Requests/Hour | Burst Size |
|------|-----------------|---------------|------------|
| Admin | 300 | 10,000 | 50 |
| Organizer | 200 | 5,000 | 30 |
| Staff | 120 | 3,000 | 20 |
| User | 60 | 1,000 | 10 |

### By Endpoint

Certain endpoints have specific limits regardless of role:

| Endpoint | Method | Requests/Minute | Description |
|----------|--------|-----------------|-------------|
| `/api/v1/auth/login` | POST | 5 | Login attempts |
| `/api/v1/auth/register` | POST | 3 | Registration |
| `/api/v1/auth/forgot-password` | POST | 3 | Password reset |
| `/api/v1/wallets/:id/topup` | POST | 10 | Financial operations |
| `/api/v1/tickets/scan` | POST | 100 | Ticket scanning |
| `/api/v1/reports/export` | POST | 5 | Report generation |
| `/api/v1/search` | GET | 30 | Search queries |

## Rate Limit Headers

All API responses include rate limit information in the following headers:

### Standard Headers

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window | `60` |
| `X-RateLimit-Remaining` | Remaining requests in the current window | `45` |
| `X-RateLimit-Reset` | Unix timestamp when the window resets | `1706025600` |
| `Retry-After` | Seconds to wait before retrying (only on 429) | `35` |

### Additional Headers

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Bypass` | Indicates bypass reason (for whitelisted IPs/services) | `ip-whitelist` |
| `X-Load-Factor` | Current server load factor (0.00-1.00) for adaptive limiting | `0.45` |
| `X-Global-RateLimit-Limit` | Global rate limit across all users | `10000` |
| `X-Global-RateLimit-Remaining` | Remaining global capacity | `8500` |
| `X-RateLimit-Cost` | Cost of the operation (for cost-based limiting) | `5` |

## 429 Response Format

When rate limited, the API returns HTTP 429 with the following body:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again later.",
    "retry_after": 35
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `RATE_LIMITED` | Standard rate limit exceeded |
| `DAILY_LIMIT_EXCEEDED` | Daily request quota exceeded |
| `TOO_MANY_CONCURRENT_REQUESTS` | Too many simultaneous requests |
| `SERVICE_OVERLOADED` | Global rate limit reached (server under high load) |

## Handling 429 Errors

### Best Practices

1. **Always check headers**: Read `Retry-After` or `X-RateLimit-Reset` to know when to retry.

2. **Implement exponential backoff**:
   ```javascript
   async function requestWithRetry(url, options, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       const response = await fetch(url, options);

       if (response.status === 429) {
         const retryAfter = response.headers.get('Retry-After') || Math.pow(2, i);
         await sleep(retryAfter * 1000);
         continue;
       }

       return response;
     }
     throw new Error('Max retries exceeded');
   }
   ```

3. **Monitor remaining quota**: Use `X-RateLimit-Remaining` to proactively slow down before hitting limits.

4. **Batch requests**: Combine multiple operations into single requests where possible.

5. **Cache responses**: Reduce unnecessary API calls by caching data locally.

### Client-Side Implementation Example

```javascript
class RateLimitedClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.remaining = Infinity;
    this.resetTime = 0;
  }

  async request(endpoint, options = {}) {
    // Check if we should wait
    if (this.remaining <= 0 && Date.now() / 1000 < this.resetTime) {
      const waitTime = this.resetTime - Date.now() / 1000;
      console.log(`Rate limited. Waiting ${waitTime}s`);
      await new Promise(r => setTimeout(r, waitTime * 1000));
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Update rate limit state
    this.remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || this.remaining);
    this.resetTime = parseInt(response.headers.get('X-RateLimit-Reset') || this.resetTime);

    if (response.status === 429) {
      const body = await response.json();
      const retryAfter = body.error?.retry_after || 60;
      throw new RateLimitError(`Rate limited. Retry after ${retryAfter}s`, retryAfter);
    }

    return response;
  }
}

class RateLimitError extends Error {
  constructor(message, retryAfter) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}
```

## Exemptions and Bypasses

### IP Whitelist

Internal services and infrastructure can be whitelisted by IP address:

- Health check probes from load balancers
- Internal microservices
- Monitoring systems

Whitelisted IPs receive the `X-RateLimit-Bypass: ip-whitelist` header.

### Internal Service API Keys

Services can use the `X-Internal-API-Key` header to bypass rate limiting:

```http
GET /api/v1/data HTTP/1.1
Host: api.example.com
X-Internal-API-Key: your-internal-service-key
```

These requests receive the `X-RateLimit-Bypass: internal-service` header.

### Paths Exempt from Rate Limiting

The following paths are not rate limited:

- `/health`
- `/ready`
- `/live`
- `/api/v1/health`
- `/api/v1/version`
- `/metrics`

## Adaptive Rate Limiting

Under high server load, rate limits are automatically reduced to protect system stability:

- Load factor of 0.0: 100% of configured limits
- Load factor of 0.5: ~65% of configured limits
- Load factor of 1.0: ~30% of configured limits (minimum 10 req/min)

The current load factor is visible in the `X-Load-Factor` header.

## Distributed Rate Limiting

Rate limits are enforced across all API server instances using Redis:

- Limits are shared across all servers
- State is synchronized in real-time
- Failover: If Redis is unavailable, rate limiting fails open (requests allowed)

## Rate Limit Algorithms

### Sliding Window

Used for most endpoints. Provides smooth rate limiting without burst penalties:

```
Window: 1 minute (60 seconds)
Maximum Requests: Based on role/endpoint
Algorithm: Redis sorted set with timestamps
```

### Token Bucket

Used for burst handling on specific endpoints:

```
Refill Rate: X tokens per second
Bucket Size: Maximum burst capacity
Each Request: Consumes 1 token (or more for expensive operations)
```

### Concurrency Limiting

Limits simultaneous in-flight requests:

```
Maximum Concurrent: Based on endpoint
Counter: Incremented on request start, decremented on completion
Timeout: Auto-cleanup after 5 minutes (prevents stuck counters)
```

## Monitoring and Debugging

### Useful Redis Commands

Check rate limit status for a user:
```bash
redis-cli ZCARD ratelimit:user:<user-id>
redis-cli TTL ratelimit:user:<user-id>
```

Check rate limit status for an IP:
```bash
redis-cli ZCARD ratelimit:ip:<ip-address>
```

Reset a user's rate limit (admin operation):
```bash
redis-cli DEL ratelimit:user:<user-id>
```

### Metrics

The following metrics are exposed for monitoring:

- `rate_limit_requests_total`: Total requests processed by rate limiter
- `rate_limit_exceeded_total`: Total requests that were rate limited
- `rate_limit_remaining_gauge`: Current remaining quota (per key)
- `rate_limit_latency_seconds`: Rate limit check latency

## Configuration

Rate limits are configured in `internal/config/ratelimit.yaml`. See the configuration file for:

- Global settings
- Role-based limits
- Endpoint-specific limits
- IP whitelist
- Adaptive limiting settings

## FAQ

### Q: Why am I getting rate limited?

Check the following:
1. Are you making too many requests? Check `X-RateLimit-Remaining`
2. Are you authenticated? Unauthenticated requests have lower limits
3. Is the endpoint restricted? Some endpoints have stricter limits

### Q: How do I request a higher rate limit?

Contact support with:
1. Your use case description
2. Expected request volume
3. Business justification

### Q: Can I get real-time notifications when approaching limits?

Monitor the `X-RateLimit-Remaining` header and implement client-side alerts when remaining falls below a threshold (e.g., 10% of limit).

### Q: What happens during Redis outages?

Rate limiting fails open - requests are allowed to proceed. This prevents rate limiting from causing outages.

### Q: Are WebSocket connections rate limited?

WebSocket connection establishment is rate limited. Once connected, message rates may have separate limits (see WebSocket documentation).

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-15 | Initial rate limiting implementation |
| 1.1.0 | 2024-03-01 | Added adaptive rate limiting |
| 1.2.0 | 2024-06-15 | Added cost-based rate limiting |
| 1.3.0 | 2024-09-01 | Added internal service bypass |
