---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief/index.md
  - _bmad-output/planning-artifacts/product-brief/01-executive-summary.md
  - _bmad-output/planning-artifacts/product-brief/02-technical-stack.md
  - _bmad-output/planning-artifacts/product-brief/03-target-users.md
  - _bmad-output/planning-artifacts/product-brief/04-success-metrics.md
  - _bmad-output/planning-artifacts/product-brief/05-mvp-scope.md
workflowType: 'prd'
documentCounts:
  briefs: 6
  research: 0
  brainstorming: 0
  projectDocs: 0
classification:
  projectType: SaaS B2B (plateforme multi-tenant)
  domain: Event Management + Fintech (paiements réglementés)
  complexity: HIGH
  projectContext: greenfield
---

# Product Requirements Document - Festivals

**Author:** Michel
**Date:** 2026-01-22
**Version:** 1.0

---

## Table des Matières

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [Classification & Contexte](#2-classification--contexte)
3. [Critères de Succès](#3-critères-de-succès)
4. [Product Scope (MVP & Roadmap)](#4-product-scope-mvp--roadmap)
5. [User Journeys](#5-user-journeys)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Architecture Technique](#8-architecture-technique)
9. [Sécurité & Conformité](#9-sécurité--conformité)
10. [Innovation & Différenciation](#10-innovation--différenciation)
11. [Gestion des Risques](#11-gestion-des-risques)

---

## 1. Résumé Exécutif

### Vision

**Festivals** est une plateforme SaaS B2B de gestion complète de festivals, avec comme innovation principale un système cashless **offline-first** qui fonctionne même sans connexion internet.

### Problème Résolu

Les festivals font face à des défis critiques :
- **Réseau saturé ou inexistant** → Les solutions cashless existantes plantent
- **Gestion fragmentée** → Billetterie, paiements, staff, artistes sur des outils différents
- **Complexité financière** → Multi-taux TVA, remboursements, réconciliation

### Solution

Une plateforme unifiée qui gère :
- **Billetterie** → Achat en ligne → QR code
- **Cashless offline-first** → Paiements sans réseau
- **Gestion staff** → Permissions multi-rôles
- **Artistes** → Portail collaboratif (riders, créneaux)
- **Support** → Email, SMS, alertes sécurité

### Modèle de Revenus

**1% par transaction cashless** - Pas d'abonnement (barrière entrée = 0)

### Cibles Année 1

- 15-20 festivals actifs
- 10 000+ festivaliers traités
- ~24 000€ de revenus

---

## 2. Classification & Contexte

| Critère | Valeur |
|---------|--------|
| **Type** | SaaS B2B multi-tenant |
| **Domaine** | Event Management + Fintech |
| **Complexité** | HIGH (paiements légaux, conformité, multi-canal) |
| **Contexte** | Greenfield |

### Multi-Tenancy

| Aspect | Choix |
|--------|-------|
| **Isolation** | Schema PostgreSQL par festival |
| **Data** | Données isolées, pas de cross-tenant |
| **Argent** | Chaque festival = compte Stripe Connect séparé |
| **Principe clé** | La plateforme ne touche jamais l'argent des festivals |

### Intégrations Principales

| Service | Usage |
|---------|-------|
| Stripe Connect | Paiements, KYC festivals |
| Auth0 | OAuth (Google, Facebook, email) |
| Postal | Email envoi/réception (Docker) |
| Twilio/RingRing | SMS |
| MapLibre + OSM | Cartes |

---

## 3. Critères de Succès

### User Success

**Festivalier**

| Moment | Critère |
|--------|---------|
| Achat billet | QR reçu en < 2 min, 0 friction |
| Arrivée festival | Scan entrée < 3 sec (offline OK) |
| Premier paiement | Système compris immédiatement |
| Fin de festival | Historique complet, remboursement possible |

**Organisateur**

| Moment | Critère |
|--------|---------|
| Configuration | Festival créé en < 1 journée |
| Jour J | Dashboard temps réel |
| Problème | Alerte sécurité reçue < 10 sec |
| Post-festival | Export comptable en 1 clic |

**Staff Terrain**

| Rôle | Action | Cible |
|------|--------|-------|
| Scanner entrée | Validation QR | < 2 sec (offline OK) |
| Barman/Food | Paiement cashless | < 2 sec (offline OK) |
| Sécurité | Envoi alerte | < 5 sec |

### Business Success (12 mois)

| Métrique | Cible |
|----------|-------|
| Festivals actifs | 15-20 |
| Festivaliers traités | 10 000+ |
| Satisfaction organisateur | > 4/5 |
| Satisfaction festivalier | > 4/5 |
| Réduction temps entrée | -50% vs papier |

**Projection revenus (20 festivals moyens) :** ~24 000€

### Technical Success

| Métrique | Cible | Criticité |
|----------|-------|-----------|
| Paiements arrivés | 100% | 🔴 Critique |
| Transactions échouées silencieuses | 0 | 🔴 Critique |
| Crashes / Freezes | 0 | 🔴 Critique |
| Sync offline → online | 100% sans perte | 🔴 Critique |
| Temps réponse API | < 200ms | 🟠 Important |
| Uptime plateforme | 99.9% | 🟠 Important |

### SLA Support

| Type | Temps |
|------|-------|
| Urgence sécurité | < 10 sec |
| Problème paiement sur place | < 30 sec |
| Question billet | < 4h |
| Demande sponsor/artiste | < 24h |

---

## 4. Product Scope (MVP & Roadmap)

### Phase 1 - MVP (Indispensable)

| Feature | Offline | Description |
|---------|---------|-------------|
| Back-office Admin | Non | Festival, tarifs, tickets, camping, VIP, goodies |
| Site Vitrine | Non | Présentation festival, attracteur visiteurs |
| Billetterie → QR | Non | Achat en ligne, génération QR |
| **Cashless + Wallet** | ✅ Oui | Paiements boissons/food, monnaie virtuelle |
| **Scan QR entrée** | ✅ Oui | Validation tickets |
| **Lineup** | ✅ Oui | Scènes, horaires artistes |
| Support email | Non | Via Postal (Docker) |
| Support chat | Non | Widget temps réel |

**Critères MVP :**
- Un organisateur peut créer un festival complet
- Un festivalier peut acheter un ticket et recevoir son QR
- Le scan d'entrée fonctionne (même offline)
- Le paiement cashless fonctionne (même offline)
- Le lineup est consultable

### Phase 2 - Growth

| Feature | Offline |
|---------|---------|
| App Festivalier complète (carte interactive) | ✅ Oui |
| Dashboard financier temps réel | Non |
| Alertes sécurité (SOS, position GPS) | Non |
| Gestion équipe (rôles, permissions, planning) | Non |
| SMS notifications (crédit rechargeable) | Non |

### Phase 3 - Vision

| Feature |
|---------|
| Gestion stocks (inventaire, alertes) |
| Archives/Souvenirs (photos, vidéos) |
| Portail artiste avancé |
| Chatbot IA support |
| Analytics avancés |
| API ouverte |
| Marketplace festivals |

---

## 5. User Journeys

### 5.1 Festivalier

**Contexte :** Julie, 28 ans, découvre le festival sur Instagram.

```
1. DÉCOUVERTE
   → Voit pub Instagram → Clique → Site vitrine
   → Explore lineup, prix, infos pratiques

2. ACHAT
   → Sélectionne billets + options (camping, VIP...)
   → Paiement Stripe → Reçoit QR codes par email
   → Télécharge l'app (suggéré)

3. JOUR J - ENTRÉE
   → Arrive au festival → File d'attente
   → Scan QR → Validation < 3 sec
   → Reçoit bracelet tissu (NFC = Phase future)

4. RECHARGE CASHLESS
   Option A : Via app (CB en ligne)
   Option B : Caisse physique (espèces ou CB)
   → Crédité en monnaie festival (nom custom)

5. PAIEMENT
   → Présente QR app au bar
   → Scan → Solde suffisant ?
      ✅ Oui → Transaction OK
      ❌ Non → Transaction BLOQUÉE (jamais de négatif)
   → Voit solde mis à jour

6. FIN DE FESTIVAL
   → Consulte historique dépenses
   → Demande remboursement (sur demande uniquement)
   → Festival traite → Virement
```

### 5.2 Festivalier SOS

```
1. BESOIN D'AIDE
   → Bouton "SOS" visible dans l'app
   → ⚠️ Avertissement légal affiché
   → Confirme "J'ai vraiment besoin d'aide"

2. ENVOI ALERTE
   → Sélectionne type : Agression / Malaise / Besoin assistance
   → Position GPS envoyée automatiquement
   → Push notif → Équipe sécurité
   → Feedback : "X personnes avant vous"

3. ANTI-SPAM
   → Limite : 1 alerte / 10 min
   → Abus détecté → Flag compte + alerte orga
   → Possibilité facturation déplacement injustifié
```

### 5.3 Barman / Stand Food

```
1. CONNEXION
   → Login app staff → Mode Barman/Food
   → Voit liste produits + prix

2. PRISE DE COMMANDE
   → Client commande → Sélectionne produits
   → Demande QR client → Scan

3. VALIDATION
   → Solde suffisant ?
      ✅ Oui → Transaction validée → Prépare commande
      ❌ Non → "Solde insuffisant" → Diriger vers caisse

4. ERREUR
   → Bouton "Annuler transaction"
   → Remboursement immédiat sur wallet client

5. OFFLINE
   → Réseau coupé → Continue à servir
   → Transactions stockées localement
   → Sync auto quand réseau OK
```

**Note :** Stands Bar et Food séparés. Recharge possible au bar (exceptionnel), idéalement en caisse dédiée.

### 5.4 Scanner Entrée

```
1. SETUP
   → Login app → Mode Scanner Entrée
   → Cache liste tickets en local (offline ready)

2. SCAN (3 méthodes)
   → QR sur téléphone festivalier
   → QR imprimé sur bracelet tissu
   → NFC bracelet (Phase future)

3. VALIDATION
   → ✅ Vert = Entrée OK
   → ❌ Rouge = Invalide / Déjà utilisé / Hors créneau

4. POLITIQUE SORTIE (Configurable)
   Option A : Entrée unique → Plus de sortie
   Option B : Scan sortie + Scan re-entrée (tracké)

5. CAS SPÉCIAUX
   → VIP → Badge spécial affiché
   → Camping → Emplacement affiché
   → Invité → "Invité de [Artiste]"
```

### 5.5 Sécurité

```
1. CONNEXION
   → Login app → Mode Sécurité
   → GPS activé → Position partagée avec équipe

2. PATROUILLE
   → Voit carte avec position autres agents
   → Numéro d'appel rapide visible (1 tap)

3. RÉCEPTION ALERTE
   → Push notification + son d'alarme spécial
   → Voit sur carte : position de l'alerte
   → Source : Agent OU Festivalier

4. INCIDENT
   → Bouton "Alerte" → Type : Bagarre / Vol / Suspect / Autre
   → Envoi < 5 sec → Toute l'équipe notifiée

5. RAPPORT
   → Incident résolu → Rapport + photo
   → Horodaté automatiquement
```

### 5.6 Admin - Gestion Incidents

```
1. HISTORIQUE INCIDENTS
   → Liste tous les incidents
   → Filtre : date, type, source (agent/festivalier)

2. DÉTAIL INCIDENT
   → Qui a envoyé, heure, position GPS
   → Agent qui a répondu, temps de réponse
   → Résolution (rapport)

3. ABUS DÉTECTÉ
   → Flag "Alerte injustifiée"
   → Génère facture pour déplacement inutile

4. SANCTIONS
   → Récidive → Blocage fonction SOS
   → Cas grave → Exclusion festival
```

### 5.7 Organisateur Lineup

```
1. CRÉATION SCÈNES
   → Ajoute scènes (Main Stage, Techno Tent, etc.)
   → Configure : capacité, localisation, équipement

2. AJOUT ARTISTES
   → Invite artiste → Statut [DJ/Groupe/Solo]
   → Artiste reçoit email → Accède portail

3. PROPOSITIONS ARTISTES
   → Artiste propose créneau souhaité
   → Artiste propose échange avec autre artiste
   → ⚠️ Tout reste en "En attente validation"

4. VALIDATION ORGA
   → Voit toutes les propositions
   → Accepte / Refuse / Modifie
   → Validé → Publié sur lineup

5. MODIFICATION LAST-MINUTE
   → Changement → Push notif festivaliers concernés
```

### 5.8 Artiste

```
1. INVITATION
   → Reçoit email orga → Lien portail artiste
   → Crée compte / Login

2. CRÉNEAU
   → Voit créneaux disponibles
   → Propose son créneau préféré
   → Peut proposer échange avec autre artiste
   → Status : "En attente validation orga"

3. FICHE TECHNIQUE (Rider)
   → Remplit : besoins son, lumière, vidéo, pyro, matériel
   → Fiche visible par : autres artistes + staff technique

4. INVITATIONS GUESTS
   → Quota défini par orga
   → Ajoute emails guests → QR gratuits envoyés

5. JOUR J
   → Consulte horaire final + plan backstage
   → Notif 30 min avant set
```

### 5.9 Staff Technique

**Statuts :** Ingé-son, Ingé-lumière, Ingé-vidéo, Pyrotechnie, Logistique

```
1. CONNEXION
   → Login → Mode selon statut

2. CONSULTATION FICHES
   → Voit liste artistes par scène
   → Accède fiche technique chaque artiste
   → Filtre par ses besoins (son, lumière, etc.)

3. PRÉPARATION
   → Checklist matériel par artiste
   → Marque "Prêt" quand configuré

4. JOUR J
   → Planning artistes avec fiches accessibles
   → Notes personnelles par set
```

### 5.10 Organisateur Budget

```
1. DASHBOARD TEMPS RÉEL
   → Entrées vs prévisions
   → Recettes cashless par stand
   → Cachets artistes (saisi manuellement)
   → Bénéfice estimé

2. GESTION PRIX
   → Modifier prix en live (Happy Hour, liquidation)
   → Historique des changements

3. REMBOURSEMENTS
   → Liste demandes festivaliers
   → Approuve / Refuse
   → OU Config : "Remboursement auto soldes restants"

4. EXPORT
   → CSV/Excel avec TVA multi-taux

5. COMPARAISON MULTI-ÉDITIONS
   → Année N vs N-1
   → Graphiques comparatifs
```

### 5.11 Organisateur Communication

```
1. SMS
   → Dashboard crédit restant
   → Recharger : CB ou prépayé
   → Service externe (RingRing, Twilio)
   → Envoi manuel ou auto (rappels J-1, confirmations)

2. EMAIL
   → Inbox complète (envoi + réception + réponse)
   → Templates personnalisables

3. PUSH NOTIFICATIONS
   → Ciblé : tous, VIP, camping, fans artiste X
   → Programmable
```

### 5.12 Super Admin

```
1. GESTION ÉQUIPE ADMIN
   → Ajouter autant de super admins que nécessaire
   → Historique actions par admin

2. GESTION FESTIVALS
   → Créer / Archiver / Supprimer / Suspendre

3. TOUTES LES PERMISSIONS
   → Accès à TOUTES les fonctionnalités
   → Peut intervenir sur n'importe quel festival

4. IMPERSONATION (Login As)
   → "Se connecter en tant que [User]"
   → Voit exactement ce que l'user voit
   → ⚠️ Toutes actions loguées
   → Bannière visible : "Mode Impersonation"

5. FACTURATION 1%
   → Calcul auto après chaque festival
   → Génère facture → Envoie

6. MONITORING & DEBUG
   → Logs techniques, accès transactions
```

### 5.13 Invité

```
→ Comme Festivalier, mais :
   - Ticket gratuit (reçu via artiste/staff)
   - Marqué "Invité de [Artiste]"
   - Même cashless, même app
```

---

## 6. Functional Requirements

### 6.1 User Management & Authentication (FR1-FR6)

| ID | Requirement |
|----|-------------|
| FR1 | Un utilisateur peut créer un compte via email ou OAuth (Google, Facebook) |
| FR2 | Un utilisateur peut avoir plusieurs statuts simultanés (DJ + Barman + Orga) |
| FR3 | Un utilisateur voit ses permissions combinées dans une interface unifiée |
| FR4 | Un parent peut créer et gérer un compte pour un mineur (< 16 ans) |
| FR5 | Un utilisateur peut demander l'export de ses données (RGPD) |
| FR6 | Un utilisateur peut demander la suppression de son compte (RGPD) |

### 6.2 Festival Management (FR7-FR13)

| ID | Requirement |
|----|-------------|
| FR7 | Un Super Admin peut créer un nouveau festival |
| FR8 | Un Super Admin peut archiver ou supprimer un festival |
| FR9 | Un organisateur peut configurer les paramètres généraux du festival |
| FR10 | Un organisateur peut définir la politique de remboursement (auto/manuel/refus) |
| FR11 | Un organisateur peut définir la politique de re-entrée (unique/scan in-out) |
| FR12 | Un organisateur peut configurer les créneaux d'entrée par type de billet |
| FR13 | Un organisateur peut personnaliser le nom de la monnaie virtuelle |

### 6.3 Ticketing & Entry (FR14-FR20)

| ID | Requirement |
|----|-------------|
| FR14 | Un festivalier peut acheter des billets sur le site vitrine |
| FR15 | Un festivalier peut choisir des options (camping, VIP, goodies) |
| FR16 | Un festivalier reçoit un QR code par email après achat |
| FR17 | Un scanner peut valider un QR code en moins de 3 secondes |
| FR18 | Un scanner peut valider un QR code sans connexion internet |
| FR19 | Un scanner voit le type de billet (VIP, camping, invité) après scan |
| FR20 | Le système bloque un QR déjà utilisé avec l'heure du premier scan |

### 6.4 Cashless & Wallet (FR21-FR31)

| ID | Requirement |
|----|-------------|
| FR21 | Un festivalier peut recharger son wallet via l'app (CB) |
| FR22 | Un festivalier peut recharger son wallet en caisse (espèces/CB) |
| FR23 | Un festivalier peut voir son solde en temps réel |
| FR24 | Un festivalier peut consulter son historique de transactions |
| FR25 | Un barman/food peut encaisser un paiement par scan QR |
| FR26 | Un barman/food peut encaisser un paiement sans connexion internet |
| FR27 | Le système bloque une transaction si solde insuffisant (jamais de négatif) |
| FR28 | Un barman/food peut annuler une transaction (remboursement immédiat) |
| FR29 | Les transactions offline se synchronisent automatiquement |
| FR30 | Un festivalier peut demander le remboursement de son solde restant |
| FR31 | Un organisateur peut approuver/refuser les demandes de remboursement |

### 6.5 Support & Communication (FR32-FR37)

| ID | Requirement |
|----|-------------|
| FR32 | Un festivalier peut contacter le support via chat in-app |
| FR33 | Un support peut répondre aux demandes via inbox unifiée |
| FR34 | Un support peut envoyer et recevoir des emails |
| FR35 | Un organisateur peut envoyer des SMS (crédit rechargeable) |
| FR36 | Un organisateur peut envoyer des push notifications ciblées |
| FR37 | Un organisateur peut configurer des rappels automatiques (J-1, etc.) |

### 6.6 Security & Alerts (FR38-FR45)

| ID | Requirement |
|----|-------------|
| FR38 | Un agent sécurité peut voir la position GPS des autres agents |
| FR39 | Un agent sécurité peut envoyer une alerte à toute l'équipe |
| FR40 | Un festivalier peut envoyer un SOS avec sa position GPS |
| FR41 | Un festivalier voit un avertissement légal avant envoi SOS |
| FR42 | Le système limite les alertes SOS (anti-spam) |
| FR43 | Un admin peut voir l'historique complet des incidents |
| FR44 | Un admin peut facturer un déplacement injustifié |
| FR45 | Un agent peut rédiger un rapport d'incident avec photo |

### 6.7 Artist & Lineup Management (FR46-FR55)

| ID | Requirement |
|----|-------------|
| FR46 | Un orga lineup peut créer des scènes et des créneaux |
| FR47 | Un orga lineup peut inviter un artiste par email |
| FR48 | Un artiste peut confirmer ou proposer un autre créneau |
| FR49 | Un artiste peut proposer un échange avec un autre artiste |
| FR50 | Un orga lineup doit valider toute modification avant publication |
| FR51 | Un artiste peut remplir sa fiche technique (rider) |
| FR52 | Un artiste peut voir les fiches techniques des autres artistes |
| FR53 | Un staff technique peut consulter les fiches techniques |
| FR54 | Un artiste peut inviter des guests (quota défini par orga) |
| FR55 | Un festivalier peut consulter le lineup sur l'app |

### 6.8 Pricing & Budget (FR56-FR60)

| ID | Requirement |
|----|-------------|
| FR56 | Un orga budget peut voir le dashboard temps réel |
| FR57 | Un orga budget peut modifier les prix en live (happy hour) |
| FR58 | Un orga budget peut saisir les cachets artistes (indicatif) |
| FR59 | Un orga budget peut exporter les données en CSV/Excel |
| FR60 | Un orga budget peut comparer les stats année par année |

### 6.9 Super Admin / Platform (FR61-FR66)

| ID | Requirement |
|----|-------------|
| FR61 | Un Super Admin peut ajouter d'autres Super Admins |
| FR62 | Un Super Admin peut se connecter en tant qu'autre utilisateur (impersonation) |
| FR63 | Le système logue toutes les actions d'impersonation |
| FR64 | Un Super Admin peut voir tous les festivals sur un dashboard global |
| FR65 | Le système calcule automatiquement la facturation 1% |
| FR66 | Un Super Admin peut suspendre un festival |

**Total: 66 Functional Requirements**

---

## 7. Non-Functional Requirements

### 7.1 Performance (NFR1-NFR5)

| ID | Cible | Contexte |
|----|-------|----------|
| NFR1 | Scan QR validation < 3 sec | Même offline |
| NFR2 | Transaction cashless < 2 sec | Même offline |
| NFR3 | API response < 200 ms | 95th percentile |
| NFR4 | App startup < 3 sec | Première ouverture |
| NFR5 | Sync offline < 30 sec | Pour 100 transactions |

### 7.2 Security (NFR6-NFR12)

| ID | Cible |
|----|-------|
| NFR6 | Mots de passe hashés (bcrypt/argon2) |
| NFR7 | Données sensibles chiffrées AES-256 au repos |
| NFR8 | Transport TLS 1.3 obligatoire |
| NFR9 | Tokens JWT expiration < 24h |
| NFR10 | Audit log de toutes les modifications |
| NFR11 | Conformité RGPD (export, suppression) |
| NFR12 | Rate limiting API (anti-DDoS) |

### 7.3 Scalability (NFR13-NFR16)

| ID | Cible |
|----|-------|
| NFR13 | Support 5 000 utilisateurs simultanés par festival |
| NFR14 | Support 20 festivals actifs en parallèle |
| NFR15 | Pic de charge : 10x trafic normal pendant 1h |
| NFR16 | Dégradation gracieuse si surcharge (pas de crash) |

### 7.4 Reliability (NFR17-NFR21)

| ID | Cible |
|----|-------|
| NFR17 | Uptime 99.9% (hors maintenance planifiée) |
| NFR18 | 0 perte de transaction (même offline) |
| NFR19 | Recovery time < 1h après incident |
| NFR20 | Backup quotidien, rétention 30 jours |
| NFR21 | Sync offline → online 100% fiable |

### 7.5 Accessibility (NFR22-NFR25)

| ID | Cible |
|----|-------|
| NFR22 | Interface lisible (contraste, taille police) |
| NFR23 | Navigation intuitive (< 3 taps pour action principale) |
| NFR24 | Multi-langue (i18n) |
| NFR25 | Responsive (mobile, tablet, desktop) |

### 7.6 Integration (NFR26-NFR29)

| ID | Cible |
|----|-------|
| NFR26 | Stripe Connect : fallback Mollie si indisponible |
| NFR27 | Auth0 : fallback email/password si OAuth down |
| NFR28 | SMS : timeout 10 sec, retry 3x |
| NFR29 | Email : queue avec retry si échec |

**Total: 29 Non-Functional Requirements**

---

## 8. Architecture Technique

### 8.1 Stack

| Couche | Technologie |
|--------|-------------|
| **Backend** | Go + Gin + GORM |
| **Frontend Web** | React + TypeScript + Tailwind CSS |
| **Mobile** | React Native + Expo + NativeWind |
| **Database** | PostgreSQL (schema per tenant) |
| **Cache** | Redis |
| **Queue/Cron** | Asynq (Go natif, Redis-backed) |
| **Storage** | MinIO (dev) / S3 (prod) |
| **Auth** | Auth0 |
| **Email** | Postal (Docker) |
| **Maps** | MapLibre + OpenStreetMap |

### 8.2 Wallet & Ledger

```
Wallet = UserID + FestivalID + Balance + Currency + ExchangeRate
Transactions = Append-only ledger (jamais de modification directe)
```

- Monnaie virtuelle avec nom personnalisable (Griffons, Jetons, etc.)
- Transactions atomiques, idempotency keys
- Solde négatif impossible (transaction bloquée)

### 8.3 Offline-First Architecture

```
App Staff/Festivalier
├── SQLite local (transactions, tickets, wallet)
├── Queue de sync (transactions en attente)
├── Validation QR cryptographique (pas besoin serveur)
└── Sync automatique quand réseau OK
```

- Durée offline supportée : tout le festival si nécessaire
- Gestion conflits : priorité serveur, réconciliation auto, flag si solde négatif post-sync

### 8.4 Payment Provider Abstraction

```
Interface PaymentProvider
├── StripeConnectProvider (principal)
└── MollieConnectProvider (backup EU)
```

Architecture permettant de switcher sans refactoring majeur.

---

## 9. Sécurité & Conformité

### 9.1 Encryption & Auth

| Aspect | Standard |
|--------|----------|
| **Mots de passe** | bcrypt/argon2, min 12 caractères |
| **Données sensibles** | AES-256 au repos |
| **Transport** | TLS 1.3 obligatoire |
| **Tokens** | JWT, expiration < 24h |

### 9.2 Audit & Logging

| Exigence | Détail |
|----------|--------|
| **Audit Log** | TOUTES modifications utilisateurs + transactions |
| **Impersonation Log** | Qui, quand, quel user, quelles actions |
| **Historisation** | Soft delete, versioning données critiques |
| **Backups** | Sauvegardes régulières, testées, restaurables |

### 9.3 RGPD (Europe)

| Exigence | Implémentation |
|----------|----------------|
| **Consentement** | Opt-in explicite pour marketing |
| **Mineurs (< 16 ans)** | Consentement parental requis |
| **Droit d'accès** | Export données sur demande |
| **Droit suppression** | Anonymisation (soft delete) |
| **Portabilité** | Export JSON/CSV standard |

### 9.4 Conservation Données

| Type | Durée | Raison |
|------|-------|--------|
| Transactions financières | 10 ans | Obligation comptable |
| Données festivalier | 3 ans post-festival | Litige possible |
| Logs techniques | 1 an | Debug, sécurité |
| Backup juridique | Archivé séparé, chiffré | Contentieux |

### 9.5 Mineurs & Familles

| Règle | Implémentation |
|-------|----------------|
| Compte mineur | Lié à compte parent |
| Consentement | Parent valide création compte < 16 ans |
| Wallet | Parent peut gérer/recharger wallet enfant |
| Restrictions | Festival peut limiter produits (alcool interdit < 18 ans) |

---

## 10. Innovation & Différenciation

### 10.1 Offline-First Cashless (Innovation principale)

**Problème résolu :** Festivals = réseau saturé/inexistant, solutions existantes plantent.

**Notre approche :**
- SQLite local + queue de sync
- Validation QR cryptographique (sans serveur)
- Sync automatique + réconciliation

### 10.2 Permissions Multi-Rôles Combinées

**Innovation :** 1 user = N statuts, interface unifiée (pas de switch de mode)

**Exemple :** Marc (DJ + Barman + Orga) voit toutes ses sections dans une seule interface

### 10.3 SOS Festivalier Responsabilisé

| Feature | Détail |
|---------|--------|
| Envoi alerte | Position GPS auto |
| Feedback | "X personnes avant vous" (file d'attente) |
| Anti-spam | Rate limiting + avertissement légal |
| Responsabilisation | Facturation si abus |

### 10.4 Workflow Artiste Collaboratif

```
Artiste propose créneau → En attente
Artiste propose échange → Notif autre artiste
Autre artiste accepte → En attente validation orga
Orga valide → Publié
```

### 10.5 Validation des Innovations

| Innovation | Validation | Fallback |
|------------|------------|----------|
| Offline cashless | Tests charge, festivals pilotes | Mode online-only |
| Multi-rôles combinés | UX testing | Interface par onglets |
| SOS file d'attente | Tests terrain | Message générique |
| Workflow artiste | Feedback artistes | Assignation classique |

---

## 11. Gestion des Risques

### 11.1 Risques Identifiés

| Risque | Probabilité | Impact | Stratégie |
|--------|-------------|--------|-----------|
| Sync offline complexe | Medium | High | Tests charge + festival pilote |
| Dépendance Stripe | Low | High | Abstraction paiement + Mollie backup |
| Double-spend jetons | Medium | High | Transactions atomiques, idempotency keys |
| Fraude remboursement | Medium | Medium | Validation manuelle, audit trail |
| Adoption organisateurs | Medium | Medium | Premier festival gratuit/réduit |
| Abus SOS | Medium | Low | Rate limiting, avertissement légal, facturation |
| Fuite données | Low | High | Encryption, accès limité, logs |
| Impersonation malveillante | Low | Medium | Audit log complet, alertes |
| Chatbot exploité (futur) | Medium | High | Rate limiting, prompt injection detection, sandbox |

### 11.2 Stratégie MVP

| Aspect | Choix |
|--------|-------|
| **Approche** | Problem-solving MVP |
| **Objectif** | Prouver que l'offline cashless fonctionne |
| **Validation** | 1 festival pilote réel |

### 11.3 Roadmap Technique

```
Phase 1 (MVP)
├── Backend Go + PostgreSQL multi-tenant
├── Auth0 integration
├── Back-office React (admin)
├── Site vitrine React (public)
├── Billetterie + QR génération
├── App React Native (scan + cashless offline)
└── Docker dev environment

Phase 2
├── Dashboard financier
├── Carte interactive MapLibre
├── Système alertes sécurité
├── Gestion permissions avancée
└── SMS notifications

Phase 3
├── Gestion stocks
├── Archives médias (MinIO/S3)
├── Portail artiste avancé
├── Analytics
└── Kubernetes production
```

---

## Annexe: Journey Requirements Summary

| Parcours | Fonctionnalités clés |
|----------|---------------------|
| Festivalier | Site vitrine, billetterie, QR, wallet, cashless, remboursement |
| Festivalier SOS | Alertes urgence, anti-spam, avertissements légaux, feedback file |
| Barman/Food | App staff, mode offline, scan paiement, annulation |
| Scanner | Validation QR offline, politique re-entrée configurable, créneaux |
| Sécurité | GPS temps réel, alertes SOS, rapports incidents |
| Gestion Incidents | Historique, traçabilité, facturation abus |
| Orga Lineup | Gestion scènes, propositions artistes, validation |
| Artiste | Portail, fiche technique partagée, invitations guests |
| Staff Technique | Accès fiches techniques, checklist matériel |
| Orga Budget | Dashboard temps réel, prix dynamiques, remboursements, exports |
| Orga Communication | SMS crédit, email bidirectionnel, push ciblés |
| Super Admin | Multi-tenant, impersonation, facturation 1%, audit complet |
| Invité | Ticket gratuit, même expérience |

---

*Document généré le 2026-01-22 - Version 1.0*
