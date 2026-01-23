# Products API

Manage products sold at festival stands.

## Base URL

```
/api/v1
```

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/products` | Create product | Organizer |
| `POST` | `/products/bulk` | Bulk create products | Organizer |
| `GET` | `/products` | List products | Staff |
| `GET` | `/products/{id}` | Get product by ID | Staff |
| `PATCH` | `/products/{id}` | Update product | Organizer |
| `DELETE` | `/products/{id}` | Delete product | Organizer |
| `POST` | `/products/{id}/activate` | Activate product | Organizer |
| `POST` | `/products/{id}/deactivate` | Deactivate product | Organizer |
| `POST` | `/products/{id}/stock` | Update stock | Organizer |
| `GET` | `/stands/{id}/products` | Get stand products | Staff |

---

## Product Object

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "standId": "660e8400-e29b-41d4-a716-446655440001",
  "name": "Draft Beer",
  "description": "Local craft beer, 33cl",
  "price": 350,
  "priceDisplay": "3.5 Jetons",
  "category": "BEER",
  "imageUrl": "https://cdn.festivals.app/products/beer.jpg",
  "sku": "BEER-001",
  "stock": 500,
  "sortOrder": 1,
  "status": "ACTIVE",
  "tags": ["popular", "local"],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `standId` | uuid | Stand ID |
| `name` | string | Product name |
| `description` | string | Product description |
| `price` | integer | Price in cents |
| `priceDisplay` | string | Formatted price in tokens |
| `category` | string | Product category |
| `imageUrl` | string | Product image URL |
| `sku` | string | Stock keeping unit |
| `stock` | integer | Available stock (null = unlimited) |
| `sortOrder` | integer | Display order |
| `status` | string | Current status |
| `tags` | array | Product tags |
| `createdAt` | datetime | Creation timestamp |
| `updatedAt` | datetime | Last update timestamp |

### Product Categories

| Category | Description |
|----------|-------------|
| `BEER` | Beer and ales |
| `COCKTAIL` | Cocktails and mixed drinks |
| `SOFT` | Soft drinks and water |
| `FOOD` | Main food items |
| `SNACK` | Snacks and appetizers |
| `MERCH` | Merchandise |
| `OTHER` | Other items |

### Product Status

| Status | Description |
|--------|-------------|
| `ACTIVE` | Available for sale |
| `INACTIVE` | Not for sale |
| `OUT_OF_STOCK` | Temporarily unavailable |

---

## Create Product

```http
POST /api/v1/products
```

Create a new product for a stand.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/products" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "standId": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Draft Beer",
    "description": "Local craft beer, 33cl",
    "price": 350,
    "category": "BEER",
    "imageUrl": "https://cdn.festivals.app/products/beer.jpg",
    "sku": "BEER-001",
    "stock": 500,
    "sortOrder": 1,
    "tags": ["popular", "local"]
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `standId` | uuid | Yes | Stand ID |
| `name` | string | Yes | Product name |
| `description` | string | No | Description |
| `price` | integer | Yes | Price in cents (min: 0) |
| `category` | string | Yes | Product category |
| `imageUrl` | string | No | Image URL |
| `sku` | string | No | Stock keeping unit |
| `stock` | integer | No | Available stock (null = unlimited) |
| `sortOrder` | integer | No | Display order (default: 0) |
| `tags` | array | No | Product tags |

### Response

**201 Created**

Returns the created product object.

---

## Bulk Create Products

```http
POST /api/v1/products/bulk
```

Create multiple products at once for a stand.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/products/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "standId": "660e8400-e29b-41d4-a716-446655440001",
    "products": [
      {
        "name": "Draft Beer",
        "price": 350,
        "category": "BEER"
      },
      {
        "name": "Cocktail",
        "price": 600,
        "category": "COCKTAIL"
      },
      {
        "name": "Water",
        "price": 150,
        "category": "SOFT"
      }
    ]
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `standId` | uuid | Yes | Stand ID for all products |
| `products` | array | Yes | Array of product objects |

### Response

**201 Created**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Draft Beer",
      "price": 350
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440002",
      "name": "Cocktail",
      "price": 600
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440003",
      "name": "Water",
      "price": 150
    }
  ]
}
```

---

## List Products

```http
GET /api/v1/products
```

Get products for a stand.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/products?standId=660e8400-e29b-41d4-a716-446655440001&page=1&per_page=50&category=BEER" \
  -H "Authorization: Bearer $TOKEN"
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `standId` | uuid | Yes | Stand ID |
| `page` | integer | No | Page number (default: 1) |
| `per_page` | integer | No | Items per page (default: 50) |
| `category` | string | No | Filter by category |

### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Draft Beer",
      "price": 350,
      "priceDisplay": "3.5 Jetons",
      "category": "BEER",
      "stock": 500,
      "status": "ACTIVE"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "per_page": 50
  }
}
```

---

## Get Stand Products

```http
GET /api/v1/stands/{id}/products
```

Alternative endpoint to get products by stand ID.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/stands/660e8400-e29b-41d4-a716-446655440001/products" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns paginated list of products for the stand.

---

## Get Product

```http
GET /api/v1/products/{id}
```

Get a specific product by ID.

### Request

```bash
curl -X GET "https://api.festivals.app/api/v1/products/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns the full product object.

---

## Update Product

```http
PATCH /api/v1/products/{id}
```

Update an existing product.

### Request

```bash
curl -X PATCH "https://api.festivals.app/api/v1/products/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Draft Beer",
    "price": 400,
    "description": "Premium local craft beer"
  }'
```

### Request Body

All fields are optional:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Product name |
| `description` | string | Description |
| `price` | integer | Price in cents |
| `category` | string | Category |
| `imageUrl` | string | Image URL |
| `sku` | string | SKU |
| `stock` | integer | Stock quantity |
| `sortOrder` | integer | Display order |
| `status` | string | Status |
| `tags` | array | Tags |

### Response

**200 OK**

Returns the updated product object.

---

## Delete Product

```http
DELETE /api/v1/products/{id}
```

Delete a product.

### Request

```bash
curl -X DELETE "https://api.festivals.app/api/v1/products/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**204 No Content**

---

## Activate Product

```http
POST /api/v1/products/{id}/activate
```

Activate a product for sale.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/products/550e8400-e29b-41d4-a716-446655440000/activate" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns the updated product with `status: "ACTIVE"`.

---

## Deactivate Product

```http
POST /api/v1/products/{id}/deactivate
```

Deactivate a product (remove from sale).

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/products/550e8400-e29b-41d4-a716-446655440000/deactivate" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

**200 OK**

Returns the updated product with `status: "INACTIVE"`.

---

## Update Stock

```http
POST /api/v1/products/{id}/stock
```

Adjust product stock quantity.

### Request

```bash
curl -X POST "https://api.festivals.app/api/v1/products/550e8400-e29b-41d4-a716-446655440000/stock" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "delta": 100
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `delta` | integer | Yes | Stock adjustment (positive or negative) |

### Response

**200 OK**

Returns the updated product with new stock quantity.

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INSUFFICIENT_STOCK` | Cannot reduce stock below 0 |
| 404 | `NOT_FOUND` | Product not found |

### Examples

```bash
# Add 100 units to stock
curl -X POST ".../stock" -d '{"delta": 100}'

# Remove 50 units from stock
curl -X POST ".../stock" -d '{"delta": -50}'
```
