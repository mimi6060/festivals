# Festivals API

Manage festivals on the platform. Festivals are the core entity that contains all event-related data including ticketing, stands, wallets, and lineup.

## Base URL

```
/api/v1/festivals
```

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/festivals` | Create a festival | Organizer |
| `GET` | `/festivals` | List festivals | User |
| `GET` | `/festivals/{id}` | Get festival by ID | User |
| `PATCH` | `/festivals/{id}` | Update a festival | Organizer |
| `DELETE` | `/festivals/{id}` | Delete a festival | Organizer |
| `POST` | `/festivals/{id}/activate` | Activate a festival | Organizer |
| `POST` | `/festivals/{id}/archive` | Archive a festival | Organizer |

---

## Festival Object

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Summer Music Festival 2024",
  "slug": "summer-music-festival-2024",
  "description": "The biggest summer music festival",
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
    "logoUrl": "https://cdn.festivals.app/logos/festival.png",
    "primaryColor": "#FF5733",
    "secondaryColor": "#33FF57"
  },
  "status": "ACTIVE",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `name` | string | Festival name |
| `slug` | string | URL-friendly unique identifier (auto-generated) |
| `description` | string | Festival description |
| `startDate` | string | Start date (YYYY-MM-DD) |
| `endDate` | string | End date (YYYY-MM-DD) |
| `location` | string | Physical location |
| `timezone` | string | Timezone (IANA format) |
| `currencyName` | string | Token name (e.g., "Jetons") |
| `exchangeRate` | number | Cents to tokens conversion (0.10 = 10 tokens/EUR) |
| `stripeAccountId` | string | Connected Stripe account |
| `settings` | object | Festival configuration |
| `status` | string | Current status |
| `createdAt` | datetime | Creation timestamp |
| `updatedAt` | datetime | Last update timestamp |

### Status Values

| Status | Description |
|--------|-------------|
| `DRAFT` | Being set up, not visible to users |
| `ACTIVE` | Live and operational |
| `COMPLETED` | Event has ended |
| `ARCHIVED` | Archived for historical reference |

### Settings Object

| Field | Type | Description |
|-------|------|-------------|
| `refundPolicy` | string | `auto`, `manual`, or `none` |
| `reentryPolicy` | string | `single` or `multiple` |
| `logoUrl` | string | URL to festival logo |
| `primaryColor` | string | Primary brand color (hex) |
| `secondaryColor` | string | Secondary brand color (hex) |

---

## Create Festival

```http
POST /api/v1/festivals
```

Create a new festival. The festival is created in `DRAFT` status.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Music Festival 2024",
    "description": "The biggest summer music festival",
    "startDate": "2024-07-15T00:00:00Z",
    "endDate": "2024-07-17T23:59:59Z",
    "location": "Brussels, Belgium",
    "timezone": "Europe/Brussels",
    "currencyName": "Jetons",
    "exchangeRate": 0.10
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Festival name (max 255 chars) |
| `description` | string | No | Festival description |
| `startDate` | datetime | Yes | Start date (ISO 8601) |
| `endDate` | datetime | Yes | End date (ISO 8601) |
| `location` | string | No | Physical location |
| `timezone` | string | No | Timezone (default: Europe/Brussels) |
| `currencyName` | string | No | Token name (default: Jetons) |
| `exchangeRate` | number | No | Exchange rate (default: 0.10) |

### Response

**201 Created**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Summer Music Festival 2024",
    "slug": "summer-music-festival-2024",
    "description": "The biggest summer music festival",
    "startDate": "2024-07-15",
    "endDate": "2024-07-17",
    "location": "Brussels, Belgium",
    "timezone": "Europe/Brussels",
    "currencyName": "Jetons",
    "exchangeRate": 0.10,
    "settings": {},
    "status": "DRAFT",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Not an organizer |

---

## List Festivals

```http
GET /api/v1/festivals
```

Get a paginated list of festivals accessible to the authenticated user.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals?page=1&per_page=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 20 | Items per page (max: 100) |

### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Summer Music Festival 2024",
      "slug": "summer-music-festival-2024",
      "description": "The biggest summer music festival",
      "startDate": "2024-07-15",
      "endDate": "2024-07-17",
      "location": "Brussels, Belgium",
      "timezone": "Europe/Brussels",
      "currencyName": "Jetons",
      "exchangeRate": 0.10,
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

---

## Get Festival

```http
GET /api/v1/festivals/{id}
```

Get a specific festival by ID.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Festival ID |

### Response

**200 OK**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Summer Music Festival 2024",
    "slug": "summer-music-festival-2024",
    "description": "The biggest summer music festival",
    "startDate": "2024-07-15",
    "endDate": "2024-07-17",
    "location": "Brussels, Belgium",
    "timezone": "Europe/Brussels",
    "currencyName": "Jetons",
    "exchangeRate": 0.10,
    "stripeAccountId": "acct_1234567890",
    "settings": {
      "refundPolicy": "auto",
      "reentryPolicy": "multiple"
    },
    "status": "ACTIVE",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_ID` | Invalid UUID format |
| 404 | `NOT_FOUND` | Festival not found |

---

## Update Festival

```http
PATCH /api/v1/festivals/{id}
```

Update an existing festival. Only provided fields are updated.

### Request

```bash
curl -X PATCH "https://api.festivals.app/api/v1/festivals/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Festival Name",
    "location": "Antwerp, Belgium",
    "settings": {
      "refundPolicy": "manual",
      "primaryColor": "#0000FF"
    }
  }'
```

### Request Body

All fields are optional:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Festival name |
| `description` | string | Festival description |
| `startDate` | datetime | Start date |
| `endDate` | datetime | End date |
| `location` | string | Physical location |
| `timezone` | string | Timezone |
| `currencyName` | string | Token name |
| `exchangeRate` | number | Exchange rate |
| `stripeAccountId` | string | Stripe account ID |
| `settings` | object | Festival settings |
| `status` | string | Festival status |

### Response

**200 OK**

Returns the updated festival object.

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_ID` | Invalid UUID format |
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 404 | `NOT_FOUND` | Festival not found |

---

## Delete Festival

```http
DELETE /api/v1/festivals/{id}
```

Permanently delete a festival and all associated data.

### Request

```bash
curl -X DELETE "https://api.festivals.app/api/v1/festivals/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**204 No Content**

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_ID` | Invalid UUID format |
| 404 | `NOT_FOUND` | Festival not found |

---

## Activate Festival

```http
POST /api/v1/festivals/{id}/activate
```

Activate a festival to make it live and operational.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/550e8400-e29b-41d4-a716-446655440000/activate" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns the updated festival with `status: "ACTIVE"`.

---

## Archive Festival

```http
POST /api/v1/festivals/{id}/archive
```

Archive a festival after it has ended. Archived festivals are read-only.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/550e8400-e29b-41d4-a716-446655440000/archive" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns the updated festival with `status: "ARCHIVED"`.
