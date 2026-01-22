# Product Endpoints

Manage products sold at festival stands. Products are associated with specific stands and can include drinks, food, merchandise, and more.

## Endpoints Overview

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/festivals/:festivalId/products` | Create a product | Yes (organizer) |
| POST | `/festivals/:festivalId/products/bulk` | Create multiple products | Yes (organizer) |
| GET | `/festivals/:festivalId/products` | List products | Yes |
| GET | `/festivals/:festivalId/products/:id` | Get product by ID | Yes |
| PATCH | `/festivals/:festivalId/products/:id` | Update a product | Yes (organizer) |
| DELETE | `/festivals/:festivalId/products/:id` | Delete a product | Yes (organizer) |
| POST | `/festivals/:festivalId/products/:id/activate` | Activate a product | Yes (organizer) |
| POST | `/festivals/:festivalId/products/:id/deactivate` | Deactivate a product | Yes (organizer) |
| POST | `/festivals/:festivalId/products/:id/stock` | Update product stock | Yes (staff) |
| GET | `/festivals/:festivalId/stands/:standId/products` | List products for a stand | Yes |

---

## Product Object

```json
{
  "id": "prod123-e89b-12d3-a456-426614174000",
  "standId": "stand123-e89b-12d3-a456-426614174000",
  "name": "Craft Beer",
  "description": "Local IPA from Brussels Brewery",
  "price": 500,
  "priceDisplay": "5 Jetons",
  "category": "BEER",
  "imageUrl": "https://cdn.festivals.app/products/craft-beer.jpg",
  "sku": "BEER-001",
  "stock": 100,
  "sortOrder": 1,
  "status": "ACTIVE",
  "tags": ["craft", "local", "ipa"],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Product Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `standId` | uuid | Associated stand |
| `name` | string | Product name |
| `description` | string | Product description |
| `price` | integer | Price in cents |
| `priceDisplay` | string | Formatted price with currency |
| `category` | string | Product category |
| `imageUrl` | string | Product image URL |
| `sku` | string | Stock keeping unit |
| `stock` | integer | Available stock (null = unlimited) |
| `sortOrder` | integer | Display order |
| `status` | string | Product status |
| `tags` | array | Product tags |
| `createdAt` | string | Creation timestamp (RFC3339) |
| `updatedAt` | string | Last update timestamp (RFC3339) |

### Product Categories

| Category | Description |
|----------|-------------|
| `BEER` | Beer and cider |
| `COCKTAIL` | Cocktails and mixed drinks |
| `SOFT` | Soft drinks and water |
| `FOOD` | Main food items |
| `SNACK` | Snacks and small bites |
| `MERCH` | Merchandise items |
| `OTHER` | Other products |

### Product Status Values

| Status | Description |
|--------|-------------|
| `ACTIVE` | Available for sale |
| `INACTIVE` | Not available |
| `OUT_OF_STOCK` | Temporarily out of stock |

---

## Create Product

Create a new product for a stand.

```
POST /api/v1/festivals/:festivalId/products
```

### Authentication

Requires authentication with `organizer` or `admin` role.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |

### Request Body

```json
{
  "standId": "stand123-e89b-12d3-a456-426614174000",
  "name": "Craft Beer",
  "description": "Local IPA from Brussels Brewery",
  "price": 500,
  "category": "BEER",
  "imageUrl": "https://cdn.festivals.app/products/craft-beer.jpg",
  "sku": "BEER-001",
  "stock": 100,
  "sortOrder": 1,
  "tags": ["craft", "local", "ipa"]
}
```

### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `standId` | uuid | Yes | Stand this product belongs to |
| `name` | string | Yes | Product name |
| `description` | string | No | Product description |
| `price` | integer | Yes | Price in cents (min: 0) |
| `category` | string | Yes | Product category |
| `imageUrl` | string | No | Image URL |
| `sku` | string | No | Stock keeping unit |
| `stock` | integer | No | Initial stock (null = unlimited) |
| `sortOrder` | integer | No | Display order (default: 0) |
| `tags` | array | No | Product tags |

### Response

**201 Created**

```json
{
  "data": {
    "id": "prod123-e89b-12d3-a456-426614174000",
    "standId": "stand123-e89b-12d3-a456-426614174000",
    "name": "Craft Beer",
    "description": "Local IPA from Brussels Brewery",
    "price": 500,
    "priceDisplay": "5 Jetons",
    "category": "BEER",
    "imageUrl": "https://cdn.festivals.app/products/craft-beer.jpg",
    "sku": "BEER-001",
    "stock": 100,
    "sortOrder": 1,
    "status": "ACTIVE",
    "tags": ["craft", "local", "ipa"],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/products" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "standId": "stand123-e89b-12d3-a456-426614174000",
    "name": "Craft Beer",
    "description": "Local IPA from Brussels Brewery",
    "price": 500,
    "category": "BEER",
    "stock": 100
  }'
```

---

## Create Products in Bulk

Create multiple products at once.

```
POST /api/v1/festivals/:festivalId/products/bulk
```

### Authentication

Requires authentication with `organizer` or `admin` role.

### Request Body

```json
{
  "standId": "stand123-e89b-12d3-a456-426614174000",
  "products": [
    {
      "name": "Craft Beer",
      "price": 500,
      "category": "BEER",
      "sortOrder": 1
    },
    {
      "name": "Lager",
      "price": 400,
      "category": "BEER",
      "sortOrder": 2
    },
    {
      "name": "Soft Drink",
      "price": 300,
      "category": "SOFT",
      "sortOrder": 3
    }
  ]
}
```

### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `standId` | uuid | Yes | Stand for all products |
| `products` | array | Yes | Array of product objects (min: 1) |

### Response

**201 Created**

```json
{
  "data": [
    {
      "id": "prod123-e89b-12d3-a456-426614174000",
      "standId": "stand123-e89b-12d3-a456-426614174000",
      "name": "Craft Beer",
      "price": 500,
      "priceDisplay": "5 Jetons",
      "category": "BEER",
      "status": "ACTIVE",
      "...": "..."
    },
    {
      "id": "prod456-e89b-12d3-a456-426614174000",
      "name": "Lager",
      "price": 400,
      "priceDisplay": "4 Jetons",
      "...": "..."
    },
    {
      "id": "prod789-e89b-12d3-a456-426614174000",
      "name": "Soft Drink",
      "price": 300,
      "priceDisplay": "3 Jetons",
      "...": "..."
    }
  ]
}
```

### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/products/bulk" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "standId": "stand123-e89b-12d3-a456-426614174000",
    "products": [
      {"name": "Craft Beer", "price": 500, "category": "BEER"},
      {"name": "Lager", "price": 400, "category": "BEER"}
    ]
  }'
```

---

## List Products

List products with required stand filter.

```
GET /api/v1/festivals/:festivalId/products
```

### Authentication

Requires authentication.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `standId` | uuid | Yes | - | Filter by stand |
| `page` | integer | No | 1 | Page number |
| `per_page` | integer | No | 50 | Items per page |
| `category` | string | No | - | Filter by category |

### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "prod123-e89b-12d3-a456-426614174000",
      "standId": "stand123-e89b-12d3-a456-426614174000",
      "name": "Craft Beer",
      "description": "Local IPA",
      "price": 500,
      "priceDisplay": "5 Jetons",
      "category": "BEER",
      "stock": 100,
      "status": "ACTIVE",
      "tags": ["craft", "local"],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "per_page": 50
  }
}
```

### Example - List All Products for a Stand

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/products?standId=stand123-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

### Example - Filter by Category

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/products?standId=stand123-e89b-12d3-a456-426614174000&category=BEER" \
  -H "Authorization: Bearer <token>"
```

---

## Get Product by ID

Get a specific product.

```
GET /api/v1/festivals/:festivalId/products/:id
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `festivalId` | uuid | Festival ID |
| `id` | uuid | Product ID |

### Response

**200 OK**

```json
{
  "data": {
    "id": "prod123-e89b-12d3-a456-426614174000",
    "standId": "stand123-e89b-12d3-a456-426614174000",
    "name": "Craft Beer",
    "description": "Local IPA from Brussels Brewery",
    "price": 500,
    "priceDisplay": "5 Jetons",
    "category": "BEER",
    "imageUrl": "https://cdn.festivals.app/products/craft-beer.jpg",
    "sku": "BEER-001",
    "stock": 100,
    "sortOrder": 1,
    "status": "ACTIVE",
    "tags": ["craft", "local", "ipa"],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/products/prod123-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

---

## Update Product

Update a product.

```
PATCH /api/v1/festivals/:festivalId/products/:id
```

### Authentication

Requires authentication with `organizer` or `admin` role.

### Request Body

All fields are optional.

```json
{
  "name": "Premium Craft Beer",
  "description": "Updated description",
  "price": 600,
  "category": "BEER",
  "imageUrl": "https://cdn.festivals.app/products/premium-beer.jpg",
  "sku": "BEER-002",
  "stock": 150,
  "sortOrder": 1,
  "status": "ACTIVE",
  "tags": ["premium", "craft"]
}
```

### Response

**200 OK**

```json
{
  "data": {
    "id": "prod123-e89b-12d3-a456-426614174000",
    "name": "Premium Craft Beer",
    "price": 600,
    "priceDisplay": "6 Jetons",
    "...": "..."
  }
}
```

### Example

```bash
curl -X PATCH "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/products/prod123-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Craft Beer",
    "price": 600
  }'
```

---

## Delete Product

Delete a product.

```
DELETE /api/v1/festivals/:festivalId/products/:id
```

### Authentication

Requires authentication with `organizer` or `admin` role.

### Response

**204 No Content**

### Example

```bash
curl -X DELETE "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/products/prod123-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

---

## Activate Product

Activate a product to make it available for sale.

```
POST /api/v1/festivals/:festivalId/products/:id/activate
```

### Response

**200 OK**

```json
{
  "data": {
    "id": "prod123-e89b-12d3-a456-426614174000",
    "status": "ACTIVE",
    "...": "..."
  }
}
```

### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/products/prod123-e89b-12d3-a456-426614174000/activate" \
  -H "Authorization: Bearer <token>"
```

---

## Deactivate Product

Deactivate a product (remove from sale).

```
POST /api/v1/festivals/:festivalId/products/:id/deactivate
```

### Response

**200 OK**

```json
{
  "data": {
    "id": "prod123-e89b-12d3-a456-426614174000",
    "status": "INACTIVE",
    "...": "..."
  }
}
```

---

## Update Product Stock

Update the stock quantity of a product.

```
POST /api/v1/festivals/:festivalId/products/:id/stock
```

### Authentication

Requires authentication with `staff` or higher role.

### Request Body

```json
{
  "delta": 50
}
```

### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `delta` | integer | Yes | Stock change (positive to add, negative to remove) |

### Response

**200 OK**

```json
{
  "data": {
    "id": "prod123-e89b-12d3-a456-426614174000",
    "name": "Craft Beer",
    "stock": 150,
    "status": "ACTIVE",
    "...": "..."
  }
}
```

### Error Responses

**400 Bad Request - Insufficient Stock**

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock"
  }
}
```

### Example - Add Stock

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/products/prod123-e89b-12d3-a456-426614174000/stock" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"delta": 50}'
```

### Example - Remove Stock

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/products/prod123-e89b-12d3-a456-426614174000/stock" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"delta": -10}'
```

---

## Error Responses

### Missing Stand ID

**400 Bad Request**

```json
{
  "error": {
    "code": "MISSING_STAND",
    "message": "standId query parameter required"
  }
}
```

### Invalid Product ID

**400 Bad Request**

```json
{
  "error": {
    "code": "INVALID_ID",
    "message": "Invalid product ID"
  }
}
```

### Product Not Found

**404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Product not found"
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
    "details": "Key: 'CreateProductRequest.Name' Error:Field validation for 'Name' failed on the 'required' tag"
  }
}
```
