# Ticket Endpoints

Manage festival tickets including ticket types (e.g., VIP, Regular, Day Pass) and individual tickets purchased by attendees.

## Endpoints Overview

### Ticket Type Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/festivals/:festivalId/ticket-types` | Create a ticket type | Yes (organizer) |
| GET | `/festivals/:festivalId/ticket-types` | List ticket types | Yes |
| GET | `/festivals/:festivalId/ticket-types/:id` | Get ticket type by ID | Yes |
| PATCH | `/festivals/:festivalId/ticket-types/:id` | Update a ticket type | Yes (organizer) |
| DELETE | `/festivals/:festivalId/ticket-types/:id` | Delete a ticket type | Yes (organizer) |

### Ticket Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/festivals/:festivalId/tickets` | Create a ticket | Yes (organizer) |
| GET | `/festivals/:festivalId/tickets` | List tickets | Yes (organizer) |
| GET | `/festivals/:festivalId/tickets/:id` | Get ticket by ID | Yes |
| GET | `/me/tickets` | Get user's tickets | Yes |
| POST | `/festivals/:festivalId/tickets/transfer` | Transfer a ticket | Yes |

### Scanning Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/festivals/:festivalId/tickets/scan` | Scan a ticket | Yes (staff) |
| GET | `/festivals/:festivalId/tickets/:id/scans` | Get ticket scan history | Yes (staff) |

---

## Ticket Type Object

Represents a category of tickets (e.g., "VIP 3-Day Pass", "Saturday Day Pass").

```json
{
  "id": "type123-e89b-12d3-a456-426614174000",
  "festivalId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "VIP 3-Day Pass",
  "description": "Full festival access with VIP perks",
  "price": 25000,
  "priceDisplay": "250.00 EUR",
  "quantity": 500,
  "quantitySold": 150,
  "available": 350,
  "validFrom": "2024-07-15T00:00:00Z",
  "validUntil": "2024-07-17T23:59:59Z",
  "benefits": [
    "VIP area access",
    "Fast-track entry",
    "Free drink included"
  ],
  "settings": {
    "allowReentry": true,
    "includesTopUp": true,
    "topUpAmount": 2000,
    "requiresId": true,
    "transferAllowed": true,
    "maxTransfers": 1,
    "color": "#FFD700",
    "accessZones": ["main", "vip", "backstage-view"]
  },
  "status": "ACTIVE",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Ticket Type Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `festivalId` | uuid | Associated festival |
| `name` | string | Ticket type name |
| `description` | string | Description |
| `price` | integer | Price in cents |
| `priceDisplay` | string | Formatted price |
| `quantity` | integer | Total available (null = unlimited) |
| `quantitySold` | integer | Number sold |
| `available` | integer | Remaining available (-1 = unlimited) |
| `validFrom` | string | Validity start (RFC3339) |
| `validUntil` | string | Validity end (RFC3339) |
| `benefits` | array | List of benefits |
| `settings` | object | Ticket settings |
| `status` | string | Ticket type status |
| `createdAt` | string | Creation timestamp |

### Ticket Type Status Values

| Status | Description |
|--------|-------------|
| `ACTIVE` | Available for purchase |
| `INACTIVE` | Not available for purchase |
| `SOLD_OUT` | All tickets sold |

### Ticket Settings

| Field | Type | Description |
|-------|------|-------------|
| `allowReentry` | boolean | Can re-enter festival |
| `includesTopUp` | boolean | Includes wallet balance |
| `topUpAmount` | integer | Included balance (cents) |
| `requiresId` | boolean | ID verification required |
| `transferAllowed` | boolean | Can transfer to another person |
| `maxTransfers` | integer | Maximum transfer count |
| `color` | string | UI color (hex) |
| `accessZones` | array | Accessible zones |

---

## Ticket Object

Represents an individual ticket purchased by a user.

```json
{
  "id": "ticket123-e89b-12d3-a456-426614174000",
  "ticketTypeId": "type123-e89b-12d3-a456-426614174000",
  "festivalId": "123e4567-e89b-12d3-a456-426614174000",
  "userId": "789e4567-e89b-12d3-a456-426614174000",
  "code": "FEST-2024-ABCD1234",
  "holderName": "John Doe",
  "holderEmail": "john@example.com",
  "status": "VALID",
  "checkedInAt": "2024-07-15T14:30:00Z",
  "createdAt": "2024-02-01T10:00:00Z"
}
```

### Ticket Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `ticketTypeId` | uuid | Associated ticket type |
| `festivalId` | uuid | Associated festival |
| `userId` | uuid | Owner user ID (optional) |
| `code` | string | Unique ticket code for QR |
| `holderName` | string | Name on ticket |
| `holderEmail` | string | Email for ticket holder |
| `status` | string | Ticket status |
| `checkedInAt` | string | Check-in timestamp (if used) |
| `createdAt` | string | Creation timestamp |

### Ticket Status Values

| Status | Description |
|--------|-------------|
| `VALID` | Ticket is valid and unused |
| `USED` | Ticket has been scanned for entry |
| `EXPIRED` | Ticket validity has passed |
| `CANCELLED` | Ticket was cancelled/refunded |
| `TRANSFERRED` | Ticket was transferred |

---

## Scan Response Object

```json
{
  "success": true,
  "ticket": {
    "id": "ticket123-e89b-12d3-a456-426614174000",
    "ticketTypeId": "type123-e89b-12d3-a456-426614174000",
    "code": "FEST-2024-ABCD1234",
    "holderName": "John Doe",
    "status": "USED"
  },
  "result": "SUCCESS",
  "message": "Ticket valid - Entry granted",
  "scannedAt": "2024-07-15T14:30:00Z"
}
```

### Scan Result Values

| Result | Description |
|--------|-------------|
| `SUCCESS` | Scan successful |
| `FAILED` | Scan failed (generic) |
| `ALREADY_USED` | Ticket already used |
| `EXPIRED` | Ticket expired |
| `INVALID` | Invalid ticket code |

---

## Ticket Type Endpoints

### Create Ticket Type

Create a new ticket type for a festival.

```
POST /api/v1/festivals/:festivalId/ticket-types
```

#### Authentication

Requires authentication with `organizer` or `admin` role.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |

#### Request Body

```json
{
  "name": "VIP 3-Day Pass",
  "description": "Full festival access with VIP perks",
  "price": 25000,
  "quantity": 500,
  "validFrom": "2024-07-15T00:00:00Z",
  "validUntil": "2024-07-17T23:59:59Z",
  "benefits": [
    "VIP area access",
    "Fast-track entry",
    "Free drink included"
  ],
  "settings": {
    "allowReentry": true,
    "includesTopUp": true,
    "topUpAmount": 2000,
    "requiresId": true,
    "transferAllowed": true,
    "maxTransfers": 1,
    "color": "#FFD700",
    "accessZones": ["main", "vip"]
  }
}
```

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Ticket type name |
| `description` | string | No | Description |
| `price` | integer | Yes | Price in cents (min: 0) |
| `quantity` | integer | No | Total available (null = unlimited) |
| `validFrom` | string | Yes | Validity start (ISO 8601) |
| `validUntil` | string | Yes | Validity end (ISO 8601) |
| `benefits` | array | No | List of benefits |
| `settings` | object | No | Ticket settings |

#### Response

**201 Created**

```json
{
  "data": {
    "id": "type123-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "VIP 3-Day Pass",
    "description": "Full festival access with VIP perks",
    "price": 25000,
    "priceDisplay": "250.00 EUR",
    "quantity": 500,
    "quantitySold": 0,
    "available": 500,
    "validFrom": "2024-07-15T00:00:00Z",
    "validUntil": "2024-07-17T23:59:59Z",
    "benefits": ["VIP area access", "Fast-track entry", "Free drink included"],
    "settings": {
      "allowReentry": true,
      "includesTopUp": true,
      "topUpAmount": 2000,
      "requiresId": true,
      "transferAllowed": true,
      "maxTransfers": 1,
      "color": "#FFD700",
      "accessZones": ["main", "vip"]
    },
    "status": "ACTIVE",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/ticket-types" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VIP 3-Day Pass",
    "description": "Full festival access with VIP perks",
    "price": 25000,
    "quantity": 500,
    "validFrom": "2024-07-15T00:00:00Z",
    "validUntil": "2024-07-17T23:59:59Z",
    "benefits": ["VIP area access", "Fast-track entry"]
  }'
```

---

### List Ticket Types

Get all ticket types for a festival.

```
GET /api/v1/festivals/:festivalId/ticket-types
```

#### Authentication

Requires authentication.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "type123-e89b-12d3-a456-426614174000",
      "festivalId": "123e4567-e89b-12d3-a456-426614174000",
      "name": "VIP 3-Day Pass",
      "price": 25000,
      "priceDisplay": "250.00 EUR",
      "quantity": 500,
      "quantitySold": 150,
      "available": 350,
      "status": "ACTIVE",
      "...": "..."
    },
    {
      "id": "type456-e89b-12d3-a456-426614174000",
      "name": "Regular 3-Day Pass",
      "price": 15000,
      "priceDisplay": "150.00 EUR",
      "status": "ACTIVE",
      "...": "..."
    }
  ]
}
```

#### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/ticket-types" \
  -H "Authorization: Bearer <token>"
```

---

### Get Ticket Type by ID

Get a specific ticket type.

```
GET /api/v1/festivals/:festivalId/ticket-types/:id
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |
| `id` | uuid | Ticket type ID |

#### Response

**200 OK**

```json
{
  "data": {
    "id": "type123-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "VIP 3-Day Pass",
    "description": "Full festival access with VIP perks",
    "price": 25000,
    "priceDisplay": "250.00 EUR",
    "...": "..."
  }
}
```

---

### Update Ticket Type

Update a ticket type.

```
PATCH /api/v1/festivals/:festivalId/ticket-types/:id
```

#### Authentication

Requires authentication with `organizer` or `admin` role.

#### Request Body

All fields are optional.

```json
{
  "name": "Updated VIP Pass",
  "price": 27500,
  "quantity": 600,
  "status": "INACTIVE"
}
```

#### Response

**200 OK**

```json
{
  "data": {
    "id": "type123-e89b-12d3-a456-426614174000",
    "name": "Updated VIP Pass",
    "price": 27500,
    "priceDisplay": "275.00 EUR",
    "quantity": 600,
    "status": "INACTIVE",
    "...": "..."
  }
}
```

#### Example

```bash
curl -X PATCH "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/ticket-types/type123-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 27500,
    "quantity": 600
  }'
```

---

### Delete Ticket Type

Delete a ticket type.

```
DELETE /api/v1/festivals/:festivalId/ticket-types/:id
```

#### Authentication

Requires authentication with `organizer` or `admin` role.

#### Response

**204 No Content**

---

## Ticket Endpoints

### Create Ticket

Create a new ticket (typically through purchase or manual creation).

```
POST /api/v1/festivals/:festivalId/tickets
```

#### Authentication

Requires authentication with `organizer` or `admin` role.

#### Request Body

```json
{
  "ticketTypeId": "type123-e89b-12d3-a456-426614174000",
  "userId": "789e4567-e89b-12d3-a456-426614174000",
  "holderName": "John Doe",
  "holderEmail": "john@example.com"
}
```

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticketTypeId` | uuid | Yes | Ticket type to create |
| `userId` | uuid | No | User to assign ticket to |
| `holderName` | string | No | Ticket holder name |
| `holderEmail` | string | No | Ticket holder email |

#### Response

**201 Created**

```json
{
  "data": {
    "id": "ticket123-e89b-12d3-a456-426614174000",
    "ticketTypeId": "type123-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "userId": "789e4567-e89b-12d3-a456-426614174000",
    "code": "FEST-2024-ABCD1234",
    "holderName": "John Doe",
    "holderEmail": "john@example.com",
    "status": "VALID",
    "createdAt": "2024-02-01T10:00:00Z"
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/tickets" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketTypeId": "type123-e89b-12d3-a456-426614174000",
    "holderName": "John Doe",
    "holderEmail": "john@example.com"
  }'
```

---

### List Tickets

List all tickets for a festival (admin/organizer only).

```
GET /api/v1/festivals/:festivalId/tickets
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 20 | Items per page |
| `status` | string | - | Filter by status |
| `ticketTypeId` | uuid | - | Filter by ticket type |

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "ticket123-e89b-12d3-a456-426614174000",
      "ticketTypeId": "type123-e89b-12d3-a456-426614174000",
      "code": "FEST-2024-ABCD1234",
      "holderName": "John Doe",
      "status": "VALID",
      "...": "..."
    }
  ],
  "meta": {
    "total": 1500,
    "page": 1,
    "per_page": 20
  }
}
```

---

### Get My Tickets

Get tickets for the authenticated user.

```
GET /api/v1/me/tickets
```

#### Authentication

Requires authentication.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Filter by festival (optional) |

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "ticket123-e89b-12d3-a456-426614174000",
      "ticketTypeId": "type123-e89b-12d3-a456-426614174000",
      "festivalId": "123e4567-e89b-12d3-a456-426614174000",
      "code": "FEST-2024-ABCD1234",
      "holderName": "John Doe",
      "holderEmail": "john@example.com",
      "status": "VALID",
      "createdAt": "2024-02-01T10:00:00Z"
    }
  ]
}
```

#### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/me/tickets" \
  -H "Authorization: Bearer <token>"
```

---

### Transfer Ticket

Transfer a ticket to another person.

```
POST /api/v1/festivals/:festivalId/tickets/transfer
```

#### Authentication

Requires authentication (ticket owner).

#### Request Body

```json
{
  "ticketId": "ticket123-e89b-12d3-a456-426614174000",
  "newHolderEmail": "jane@example.com",
  "newHolderName": "Jane Smith"
}
```

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticketId` | uuid | Yes | Ticket to transfer |
| `newHolderEmail` | string | Yes | New holder's email |
| `newHolderName` | string | Yes | New holder's name |

#### Response

**200 OK**

```json
{
  "data": {
    "id": "ticket456-e89b-12d3-a456-426614174000",
    "ticketTypeId": "type123-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "code": "FEST-2024-EFGH5678",
    "holderName": "Jane Smith",
    "holderEmail": "jane@example.com",
    "status": "VALID",
    "createdAt": "2024-02-15T10:00:00Z"
  }
}
```

#### Error Responses

**400 Bad Request - Transfer Not Allowed**

```json
{
  "error": {
    "code": "TRANSFER_NOT_ALLOWED",
    "message": "This ticket type does not allow transfers"
  }
}
```

**400 Bad Request - Max Transfers Exceeded**

```json
{
  "error": {
    "code": "MAX_TRANSFERS_EXCEEDED",
    "message": "Maximum number of transfers reached"
  }
}
```

---

## Scanning Endpoints

### Scan Ticket

Scan a ticket for entry/exit (staff only).

```
POST /api/v1/festivals/:festivalId/tickets/scan
```

#### Authentication

Requires authentication with `staff` role.

#### Request Body

```json
{
  "code": "FEST-2024-ABCD1234",
  "scanType": "ENTRY",
  "location": "Main Entrance",
  "deviceId": "scanner_001"
}
```

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Ticket code (from QR) |
| `scanType` | string | Yes | ENTRY, EXIT, or CHECK |
| `location` | string | No | Scan location |
| `deviceId` | string | No | Scanner device ID |

### Scan Types

| Type | Description |
|------|-------------|
| `ENTRY` | Record festival entry |
| `EXIT` | Record festival exit |
| `CHECK` | Verify ticket without recording entry/exit |

#### Response

**200 OK - Success**

```json
{
  "data": {
    "success": true,
    "ticket": {
      "id": "ticket123-e89b-12d3-a456-426614174000",
      "ticketTypeId": "type123-e89b-12d3-a456-426614174000",
      "code": "FEST-2024-ABCD1234",
      "holderName": "John Doe",
      "status": "USED",
      "checkedInAt": "2024-07-15T14:30:00Z"
    },
    "result": "SUCCESS",
    "message": "Entry granted",
    "scannedAt": "2024-07-15T14:30:00Z"
  }
}
```

**200 OK - Already Used**

```json
{
  "data": {
    "success": false,
    "ticket": {
      "id": "ticket123-e89b-12d3-a456-426614174000",
      "code": "FEST-2024-ABCD1234",
      "status": "USED",
      "checkedInAt": "2024-07-15T14:30:00Z"
    },
    "result": "ALREADY_USED",
    "message": "Ticket already scanned at 2024-07-15 14:30",
    "scannedAt": "2024-07-15T15:00:00Z"
  }
}
```

**200 OK - Invalid**

```json
{
  "data": {
    "success": false,
    "ticket": null,
    "result": "INVALID",
    "message": "Invalid ticket code",
    "scannedAt": "2024-07-15T14:30:00Z"
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/tickets/scan" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "FEST-2024-ABCD1234",
    "scanType": "ENTRY",
    "location": "Main Entrance"
  }'
```

---

### Get Ticket Scan History

Get scan history for a specific ticket (staff only).

```
GET /api/v1/festivals/:festivalId/tickets/:id/scans
```

#### Authentication

Requires authentication with `staff` role.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |
| `id` | uuid | Ticket ID |

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "scan123-e89b-12d3-a456-426614174000",
      "ticketId": "ticket123-e89b-12d3-a456-426614174000",
      "festivalId": "123e4567-e89b-12d3-a456-426614174000",
      "scanType": "ENTRY",
      "scannedBy": "staff123-e89b-12d3-a456-426614174000",
      "location": "Main Entrance",
      "deviceId": "scanner_001",
      "result": "SUCCESS",
      "message": "Entry granted",
      "scannedAt": "2024-07-15T14:30:00Z"
    },
    {
      "id": "scan456-e89b-12d3-a456-426614174000",
      "ticketId": "ticket123-e89b-12d3-a456-426614174000",
      "scanType": "EXIT",
      "result": "SUCCESS",
      "scannedAt": "2024-07-15T18:00:00Z"
    }
  ]
}
```

#### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/tickets/ticket123-e89b-12d3-a456-426614174000/scans" \
  -H "Authorization: Bearer <token>"
```

---

## Error Responses

### Ticket Not Found

**404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Ticket not found"
  }
}
```

### Ticket Already Used

**400 Bad Request**

```json
{
  "error": {
    "code": "TICKET_ALREADY_USED",
    "message": "Ticket has already been used"
  }
}
```

### Ticket Expired

**400 Bad Request**

```json
{
  "error": {
    "code": "TICKET_EXPIRED",
    "message": "Ticket has expired"
  }
}
```

### Sold Out

**400 Bad Request**

```json
{
  "error": {
    "code": "SOLD_OUT",
    "message": "No tickets available for this type"
  }
}
```
