# Load Tests - Festivals Platform

Comprehensive K6 load testing suite for the Festivals Platform API.

## Structure

```
tests/load/
├── scripts/
│   ├── smoke.js              - Quick validation (10 users, 1 min)
│   ├── load.js               - Normal load (100 users, 10 min)
│   ├── stress.js             - Stress test (500 users, 15 min)
│   ├── spike.js              - Spike test (0→1000→0 users)
│   ├── soak.js               - Endurance (50 users, 2h)
│   ├── wallet_load.js        - Wallet operations load test
│   ├── transaction_load.js   - Transaction processing test
│   ├── api_stress.js         - API stress & rate limiting
│   ├── sync_load.js          - Device sync load test
│   └── scenarios/
│       ├── ticket-purchase.js  - Ticket purchase flow
│       ├── wallet-payment.js   - Wallet payment flow
│       ├── entry-scan.js       - Entry gate scanning
│       ├── mixed.js            - Mixed realistic traffic
│       ├── festival_day.js     - Full day simulation
│       ├── peak_hour.js        - Peak hour simulation
│       └── entry_rush.js       - Entry gate rush
├── lib/
│   ├── auth.js               - Authentication helpers
│   ├── data.js               - Data generators
│   └── checks.js             - Assertions and metrics
├── config/
│   ├── thresholds.json       - SLOs and thresholds
│   └── environments.json     - Environment URLs
├── grafana/                  - Grafana dashboards
├── results/                  - Test results output
├── docker-compose.load.yml   - K6 infrastructure
└── README.md
```

## Prerequisites

### Install K6

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows
choco install k6

# Docker
docker pull grafana/k6
```

## Quick Start

### Run Basic Tests

```bash
# Smoke test (quick validation)
k6 run tests/load/scripts/smoke.js

# Standard load test
k6 run tests/load/scripts/load.js

# With custom environment
BASE_URL=https://api-staging.festivals.app k6 run tests/load/scripts/load.js
```

### Run New Load Tests

```bash
# Wallet load test (100, 500, 1000 users)
k6 run tests/load/scripts/wallet_load.js

# With different load profile
LOAD_PROFILE=peak k6 run tests/load/scripts/wallet_load.js

# Transaction load test
k6 run tests/load/scripts/transaction_load.js

# API stress test
STRESS_LEVEL=high k6 run tests/load/scripts/api_stress.js

# Sync load test
k6 run tests/load/scripts/sync_load.js
```

### Run Scenario Tests

```bash
# Festival day simulation (16 min compressed)
k6 run tests/load/scripts/scenarios/festival_day.js

# Peak hour simulation (lunch/dinner rush)
PEAK_TYPE=dinner k6 run tests/load/scripts/scenarios/peak_hour.js

# Entry gate rush simulation
NUM_GATES=5 k6 run tests/load/scripts/scenarios/entry_rush.js
```

## Using Docker Infrastructure

### Start Monitoring Stack

```bash
cd tests/load

# Start InfluxDB and Grafana
docker-compose -f docker-compose.load.yml up -d influxdb grafana

# Access Grafana: http://localhost:3001 (admin/admin123)
```

### Run Tests with Metrics Export

```bash
# Run K6 with InfluxDB output
docker-compose -f docker-compose.load.yml run --rm k6 \
  run /scripts/wallet_load.js

# Or locally with InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 tests/load/scripts/wallet_load.js
```

### View Results in Grafana

1. Open http://localhost:3001
2. Login: admin / admin123
3. Navigate to K6 Load Test Dashboard
4. Select time range to view test results

### Stop Infrastructure

```bash
docker-compose -f docker-compose.load.yml down

# Remove volumes too
docker-compose -f docker-compose.load.yml down -v
```

## Test Descriptions

### Core Load Tests

| Test | Description | Duration | Max VUs |
|------|-------------|----------|---------|
| `smoke.js` | Quick validation | 1 min | 10 |
| `load.js` | Normal expected load | 10 min | 100 |
| `stress.js` | Find breaking point | 15 min | 500 |
| `spike.js` | Sudden traffic spike | 5 min | 1000 |
| `soak.js` | Long-term stability | 2 hours | 50 |

### Specialized Load Tests

| Test | Description | Focus |
|------|-------------|-------|
| `wallet_load.js` | Wallet operations | Top-up, payments, balance checks |
| `transaction_load.js` | Transaction processing | Atomicity, rollbacks, concurrency |
| `api_stress.js` | API stress testing | Rate limiting, degradation, recovery |
| `sync_load.js` | Device synchronization | Delta sync, conflicts, queues |

### Scenario Tests

| Test | Description | Simulation |
|------|-------------|------------|
| `festival_day.js` | Full festival day | 16 hours compressed to 16 min |
| `peak_hour.js` | Peak hour traffic | Lunch/dinner rush patterns |
| `entry_rush.js` | Entry gate rush | Gates opening scenario |

## SLO Targets

From `config/thresholds.json`:

### Payment Processing (Critical)
- p50 < 80ms
- p95 < 150ms
- p99 < 200ms
- Success rate > 99.9%

### Wallet Operations
- Balance check: p95 < 50ms
- Top-up: p95 < 300ms
- Transaction history: p95 < 200ms

### Entry Scanning
- Scan latency: p95 < 100ms
- Success rate > 99%
- Throughput: 60 scans/gate/minute

### Device Sync
- Delta sync: p95 < 300ms
- Full sync: p95 < 1000ms
- Conflict resolution: p95 < 1000ms

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | API base URL | `http://localhost:8080` |
| `FESTIVAL_ID` | Test festival ID | `fest_001` |
| `LOAD_PROFILE` | Load profile (standard/high/peak) | `standard` |
| `STRESS_LEVEL` | Stress level (low/medium/high/extreme) | `medium` |
| `PEAK_TYPE` | Peak type (lunch/dinner/custom) | `dinner` |
| `NUM_GATES` | Number of entry gates | `5` |

## Output Options

```bash
# Console summary (default)
k6 run tests/load/scripts/load.js

# JSON output
k6 run --out json=results/results.json tests/load/scripts/load.js

# CSV output
k6 run --out csv=results/results.csv tests/load/scripts/load.js

# InfluxDB (for Grafana)
k6 run --out influxdb=http://localhost:8086/k6 tests/load/scripts/load.js

# Multiple outputs
k6 run --out json=results.json --out influxdb=http://localhost:8086/k6 tests/load/scripts/load.js

# Grafana Cloud
K6_CLOUD_TOKEN=xxx k6 cloud tests/load/scripts/load.js
```

## Advanced Usage

### Custom VUs and Duration

```bash
k6 run --vus 50 --duration 5m tests/load/scripts/smoke.js
```

### Debug Mode

```bash
k6 run --http-debug tests/load/scripts/smoke.js
k6 run --http-debug="full" tests/load/scripts/smoke.js
```

### Tags for Filtering

```bash
k6 run --tag env=staging --tag version=1.0.0 tests/load/scripts/load.js
```

### Export Summary

```bash
k6 run --summary-export=summary.json tests/load/scripts/load.js
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Tests

on:
  workflow_dispatch:
    inputs:
      test_type:
        description: 'Test type'
        required: true
        default: 'smoke'
        type: choice
        options:
          - smoke
          - load
          - stress
          - wallet_load
          - transaction_load

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
            --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
            sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update && sudo apt-get install k6

      - name: Run load test
        env:
          BASE_URL: ${{ secrets.STAGING_API_URL }}
        run: |
          k6 run --summary-export=summary.json \
            tests/load/scripts/${{ github.event.inputs.test_type }}.js

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: summary.json
```

## Interpreting Results

### Key Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| `http_req_duration` | Request duration | p95 < 200ms |
| `http_req_failed` | Failed requests rate | < 1% |
| `iterations` | Completed iterations | - |
| `vus` | Active virtual users | - |

### Custom Metrics

| Metric | Description |
|--------|-------------|
| `payment_latency` | Payment processing time |
| `payment_success` | Payment success rate |
| `scan_latency` | Entry scan time |
| `sync_latency` | Sync operation time |

### Warning Signs

1. **p95 > threshold**: Performance degradation
2. **Error rate > 1%**: Stability issues
3. **Increasing latency over time**: Memory leaks
4. **503 errors**: Server overload

## Troubleshooting

### Connection Refused

```bash
# Verify API is accessible
curl -v $BASE_URL/health
```

### Rate Limiting

```bash
# Reduce VUs or add pauses
k6 run --vus 10 tests/load/scripts/smoke.js
```

### Timeouts

```bash
# Check network connectivity
# Increase timeout in script options
```

### Out of Memory

```bash
# Reduce number of VUs
# Use fewer concurrent scenarios
```

## Resources

- [K6 Documentation](https://k6.io/docs/)
- [K6 Extensions](https://k6.io/docs/extensions/)
- [Grafana Cloud K6](https://grafana.com/products/cloud/k6/)
- [K6 GitHub](https://github.com/grafana/k6)
