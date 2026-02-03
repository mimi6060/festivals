# Database Schema Documentation

## Overview

This document describes the database schema for the Festival Management Platform. The database is PostgreSQL-based and uses a multi-tenant architecture with shared tables.

## Entity Relationship Diagram

```
                    ┌─────────────┐
                    │  festivals  │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐      ┌──────────┐      ┌─────────┐
    │ wallets │      │  stands  │      │ tickets │
    └────┬────┘      └────┬─────┘      └────┬────┘
         │                │                 │
         ▼                ▼                 ▼
  ┌──────────────┐  ┌──────────┐    ┌──────────────┐
  │ transactions │  │ products │    │ ticket_scans │
  └──────────────┘  └──────────┘    └──────────────┘
         │                │
         └────────────────┘
                  │
                  ▼
            ┌──────────┐
            │  orders  │
            └──────────┘
```

## Core Tables

### festivals

Primary table for festival configuration and settings.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Festival name |
| slug | VARCHAR(255) | URL-friendly identifier (unique) |
| description | TEXT | Festival description |
| start_date | DATE | Festival start date |
| end_date | DATE | Festival end date |
| location | VARCHAR(255) | Physical location |
| timezone | VARCHAR(50) | Timezone (default: Europe/Brussels) |
| currency_name | VARCHAR(50) | Token currency name (default: Jetons) |
| exchange_rate | DECIMAL(10,4) | EUR to token rate |
| stripe_account_id | VARCHAR(255) | Stripe Connect account |
| settings | JSONB | Additional configuration |
| status | VARCHAR(20) | DRAFT, PUBLISHED, ACTIVE, COMPLETED, CANCELLED |
| created_by | UUID | Reference to users.id |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Indexes:**
- `idx_festivals_slug` - Unique lookup by slug
- `idx_festivals_status` - Filter by status
- `idx_festivals_start_date` - Date range queries
- `idx_festivals_created_by` - User's festivals

### users

User accounts for all roles.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR(255) | Email address (unique) |
| name | VARCHAR(255) | Display name |
| phone | VARCHAR(50) | Phone number |
| avatar | VARCHAR(500) | Avatar URL |
| role | VARCHAR(20) | USER, STAFF, ADMIN, SUPER_ADMIN |
| auth0_id | VARCHAR(255) | Auth0 identifier (unique) |
| status | VARCHAR(20) | ACTIVE, INACTIVE, SUSPENDED |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Indexes:**
- `idx_users_email` - Email lookup
- `idx_users_auth0_id` - Auth0 authentication
- `idx_users_role` - Role-based filtering
- `idx_users_status` - Status filtering
- `idx_users_email_lower` - Case-insensitive email lookup

### wallets

User wallet balances per festival.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to users.id |
| festival_id | UUID | Reference to festivals.id |
| balance | BIGINT | Balance in cents |
| status | VARCHAR(20) | ACTIVE, FROZEN, CLOSED |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Constraints:**
- `wallets_user_festival_unique` - One wallet per user per festival
- FK to users (CASCADE delete)
- FK to festivals (CASCADE delete)

**Indexes:**
- `idx_wallets_user_id` - User's wallets
- `idx_wallets_festival_id` - Festival wallets
- `idx_wallets_status` - Status filtering
- `idx_wallets_user_festival_covering` - Optimized lookup with balance
- `idx_wallets_active` - Active wallets only (partial)
- `idx_wallets_festival_status` - Festival stats

### transactions

All wallet transactions (immutable audit trail).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| wallet_id | UUID | Reference to wallets.id |
| type | VARCHAR(20) | TOP_UP, CASH_IN, PURCHASE, REFUND, TRANSFER, CASH_OUT |
| amount | BIGINT | Amount in cents (+/- for credit/debit) |
| balance_before | BIGINT | Wallet balance before transaction |
| balance_after | BIGINT | Wallet balance after transaction |
| reference | VARCHAR(255) | External reference (payment ID, etc.) |
| stand_id | UUID | Reference to stands.id (for purchases) |
| staff_id | UUID | Reference to users.id (staff who processed) |
| metadata | JSONB | Additional data |
| status | VARCHAR(20) | PENDING, COMPLETED, FAILED, REFUNDED |
| created_at | TIMESTAMPTZ | Transaction timestamp |

**Constraints:**
- FK to wallets (CASCADE delete)
- FK to stands (SET NULL on delete)
- FK to users/staff (SET NULL on delete)

**Indexes:**
- `idx_transactions_wallet_id` - Wallet transactions
- `idx_transactions_created_at` - Time-based queries
- `idx_transactions_type` - Type filtering
- `idx_transactions_stand_id` - Stand sales
- `idx_transactions_wallet_created_at` - Optimized history queries
- `idx_transactions_stand_created_at` - Stand reporting (partial)
- `idx_transactions_pending` - Pending transactions (partial)

### stands

Point of sale locations.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| festival_id | UUID | Reference to festivals.id |
| name | VARCHAR(255) | Stand name |
| description | TEXT | Stand description |
| category | VARCHAR(20) | BAR, FOOD, MERCHANDISE, TICKETS, TOP_UP, OTHER |
| location | VARCHAR(255) | Physical location within festival |
| image_url | VARCHAR(500) | Stand image |
| status | VARCHAR(20) | ACTIVE, INACTIVE, CLOSED |
| settings | JSONB | Additional configuration |
| search_vector | TSVECTOR | Full-text search (generated) |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Indexes:**
- `idx_stands_festival_id` - Festival's stands
- `idx_stands_category` - Category filtering
- `idx_stands_status` - Status filtering
- `idx_stands_festival_active` - Active stands (partial)
- `idx_stands_search_vector` - Full-text search (GIN)
- `idx_stands_name_trgm` - Fuzzy name search (GIN)

### products

Items sold at stands.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| stand_id | UUID | Reference to stands.id |
| name | VARCHAR(255) | Product name |
| description | TEXT | Product description |
| price | BIGINT | Price in cents |
| category | VARCHAR(20) | BEER, COCKTAIL, SOFT, FOOD, SNACK, MERCH, OTHER |
| image_url | VARCHAR(500) | Product image |
| sku | VARCHAR(100) | Stock keeping unit |
| stock | INTEGER | Stock count (NULL = unlimited) |
| sort_order | INTEGER | Display order |
| status | VARCHAR(20) | ACTIVE, INACTIVE, OUT_OF_STOCK |
| tags | TEXT[] | Product tags |
| search_vector | TSVECTOR | Full-text search (generated) |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Indexes:**
- `idx_products_stand_id` - Stand's products
- `idx_products_category` - Category filtering
- `idx_products_stand_active` - Active products (partial)
- `idx_products_stand_category_active` - Menu display (partial)
- `idx_products_out_of_stock` - Inventory alerts (partial)
- `idx_products_low_stock` - Low stock alerts (partial)
- `idx_products_search_vector` - Full-text search (GIN)

### orders

Purchase orders at stands.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| festival_id | UUID | Reference to festivals.id |
| user_id | UUID | Reference to users.id |
| wallet_id | UUID | Reference to wallets.id |
| stand_id | UUID | Reference to stands.id |
| items | JSONB | Order items array |
| total_amount | BIGINT | Total in cents |
| status | VARCHAR(20) | PENDING, PAID, CANCELLED, REFUNDED |
| payment_method | VARCHAR(20) | wallet, cash, card |
| transaction_id | UUID | Reference to transactions.id |
| staff_id | UUID | Processing staff |
| notes | TEXT | Order notes |
| created_at | TIMESTAMPTZ | Order timestamp |
| updated_at | TIMESTAMPTZ | Last update |

**Indexes:**
- `idx_orders_user_created` - User order history
- `idx_orders_festival_status_created` - Dashboard queries
- `idx_orders_pending` - Pending orders (partial)
- `idx_orders_recent` - Recent orders (partial)

### tickets

Individual tickets.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| ticket_type_id | UUID | Reference to ticket_types.id |
| festival_id | UUID | Reference to festivals.id |
| user_id | UUID | Owner reference |
| order_id | UUID | Purchase order reference |
| code | VARCHAR(100) | Unique ticket code |
| holder_name | VARCHAR(255) | Ticket holder name |
| holder_email | VARCHAR(255) | Ticket holder email |
| status | VARCHAR(20) | VALID, USED, EXPIRED, CANCELLED, TRANSFERRED |
| checked_in_at | TIMESTAMPTZ | Check-in timestamp |
| checked_in_by | UUID | Staff who checked in |
| transfer_count | INTEGER | Number of transfers |
| metadata | JSONB | Additional data |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update |

**Indexes:**
- `idx_tickets_festival_status` - Festival check-in
- `idx_tickets_valid` - Valid tickets (partial)
- `idx_tickets_user_status` - User's tickets
- `idx_tickets_holder_email_lower` - Email lookup

### audit_logs

System-wide audit trail.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Acting user |
| action | VARCHAR(50) | Action performed |
| resource | VARCHAR(100) | Resource type |
| resource_id | VARCHAR(100) | Resource identifier |
| changes | JSONB | Before/after state |
| ip | VARCHAR(45) | Client IP |
| user_agent | TEXT | Client user agent |
| metadata | JSONB | Additional context |
| festival_id | UUID | Festival context |
| timestamp | TIMESTAMPTZ | Event timestamp |

**Indexes:**
- `idx_audit_logs_timestamp_brin` - Time-series (BRIN)
- `idx_audit_user_resource_time` - User activity
- `idx_audit_logs_recent` - Recent logs (partial)

## JSONB Structures

### orders.items

```json
[
  {
    "productId": "uuid",
    "productName": "Beer",
    "quantity": 2,
    "unitPrice": 400,
    "totalPrice": 800
  }
]
```

### festivals.settings

```json
{
  "allowCashPayments": true,
  "minTopUp": 500,
  "maxTopUp": 10000,
  "refundPolicy": "full",
  "requiresTicket": true
}
```

## Data Types

- **UUID**: All primary keys use PostgreSQL's native UUID type
- **BIGINT**: All monetary values stored in cents to avoid floating point issues
- **TIMESTAMPTZ**: All timestamps include timezone information
- **JSONB**: Used for flexible schema data, indexed with GIN for querying

## Constraints

- All foreign keys have appropriate ON DELETE actions
- Unique constraints prevent duplicate entries
- Check constraints validate enum-like status fields
- NOT NULL constraints ensure data integrity

## Notes

1. **Multi-tenancy**: Data is segregated by `festival_id` but stored in shared tables
2. **Soft deletes**: Consider implementing for user-facing data
3. **Audit trail**: Transactions table provides immutable history
4. **Time-series**: Consider partitioning transactions and audit_logs tables by date
