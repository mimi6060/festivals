# Monitoring and Observability Guide

This guide covers setting up monitoring, logging, and alerting for the Festivals platform.

## Overview

The monitoring stack consists of:

- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Loki** - Log aggregation
- **Alertmanager** - Alert routing and notifications

## Prometheus Setup

### Installation with Helm

```bash
# Add Prometheus community Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack (includes Prometheus, Grafana, Alertmanager)
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  -f prometheus-values.yaml
```

### Prometheus Values (`prometheus-values.yaml`)

```yaml
# prometheus-values.yaml
prometheus:
  prometheusSpec:
    retention: 15d
    retentionSize: "50GB"

    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: gp3
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 100Gi

    resources:
      requests:
        cpu: 500m
        memory: 2Gi
      limits:
        cpu: 2000m
        memory: 8Gi

    serviceMonitorSelector:
      matchLabels:
        release: prometheus

    additionalScrapeConfigs:
      - job_name: 'festivals-api'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - festivals-production
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
            action: replace
            target_label: __metrics_path__
            regex: (.+)
          - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
            action: replace
            regex: ([^:]+)(?::\d+)?;(\d+)
            replacement: $1:$2
            target_label: __address__

grafana:
  enabled: true
  adminPassword: "your-secure-password"

  persistence:
    enabled: true
    size: 10Gi

  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
        - name: 'default'
          orgId: 1
          folder: ''
          type: file
          disableDeletion: false
          editable: true
          options:
            path: /var/lib/grafana/dashboards

  dashboards:
    default:
      festivals-overview:
        gnetId: 1860
        revision: 27
        datasource: Prometheus

alertmanager:
  enabled: true
  config:
    global:
      resolve_timeout: 5m
      slack_api_url: 'https://hooks.slack.com/services/xxx/yyy/zzz'

    route:
      group_by: ['alertname', 'cluster', 'service']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 1h
      receiver: 'slack-notifications'
      routes:
        - match:
            severity: critical
          receiver: 'pagerduty-critical'
        - match:
            severity: warning
          receiver: 'slack-warnings'

    receivers:
      - name: 'slack-notifications'
        slack_configs:
          - channel: '#alerts'
            send_resolved: true
            title: '{{ template "slack.default.title" . }}'
            text: '{{ template "slack.default.text" . }}'

      - name: 'slack-warnings'
        slack_configs:
          - channel: '#alerts-warnings'
            send_resolved: true

      - name: 'pagerduty-critical'
        pagerduty_configs:
          - service_key: '<pagerduty-key>'
            send_resolved: true
```

### ServiceMonitor for Festivals API

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: festivals-api
  namespace: festivals-production
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: festivals
      app.kubernetes.io/component: api
  namespaceSelector:
    matchNames:
      - festivals-production
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
      scrapeTimeout: 10s
```

### Application Metrics

The API exposes these Prometheus metrics:

```go
// HTTP metrics
http_requests_total{method, path, status}
http_request_duration_seconds{method, path}
http_requests_in_flight

// Database metrics
db_connections_total
db_connections_active
db_query_duration_seconds{query}

// Redis metrics
redis_commands_total{command}
redis_command_duration_seconds{command}

// Queue metrics
queue_jobs_total{queue, status}
queue_job_duration_seconds{queue}
queue_jobs_pending{queue}

// Business metrics
tickets_sold_total{festival_id, ticket_type}
wallet_transactions_total{type}
active_users_total
```

## Grafana Setup

### Access Grafana

```bash
# Port forward to access Grafana
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring

# Get admin password
kubectl get secret prometheus-grafana -n monitoring -o jsonpath="{.data.admin-password}" | base64 -d
```

### Dashboard: Festivals Overview

```json
{
  "dashboard": {
    "title": "Festivals Platform Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{namespace=\"festivals-production\"}[5m])) by (service)",
            "legendFormat": "{{service}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{namespace=\"festivals-production\",status=~\"5..\"}[5m])) / sum(rate(http_requests_total{namespace=\"festivals-production\"}[5m])) * 100",
            "legendFormat": "Error %"
          }
        ]
      },
      {
        "title": "Response Time (P95)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace=\"festivals-production\"}[5m])) by (le, service))",
            "legendFormat": "{{service}}"
          }
        ]
      },
      {
        "title": "Active Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(db_connections_active{namespace=\"festivals-production\"})"
          }
        ]
      },
      {
        "title": "Queue Depth",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(queue_jobs_pending{namespace=\"festivals-production\"}) by (queue)",
            "legendFormat": "{{queue}}"
          }
        ]
      },
      {
        "title": "Tickets Sold Today",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(increase(tickets_sold_total{namespace=\"festivals-production\"}[24h]))"
          }
        ]
      }
    ]
  }
}
```

### Dashboard: API Performance

```json
{
  "dashboard": {
    "title": "API Performance",
    "panels": [
      {
        "title": "Requests by Endpoint",
        "type": "table",
        "targets": [
          {
            "expr": "topk(10, sum(rate(http_requests_total{namespace=\"festivals-production\"}[5m])) by (path))",
            "format": "table"
          }
        ]
      },
      {
        "title": "Slowest Endpoints (P99)",
        "type": "table",
        "targets": [
          {
            "expr": "topk(10, histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{namespace=\"festivals-production\"}[5m])) by (le, path)))",
            "format": "table"
          }
        ]
      },
      {
        "title": "Error Rate by Endpoint",
        "type": "table",
        "targets": [
          {
            "expr": "topk(10, sum(rate(http_requests_total{namespace=\"festivals-production\",status=~\"5..\"}[5m])) by (path))",
            "format": "table"
          }
        ]
      }
    ]
  }
}
```

## Log Aggregation

### Loki Installation

```bash
# Install Loki
helm install loki grafana/loki-stack \
  --namespace monitoring \
  -f loki-values.yaml
```

### Loki Values (`loki-values.yaml`)

```yaml
loki:
  enabled: true
  persistence:
    enabled: true
    size: 50Gi

  config:
    limits_config:
      retention_period: 168h  # 7 days

promtail:
  enabled: true
  config:
    clients:
      - url: http://loki:3100/loki/api/v1/push

    scrape_configs:
      - job_name: kubernetes-pods
        kubernetes_sd_configs:
          - role: pod
        pipeline_stages:
          - json:
              expressions:
                level: level
                msg: msg
                timestamp: time
          - labels:
              level:
          - timestamp:
              source: timestamp
              format: RFC3339Nano
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app_kubernetes_io_name]
            target_label: app
          - source_labels: [__meta_kubernetes_namespace]
            target_label: namespace
          - source_labels: [__meta_kubernetes_pod_name]
            target_label: pod
```

### Querying Logs in Grafana

```logql
# All logs from festivals API
{namespace="festivals-production", app="festivals-api"}

# Error logs only
{namespace="festivals-production"} |= "error"

# JSON parsed logs with level filter
{namespace="festivals-production"} | json | level="error"

# Logs containing specific user
{namespace="festivals-production"} | json | user_id="12345"

# Count errors per service
sum(count_over_time({namespace="festivals-production"} |= "error" [5m])) by (app)

# Latency from logs
{namespace="festivals-production"} | json | duration_ms > 1000
```

### Application Log Format

Ensure applications log in JSON format:

```json
{
  "time": "2024-01-15T10:30:00Z",
  "level": "info",
  "msg": "Request completed",
  "method": "GET",
  "path": "/api/festivals",
  "status": 200,
  "duration_ms": 45,
  "user_id": "12345",
  "request_id": "abc-123",
  "trace_id": "xyz-789"
}
```

## Alerting

### Alert Rules

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: festivals-alerts
  namespace: monitoring
  labels:
    release: prometheus
spec:
  groups:
    - name: festivals.availability
      rules:
        - alert: FestivalsAPIDown
          expr: up{job="festivals-api"} == 0
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "Festivals API is down"
            description: "Festivals API has been down for more than 1 minute"

        - alert: FestivalsHighErrorRate
          expr: |
            sum(rate(http_requests_total{namespace="festivals-production",status=~"5.."}[5m]))
            / sum(rate(http_requests_total{namespace="festivals-production"}[5m])) > 0.05
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "High error rate detected"
            description: "Error rate is above 5% for the last 5 minutes"

        - alert: FestivalsHighLatency
          expr: |
            histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace="festivals-production"}[5m])) by (le)) > 2
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "High latency detected"
            description: "P95 latency is above 2 seconds"

    - name: festivals.resources
      rules:
        - alert: FestivalsHighCPU
          expr: |
            sum(rate(container_cpu_usage_seconds_total{namespace="festivals-production"}[5m])) by (pod)
            / sum(kube_pod_container_resource_limits{namespace="festivals-production",resource="cpu"}) by (pod) > 0.9
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "High CPU usage"
            description: "Pod {{ $labels.pod }} CPU usage is above 90%"

        - alert: FestivalsHighMemory
          expr: |
            sum(container_memory_working_set_bytes{namespace="festivals-production"}) by (pod)
            / sum(kube_pod_container_resource_limits{namespace="festivals-production",resource="memory"}) by (pod) > 0.9
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "High memory usage"
            description: "Pod {{ $labels.pod }} memory usage is above 90%"

        - alert: FestivalsPodRestarting
          expr: increase(kube_pod_container_status_restarts_total{namespace="festivals-production"}[1h]) > 3
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Pod restarting frequently"
            description: "Pod {{ $labels.pod }} has restarted more than 3 times in the last hour"

    - name: festivals.database
      rules:
        - alert: FestivalsDatabaseConnectionHigh
          expr: db_connections_active{namespace="festivals-production"} / db_connections_total{namespace="festivals-production"} > 0.8
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Database connection pool nearly exhausted"
            description: "More than 80% of database connections are in use"

        - alert: FestivalsDatabaseSlowQueries
          expr: histogram_quantile(0.95, sum(rate(db_query_duration_seconds_bucket{namespace="festivals-production"}[5m])) by (le)) > 1
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Slow database queries detected"
            description: "P95 query latency is above 1 second"

    - name: festivals.queue
      rules:
        - alert: FestivalsQueueBacklog
          expr: queue_jobs_pending{namespace="festivals-production"} > 1000
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "Job queue backlog detected"
            description: "Queue {{ $labels.queue }} has more than 1000 pending jobs"

        - alert: FestivalsQueueStuck
          expr: increase(queue_jobs_total{namespace="festivals-production",status="completed"}[10m]) == 0 and queue_jobs_pending{namespace="festivals-production"} > 0
          for: 10m
          labels:
            severity: critical
          annotations:
            summary: "Job queue appears stuck"
            description: "No jobs completed in the last 10 minutes but jobs are pending"

    - name: festivals.business
      rules:
        - alert: FestivalsNoTicketSales
          expr: increase(tickets_sold_total{namespace="festivals-production"}[1h]) == 0
          for: 30m
          labels:
            severity: warning
          annotations:
            summary: "No ticket sales in the last hour"
            description: "No tickets have been sold in the last hour during business hours"

        - alert: FestivalsPaymentFailureHigh
          expr: |
            sum(rate(payment_transactions_total{namespace="festivals-production",status="failed"}[5m]))
            / sum(rate(payment_transactions_total{namespace="festivals-production"}[5m])) > 0.1
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "High payment failure rate"
            description: "More than 10% of payments are failing"
```

### Alertmanager Configuration

```yaml
# alertmanager-config.yaml
global:
  resolve_timeout: 5m
  slack_api_url: 'https://hooks.slack.com/services/xxx/yyy/zzz'
  pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'slack-notifications'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      continue: true
    - match:
        severity: critical
      receiver: 'slack-critical'
    - match:
        severity: warning
      receiver: 'slack-warnings'

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - channel: '#alerts'
        send_resolved: true
        icon_emoji: ':warning:'
        title: '{{ .Status | toUpper }}{{ if eq .Status "firing" }} - {{ .Alerts.Firing | len }}{{ end }}'
        text: >-
          {{ range .Alerts }}
          *Alert:* {{ .Annotations.summary }}
          *Description:* {{ .Annotations.description }}
          *Severity:* {{ .Labels.severity }}
          {{ end }}

  - name: 'slack-critical'
    slack_configs:
      - channel: '#alerts-critical'
        send_resolved: true
        icon_emoji: ':rotating_light:'

  - name: 'slack-warnings'
    slack_configs:
      - channel: '#alerts-warnings'
        send_resolved: true
        icon_emoji: ':warning:'

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - routing_key: '<your-pagerduty-integration-key>'
        send_resolved: true
        severity: critical
        description: '{{ .CommonAnnotations.summary }}'
        details:
          firing: '{{ template "pagerduty.default.instances" .Alerts.Firing }}'
          resolved: '{{ template "pagerduty.default.instances" .Alerts.Resolved }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'cluster', 'service']
```

## Distributed Tracing (Optional)

### Jaeger Installation

```bash
# Install Jaeger
helm install jaeger jaegertracing/jaeger \
  --namespace monitoring \
  --set collector.service.type=ClusterIP \
  --set query.service.type=ClusterIP \
  --set storage.type=elasticsearch \
  --set storage.elasticsearch.host=elasticsearch
```

### Application Configuration

Add OpenTelemetry to your application:

```go
// backend tracing setup
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace"
)

func initTracing() {
    exporter, _ := otlptrace.New(ctx,
        otlptrace.WithEndpoint("jaeger-collector:4317"),
        otlptrace.WithInsecure(),
    )

    tp := trace.NewTracerProvider(
        trace.WithBatcher(exporter),
        trace.WithResource(resource.NewWithAttributes(
            semconv.ServiceNameKey.String("festivals-api"),
        )),
    )

    otel.SetTracerProvider(tp)
}
```

## Runbook Commands

### Quick Diagnostics

```bash
# Check all pods status
kubectl get pods -n festivals-production

# Check resource usage
kubectl top pods -n festivals-production

# View recent events
kubectl get events -n festivals-production --sort-by='.lastTimestamp' | tail -20

# Check HPA status
kubectl get hpa -n festivals-production

# View Prometheus targets
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring
# Open http://localhost:9090/targets
```

### Common Issues

```bash
# High memory - check for memory leaks
kubectl logs deployment/prod-festivals-api -n festivals-production --tail=100 | grep -i "memory\|oom"

# High latency - check database connections
kubectl exec -it deployment/prod-festivals-api -n festivals-production -- /bin/sh -c "netstat -an | grep 5432 | wc -l"

# Queue stuck - check worker logs
kubectl logs deployment/prod-festivals-worker -n festivals-production --tail=100
```
