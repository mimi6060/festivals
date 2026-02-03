# Common API Operations - cURL Examples

This guide provides ready-to-use cURL examples for common API operations. Replace placeholder values with your actual data.

## Setup

Set environment variables for easier usage:

```bash
# API base URL
export API_URL="https://api.festivals.app/api/v1"

# Your access token (obtain via login)
export TOKEN="your-access-token"

# Common IDs (replace with actual values)
export FESTIVAL_ID="550e8400-e29b-41d4-a716-446655440000"
export WALLET_ID="660e8400-e29b-41d4-a716-446655440001"
export STAND_ID="770e8400-e29b-41d4-a716-446655440002"
```

---

## Authentication

### Login

```bash
curl -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
```

### Refresh Token

```bash
curl -X POST "$API_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token"
  }'
```

---

## Festivals

### Create Festival

```bash
curl -X POST "$API_URL/festivals" \
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

### List Festivals

```bash
curl -X GET "$API_URL/festivals?page=1&per_page=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Festival

```bash
curl -X GET "$API_URL/festivals/$FESTIVAL_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Update Festival

```bash
curl -X PATCH "$API_URL/festivals/$FESTIVAL_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Festival Name",
    "settings": {
      "refundPolicy": "auto",
      "reentryPolicy": "multiple"
    }
  }'
```

### Activate Festival

```bash
curl -X POST "$API_URL/festivals/$FESTIVAL_ID/activate" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Wallets

### Get My Wallet

```bash
curl -X GET "$API_URL/me/wallets/$FESTIVAL_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Create My Wallet

```bash
curl -X POST "$API_URL/me/wallets/$FESTIVAL_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Get QR Code for Payment

```bash
curl -X GET "$API_URL/me/wallets/$FESTIVAL_ID/qr" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Transaction History

```bash
curl -X GET "$API_URL/me/wallets/$FESTIVAL_ID/transactions?page=1&per_page=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Top Up Wallet (Staff)

```bash
curl -X POST "$API_URL/wallets/$WALLET_ID/topup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 2000,
    "paymentMethod": "cash",
    "reference": "receipt-123"
  }'
```

### Process Payment (Staff)

```bash
curl -X POST "$API_URL/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "walletId": "'"$WALLET_ID"'",
    "amount": 500,
    "standId": "'"$STAND_ID"'",
    "productIds": ["prod-1", "prod-2"]
  }'
```

### Validate QR Code (Staff)

```bash
curl -X POST "$API_URL/payments/validate-qr" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "qrCode": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

---

## Orders

### Get My Orders

```bash
curl -X GET "$API_URL/me/orders?festival_id=$FESTIVAL_ID&page=1" \
  -H "Authorization: Bearer $TOKEN"
```

### Create Order (Staff)

```bash
curl -X POST "$API_URL/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "standId": "'"$STAND_ID"'",
    "items": [
      {"productId": "prod-uuid-1", "quantity": 2},
      {"productId": "prod-uuid-2", "quantity": 1}
    ],
    "paymentMethod": "wallet",
    "notes": "No ice"
  }'
```

### Get Stand Orders

```bash
curl -X GET "$API_URL/stands/$STAND_ID/orders?status=PAID&page=1" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Stand Statistics

```bash
curl -X GET "$API_URL/stands/$STAND_ID/orders/stats?start_date=2024-07-15T00:00:00Z&end_date=2024-07-17T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Tickets

### Create Ticket Type

```bash
curl -X POST "$API_URL/ticket-types" \
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

### List Ticket Types

```bash
curl -X GET "$API_URL/ticket-types?festivalId=$FESTIVAL_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Create Ticket

```bash
curl -X POST "$API_URL/tickets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketTypeId": "ticket-type-uuid",
    "holderName": "John Doe",
    "holderEmail": "john@example.com"
  }'
```

### Scan Ticket (Staff)

```bash
curl -X POST "$API_URL/tickets/scan" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "VIP-ABC123XYZ",
    "scanType": "ENTRY",
    "location": "Main Gate",
    "deviceId": "scanner-001"
  }'
```

### Get My Tickets

```bash
curl -X GET "$API_URL/me/tickets?festivalId=$FESTIVAL_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Stands

### Create Stand

```bash
curl -X POST "$API_URL/stands" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Bar",
    "description": "Central bar with craft beers",
    "category": "BAR",
    "location": "Zone A - Main Stage",
    "settings": {
      "acceptsOnlyTokens": true,
      "requiresPin": true
    }
  }'
```

### List Stands

```bash
curl -X GET "$API_URL/stands?category=BAR" \
  -H "Authorization: Bearer $TOKEN"
```

### Assign Staff to Stand

```bash
curl -X POST "$API_URL/stands/$STAND_ID/staff" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "role": "CASHIER",
    "pin": "1234"
  }'
```

### Validate Staff PIN

```bash
curl -X POST "$API_URL/stands/$STAND_ID/staff/user-uuid/validate-pin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pin": "1234"
  }'
```

---

## Products

### Create Product

```bash
curl -X POST "$API_URL/products" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "standId": "'"$STAND_ID"'",
    "name": "Draft Beer",
    "description": "Local craft beer, 33cl",
    "price": 350,
    "category": "BEER",
    "stock": 500,
    "tags": ["popular", "local"]
  }'
```

### Bulk Create Products

```bash
curl -X POST "$API_URL/products/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "standId": "'"$STAND_ID"'",
    "products": [
      {"name": "Draft Beer", "price": 350, "category": "BEER"},
      {"name": "Cocktail", "price": 600, "category": "COCKTAIL"},
      {"name": "Water", "price": 150, "category": "SOFT"}
    ]
  }'
```

### List Stand Products

```bash
curl -X GET "$API_URL/stands/$STAND_ID/products?page=1&per_page=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Update Product Stock

```bash
# Add 100 units
curl -X POST "$API_URL/products/product-uuid/stock" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"delta": 100}'

# Remove 50 units
curl -X POST "$API_URL/products/product-uuid/stock" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"delta": -50}'
```

---

## Common Workflows

### Festival Setup Workflow

```bash
# 1. Create festival
FESTIVAL=$(curl -s -X POST "$API_URL/festivals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Festival", "startDate": "2024-07-15T00:00:00Z", "endDate": "2024-07-17T23:59:59Z"}')

FESTIVAL_ID=$(echo $FESTIVAL | jq -r '.data.id')

# 2. Create ticket types
curl -X POST "$API_URL/ticket-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Regular\", \"price\": 5000, \"validFrom\": \"2024-07-15T00:00:00Z\", \"validUntil\": \"2024-07-17T23:59:59Z\"}"

# 3. Create stands
STAND=$(curl -s -X POST "$API_URL/stands" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Main Bar", "category": "BAR"}')

STAND_ID=$(echo $STAND | jq -r '.data.id')

# 4. Add products to stand
curl -X POST "$API_URL/products/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"standId\": \"$STAND_ID\", \"products\": [{\"name\": \"Beer\", \"price\": 350, \"category\": \"BEER\"}]}"

# 5. Activate festival
curl -X POST "$API_URL/festivals/$FESTIVAL_ID/activate" \
  -H "Authorization: Bearer $TOKEN"
```

### Point of Sale Workflow

```bash
# 1. Scan customer QR code
WALLET=$(curl -s -X POST "$API_URL/payments/validate-qr" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"qrCode": "customer-qr-code"}')

WALLET_ID=$(echo $WALLET | jq -r '.data.id')
BALANCE=$(echo $WALLET | jq -r '.data.balance')

echo "Customer balance: $BALANCE cents"

# 2. Create and process order
ORDER=$(curl -s -X POST "$API_URL/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"standId\": \"$STAND_ID\",
    \"items\": [{\"productId\": \"product-uuid\", \"quantity\": 2}],
    \"paymentMethod\": \"wallet\"
  }")

ORDER_ID=$(echo $ORDER | jq -r '.data.id')

# 3. Process payment
curl -X POST "$API_URL/orders/$ORDER_ID/pay" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Error Handling Examples

### Handle Insufficient Balance

```bash
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"walletId": "...", "amount": 10000, "standId": "..."}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$ d')

if [ "$HTTP_CODE" = "400" ]; then
  ERROR_CODE=$(echo $BODY | jq -r '.error.code')
  if [ "$ERROR_CODE" = "INSUFFICIENT_BALANCE" ]; then
    echo "Customer needs to top up their wallet"
  fi
fi
```

### Retry on Rate Limit

```bash
make_request() {
  RESPONSE=$(curl -s -w "\n%{http_code}" "$@")
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

  if [ "$HTTP_CODE" = "429" ]; then
    RETRY_AFTER=$(curl -sI "$@" | grep -i "retry-after" | awk '{print $2}')
    echo "Rate limited. Retrying after $RETRY_AFTER seconds..."
    sleep $RETRY_AFTER
    make_request "$@"
  else
    echo "$RESPONSE" | sed '$ d'
  fi
}

make_request -X GET "$API_URL/festivals" -H "Authorization: Bearer $TOKEN"
```
