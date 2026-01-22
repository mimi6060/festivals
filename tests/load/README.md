# Load Tests - Festivals Platform

Ce dossier contient les tests de charge k6 pour la plateforme Festivals.

## Structure

```
tests/load/
├── scripts/
│   ├── smoke.js          - Test rapide (10 users, 1 min)
│   ├── load.js           - Test charge normale (100 users, 10 min)
│   ├── stress.js         - Test stress (500 users, 15 min)
│   ├── spike.js          - Test pics (0→1000→0 users)
│   ├── soak.js           - Test endurance (50 users, 2h)
│   └── scenarios/
│       ├── ticket-purchase.js  - Flow complet achat billet
│       ├── wallet-payment.js   - Flow paiement wallet
│       ├── entry-scan.js       - Scan entrées (staff)
│       └── mixed.js            - Mix réaliste multi-profils
├── lib/
│   ├── auth.js           - Helpers authentification
│   ├── data.js           - Générateurs de données
│   └── checks.js         - Assertions et métriques
├── config/
│   ├── thresholds.json   - Seuils de performance
│   └── environments.json - URLs par environnement
└── README.md
```

## Prerequis

1. Installer k6:
   ```bash
   # macOS
   brew install k6

   # Ubuntu/Debian
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6

   # Windows
   choco install k6

   # Docker
   docker pull grafana/k6
   ```

## Utilisation

### Commandes Make

```bash
# Test smoke rapide
make load-smoke

# Test de charge standard
make load-test

# Test de stress
make load-stress
```

### Execution directe

```bash
# Test smoke (local)
k6 run tests/load/scripts/smoke.js

# Test avec environnement specifique
BASE_URL=https://api-staging.festivals.app k6 run tests/load/scripts/load.js

# Test avec sortie JSON
k6 run --out json=results.json tests/load/scripts/load.js

# Test avec dashboard temps reel (Grafana Cloud)
K6_CLOUD_TOKEN=xxx k6 cloud tests/load/scripts/load.js
```

### Options utiles

```bash
# Modifier le nombre de VUs
k6 run --vus 50 --duration 5m tests/load/scripts/smoke.js

# Activer le mode debug
k6 run --http-debug tests/load/scripts/smoke.js

# Exporter le resume
k6 run --summary-export=summary.json tests/load/scripts/load.js

# Tags personnalises
k6 run --tag env=staging --tag version=1.0.0 tests/load/scripts/load.js
```

## Types de Tests

### Smoke Test (`smoke.js`)
- **But**: Verification rapide que le systeme fonctionne
- **Config**: 10 VUs, 1 minute
- **Quand**: A chaque commit, avant deploiement

### Load Test (`load.js`)
- **But**: Performance sous charge normale attendue
- **Config**: Ramp up jusqu'a 100 VUs, 10 minutes
- **Quand**: Avant release, apres changements significatifs

### Stress Test (`stress.js`)
- **But**: Trouver le point de rupture
- **Config**: Ramp up jusqu'a 500 VUs, 15 minutes
- **Quand**: Tests de capacite, planification infrastructure

### Spike Test (`spike.js`)
- **But**: Comportement lors de pics soudains
- **Config**: 0 → 1000 → 0 VUs rapidement
- **Quand**: Validation auto-scaling, resilience

### Soak Test (`soak.js`)
- **But**: Detecter fuites memoire et degradation
- **Config**: 50 VUs, 2 heures
- **Quand**: Avant releases majeures, periodiquement

## Scenarios Metier

### Ticket Purchase (`scenarios/ticket-purchase.js`)
Simule le parcours complet d'achat:
1. Login
2. Navigation festivals
3. Selection billets
4. Ajout panier
5. Checkout
6. Paiement
7. Confirmation

### Wallet Payment (`scenarios/wallet-payment.js`)
Simule les paiements sur site:
1. Login
2. Verification solde
3. Rechargement si necessaire
4. Paiements multiples
5. Historique transactions

### Entry Scan (`scenarios/entry-scan.js`)
Simule le controle d'entree:
1. Login staff
2. Scan QR codes rapides
3. Validation billets
4. Gestion re-entrees
5. Statistiques portail

### Mixed (`scenarios/mixed.js`)
Scenario realiste avec distribution:
- 30% Navigation
- 20% Lineup
- 15% Achats
- 15% Paiements
- 10% Rechargements
- 10% Autres

## Metriques Cibles

| Metrique | Smoke | Load | Stress |
|----------|-------|------|--------|
| p95 Response Time | <300ms | <200ms | <500ms |
| p99 Response Time | <500ms | <500ms | <1000ms |
| Error Rate | <1% | <0.1% | <5% |
| Throughput | - | >1000 req/s | - |

## Integration CI/CD

Les tests sont executes automatiquement via GitHub Actions:

- **Smoke**: A chaque push (quotidien)
- **Load**: A chaque release
- **Stress**: Manuellement

Declenchement manuel:
```bash
gh workflow run load-test.yml -f test_type=load -f environment=staging
```

## Interpretation des Resultats

### Metriques Cles

- `http_req_duration`: Temps de reponse HTTP
- `http_req_failed`: Taux d'erreur HTTP
- `iterations`: Nombre d'iterations completees
- `vus`: Virtual Users actifs

### Metriques Personnalisees

- `errors`: Taux d'erreur global
- `success`: Taux de succes
- `api_latency`: Latence API detaillee
- `*_latency`: Latence par operation

### Signaux d'Alerte

1. **p95 > seuil**: Degradation performance
2. **Error rate > 1%**: Probleme de stabilite
3. **Degradation temporelle**: Fuite memoire potentielle
4. **503 errors**: Surcharge serveur

## Troubleshooting

### Erreurs communes

**Connection refused**
```bash
# Verifier que l'API est accessible
curl -v $BASE_URL/health
```

**Rate limiting**
```bash
# Reduire le nombre de VUs ou ajouter des pauses
k6 run --vus 10 tests/load/scripts/smoke.js
```

**Timeouts**
```bash
# Augmenter le timeout dans les options
# Ou verifier la connectivite reseau
```

### Debug

```bash
# Mode verbose
k6 run --verbose tests/load/scripts/smoke.js

# Debug HTTP
k6 run --http-debug="full" tests/load/scripts/smoke.js

# Console output
k6 run --console-output tests/load/scripts/smoke.js
```

## Ressources

- [Documentation k6](https://k6.io/docs/)
- [k6 Extensions](https://k6.io/docs/extensions/)
- [Grafana Cloud k6](https://grafana.com/products/cloud/k6/)
- [k6 Examples](https://github.com/grafana/k6/tree/master/examples)
