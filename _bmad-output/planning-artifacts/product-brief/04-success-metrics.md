# Success Metrics & KPIs

## Priorités Features

1. **Back-office Admin** : Tout configurable en DB, zéro hardcoded
2. **Billetterie** : Achat → QR code fonctionnel
3. **Cashless** : Paiements boissons/food rapides
4. **Lineup & Maps** : Navigation intuitive
5. **Reporting** : Visibilité financière temps réel
6. **Archives** : Souvenirs post-événement

---

## KPIs Techniques (Fiabilité & Performance)

| Métrique | Cible | Criticité |
|----------|-------|-----------|
| Paiements arrivés sur compte | 100% | 🔴 Critique |
| Transactions échouées silencieuses | 0 | 🔴 Critique |
| Crashes / Freezes | 0 | 🔴 Critique |
| Comportement inattendu | 0 | 🔴 Critique |
| Fuites mémoire | 0 | 🟠 Important |
| Temps réponse API | < 200ms | 🟠 Important |
| Fonctionnement offline | Scan + Paiement + Programme | 🔴 Critique |

---

## KPIs UX/UI

| Critère | Cible |
|---------|-------|
| Facilité d'utilisation | "Grand-mère friendly" |
| Boutons inutiles | 0 |
| CSS cassé / texte débordant | 0 |
| Vues intuitives | Navigation évidente |
| Multi-langue (i18n) | ✅ Chaque user dans SA langue |
| Responsive | Mobile, tablet, desktop |

---

## KPIs Satisfaction par Rôle

| Rôle | Besoin principal | Cible |
|------|------------------|-------|
| **Festivalier** | Achat → QR reçu | < 2 min |
| **Festivalier** | Trouver bars/WC/scènes | < 2 taps |
| **Festivalier** | Voir horaire artiste | < 2 taps |
| **Barman** | Scan → paiement validé | < 2 sec |
| **Food** | Scan → paiement validé | < 2 sec |
| **Sécurité** | Envoyer alerte | < 5 sec |
| **Artiste** | Voir son horaire | 1 tap |
| **Organisateur** | Dashboard bénéfice | Temps réel |

---

## KPIs Business (12 mois)

- Nombre de festivals actifs sur la plateforme
- % réduction temps d'entrée vs méthode papier
- Score satisfaction organisateur > 4/5
- Score satisfaction festivalier > 4/5

---

## Checklist Qualité

### Technique
- [ ] 100% des paiements arrivent sur le compte
- [ ] 0 bug silencieux sur les transactions
- [ ] Application ne freeze/crash jamais
- [ ] Fait exactement ce qu'on attend
- [ ] Pas de fuite mémoire
- [ ] Performance optimale

### UX/UI
- [ ] Simple, fluide, efficace
- [ ] Pas de boutons inutiles
- [ ] Vues pas trop serrées, intuitives
- [ ] Pas de CSS/texte qui déborde
- [ ] Multi-langue fonctionnel
