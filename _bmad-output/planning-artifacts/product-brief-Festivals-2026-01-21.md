---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
date: 2026-01-21
author: Michel
partyModeSession: party-mode-session-2026-01-21.md
---

# Product Brief: Festivals

## Executive Summary

**Festivals** est une plateforme tout-en-un destinée aux organisateurs de festivals, permettant de gérer l'intégralité d'un événement : de la création du site vitrine à la billetterie, en passant par la gestion des équipes, le suivi financier en temps réel, la logistique, et l'expérience festivalier sur place. L'objectif est de remplacer les processus manuels (listes papier, Excel, outils disparates) par une solution centralisée, évolutive et multi-tenant, capable de supporter de 5 à 50 festivals simultanés, avec des événements de 500 à plusieurs dizaines de milliers de participants.

---

## Core Vision

### Problem Statement

Les organisateurs de festivals de taille moyenne à grande gèrent aujourd'hui leur événement avec des outils fragmentés : listes papier pour les entrées, fichiers Excel pour le budget, communications dispersées. Cela génère des pertes de temps considérables (vérification manuelle des noms à l'entrée), un manque total de visibilité sur les ventes et les finances, des risques de fraude, et une logistique approximative ("on a oublié les fûts").

### Problem Impact

- **Temps perdu** : files d'attente interminables à l'entrée (recherche sur 47 pages de noms)
- **Risque financier** : impossible de savoir en temps réel si l'événement est rentable
- **Stress organisationnel** : 30+ personnes sans outil centralisé pour coordonner
- **Scalabilité bloquée** : impossible de doubler la capacité chaque année sans automatisation
- **Fraude** : pas de contrôle fiable des entrées et des paiements
- **Logistique** : pas de suivi des stocks (bouteilles, fûts, gobelets)

### Why Existing Solutions Fall Short

Les solutions existantes sont soit trop spécialisées (billetterie seule, gestion de stocks seule), soit conçues pour des méga-événements avec des budgets conséquents. Il n'existe pas de plateforme accessible qui combine : site vitrine, billetterie, gestion d'équipe avec permissions granulaires, suivi financier, logistique, et expérience festivalier (app mobile, cashless) dans un seul outil adaptable à différentes tailles de festivals.

### Proposed Solution

Une plateforme modulaire comprenant :

1. **Back-office Admin** : Encoder festival, artistes, scènes, prix, maps, équipe, sponsors
2. **Site vitrine public** (style Tomorrowland) : affiche, lineup, vidéos artistes, lieu, infos pratiques
3. **Billetterie** : vente tickets avec QR code, merchandising
4. **Dashboard financier** : suivi entrées, dépenses, budget restant, bénéfice temps réel
5. **App festivalier** : QR code d'entrée, programme temps réel, solde cashless, carte interactive, infos pratiques (mode offline)
6. **Outils terrain** : scan entrées (offline), gestion paiements cashless (NFC, Payconiq, cash)
7. **Gestion stocks** : inventaire, alertes, suivi temps réel
8. **Post-événement** : archives photos/vidéos, historique, promotion éditions futures
9. **Multi-tenant** : réutilisable pour 5 à 50 festivals simultanés

### Key Differentiators

- **Tout-en-un** : pas besoin de jongler entre 10 outils différents
- **Multi-tenant dès le départ** : conçu pour gérer plusieurs festivals
- **Permissions granulaires** : une personne peut être DJ + barman + ingénieur son
- **Offline-first** : fonctionne sans réseau (champs, camping)
- **Scalable** : de 500 à 50 000+ participants
- **Conçu par des organisateurs** : répond aux vrais problèmes terrain

---

## Technical Stack

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
| **SMS** | Twilio ou Brevo (rappels, urgences - optionnel) |
| **Maps** | MapLibre + OpenStreetMap + Nominatim |
| **Monitoring** | Loki + Grafana |
| **Dev** | Docker Compose + Expo + Hot reload |
| **Prod** | Kubernetes + Secrets management |

### Architecture Offline-First

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

### Scripts DevOps

- `startdev.sh` → Docker dev avec hot reload
- `start.sh` → Docker production
- `k8s-deploy.sh` → Déploiement Kubernetes

---

## Feature Priorities

| Ordre | Feature | Offline | Description |
|-------|---------|---------|-------------|
| 1️⃣ | Back-office Admin | Non | Encoder festival, artistes, scènes, prix, équipe |
| 2️⃣ | Site Vitrine | Non | Afficher le festival au public |
| 3️⃣ | Billetterie | Non | Vendre les tickets |
| 4️⃣ | Dashboard financier | Non | Suivi entrées/dépenses/bénéfices |
| 5️⃣ | App Festivalier | ✅ Oui | Lineup, maps, infos |
| 6️⃣ | Scan QR | ✅ Oui | Entrées staff |
| 7️⃣ | Cashless | ✅ Oui | Paiements bar/food |
| 8️⃣ | Gestion stocks | Non | Inventaire détaillé |

---

## Target Users

### Système de Permissions Multi-Rôles

**Principe** : Une personne peut cumuler plusieurs statuts. Les permissions sont additives.

```
Personne
  └── a plusieurs → Catégories[]
                      └── contient → Statuts[]
                                      └── donne → Permissions[]
```

**Comportement par défaut** :
- Premier utilisateur (création DB) = **Admin**
- Tous les autres = **Festivalier** (niveau le plus bas)
- Peut être promu en changeant sa catégorie

**Catégories personnalisables par festival.**

### Catégories et Statuts

| Catégorie | Statuts possibles |
|-----------|-------------------|
| **Admin** | Super Admin (accès total, multi-festivals) |
| **Organisation** | Budget, Lineup, Sponsors, Logistique, Site Vitrine, Communication |
| **Staff** | Scanner Entrée, Barman, Sécurité, Technicien Son, Technicien Lumière, Accueil |
| **Artiste** | DJ, Groupe, Artiste Solo |
| **Public** | Festivalier, Invité |

### Personas Principaux

**🔧 Admin (Super Admin)**
- Créé à l'initialisation de la DB
- Accès total à tous les festivals
- Gère les catégories et permissions

**📋 Marie - Organisatrice**
- Statuts : [Budget] + [Lineup]
- Voit finances ET artistes
- Dashboard complet de son périmètre

**🍺 Marc - Multi-casquettes**
- Statuts : [DJ] + [Barman] + [Orga Lineup]
- Joue en tant que DJ
- Aide au bar entre ses sets
- Participe à la programmation

**🚨 Sophie - Sécurité**
- Statuts : [Sécurité]
- Alerte équipe + secours
- Partage position GPS
- Bouton SOS

**🎤 DJ Max - Artiste**
- Statuts : [DJ]
- Portail artiste : horaires, fiche technique, RDV
- Peut inviter des guests (création Invités)

**🎉 Julie - Festivalière classique**
- Statuts : [Festivalier]
- Achète ticket, utilise cashless
- App mobile avec programme, carte, infos

**🎁 Kevin - Invité**
- Statuts : [Festivalier] + [Invité]
- Ticket gratuit (via artiste ou staff)
- Mêmes fonctionnalités que festivalier

### User Journeys

**Organisateur** :
1. Reçoit invitation par email (lien magic link ou Auth0)
2. Admin lui assigne catégorie [Organisation]
3. Accède au back-office selon ses statuts
4. Encode infos festival dans son périmètre

**Festivalier** :
1. Découvre le festival via site vitrine
2. Achète ticket → compte créé automatiquement [Festivalier]
3. Télécharge l'app (suggéré) ou imprime QR
4. Jour J : scan entrée, cashless, programme offline

**Invité** :
1. Artiste/Staff crée une invitation
2. Invité reçoit email avec QR gratuit
3. Même expérience que Festivalier

**Artiste** :
1. Orga Lineup l'ajoute avec statut [DJ/Groupe/Solo]
2. Reçoit accès portail artiste
3. Remplit fiche technique, confirme horaires
4. Peut créer des invitations pour ses guests

---

## Success Metrics

### Priorités Features

1. **Back-office Admin** : Tout configurable en DB, zéro hardcoded
2. **Billetterie** : Achat → QR code fonctionnel
3. **Cashless** : Paiements boissons/food rapides
4. **Lineup & Maps** : Navigation intuitive
5. **Reporting** : Visibilité financière temps réel
6. **Archives** : Souvenirs post-événement

### KPIs Techniques (Fiabilité & Performance)

| Métrique | Cible | Criticité |
|----------|-------|-----------|
| Paiements arrivés sur compte | 100% | 🔴 Critique |
| Transactions échouées silencieuses | 0 | 🔴 Critique |
| Crashes / Freezes | 0 | 🔴 Critique |
| Comportement inattendu | 0 | 🔴 Critique |
| Fuites mémoire | 0 | 🟠 Important |
| Temps réponse API | < 200ms | 🟠 Important |
| Fonctionnement offline | Scan + Paiement + Programme | 🔴 Critique |

### KPIs UX/UI

| Critère | Cible |
|---------|-------|
| Facilité d'utilisation | "Grand-mère friendly" |
| Boutons inutiles | 0 |
| CSS cassé / texte débordant | 0 |
| Vues intuitives | Navigation évidente |
| Multi-langue (i18n) | ✅ Chaque user dans SA langue |
| Responsive | Mobile, tablet, desktop |

### KPIs Satisfaction par Rôle

| Rôle | Besoin principal | Cible |
|------|------------------|-------|
| Festivalier | Achat → QR reçu | < 2 min |
| Festivalier | Trouver bars/WC/scènes | < 2 taps |
| Festivalier | Voir horaire artiste | < 2 taps |
| Barman | Scan → paiement validé | < 2 sec |
| Food | Scan → paiement validé | < 2 sec |
| Sécurité | Envoyer alerte | < 5 sec |
| Artiste | Voir son horaire | 1 tap |
| Organisateur | Dashboard bénéfice | Temps réel |

### KPIs Business (12 mois)

- Nombre de festivals actifs sur la plateforme
- % réduction temps d'entrée vs méthode papier
- Score satisfaction organisateur > 4/5
- Score satisfaction festivalier > 4/5
