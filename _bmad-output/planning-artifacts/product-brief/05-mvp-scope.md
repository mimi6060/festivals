# MVP Scope & Future Vision

## MVP (Phase 1) - Indispensable

| Feature | Détail | Offline |
|---------|--------|---------|
| **Back-office Admin** | Créer festival, tarifs, tickets, camping, VIP, goodies, suppléments | Non |
| **Site Vitrine** | Afficher le festival, attirer les visiteurs | Non |
| **Billetterie** | Achat tickets → QR code (app ou papier) | Non |
| **Cashless** | Paiements boissons/food | ✅ Oui |
| **Scan QR entrée** | Validation tickets | ✅ Oui |
| **Lineup basique** | Scènes, horaires artistes | ✅ Oui |

### Critères de succès MVP

- [ ] Un organisateur peut créer un festival complet
- [ ] Un festivalier peut acheter un ticket et recevoir son QR
- [ ] Le scan d'entrée fonctionne (même offline)
- [ ] Le paiement cashless fonctionne (même offline)
- [ ] Le lineup est consultable

---

## Phase 2 - Important

| Feature | Détail | Offline |
|---------|--------|---------|
| **App Festivalier complète** | Carte interactive, localisation bars/WC/scènes | ✅ Oui |
| **Dashboard financier** | Bénéfice temps réel, entrées, dépenses | Non |
| **Alertes sécurité** | Bouton SOS, partage position | Non |
| **Gestion équipe** | Rôles, permissions, planning staff | Non |

---

## Phase 3 - Nice to have

| Feature | Détail |
|---------|--------|
| **Gestion stocks** | Inventaire détaillé, alertes |
| **Archives/Souvenirs** | Photos, vidéos post-événement |
| **Portail artiste avancé** | Fiches techniques, RDV, invitations |
| **Notifications push** | Rappels, alertes artistes |
| **Statistiques avancées** | Analytics, rapports |

---

## Out of Scope (pour l'instant)

- Intégration comptabilité externe
- Multi-devises
- Marketplace de festivals
- Streaming vidéo live
- Gamification / badges

---

## Vision Future (2-3 ans)

Si le projet réussit :

1. **Plateforme SaaS** pour organisateurs de festivals
2. **Marketplace** où les festivaliers découvrent des événements
3. **Écosystème artistes** avec booking intégré
4. **Analytics avancés** pour optimiser les festivals
5. **API ouverte** pour intégrations tierces

---

## Roadmap Technique

```
Phase 1 (MVP)
├── Backend Go + PostgreSQL multi-tenant
├── Auth0 integration
├── Back-office React (admin)
├── Site vitrine React (public)
├── Billetterie + QR génération
├── App React Native (scan + cashless)
└── Docker dev environment

Phase 2
├── Dashboard financier
├── Carte interactive MapLibre
├── Système alertes sécurité
├── Gestion permissions avancée
└── SMS notifications (Twilio)

Phase 3
├── Gestion stocks
├── Archives médias (MinIO/S3)
├── Portail artiste
├── Analytics
└── Kubernetes production
```
