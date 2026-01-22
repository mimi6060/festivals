# Kubernetes Deployment Guide

This guide covers deploying the Festivals application to Kubernetes clusters.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [Deployment Options](#deployment-options)
- [Kustomize Deployment](#kustomize-deployment)
- [Helm Deployment](#helm-deployment)
- [Configuration](#configuration)
- [Secrets Management](#secrets-management)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

```bash
# kubectl (v1.28+)
brew install kubectl

# Kustomize (v5.0+)
brew install kustomize

# Helm (v3.12+)
brew install helm

# Optional: k9s for cluster management
brew install derailed/k9s/k9s
```

### Cluster Requirements

- Kubernetes 1.28+
- nginx-ingress controller
- cert-manager (for automatic TLS)
- metrics-server (for HPA)
- Minimum 3 nodes for production (for pod anti-affinity)

## Architecture Overview

```
                    ┌──────────────────┐
                    │   Ingress        │
                    │   (nginx)        │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ API Service │  │Admin Service│  │Worker Service│
    │  (Go)       │  │ (Next.js)   │  │  (Asynq)    │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                │                │
           └────────────────┼────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
        ┌──────────┐ ┌──────────┐  ┌──────────┐
        │PostgreSQL│ │  Redis   │  │    S3    │
        └──────────┘ └──────────┘  └──────────┘
```

## Directory Structure

```
k8s/
├── base/                      # Base manifests
│   ├── kustomization.yaml     # Kustomize configuration
│   ├── namespace.yaml         # Namespace definition
│   ├── api-deployment.yaml    # API deployment
│   ├── api-service.yaml       # API service
│   ├── admin-deployment.yaml  # Admin deployment
│   ├── admin-service.yaml     # Admin service
│   ├── worker-deployment.yaml # Worker deployment
│   ├── ingress.yaml           # Ingress + NetworkPolicies
│   ├── configmap.yaml         # Non-sensitive config
│   └── secrets.yaml           # Secrets template
├── overlays/
│   ├── staging/               # Staging overrides
│   │   ├── kustomization.yaml
│   │   ├── replicas-patch.yaml
│   │   └── ingress-patch.yaml
│   └── production/            # Production overrides
│       ├── kustomization.yaml
│       ├── replicas-patch.yaml
│       ├── ingress-patch.yaml
│       └── hpa.yaml           # Horizontal Pod Autoscaler
└── README.md
```

## Deployment Options

### Option 1: Kustomize (Recommended)

Kustomize is built into kubectl and provides a simple overlay system.

### Option 2: Helm

Helm provides more flexibility with templating and package management.

### Option 3: ArgoCD

GitOps-based deployment with automatic sync and rollback capabilities.

## Kustomize Deployment

### Deploy to Staging

```bash
# Preview manifests
kustomize build k8s/overlays/staging

# Apply to cluster
kubectl apply -k k8s/overlays/staging

# Or use kubectl directly
kustomize build k8s/overlays/staging | kubectl apply -f -
```

### Deploy to Production

```bash
# Preview manifests
kustomize build k8s/overlays/production

# Apply to cluster
kubectl apply -k k8s/overlays/production
```

### Verify Deployment

```bash
# Check deployment status
kubectl get deployments -n festivals-production

# Check pod status
kubectl get pods -n festivals-production

# Check services
kubectl get services -n festivals-production

# Check ingress
kubectl get ingress -n festivals-production
```

### Update Image Tag

```bash
cd k8s/overlays/production

# Update image tag
kustomize edit set image ghcr.io/festivals/api=ghcr.io/festivals/api:v1.2.0

# Apply changes
kubectl apply -k .
```

## Helm Deployment

### Install Dependencies

```bash
cd helm/festivals

# Add Bitnami repository for PostgreSQL and Redis
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Download dependencies
helm dependency update
```

### Deploy to Staging

```bash
helm upgrade --install festivals-staging ./helm/festivals \
  --namespace festivals-staging \
  --create-namespace \
  --values helm/festivals/values.yaml \
  --set namespace.name=festivals-staging \
  --set config.appEnv=staging \
  --set api.replicaCount=1 \
  --set admin.replicaCount=1 \
  --set worker.replicaCount=1 \
  --set ingress.hosts.api.host=api.staging.festivals.app \
  --set ingress.hosts.admin.host=admin.staging.festivals.app
```

### Deploy to Production

```bash
helm upgrade --install festivals-prod ./helm/festivals \
  --namespace festivals-production \
  --create-namespace \
  --values helm/festivals/values.yaml \
  --set namespace.name=festivals-production \
  --set config.appEnv=production \
  --set api.replicaCount=3 \
  --set admin.replicaCount=2 \
  --set worker.replicaCount=3
```

### Using Values File

Create environment-specific values files:

```bash
# values-staging.yaml
helm upgrade --install festivals-staging ./helm/festivals \
  --namespace festivals-staging \
  --values helm/festivals/values.yaml \
  --values helm/festivals/values-staging.yaml

# values-production.yaml
helm upgrade --install festivals-prod ./helm/festivals \
  --namespace festivals-production \
  --values helm/festivals/values.yaml \
  --values helm/festivals/values-production.yaml
```

### Rollback

```bash
# List releases
helm history festivals-prod -n festivals-production

# Rollback to previous version
helm rollback festivals-prod -n festivals-production

# Rollback to specific revision
helm rollback festivals-prod 3 -n festivals-production
```

## Configuration

### ConfigMap Values

Non-sensitive configuration is stored in ConfigMaps:

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_ENV` | Environment (staging/production) | production |
| `LOG_LEVEL` | Log verbosity | info |
| `LOG_FORMAT` | Log format (json/text) | json |
| `DB_HOST` | Database hostname | postgres-service |
| `DB_PORT` | Database port | 5432 |
| `REDIS_HOST` | Redis hostname | redis-service |
| `REDIS_PORT` | Redis port | 6379 |

### Environment Variables

Each pod receives these environment variables:

```yaml
env:
  - name: POD_NAME
    valueFrom:
      fieldRef:
        fieldPath: metadata.name
  - name: POD_NAMESPACE
    valueFrom:
      fieldRef:
        fieldPath: metadata.namespace
  - name: POD_IP
    valueFrom:
      fieldRef:
        fieldPath: status.podIP
```

## Secrets Management

### Option 1: Kubernetes Secrets (Development)

```bash
# Create secrets from file
kubectl create secret generic festivals-secrets \
  --from-env-file=.env.production \
  -n festivals-production
```

### Option 2: Sealed Secrets (Recommended for GitOps)

```bash
# Install sealed-secrets controller
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system

# Seal a secret
kubeseal --format yaml < k8s/base/secrets.yaml > k8s/base/sealed-secrets.yaml
```

### Option 3: External Secrets Operator

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: festivals-secrets
  namespace: festivals-production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secretsmanager
    kind: ClusterSecretStore
  target:
    name: festivals-secrets
  data:
    - secretKey: DB_PASSWORD
      remoteRef:
        key: festivals/production/database
        property: password
```

### Option 4: HashiCorp Vault

```yaml
apiVersion: secrets.hashicorp.com/v1beta1
kind: VaultStaticSecret
metadata:
  name: festivals-secrets
  namespace: festivals-production
spec:
  vaultAuthRef: default
  mount: kv-v2
  type: kv-v2
  path: festivals/production
  destination:
    name: festivals-secrets
    create: true
```

## Monitoring

### Prometheus Metrics

All pods expose Prometheus metrics:

- **API**: Port 9090, path `/metrics`
- **Admin**: Port 3000, path `/api/metrics`
- **Worker**: Port 9090, path `/metrics`

### ServiceMonitor (Prometheus Operator)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: festivals-api
  namespace: festivals-production
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: festivals
      app.kubernetes.io/component: api
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
```

### Grafana Dashboards

Import the following dashboards:

1. **API Dashboard**: Request rates, latencies, error rates
2. **Worker Dashboard**: Queue depths, processing times
3. **Infrastructure Dashboard**: CPU, memory, network

### Alerting Rules

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: festivals-alerts
  namespace: festivals-production
spec:
  groups:
    - name: festivals
      rules:
        - alert: HighErrorRate
          expr: |
            rate(http_requests_total{status=~"5.."}[5m]) /
            rate(http_requests_total[5m]) > 0.05
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: High error rate detected
```

## Troubleshooting

### Common Issues

#### Pods Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n festivals-production

# Check logs
kubectl logs <pod-name> -n festivals-production

# Check events
kubectl get events -n festivals-production --sort-by='.lastTimestamp'
```

#### Readiness Probe Failures

```bash
# Check probe configuration
kubectl get deployment festivals-api -n festivals-production -o yaml | grep -A 10 readinessProbe

# Test health endpoint manually
kubectl exec -it <pod-name> -n festivals-production -- curl localhost:8080/health/ready
```

#### HPA Not Scaling

```bash
# Check HPA status
kubectl get hpa -n festivals-production

# Describe HPA for details
kubectl describe hpa festivals-api-hpa -n festivals-production

# Check metrics-server
kubectl top pods -n festivals-production
```

#### Ingress Issues

```bash
# Check ingress status
kubectl describe ingress festivals-ingress -n festivals-production

# Check nginx-ingress logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

### Useful Commands

```bash
# Get all resources in namespace
kubectl get all -n festivals-production

# Watch pod status
kubectl get pods -n festivals-production -w

# Port-forward for debugging
kubectl port-forward svc/festivals-api 8080:80 -n festivals-production

# Execute into pod
kubectl exec -it <pod-name> -n festivals-production -- /bin/sh

# View logs with follow
kubectl logs -f <pod-name> -n festivals-production

# View previous container logs
kubectl logs <pod-name> -n festivals-production --previous

# Check resource usage
kubectl top pods -n festivals-production
kubectl top nodes
```

### Recovery Procedures

#### Rollback Deployment

```bash
# View rollout history
kubectl rollout history deployment/festivals-api -n festivals-production

# Rollback to previous version
kubectl rollout undo deployment/festivals-api -n festivals-production

# Rollback to specific revision
kubectl rollout undo deployment/festivals-api -n festivals-production --to-revision=2
```

#### Force Restart Pods

```bash
# Rolling restart
kubectl rollout restart deployment/festivals-api -n festivals-production

# Delete and recreate pods
kubectl delete pods -l app.kubernetes.io/component=api -n festivals-production
```

#### Database Recovery

```bash
# Restore from backup
kubectl exec -it postgres-0 -n festivals-production -- \
  psql -U postgres -d festivals < /backup/backup.sql
```

## Security Considerations

1. **Network Policies**: Restrict pod-to-pod communication
2. **Pod Security Context**: Run as non-root user
3. **Resource Limits**: Prevent resource exhaustion
4. **Secrets Encryption**: Enable etcd encryption at rest
5. **RBAC**: Principle of least privilege
6. **Image Scanning**: Scan images for vulnerabilities

## Next Steps

- [Scaling Guide](./scaling.md) - Auto-scaling configuration
- [Monitoring Setup](./monitoring.md) - Prometheus/Grafana setup
- [Security Hardening](./security.md) - Security best practices
