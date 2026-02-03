# Target Users & Permissions

## Système de Permissions Multi-Rôles

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

---

## Catégories et Statuts

| Catégorie | Statuts possibles |
|-----------|-------------------|
| **Admin** | Super Admin (accès total, multi-festivals) |
| **Organisation** | Budget, Lineup, Sponsors, Logistique, Site Vitrine, Communication |
| **Staff** | Scanner Entrée, Barman, Sécurité, Technicien Son, Technicien Lumière, Accueil |
| **Artiste** | DJ, Groupe, Artiste Solo |
| **Public** | Festivalier, Invité |

---

## Exemples de Combinaisons

```
┌─────────────────────────────────────────────────────┐
│  EXEMPLE : Marc                                      │
│  Statuts : [DJ] + [Barman] + [Organisateur Lineup]  │
│                                                      │
│  Permissions = DJ + Barman + Orga Lineup            │
│  ✅ Voir son horaire DJ                             │
│  ✅ Scanner paiements bar                           │
│  ✅ Modifier le lineup                              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  EXEMPLE : Sophie                                    │
│  Statuts : [Orga Budget] + [Orga Lineup] + [Admin]  │
│                                                      │
│  → Voit les finances ET le lineup ET tout le reste  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  EXEMPLE : Julie                                     │
│  Statuts : [Festivalière] + [Invitée]               │
│                                                      │
│  → Ticket gratuit + accès app normal                │
└─────────────────────────────────────────────────────┘
```

---

## Personas Principaux

### 🔧 Admin (Super Admin)
- Créé à l'initialisation de la DB
- Accès total à tous les festivals
- Gère les catégories et permissions

### 📋 Marie - Organisatrice
- Statuts : [Budget] + [Lineup]
- Voit finances ET artistes
- Dashboard complet de son périmètre

### 🍺 Marc - Multi-casquettes
- Statuts : [DJ] + [Barman] + [Orga Lineup]
- Joue en tant que DJ
- Aide au bar entre ses sets
- Participe à la programmation

### 🚨 Sophie - Sécurité
- Statuts : [Sécurité]
- Alerte équipe + secours
- Partage position GPS
- Bouton SOS

### 🎤 DJ Max - Artiste
- Statuts : [DJ]
- Portail artiste : horaires, fiche technique, RDV
- Peut inviter des guests (création Invités)

### 🎉 Julie - Festivalière classique
- Statuts : [Festivalier]
- Achète ticket, utilise cashless
- App mobile avec programme, carte, infos

### 🎁 Kevin - Invité
- Statuts : [Festivalier] + [Invité]
- Ticket gratuit (via artiste ou staff)
- Mêmes fonctionnalités que festivalier

---

## User Journeys

### Organisateur
1. Reçoit invitation par email (magic link ou Auth0)
2. Admin lui assigne catégorie [Organisation]
3. Accède au back-office selon ses statuts
4. Encode infos festival dans son périmètre

### Festivalier
1. Découvre le festival via site vitrine
2. Achète ticket → compte créé automatiquement [Festivalier]
3. Télécharge l'app (suggéré) ou imprime QR
4. Jour J : scan entrée, cashless, programme offline

### Invité
1. Artiste/Staff crée une invitation
2. Invité reçoit email avec QR gratuit
3. Même expérience que Festivalier

### Artiste
1. Orga Lineup l'ajoute avec statut [DJ/Groupe/Solo]
2. Reçoit accès portail artiste
3. Remplit fiche technique, confirme horaires
4. Peut créer des invitations pour ses guests
