# Stripe Products Setup Guide for Festival Tickets

This guide explains how to set up Stripe Products and Prices for festival ticket types.

## Table of Contents

- [Overview](#overview)
- [Product Structure](#product-structure)
- [Creating Products via Dashboard](#creating-products-via-dashboard)
- [Creating Products via API](#creating-products-via-api)
- [Price Configuration](#price-configuration)
- [Best Practices](#best-practices)
- [Integration with Festivals Platform](#integration-with-festivals-platform)

---

## Overview

Stripe Products represent the items you sell (ticket types), while Prices represent the cost and currency. For the Festivals platform:

- **Product** = Ticket type (e.g., "Weekend Pass", "VIP Access", "Single Day")
- **Price** = Specific pricing for that ticket (e.g., "$150 USD", "$199 USD Early Bird")

### Why Use Products?

1. **Consistent pricing** - Define prices once, reuse across checkouts
2. **Price versioning** - Create new prices without breaking existing links
3. **Analytics** - Track sales by product in Stripe Dashboard
4. **Inventory** - Optional inventory tracking per product

---

## Product Structure

### Recommended Structure for Festivals

```
Festival (Connect Account)
├── Product: "Festival Name - General Admission"
│   ├── Price: $100 USD (Regular)
│   ├── Price: $80 USD (Early Bird)
│   └── Price: $120 USD (Door Price)
├── Product: "Festival Name - VIP Pass"
│   ├── Price: $250 USD (Regular)
│   └── Price: $200 USD (Early Bird)
├── Product: "Festival Name - Day Pass - Friday"
│   └── Price: $60 USD
├── Product: "Festival Name - Day Pass - Saturday"
│   └── Price: $60 USD
└── Product: "Festival Name - Camping Add-On"
    └── Price: $75 USD
```

### Product Metadata

Use metadata to link Stripe products to your database:

```json
{
  "festival_id": "fest_abc123",
  "ticket_type_id": "tt_xyz789",
  "ticket_category": "general_admission",
  "capacity": "5000",
  "date_start": "2026-06-15",
  "date_end": "2026-06-17"
}
```

---

## Creating Products via Dashboard

### Step 1: Access Products

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Products** in the left sidebar
3. Click **Add product**

### Step 2: Create Product

Fill in the product details:

| Field | Example | Description |
|-------|---------|-------------|
| Name | "Summer Fest 2026 - Weekend Pass" | Clear, descriptive name |
| Description | "Full weekend access including all stages..." | Customer-facing description |
| Image | Upload ticket artwork | Shows in checkout |

### Step 3: Add Price

Configure the price:

| Field | Value | Description |
|-------|-------|-------------|
| Pricing model | One-time | For single ticket purchases |
| Price | 150.00 | Ticket price |
| Currency | USD | Local currency |

### Step 4: Add Metadata

Expand **Additional options** and add metadata:

```
festival_id: fest_abc123
ticket_type_id: tt_xyz789
ticket_category: general_admission
```

### Step 5: Save

Click **Save product** to create the product.

---

## Creating Products via API

### Create a Product

```go
package main

import (
    "github.com/stripe/stripe-go/v76"
    "github.com/stripe/stripe-go/v76/product"
)

func CreateTicketProduct(festivalID, name, description string) (*stripe.Product, error) {
    params := &stripe.ProductParams{
        Name:        stripe.String(name),
        Description: stripe.String(description),
        Metadata: map[string]string{
            "festival_id":     festivalID,
            "ticket_category": "general_admission",
        },
        // Optional: Add images
        Images: []*string{
            stripe.String("https://yourcdn.com/ticket-image.jpg"),
        },
    }

    return product.New(params)
}
```

### Create a Price

```go
package main

import (
    "github.com/stripe/stripe-go/v76"
    "github.com/stripe/stripe-go/v76/price"
)

func CreateTicketPrice(productID string, amount int64, currency string, nickname string) (*stripe.Price, error) {
    params := &stripe.PriceParams{
        Product:    stripe.String(productID),
        UnitAmount: stripe.Int64(amount), // Amount in cents
        Currency:   stripe.String(currency),
        Nickname:   stripe.String(nickname), // e.g., "Early Bird", "Regular"
        Metadata: map[string]string{
            "price_tier": nickname,
        },
    }

    return price.New(params)
}
```

### Create Product with Price (Combined)

```go
func CreateTicketWithPrice(festivalID, name string, amount int64) (*stripe.Product, *stripe.Price, error) {
    // Create product
    productParams := &stripe.ProductParams{
        Name: stripe.String(name),
        Metadata: map[string]string{
            "festival_id": festivalID,
        },
        DefaultPriceData: &stripe.ProductDefaultPriceDataParams{
            UnitAmount: stripe.Int64(amount),
            Currency:   stripe.String("usd"),
        },
    }

    prod, err := product.New(productParams)
    if err != nil {
        return nil, nil, err
    }

    // Fetch the default price
    priceData, err := price.Get(prod.DefaultPrice.ID, nil)
    if err != nil {
        return prod, nil, err
    }

    return prod, priceData, nil
}
```

### Bulk Create Products for Festival

```go
type TicketType struct {
    Name        string
    Description string
    Prices      []PriceTier
}

type PriceTier struct {
    Nickname string // "Early Bird", "Regular", "Door"
    Amount   int64  // In cents
}

func CreateFestivalProducts(festivalID string, ticketTypes []TicketType) error {
    for _, tt := range ticketTypes {
        // Create product
        prod, err := product.New(&stripe.ProductParams{
            Name:        stripe.String(tt.Name),
            Description: stripe.String(tt.Description),
            Metadata: map[string]string{
                "festival_id": festivalID,
            },
        })
        if err != nil {
            return fmt.Errorf("failed to create product %s: %w", tt.Name, err)
        }

        // Create all price tiers
        for _, pt := range tt.Prices {
            _, err := price.New(&stripe.PriceParams{
                Product:    stripe.String(prod.ID),
                UnitAmount: stripe.Int64(pt.Amount),
                Currency:   stripe.String("usd"),
                Nickname:   stripe.String(pt.Nickname),
            })
            if err != nil {
                return fmt.Errorf("failed to create price %s for %s: %w", pt.Nickname, tt.Name, err)
            }
        }
    }

    return nil
}
```

---

## Price Configuration

### One-Time vs Recurring

For festival tickets, always use **one-time** pricing:

```go
params := &stripe.PriceParams{
    Product:    stripe.String(productID),
    UnitAmount: stripe.Int64(15000), // $150.00
    Currency:   stripe.String("usd"),
    // No Recurring field = one-time payment
}
```

### Multi-Currency Pricing

Create separate prices for different currencies:

```go
currencies := map[string]int64{
    "usd": 15000, // $150.00
    "eur": 13500, // 135.00
    "gbp": 12000, // 120.00
}

for currency, amount := range currencies {
    _, err := price.New(&stripe.PriceParams{
        Product:    stripe.String(productID),
        UnitAmount: stripe.Int64(amount),
        Currency:   stripe.String(currency),
        Nickname:   stripe.String(fmt.Sprintf("Regular - %s", strings.ToUpper(currency))),
    })
}
```

### Tiered Pricing (Early Bird, Regular, etc.)

```go
tiers := []struct {
    Nickname  string
    Amount    int64
    ActiveFrom time.Time
    ActiveTo   time.Time
}{
    {"Early Bird", 12000, time.Now(), time.Now().AddDate(0, 1, 0)},
    {"Regular", 15000, time.Now().AddDate(0, 1, 0), eventDate.AddDate(0, 0, -7)},
    {"Door Price", 18000, eventDate.AddDate(0, 0, -7), eventDate},
}

for _, tier := range tiers {
    _, err := price.New(&stripe.PriceParams{
        Product:    stripe.String(productID),
        UnitAmount: stripe.Int64(tier.Amount),
        Currency:   stripe.String("usd"),
        Nickname:   stripe.String(tier.Nickname),
        Metadata: map[string]string{
            "active_from": tier.ActiveFrom.Format(time.RFC3339),
            "active_to":   tier.ActiveTo.Format(time.RFC3339),
        },
    })
}
```

### Quantity Discounts

For bulk purchases (group tickets):

```go
// Option 1: Create separate bulk price
bulkPrice, _ := price.New(&stripe.PriceParams{
    Product:    stripe.String(productID),
    UnitAmount: stripe.Int64(13500), // $135 per ticket for 10+
    Currency:   stripe.String("usd"),
    Nickname:   stripe.String("Group Rate (10+)"),
    Metadata: map[string]string{
        "min_quantity": "10",
    },
})

// Option 2: Use Stripe Checkout's quantity discount feature
// (Configured in Checkout Session)
```

---

## Best Practices

### Naming Conventions

Use clear, consistent naming:

```
[Festival Name] - [Ticket Type] - [Variant]

Examples:
- "Summer Fest 2026 - Weekend Pass"
- "Summer Fest 2026 - VIP Pass - Backstage Access"
- "Summer Fest 2026 - Day Pass - Saturday"
- "Summer Fest 2026 - Camping Add-On - Tent Included"
```

### Price Management

1. **Never delete prices** - Archive instead to preserve history
2. **Create new prices** - Don't update existing price amounts
3. **Use nicknames** - Makes Dashboard management easier
4. **Use metadata** - Link to your database

### Archive Old Prices

```go
func ArchivePrice(priceID string) error {
    _, err := price.Update(priceID, &stripe.PriceParams{
        Active: stripe.Bool(false),
    })
    return err
}
```

### Product Updates

```go
func UpdateProduct(productID, newDescription string) error {
    _, err := product.Update(productID, &stripe.ProductParams{
        Description: stripe.String(newDescription),
    })
    return err
}
```

### Inventory Management

Track inventory via metadata or use your database:

```go
// Store remaining capacity in metadata
_, err := product.Update(productID, &stripe.ProductParams{
    Metadata: map[string]string{
        "remaining_capacity": "4500",
        "total_capacity":     "5000",
    },
})
```

---

## Integration with Festivals Platform

### Sync Products with Database

When creating a festival ticket type in your database, also create it in Stripe:

```go
func CreateTicketType(ctx context.Context, festivalID string, ticketType TicketTypeInput) (*TicketType, error) {
    // Create in database first
    tt, err := db.CreateTicketType(ctx, festivalID, ticketType)
    if err != nil {
        return nil, err
    }

    // Create corresponding Stripe product
    stripeProduct, err := product.New(&stripe.ProductParams{
        Name:        stripe.String(ticketType.Name),
        Description: stripe.String(ticketType.Description),
        Metadata: map[string]string{
            "festival_id":    festivalID,
            "ticket_type_id": tt.ID,
        },
    })
    if err != nil {
        // Rollback database entry
        db.DeleteTicketType(ctx, tt.ID)
        return nil, err
    }

    // Create price
    stripePrice, err := price.New(&stripe.PriceParams{
        Product:    stripe.String(stripeProduct.ID),
        UnitAmount: stripe.Int64(ticketType.PriceCents),
        Currency:   stripe.String("usd"),
    })
    if err != nil {
        return nil, err
    }

    // Update database with Stripe IDs
    tt.StripeProductID = stripeProduct.ID
    tt.StripePriceID = stripePrice.ID
    err = db.UpdateTicketType(ctx, tt)

    return tt, err
}
```

### Create Checkout Session with Products

```go
func CreateCheckoutSession(priceID, festivalAccountID string, quantity int64) (*stripe.CheckoutSession, error) {
    params := &stripe.CheckoutSessionParams{
        LineItems: []*stripe.CheckoutSessionLineItemParams{
            {
                Price:    stripe.String(priceID),
                Quantity: stripe.Int64(quantity),
            },
        },
        Mode:       stripe.String(string(stripe.CheckoutSessionModePayment)),
        SuccessURL: stripe.String("https://yoursite.com/success?session_id={CHECKOUT_SESSION_ID}"),
        CancelURL:  stripe.String("https://yoursite.com/cancel"),
        PaymentIntentData: &stripe.CheckoutSessionPaymentIntentDataParams{
            ApplicationFeeAmount: stripe.Int64(calculateFee(priceID, quantity)),
            TransferData: &stripe.CheckoutSessionPaymentIntentDataTransferDataParams{
                Destination: stripe.String(festivalAccountID),
            },
        },
    }

    return session.New(params)
}
```

### List Products for Festival

```go
func ListFestivalProducts(festivalID string) ([]*stripe.Product, error) {
    var products []*stripe.Product

    params := &stripe.ProductListParams{
        Active: stripe.Bool(true),
    }
    params.Filters.AddFilter("metadata[festival_id]", "", festivalID)

    iter := product.List(params)
    for iter.Next() {
        products = append(products, iter.Product())
    }

    return products, iter.Err()
}
```

### Get Active Price for Product

```go
func GetActivePrice(productID string) (*stripe.Price, error) {
    params := &stripe.PriceListParams{
        Product: stripe.String(productID),
        Active:  stripe.Bool(true),
    }

    iter := price.List(params)

    // Get the first active price (or implement logic for tiered pricing)
    if iter.Next() {
        return iter.Price(), nil
    }

    return nil, errors.New("no active price found")
}
```

---

## Example: Complete Festival Setup

```go
func SetupFestivalProducts(festivalID, festivalName string) error {
    ticketTypes := []struct {
        Name        string
        Description string
        PriceCents  int64
        Tiers       map[string]int64
    }{
        {
            Name:        fmt.Sprintf("%s - General Admission", festivalName),
            Description: "Full festival access to all stages",
            Tiers: map[string]int64{
                "Early Bird": 10000, // $100
                "Regular":    12500, // $125
                "Door":       15000, // $150
            },
        },
        {
            Name:        fmt.Sprintf("%s - VIP Pass", festivalName),
            Description: "VIP access with exclusive areas and perks",
            Tiers: map[string]int64{
                "Early Bird": 25000, // $250
                "Regular":    30000, // $300
            },
        },
        {
            Name:        fmt.Sprintf("%s - Camping Add-On", festivalName),
            Description: "On-site camping for the festival duration",
            Tiers: map[string]int64{
                "Regular": 7500, // $75
            },
        },
    }

    for _, tt := range ticketTypes {
        // Create product
        prod, err := product.New(&stripe.ProductParams{
            Name:        stripe.String(tt.Name),
            Description: stripe.String(tt.Description),
            Metadata: map[string]string{
                "festival_id": festivalID,
            },
        })
        if err != nil {
            return err
        }

        // Create all price tiers
        for tierName, amount := range tt.Tiers {
            _, err := price.New(&stripe.PriceParams{
                Product:    stripe.String(prod.ID),
                UnitAmount: stripe.Int64(amount),
                Currency:   stripe.String("usd"),
                Nickname:   stripe.String(tierName),
            })
            if err != nil {
                return err
            }
        }

        log.Printf("Created product: %s (%s)", tt.Name, prod.ID)
    }

    return nil
}
```

---

## Related Documentation

- [STRIPE.md](./STRIPE.md) - Main Stripe Connect setup guide
- [Stripe Products API](https://stripe.com/docs/api/products)
- [Stripe Prices API](https://stripe.com/docs/api/prices)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)

---

*Last updated: January 2026*
