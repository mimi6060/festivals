# Performance Profiling Guide

This document describes how to profile the Festivals backend application for performance analysis and optimization.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Enabling Profiling](#enabling-profiling)
4. [CPU Profiling](#cpu-profiling)
5. [Memory Profiling](#memory-profiling)
6. [Trace Analysis](#trace-analysis)
7. [Continuous Profiling](#continuous-profiling)
8. [Production Profiling](#production-profiling)

## Overview

The application exposes pprof endpoints for runtime profiling. These endpoints allow you to collect:

- **CPU profiles**: Identify functions consuming the most CPU time
- **Memory profiles**: Track heap allocations and identify memory leaks
- **Goroutine profiles**: Analyze goroutine states and detect leaks
- **Block profiles**: Find synchronization bottlenecks
- **Mutex profiles**: Detect mutex contention
- **Execution traces**: Detailed runtime execution analysis

## Prerequisites

1. Go toolchain installed (for `go tool pprof` and `go tool trace`)
2. Graphviz (optional, for generating SVG visualizations)
3. curl or wget for fetching profiles

```bash
# Install graphviz (macOS)
brew install graphviz

# Install graphviz (Ubuntu)
apt-get install graphviz
```

## Enabling Profiling

### Development Environment

Profiling is enabled by default in development. The pprof endpoints are available at:

```
http://localhost:8080/debug/pprof/
```

### Configuration

Set the following environment variables to configure profiling:

```bash
# Enable/disable pprof endpoints
PPROF_ENABLED=true

# Custom prefix for pprof endpoints
PPROF_PREFIX=/debug/pprof

# Enable block profiling rate (default: 0 = disabled)
BLOCK_PROFILE_RATE=1

# Enable mutex profiling fraction (default: 0 = disabled)
MUTEX_PROFILE_FRACTION=1
```

### Code Integration

```go
import "github.com/mimi6060/festivals/backend/internal/infrastructure/profiling"

func main() {
    router := gin.Default()

    // Register pprof endpoints
    config := profiling.DefaultPProfConfig()
    profiling.RegisterPProf(router, config)

    // Or with authentication
    profiling.RegisterPProfWithAuth(router, config, "admin", "secret")
}
```

## CPU Profiling

### Using the Script

```bash
# Basic CPU profile (30 seconds)
./scripts/profiling/profile_cpu.sh

# Custom duration
PROFILE_DURATION=60 ./scripts/profiling/profile_cpu.sh

# Target different host
APP_HOST=prod-server APP_PORT=8080 ./scripts/profiling/profile_cpu.sh
```

### Manual Collection

```bash
# Collect 30-second CPU profile
curl http://localhost:8080/debug/pprof/profile?seconds=30 > cpu.prof

# Analyze interactively
go tool pprof cpu.prof

# Common pprof commands
(pprof) top         # Show top functions by CPU
(pprof) top -cum    # Show by cumulative time
(pprof) list func   # Show source for function
(pprof) web         # Open call graph in browser
(pprof) svg         # Generate SVG
```

### Identifying Hot Spots

1. Look at `flat` time for functions doing the most work
2. Look at `cum` time for functions responsible for the most CPU (including calls)
3. Use `list functionName` to see line-by-line CPU usage

### Example Analysis

```
(pprof) top
Showing nodes accounting for 1.5s, 100% of 1.5s total
      flat  flat%   sum%        cum   cum%
     0.80s 53.33% 53.33%      0.80s 53.33%  runtime.memmove
     0.30s 20.00% 73.33%      0.30s 20.00%  encoding/json.Marshal
     0.20s 13.33% 86.67%      0.50s 33.33%  database/sql.(*DB).Query
```

## Memory Profiling

### Using the Script

```bash
# Basic heap profile
./scripts/profiling/profile_memory.sh heap

# All memory profiles
./scripts/profiling/profile_memory.sh all

# Memory trend over time
./scripts/profiling/profile_memory.sh trend
```

### Manual Collection

```bash
# Heap profile (current allocations)
curl http://localhost:8080/debug/pprof/heap > heap.prof

# Allocs profile (all allocations since start)
curl http://localhost:8080/debug/pprof/allocs > allocs.prof

# Analyze
go tool pprof -inuse_space heap.prof  # By memory in use
go tool pprof -inuse_objects heap.prof # By object count
go tool pprof -alloc_space heap.prof   # By total allocated
```

### Finding Memory Leaks

1. Collect multiple heap profiles over time
2. Compare profiles using diff_base:

```bash
go tool pprof -diff_base=heap1.prof heap2.prof
```

3. Look for growing allocations that aren't being freed

### Memory Profile Types

| Flag | Description |
|------|-------------|
| `-inuse_space` | Memory currently in use (default) |
| `-inuse_objects` | Objects currently allocated |
| `-alloc_space` | Total memory allocated |
| `-alloc_objects` | Total objects allocated |

## Trace Analysis

### Using the Script

```bash
# Collect execution trace
./scripts/profiling/analyze_traces.sh trace

# Collect goroutine dump
./scripts/profiling/analyze_traces.sh goroutines

# All trace data
./scripts/profiling/analyze_traces.sh all
```

### Manual Collection

```bash
# Collect 5-second trace
curl http://localhost:8080/debug/pprof/trace?seconds=5 > trace.out

# Open trace viewer
go tool trace trace.out
```

### Trace Viewer Analysis

The trace viewer shows:

- **Goroutine Analysis**: Lifecycle of each goroutine
- **Network Blocking**: Time spent waiting for network I/O
- **Sync Blocking**: Time waiting on mutexes, channels
- **Syscall Blocking**: Time in system calls
- **GC Events**: Garbage collection pauses

### Key Metrics to Watch

1. **Scheduler Latency**: Time between goroutine ready and running
2. **GC Pause Time**: Stop-the-world pauses
3. **Syscall Duration**: Time in blocking syscalls
4. **Network Wait**: Time waiting for network responses

## Continuous Profiling

### Using Prometheus

The application exposes metrics at `/metrics`. Set up continuous profiling:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'festivals-backend'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:8080']
```

### Key Metrics

```promql
# P99 request latency
histogram_quantile(0.99, festivals_performance_request_latency_seconds_bucket)

# Memory usage
festivals_runtime_heap_alloc_bytes

# Goroutine count
festivals_runtime_goroutines

# Cache hit rate
festivals_performance_cache_hit_rate
```

### Grafana Dashboard

Import the dashboard from `dashboards/performance.json` for visualizations.

## Production Profiling

### Security Considerations

1. **Never expose pprof publicly** - Use authentication or internal-only access
2. **Use separate port** for pprof in production:

```go
// Run pprof on separate internal port
go func() {
    server := profiling.RegisterPProfStandalone(":6060")
    server.ListenAndServe()
}()
```

3. **Limit profile duration** to avoid resource exhaustion

### Best Practices

1. **Sample during load**: Profile during representative workloads
2. **Compare baseline**: Collect baseline profiles for comparison
3. **Profile incrementally**: Make one change at a time, profile after each
4. **Watch for overhead**: Profiling adds overhead, especially traces

### Production Commands

```bash
# Profile production via SSH tunnel
ssh -L 6060:localhost:6060 prod-server

# Then locally
./scripts/profiling/profile_cpu.sh -h localhost -p 6060
```

## Troubleshooting

### Profile is Empty

- Ensure the application is under load during profiling
- Check that pprof endpoints are enabled
- Verify network connectivity

### High Memory During Profiling

- Reduce trace duration
- Profile specific endpoints instead of entire application
- Use sampling instead of full traces

### Cannot Connect to pprof

```bash
# Check if pprof is running
curl http://localhost:8080/debug/pprof/

# Check firewall rules
# Verify APP_PORT and APP_HOST settings
```

## References

- [Go Blog: Profiling Go Programs](https://blog.golang.org/profiling-go-programs)
- [Go Diagnostics](https://golang.org/doc/diagnostics)
- [pprof Documentation](https://pkg.go.dev/net/http/pprof)
- [Trace Package](https://pkg.go.dev/runtime/trace)
