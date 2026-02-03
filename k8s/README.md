# Festivals Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the Festivals application.

## Structure

```
k8s/
├── base/                      # Base manifests (shared across environments)
│   ├── kustomization.yaml     # Kustomize configuration
│   ├── namespace.yaml         # Namespace definition
│   ├── configmap.yaml         # ConfigMap with non-sensitive config
│   ├── secrets.yaml           # Secrets template
│   ├── api-deployment.yaml    # API Go deployment
│   ├── api-service.yaml       # API service
│   ├── admin-deployment.yaml  # Admin Next.js deployment
│   ├── admin-service.yaml     # Admin service
│   ├── worker-deployment.yaml # Worker Asynq deployment
│   └── ingress.yaml           # Ingress + NetworkPolicies
└── overlays/
    ├── staging/               # Staging environment
    │   ├── kustomization.yaml
    │   ├── replicas-patch.yaml
    │   └── ingress-patch.yaml
    └── production/            # Production environment
        ├── kustomization.yaml
        ├── replicas-patch.yaml
        ├── ingress-patch.yaml
        └── hpa.yaml           # Horizontal Pod Autoscaler
```

## Quick Start

### Prerequisites

- kubectl configured with cluster access
- Kustomize (built into kubectl 1.14+)

### Deploy to Staging

```bash
# Preview
kubectl kustomize overlays/staging

# Apply
kubectl apply -k overlays/staging
```

### Deploy to Production

```bash
# Preview
kubectl kustomize overlays/production

# Apply
kubectl apply -k overlays/production
```

## Configuration

### Secrets

Before deploying, update the secrets in your cluster:

```bash
kubectl create secret generic festivals-secrets \
  --from-env-file=.env.production \
  -n festivals-production
```

Or use sealed-secrets/external-secrets for GitOps.

### Update Image Tags

```bash
cd overlays/production
kustomize edit set image ghcr.io/festivals/api=ghcr.io/festivals/api:v1.0.0
kubectl apply -k .
```

## Components

| Component | Replicas (Prod) | Resources | Scaling |
|-----------|-----------------|-----------|---------|
| API | 3 | 250m-1000m CPU, 256Mi-1Gi | HPA (3-10) |
| Admin | 2 | 200m-500m CPU, 256Mi-512Mi | HPA (2-6) |
| Worker | 3 | 500m-2000m CPU, 512Mi-2Gi | HPA (3-15) |

## Features

- Rolling updates (zero-downtime)
- Horizontal Pod Autoscaler
- Pod Disruption Budgets
- Network Policies
- Prometheus metrics annotations
- Resource limits/requests
- Health checks (liveness/readiness/startup)
- TLS termination via cert-manager

## Documentation

See full documentation at:
- [Kubernetes Deployment Guide](../docs/deployment/kubernetes.md)
- [Scaling Guide](../docs/deployment/scaling.md)
