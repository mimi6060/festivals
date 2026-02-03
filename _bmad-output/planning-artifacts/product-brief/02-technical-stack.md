# Technical Stack & Architecture

## Stack Technique

| Catégorie | Technologie |
|-----------|-------------|
| **Backend** | Go + Gin + GORM |
| **Frontend** | React + TypeScript + Tailwind CSS |
| **Mobile** | React Native + Expo + NativeWind |
| **Database** | PostgreSQL (multi-tenant par schema) |
| **Cache** | Redis |
| **Storage** | MinIO (dev) / S3 (prod) |
| **Auth** | Auth0 (OAuth : Google, Facebook, etc.) |
| **Mail** | Mailpit (dev) / Resend ou Brevo (prod) |
| **SMS** | Twilio ou Brevo |
| **Maps** | MapLibre + OpenStreetMap + Nominatim |
| **Monitoring** | Loki + Grafana |
| **Dev** | Docker Compose + Expo + Hot reload |
| **Prod** | Kubernetes + Secrets management |

---

## Architecture Multi-Tenant

```
┌─────────────────────────────────────────────────────┐
│           CLIENTS                                    │
├─────────────┬─────────────┬─────────────────────────┤
│ Web Admin   │ Web Public  │ App Mobile              │
│ (React)     │ (React)     │ (React Native + Expo)   │
└──────┬──────┴──────┬──────┴────────┬────────────────┘
       │             │               │
       ▼             ▼               ▼
┌─────────────────────────────────────────────────────┐
│              API REST (Go + Gin)                     │
│         + WebSockets (temps réel)                    │
├─────────────────────────────────────────────────────┤
│              PostgreSQL                              │
│         (multi-tenant par schema)                    │
└─────────────────────────────────────────────────────┘
```

---

## Architecture Offline-First

```
┌─────────────────────────────────────┐
│         MOBILE APP                  │
│  ┌─────────────┐  ┌──────────────┐  │
│  │  SQLite     │  │  Sync Queue  │  │
│  │  (tickets,  │  │  (paiements, │  │
│  │   lineup)   │  │   scans)     │  │
│  └─────────────┘  └──────────────┘  │
└──────────────┬──────────────────────┘
               │ Sync quand réseau OK
               ▼
┌─────────────────────────────────────┐
│       API Go + PostgreSQL           │
└─────────────────────────────────────┘
```

**Validation QR offline** : Signature cryptographique dans le QR (JWT/HMAC).

---

## Infrastructure Services

| Service | Dev | Prod | Usage |
|---------|-----|------|-------|
| PostgreSQL | Docker | Managed (Supabase/RDS) | Base de données |
| Redis | Docker | Docker/Managed | Cache |
| MinIO | Docker | S3 | Stockage fichiers |
| Mailpit | Docker | Resend/Brevo | Emails |
| Auth0 | Dev tenant | Prod tenant | Authentification |
| Loki + Grafana | Docker | Cluster | Logs + monitoring |

---

## Scripts DevOps

```bash
./startdev.sh      # Docker dev avec hot reload
./start.sh         # Docker production
./k8s-deploy.sh    # Déploiement Kubernetes
```

### docker-compose.dev.yml (exemple)

```yaml
services:
  api:
    build: .
    volumes:
      - ./backend:/app  # Hot reload Go avec Air
    environment:
      - GIN_MODE=debug

  web:
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev  # Vite hot reload

  db:
    image: postgres:16

  redis:
    image: redis:alpine

  minio:
    image: minio/minio

  mailpit:
    image: axllent/mailpit
```

---

## Exigences Techniques

- **Zéro valeur hardcodée** : Tout configurable en DB
- **Multi-langue (i18n)** : Chaque utilisateur dans sa langue
- **Responsive** : Mobile, tablet, desktop
- **Performance** : Temps réponse < 200ms
- **Fiabilité** : 0 crash, 0 fuite mémoire
