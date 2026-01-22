# Webhooks Documentation

## Overview

Webhooks allow you to receive real-time notifications when events occur in your festival. Instead of polling the API, webhooks push data to your application as events happen.

## Getting Started

### 1. Create a Webhook Endpoint

Create an HTTPS endpoint on your server to receive webhook payloads:

```javascript
// Express.js example
app.post('/webhooks/festivals', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;

  // Verify signature
  if (!verifySignature(payload, signature)) {
    return res.status(401).send('Invalid signature');
  }

  // Process the event
  handleEvent(payload);

  res.status(200).send('OK');
});
```

### 2. Register the Webhook

```bash
POST /festivals/{festivalId}/api/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Payment Notifications",
  "url": "https://yourapp.com/webhooks/festivals",
  "events": ["payment.completed", "payment.refunded"],
  "secret": "your-webhook-secret"
}
```

**Response:**
```json
{
  "data": {
    "id": "wh_abc123",
    "name": "Payment Notifications",
    "url": "https://yourapp.com/webhooks/festivals",
    "events": ["payment.completed", "payment.refunded"],
    "status": "active",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### 3. Verify Your Endpoint

Use the test endpoint to verify your webhook is working:

```bash
POST /festivals/{festivalId}/api/webhooks/{webhookId}/test
Authorization: Bearer <token>
Content-Type: application/json

{
  "eventType": "payment.completed"
}
```

## Webhook Events

### Payment Events

| Event | Description |
|-------|-------------|
| `payment.completed` | Payment successfully processed |
| `payment.failed` | Payment attempt failed |
| `payment.refunded` | Payment was refunded |

### Ticket Events

| Event | Description |
|-------|-------------|
| `ticket.created` | New ticket issued |
| `ticket.scanned` | Ticket scanned for entry/exit |
| `ticket.transferred` | Ticket transferred to new owner |
| `ticket.cancelled` | Ticket was cancelled |

### Wallet Events

| Event | Description |
|-------|-------------|
| `wallet.created` | New wallet created |
| `wallet.topup` | Wallet received funds |
| `wallet.frozen` | Wallet was frozen |
| `wallet.unfrozen` | Wallet was unfrozen |

### Refund Events

| Event | Description |
|-------|-------------|
| `refund.requested` | Refund request submitted |
| `refund.approved` | Refund request approved |
| `refund.rejected` | Refund request rejected |
| `refund.completed` | Refund payment sent |

### NFC Events

| Event | Description |
|-------|-------------|
| `nfc.activated` | NFC tag/bracelet activated |
| `nfc.deactivated` | NFC tag/bracelet deactivated |
| `nfc.blocked` | NFC tag/bracelet blocked |
| `nfc.lost` | NFC bracelet reported lost |

### Sync Events

| Event | Description |
|-------|-------------|
| `sync.batch_received` | Offline transaction batch received |
| `sync.batch_processed` | Offline batch processing complete |

## Payload Format

All webhook payloads follow this structure:

```json
{
  "id": "evt_abc123xyz",
  "type": "payment.completed",
  "createdAt": "2024-01-15T10:30:00Z",
  "festivalId": "123e4567-e89b-12d3-a456-426614174000",
  "data": {
    // Event-specific data
  }
}
```

### Payment Completed Payload

```json
{
  "id": "evt_abc123xyz",
  "type": "payment.completed",
  "createdAt": "2024-01-15T10:30:00Z",
  "festivalId": "123e4567-e89b-12d3-a456-426614174000",
  "data": {
    "transactionId": "tx_abc123",
    "walletId": "123e4567-e89b-12d3-a456-426614174001",
    "standId": "123e4567-e89b-12d3-a456-426614174002",
    "amount": 1500,
    "currency": "EUR",
    "balanceAfter": 3500,
    "items": [
      {
        "productId": "123e4567-e89b-12d3-a456-426614174003",
        "name": "Beer",
        "quantity": 2,
        "price": 750
      }
    ]
  }
}
```

### Ticket Scanned Payload

```json
{
  "id": "evt_def456abc",
  "type": "ticket.scanned",
  "createdAt": "2024-01-15T14:22:00Z",
  "festivalId": "123e4567-e89b-12d3-a456-426614174000",
  "data": {
    "ticketId": "123e4567-e89b-12d3-a456-426614174004",
    "ticketCode": "TKT-ABC123-XYZ789",
    "ticketType": "VIP Pass",
    "scanType": "entry",
    "scannedBy": "123e4567-e89b-12d3-a456-426614174005",
    "scanLocation": "Main Gate",
    "result": "valid"
  }
}
```

### Refund Requested Payload

```json
{
  "id": "evt_ghi789def",
  "type": "refund.requested",
  "createdAt": "2024-01-16T09:00:00Z",
  "festivalId": "123e4567-e89b-12d3-a456-426614174000",
  "data": {
    "refundId": "ref_abc123",
    "userId": "123e4567-e89b-12d3-a456-426614174006",
    "walletId": "123e4567-e89b-12d3-a456-426614174001",
    "amount": 5000,
    "currency": "EUR",
    "status": "pending",
    "bankDetails": {
      "accountHolder": "John Doe",
      "iban": "DE89***************1234"
    }
  }
}
```

## Signature Verification

All webhooks include an HMAC-SHA256 signature in the `X-Webhook-Signature` header. Always verify this signature to ensure the request is authentic.

### Signature Format

```
X-Webhook-Signature: sha256=abc123def456...
```

### Verification Algorithm

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Python Example

```python
import hmac
import hashlib

def verify_signature(payload: str, signature: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

### Go Example

```go
import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
)

func verifySignature(payload []byte, signature, secret string) bool {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(payload)
    expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(expected), []byte(signature))
}
```

## Webhook Headers

Each webhook request includes these headers:

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `X-Webhook-Signature` | HMAC-SHA256 signature |
| `X-Webhook-ID` | Unique delivery ID |
| `X-Webhook-Event` | Event type |
| `X-Webhook-Timestamp` | Unix timestamp |
| `User-Agent` | `Festivals-Webhook/1.0` |

## Retry Policy

If your endpoint returns a non-2xx status code or times out, we'll retry the webhook:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 5 minutes |
| 3 | 30 minutes |
| 4 | 2 hours |
| 5 | 8 hours |
| 6 | 24 hours |

After 6 failed attempts, the webhook is marked as failed.

### Timeout

Webhook requests timeout after **30 seconds**. Return a 200 response quickly and process the event asynchronously.

## Best Practices

### 1. Respond Quickly

Return a 200 status immediately and process events asynchronously:

```javascript
app.post('/webhooks', async (req, res) => {
  // Acknowledge receipt immediately
  res.status(200).send('OK');

  // Process asynchronously
  await processEventAsync(req.body);
});
```

### 2. Handle Duplicates

Events may be delivered more than once. Use the `id` field for idempotency:

```javascript
async function processEvent(event) {
  // Check if already processed
  if (await isProcessed(event.id)) {
    return;
  }

  // Process event
  await handleEvent(event);

  // Mark as processed
  await markProcessed(event.id);
}
```

### 3. Verify Signatures

Always verify webhook signatures to ensure authenticity:

```javascript
app.post('/webhooks', (req, res) => {
  const signature = req.headers['x-webhook-signature'];

  if (!verifySignature(req.body, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  // Process event...
});
```

### 4. Use HTTPS

Always use HTTPS endpoints to protect webhook payloads.

### 5. Monitor Failures

Set up monitoring for webhook delivery failures and alerts.

## Managing Webhooks

### List Webhooks

```bash
GET /festivals/{festivalId}/api/webhooks
```

### Get Webhook

```bash
GET /festivals/{festivalId}/api/webhooks/{webhookId}
```

### Update Webhook

```bash
PATCH /festivals/{festivalId}/api/webhooks/{webhookId}
Content-Type: application/json

{
  "events": ["payment.completed", "payment.refunded", "ticket.scanned"],
  "url": "https://new-url.example.com/webhooks"
}
```

### Delete Webhook

```bash
DELETE /festivals/{festivalId}/api/webhooks/{webhookId}
```

### View Delivery History

```bash
GET /festivals/{festivalId}/api/webhooks/{webhookId}/deliveries
```

**Response:**
```json
{
  "data": [
    {
      "id": "del_abc123",
      "eventId": "evt_abc123",
      "eventType": "payment.completed",
      "status": "success",
      "statusCode": 200,
      "duration": 234,
      "attemptNumber": 1,
      "deliveredAt": "2024-01-15T10:30:01Z"
    }
  ]
}
```

## Testing Webhooks

### Local Development

Use a tunneling service like ngrok for local testing:

```bash
ngrok http 3000
```

Then register the ngrok URL as your webhook endpoint.

### Test Events

Send test events to verify your integration:

```bash
POST /festivals/{festivalId}/api/webhooks/{webhookId}/test
Content-Type: application/json

{
  "eventType": "payment.completed"
}
```

## Troubleshooting

### Common Issues

1. **Signature verification failing**
   - Ensure you're using the raw request body
   - Check that the secret matches exactly

2. **Events not being received**
   - Verify webhook URL is publicly accessible
   - Check firewall rules
   - Ensure HTTPS certificate is valid

3. **Duplicate events**
   - Implement idempotency using event IDs
   - Don't rely on exactly-once delivery

4. **Timeout errors**
   - Respond with 200 immediately
   - Process events asynchronously

## Support

For webhook issues:
- Check delivery history in the admin dashboard
- Review server logs for signature verification
- Contact support@festivals.io with the webhook ID
