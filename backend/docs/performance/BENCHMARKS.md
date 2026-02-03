# Benchmark Results

This document contains benchmark results for the Festivals backend application.

## Running Benchmarks

```bash
# Run all benchmarks
go test -bench=. ./tests/benchmark/...

# Run specific benchmark
go test -bench=BenchmarkWallet ./tests/benchmark/...

# With memory stats
go test -bench=. -benchmem ./tests/benchmark/...

# Multiple iterations for consistency
go test -bench=. -count=5 ./tests/benchmark/...

# Generate CPU profile during benchmark
go test -bench=. -cpuprofile=cpu.prof ./tests/benchmark/...

# Generate memory profile during benchmark
go test -bench=. -memprofile=mem.prof ./tests/benchmark/...
```

## Benchmark Categories

### 1. Wallet Operations

| Benchmark | Iterations | Time/op | Bytes/op | Allocs/op | Notes |
|-----------|------------|---------|----------|-----------|-------|
| BenchmarkWalletCreate | | | | | |
| BenchmarkWalletGet | | | | | |
| BenchmarkWalletTopUp | | | | | |
| BenchmarkWalletPayment | | | | | |
| BenchmarkWalletBalance | | | | | |
| BenchmarkWalletQRGenerate | | | | | |
| BenchmarkWalletQRValidate | | | | | |

### 2. Transaction Processing

| Benchmark | Iterations | Time/op | Bytes/op | Allocs/op | Notes |
|-----------|------------|---------|----------|-----------|-------|
| BenchmarkTransactionCreate | | | | | |
| BenchmarkTransactionList | | | | | |
| BenchmarkTransactionRefund | | | | | |
| BenchmarkBatchTransactions | | | | | |

### 3. Database Queries

| Benchmark | Iterations | Time/op | Bytes/op | Allocs/op | Notes |
|-----------|------------|---------|----------|-----------|-------|
| BenchmarkQueryWalletByID | | | | | |
| BenchmarkQueryWalletByUser | | | | | |
| BenchmarkQueryTransactions | | | | | |
| BenchmarkQueryWithPreload | | | | | |
| BenchmarkBulkInsert | | | | | |

### 4. Caching

| Benchmark | Iterations | Time/op | Bytes/op | Allocs/op | Notes |
|-----------|------------|---------|----------|-----------|-------|
| BenchmarkCacheGet | | | | | |
| BenchmarkCacheSet | | | | | |
| BenchmarkLRUCache | | | | | |
| BenchmarkTieredCache | | | | | |

### 5. Object Pooling

| Benchmark | Iterations | Time/op | Bytes/op | Allocs/op | Notes |
|-----------|------------|---------|----------|-----------|-------|
| BenchmarkBufferPoolGet | | | | | |
| BenchmarkSlicePoolGet | | | | | |
| BenchmarkWithoutPool | | | | | |

## Baseline Results

Record baseline benchmarks here before optimizations:

```
Date: YYYY-MM-DD
Go Version: go1.23
Hardware: [Describe hardware]

BenchmarkWalletCreate-8         [iterations]     [ns/op]    [B/op]     [allocs/op]
BenchmarkWalletGet-8            [iterations]     [ns/op]    [B/op]     [allocs/op]
...
```

## Optimization History

### Optimization 1: [Title]

**Date**: YYYY-MM-DD

**Change**: Describe what was changed

**Before**:
```
BenchmarkXxx-8    10000    100000 ns/op    1024 B/op    10 allocs/op
```

**After**:
```
BenchmarkXxx-8    50000     20000 ns/op     256 B/op     2 allocs/op
```

**Improvement**: 5x faster, 75% less memory, 80% fewer allocations

---

### Optimization 2: [Title]

**Date**: YYYY-MM-DD

**Change**: Describe what was changed

**Before**:
```
...
```

**After**:
```
...
```

**Improvement**: ...

---

## Comparison Commands

```bash
# Compare with baseline
go test -bench=. ./tests/benchmark/... > new.txt
benchstat baseline.txt new.txt

# Save baseline
go test -bench=. -count=10 ./tests/benchmark/... > baseline.txt
```

## Performance Targets

| Operation | Target | Actual | Status |
|-----------|--------|--------|--------|
| Wallet Creation | < 5ms | | |
| Wallet Lookup | < 1ms | | |
| Payment Processing | < 10ms | | |
| Transaction List | < 5ms | | |
| QR Code Generation | < 2ms | | |
| Cache Hit | < 100us | | |
| Cache Miss + DB | < 5ms | | |

## Load Test Results

### Scenario 1: Normal Load

```
Duration: 60s
Virtual Users: 100
Requests/sec: 1000

Results:
- P50 Latency: XX ms
- P90 Latency: XX ms
- P99 Latency: XX ms
- Error Rate: X%
- Throughput: XXXX req/s
```

### Scenario 2: Peak Load

```
Duration: 60s
Virtual Users: 500
Requests/sec: 5000

Results:
- P50 Latency: XX ms
- P90 Latency: XX ms
- P99 Latency: XX ms
- Error Rate: X%
- Throughput: XXXX req/s
```

### Scenario 3: Stress Test

```
Duration: 300s
Virtual Users: 1000
Ramp-up: 60s

Results:
- Max Throughput: XXXX req/s
- Breaking Point: XXXX concurrent users
- Recovery Time: XX seconds
```

## Notes

- Benchmarks should be run on consistent hardware
- Run multiple iterations for statistical significance
- Consider warm-up runs before measuring
- Test with realistic data sizes
- Include both hot path (cached) and cold path (uncached) scenarios

## Tools

- `go test -bench` - Go's built-in benchmark tool
- `benchstat` - Statistical comparison of benchmarks
- `pprof` - Profile CPU and memory during benchmarks
- `k6` or `wrk` - Load testing tools
- `hey` - HTTP load generator
