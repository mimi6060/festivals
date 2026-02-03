# Scaling Guide

This guide covers scaling strategies for the Festivals application in Kubernetes.

## Table of Contents

- [Scaling Overview](#scaling-overview)
- [Horizontal Pod Autoscaling (HPA)](#horizontal-pod-autoscaling-hpa)
- [Vertical Pod Autoscaling (VPA)](#vertical-pod-autoscaling-vpa)
- [Cluster Autoscaling](#cluster-autoscaling)
- [Database Scaling](#database-scaling)
- [Cache Scaling](#cache-scaling)
- [Load Testing](#load-testing)
- [Capacity Planning](#capacity-planning)

## Scaling Overview

### Components and Scaling Characteristics

| Component | Scaling Type | Min Replicas | Max Replicas | Primary Metric |
|-----------|--------------|--------------|--------------|----------------|
| API | Horizontal | 3 | 10 | CPU (70%) |
| Admin | Horizontal | 2 | 6 | CPU (70%) |
| Worker | Horizontal | 3 | 15 | CPU (60%) / Queue Depth |
| PostgreSQL | Vertical + Read Replicas | 1 | 3 | Connections |
| Redis | Horizontal (Cluster) | 3 | 6 | Memory |

## Horizontal Pod Autoscaling (HPA)

### API HPA Configuration

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: festivals-api-hpa
  namespace: festivals-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: prod-festivals-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
        - type: Pods
          value: 1
          periodSeconds: 60
      selectPolicy: Min
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 4
          periodSeconds: 15
      selectPolicy: Max
```

### Worker HPA with Custom Metrics

The worker can scale based on queue depth using custom metrics from Prometheus:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: festivals-worker-hpa
  namespace: festivals-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: prod-festivals-worker
  minReplicas: 3
  maxReplicas: 15
  metrics:
    # Resource-based metrics
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    # Custom metric for queue depth (requires prometheus-adapter)
    - type: External
      external:
        metric:
          name: asynq_queue_size
          selector:
            matchLabels:
              queue: default
        target:
          type: AverageValue
          averageValue: "100"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 600
      policies:
        - type: Percent
          value: 10
          periodSeconds: 120
      selectPolicy: Min
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30
        - type: Pods
          value: 5
          periodSeconds: 30
      selectPolicy: Max
```

### Prometheus Adapter Configuration

To use custom metrics for HPA, install and configure prometheus-adapter:

```yaml
# prometheus-adapter-config.yaml
rules:
  - seriesQuery: 'asynq_queue_size{namespace="festivals-production"}'
    resources:
      overrides:
        namespace:
          resource: namespace
    name:
      matches: "^(.*)$"
      as: "${1}"
    metricsQuery: 'sum(<<.Series>>{<<.LabelMatchers>>}) by (queue)'

  - seriesQuery: 'http_requests_total{namespace="festivals-production"}'
    resources:
      overrides:
        namespace:
          resource: namespace
        pod:
          resource: pod
    name:
      matches: "^(.*)_total$"
      as: "${1}_per_second"
    metricsQuery: 'sum(rate(<<.Series>>{<<.LabelMatchers>>}[2m])) by (<<.GroupBy>>)'
```

Install prometheus-adapter:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus-adapter prometheus-community/prometheus-adapter \
  --namespace monitoring \
  --values prometheus-adapter-config.yaml
```

### Checking HPA Status

```bash
# View HPA status
kubectl get hpa -n festivals-production

# Detailed HPA information
kubectl describe hpa festivals-api-hpa -n festivals-production

# Watch HPA scaling events
kubectl get hpa -n festivals-production -w

# Check metrics
kubectl top pods -n festivals-production
```

## Vertical Pod Autoscaling (VPA)

VPA automatically adjusts resource requests and limits based on usage.

### Install VPA

```bash
# Clone VPA repo
git clone https://github.com/kubernetes/autoscaler.git

# Install VPA
cd autoscaler/vertical-pod-autoscaler
./hack/vpa-up.sh
```

### VPA Configuration

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: festivals-api-vpa
  namespace: festivals-production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: prod-festivals-api
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
      - containerName: api
        minAllowed:
          cpu: 100m
          memory: 128Mi
        maxAllowed:
          cpu: 2000m
          memory: 2Gi
        controlledResources: ["cpu", "memory"]
```

### VPA Modes

| Mode | Description |
|------|-------------|
| `Off` | Only provides recommendations, no changes |
| `Initial` | Sets resources on pod creation only |
| `Recreate` | Recreates pods when resources need updating |
| `Auto` | Updates pods (recreate or in-place when supported) |

**Note**: Avoid using VPA and HPA together on the same metric (e.g., CPU).

## Cluster Autoscaling

### AWS EKS Cluster Autoscaler

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cluster-autoscaler
  template:
    metadata:
      labels:
        app: cluster-autoscaler
    spec:
      serviceAccountName: cluster-autoscaler
      containers:
        - name: cluster-autoscaler
          image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.28.0
          command:
            - ./cluster-autoscaler
            - --v=4
            - --stderrthreshold=info
            - --cloud-provider=aws
            - --skip-nodes-with-local-storage=false
            - --expander=least-waste
            - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/festivals-cluster
            - --balance-similar-node-groups
            - --scale-down-enabled=true
            - --scale-down-delay-after-add=10m
            - --scale-down-unneeded-time=10m
```

### GKE Cluster Autoscaler

GKE has built-in cluster autoscaling. Enable it via:

```bash
gcloud container clusters update festivals-cluster \
  --enable-autoscaling \
  --min-nodes=3 \
  --max-nodes=20 \
  --zone=us-central1-a
```

### Karpenter (AWS)

Karpenter provides faster and more efficient node scaling:

```yaml
apiVersion: karpenter.sh/v1alpha5
kind: Provisioner
metadata:
  name: default
spec:
  requirements:
    - key: kubernetes.io/arch
      operator: In
      values: ["amd64", "arm64"]
    - key: karpenter.sh/capacity-type
      operator: In
      values: ["on-demand", "spot"]
    - key: node.kubernetes.io/instance-type
      operator: In
      values: ["t3.medium", "t3.large", "t3.xlarge"]
  limits:
    resources:
      cpu: 100
      memory: 200Gi
  providerRef:
    name: default
  ttlSecondsAfterEmpty: 300
  ttlSecondsUntilExpired: 2592000
```

## Database Scaling

### PostgreSQL Read Replicas

For read-heavy workloads, add read replicas:

```yaml
# Using CloudNativePG operator
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: festivals-postgres
  namespace: festivals-production
spec:
  instances: 3
  primaryUpdateStrategy: unsupervised
  storage:
    size: 100Gi
    storageClass: fast-ssd
  resources:
    requests:
      memory: "2Gi"
      cpu: "1"
    limits:
      memory: "4Gi"
      cpu: "2"
  postgresql:
    parameters:
      max_connections: "300"
      shared_buffers: "512MB"
      effective_cache_size: "1536MB"
```

### Connection Pooling with PgBouncer

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgbouncer
  namespace: festivals-production
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: pgbouncer
          image: edoburu/pgbouncer:1.21.0
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: festivals-secrets
                  key: DATABASE_URL
            - name: POOL_MODE
              value: "transaction"
            - name: MAX_CLIENT_CONN
              value: "500"
            - name: DEFAULT_POOL_SIZE
              value: "25"
```

## Cache Scaling

### Redis Cluster

For high-availability and horizontal scaling:

```yaml
# Using Redis Operator
apiVersion: redis.redis.opstreelabs.in/v1beta1
kind: RedisCluster
metadata:
  name: festivals-redis
  namespace: festivals-production
spec:
  clusterSize: 3
  clusterVersion: v7
  persistenceEnabled: true
  resources:
    requests:
      cpu: 200m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 2Gi
  storage:
    volumeClaimTemplate:
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
```

### Redis Sentinel (High Availability)

```yaml
apiVersion: redis.redis.opstreelabs.in/v1beta1
kind: RedisSentinel
metadata:
  name: festivals-sentinel
  namespace: festivals-production
spec:
  replicas: 3
  clusterSize: 3
```

## Load Testing

### k6 Load Test Script

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

export default function () {
  // Health check
  const healthRes = http.get('https://api.festivals.app/health/ready');
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
  });

  // API endpoints
  const festivalRes = http.get('https://api.festivals.app/api/v1/festivals');
  check(festivalRes, {
    'festivals status is 200': (r) => r.status === 200,
    'festivals response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

### Running Load Tests

```bash
# Install k6
brew install k6

# Run load test
k6 run load-test.js

# Run with output to InfluxDB for Grafana visualization
k6 run --out influxdb=http://localhost:8086/k6 load-test.js
```

### Monitoring During Load Test

```bash
# Watch HPA scaling
watch -n 5 "kubectl get hpa -n festivals-production"

# Watch pod scaling
watch -n 5 "kubectl get pods -n festivals-production | grep festivals"

# Watch resource usage
watch -n 5 "kubectl top pods -n festivals-production"
```

## Capacity Planning

### Resource Estimation

Based on load testing, estimate resources per component:

| Component | vCPU/1000 RPS | Memory/1000 RPS | Pods/1000 RPS |
|-----------|---------------|-----------------|---------------|
| API | 0.5 | 256Mi | 2 |
| Admin | 0.2 | 128Mi | 1 |
| Worker | 0.3 | 256Mi | 2 |

### Scaling Formula

```
Required Pods = (Expected RPS / RPS per Pod) * Safety Factor

Example:
- Expected RPS: 5000
- RPS per API Pod: 500
- Safety Factor: 1.5

Required API Pods = (5000 / 500) * 1.5 = 15 pods
```

### Cost Optimization

1. **Use Spot/Preemptible Instances** for workers
2. **Right-size resources** using VPA recommendations
3. **Set aggressive scale-down** for off-peak hours
4. **Use Reserved Instances** for baseline capacity

### Scheduled Scaling

For predictable traffic patterns, use scheduled scaling:

```yaml
# Using KEDA
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: festivals-api-scheduled
  namespace: festivals-production
spec:
  scaleTargetRef:
    name: prod-festivals-api
  minReplicaCount: 3
  maxReplicaCount: 20
  triggers:
    - type: cron
      metadata:
        timezone: UTC
        start: "0 8 * * *"     # 8 AM
        end: "0 20 * * *"      # 8 PM
        desiredReplicas: "10"
    - type: cron
      metadata:
        timezone: UTC
        start: "0 20 * * *"    # 8 PM
        end: "0 8 * * *"       # 8 AM
        desiredReplicas: "3"
```

### Event-Based Scaling

For festival event days with expected traffic spikes:

```bash
# Scale up before event
kubectl scale deployment/prod-festivals-api --replicas=20 -n festivals-production

# Or use HPA min replicas
kubectl patch hpa festivals-api-hpa -n festivals-production \
  --type='json' -p='[{"op": "replace", "path": "/spec/minReplicas", "value": 10}]'
```

## Best Practices

1. **Always set resource requests and limits**
2. **Use Pod Disruption Budgets** to ensure availability
3. **Configure proper liveness and readiness probes**
4. **Use pod anti-affinity** to spread pods across nodes
5. **Monitor scaling events** and adjust thresholds
6. **Test scaling behavior** before production events
7. **Set up alerts** for scaling failures

## Troubleshooting

### HPA Not Scaling

```bash
# Check metrics-server
kubectl get pods -n kube-system | grep metrics-server

# Check if metrics are available
kubectl top pods -n festivals-production

# Check HPA events
kubectl describe hpa festivals-api-hpa -n festivals-production
```

### Slow Scale-Up

1. Check cluster autoscaler logs
2. Verify node capacity
3. Check for resource quotas
4. Review PodDisruptionBudget

### Pods Evicted During Scale-Down

1. Increase `stabilizationWindowSeconds`
2. Review `scaleDown.policies`
3. Check memory limits (OOMKilled)
