# Wallet Endpoints

Manage cashless payment wallets for festival attendees. Each user has one wallet per festival containing a balance in festival tokens.

## Endpoints Overview

### User Wallet Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/me/wallets` | List user's wallets | Yes |
| GET | `/me/wallets/:festivalId` | Get user's wallet for a festival | Yes |
| POST | `/me/wallets/:festivalId` | Create wallet for a festival | Yes |
| GET | `/me/wallets/:festivalId/qr` | Generate QR code for wallet | Yes |
| GET | `/me/wallets/:festivalId/transactions` | Get wallet transactions | Yes |

### Staff Wallet Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/wallets/:id` | Get wallet by ID | Yes (staff) |
| POST | `/wallets/:id/topup` | Top up a wallet | Yes (staff) |
| POST | `/wallets/:id/freeze` | Freeze a wallet | Yes (admin) |
| POST | `/wallets/:id/unfreeze` | Unfreeze a wallet | Yes (admin) |

### Payment Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/payments` | Process a payment | Yes (staff) |
| POST | `/payments/validate-qr` | Validate a QR code | Yes (staff) |
| POST | `/payments/refund` | Refund a transaction | Yes (staff) |

---

## Wallet Object

```json
{
  "id": "456e4567-e89b-12d3-a456-426614174000",
  "userId": "789e4567-e89b-12d3-a456-426614174000",
  "festivalId": "123e4567-e89b-12d3-a456-426614174000",
  "balance": 5000,
  "balanceDisplay": "50 Jetons",
  "status": "ACTIVE",
  "createdAt": "2024-07-15T10:30:00Z",
  "updatedAt": "2024-07-15T14:20:00Z"
}
```

### Wallet Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique wallet identifier |
| `userId` | uuid | Owner user ID |
| `festivalId` | uuid | Associated festival ID |
| `balance` | integer | Balance in cents |
| `balanceDisplay` | string | Formatted balance with currency name |
| `status` | string | Wallet status |
| `createdAt` | string | Creation timestamp (RFC3339) |
| `updatedAt` | string | Last update timestamp (RFC3339) |

### Wallet Status Values

| Status | Description |
|--------|-------------|
| `ACTIVE` | Wallet is active and can transact |
| `FROZEN` | Wallet is frozen (no transactions) |
| `CLOSED` | Wallet is permanently closed |

---

## Transaction Object

```json
{
  "id": "abc12345-e89b-12d3-a456-426614174000",
  "walletId": "456e4567-e89b-12d3-a456-426614174000",
  "type": "PURCHASE",
  "amount": -500,
  "amountDisplay": "-5 Jetons",
  "balanceBefore": 5000,
  "balanceAfter": 4500,
  "reference": "txn_123456",
  "standId": "stand123-e89b-12d3-a456-426614174000",
  "staffId": "staff123-e89b-12d3-a456-426614174000",
  "metadata": {
    "description": "Beer purchase",
    "productIds": ["prod1", "prod2"],
    "paymentMethod": "token",
    "deviceId": "device_001",
    "location": "Main Stage Bar"
  },
  "status": "COMPLETED",
  "createdAt": "2024-07-15T14:30:00Z"
}
```

### Transaction Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique transaction identifier |
| `walletId` | uuid | Associated wallet ID |
| `type` | string | Transaction type |
| `amount` | integer | Amount in cents (positive=credit, negative=debit) |
| `amountDisplay` | string | Formatted amount with currency name |
| `balanceBefore` | integer | Balance before transaction |
| `balanceAfter` | integer | Balance after transaction |
| `reference` | string | External reference (e.g., Stripe ID) |
| `standId` | uuid | Stand where transaction occurred |
| `staffId` | uuid | Staff who processed transaction |
| `metadata` | object | Additional transaction details |
| `status` | string | Transaction status |
| `createdAt` | string | Transaction timestamp (RFC3339) |

### Transaction Types

| Type | Description |
|------|-------------|
| `TOP_UP` | Online top-up via card |
| `CASH_IN` | Cash top-up at booth |
| `PURCHASE` | Payment at stand |
| `REFUND` | Refund from stand/admin |
| `TRANSFER` | P2P transfer |
| `CASH_OUT` | Withdrawal/refund at end |

### Transaction Status Values

| Status | Description |
|--------|-------------|
| `PENDING` | Transaction in progress |
| `COMPLETED` | Transaction completed |
| `FAILED` | Transaction failed |
| `REFUNDED` | Transaction was refunded |

---

## QR Code Format

The wallet QR code contains a signed JWT payload for secure offline validation:

```json
{
  "qrCode": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "balance": 5000
}
```

### QR Payload Structure (Decoded)

```json
{
  "walletId": "456e4567-e89b-12d3-a456-426614174000",
  "userId": "789e4567-e89b-12d3-a456-426614174000",
  "festivalId": "123e4567-e89b-12d3-a456-426614174000",
  "iat": 1720000000,
  "exp": 1720003600
}
```

The QR code:
- Expires after 1 hour
- Can be refreshed by calling the QR endpoint again
- Is signed with the festival's secret key
- Contains wallet identification for payment processing

---

## User Wallet Endpoints

### Get My Wallets

List all wallets for the authenticated user.

```
GET /api/v1/me/wallets
```

#### Authentication

Requires authentication.

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "456e4567-e89b-12d3-a456-426614174000",
      "userId": "789e4567-e89b-12d3-a456-426614174000",
      "festivalId": "123e4567-e89b-12d3-a456-426614174000",
      "balance": 5000,
      "balanceDisplay": "50 Jetons",
      "status": "ACTIVE",
      "createdAt": "2024-07-15T10:30:00Z",
      "updatedAt": "2024-07-15T14:20:00Z"
    }
  ]
}
```

#### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/me/wallets" \
  -H "Authorization: Bearer <token>"
```

---

### Get My Wallet for Festival

Get or create a wallet for a specific festival.

```
GET /api/v1/me/wallets/:festivalId
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |

#### Response

**200 OK**

```json
{
  "data": {
    "id": "456e4567-e89b-12d3-a456-426614174000",
    "userId": "789e4567-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "balance": 5000,
    "balanceDisplay": "50 Jetons",
    "status": "ACTIVE",
    "createdAt": "2024-07-15T10:30:00Z",
    "updatedAt": "2024-07-15T14:20:00Z"
  }
}
```

#### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/me/wallets/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

---

### Create Wallet for Festival

Create a wallet for the user in a specific festival.

```
POST /api/v1/me/wallets/:festivalId
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |

#### Response

**201 Created**

```json
{
  "data": {
    "id": "456e4567-e89b-12d3-a456-426614174000",
    "userId": "789e4567-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "balance": 0,
    "balanceDisplay": "0 Jetons",
    "status": "ACTIVE",
    "createdAt": "2024-07-15T10:30:00Z",
    "updatedAt": "2024-07-15T10:30:00Z"
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/me/wallets/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

---

### Generate QR Code

Generate a QR code payload for the user's wallet.

```
GET /api/v1/me/wallets/:festivalId/qr
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |

#### Response

**200 OK**

```json
{
  "data": {
    "qrCode": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3YWxsZXRJZCI6IjQ1NmU0NTY3LWU4OWItMTJkMy1hNDU2LTQyNjYxNDE3NDAwMCIsInVzZXJJZCI6Ijc4OWU0NTY3LWU4OWItMTJkMy1hNDU2LTQyNjYxNDE3NDAwMCIsImZlc3RpdmFsSWQiOiIxMjNlNDU2Ny1lODliLTEyZDMtYTQ1Ni00MjY2MTQxNzQwMDAiLCJpYXQiOjE3MjAwMDAwMDAsImV4cCI6MTcyMDAwMzYwMH0.signature",
    "balance": 5000
  }
}
```

#### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/me/wallets/123e4567-e89b-12d3-a456-426614174000/qr" \
  -H "Authorization: Bearer <token>"
```

---

### Get My Transactions

Get paginated transaction history for a wallet.

```
GET /api/v1/me/wallets/:festivalId/transactions
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 20 | Items per page |

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "abc12345-e89b-12d3-a456-426614174000",
      "walletId": "456e4567-e89b-12d3-a456-426614174000",
      "type": "PURCHASE",
      "amount": -500,
      "amountDisplay": "-5 Jetons",
      "balanceBefore": 5000,
      "balanceAfter": 4500,
      "standId": "stand123-e89b-12d3-a456-426614174000",
      "metadata": {
        "description": "Beer purchase"
      },
      "status": "COMPLETED",
      "createdAt": "2024-07-15T14:30:00Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "per_page": 20
  }
}
```

#### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/me/wallets/123e4567-e89b-12d3-a456-426614174000/transactions?page=1&per_page=20" \
  -H "Authorization: Bearer <token>"
```

---

## Staff Wallet Endpoints

### Get Wallet by ID

Get a wallet by its ID (staff only).

```
GET /api/v1/wallets/:id
```

#### Authentication

Requires authentication with `staff` role.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Wallet ID |

#### Response

**200 OK**

```json
{
  "data": {
    "id": "456e4567-e89b-12d3-a456-426614174000",
    "userId": "789e4567-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "balance": 5000,
    "balanceDisplay": "50 Jetons",
    "status": "ACTIVE",
    "createdAt": "2024-07-15T10:30:00Z",
    "updatedAt": "2024-07-15T14:20:00Z"
  }
}
```

#### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/wallets/456e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

---

### Top Up Wallet

Add funds to a wallet (staff only, for cash top-ups).

```
POST /api/v1/wallets/:id/topup
```

#### Authentication

Requires authentication with `staff` role.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Wallet ID |

#### Request Body

```json
{
  "amount": 2000,
  "paymentMethod": "cash",
  "reference": "receipt_001"
}
```

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | integer | Yes | Amount in cents (min: 100 = 1 EUR) |
| `paymentMethod` | string | Yes | `card` or `cash` |
| `reference` | string | No | External reference |

#### Response

**200 OK**

```json
{
  "data": {
    "id": "txn12345-e89b-12d3-a456-426614174000",
    "walletId": "456e4567-e89b-12d3-a456-426614174000",
    "type": "CASH_IN",
    "amount": 2000,
    "amountDisplay": "20 Jetons",
    "balanceBefore": 5000,
    "balanceAfter": 7000,
    "reference": "receipt_001",
    "staffId": "staff123-e89b-12d3-a456-426614174000",
    "metadata": {
      "paymentMethod": "cash"
    },
    "status": "COMPLETED",
    "createdAt": "2024-07-15T15:00:00Z"
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/wallets/456e4567-e89b-12d3-a456-426614174000/topup" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 2000,
    "paymentMethod": "cash"
  }'
```

---

### Freeze Wallet

Freeze a wallet to prevent transactions (admin only).

```
POST /api/v1/wallets/:id/freeze
```

#### Authentication

Requires authentication with `admin` role.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Wallet ID |

#### Response

**200 OK**

```json
{
  "data": {
    "id": "456e4567-e89b-12d3-a456-426614174000",
    "userId": "789e4567-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "balance": 5000,
    "balanceDisplay": "50 Jetons",
    "status": "FROZEN",
    "createdAt": "2024-07-15T10:30:00Z",
    "updatedAt": "2024-07-15T16:00:00Z"
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/wallets/456e4567-e89b-12d3-a456-426614174000/freeze" \
  -H "Authorization: Bearer <token>"
```

---

### Unfreeze Wallet

Unfreeze a frozen wallet (admin only).

```
POST /api/v1/wallets/:id/unfreeze
```

#### Authentication

Requires authentication with `admin` role.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Wallet ID |

#### Response

**200 OK**

```json
{
  "data": {
    "id": "456e4567-e89b-12d3-a456-426614174000",
    "status": "ACTIVE",
    "...": "..."
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/wallets/456e4567-e89b-12d3-a456-426614174000/unfreeze" \
  -H "Authorization: Bearer <token>"
```

---

## Payment Endpoints

### Process Payment

Process a payment at a stand (staff only).

```
POST /api/v1/payments
```

#### Authentication

Requires authentication with `staff` role.

#### Request Body

```json
{
  "walletId": "456e4567-e89b-12d3-a456-426614174000",
  "amount": 500,
  "standId": "stand123-e89b-12d3-a456-426614174000",
  "productIds": ["prod1", "prod2"]
}
```

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletId` | uuid | Yes | Wallet to charge |
| `amount` | integer | Yes | Amount in cents (min: 1) |
| `standId` | uuid | Yes | Stand processing the payment |
| `productIds` | array | No | Products being purchased |

#### Response

**200 OK**

```json
{
  "data": {
    "id": "txn67890-e89b-12d3-a456-426614174000",
    "walletId": "456e4567-e89b-12d3-a456-426614174000",
    "type": "PURCHASE",
    "amount": -500,
    "amountDisplay": "-5 Jetons",
    "balanceBefore": 7000,
    "balanceAfter": 6500,
    "standId": "stand123-e89b-12d3-a456-426614174000",
    "staffId": "staff123-e89b-12d3-a456-426614174000",
    "metadata": {
      "productIds": ["prod1", "prod2"]
    },
    "status": "COMPLETED",
    "createdAt": "2024-07-15T15:30:00Z"
  }
}
```

#### Error Responses

**400 Bad Request - Insufficient Balance**

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance"
  }
}
```

**400 Bad Request - Wallet Frozen**

```json
{
  "error": {
    "code": "WALLET_FROZEN",
    "message": "Wallet is frozen"
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/payments" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "walletId": "456e4567-e89b-12d3-a456-426614174000",
    "amount": 500,
    "standId": "stand123-e89b-12d3-a456-426614174000",
    "productIds": ["prod1", "prod2"]
  }'
```

---

### Validate QR Code

Validate a QR code and return wallet information (staff only).

```
POST /api/v1/payments/validate-qr
```

#### Authentication

Requires authentication with `staff` role.

#### Request Body

```json
{
  "qrCode": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `qrCode` | string | Yes | QR code payload (JWT) |

#### Response

**200 OK**

```json
{
  "data": {
    "id": "456e4567-e89b-12d3-a456-426614174000",
    "userId": "789e4567-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "balance": 5000,
    "balanceDisplay": "50 Jetons",
    "status": "ACTIVE",
    "createdAt": "2024-07-15T10:30:00Z",
    "updatedAt": "2024-07-15T14:20:00Z"
  }
}
```

#### Error Responses

**400 Bad Request - Invalid QR**

```json
{
  "error": {
    "code": "INVALID_QR",
    "message": "QR code has expired"
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/payments/validate-qr" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "qrCode": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

---

### Refund Payment

Refund a previous transaction (staff only).

```
POST /api/v1/payments/refund
```

#### Authentication

Requires authentication with `staff` role.

#### Request Body

```json
{
  "transactionId": "txn67890-e89b-12d3-a456-426614174000",
  "reason": "Customer requested refund"
}
```

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transactionId` | uuid | Yes | Transaction to refund |
| `reason` | string | No | Reason for refund |

#### Response

**200 OK**

```json
{
  "data": {
    "id": "txn99999-e89b-12d3-a456-426614174000",
    "walletId": "456e4567-e89b-12d3-a456-426614174000",
    "type": "REFUND",
    "amount": 500,
    "amountDisplay": "5 Jetons",
    "balanceBefore": 6500,
    "balanceAfter": 7000,
    "reference": "txn67890-e89b-12d3-a456-426614174000",
    "staffId": "staff123-e89b-12d3-a456-426614174000",
    "metadata": {
      "description": "Customer requested refund"
    },
    "status": "COMPLETED",
    "createdAt": "2024-07-15T16:00:00Z"
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/payments/refund" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "txn67890-e89b-12d3-a456-426614174000",
    "reason": "Customer requested refund"
  }'
```

---

## Error Responses

### Invalid Wallet ID

**400 Bad Request**

```json
{
  "error": {
    "code": "INVALID_ID",
    "message": "Invalid wallet ID"
  }
}
```

### Wallet Not Found

**404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Wallet not found"
  }
}
```

### Unauthorized

**401 Unauthorized**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid user"
  }
}
```

### Staff Authentication Required

**401 Unauthorized**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Staff authentication required"
  }
}
```
