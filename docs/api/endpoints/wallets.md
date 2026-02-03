# Wallets API

Manage cashless payment wallets for festival attendees. Each user has one wallet per festival.

## Base URL

```
/api/v1
```

## Endpoints

### User Wallet Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/me/wallets` | Get all user's wallets | User |
| `GET` | `/me/wallets/{festivalId}` | Get wallet for a festival | User |
| `POST` | `/me/wallets/{festivalId}` | Create wallet for a festival | User |
| `GET` | `/me/wallets/{festivalId}/qr` | Generate QR code | User |
| `GET` | `/me/wallets/{festivalId}/transactions` | Get transactions | User |

### Staff Wallet Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/wallets/{id}` | Get wallet by ID | Staff |
| `POST` | `/wallets/{id}/topup` | Top up wallet | Staff |
| `POST` | `/wallets/{id}/freeze` | Freeze wallet | Admin |
| `POST` | `/wallets/{id}/unfreeze` | Unfreeze wallet | Admin |

### Payment Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/payments` | Process payment | Staff |
| `POST` | `/payments/validate-qr` | Validate QR code | Staff |
| `POST` | `/payments/refund` | Refund payment | Staff |

---

## Wallet Object

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440001",
  "festivalId": "770e8400-e29b-41d4-a716-446655440002",
  "balance": 5000,
  "balanceDisplay": "50 Jetons",
  "status": "ACTIVE",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Wallet unique identifier |
| `userId` | uuid | Owner's user ID |
| `festivalId` | uuid | Associated festival ID |
| `balance` | integer | Balance in cents |
| `balanceDisplay` | string | Formatted balance (e.g., "50 Jetons") |
| `status` | string | Wallet status |
| `createdAt` | datetime | Creation timestamp |
| `updatedAt` | datetime | Last update timestamp |

### Wallet Status

| Status | Description |
|--------|-------------|
| `ACTIVE` | Normal operation |
| `FROZEN` | Suspended, no transactions allowed |
| `CLOSED` | Permanently closed |

---

## Transaction Object

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "walletId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "PURCHASE",
  "amount": -500,
  "amountDisplay": "-5 Jetons",
  "balanceBefore": 5500,
  "balanceAfter": 5000,
  "reference": "ord_123456",
  "standId": "990e8400-e29b-41d4-a716-446655440004",
  "staffId": "aa0e8400-e29b-41d4-a716-446655440005",
  "metadata": {
    "description": "Beer purchase",
    "productIds": ["prod_1", "prod_2"],
    "paymentMethod": "wallet"
  },
  "status": "COMPLETED",
  "createdAt": "2024-01-15T14:30:00Z"
}
```

### Transaction Types

| Type | Description |
|------|-------------|
| `TOP_UP` | Online top-up via card |
| `CASH_IN` | Cash top-up at booth |
| `PURCHASE` | Payment at stand |
| `REFUND` | Refund from stand/admin |
| `TRANSFER` | Peer-to-peer transfer |
| `CASH_OUT` | Withdrawal/refund at end |

---

## Get My Wallets

```http
GET /api/v1/me/wallets
```

Get all wallets belonging to the authenticated user.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/me/wallets" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "660e8400-e29b-41d4-a716-446655440001",
      "festivalId": "770e8400-e29b-41d4-a716-446655440002",
      "balance": 5000,
      "balanceDisplay": "50 Jetons",
      "status": "ACTIVE",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## Get My Wallet for Festival

```http
GET /api/v1/me/wallets/{festivalId}
```

Get the user's wallet for a specific festival. Creates the wallet if it doesn't exist.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/me/wallets/770e8400-e29b-41d4-a716-446655440002" \
  -H "Authorization: Bearer $TOKEN"
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |

### Response

**200 OK**

Returns the wallet object.

---

## Create My Wallet

```http
POST /api/v1/me/wallets/{festivalId}
```

Create a new wallet for a festival. Idempotent - returns existing wallet if already created.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/me/wallets/770e8400-e29b-41d4-a716-446655440002" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**201 Created**

Returns the created wallet object with initial balance of 0.

---

## Generate QR Code

```http
GET /api/v1/me/wallets/{festivalId}/qr
```

Generate a signed QR code payload for cashless payments.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/me/wallets/770e8400-e29b-41d4-a716-446655440002/qr" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

```json
{
  "data": {
    "qrCode": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "balance": 5000
  }
}
```

The `qrCode` is a signed JWT containing wallet information that can be scanned by staff devices.

---

## Get My Transactions

```http
GET /api/v1/me/wallets/{festivalId}/transactions
```

Get paginated transaction history for the user's wallet.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/me/wallets/770e8400-e29b-41d4-a716-446655440002/transactions?page=1&per_page=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 20 | Items per page |

### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "walletId": "550e8400-e29b-41d4-a716-446655440000",
      "type": "PURCHASE",
      "amount": -500,
      "amountDisplay": "-5 Jetons",
      "balanceBefore": 5500,
      "balanceAfter": 5000,
      "status": "COMPLETED",
      "createdAt": "2024-01-15T14:30:00Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "per_page": 20
  }
}
```

---

## Get Wallet by ID (Staff)

```http
GET /api/v1/wallets/{id}
```

Get wallet details by ID. Staff only.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/wallets/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns the wallet object.

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_ID` | Invalid UUID format |
| 404 | `NOT_FOUND` | Wallet not found |

---

## Top Up Wallet

```http
POST /api/v1/wallets/{id}/topup
```

Add funds to a wallet. Staff only.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/wallets/550e8400-e29b-41d4-a716-446655440000/topup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 2000,
    "paymentMethod": "cash",
    "reference": "receipt_123"
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | integer | Yes | Amount in cents (min: 100) |
| `paymentMethod` | string | Yes | `card` or `cash` |
| `reference` | string | No | External reference |

### Response

**200 OK**

Returns the transaction object.

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_AMOUNT` | Amount must be positive |
| 400 | `MAX_BALANCE_EXCEEDED` | Would exceed maximum balance |

---

## Process Payment

```http
POST /api/v1/payments
```

Process a cashless payment at a stand. Staff only.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "walletId": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 500,
    "standId": "990e8400-e29b-41d4-a716-446655440004",
    "productIds": ["prod_1", "prod_2"]
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletId` | uuid | Yes | Wallet to debit |
| `amount` | integer | Yes | Amount in cents |
| `standId` | uuid | Yes | Stand processing payment |
| `productIds` | array | No | List of product IDs |

### Response

**200 OK**

Returns the transaction object.

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INSUFFICIENT_BALANCE` | Not enough funds |
| 400 | `WALLET_FROZEN` | Wallet is frozen |

---

## Validate QR Code

```http
POST /api/v1/payments/validate-qr
```

Validate a QR code and return wallet information. Staff only.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/payments/validate-qr" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "qrCode": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

### Response

**200 OK**

Returns the wallet object associated with the QR code.

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_QR` | QR code is invalid or expired |
| 404 | `NOT_FOUND` | Wallet not found |

---

## Refund Payment

```http
POST /api/v1/payments/refund
```

Refund a previous transaction. Staff only.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/payments/refund" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "880e8400-e29b-41d4-a716-446655440003",
    "reason": "Customer complaint"
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transactionId` | uuid | Yes | Transaction to refund |
| `reason` | string | No | Refund reason |

### Response

**200 OK**

Returns the refund transaction object.

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 404 | `NOT_FOUND` | Transaction not found |
| 400 | `ALREADY_REFUNDED` | Already refunded |

---

## Freeze Wallet

```http
POST /api/v1/wallets/{id}/freeze
```

Freeze a wallet to prevent transactions. Admin only.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/wallets/550e8400-e29b-41d4-a716-446655440000/freeze" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns the updated wallet with `status: "FROZEN"`.

---

## Unfreeze Wallet

```http
POST /api/v1/wallets/{id}/unfreeze
```

Unfreeze a previously frozen wallet. Admin only.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/wallets/550e8400-e29b-41d4-a716-446655440000/unfreeze" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns the updated wallet with `status: "ACTIVE"`.
