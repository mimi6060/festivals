# Stands API

Manage vendor booths (stands) at festivals, including staff assignments.

## Base URL

```
/api/v1
```

## Endpoints

### Stand Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/stands` | Create stand | Organizer |
| `GET` | `/stands` | List stands | User |
| `GET` | `/stands/{id}` | Get stand by ID | User |
| `PATCH` | `/stands/{id}` | Update stand | Organizer |
| `DELETE` | `/stands/{id}` | Delete stand | Organizer |
| `POST` | `/stands/{id}/activate` | Activate stand | Organizer |
| `POST` | `/stands/{id}/deactivate` | Deactivate stand | Organizer |

### Staff Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/stands/{id}/staff` | Get stand staff | Organizer |
| `POST` | `/stands/{id}/staff` | Assign staff | Organizer |
| `DELETE` | `/stands/{id}/staff/{userId}` | Remove staff | Organizer |
| `POST` | `/stands/{id}/staff/{userId}/validate-pin` | Validate PIN | Staff |

### User Stands

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/me/stands` | Get user's assigned stands | Staff |

---

## Stand Object

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "festivalId": "660e8400-e29b-41d4-a716-446655440001",
  "name": "Main Bar",
  "description": "Central bar with craft beers and cocktails",
  "category": "BAR",
  "location": "Zone A - Main Stage",
  "imageUrl": "https://cdn.festivals.app/stands/main-bar.jpg",
  "status": "ACTIVE",
  "settings": {
    "acceptsOnlyTokens": true,
    "requiresPin": true,
    "printReceipts": false,
    "color": "#FF5733"
  },
  "staffCount": 5,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `festivalId` | uuid | Festival ID |
| `name` | string | Stand name |
| `description` | string | Stand description |
| `category` | string | Stand category |
| `location` | string | Physical location/zone |
| `imageUrl` | string | Stand image URL |
| `status` | string | Current status |
| `settings` | object | Stand configuration |
| `staffCount` | integer | Number of assigned staff |
| `createdAt` | datetime | Creation timestamp |
| `updatedAt` | datetime | Last update timestamp |

### Stand Categories

| Category | Description |
|----------|-------------|
| `BAR` | Drinks and beverages |
| `FOOD` | Food vendors |
| `MERCHANDISE` | Festival merchandise |
| `TICKETS` | Ticket booth |
| `TOP_UP` | Wallet top-up station |
| `OTHER` | Other services |

### Stand Status

| Status | Description |
|--------|-------------|
| `ACTIVE` | Open for business |
| `INACTIVE` | Not operational |
| `CLOSED` | Permanently closed |

### Stand Settings

| Field | Type | Description |
|-------|------|-------------|
| `acceptsOnlyTokens` | boolean | Only accepts festival tokens |
| `requiresPin` | boolean | Staff PIN required for transactions |
| `printReceipts` | boolean | Print physical receipts |
| `color` | string | UI color (hex) |

---

## Staff Assignment Object

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "standId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "880e8400-e29b-41d4-a716-446655440003",
  "role": "CASHIER",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Staff Roles

| Role | Description |
|------|-------------|
| `MANAGER` | Full stand management |
| `CASHIER` | Process transactions |
| `ASSISTANT` | Limited operations |

---

## Create Stand

```http
POST /api/v1/stands
```

Create a new stand for a festival.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/stands" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Bar",
    "description": "Central bar with craft beers and cocktails",
    "category": "BAR",
    "location": "Zone A - Main Stage",
    "imageUrl": "https://cdn.festivals.app/stands/main-bar.jpg",
    "settings": {
      "acceptsOnlyTokens": true,
      "requiresPin": true,
      "printReceipts": false
    }
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Stand name |
| `description` | string | No | Description |
| `category` | string | Yes | Stand category |
| `location` | string | No | Physical location |
| `imageUrl` | string | No | Image URL |
| `settings` | object | No | Stand settings |

### Response

**201 Created**

Returns the created stand object.

---

## List Stands

```http
GET /api/v1/stands
```

Get stands for a festival.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/stands?page=1&per_page=20&category=BAR" \
  -H "Authorization: Bearer $TOKEN"
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `per_page` | integer | Items per page |
| `category` | string | Filter by category |

### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Main Bar",
      "category": "BAR",
      "location": "Zone A",
      "status": "ACTIVE"
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

## Get Stand

```http
GET /api/v1/stands/{id}
```

Get a specific stand by ID.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/stands/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns the full stand object.

---

## Update Stand

```http
PATCH /api/v1/stands/{id}
```

Update an existing stand.

### Request

```bash
curl -X PATCH "https://api.festivals.app/api/v1/stands/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VIP Bar",
    "location": "VIP Zone",
    "settings": {
      "requiresPin": false
    }
  }'
```

### Response

**200 OK**

Returns the updated stand object.

---

## Delete Stand

```http
DELETE /api/v1/stands/{id}
```

Delete a stand.

### Request

```bash
curl -X DELETE "https://api.festivals.app/api/v1/stands/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**204 No Content**

---

## Activate Stand

```http
POST /api/v1/stands/{id}/activate
```

Activate a stand for operations.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/stands/550e8400-e29b-41d4-a716-446655440000/activate" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns the updated stand with `status: "ACTIVE"`.

---

## Deactivate Stand

```http
POST /api/v1/stands/{id}/deactivate
```

Deactivate a stand.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/stands/550e8400-e29b-41d4-a716-446655440000/deactivate" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns the updated stand with `status: "INACTIVE"`.

---

## Get Stand Staff

```http
GET /api/v1/stands/{id}/staff
```

Get staff members assigned to a stand.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/stands/550e8400-e29b-41d4-a716-446655440000/staff" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "standId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "880e8400-e29b-41d4-a716-446655440003",
      "role": "MANAGER",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "standId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "aa0e8400-e29b-41d4-a716-446655440005",
      "role": "CASHIER",
      "createdAt": "2024-01-15T11:00:00Z"
    }
  ]
}
```

---

## Assign Staff

```http
POST /api/v1/stands/{id}/staff
```

Assign a staff member to a stand.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/stands/550e8400-e29b-41d4-a716-446655440000/staff" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "880e8400-e29b-41d4-a716-446655440003",
    "role": "CASHIER",
    "pin": "1234"
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | uuid | Yes | User ID to assign |
| `role` | string | Yes | Staff role |
| `pin` | string | No | 4-6 digit PIN for transactions |

### Response

**201 Created**

Returns the staff assignment object.

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `ALREADY_ASSIGNED` | User already assigned |
| 404 | `NOT_FOUND` | Stand not found |

---

## Remove Staff

```http
DELETE /api/v1/stands/{id}/staff/{userId}
```

Remove a staff member from a stand.

### Request

```bash
curl -X DELETE "https://api.festivals.app/api/v1/stands/550e8400-e29b-41d4-a716-446655440000/staff/880e8400-e29b-41d4-a716-446655440003" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**204 No Content**

---

## Validate Staff PIN

```http
POST /api/v1/stands/{id}/staff/{userId}/validate-pin
```

Validate a staff member's PIN for transaction authentication.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/stands/550e8400-e29b-41d4-a716-446655440000/staff/880e8400-e29b-41d4-a716-446655440003/validate-pin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pin": "1234"
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pin` | string | Yes | PIN to validate |

### Response

**200 OK**

```json
{
  "data": {
    "valid": true
  }
}
```

---

## Get My Stands

```http
GET /api/v1/me/stands
```

Get stands the authenticated user is assigned to as staff.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/me/stands" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "standId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "880e8400-e29b-41d4-a716-446655440003",
      "role": "CASHIER",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```
