# Stand Endpoints

Manage festival stands (points of sale) including bars, food vendors, merchandise shops, and top-up booths. Also handles staff assignments to stands.

## Endpoints Overview

### Stand CRUD Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/festivals/:festivalId/stands` | Create a stand | Yes (organizer) |
| GET | `/festivals/:festivalId/stands` | List stands | Yes |
| GET | `/festivals/:festivalId/stands/:id` | Get stand by ID | Yes |
| PATCH | `/festivals/:festivalId/stands/:id` | Update a stand | Yes (organizer) |
| DELETE | `/festivals/:festivalId/stands/:id` | Delete a stand | Yes (organizer) |
| POST | `/festivals/:festivalId/stands/:id/activate` | Activate a stand | Yes (organizer) |
| POST | `/festivals/:festivalId/stands/:id/deactivate` | Deactivate a stand | Yes (organizer) |

### Staff Management Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/festivals/:festivalId/stands/:id/staff` | Get stand staff | Yes |
| POST | `/festivals/:festivalId/stands/:id/staff` | Assign staff | Yes (organizer) |
| DELETE | `/festivals/:festivalId/stands/:id/staff/:userId` | Remove staff | Yes (organizer) |
| POST | `/festivals/:festivalId/stands/:id/staff/:userId/validate-pin` | Validate staff PIN | Yes (staff) |
| GET | `/me/stands` | Get my assigned stands | Yes |

### Product Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/festivals/:festivalId/stands/:standId/products` | List stand products | Yes |

---

## Stand Object

```json
{
  "id": "stand123-e89b-12d3-a456-426614174000",
  "festivalId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Main Stage Bar",
  "description": "Primary bar near the main stage",
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

### Stand Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `festivalId` | uuid | Associated festival |
| `name` | string | Stand name |
| `description` | string | Description |
| `category` | string | Stand category |
| `location` | string | Physical location/zone |
| `imageUrl` | string | Stand image URL |
| `status` | string | Stand status |
| `settings` | object | Stand settings |
| `staffCount` | integer | Number of assigned staff |
| `createdAt` | string | Creation timestamp (RFC3339) |
| `updatedAt` | string | Last update timestamp (RFC3339) |

### Stand Categories

| Category | Description |
|----------|-------------|
| `BAR` | Drink stand |
| `FOOD` | Food vendor |
| `MERCHANDISE` | Merch/souvenir shop |
| `TICKETS` | Ticket booth |
| `TOP_UP` | Wallet top-up booth |
| `OTHER` | Other type |

### Stand Status Values

| Status | Description |
|--------|-------------|
| `ACTIVE` | Stand is open |
| `INACTIVE` | Stand is closed |
| `CLOSED` | Permanently closed |

### Stand Settings

| Field | Type | Description |
|-------|------|-------------|
| `acceptsOnlyTokens` | boolean | Only accepts festival tokens |
| `requiresPin` | boolean | Staff PIN required for transactions |
| `printReceipts` | boolean | Print physical receipts |
| `color` | string | UI color for the stand (hex) |

---

## Stand Staff Object

```json
{
  "id": "staff-assign-123-e89b-12d3-a456-426614174000",
  "standId": "stand123-e89b-12d3-a456-426614174000",
  "userId": "user123-e89b-12d3-a456-426614174000",
  "role": "CASHIER",
  "createdAt": "2024-07-01T08:00:00Z"
}
```

### Staff Assignment Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Assignment ID |
| `standId` | uuid | Stand ID |
| `userId` | uuid | User ID |
| `role` | string | Staff role at stand |
| `createdAt` | string | Assignment timestamp |

### Staff Roles

| Role | Description |
|------|-------------|
| `MANAGER` | Stand manager - full access |
| `CASHIER` | Can process payments |
| `ASSISTANT` | Limited access |

---

## Stand CRUD Endpoints

### Create Stand

Create a new stand for a festival.

```
POST /api/v1/festivals/:festivalId/stands
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
  "name": "Main Stage Bar",
  "description": "Primary bar near the main stage",
  "category": "BAR",
  "location": "Zone A - Main Stage",
  "imageUrl": "https://cdn.festivals.app/stands/main-bar.jpg",
  "settings": {
    "acceptsOnlyTokens": true,
    "requiresPin": true,
    "printReceipts": false,
    "color": "#FF5733"
  }
}
```

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Stand name |
| `description` | string | No | Description |
| `category` | string | Yes | BAR, FOOD, MERCHANDISE, TICKETS, TOP_UP, OTHER |
| `location` | string | No | Physical location |
| `imageUrl` | string | No | Image URL |
| `settings` | object | No | Stand settings |

#### Response

**201 Created**

```json
{
  "data": {
    "id": "stand123-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Main Stage Bar",
    "description": "Primary bar near the main stage",
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
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/stands" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Stage Bar",
    "description": "Primary bar near the main stage",
    "category": "BAR",
    "location": "Zone A - Main Stage",
    "settings": {
      "acceptsOnlyTokens": true,
      "requiresPin": true
    }
  }'
```

---

### List Stands

Get all stands for a festival.

```
GET /api/v1/festivals/:festivalId/stands
```

#### Authentication

Requires authentication.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 20 | Items per page |
| `category` | string | - | Filter by category |

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "stand123-e89b-12d3-a456-426614174000",
      "festivalId": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Main Stage Bar",
      "description": "Primary bar near the main stage",
      "category": "BAR",
      "location": "Zone A - Main Stage",
      "status": "ACTIVE",
      "settings": {
        "acceptsOnlyTokens": true,
        "requiresPin": true,
        "printReceipts": false,
        "color": "#FF5733"
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "stand456-e89b-12d3-a456-426614174000",
      "name": "Pizza Paradise",
      "category": "FOOD",
      "status": "ACTIVE",
      "...": "..."
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "per_page": 20
  }
}
```

#### Example - List All Stands

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/stands" \
  -H "Authorization: Bearer <token>"
```

#### Example - Filter by Category

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/stands?category=BAR" \
  -H "Authorization: Bearer <token>"
```

---

### Get Stand by ID

Get a specific stand.

```
GET /api/v1/festivals/:festivalId/stands/:id
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |
| `id` | uuid | Stand ID |

#### Response

**200 OK**

```json
{
  "data": {
    "id": "stand123-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Main Stage Bar",
    "description": "Primary bar near the main stage",
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
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/stands/stand123-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

---

### Update Stand

Update a stand.

```
PATCH /api/v1/festivals/:festivalId/stands/:id
```

#### Authentication

Requires authentication with `organizer` or `admin` role.

#### Request Body

All fields are optional.

```json
{
  "name": "Updated Bar Name",
  "description": "Updated description",
  "location": "New Location",
  "status": "INACTIVE",
  "settings": {
    "acceptsOnlyTokens": false,
    "requiresPin": false
  }
}
```

#### Response

**200 OK**

```json
{
  "data": {
    "id": "stand123-e89b-12d3-a456-426614174000",
    "name": "Updated Bar Name",
    "status": "INACTIVE",
    "...": "..."
  }
}
```

#### Example

```bash
curl -X PATCH "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/stands/stand123-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Bar Name",
    "location": "New Location"
  }'
```

---

### Delete Stand

Delete a stand.

```
DELETE /api/v1/festivals/:festivalId/stands/:id
```

#### Authentication

Requires authentication with `organizer` or `admin` role.

#### Response

**204 No Content**

#### Example

```bash
curl -X DELETE "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/stands/stand123-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

---

### Activate Stand

Activate a stand to make it operational.

```
POST /api/v1/festivals/:festivalId/stands/:id/activate
```

#### Response

**200 OK**

```json
{
  "data": {
    "id": "stand123-e89b-12d3-a456-426614174000",
    "status": "ACTIVE",
    "...": "..."
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/stands/stand123-e89b-12d3-a456-426614174000/activate" \
  -H "Authorization: Bearer <token>"
```

---

### Deactivate Stand

Deactivate a stand (temporarily close).

```
POST /api/v1/festivals/:festivalId/stands/:id/deactivate
```

#### Response

**200 OK**

```json
{
  "data": {
    "id": "stand123-e89b-12d3-a456-426614174000",
    "status": "INACTIVE",
    "...": "..."
  }
}
```

---

## Staff Management Endpoints

### Get Stand Staff

Get all staff assigned to a stand.

```
GET /api/v1/festivals/:festivalId/stands/:id/staff
```

#### Authentication

Requires authentication.

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "staff-assign-123-e89b-12d3-a456-426614174000",
      "standId": "stand123-e89b-12d3-a456-426614174000",
      "userId": "user123-e89b-12d3-a456-426614174000",
      "role": "MANAGER",
      "createdAt": "2024-07-01T08:00:00Z"
    },
    {
      "id": "staff-assign-456-e89b-12d3-a456-426614174000",
      "standId": "stand123-e89b-12d3-a456-426614174000",
      "userId": "user456-e89b-12d3-a456-426614174000",
      "role": "CASHIER",
      "createdAt": "2024-07-01T08:00:00Z"
    }
  ]
}
```

#### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/stands/stand123-e89b-12d3-a456-426614174000/staff" \
  -H "Authorization: Bearer <token>"
```

---

### Assign Staff to Stand

Assign a user to work at a stand.

```
POST /api/v1/festivals/:festivalId/stands/:id/staff
```

#### Authentication

Requires authentication with `organizer` or `admin` role.

#### Request Body

```json
{
  "userId": "user123-e89b-12d3-a456-426614174000",
  "role": "CASHIER",
  "pin": "1234"
}
```

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | uuid | Yes | User to assign |
| `role` | string | Yes | MANAGER, CASHIER, or ASSISTANT |
| `pin` | string | No | 4-6 digit PIN for transactions |

#### Response

**201 Created**

```json
{
  "data": {
    "id": "staff-assign-789-e89b-12d3-a456-426614174000",
    "standId": "stand123-e89b-12d3-a456-426614174000",
    "userId": "user123-e89b-12d3-a456-426614174000",
    "role": "CASHIER",
    "createdAt": "2024-07-01T10:00:00Z"
  }
}
```

#### Error Responses

**400 Bad Request - Already Assigned**

```json
{
  "error": {
    "code": "ALREADY_ASSIGNED",
    "message": "user already assigned to this stand"
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/stands/stand123-e89b-12d3-a456-426614174000/staff" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123-e89b-12d3-a456-426614174000",
    "role": "CASHIER",
    "pin": "1234"
  }'
```

---

### Remove Staff from Stand

Remove a staff member from a stand.

```
DELETE /api/v1/festivals/:festivalId/stands/:id/staff/:userId
```

#### Authentication

Requires authentication with `organizer` or `admin` role.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |
| `id` | uuid | Stand ID |
| `userId` | uuid | User ID to remove |

#### Response

**204 No Content**

#### Example

```bash
curl -X DELETE "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/stands/stand123-e89b-12d3-a456-426614174000/staff/user123-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

---

### Validate Staff PIN

Validate a staff member's PIN for transaction authorization.

```
POST /api/v1/festivals/:festivalId/stands/:id/staff/:userId/validate-pin
```

#### Authentication

Requires authentication with `staff` role.

#### Request Body

```json
{
  "pin": "1234"
}
```

#### Response

**200 OK**

```json
{
  "data": {
    "valid": true
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/stands/stand123-e89b-12d3-a456-426614174000/staff/user123-e89b-12d3-a456-426614174000/validate-pin" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"pin": "1234"}'
```

---

### Get My Stands

Get stands assigned to the authenticated user.

```
GET /api/v1/me/stands
```

#### Authentication

Requires authentication.

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "staff-assign-123-e89b-12d3-a456-426614174000",
      "standId": "stand123-e89b-12d3-a456-426614174000",
      "userId": "user123-e89b-12d3-a456-426614174000",
      "role": "CASHIER",
      "createdAt": "2024-07-01T08:00:00Z"
    }
  ]
}
```

#### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/me/stands" \
  -H "Authorization: Bearer <token>"
```

---

## Product Endpoints

### List Stand Products

Get all products for a specific stand.

```
GET /api/v1/festivals/:festivalId/stands/:standId/products
```

#### Authentication

Requires authentication.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |
| `standId` | uuid | Stand ID |

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 50 | Items per page |

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "prod123-e89b-12d3-a456-426614174000",
      "standId": "stand123-e89b-12d3-a456-426614174000",
      "name": "Craft Beer",
      "description": "Local craft beer",
      "price": 500,
      "priceDisplay": "5 Jetons",
      "category": "BEER",
      "status": "ACTIVE",
      "stock": null,
      "...": "..."
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "per_page": 50
  }
}
```

#### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/stands/stand123-e89b-12d3-a456-426614174000/products" \
  -H "Authorization: Bearer <token>"
```

---

## Error Responses

### Invalid Stand ID

**400 Bad Request**

```json
{
  "error": {
    "code": "INVALID_ID",
    "message": "Invalid stand ID"
  }
}
```

### Stand Not Found

**404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Stand not found"
  }
}
```

### Festival Context Required

**400 Bad Request**

```json
{
  "error": {
    "code": "INVALID_FESTIVAL",
    "message": "Festival context required"
  }
}
```

### Staff Assignment Not Found

**404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Staff assignment not found"
  }
}
```
