# Tickets API

Manage festival entry tickets, ticket types, and scanning operations.

## Base URL

```
/api/v1
```

## Endpoints

### Ticket Types

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/ticket-types` | Create ticket type | Organizer |
| `GET` | `/ticket-types` | List ticket types | User |
| `GET` | `/ticket-types/{id}` | Get ticket type | User |
| `PATCH` | `/ticket-types/{id}` | Update ticket type | Organizer |
| `DELETE` | `/ticket-types/{id}` | Delete ticket type | Organizer |

### Tickets

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/tickets` | Create ticket | Organizer |
| `GET` | `/tickets` | List tickets | Staff |
| `GET` | `/tickets/{id}` | Get ticket by ID | Staff |
| `GET` | `/tickets/code/{code}` | Get ticket by code | Staff |
| `POST` | `/tickets/scan` | Scan ticket | Staff |
| `POST` | `/tickets/{id}/transfer` | Transfer ticket | User |

### User Tickets

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/me/tickets` | Get user's tickets | User |

---

## Ticket Type Object

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "festivalId": "660e8400-e29b-41d4-a716-446655440001",
  "name": "VIP Pass",
  "description": "Full festival access with VIP benefits",
  "price": 15000,
  "priceDisplay": "150.00 EUR",
  "quantity": 500,
  "quantitySold": 125,
  "available": 375,
  "validFrom": "2024-07-15T00:00:00Z",
  "validUntil": "2024-07-17T23:59:59Z",
  "benefits": [
    "VIP area access",
    "Free drink on arrival",
    "Fast lane entry"
  ],
  "settings": {
    "allowReentry": true,
    "includesTopUp": true,
    "topUpAmount": 2000,
    "requiresId": true,
    "transferAllowed": true,
    "maxTransfers": 1,
    "color": "#FFD700",
    "accessZones": ["main", "vip", "backstage"]
  },
  "status": "ACTIVE",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Ticket Type Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `festivalId` | uuid | Festival ID |
| `name` | string | Ticket type name |
| `description` | string | Description |
| `price` | integer | Price in cents |
| `priceDisplay` | string | Formatted price |
| `quantity` | integer | Total available (null = unlimited) |
| `quantitySold` | integer | Number sold |
| `available` | integer | Remaining (-1 = unlimited) |
| `validFrom` | datetime | Valid from date |
| `validUntil` | datetime | Valid until date |
| `benefits` | array | List of benefits |
| `settings` | object | Ticket settings |
| `status` | string | Current status |

### Ticket Type Status

| Status | Description |
|--------|-------------|
| `ACTIVE` | Available for sale |
| `INACTIVE` | Not for sale |
| `SOLD_OUT` | No more available |

---

## Ticket Object

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "ticketTypeId": "550e8400-e29b-41d4-a716-446655440000",
  "festivalId": "660e8400-e29b-41d4-a716-446655440001",
  "userId": "880e8400-e29b-41d4-a716-446655440003",
  "code": "VIP-ABC123XYZ",
  "holderName": "John Doe",
  "holderEmail": "john@example.com",
  "status": "VALID",
  "checkedInAt": null,
  "createdAt": "2024-01-20T15:00:00Z"
}
```

### Ticket Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `ticketTypeId` | uuid | Ticket type ID |
| `festivalId` | uuid | Festival ID |
| `userId` | uuid | Owner user ID |
| `code` | string | Unique ticket code for QR |
| `holderName` | string | Ticket holder name |
| `holderEmail` | string | Ticket holder email |
| `status` | string | Current status |
| `checkedInAt` | datetime | Check-in timestamp |

### Ticket Status

| Status | Description |
|--------|-------------|
| `VALID` | Ready for use |
| `USED` | Already checked in |
| `EXPIRED` | Past validity date |
| `CANCELLED` | Cancelled/refunded |
| `TRANSFERRED` | Transferred to new owner |

---

## Create Ticket Type

```http
POST /api/v1/ticket-types
```

Create a new ticket type for a festival.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/ticket-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VIP Pass",
    "description": "Full festival access with VIP benefits",
    "price": 15000,
    "quantity": 500,
    "validFrom": "2024-07-15T00:00:00Z",
    "validUntil": "2024-07-17T23:59:59Z",
    "benefits": ["VIP area access", "Free drink"],
    "settings": {
      "allowReentry": true,
      "transferAllowed": true,
      "maxTransfers": 1
    }
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Ticket type name |
| `description` | string | No | Description |
| `price` | integer | Yes | Price in cents |
| `quantity` | integer | No | Total available (null = unlimited) |
| `validFrom` | datetime | Yes | Valid from date |
| `validUntil` | datetime | Yes | Valid until date |
| `benefits` | array | No | List of benefits |
| `settings` | object | No | Ticket settings |

### Response

**201 Created**

Returns the created ticket type object.

---

## List Ticket Types

```http
GET /api/v1/ticket-types
```

Get ticket types for a festival.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/ticket-types?festivalId=660e8400-e29b-41d4-a716-446655440001&page=1" \
  -H "Authorization: Bearer $TOKEN"
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `festivalId` | uuid | Yes | Festival ID |
| `page` | integer | No | Page number |
| `per_page` | integer | No | Items per page |

### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "VIP Pass",
      "price": 15000,
      "priceDisplay": "150.00 EUR",
      "available": 375,
      "status": "ACTIVE"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "per_page": 20
  }
}
```

---

## Create Ticket

```http
POST /api/v1/tickets
```

Create an individual ticket.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/tickets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketTypeId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "880e8400-e29b-41d4-a716-446655440003",
    "holderName": "John Doe",
    "holderEmail": "john@example.com"
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticketTypeId` | uuid | Yes | Ticket type ID |
| `userId` | uuid | No | Owner user ID |
| `holderName` | string | No | Holder name |
| `holderEmail` | string | No | Holder email |

### Response

**201 Created**

Returns the created ticket object with unique `code`.

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `SOLD_OUT` | Ticket type sold out |
| 400 | `NOT_AVAILABLE` | Not available for sale |
| 404 | `NOT_FOUND` | Ticket type not found |

---

## Get Ticket by Code

```http
GET /api/v1/tickets/code/{code}
```

Get a ticket by its unique code.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/tickets/code/VIP-ABC123XYZ" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns the ticket object.

---

## Scan Ticket

```http
POST /api/v1/tickets/scan
```

Scan a ticket for entry/exit validation. Staff only.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/tickets/scan" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "VIP-ABC123XYZ",
    "scanType": "ENTRY",
    "location": "Main Gate",
    "deviceId": "scanner-001"
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Ticket code |
| `scanType` | string | Yes | `ENTRY`, `EXIT`, or `CHECK` |
| `location` | string | No | Scan location |
| `deviceId` | string | No | Scanner device ID |

### Response

**200 OK**

```json
{
  "data": {
    "success": true,
    "ticket": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "code": "VIP-ABC123XYZ",
      "holderName": "John Doe",
      "status": "USED"
    },
    "result": "SUCCESS",
    "message": "Entry granted",
    "scannedAt": "2024-07-15T10:30:00Z"
  }
}
```

### Scan Results

| Result | Description |
|--------|-------------|
| `SUCCESS` | Scan successful |
| `ALREADY_USED` | Ticket already used |
| `EXPIRED` | Ticket expired |
| `INVALID` | Invalid ticket code |
| `FAILED` | General failure |

---

## Transfer Ticket

```http
POST /api/v1/tickets/{id}/transfer
```

Transfer a ticket to another person.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/tickets/770e8400-e29b-41d4-a716-446655440002/transfer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newHolderName": "Jane Smith",
    "newHolderEmail": "jane@example.com"
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `newHolderName` | string | Yes | New holder name |
| `newHolderEmail` | email | Yes | New holder email |

### Response

**200 OK**

Returns the updated ticket object.

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `TRANSFER_NOT_ALLOWED` | Ticket type doesn't allow transfer |
| 400 | `MAX_TRANSFERS_EXCEEDED` | Maximum transfers reached |
| 400 | `INVALID_STATUS` | Ticket not valid for transfer |
| 403 | `FORBIDDEN` | You don't own this ticket |

---

## Get My Tickets

```http
GET /api/v1/me/tickets
```

Get tickets belonging to the authenticated user.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/me/tickets?festivalId=660e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer $TOKEN"
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Filter by festival |
| `status` | string | Filter by status |
| `page` | integer | Page number |
| `per_page` | integer | Items per page |

### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "ticketTypeId": "550e8400-e29b-41d4-a716-446655440000",
      "code": "VIP-ABC123XYZ",
      "holderName": "John Doe",
      "status": "VALID",
      "checkedInAt": null,
      "createdAt": "2024-01-20T15:00:00Z"
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "per_page": 20
  }
}
```

---

## Update Ticket Type

```http
PATCH /api/v1/ticket-types/{id}
```

Update a ticket type.

### Request

```bash
curl -X PATCH "https://api.festivals.app/api/v1/ticket-types/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 17500,
    "quantity": 600,
    "status": "ACTIVE"
  }'
```

### Response

**200 OK**

Returns the updated ticket type.

---

## Delete Ticket Type

```http
DELETE /api/v1/ticket-types/{id}
```

Delete a ticket type. Cannot delete if tickets have been sold.

### Request

```bash
curl -X DELETE "https://api.festivals.app/api/v1/ticket-types/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**204 No Content**

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `HAS_TICKETS` | Cannot delete with existing tickets |
