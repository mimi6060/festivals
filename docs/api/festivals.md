# Festival Endpoints

Manage festivals on the platform. Festivals are the core entity that contains all event-related data including ticketing, stands, wallets, and lineup.

## Endpoints Overview

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/festivals` | Create a festival | Yes (organizer) |
| GET | `/festivals` | List festivals | Yes |
| GET | `/festivals/:id` | Get festival by ID | Yes |
| GET | `/festivals/:id/public` | Get public festival info | No |
| PATCH | `/festivals/:id` | Update a festival | Yes (organizer) |
| DELETE | `/festivals/:id` | Delete a festival | Yes (organizer) |
| POST | `/festivals/:id/activate` | Activate a festival | Yes (organizer) |
| POST | `/festivals/:id/archive` | Archive a festival | Yes (organizer) |

---

## Festival Object

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Summer Music Festival 2024",
  "slug": "summer-music-festival-2024",
  "description": "The biggest summer music festival in Belgium",
  "startDate": "2024-07-15",
  "endDate": "2024-07-17",
  "location": "Brussels, Belgium",
  "timezone": "Europe/Brussels",
  "currencyName": "Jetons",
  "exchangeRate": 0.10,
  "stripeAccountId": "acct_1234567890",
  "settings": {
    "refundPolicy": "auto",
    "reentryPolicy": "multiple",
    "logoUrl": "https://cdn.festivals.app/logos/summer2024.png",
    "primaryColor": "#FF5733",
    "secondaryColor": "#33FF57"
  },
  "status": "ACTIVE",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Festival Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `name` | string | Festival name |
| `slug` | string | URL-friendly unique identifier |
| `description` | string | Festival description |
| `startDate` | string | Start date (YYYY-MM-DD) |
| `endDate` | string | End date (YYYY-MM-DD) |
| `location` | string | Physical location |
| `timezone` | string | Timezone (IANA format) |
| `currencyName` | string | Name of festival tokens (e.g., "Jetons") |
| `exchangeRate` | number | Tokens per cent (e.g., 0.10 = 10 tokens per euro) |
| `stripeAccountId` | string | Connected Stripe account ID |
| `settings` | object | Festival settings |
| `status` | string | Festival status |
| `createdAt` | string | Creation timestamp (RFC3339) |
| `updatedAt` | string | Last update timestamp (RFC3339) |

### Festival Status Values

| Status | Description |
|--------|-------------|
| `DRAFT` | Festival is being set up |
| `ACTIVE` | Festival is live |
| `COMPLETED` | Festival has ended |
| `ARCHIVED` | Festival is archived |

### Festival Settings

| Field | Type | Description |
|-------|------|-------------|
| `refundPolicy` | string | auto, manual, or none |
| `reentryPolicy` | string | single or multiple |
| `logoUrl` | string | URL to festival logo |
| `primaryColor` | string | Primary brand color (hex) |
| `secondaryColor` | string | Secondary brand color (hex) |

---

## Create Festival

Create a new festival.

```
POST /api/v1/festivals
```

### Authentication

Requires authentication with `organizer` or `admin` role.

### Request Headers

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Request Body

```json
{
  "name": "Summer Music Festival 2024",
  "description": "The biggest summer music festival in Belgium",
  "startDate": "2024-07-15T00:00:00Z",
  "endDate": "2024-07-17T23:59:59Z",
  "location": "Brussels, Belgium",
  "timezone": "Europe/Brussels",
  "currencyName": "Jetons",
  "exchangeRate": 0.10
}
```

### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Festival name |
| `description` | string | No | Festival description |
| `startDate` | string | Yes | Start date (ISO 8601) |
| `endDate` | string | Yes | End date (ISO 8601) |
| `location` | string | No | Physical location |
| `timezone` | string | No | Timezone (default: Europe/Brussels) |
| `currencyName` | string | No | Token name (default: Jetons) |
| `exchangeRate` | number | No | Exchange rate (default: 0.10) |

### Response

**201 Created**

```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Summer Music Festival 2024",
    "slug": "summer-music-festival-2024",
    "description": "The biggest summer music festival in Belgium",
    "startDate": "2024-07-15",
    "endDate": "2024-07-17",
    "location": "Brussels, Belgium",
    "timezone": "Europe/Brussels",
    "currencyName": "Jetons",
    "exchangeRate": 0.10,
    "settings": {
      "refundPolicy": "",
      "reentryPolicy": "",
      "logoUrl": "",
      "primaryColor": "",
      "secondaryColor": ""
    },
    "status": "DRAFT",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Music Festival 2024",
    "description": "The biggest summer music festival in Belgium",
    "startDate": "2024-07-15T00:00:00Z",
    "endDate": "2024-07-17T23:59:59Z",
    "location": "Brussels, Belgium",
    "timezone": "Europe/Brussels",
    "currencyName": "Jetons",
    "exchangeRate": 0.10
  }'
```

---

## List Festivals

Get a paginated list of festivals.

```
GET /api/v1/festivals
```

### Authentication

Requires authentication.

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
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Summer Music Festival 2024",
      "slug": "summer-music-festival-2024",
      "description": "The biggest summer music festival in Belgium",
      "startDate": "2024-07-15",
      "endDate": "2024-07-17",
      "location": "Brussels, Belgium",
      "timezone": "Europe/Brussels",
      "currencyName": "Jetons",
      "exchangeRate": 0.10,
      "settings": {
        "refundPolicy": "auto",
        "reentryPolicy": "multiple"
      },
      "status": "ACTIVE",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "per_page": 20
  }
}
```

### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals?page=1&per_page=10" \
  -H "Authorization: Bearer <token>"
```

---

## Get Festival by ID

Get a specific festival by its ID.

```
GET /api/v1/festivals/:id
```

### Authentication

Requires authentication.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Festival ID |

### Response

**200 OK**

```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Summer Music Festival 2024",
    "slug": "summer-music-festival-2024",
    "description": "The biggest summer music festival in Belgium",
    "startDate": "2024-07-15",
    "endDate": "2024-07-17",
    "location": "Brussels, Belgium",
    "timezone": "Europe/Brussels",
    "currencyName": "Jetons",
    "exchangeRate": 0.10,
    "stripeAccountId": "acct_1234567890",
    "settings": {
      "refundPolicy": "auto",
      "reentryPolicy": "multiple",
      "logoUrl": "https://cdn.festivals.app/logos/summer2024.png",
      "primaryColor": "#FF5733",
      "secondaryColor": "#33FF57"
    },
    "status": "ACTIVE",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Festival not found"
  }
}
```

### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

---

## Get Public Festival Info

Get public information about a festival (no authentication required).

```
GET /api/v1/festivals/:id/public
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Festival ID |

### Response

**200 OK**

```json
{
  "message": "Festival public info"
}
```

### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/public"
```

---

## Update Festival

Update an existing festival.

```
PATCH /api/v1/festivals/:id
```

### Authentication

Requires authentication with `organizer` or `admin` role.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Festival ID |

### Request Body

All fields are optional. Only provided fields will be updated.

```json
{
  "name": "Updated Festival Name",
  "description": "Updated description",
  "startDate": "2024-07-16T00:00:00Z",
  "endDate": "2024-07-18T23:59:59Z",
  "location": "Antwerp, Belgium",
  "timezone": "Europe/Brussels",
  "currencyName": "Tokens",
  "exchangeRate": 0.15,
  "stripeAccountId": "acct_new123456",
  "settings": {
    "refundPolicy": "manual",
    "reentryPolicy": "single",
    "logoUrl": "https://cdn.festivals.app/logos/updated.png",
    "primaryColor": "#0000FF",
    "secondaryColor": "#00FF00"
  },
  "status": "ACTIVE"
}
```

### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Festival name |
| `description` | string | No | Festival description |
| `startDate` | string | No | Start date (ISO 8601) |
| `endDate` | string | No | End date (ISO 8601) |
| `location` | string | No | Physical location |
| `timezone` | string | No | Timezone |
| `currencyName` | string | No | Token name |
| `exchangeRate` | number | No | Exchange rate |
| `stripeAccountId` | string | No | Stripe account ID |
| `settings` | object | No | Festival settings |
| `status` | string | No | Festival status |

### Response

**200 OK**

```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Updated Festival Name",
    "slug": "summer-music-festival-2024",
    "description": "Updated description",
    "startDate": "2024-07-16",
    "endDate": "2024-07-18",
    "location": "Antwerp, Belgium",
    "timezone": "Europe/Brussels",
    "currencyName": "Tokens",
    "exchangeRate": 0.15,
    "stripeAccountId": "acct_new123456",
    "settings": {
      "refundPolicy": "manual",
      "reentryPolicy": "single",
      "logoUrl": "https://cdn.festivals.app/logos/updated.png",
      "primaryColor": "#0000FF",
      "secondaryColor": "#00FF00"
    },
    "status": "ACTIVE",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-16T14:20:00Z"
  }
}
```

### Example

```bash
curl -X PATCH "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Festival Name",
    "location": "Antwerp, Belgium"
  }'
```

---

## Delete Festival

Delete a festival.

```
DELETE /api/v1/festivals/:id
```

### Authentication

Requires authentication with `organizer` or `admin` role.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Festival ID |

### Response

**204 No Content**

No response body.

**404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Festival not found"
  }
}
```

### Example

```bash
curl -X DELETE "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

---

## Activate Festival

Activate a festival to make it live.

```
POST /api/v1/festivals/:id/activate
```

### Authentication

Requires authentication with `organizer` or `admin` role.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Festival ID |

### Response

**200 OK**

```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Summer Music Festival 2024",
    "slug": "summer-music-festival-2024",
    "status": "ACTIVE",
    "...": "..."
  }
}
```

### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/activate" \
  -H "Authorization: Bearer <token>"
```

---

## Archive Festival

Archive a festival after it has ended.

```
POST /api/v1/festivals/:id/archive
```

### Authentication

Requires authentication with `organizer` or `admin` role.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Festival ID |

### Response

**200 OK**

```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Summer Music Festival 2024",
    "slug": "summer-music-festival-2024",
    "status": "ARCHIVED",
    "...": "..."
  }
}
```

### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/archive" \
  -H "Authorization: Bearer <token>"
```

---

## Error Responses

### Invalid ID Format

**400 Bad Request**

```json
{
  "error": {
    "code": "INVALID_ID",
    "message": "Invalid festival ID"
  }
}
```

### Validation Error

**400 Bad Request**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": "Key: 'CreateFestivalRequest.Name' Error:Field validation for 'Name' failed on the 'required' tag"
  }
}
```

### Festival Not Found

**404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Festival not found"
  }
}
```
