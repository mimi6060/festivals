# 🎉 Session Party Mode - Festivals

**Date:** 2026-01-21
**Sujet:** Vision produit Festivals - Plateforme de gestion de festivals

---

## Agents Présents

| Icon | Nom | Rôle | Style |
|------|-----|------|-------|
| 📋 | **John** | Product Manager | Demande "POURQUOI?" sans relâche, direct et tranchant |
| 🏗️ | **Winston** | Architecte | Calme et pragmatique, équilibre vision et réalité |
| 🎨 | **Sally** | UX Designer | Raconte des histoires utilisateur, empathique et créative |
| 💻 | **Amelia** | Développeuse Senior | Ultra-concise, parle en chemins de fichiers et specs |

---

## Discussion

### Tour 1 : Vision initiale

**📋 John** : Demande de prioriser - 8 produits en 1, c'est quoi le killer feature ?

**🎨 Sally** : Le vrai pain point = stress organisateur le jour J. Propose dashboard temps réel.

**🏗️ Winston** : Multi-tenant + billetterie/scan d'abord. Cashless phase 2.

**💻 Amelia** : Demande combien de festivals en parallèle ? Ça change le schéma DB.

---

### Tour 2 : Réponse de Michel

**Michel** :
- 5 à 50 festivals en parallèle
- App mobile iOS + Android obligatoire
- Suggestion : React Native ou Angular (web + mobile natif)
- Backend : Django pour performance et paiements sérieux (pas JS backend)
- PostgreSQL : oui
- Multi-tenant dès le jour 1 : "vaut mieux prévoir plusieurs festivals dès le départ"

---

### Tour 3 : Corrections de Michel

**Michel clarifications** :
- Backend : **Go** (pas Django/Python) pour la performance
- Frontend : **React** (web) + **React Native** (mobile natif)
- Ionic = non, car tourne dans navigateur, pas de vraies push notifications
- **Mode offline obligatoire** : zones sans réseau (champs, camping)
- QR validation doit marcher **sans connexion**
- QR papier en option pour ceux qui ne veulent pas l'app
- Site vitrine doit donner envie d'installer l'app (géolocalisation, maps)

**MVP obligatoire** :
1. ✅ Acheter des billets
2. ✅ Scanner QR codes (fonctionne offline)
3. ✅ Payer boissons/bouffe (cashless)
4. ✅ Infos festival : lineups, prix boissons, où manger/boire, adresse, artistes

**Peut attendre** :
- Gestion des stocks détaillée

**Dashboard financier (prioritaire)** :
- Argent rentré
- Argent dépensé
- Budget restant
- Bénéfice temps réel

---

### Tour 4 : Réactions des agents (stack corrigée)

*(Voir discussion ci-dessus)*

---

### Tour 5 : Correction des priorités

**Michel** : Le site vitrine et le back-office AVANT tout. Séquence logique :
1. Encoder les infos (back-office)
2. Afficher (site vitrine)
3. Vendre (billetterie)
4. Gérer le jour J

---

### Tour 6 : Infrastructure DevOps

**Michel - Exigences techniques** :

**Scripts de démarrage** :
- `startdev.sh` → Docker dev avec hot reload
- `start.sh` → Docker production
- Docker Compose pour orchestration

**Services Docker requis** :
- PostgreSQL (base de données)
- Redis (cache)
- MinIO (stockage S3 pour documents/images)
- Serveur mail (envoi emails)
- Auth0 (OAuth : Google, Facebook, réseaux sociaux)

**À évaluer** :
- RabbitMQ (message queue) ?
- Elasticsearch + Kibana (logs) ?

**Production/Scalabilité** :
- Scripts Kubernetes
- Gestion des secrets et clés API
- Monitoring complet

---

### Tour 7 : Réactions agents sur DevOps

*(Voir discussion ci-dessus)*

---

### Tour 8 : Ajouts Michel

**Services supplémentaires requis** :
- **Expo** pour tester React Native sur téléphone
- **Cartes gratuites** (alternative Google Maps) pour :
  - Rentrer des adresses facilement
  - Afficher les lieux sur une carte (scènes, bars, parking, camping)
- **SMS** pour notifications urgentes :
  - Rappel avant festival ("N'oubliez pas, c'est ce weekend !")
  - Annulation ou problème urgent
  - Numéro de téléphone = optionnel mais suggéré à l'inscription

---

### Tour 9 : Réactions agents (Maps + SMS)

*(Voir discussion ci-dessus)*

---

### Tour 10 : Tailwind CSS

**Michel** : Ajoute Tailwind CSS pour le styling web + NativeWind pour React Native.

---

## 🎉 FIN PARTY MODE

### Stack Technique Finale

| Catégorie | Technologie |
|-----------|-------------|
| **Backend** | Go + Gin + GORM |
| **Frontend** | React + TypeScript |
| **Styling** | Tailwind CSS |
| **Mobile** | React Native + Expo + NativeWind |
| **Database** | PostgreSQL (multi-tenant par schema) |
| **Cache** | Redis |
| **Storage** | MinIO (dev) / S3 (prod) |
| **Auth** | Auth0 (OAuth : Google, Facebook, etc.) |
| **Mail** | Mailpit (dev) / Resend ou Brevo (prod) |
| **SMS** | Twilio ou Brevo |
| **Maps** | MapLibre + OpenStreetMap |
| **Geocoding** | Nominatim |
| **Monitoring** | Loki + Grafana |
| **Dev** | Docker Compose + Expo + Hot reload |
| **Prod** | Kubernetes + Secrets management |

### Priorités Features

1. Back-office Admin (encoder festival, artistes, scènes, prix, équipe)
2. Site Vitrine (afficher le festival, style Tomorrowland)
3. Billetterie (vendre les tickets)
4. Dashboard financier (entrées, dépenses, bénéfices temps réel)
5. App Festivalier (lineup, maps, infos - offline ready)
6. Scan QR (entrées staff - offline)
7. Cashless (paiements bar/food - offline)
8. Gestion stocks détaillée

### Scripts DevOps

- `startdev.sh` → Docker dev avec hot reload
- `start.sh` → Docker production
- `k8s-deploy.sh` → Déploiement Kubernetes

