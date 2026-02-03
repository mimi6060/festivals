# Rate Limiting

## Overview

The Festivals API implements rate limiting to ensure fair usage and protect against abuse. This document explains how rate limiting works and how to handle rate limit errors.

## Rate Limits

Rate limits vary based on authentication level and subscription plan:

### By Authentication Level

| Level | Requests/Minute | Requests/Hour |
|-------|-----------------|---------------|
| Anonymous | 60 | 600 |
| Authenticated User | 300 | 3,000 |
| Staff | 600 | 6,000 |
| Admin | 1,200 | 12,000 |
| API Key (Standard) | 100 | 1,000 |
| API Key (Premium) | 1,000 | 10,000 |
| API Key (Enterprise) | Custom | Custom |

### By Endpoint Type

Some endpoints have specific limits:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 10 requests | 1 minute |
| Payments | 100 requests | 1 minute |
| Bulk Operations | 10 requests | 1 minute |
| Exports/Reports | 5 requests | 1 minute |
| Webhooks | 1,000 deliveries | 1 hour |

## Rate Limit Headers

Every API response includes rate limit information in the headers:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1609459200
X-RateLimit-Retry-After: 60
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |
| `X-RateLimit-Retry-After` | Seconds to wait before retrying (on 429) |

## Rate Limit Exceeded Response

When you exceed the rate limit, you'll receive a `429 Too Many Requests` response:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1609459260
```

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait before retrying.",
    "details": {
      "limit": 300,
      "remaining": 0,
      "resetAt": "2024-01-15T10:31:00Z",
      "retryAfter": 60
    }
  }
}
```

## Handling Rate Limits

### Best Practices

1. **Monitor rate limit headers** - Track remaining requests
2. **Implement exponential backoff** - Increase wait time on retries
3. **Queue requests** - Spread requests over time
4. **Cache responses** - Reduce unnecessary API calls
5. **Use webhooks** - Prefer push over polling

### Exponential Backoff Example

```javascript
async function requestWithRetry(url, options, maxRetries = 3) {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
        const backoff = Math.min(retryAfter * Math.pow(2, retries), 300);

        console.log(`Rate limited. Waiting ${backoff} seconds...`);
        await sleep(backoff * 1000);
        retries++;
        continue;
      }

      return response;
    } catch (error) {
      retries++;
      if (retries === maxRetries) throw error;
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Python Example

```python
import time
import requests
from functools import wraps

def rate_limit_handler(max_retries=3):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            retries = 0
            while retries < max_retries:
                response = func(*args, **kwargs)

                if response.status_code == 429:
                    retry_after = int(response.headers.get('Retry-After', 60))
                    backoff = min(retry_after * (2 ** retries), 300)
                    print(f"Rate limited. Waiting {backoff} seconds...")
                    time.sleep(backoff)
                    retries += 1
                    continue

                return response

            raise Exception("Max retries exceeded")
        return wrapper
    return decorator

@rate_limit_handler(max_retries=3)
def api_request(url, headers):
    return requests.get(url, headers=headers)
```

### Go Example

```go
package main

import (
    "fmt"
    "net/http"
    "strconv"
    "time"
)

func requestWithRetry(url string, maxRetries int) (*http.Response, error) {
    client := &http.Client{}

    for i := 0; i < maxRetries; i++ {
        resp, err := client.Get(url)
        if err != nil {
            return nil, err
        }

        if resp.StatusCode == 429 {
            retryAfter, _ := strconv.Atoi(resp.Header.Get("Retry-After"))
            if retryAfter == 0 {
                retryAfter = 60
            }

            backoff := min(retryAfter*(1<<i), 300)
            fmt.Printf("Rate limited. Waiting %d seconds...\n", backoff)
            time.Sleep(time.Duration(backoff) * time.Second)
            continue
        }

        return resp, nil
    }

    return nil, fmt.Errorf("max retries exceeded")
}
```

## Rate Limit Strategies

### Request Throttling

Spread requests evenly over time:

```javascript
class RequestThrottler {
  constructor(requestsPerSecond) {
    this.interval = 1000 / requestsPerSecond;
    this.lastRequest = 0;
  }

  async throttle() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < this.interval) {
      await sleep(this.interval - timeSinceLastRequest);
    }

    this.lastRequest = Date.now();
  }

  async request(fn) {
    await this.throttle();
    return fn();
  }
}

// Usage: 5 requests per second
const throttler = new RequestThrottler(5);

for (const item of items) {
  await throttler.request(() => api.process(item));
}
```

### Token Bucket Algorithm

```javascript
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async consume(tokens = 1) {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    // Wait for tokens
    const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
    await sleep(waitTime);
    return this.consume(tokens);
  }
}
```

### Request Batching

Combine multiple requests into one:

```javascript
// Instead of individual requests
for (const item of items) {
  await api.createProduct(item);
}

// Use bulk endpoint
await api.createProducts(items);
```

## Monitoring Rate Limits

### Proactive Monitoring

```javascript
class RateLimitMonitor {
  constructor(warningThreshold = 0.2) {
    this.warningThreshold = warningThreshold;
  }

  checkResponse(response) {
    const limit = parseInt(response.headers.get('X-RateLimit-Limit'));
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
    const ratio = remaining / limit;

    if (ratio < this.warningThreshold) {
      console.warn(`Rate limit warning: ${remaining}/${limit} remaining`);
      this.onLowRemaining(remaining, limit);
    }
  }

  onLowRemaining(remaining, limit) {
    // Implement alerting logic
  }
}
```

### Metrics Collection

```javascript
const metrics = {
  rateLimitHits: 0,
  totalRequests: 0,
  averageRemaining: []
};

function trackRateLimit(response) {
  metrics.totalRequests++;

  if (response.status === 429) {
    metrics.rateLimitHits++;
  }

  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
  metrics.averageRemaining.push(remaining);
}
```

## Special Considerations

### Burst Traffic

During high-traffic events (ticket sales, festival start):
- Plan for increased API usage
- Contact support for temporary limit increases
- Implement circuit breakers

### Batch Operations

For bulk operations:
- Use dedicated bulk endpoints when available
- Process in smaller batches
- Implement delays between batches

### Webhooks

Webhook delivery has separate limits:
- 1,000 deliveries per hour per webhook
- Automatic retry with exponential backoff
- Failed deliveries don't count against limit

## Increasing Your Limits

### Standard Users

- Upgrade to Premium for 10x limits
- Contact sales for Enterprise plans

### API Keys

- Create multiple API keys for distribution
- Use Premium API keys for higher limits
- Contact support for custom limits

### Enterprise

Enterprise customers can request:
- Custom rate limits
- Dedicated infrastructure
- Priority support

Contact enterprise@festivals.io for more information.

## Troubleshooting

### Common Issues

**1. Hitting limits too quickly**
- Review your request patterns
- Implement caching
- Use webhooks instead of polling

**2. Inconsistent rate limiting**
- Ensure you're counting by IP or API key correctly
- Check if multiple applications share credentials

**3. Rate limited during testing**
- Use development environment with relaxed limits
- Implement mocking for unit tests

### Getting Help

- Check the [API status page](https://status.festivals.io)
- Review rate limit headers in responses
- Contact support@festivals.io with your API key prefix

## Related Documentation

- [Authentication](./authentication.md) - How rate limits apply to different auth levels
- [Errors](./errors.md) - Error codes including RATE_LIMIT_EXCEEDED
- [Webhooks](./webhooks.md) - Webhook-specific rate limits
