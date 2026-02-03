# Orders API

Manage purchase orders at festival stands. Orders track items purchased and their payment status.

## Base URL

```
/api/v1
```

## Endpoints

### User Order Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/me/orders` | Get user's orders | User |
| `GET` | `/me/orders/{orderId}` | Get specific order | User |

### Order Management (Staff)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/orders` | Create order | Staff |
| `GET` | `/orders/{id}` | Get order by ID | Staff |
| `POST` | `/orders/{id}/pay` | Process payment | Staff |
| `POST` | `/orders/{id}/cancel` | Cancel order | Staff |
| `POST` | `/orders/{id}/refund` | Refund order | Staff |

### Stand Orders

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/stands/{standId}/orders` | Get stand orders | Staff |
| `GET` | `/stands/{standId}/orders/stats` | Get stand statistics | Staff |

### Festival Orders (Admin)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/festivals/{festivalId}/orders` | Get festival orders | Admin |

---

## Order Object

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "festivalId": "660e8400-e29b-41d4-a716-446655440001",
  "userId": "770e8400-e29b-41d4-a716-446655440002",
  "walletId": "880e8400-e29b-41d4-a716-446655440003",
  "standId": "990e8400-e29b-41d4-a716-446655440004",
  "items": [
    {
      "productId": "aa0e8400-e29b-41d4-a716-446655440005",
      "productName": "Draft Beer",
      "quantity": 2,
      "unitPrice": 350,
      "unitDisplay": "3.5 Jetons",
      "totalPrice": 700,
      "totalDisplay": "7 Jetons"
    }
  ],
  "totalAmount": 700,
  "totalDisplay": "7 Jetons",
  "status": "PAID",
  "paymentMethod": "wallet",
  "transactionId": "bb0e8400-e29b-41d4-a716-446655440006",
  "staffId": "cc0e8400-e29b-41d4-a716-446655440007",
  "notes": "",
  "createdAt": "2024-01-15T14:30:00Z",
  "updatedAt": "2024-01-15T14:30:05Z"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Order unique identifier |
| `festivalId` | uuid | Festival ID |
| `userId` | uuid | Customer user ID |
| `walletId` | uuid | Wallet used for payment |
| `standId` | uuid | Stand where order was placed |
| `items` | array | Order items |
| `totalAmount` | integer | Total in cents |
| `totalDisplay` | string | Formatted total |
| `status` | string | Order status |
| `paymentMethod` | string | Payment method used |
| `transactionId` | uuid | Linked wallet transaction |
| `staffId` | uuid | Staff who processed order |
| `notes` | string | Order notes |
| `createdAt` | datetime | Creation timestamp |
| `updatedAt` | datetime | Last update timestamp |

### Order Status

| Status | Description |
|--------|-------------|
| `PENDING` | Order created, awaiting payment |
| `PAID` | Payment completed |
| `CANCELLED` | Order cancelled |
| `REFUNDED` | Order refunded |

### Payment Methods

| Method | Description |
|--------|-------------|
| `wallet` | Festival wallet |
| `cash` | Cash payment |
| `card` | Card payment |

---

## Get My Orders

```http
GET /api/v1/me/orders
```

Get paginated order history for the authenticated user.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/me/orders?festival_id=660e8400-e29b-41d4-a716-446655440001&page=1&per_page=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `festival_id` | uuid | Yes | Festival ID to filter |
| `page` | integer | No | Page number (default: 1) |
| `per_page` | integer | No | Items per page (default: 20) |

### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "festivalId": "660e8400-e29b-41d4-a716-446655440001",
      "items": [...],
      "totalAmount": 700,
      "totalDisplay": "7 Jetons",
      "status": "PAID",
      "createdAt": "2024-01-15T14:30:00Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "per_page": 20
  }
}
```

---

## Get My Order

```http
GET /api/v1/me/orders/{orderId}
```

Get details of a specific order belonging to the authenticated user.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/me/orders/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns the full order object.

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 403 | `FORBIDDEN` | Order belongs to another user |
| 404 | `NOT_FOUND` | Order not found |

---

## Create Order

```http
POST /api/v1/orders
```

Create a new order at a stand. Staff only.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "standId": "990e8400-e29b-41d4-a716-446655440004",
    "items": [
      {
        "productId": "aa0e8400-e29b-41d4-a716-446655440005",
        "quantity": 2
      },
      {
        "productId": "bb0e8400-e29b-41d4-a716-446655440006",
        "quantity": 1
      }
    ],
    "paymentMethod": "wallet",
    "notes": "No ice"
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `standId` | uuid | Yes | Stand ID |
| `items` | array | Yes | Order items (min 1) |
| `items[].productId` | uuid | Yes | Product ID |
| `items[].quantity` | integer | Yes | Quantity (min 1) |
| `paymentMethod` | string | Yes | `wallet`, `cash`, or `card` |
| `notes` | string | No | Order notes |

### Response

**201 Created**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "standId": "990e8400-e29b-41d4-a716-446655440004",
    "items": [
      {
        "productId": "aa0e8400-e29b-41d4-a716-446655440005",
        "productName": "Draft Beer",
        "quantity": 2,
        "unitPrice": 350,
        "totalPrice": 700
      }
    ],
    "totalAmount": 700,
    "totalDisplay": "7 Jetons",
    "status": "PENDING",
    "paymentMethod": "wallet",
    "createdAt": "2024-01-15T14:30:00Z"
  }
}
```

---

## Process Payment

```http
POST /api/v1/orders/{id}/pay
```

Process payment for a pending order. Staff only.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/orders/550e8400-e29b-41d4-a716-446655440000/pay" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns the updated order with `status: "PAID"` and linked `transactionId`.

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INSUFFICIENT_BALANCE` | Wallet balance too low |
| 400 | `PAYMENT_FAILED` | Payment processing failed |
| 404 | `NOT_FOUND` | Order not found |

---

## Cancel Order

```http
POST /api/v1/orders/{id}/cancel
```

Cancel a pending order. Staff only.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/orders/550e8400-e29b-41d4-a716-446655440000/cancel" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer changed mind"
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | No | Cancellation reason |

### Response

**200 OK**

Returns the updated order with `status: "CANCELLED"`.

---

## Refund Order

```http
POST /api/v1/orders/{id}/refund
```

Refund a paid order. Staff only.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/orders/550e8400-e29b-41d4-a716-446655440000/refund" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Product quality issue"
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | Yes | Refund reason |

### Response

**200 OK**

Returns the updated order with `status: "REFUNDED"`.

---

## Get Stand Orders

```http
GET /api/v1/stands/{standId}/orders
```

Get paginated orders for a specific stand. Staff only.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/stands/990e8400-e29b-41d4-a716-446655440004/orders?status=PAID&page=1" \
  -H "Authorization: Bearer $TOKEN"
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `per_page` | integer | Items per page |
| `status` | string | Filter by status |
| `start_date` | datetime | Filter by start date |
| `end_date` | datetime | Filter by end date |

### Response

**200 OK**

Returns paginated list of orders.

---

## Get Stand Statistics

```http
GET /api/v1/stands/{standId}/orders/stats
```

Get order statistics for a stand. Staff only.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/stands/990e8400-e29b-41d4-a716-446655440004/orders/stats?start_date=2024-07-15T00:00:00Z&end_date=2024-07-17T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `start_date` | datetime | Start of period |
| `end_date` | datetime | End of period |

### Response

**200 OK**

```json
{
  "data": {
    "standId": "990e8400-e29b-41d4-a716-446655440004",
    "totalOrders": 250,
    "totalRevenue": 875000,
    "averageOrder": 3500,
    "paidOrders": 235,
    "cancelledOrders": 10,
    "refundedOrders": 5
  }
}
```

---

## Get Festival Orders

```http
GET /api/v1/festivals/{festivalId}/orders
```

Get all orders for a festival. Admin only.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/660e8400-e29b-41d4-a716-446655440001/orders?page=1&per_page=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `per_page` | integer | Items per page |
| `status` | string | Filter by status |
| `start_date` | datetime | Filter by start date |
| `end_date` | datetime | Filter by end date |

### Response

**200 OK**

Returns paginated list of all festival orders.
