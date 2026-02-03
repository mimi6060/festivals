# Guide des Tests de Charge - Festivals Platform

Ce guide explique comment executer, interpreter et optimiser les tests de charge pour la plateforme Festivals.

## Table des Matieres

1. [Introduction](#introduction)
2. [Architecture de Test](#architecture-de-test)
3. [Types de Tests](#types-de-tests)
4. [Execution des Tests](#execution-des-tests)
5. [Interpretation des Resultats](#interpretation-des-resultats)
6. [Optimisation et Tuning](#optimisation-et-tuning)
7. [Integration CI/CD](#integration-cicd)
8. [Bonnes Pratiques](#bonnes-pratiques)

## Introduction

### Pourquoi les Tests de Charge?

Les tests de charge sont essentiels pour:
- **Valider la capacite**: S'assurer que le systeme supporte le trafic attendu
- **Identifier les goulots**: Trouver les points faibles avant la production
- **Prevenir les incidents**: Anticiper les problemes lors des pics de trafic
- **Planifier l'infrastructure**: Dimensionner correctement les ressources

### Contexte Festival

Un festival typique genere des pics de trafic specifiques:
- **Ouverture billetterie**: 10,000+ utilisateurs simultanees
- **Annonce lineup**: Pics de consultation
- **Jour J**: Paiements et scans intensifs
- **Rush alimentaire**: Pic paiements 12h-14h et 19h-21h

## Architecture de Test

### Stack Technologique

```
┌─────────────────────────────────────────────────────────┐
│                    k6 Load Generator                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │ Smoke   │  │  Load   │  │ Stress  │  │ Spike   │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │
└───────┼────────────┼────────────┼────────────┼─────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────┐
│                  API Gateway / Load Balancer             │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend Services                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │  Auth   │  │ Tickets │  │ Wallet  │  │ Lineup  │   │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│              Data Layer (PostgreSQL, Redis)              │
└─────────────────────────────────────────────────────────┘
```

### Metriques Collectees

| Categorie | Metrique | Description |
|-----------|----------|-------------|
| **Latence** | `http_req_duration` | Temps total requete |
| | `http_req_waiting` | Temps d'attente serveur (TTFB) |
| | `http_req_connecting` | Temps connexion TCP |
| **Debit** | `http_reqs` | Requetes par seconde |
| | `iterations` | Iterations par seconde |
| **Erreurs** | `http_req_failed` | Requetes echouees |
| | `checks` | Assertions echouees |
| **Ressources** | `vus` | Utilisateurs virtuels actifs |
| | `data_received` | Donnees recues |
| | `data_sent` | Donnees envoyees |

## Types de Tests

### 1. Smoke Test

**Objectif**: Verification rapide de sante

```javascript
export const options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};
```

**Quand l'executer**:
- Apres chaque deploiement
- Avant de lancer des tests plus lourds
- En monitoring continu

**Interpretation**:
- :white_check_mark: Tout vert: Systeme fonctionnel
- :x: Echec: Probleme critique, investiguer avant d'aller plus loin

### 2. Load Test

**Objectif**: Performance sous charge normale

```javascript
export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Warm up
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '3m', target: 100 },  // Peak load
    { duration: '2m', target: 100 },  // Sustain
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.001'],
  },
};
```

**Quand l'executer**:
- Avant chaque release
- Apres optimisations
- Hebdomadairement en staging

**Interpretation**:
- Comparer avec baseline precedent
- Identifier les endpoints lents
- Verifier la linearite de la charge

### 3. Stress Test

**Objectif**: Trouver les limites du systeme

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '2m', target: 400 },
    { duration: '2m', target: 500 },  // Max
    { duration: '2m', target: 0 },
  ],
};
```

**Metriques cles**:
- Point de saturation (quand les erreurs augmentent)
- Temps de recuperation apres pic
- Comportement de degradation gracieuse

### 4. Spike Test

**Objectif**: Resilience aux pics soudains

```javascript
export const options = {
  stages: [
    { duration: '30s', target: 10 },    // Baseline
    { duration: '10s', target: 1000 },  // SPIKE!
    { duration: '1m', target: 1000 },   // Hold
    { duration: '10s', target: 10 },    // Drop
    { duration: '1m', target: 10 },     // Recovery
  ],
};
```

**Points d'attention**:
- Temps de reaction de l'auto-scaling
- Erreurs pendant le spike
- Temps de retour a la normale

### 5. Soak Test

**Objectif**: Stabilite long terme

```javascript
export const options = {
  stages: [
    { duration: '5m', target: 50 },
    { duration: '110m', target: 50 },  // 2h sustained
    { duration: '5m', target: 0 },
  ],
};
```

**Detecter**:
- Fuites memoire
- Degradation progressive
- Problemes de connexions DB
- Accumulation de logs

## Execution des Tests

### Environnement Local

```bash
# Demarrer l'API locale
make dev-api

# Executer smoke test
BASE_URL=http://localhost:8080 k6 run tests/load/scripts/smoke.js
```

### Environnement Staging

```bash
# Via Make
make load-test

# Direct
BASE_URL=https://api-staging.festivals.app k6 run tests/load/scripts/load.js
```

### Avec Sortie Detaillee

```bash
# JSON pour analyse
k6 run --out json=results.json tests/load/scripts/load.js

# InfluxDB pour Grafana
k6 run --out influxdb=http://localhost:8086/k6 tests/load/scripts/load.js

# Cloud k6
K6_CLOUD_TOKEN=xxx k6 cloud tests/load/scripts/load.js
```

## Interpretation des Resultats

### Lecture du Resume k6

```
          /\      |‾‾| /‾‾/   /‾‾/
     /\  /  \     |  |/  /   /  /
    /  \/    \    |     (   /   ‾‾\
   /          \   |  |\  \ |  (‾)  |
  / __________ \  |__| \__\ \_____/ .io

  execution: local
     script: scripts/load.js
     output: -

  scenarios: (100.00%) 1 scenario, 100 max VUs, 10m30s max duration
           * default: Up to 100 looping VUs for 10m0s

running (10m00.0s), 000/100 VUs, 15234 complete and 0 interrupted iterations
default ✓ [======================================] 000/100 VUs  10m0s

     ✓ login successful
     ✓ festivals loaded
     ✓ wallet balance ok

     checks.........................: 99.87% ✓ 45702      ✗ 58
     data_received..................: 125 MB 208 kB/s
     data_sent......................: 12 MB  20 kB/s
     http_req_blocked...............: avg=1.2ms    min=0s      max=156ms
     http_req_connecting............: avg=0.8ms    min=0s      max=89ms
   ✓ http_req_duration..............: avg=45.2ms   min=12ms    max=892ms
       { expected_response:true }...: avg=44.8ms   min=12ms    max=456ms
   ✓ http_req_failed................: 0.05%  ✓ 23         ✗ 45679
     http_req_receiving.............: avg=0.3ms    min=0s      max=45ms
     http_req_sending...............: avg=0.1ms    min=0s      max=12ms
     http_req_tls_handshaking.......: avg=0.4ms    min=0s      max=67ms
     http_req_waiting...............: avg=44.8ms   min=11ms    max=891ms
     http_reqs......................: 45702  76.17/s
     iteration_duration.............: avg=1.2s     min=856ms   max=3.4s
     iterations.....................: 15234  25.39/s
     vus............................: 100    min=1        max=100
     vus_max........................: 100    min=100      max=100
```

### Indicateurs de Sante

| Indicateur | Bon | Acceptable | Probleme |
|------------|-----|------------|----------|
| p95 latence | <100ms | <200ms | >500ms |
| p99 latence | <200ms | <500ms | >1s |
| Error rate | <0.01% | <0.1% | >1% |
| Throughput | >target | ~target | <target |

### Analyse des Tendances

```
Latence dans le temps:
|
|     *****
|    *     *****
|   *           ****
|  *                 ***
| *                     **
+--------------------------> temps
   ↑                    ↑
  Ramp up            Saturation?
```

**Patterns a detecter**:
- **Lineaire**: Normal, scaling correct
- **Exponentiel**: Goulot d'etranglement
- **Plateau**: Resource saturee
- **Saw-tooth**: GC ou cache invalidation

## Optimisation et Tuning

### Cote Application

#### 1. Optimisation Base de Donnees

```sql
-- Identifier requetes lentes
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Ajouter index manquants
CREATE INDEX CONCURRENTLY idx_tickets_user_festival
ON tickets(user_id, festival_id);
```

#### 2. Optimisation Cache

```go
// Augmenter TTL cache pour donnees stables
cache.Set("festival:"+id, festival, 15*time.Minute)

// Utiliser cache-aside pattern
func GetFestival(id string) (*Festival, error) {
    if cached := cache.Get("festival:" + id); cached != nil {
        return cached.(*Festival), nil
    }
    festival, err := db.GetFestival(id)
    if err == nil {
        cache.Set("festival:"+id, festival, 10*time.Minute)
    }
    return festival, err
}
```

#### 3. Connection Pooling

```go
// Optimiser pool DB
db.SetMaxOpenConns(100)
db.SetMaxIdleConns(25)
db.SetConnMaxLifetime(5 * time.Minute)
```

### Cote Infrastructure

#### 1. Auto-scaling

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

#### 2. Rate Limiting

```nginx
# Nginx rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;

server {
    location /api/ {
        limit_req zone=api burst=200 nodelay;
    }
}
```

#### 3. CDN et Cache

```
                    ┌─────────────┐
   Utilisateurs ───►│     CDN     │
                    │ (static +   │
                    │  edge cache)│
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   API GW    │
                    │ (rate limit)│
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Backend   │
                    └─────────────┘
```

## Integration CI/CD

### Pipeline Recommande

```yaml
stages:
  - build
  - test
  - load-test
  - deploy

load-test:
  stage: load-test
  script:
    - k6 run --out json=results.json tests/load/scripts/smoke.js
  artifacts:
    paths:
      - results.json
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

### Seuils de Blocage

```javascript
// Dans les options k6
thresholds: {
  http_req_duration: [
    { threshold: 'p(95)<200', abortOnFail: true },
    { threshold: 'p(99)<500', abortOnFail: true },
  ],
  http_req_failed: [
    { threshold: 'rate<0.001', abortOnFail: true },
  ],
},
```

## Bonnes Pratiques

### Do's

- :white_check_mark: Executer smoke tests a chaque commit
- :white_check_mark: Conserver un historique des resultats
- :white_check_mark: Tester sur donnees realistes
- :white_check_mark: Inclure temps de reflexion realistes
- :white_check_mark: Monitorer l'infrastructure pendant les tests
- :white_check_mark: Documenter les baselines

### Don'ts

- :x: Tester en production sans precautions
- :x: Ignorer les erreurs "rares"
- :x: Utiliser des donnees identiques
- :x: Oublier le warm-up
- :x: Comparer des tests de durees differentes

### Checklist Pre-Test

- [ ] API cible accessible
- [ ] Donnees de test preparees
- [ ] Monitoring active
- [ ] Equipe informee (si prod/staging)
- [ ] Rollback plan pret
- [ ] Baseline defini

## Ressources

### Documentation
- [k6 Documentation](https://k6.io/docs/)
- [Performance Testing Guide](https://k6.io/docs/testing-guides/)

### Outils Complementaires
- [Grafana](https://grafana.com/) - Visualisation
- [InfluxDB](https://www.influxdata.com/) - Stockage metriques
- [Prometheus](https://prometheus.io/) - Monitoring

### Support
- Slack: #platform-performance
- Email: platform@festivals.app
