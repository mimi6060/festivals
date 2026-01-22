# Epic Stories - Festivals Platform MVP

**Author:** Michel
**Date:** 2026-01-22
**Version:** 1.0
**Based on:** PRD v1.0, Architecture v1.0

---

## Vue d'Ensemble MVP

### Objectif
Prouver que le cashless offline-first fonctionne avec un festival pilote réel.

### Épiques MVP (Phase 1)

| # | Épique | Stories | Points |
|---|--------|---------|--------|
| E1 | Infrastructure & Auth | 8 | 34 |
| E2 | Gestion Festival (Admin) | 12 | 48 |
| E3 | Site Vitrine & Billetterie | 10 | 42 |
| E4 | Wallet & Cashless | 14 | 58 |
| E5 | Scanner Entrée | 6 | 24 |
| E6 | Lineup Basique | 6 | 22 |
| E7 | App Mobile Festivalier | 8 | 32 |
| E8 | App Mobile Staff | 10 | 40 |
| **Total** | | **74** | **300** |

---

## E1: Infrastructure & Auth

### Description
Mise en place de l'infrastructure de base, authentification, et fondations multi-tenant.

### Stories

#### E1-S1: Setup Projet Backend
**En tant que** développeur
**Je veux** initialiser le projet Go avec la structure Clean Architecture
**Afin de** avoir une base solide pour le développement

**Critères d'acceptation:**
- [ ] Structure de dossiers selon architecture.md
- [ ] go.mod avec dépendances (Gin, GORM, Asynq)
- [ ] Dockerfile fonctionnel
- [ ] Makefile avec commandes dev/test/build
- [ ] README avec instructions setup

**Points:** 3

---

#### E1-S2: Setup Base de Données
**En tant que** développeur
**Je veux** configurer PostgreSQL avec support multi-tenant
**Afin de** isoler les données par festival

**Critères d'acceptation:**
- [ ] docker-compose avec PostgreSQL 16
- [ ] Système de migrations (golang-migrate)
- [ ] Script création schema par tenant
- [ ] Tables partagées dans schema public
- [ ] Tests de connexion multi-schema

**Points:** 5

---

#### E1-S3: Setup Redis
**En tant que** développeur
**Je veux** configurer Redis pour cache et queue
**Afin de** supporter les jobs asynchrones et le caching

**Critères d'acceptation:**
- [ ] docker-compose avec Redis 7
- [ ] Client Redis configuré
- [ ] Asynq server et client fonctionnels
- [ ] Tests de connexion

**Points:** 3

---

#### E1-S4: Intégration Auth0
**En tant que** utilisateur
**Je veux** me connecter via Auth0 (email/Google)
**Afin de** accéder de manière sécurisée à l'application

**Critères d'acceptation:**
- [ ] Auth0 tenant configuré
- [ ] Applications Auth0 (SPA, API)
- [ ] Middleware JWT validation
- [ ] Endpoint /me retourne user info
- [ ] Roles et permissions dans JWT

**Points:** 5

---

#### E1-S5: Multi-tenant Middleware
**En tant que** système
**Je veux** router les requêtes vers le bon schema festival
**Afin de** isoler les données entre festivals

**Critères d'acceptation:**
- [ ] Middleware extrait festival_id du JWT/URL
- [ ] SET search_path dynamique
- [ ] Context avec DB tenant-aware
- [ ] Tests avec 2 tenants différents

**Points:** 5

---

#### E1-S6: Setup Projet Frontend Admin
**En tant que** développeur
**Je veux** initialiser le projet React pour le back-office
**Afin de** avoir une base pour l'interface admin

**Critères d'acceptation:**
- [ ] Next.js 14+ avec App Router
- [ ] TypeScript configuré
- [ ] Tailwind CSS + shadcn/ui
- [ ] Auth0 React SDK
- [ ] Structure de dossiers selon architecture.md

**Points:** 3

---

#### E1-S7: Setup Projet Mobile
**En tant que** développeur
**Je veux** initialiser le projet React Native
**Afin de** avoir une base pour l'app mobile

**Critères d'acceptation:**
- [ ] Expo SDK 50+
- [ ] TypeScript configuré
- [ ] NativeWind (Tailwind)
- [ ] Expo Router
- [ ] SQLite (expo-sqlite)

**Points:** 5

---

#### E1-S8: CI/CD Pipeline
**En tant que** développeur
**Je veux** automatiser les tests et builds
**Afin de** assurer la qualité du code

**Critères d'acceptation:**
- [ ] GitHub Actions workflow
- [ ] Tests API automatisés
- [ ] Tests Frontend automatisés
- [ ] Build Docker automatisé
- [ ] Lint et format check

**Points:** 5

---

## E2: Gestion Festival (Admin)

### Description
Back-office pour créer et configurer un festival complet.

### Stories

#### E2-S1: CRUD Festival
**En tant que** Super Admin
**Je veux** créer, modifier et supprimer des festivals
**Afin de** gérer la plateforme

**Critères d'acceptation:**
- [ ] API POST/GET/PATCH/DELETE /festivals
- [ ] Création automatique du schema tenant
- [ ] Formulaire création festival (nom, dates, lieu)
- [ ] Liste des festivals avec statut

**Points:** 5

---

#### E2-S2: Configuration Festival
**En tant que** Organisateur
**Je veux** configurer les paramètres de mon festival
**Afin de** personnaliser l'expérience

**Critères d'acceptation:**
- [ ] Nom de la monnaie virtuelle
- [ ] Taux de change (1 jeton = X €)
- [ ] Politique de remboursement (auto/manuel/refus)
- [ ] Politique de re-entrée (unique/multiple)
- [ ] Logo et couleurs

**Points:** 5

---

#### E2-S3: Gestion Types de Billets
**En tant que** Organisateur
**Je veux** définir les types de billets disponibles
**Afin de** proposer différentes offres

**Critères d'acceptation:**
- [ ] CRUD types de billets
- [ ] Champs: nom, prix, quantité, dates validité
- [ ] Options (camping, parking, VIP)
- [ ] Activation/désactivation

**Points:** 5

---

#### E2-S4: Gestion Stands
**En tant que** Organisateur
**Je veux** créer les stands (bars, food, merch)
**Afin de** organiser les points de vente

**Critères d'acceptation:**
- [ ] CRUD stands
- [ ] Types: BAR, FOOD, MERCH, RECHARGE
- [ ] Nom, localisation (coords)
- [ ] Activation/désactivation

**Points:** 3

---

#### E2-S5: Gestion Produits
**En tant que** Organisateur
**Je veux** définir les produits vendus par stand
**Afin de** configurer les prix

**Critères d'acceptation:**
- [ ] CRUD produits
- [ ] Association à un stand
- [ ] Prix en monnaie virtuelle
- [ ] Taux TVA
- [ ] Stock (optionnel)
- [ ] Catégorie

**Points:** 5

---

#### E2-S6: Modification Prix Live
**En tant que** Organisateur Budget
**Je veux** modifier les prix en temps réel
**Afin de** faire des happy hours

**Critères d'acceptation:**
- [ ] Bouton "Happy Hour" (-X%)
- [ ] Modification prix individuel
- [ ] Historique des changements
- [ ] Sync immédiate vers les terminaux

**Points:** 5

---

#### E2-S7: Gestion Équipe Staff
**En tant que** Organisateur
**Je veux** inviter et gérer mon équipe
**Afin de** assigner les rôles

**Critères d'acceptation:**
- [ ] Invitation par email
- [ ] Assignation de rôles (Barman, Scanner, Sécurité)
- [ ] Assignation à un stand
- [ ] Activation/désactivation

**Points:** 5

---

#### E2-S8: Permissions Multi-Rôles
**En tant que** Système
**Je veux** combiner les permissions d'un utilisateur
**Afin de** supporter les multi-casquettes

**Critères d'acceptation:**
- [ ] User peut avoir N rôles
- [ ] Permissions additives
- [ ] Interface unifiée (pas de switch)
- [ ] Vérification permissions par endpoint

**Points:** 5

---

#### E2-S9: Dashboard Temps Réel
**En tant que** Organisateur
**Je veux** voir les statistiques en direct
**Afin de** suivre mon festival

**Critères d'acceptation:**
- [ ] Entrées (total, par heure)
- [ ] Transactions cashless (total, par stand)
- [ ] Revenus estimés
- [ ] WebSocket pour updates live

**Points:** 5

---

#### E2-S10: Export Données
**En tant que** Organisateur Budget
**Je veux** exporter les données financières
**Afin de** faire ma comptabilité

**Critères d'acceptation:**
- [ ] Export CSV transactions
- [ ] Export Excel avec TVA multi-taux
- [ ] Filtres par date, stand, type
- [ ] Téléchargement fichier

**Points:** 3

---

#### E2-S11: Impersonation
**En tant que** Super Admin
**Je veux** me connecter en tant qu'un autre utilisateur
**Afin de** débugger des problèmes

**Critères d'acceptation:**
- [ ] Bouton "Login As" sur user
- [ ] Bannière visible "Mode Impersonation"
- [ ] Toutes actions loguées
- [ ] Bouton "Quitter" pour revenir

**Points:** 3

---

#### E2-S12: Audit Log
**En tant que** Administrateur
**Je veux** voir l'historique des actions
**Afin de** tracer les modifications

**Critères d'acceptation:**
- [ ] Log automatique de toutes modifications
- [ ] Qui, quand, quoi (old/new values)
- [ ] Filtres par user, entité, date
- [ ] Export CSV

**Points:** 3

---

## E3: Site Vitrine & Billetterie

### Description
Site public pour présenter le festival et vendre les billets.

### Stories

#### E3-S1: Setup Site Vitrine
**En tant que** développeur
**Je veux** créer le site vitrine React
**Afin de** présenter le festival

**Critères d'acceptation:**
- [ ] Next.js avec SSG/ISR
- [ ] Responsive design
- [ ] SEO optimisé
- [ ] Chargement rapide (<3s)

**Points:** 3

---

#### E3-S2: Page Accueil
**En tant que** Visiteur
**Je veux** voir la page d'accueil du festival
**Afin de** découvrir l'événement

**Critères d'acceptation:**
- [ ] Hero avec image/vidéo
- [ ] Dates et lieu
- [ ] CTA "Acheter billets"
- [ ] Aperçu lineup
- [ ] Footer avec liens

**Points:** 3

---

#### E3-S3: Page Programme
**En tant que** Visiteur
**Je veux** voir le programme complet
**Afin de** savoir qui joue quand

**Critères d'acceptation:**
- [ ] Tabs par jour
- [ ] Liste artistes par scène
- [ ] Horaires
- [ ] Recherche artiste

**Points:** 3

---

#### E3-S4: Page Infos Pratiques
**En tant que** Visiteur
**Je veux** voir les infos pratiques
**Afin de** préparer ma venue

**Critères d'acceptation:**
- [ ] Plan du site
- [ ] Accès (transports, parking)
- [ ] Règlement
- [ ] FAQ

**Points:** 3

---

#### E3-S5: Intégration Stripe
**En tant que** système
**Je veux** intégrer Stripe Connect
**Afin de** recevoir les paiements

**Critères d'acceptation:**
- [ ] Stripe Connect account par festival
- [ ] API création PaymentIntent
- [ ] Webhook payment_succeeded
- [ ] Frais plateforme 1%

**Points:** 8

---

#### E3-S6: Formulaire Achat
**En tant que** Festivalier
**Je veux** acheter des billets
**Afin de** participer au festival

**Critères d'acceptation:**
- [ ] Sélection type de billet
- [ ] Sélection quantité
- [ ] Options (camping, parking)
- [ ] Récapitulatif
- [ ] Formulaire coordonnées

**Points:** 5

---

#### E3-S7: Paiement Stripe
**En tant que** Festivalier
**Je veux** payer par carte
**Afin de** finaliser mon achat

**Critères d'acceptation:**
- [ ] Stripe Elements intégré
- [ ] 3D Secure supporté
- [ ] Gestion erreurs paiement
- [ ] Page confirmation

**Points:** 5

---

#### E3-S8: Génération QR Code
**En tant que** Système
**Je veux** générer des QR codes sécurisés
**Afin de** créer les tickets

**Critères d'acceptation:**
- [ ] QR contient payload signé
- [ ] Signature HMAC avec clé festival
- [ ] Date expiration incluse
- [ ] QR unique par billet

**Points:** 5

---

#### E3-S9: Envoi Email Confirmation
**En tant que** Festivalier
**Je veux** recevoir mes billets par email
**Afin de** avoir mes QR codes

**Critères d'acceptation:**
- [ ] Email HTML avec design
- [ ] QR codes en pièces jointes
- [ ] Récapitulatif achat
- [ ] Infos pratiques

**Points:** 5

---

#### E3-S10: Page Mon Compte
**En tant que** Festivalier
**Je veux** voir mes achats
**Afin de** retrouver mes billets

**Critères d'acceptation:**
- [ ] Liste des commandes
- [ ] Téléchargement QR codes
- [ ] Détails par commande

**Points:** 2

---

## E4: Wallet & Cashless

### Description
Système de paiement cashless avec monnaie virtuelle.

### Stories

#### E4-S1: Création Wallet
**En tant que** Système
**Je veux** créer un wallet pour chaque festivalier
**Afin de** gérer leur solde

**Critères d'acceptation:**
- [ ] Wallet créé à l'achat du billet
- [ ] Solde initial 0
- [ ] Devise du festival
- [ ] API GET /me/wallet

**Points:** 3

---

#### E4-S2: Recharge CB (App)
**En tant que** Festivalier
**Je veux** recharger mon wallet via l'app
**Afin de** avoir des crédits

**Critères d'acceptation:**
- [ ] Sélection montant prédéfini
- [ ] Montant personnalisé
- [ ] Paiement Stripe
- [ ] Mise à jour solde immédiate

**Points:** 5

---

#### E4-S3: Recharge Caisse
**En tant que** Staff Recharge
**Je veux** recharger un wallet en caisse
**Afin de** accepter les espèces

**Critères d'acceptation:**
- [ ] Scan QR festivalier
- [ ] Saisie montant
- [ ] Méthode: espèces ou CB
- [ ] Confirmation et reçu

**Points:** 5

---

#### E4-S4: Paiement Staff
**En tant que** Barman/Food
**Je veux** encaisser un paiement
**Afin de** servir le client

**Critères d'acceptation:**
- [ ] Sélection produits
- [ ] Total calculé
- [ ] Scan QR client
- [ ] Validation si solde OK
- [ ] Refus si solde insuffisant

**Points:** 5

---

#### E4-S5: Transaction Atomique
**En tant que** Système
**Je veux** garantir l'intégrité des transactions
**Afin de** éviter les erreurs de solde

**Critères d'acceptation:**
- [ ] Transaction DB atomique
- [ ] Idempotency key obligatoire
- [ ] Balance_after calculé
- [ ] Rollback si erreur

**Points:** 5

---

#### E4-S6: Annulation Transaction
**En tant que** Barman/Food
**Je veux** annuler une transaction
**Afin de** corriger une erreur

**Critères d'acceptation:**
- [ ] Annulation dans les 5 minutes
- [ ] Remboursement immédiat
- [ ] Transaction type CANCEL
- [ ] Justification optionnelle

**Points:** 3

---

#### E4-S7: Historique Transactions
**En tant que** Festivalier
**Je veux** voir mon historique
**Afin de** suivre mes dépenses

**Critères d'acceptation:**
- [ ] Liste chronologique
- [ ] Type, montant, date, stand
- [ ] Solde après chaque transaction
- [ ] Pull-to-refresh

**Points:** 3

---

#### E4-S8: Demande Remboursement
**En tant que** Festivalier
**Je veux** demander le remboursement de mon solde
**Afin de** récupérer mon argent

**Critères d'acceptation:**
- [ ] Bouton "Demander remboursement"
- [ ] Saisie IBAN
- [ ] Confirmation demande
- [ ] Status visible (en attente/traité)

**Points:** 3

---

#### E4-S9: Traitement Remboursements
**En tant que** Organisateur Budget
**Je veux** traiter les demandes de remboursement
**Afin de** rembourser les festivaliers

**Critères d'acceptation:**
- [ ] Liste demandes en attente
- [ ] Approuver / Refuser
- [ ] Actions groupées
- [ ] Déclenchement virement (manuel)

**Points:** 3

---

#### E4-S10: SQLite Local (Offline)
**En tant que** App Mobile
**Je veux** stocker les données localement
**Afin de** fonctionner offline

**Critères d'acceptation:**
- [ ] Tables: wallets, transactions
- [ ] Sync initial au démarrage
- [ ] Stockage transactions locales
- [ ] Flag synced/pending

**Points:** 5

---

#### E4-S11: Queue Sync
**En tant que** App Mobile
**Je veux** mettre en queue les transactions offline
**Afin de** les synchroniser plus tard

**Critères d'acceptation:**
- [ ] Table sync_queue
- [ ] Ajout automatique si offline
- [ ] Retry avec backoff
- [ ] Gestion conflits

**Points:** 5

---

#### E4-S12: Sync Engine
**En tant que** App Mobile
**Je veux** synchroniser automatiquement
**Afin de** réconcilier les données

**Critères d'acceptation:**
- [ ] Détection connectivité
- [ ] Push pending transactions
- [ ] Pull fresh data
- [ ] Résolution conflits (server wins)

**Points:** 8

---

#### E4-S13: Indicateur Réseau
**En tant que** Utilisateur
**Je veux** voir l'état de la connexion
**Afin de** savoir si je suis offline

**Critères d'acceptation:**
- [ ] Indicateur visible en permanence
- [ ] Vert = en ligne
- [ ] Orange = sync en cours
- [ ] Rouge = offline

**Points:** 2

---

#### E4-S14: Transaction Offline Staff
**En tant que** Barman/Food
**Je veux** encaisser même sans réseau
**Afin de** ne pas bloquer le service

**Critères d'acceptation:**
- [ ] Validation sur cache local
- [ ] Transaction stockée localement
- [ ] Confirmation sonore
- [ ] Sync dès connexion revenue

**Points:** 5

---

## E5: Scanner Entrée

### Description
Validation des tickets à l'entrée du festival.

### Stories

#### E5-S1: Mode Scanner
**En tant que** Scanner Entrée
**Je veux** activer le mode scanner
**Afin de** valider les tickets

**Critères d'acceptation:**
- [ ] Accès caméra
- [ ] Interface dédiée scan
- [ ] Retour auto après scan

**Points:** 3

---

#### E5-S2: Validation QR Online
**En tant que** Scanner
**Je veux** valider un QR code
**Afin de** autoriser l'entrée

**Critères d'acceptation:**
- [ ] API POST /tickets/:id/scan
- [ ] Vérification status = VALID
- [ ] Marquer used_at
- [ ] Retourner type billet

**Points:** 5

---

#### E5-S3: Validation QR Offline
**En tant que** Scanner
**Je veux** valider un QR même offline
**Afin de** ne pas bloquer les entrées

**Critères d'acceptation:**
- [ ] Validation signature cryptographique
- [ ] Check cache local
- [ ] Marquer localement comme utilisé
- [ ] Sync à la reconnexion

**Points:** 8

---

#### E5-S4: Feedback Visuel
**En tant que** Scanner
**Je veux** voir clairement le résultat
**Afin de** agir rapidement

**Critères d'acceptation:**
- [ ] Écran vert + bip = VALIDE
- [ ] Écran rouge + buzzer = REFUSÉ
- [ ] Type billet affiché (VIP, camping)
- [ ] Raison refus affichée

**Points:** 3

---

#### E5-S5: Gestion Doublon
**En tant que** Scanner
**Je veux** voir si un ticket est déjà utilisé
**Afin de** refuser les fraudes

**Critères d'acceptation:**
- [ ] Message "Déjà utilisé"
- [ ] Heure premier scan affichée
- [ ] Log tentative

**Points:** 3

---

#### E5-S6: Stats Scanner
**En tant que** Scanner
**Je veux** voir les stats du jour
**Afin de** suivre mon activité

**Critères d'acceptation:**
- [ ] Total entrées validées
- [ ] Total refusées
- [ ] Par heure

**Points:** 2

---

## E6: Lineup Basique

### Description
Gestion et affichage du programme artistique.

### Stories

#### E6-S1: CRUD Scènes
**En tant que** Organisateur Lineup
**Je veux** créer les scènes
**Afin de** organiser le programme

**Critères d'acceptation:**
- [ ] Nom, capacité, localisation
- [ ] CRUD complet
- [ ] Liste des scènes

**Points:** 3

---

#### E6-S2: CRUD Artistes
**En tant que** Organisateur Lineup
**Je veux** ajouter des artistes
**Afin de** construire le lineup

**Critères d'acceptation:**
- [ ] Nom, type (DJ/Groupe/Solo)
- [ ] Photo (optionnel)
- [ ] CRUD complet

**Points:** 3

---

#### E6-S3: CRUD Créneaux
**En tant que** Organisateur Lineup
**Je veux** assigner des créneaux aux artistes
**Afin de** planifier le programme

**Critères d'acceptation:**
- [ ] Scène, artiste, début, fin
- [ ] Vérification pas de chevauchement
- [ ] Status (confirmé/annulé)

**Points:** 5

---

#### E6-S4: Affichage Programme Web
**En tant que** Visiteur
**Je veux** voir le programme sur le site
**Afin de** savoir qui joue quand

**Critères d'acceptation:**
- [ ] Tabs par jour
- [ ] Timeline par scène
- [ ] Nom artiste et horaires

**Points:** 5

---

#### E6-S5: Affichage Programme App
**En tant que** Festivalier
**Je veux** voir le programme dans l'app
**Afin de** ne rien rater

**Critères d'acceptation:**
- [ ] Vue similaire au web
- [ ] Disponible offline
- [ ] Recherche artiste

**Points:** 3

---

#### E6-S6: Favoris Artistes
**En tant que** Festivalier
**Je veux** marquer des artistes en favoris
**Afin de** les retrouver facilement

**Critères d'acceptation:**
- [ ] Bouton favori sur artiste
- [ ] Liste "Mes favoris"
- [ ] Stocké localement

**Points:** 3

---

## E7: App Mobile Festivalier

### Description
Application mobile pour les festivaliers.

### Stories

#### E7-S1: Onboarding
**En tant que** Festivalier
**Je veux** découvrir l'app au premier lancement
**Afin de** comprendre les fonctionnalités

**Critères d'acceptation:**
- [ ] 3 écrans explicatifs
- [ ] Skip possible
- [ ] Ne plus afficher après

**Points:** 2

---

#### E7-S2: Login Auth0
**En tant que** Festivalier
**Je veux** me connecter à l'app
**Afin de** accéder à mon compte

**Critères d'acceptation:**
- [ ] Login email/password
- [ ] Login Google
- [ ] Gestion token
- [ ] Logout

**Points:** 5

---

#### E7-S3: Écran Accueil
**En tant que** Festivalier
**Je veux** voir un résumé
**Afin de** avoir les infos essentielles

**Critères d'acceptation:**
- [ ] Solde wallet
- [ ] Prochains artistes
- [ ] Raccourcis (carte, bars, WC)

**Points:** 3

---

#### E7-S4: Écran Wallet
**En tant que** Festivalier
**Je veux** gérer mon wallet
**Afin de** voir mon solde et payer

**Critères d'acceptation:**
- [ ] Solde affiché grand
- [ ] QR code pour paiement
- [ ] Bouton recharger
- [ ] Historique récent

**Points:** 5

---

#### E7-S5: Écran Programme
**En tant que** Festivalier
**Je veux** consulter le programme
**Afin de** planifier ma journée

**Critères d'acceptation:**
- [ ] Tabs jours
- [ ] Liste par scène
- [ ] Favoris
- [ ] Recherche

**Points:** 5

---

#### E7-S6: Écran Carte
**En tant que** Festivalier
**Je veux** voir la carte du festival
**Afin de** me repérer

**Critères d'acceptation:**
- [ ] Carte interactive (MapLibre)
- [ ] Marqueurs: scènes, bars, WC, secours
- [ ] Ma position GPS
- [ ] Filtres par type

**Points:** 8

---

#### E7-S7: Écran Profil
**En tant que** Festivalier
**Je veux** voir mon profil
**Afin de** gérer mes infos

**Critères d'acceptation:**
- [ ] Nom, email
- [ ] Mes billets
- [ ] Demande remboursement
- [ ] Logout

**Points:** 3

---

#### E7-S8: Push Notifications
**En tant que** Festivalier
**Je veux** recevoir des notifications
**Afin de** être informé des news

**Critères d'acceptation:**
- [ ] Permission notifications
- [ ] Réception push
- [ ] Deep link vers écran concerné

**Points:** 3

---

## E8: App Mobile Staff

### Description
Modes spécialisés de l'app pour le staff.

### Stories

#### E8-S1: Switch Mode Staff
**En tant que** Staff
**Je veux** accéder à mon mode de travail
**Afin de** faire mon job

**Critères d'acceptation:**
- [ ] Détection rôles dans JWT
- [ ] Menu modes disponibles
- [ ] Switch entre modes

**Points:** 3

---

#### E8-S2: Mode Barman - Liste Produits
**En tant que** Barman
**Je veux** voir les produits de mon stand
**Afin de** servir les clients

**Critères d'acceptation:**
- [ ] Liste produits avec prix
- [ ] Catégories
- [ ] Sync offline

**Points:** 3

---

#### E8-S3: Mode Barman - Commande
**En tant que** Barman
**Je veux** créer une commande
**Afin de** encaisser

**Critères d'acceptation:**
- [ ] Sélection produits
- [ ] Quantités
- [ ] Total calculé
- [ ] Panier modifiable

**Points:** 5

---

#### E8-S4: Mode Barman - Scan Paiement
**En tant que** Barman
**Je veux** scanner le QR du client
**Afin de** débiter son wallet

**Critères d'acceptation:**
- [ ] Bouton "Scanner"
- [ ] Caméra pour QR
- [ ] Validation paiement
- [ ] Feedback succès/échec

**Points:** 5

---

#### E8-S5: Mode Barman - Annulation
**En tant que** Barman
**Je veux** annuler une transaction
**Afin de** corriger une erreur

**Critères d'acceptation:**
- [ ] Historique récent
- [ ] Bouton "Annuler"
- [ ] Confirmation
- [ ] Remboursement immédiat

**Points:** 3

---

#### E8-S6: Mode Scanner - Interface
**En tant que** Scanner Entrée
**Je veux** une interface dédiée au scan
**Afin de** être efficace

**Critères d'acceptation:**
- [ ] Plein écran caméra
- [ ] Retour auto après scan
- [ ] Flash activable

**Points:** 3

---

#### E8-S7: Mode Scanner - Validation
**En tant que** Scanner
**Je veux** voir le résultat du scan
**Afin de** autoriser ou refuser

**Critères d'acceptation:**
- [ ] Écran vert/rouge
- [ ] Son différent
- [ ] Type billet affiché
- [ ] Infos camping/VIP

**Points:** 5

---

#### E8-S8: Mode Caisse - Recharge
**En tant que** Staff Caisse
**Je veux** recharger les wallets
**Afin de** accepter les espèces

**Critères d'acceptation:**
- [ ] Scan QR festivalier
- [ ] Saisie montant
- [ ] Mode paiement (cash/CB)
- [ ] Confirmation

**Points:** 5

---

#### E8-S9: Offline Complet Staff
**En tant que** Staff
**Je veux** travailler sans réseau
**Afin de** ne jamais bloquer le service

**Critères d'acceptation:**
- [ ] Toutes fonctions staff offline
- [ ] Indicateur sync pending
- [ ] Sync automatique au retour réseau

**Points:** 5

---

#### E8-S10: Historique Staff
**En tant que** Staff
**Je veux** voir mon historique d'actions
**Afin de** vérifier mes transactions

**Critères d'acceptation:**
- [ ] Liste transactions du jour
- [ ] Total encaissé
- [ ] Nombre transactions

**Points:** 3

---

## Résumé des Points par Épique

| Épique | Points | % MVP |
|--------|--------|-------|
| E1: Infrastructure & Auth | 34 | 11% |
| E2: Gestion Festival | 48 | 16% |
| E3: Site Vitrine & Billetterie | 42 | 14% |
| E4: Wallet & Cashless | 58 | 19% |
| E5: Scanner Entrée | 24 | 8% |
| E6: Lineup Basique | 22 | 7% |
| E7: App Mobile Festivalier | 34 | 11% |
| E8: App Mobile Staff | 40 | 13% |
| **TOTAL MVP** | **302** | **100%** |

---

## Priorité de Développement

### Sprint 0 (Setup)
- E1-S1 à E1-S8: Infrastructure complète

### Sprint 1-2 (Backend Core)
- E2-S1 à E2-S5: Festival & produits
- E4-S1 à E4-S6: Wallet core

### Sprint 3-4 (Billetterie)
- E3-S1 à E3-S10: Site vitrine complet
- E5-S1 à E5-S6: Scanner entrée

### Sprint 5-6 (App Mobile)
- E7-S1 à E7-S8: App festivalier
- E8-S1 à E8-S10: App staff

### Sprint 7-8 (Offline & Polish)
- E4-S10 à E4-S14: Offline sync
- E6-S1 à E6-S6: Lineup
- E2-S6 à E2-S12: Admin avancé

---

*Document Epic Stories v1.0 - 2026-01-22*
