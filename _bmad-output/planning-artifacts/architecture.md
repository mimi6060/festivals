# Architecture Technique - Festivals Platform

**Author:** Michel
**Date:** 2026-01-22
**Version:** 1.0
**Based on:** PRD v1.0, UX Design v1.0

---

## Table des Matières

1. [Vue d'Ensemble](#1-vue-densemble)
2. [Architecture Backend](#2-architecture-backend)
3. [Architecture Frontend Web](#3-architecture-frontend-web)
4. [Architecture Mobile](#4-architecture-mobile)
5. [Base de Données](#5-base-de-données)
6. [API Design](#6-api-design)
7. [Architecture Offline-First](#7-architecture-offline-first)
8. [Sécurité](#8-sécurité)
9. [Intégrations Externes](#9-intégrations-externes)
10. [Infrastructure & DevOps](#10-infrastructure--devops)

---

## 1. Vue d'Ensemble

### 1.1 Architecture Globale

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ App Mobile   │  │ Site Vitrine │  │ Back-Office  │  │ Portail      │    │
│  │ React Native │  │ React        │  │ React        │  │ Artiste      │    │
│  │ + Expo       │  │              │  │              │  │ React        │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │             │
│         └─────────────────┴─────────────────┴─────────────────┘             │
│                                    │                                         │
│                                    ▼                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                              API GATEWAY                                     │
│                              (Traefik / Kong)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         BACKEND GO                                   │    │
│  │                                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │    │
│  │  │ API REST     │  │ WebSocket    │  │ Background   │              │    │
│  │  │ (Gin)        │  │ Server       │  │ Jobs (Asynq) │              │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │    │
│  │                                                                      │    │
│  │  ┌──────────────────────────────────────────────────────────────┐  │    │
│  │  │                    DOMAIN SERVICES                            │  │    │
│  │  │  Auth │ Festival │ Ticket │ Wallet │ Lineup │ Support │ ...  │  │    │
│  │  └──────────────────────────────────────────────────────────────┘  │    │
│  │                                                                      │    │
│  │  ┌──────────────────────────────────────────────────────────────┐  │    │
│  │  │                    DATA ACCESS (GORM)                         │  │    │
│  │  └──────────────────────────────────────────────────────────────┘  │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         │                          │                          │             │
│         ▼                          ▼                          ▼             │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐      │
│  │ PostgreSQL   │          │ Redis        │          │ MinIO/S3     │      │
│  │ (Multi-      │          │ (Cache +     │          │ (Storage)    │      │
│  │  tenant)     │          │  Queue)      │          │              │      │
│  └──────────────┘          └──────────────┘          └──────────────┘      │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                          SERVICES EXTERNES                                   │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Stripe       │  │ Auth0        │  │ Postal       │  │ Twilio       │    │
│  │ Connect      │  │              │  │ (Email)      │  │ (SMS)        │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Stack Technique

| Couche | Technologie | Version | Raison |
|--------|-------------|---------|--------|
| **Backend** | Go | 1.22+ | Performance, concurrence, typage fort |
| **Framework API** | Gin | 1.9+ | Rapide, middleware ecosystem |
| **ORM** | GORM | 1.25+ | PostgreSQL support, migrations |
| **Queue** | Asynq | 0.24+ | Go natif, Redis-backed |
| **Frontend Web** | React | 18+ | Écosystème, TypeScript support |
| **UI Framework** | Tailwind CSS | 3.4+ | Utility-first, responsive |
| **Mobile** | React Native | 0.73+ | Cross-platform, shared logic |
| **Mobile Framework** | Expo | 50+ | Build simplifié, OTA updates |
| **Database** | PostgreSQL | 16+ | JSONB, schemas, robustesse |
| **Cache** | Redis | 7+ | Pub/Sub, sessions, queue |
| **Storage** | MinIO / S3 | - | Object storage, compatible S3 |

---

## 2. Architecture Backend

### 2.1 Structure du Projet

```
festivals-api/
├── cmd/
│   ├── api/
│   │   └── main.go              # Entry point API
│   └── worker/
│       └── main.go              # Entry point Background Jobs
├── internal/
│   ├── config/
│   │   └── config.go            # Configuration (env vars)
│   ├── domain/
│   │   ├── auth/
│   │   │   ├── handler.go       # HTTP handlers
│   │   │   ├── service.go       # Business logic
│   │   │   ├── repository.go    # Data access interface
│   │   │   └── model.go         # Domain models
│   │   ├── festival/
│   │   ├── ticket/
│   │   ├── wallet/
│   │   ├── lineup/
│   │   ├── security/
│   │   ├── support/
│   │   └── admin/
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── postgres.go      # PostgreSQL connection
│   │   │   └── migrations/      # SQL migrations
│   │   ├── cache/
│   │   │   └── redis.go         # Redis client
│   │   ├── storage/
│   │   │   └── minio.go         # MinIO/S3 client
│   │   └── queue/
│   │       └── asynq.go         # Asynq client
│   ├── middleware/
│   │   ├── auth.go              # JWT validation
│   │   ├── tenant.go            # Multi-tenant middleware
│   │   ├── ratelimit.go         # Rate limiting
│   │   └── logging.go           # Request logging
│   └── pkg/
│       ├── validator/           # Request validation
│       ├── response/            # Standard responses
│       └── errors/              # Error handling
├── api/
│   └── openapi.yaml             # OpenAPI spec
├── docker-compose.yml
├── Dockerfile
├── Makefile
└── go.mod
```

### 2.2 Clean Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      HANDLERS (HTTP)                         │
│  - Parse requests                                            │
│  - Call services                                             │
│  - Return responses                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      SERVICES (Business Logic)               │
│  - Orchestrate domain logic                                  │
│  - Call repositories                                         │
│  - Apply business rules                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      REPOSITORIES (Data Access)              │
│  - CRUD operations                                           │
│  - Query building                                            │
│  - Transaction management                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      MODELS (Domain Entities)                │
│  - Data structures                                           │
│  - Validation rules                                          │
│  - Domain methods                                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Exemple Domain: Wallet

```go
// internal/domain/wallet/model.go
package wallet

import (
    "time"
    "github.com/google/uuid"
)

type Wallet struct {
    ID           uuid.UUID `gorm:"type:uuid;primary_key"`
    UserID       uuid.UUID `gorm:"type:uuid;not null;index"`
    FestivalID   uuid.UUID `gorm:"type:uuid;not null;index"`
    Balance      int64     `gorm:"not null;default:0"` // En centimes de monnaie virtuelle
    CurrencyName string    `gorm:"not null;default:'Jetons'"`
    ExchangeRate float64   `gorm:"not null;default:0.1"` // 1 jeton = 0.10€
    CreatedAt    time.Time
    UpdatedAt    time.Time
}

type Transaction struct {
    ID              uuid.UUID       `gorm:"type:uuid;primary_key"`
    WalletID        uuid.UUID       `gorm:"type:uuid;not null;index"`
    Type            TransactionType `gorm:"not null"`
    Amount          int64           `gorm:"not null"` // Positif = crédit, Négatif = débit
    BalanceAfter    int64           `gorm:"not null"`
    Reference       string          `gorm:"index"`
    StandID         *uuid.UUID      `gorm:"type:uuid"`
    OperatorID      *uuid.UUID      `gorm:"type:uuid"`
    IdempotencyKey  string          `gorm:"unique;not null"`
    OfflineCreated  bool            `gorm:"default:false"`
    SyncedAt        *time.Time
    CreatedAt       time.Time       `gorm:"index"`
}

type TransactionType string

const (
    TransactionTypeRecharge  TransactionType = "RECHARGE"
    TransactionTypePayment   TransactionType = "PAYMENT"
    TransactionTypeRefund    TransactionType = "REFUND"
    TransactionTypeCancel    TransactionType = "CANCEL"
)
```

```go
// internal/domain/wallet/service.go
package wallet

import (
    "context"
    "errors"
)

var (
    ErrInsufficientBalance = errors.New("insufficient balance")
    ErrWalletNotFound      = errors.New("wallet not found")
    ErrDuplicateTransaction = errors.New("duplicate transaction")
)

type Service struct {
    repo Repository
}

func NewService(repo Repository) *Service {
    return &Service{repo: repo}
}

func (s *Service) Debit(ctx context.Context, req DebitRequest) (*Transaction, error) {
    // 1. Vérifier idempotency
    existing, _ := s.repo.FindByIdempotencyKey(ctx, req.IdempotencyKey)
    if existing != nil {
        return existing, nil // Retourner la transaction existante
    }

    // 2. Récupérer wallet avec lock
    wallet, err := s.repo.GetForUpdate(ctx, req.WalletID)
    if err != nil {
        return nil, ErrWalletNotFound
    }

    // 3. Vérifier solde
    if wallet.Balance < req.Amount {
        return nil, ErrInsufficientBalance
    }

    // 4. Créer transaction
    tx := &Transaction{
        WalletID:       req.WalletID,
        Type:           TransactionTypePayment,
        Amount:         -req.Amount,
        BalanceAfter:   wallet.Balance - req.Amount,
        IdempotencyKey: req.IdempotencyKey,
        StandID:        req.StandID,
        OperatorID:     req.OperatorID,
        OfflineCreated: req.OfflineCreated,
    }

    // 5. Sauvegarder (transaction atomique)
    return s.repo.CreateTransaction(ctx, tx)
}
```

### 2.4 Multi-Tenancy Middleware

```go
// internal/middleware/tenant.go
package middleware

import (
    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
)

func TenantMiddleware(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        // Extraire festival_id du JWT ou de l'URL
        festivalID := extractFestivalID(c)

        if festivalID == "" {
            c.AbortWithStatusJSON(400, gin.H{"error": "festival_id required"})
            return
        }

        // Configurer le schema PostgreSQL
        schemaName := fmt.Sprintf("festival_%s", festivalID)
        tenantDB := db.Exec(fmt.Sprintf("SET search_path TO %s, public", schemaName))

        // Stocker dans le context
        c.Set("db", tenantDB)
        c.Set("festival_id", festivalID)

        c.Next()
    }
}
```

---

## 3. Architecture Frontend Web

### 3.1 Structure du Projet (Back-Office)

```
festivals-admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Home (redirect)
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── callback/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx       # Dashboard layout with sidebar
│   │   │   ├── page.tsx         # Dashboard home
│   │   │   ├── festival/
│   │   │   │   ├── config/
│   │   │   │   ├── tickets/
│   │   │   │   ├── products/
│   │   │   │   └── team/
│   │   │   ├── lineup/
│   │   │   ├── finance/
│   │   │   ├── communication/
│   │   │   └── incidents/
│   │   └── (superadmin)/
│   │       ├── festivals/
│   │       ├── users/
│   │       └── billing/
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── forms/
│   │   ├── tables/
│   │   ├── charts/
│   │   └── layout/
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useFestival.ts
│   │   └── useRealtime.ts
│   ├── lib/
│   │   ├── api.ts               # API client (fetch wrapper)
│   │   ├── auth.ts              # Auth0 integration
│   │   └── utils.ts
│   ├── stores/
│   │   ├── authStore.ts         # Zustand auth store
│   │   └── festivalStore.ts
│   └── types/
│       └── api.ts               # Generated from OpenAPI
├── public/
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### 3.2 State Management (Zustand)

```typescript
// src/stores/festivalStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FestivalState {
  currentFestival: Festival | null
  festivals: Festival[]
  setCurrentFestival: (festival: Festival) => void
  setFestivals: (festivals: Festival[]) => void
}

export const useFestivalStore = create<FestivalState>()(
  persist(
    (set) => ({
      currentFestival: null,
      festivals: [],
      setCurrentFestival: (festival) => set({ currentFestival: festival }),
      setFestivals: (festivals) => set({ festivals }),
    }),
    {
      name: 'festival-storage',
    }
  )
)
```

### 3.3 API Client avec React Query

```typescript
// src/lib/api.ts
import { QueryClient } from '@tanstack/react-query'

const API_BASE = process.env.NEXT_PUBLIC_API_URL

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
    },
  },
})

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken()

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new ApiError(response.status, await response.json())
  }

  return response.json()
}

// Hook example
export function useWalletTransactions(walletId: string) {
  return useQuery({
    queryKey: ['wallet', walletId, 'transactions'],
    queryFn: () => apiClient<Transaction[]>(`/wallets/${walletId}/transactions`),
  })
}
```

---

## 4. Architecture Mobile

### 4.1 Structure du Projet

```
festivals-mobile/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab navigator
│   │   ├── index.tsx            # Home
│   │   ├── wallet.tsx           # Wallet
│   │   ├── program.tsx          # Lineup
│   │   ├── map.tsx              # Map
│   │   └── profile.tsx          # Profile
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── onboarding.tsx
│   ├── (staff)/
│   │   ├── _layout.tsx
│   │   ├── cashier.tsx          # Mode Barman
│   │   ├── scanner.tsx          # Mode Scanner
│   │   └── security.tsx         # Mode Sécurité
│   ├── sos.tsx
│   └── _layout.tsx              # Root layout
├── components/
│   ├── ui/
│   ├── wallet/
│   ├── scanner/
│   └── map/
├── hooks/
│   ├── useAuth.ts
│   ├── useOffline.ts
│   └── useSync.ts
├── lib/
│   ├── api.ts
│   ├── db.ts                    # SQLite (expo-sqlite)
│   └── sync.ts                  # Sync engine
├── stores/
│   ├── authStore.ts
│   ├── walletStore.ts
│   └── offlineStore.ts
├── app.json
├── eas.json
└── package.json
```

### 4.2 Offline Database (SQLite)

```typescript
// lib/db.ts
import * as SQLite from 'expo-sqlite'

const db = SQLite.openDatabase('festivals.db')

export async function initDatabase() {
  return new Promise<void>((resolve, reject) => {
    db.transaction(tx => {
      // Wallet cache
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS wallets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          festival_id TEXT NOT NULL,
          balance INTEGER NOT NULL,
          currency_name TEXT NOT NULL,
          exchange_rate REAL NOT NULL,
          updated_at TEXT NOT NULL
        )
      `)

      // Transactions (append-only)
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          wallet_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount INTEGER NOT NULL,
          balance_after INTEGER NOT NULL,
          reference TEXT,
          stand_id TEXT,
          operator_id TEXT,
          idempotency_key TEXT UNIQUE NOT NULL,
          synced INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `)

      // Tickets cache (pour validation offline)
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS tickets (
          id TEXT PRIMARY KEY,
          qr_code TEXT UNIQUE NOT NULL,
          status TEXT NOT NULL,
          type TEXT NOT NULL,
          holder_name TEXT,
          used_at TEXT,
          synced INTEGER DEFAULT 0,
          updated_at TEXT NOT NULL
        )
      `)

      // Sync queue
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          payload TEXT NOT NULL,
          retry_count INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `)
    }, reject, resolve)
  })
}
```

### 4.3 Sync Engine

```typescript
// lib/sync.ts
import NetInfo from '@react-native-community/netinfo'
import { db } from './db'
import { apiClient } from './api'

class SyncEngine {
  private isOnline = false
  private isSyncing = false

  constructor() {
    // Écouter les changements de connexion
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline
      this.isOnline = state.isConnected ?? false

      if (wasOffline && this.isOnline) {
        this.syncAll()
      }
    })
  }

  async syncAll() {
    if (this.isSyncing) return
    this.isSyncing = true

    try {
      // 1. Push local changes
      await this.pushPendingTransactions()

      // 2. Pull fresh data
      await this.pullWalletData()
      await this.pullTicketData()

    } finally {
      this.isSyncing = false
    }
  }

  private async pushPendingTransactions() {
    const pending = await db.getAllAsync<SyncQueueItem>(
      'SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT 100'
    )

    for (const item of pending) {
      try {
        await apiClient(`/sync/${item.entity_type}`, {
          method: 'POST',
          body: JSON.stringify(item.payload),
        })

        // Mark as synced
        await db.runAsync(
          'DELETE FROM sync_queue WHERE id = ?',
          [item.id]
        )
      } catch (error) {
        // Increment retry count
        await db.runAsync(
          'UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?',
          [item.id]
        )
      }
    }
  }

  private async pullWalletData() {
    const wallet = await apiClient<Wallet>('/me/wallet')
    await db.runAsync(
      `INSERT OR REPLACE INTO wallets
       (id, user_id, festival_id, balance, currency_name, exchange_rate, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [wallet.id, wallet.userId, wallet.festivalId, wallet.balance,
       wallet.currencyName, wallet.exchangeRate, new Date().toISOString()]
    )
  }
}

export const syncEngine = new SyncEngine()
```

### 4.4 QR Validation Cryptographique (Offline)

```typescript
// lib/qr.ts
import * as Crypto from 'expo-crypto'

interface QRPayload {
  ticketId: string
  festivalId: string
  type: string
  holderName: string
  expiresAt: string
  signature: string
}

export function validateQRCode(qrData: string, publicKey: string): QRPayload | null {
  try {
    const payload = JSON.parse(qrData) as QRPayload

    // 1. Vérifier expiration
    if (new Date(payload.expiresAt) < new Date()) {
      return null
    }

    // 2. Vérifier signature (HMAC avec clé publique festival)
    const dataToSign = `${payload.ticketId}:${payload.festivalId}:${payload.expiresAt}`
    const expectedSignature = Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      dataToSign + publicKey
    )

    if (payload.signature !== expectedSignature) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
```

---

## 5. Base de Données

### 5.1 Stratégie Multi-Tenant

```
PostgreSQL
├── public (schema partagé)
│   ├── platforms           # Config plateforme
│   ├── superadmins        # Super admins
│   └── festivals          # Liste des festivals (metadata)
│
├── festival_uuid1 (schema tenant)
│   ├── users
│   ├── wallets
│   ├── transactions
│   ├── tickets
│   ├── products
│   ├── stands
│   ├── lineup
│   ├── incidents
│   └── ...
│
└── festival_uuid2 (schema tenant)
    └── ... (même structure)
```

### 5.2 Schéma Principal (Tenant)

```sql
-- Schema: festival_<uuid>

-- Users (liés à Auth0)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth0_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(50),
    roles JSONB DEFAULT '[]',  -- ["FESTIVALIER", "BARMAN", "DJ"]
    parent_id UUID REFERENCES users(id),  -- Pour les mineurs
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallets
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    currency_name VARCHAR(50) NOT NULL DEFAULT 'Jetons',
    exchange_rate DECIMAL(10,4) NOT NULL DEFAULT 0.10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Transactions (append-only ledger)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    type VARCHAR(20) NOT NULL,  -- RECHARGE, PAYMENT, REFUND, CANCEL
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    reference VARCHAR(255),
    stand_id UUID REFERENCES stands(id),
    operator_id UUID REFERENCES users(id),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    offline_created BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX idx_transactions_created ON transactions(created_at);

-- Tickets
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL,  -- PASS_1DAY, PASS_WEEKEND, VIP, GUEST
    qr_code TEXT UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'VALID',  -- VALID, USED, CANCELLED
    options JSONB DEFAULT '{}',  -- {camping: true, parking: true}
    invited_by UUID REFERENCES users(id),  -- Pour les invités
    used_at TIMESTAMPTZ,
    used_by UUID REFERENCES users(id),  -- Scanner qui a validé
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tickets_qr ON tickets(qr_code);

-- Stands (Bars, Food, etc.)
CREATE TABLE stands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,  -- BAR, FOOD, MERCH, RECHARGE
    location JSONB,  -- {lat, lng, zone}
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stand_id UUID REFERENCES stands(id),
    name VARCHAR(255) NOT NULL,
    price BIGINT NOT NULL,  -- En monnaie virtuelle
    vat_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    category VARCHAR(50),
    stock INTEGER,  -- NULL = illimité
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lineup (Scènes)
CREATE TABLE stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    capacity INTEGER,
    location JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lineup (Artistes)
CREATE TABLE artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),  -- Si compte créé
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),  -- DJ, BAND, SOLO
    rider JSONB DEFAULT '{}',
    guest_quota INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lineup (Slots)
CREATE TABLE slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES stages(id),
    artist_id UUID NOT NULL REFERENCES artists(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, CONFIRMED, CANCELLED
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incidents
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id),
    reporter_type VARCHAR(20) NOT NULL,  -- STAFF, FESTIVALIER
    type VARCHAR(50) NOT NULL,  -- FIGHT, THEFT, MEDICAL, SOS
    location JSONB NOT NULL,  -- {lat, lng}
    description TEXT,
    status VARCHAR(20) DEFAULT 'OPEN',  -- OPEN, ASSIGNED, RESOLVED
    assigned_to UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    is_abuse BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    impersonated_by UUID REFERENCES public.superadmins(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
```

### 5.3 Indexes & Performance

```sql
-- Index pour recherche rapide de tickets
CREATE INDEX idx_tickets_status ON tickets(status) WHERE status = 'VALID';

-- Index pour transactions récentes
CREATE INDEX idx_transactions_recent ON transactions(created_at DESC);

-- Index GIN pour recherche dans JSONB
CREATE INDEX idx_users_roles ON users USING GIN(roles);

-- Partitioning pour transactions (si volume important)
CREATE TABLE transactions_partitioned (
    LIKE transactions INCLUDING ALL
) PARTITION BY RANGE (created_at);

CREATE TABLE transactions_2026_06 PARTITION OF transactions_partitioned
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
```

---

## 6. API Design

### 6.1 Conventions REST

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /festivals | Liste des festivals |
| GET | /festivals/:id | Détail festival |
| POST | /festivals | Créer festival (admin) |
| PATCH | /festivals/:id | Modifier festival |
| GET | /me/wallet | Mon wallet |
| POST | /me/wallet/recharge | Recharger |
| GET | /me/wallet/transactions | Mes transactions |
| POST | /transactions | Créer transaction (staff) |
| GET | /tickets/:qr | Valider ticket |
| POST | /tickets/:id/scan | Scanner entrée |
| POST | /incidents | Créer incident |

### 6.2 Format de Réponse Standard

```json
// Succès
{
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "perPage": 20
  }
}

// Erreur
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Solde insuffisant",
    "details": {
      "required": 1500,
      "available": 1200
    }
  }
}
```

### 6.3 WebSocket Events

```typescript
// Événements temps réel
interface WSEvents {
  // Dashboard
  'stats:update': { entries: number, transactions: number, revenue: number }

  // Alertes
  'incident:new': { incident: Incident }
  'incident:assigned': { incidentId: string, assignedTo: string }
  'incident:resolved': { incidentId: string }

  // Wallet (festivalier)
  'wallet:updated': { balance: number }
  'transaction:new': { transaction: Transaction }

  // Lineup
  'slot:updated': { slot: Slot }
}
```

---

## 7. Architecture Offline-First

### 7.1 Stratégie de Sync

```
┌──────────────────────────────────────────────────────────────┐
│                    APP MOBILE                                 │
│                                                               │
│  ┌─────────────────┐     ┌─────────────────┐                │
│  │ UI Components   │◀───▶│ Local State     │                │
│  └─────────────────┘     │ (Zustand)       │                │
│                          └────────┬────────┘                │
│                                   │                          │
│                          ┌────────▼────────┐                │
│                          │ SQLite Database │                │
│                          │ (Source of Truth│                │
│                          │  when offline)  │                │
│                          └────────┬────────┘                │
│                                   │                          │
│                          ┌────────▼────────┐                │
│                          │ Sync Engine     │                │
│                          │ - Queue pending │                │
│                          │ - Conflict res. │                │
│                          └────────┬────────┘                │
│                                   │                          │
└───────────────────────────────────┼──────────────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │    NETWORK          │
                         │    (si disponible)  │
                         └──────────┬──────────┘
                                    │
┌───────────────────────────────────┼──────────────────────────┐
│                                   ▼                          │
│                          ┌─────────────────┐                │
│                          │ API Backend     │                │
│                          └────────┬────────┘                │
│                                   │                          │
│                          ┌────────▼────────┐                │
│                          │ PostgreSQL      │                │
│                          │ (Source of Truth│                │
│                          │  when online)   │                │
│                          └─────────────────┘                │
│                                                              │
│                         SERVEUR                              │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Résolution de Conflits

```typescript
// Stratégie: Server Wins pour les données financières
interface ConflictResolution {
  entity: 'wallet'
  strategy: 'server_wins'

  resolve: (local: Wallet, remote: Wallet) => Wallet
}

const walletConflictResolver: ConflictResolution = {
  entity: 'wallet',
  strategy: 'server_wins',

  resolve: (local, remote) => {
    // Le serveur a la source de vérité pour le solde
    // Les transactions locales non-sync sont dans la queue
    return {
      ...remote,
      // Garder les transactions locales pending
      pendingTransactions: local.pendingTransactions
    }
  }
}

// Pour les transactions: idempotency_key garantit pas de doublons
```

### 7.3 Validation Ticket Offline

```
┌─────────────────────────────────────────────────────────────┐
│                 SCAN TICKET OFFLINE                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Décoder QR Code                                          │
│    - Parse JSON payload                                      │
│    - Extraire: ticketId, festivalId, signature              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Vérifier Signature Cryptographique                       │
│    - Clé publique du festival (cachée localement)           │
│    - HMAC-SHA256 du payload                                 │
│    - Si invalide → REFUSÉ                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Vérifier Cache Local                                     │
│    - Ticket existe dans SQLite ?                            │
│    - Status = VALID ?                                       │
│    - Pas déjà utilisé (used_at IS NULL) ?                  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│ 4a. VALIDE          │         │ 4b. REFUSÉ          │
│ - Marquer used_at   │         │ - Afficher raison   │
│ - Ajouter à queue   │         │ - Log tentative     │
│ - Afficher ✅       │         │ - Afficher ❌       │
└─────────────────────┘         └─────────────────────┘
```

---

## 8. Sécurité

### 8.1 Authentication Flow (Auth0)

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  Auth0   │────▶│  Backend │────▶│ Database │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │ 1. Login       │                │                │
     │───────────────▶│                │                │
     │                │                │                │
     │ 2. ID Token    │                │                │
     │◀───────────────│                │                │
     │                │                │                │
     │ 3. API Request + Bearer Token   │                │
     │─────────────────────────────────▶│                │
     │                │                │                │
     │                │ 4. Validate    │                │
     │                │    JWT         │                │
     │                │◀───────────────│                │
     │                │                │                │
     │                │                │ 5. Get/Create  │
     │                │                │    User        │
     │                │                │───────────────▶│
     │                │                │                │
     │ 6. Response    │                │                │
     │◀─────────────────────────────────│                │
```

### 8.2 JWT Claims

```json
{
  "sub": "auth0|user_id",
  "iss": "https://festivals.eu.auth0.com/",
  "aud": "https://api.festivals.app",
  "iat": 1718400000,
  "exp": 1718486400,
  "scope": "openid profile email",
  "permissions": ["read:wallet", "write:transaction"],
  "https://festivals.app/roles": ["FESTIVALIER", "BARMAN"],
  "https://festivals.app/festival_id": "uuid-festival"
}
```

### 8.3 Rate Limiting

```go
// middleware/ratelimit.go
var rateLimits = map[string]RateLimit{
    // Endpoints sensibles
    "POST /transactions":    {Requests: 100, Window: time.Minute},
    "POST /incidents":       {Requests: 10, Window: time.Minute},
    "POST /me/wallet/recharge": {Requests: 20, Window: time.Hour},

    // Endpoints généraux
    "GET /*":                {Requests: 1000, Window: time.Minute},
    "POST /*":               {Requests: 100, Window: time.Minute},
}
```

### 8.4 Encryption

```go
// Données sensibles en DB
type EncryptedField struct {
    Ciphertext []byte
    Nonce      []byte
}

func (e *EncryptedField) Encrypt(plaintext string, key []byte) error {
    block, _ := aes.NewCipher(key)
    gcm, _ := cipher.NewGCM(block)

    nonce := make([]byte, gcm.NonceSize())
    io.ReadFull(rand.Reader, nonce)

    e.Ciphertext = gcm.Seal(nil, nonce, []byte(plaintext), nil)
    e.Nonce = nonce
    return nil
}
```

---

## 9. Intégrations Externes

### 9.1 Stripe Connect

```go
// infrastructure/payment/stripe.go
package payment

import (
    "github.com/stripe/stripe-go/v76"
    "github.com/stripe/stripe-go/v76/paymentintent"
)

type StripeProvider struct {
    secretKey string
}

func (s *StripeProvider) CreatePaymentIntent(
    amount int64,
    currency string,
    festivalStripeAccountID string,
    metadata map[string]string,
) (*stripe.PaymentIntent, error) {
    params := &stripe.PaymentIntentParams{
        Amount:   stripe.Int64(amount),
        Currency: stripe.String(currency),
        // Paiement direct sur le compte du festival
        TransferData: &stripe.PaymentIntentTransferDataParams{
            Destination: stripe.String(festivalStripeAccountID),
        },
        // Frais plateforme (1%)
        ApplicationFeeAmount: stripe.Int64(amount / 100),
        Metadata: metadata,
    }

    return paymentintent.New(params)
}
```

### 9.2 Auth0 Management API

```go
// infrastructure/auth/auth0.go
package auth

import (
    "github.com/auth0/go-auth0/management"
)

type Auth0Client struct {
    mgmt *management.Management
}

func (c *Auth0Client) CreateUser(email, name string, roles []string) (*management.User, error) {
    user := &management.User{
        Email:    &email,
        Name:     &name,
        Connection: ptr("Username-Password-Authentication"),
    }

    if err := c.mgmt.User.Create(user); err != nil {
        return nil, err
    }

    // Assigner les rôles
    for _, role := range roles {
        c.mgmt.User.AssignRoles(*user.ID, &management.AssignRolesRequest{
            Roles: []*string{&role},
        })
    }

    return user, nil
}
```

### 9.3 Postal (Email)

```go
// infrastructure/mail/postal.go
package mail

import (
    "bytes"
    "encoding/json"
    "net/http"
)

type PostalClient struct {
    serverURL string
    apiKey    string
}

type Email struct {
    To      []string `json:"to"`
    From    string   `json:"from"`
    Subject string   `json:"subject"`
    HTML    string   `json:"html_body"`
}

func (c *PostalClient) Send(email Email) error {
    payload, _ := json.Marshal(map[string]interface{}{
        "to":        email.To,
        "from":      email.From,
        "subject":   email.Subject,
        "html_body": email.HTML,
    })

    req, _ := http.NewRequest("POST", c.serverURL+"/api/v1/send/message", bytes.NewBuffer(payload))
    req.Header.Set("X-Server-API-Key", c.apiKey)
    req.Header.Set("Content-Type", "application/json")

    _, err := http.DefaultClient.Do(req)
    return err
}
```

---

## 10. Infrastructure & DevOps

### 10.1 Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: ./festivals-api
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://festivals:password@postgres:5432/festivals
      - REDIS_URL=redis://redis:6379
      - AUTH0_DOMAIN=${AUTH0_DOMAIN}
      - AUTH0_AUDIENCE=${AUTH0_AUDIENCE}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: festivals
      POSTGRES_PASSWORD: password
      POSTGRES_DB: festivals
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio123
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  postal:
    image: postalserver/postal:latest
    ports:
      - "25:25"
      - "5000:5000"
    volumes:
      - postal_data:/opt/postal/data

  admin:
    build: ./festivals-admin
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8080

volumes:
  postgres_data:
  minio_data:
  postal_data:
```

### 10.2 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/main.yml
name: CI/CD

on:
  push:
    branches: [main, development]
  pull_request:
    branches: [main]

jobs:
  test-api:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - run: go test -v ./...
        working-directory: festivals-api

  test-admin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci && npm test
        working-directory: festivals-admin

  build-and-push:
    needs: [test-api, test-admin]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: ./festivals-api
          push: true
          tags: ghcr.io/${{ github.repository }}/api:${{ github.sha }}
```

### 10.3 Production Architecture (Future)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLOUDFLARE                                     │
│                        (CDN + DDoS Protection)                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         KUBERNETES CLUSTER                               │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        INGRESS (Traefik)                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│         ┌──────────────────────────┼──────────────────────────┐        │
│         │                          │                          │        │
│         ▼                          ▼                          ▼        │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐  │
│  │ API Pods    │           │ Admin Pods  │           │ Worker Pods │  │
│  │ (3 replicas)│           │ (2 replicas)│           │ (2 replicas)│  │
│  └─────────────┘           └─────────────┘           └─────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ PostgreSQL      │      │ Redis Cluster   │      │ S3 / MinIO      │
│ (Managed RDS)   │      │ (Managed)       │      │ (Object Storage)│
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## Annexe: Decisions Architecturales (ADR)

### ADR-001: Go pour le Backend

**Status:** Accepted

**Context:** Choix du langage backend pour une application avec contraintes de performance (transactions temps réel) et fiabilité.

**Decision:** Go avec Gin framework.

**Consequences:**
- (+) Excellente performance et faible latence
- (+) Typage fort, moins de bugs runtime
- (+) Concurrence native (goroutines)
- (+) Binaires compilés faciles à déployer
- (-) Écosystème moins riche que Node.js
- (-) Courbe d'apprentissage pour certains développeurs

### ADR-002: Multi-tenant par Schema PostgreSQL

**Status:** Accepted

**Context:** Isolation des données entre festivals tout en gardant une infrastructure simple.

**Decision:** Un schema PostgreSQL par festival (tenant).

**Consequences:**
- (+) Isolation forte des données
- (+) Facile à backuper/restaurer par festival
- (+) Performance queries (pas de WHERE tenant_id partout)
- (-) Plus de schemas à gérer
- (-) Migrations doivent être appliquées à chaque schema

### ADR-003: Offline-First avec SQLite Mobile

**Status:** Accepted

**Context:** Les festivals ont souvent une connectivité réseau limitée ou inexistante.

**Decision:** SQLite local avec sync engine custom.

**Consequences:**
- (+) Application fonctionne sans réseau
- (+) Transactions instantanées localement
- (+) UX fluide même en mauvaises conditions
- (-) Complexité sync et résolution conflits
- (-) Risque de données incohérentes si mal géré

---

*Document Architecture v1.0 - 2026-01-22*
