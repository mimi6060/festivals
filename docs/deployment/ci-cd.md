# CI/CD Pipeline Documentation

This guide covers the continuous integration and deployment pipelines for the Festivals platform.

## Overview

The CI/CD pipeline is built with GitHub Actions and includes:

- **CI Pipeline** - Tests, linting, security scanning
- **Deploy Pipeline** - Build images, deploy to staging/production
- **Load Test Pipeline** - Performance testing
- **Mobile E2E Pipeline** - End-to-end mobile testing

## GitHub Actions Workflows

### CI Workflow (`.github/workflows/ci.yml`)

Triggered on: Push to `main`/`development`, Pull Requests

```yaml
name: CI

on:
  push:
    branches: [main, development]
  pull_request:
    branches: [main, development]

jobs:
  backend-test:     # Go tests with PostgreSQL and Redis
  backend-lint:     # golangci-lint
  admin-build:      # Next.js build and tests
  mobile-lint:      # React Native lint
  docker-build:     # Docker image builds
  security-scan:    # Trivy vulnerability scanning
```

**Job Dependencies:**

```
backend-test ─┬─> docker-build
backend-lint ─┘        │
                       v
admin-build  ─────> security-scan
      │
      v
mobile-lint
```

### Deploy Workflow (`.github/workflows/deploy.yml`)

Triggered on: Release published, Manual dispatch

```yaml
name: Deploy

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
      image_tag:
        description: 'Image tag to deploy'
        required: false
        type: string

jobs:
  build-and-push:     # Build and push Docker images
  deploy-staging:     # Deploy to staging cluster
  deploy-production:  # Deploy to production cluster
  rollback:           # Manual rollback job
  cleanup-images:     # Clean up old container images
```

## Deployment Pipeline

### Pipeline Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Trigger   │────>│  Build &    │────>│   Deploy    │
│  (Release/  │     │    Push     │     │   Staging   │
│   Manual)   │     │   Images    │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               v
                                        ┌─────────────┐
                                        │   Smoke     │
                                        │   Tests     │
                                        └──────┬──────┘
                                               │
                                               v
                                        ┌─────────────┐
                                        │   Deploy    │
                                        │ Production  │
                                        └──────┬──────┘
                                               │
                                               v
                                        ┌─────────────┐
                                        │   Verify    │
                                        │    &        │
                                        │   Notify    │
                                        └─────────────┘
```

### Build and Push Images

Multi-architecture builds for AMD64 and ARM64:

```yaml
- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: ${{ matrix.context }}
    file: ${{ matrix.context }}/${{ matrix.dockerfile }}
    platforms: linux/amd64,linux/arm64
    push: true
    tags: ${{ steps.meta.outputs.tags }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
    build-args: |
      VERSION=${{ steps.version.outputs.version }}
      COMMIT_SHA=${{ github.sha }}
```

### Deploy to Staging

```yaml
deploy-staging:
  runs-on: ubuntu-latest
  environment:
    name: staging
    url: https://staging.festivals.app

  steps:
    - name: Configure kubectl
      run: |
        mkdir -p ~/.kube
        echo "${{ secrets.KUBECONFIG_STAGING }}" | base64 -d > ~/.kube/config

    - name: Update image tags
      run: |
        cd k8s/overlays/staging
        kustomize edit set image \
          ghcr.io/festivals/api=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-api:${{ needs.build-and-push.outputs.version }}

    - name: Deploy to Kubernetes
      run: |
        kustomize build k8s/overlays/staging | kubectl apply -f -
        kubectl rollout status deployment/staging-festivals-api -n festivals-staging --timeout=300s

    - name: Run smoke tests
      run: |
        curl -sf https://api.staging.festivals.app/health/ready || exit 1
```

### Deploy to Production

```yaml
deploy-production:
  runs-on: ubuntu-latest
  needs: [build-and-push, deploy-staging]
  environment:
    name: production
    url: https://festivals.app

  steps:
    - name: Create database backup
      run: |
        # Create backup before deployment
        kubectl exec -n festivals-production deploy/postgres -- \
          pg_dump -U postgres festivals > backup-${{ github.sha }}.sql

    - name: Deploy to Kubernetes
      run: |
        kustomize build k8s/overlays/production | kubectl apply -f -
        kubectl rollout status deployment/prod-festivals-api -n festivals-production --timeout=600s

    - name: Verify deployment
      run: |
        for i in {1..5}; do
          curl -sf https://api.festivals.app/health/ready && break
          sleep 10
        done
```

## Manual Deployment

### Trigger via GitHub UI

1. Go to **Actions** tab
2. Select **Deploy** workflow
3. Click **Run workflow**
4. Select environment and optionally specify image tag
5. Click **Run workflow**

### Trigger via GitHub CLI

```bash
# Deploy to staging
gh workflow run deploy.yml -f environment=staging

# Deploy specific version to production
gh workflow run deploy.yml -f environment=production -f image_tag=v1.2.0

# Watch deployment progress
gh run watch
```

## Rollback Procedures

### Automatic Rollback (via kubectl)

```bash
# Rollback to previous version
kubectl rollout undo deployment/prod-festivals-api -n festivals-production
kubectl rollout undo deployment/prod-festivals-admin -n festivals-production
kubectl rollout undo deployment/prod-festivals-worker -n festivals-production

# Verify rollback
kubectl rollout status deployment/prod-festivals-api -n festivals-production
```

### Manual Rollback (via CI/CD)

The deploy workflow includes a rollback job:

```yaml
rollback:
  runs-on: ubuntu-latest
  if: github.event_name == 'workflow_dispatch'

  steps:
    - name: Rollback to previous version
      run: |
        kubectl rollout undo deployment/${PREFIX}festivals-api -n ${NS}
        kubectl rollout undo deployment/${PREFIX}festivals-admin -n ${NS}
        kubectl rollout undo deployment/${PREFIX}festivals-worker -n ${NS}
```

### Rollback to Specific Version

```bash
# Deploy specific image tag
gh workflow run deploy.yml \
  -f environment=production \
  -f image_tag=v1.1.0

# Or manually with kubectl
kubectl set image deployment/prod-festivals-api \
  api=ghcr.io/your-org/festivals-api:v1.1.0 \
  -n festivals-production
```

## Secrets Management

### Required Secrets

Configure these in GitHub repository settings:

| Secret | Description | Used By |
|--------|-------------|---------|
| `KUBECONFIG_STAGING` | Base64 encoded kubeconfig for staging | Deploy staging |
| `KUBECONFIG_PRODUCTION` | Base64 encoded kubeconfig for production | Deploy production |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | Deploy notifications |
| `CODECOV_TOKEN` | Codecov upload token | CI coverage |

### Environment Secrets

Managed per environment (Settings > Environments):

**Staging Environment:**
- Database credentials
- Redis credentials
- Auth0 staging credentials
- Stripe test keys

**Production Environment:**
- Database credentials
- Redis credentials
- Auth0 production credentials
- Stripe live keys

### Creating Kubeconfig Secret

```bash
# Get kubeconfig from cluster
kubectl config view --minify --flatten > kubeconfig.yaml

# Encode as base64
cat kubeconfig.yaml | base64 -w 0

# Add to GitHub secrets
gh secret set KUBECONFIG_STAGING < kubeconfig-staging.yaml
gh secret set KUBECONFIG_PRODUCTION < kubeconfig-production.yaml
```

### External Secrets Operator

For production, use External Secrets with AWS Secrets Manager:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: festivals-secrets
  namespace: festivals-production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: festivals-secrets
    creationPolicy: Owner
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: festivals/production/database
        property: url
    - secretKey: STRIPE_SECRET_KEY
      remoteRef:
        key: festivals/production/stripe
        property: secret_key
```

## Environment Protection Rules

### Staging Environment

```yaml
Environment: staging
Protection rules:
  - Required reviewers: 0
  - Wait timer: 0 minutes
  - Deployment branches: main, development
```

### Production Environment

```yaml
Environment: production
Protection rules:
  - Required reviewers: 1
  - Wait timer: 5 minutes
  - Deployment branches: main only
```

Configure in GitHub: Settings > Environments

## Workflow Customization

### Adding Pre-Deployment Checks

```yaml
pre-deploy-checks:
  runs-on: ubuntu-latest
  steps:
    - name: Run integration tests
      run: |
        npm run test:integration

    - name: Check database migrations
      run: |
        ./scripts/check-migrations.sh

    - name: Verify feature flags
      run: |
        curl -sf https://api.launchdarkly.com/api/v2/flags/default | jq '.items'
```

### Adding Post-Deployment Hooks

```yaml
post-deploy:
  needs: deploy-production
  runs-on: ubuntu-latest
  steps:
    - name: Clear CDN cache
      run: |
        curl -X POST "https://api.cloudflare.com/client/v4/zones/${{ secrets.CF_ZONE_ID }}/purge_cache" \
          -H "Authorization: Bearer ${{ secrets.CF_API_TOKEN }}" \
          -H "Content-Type: application/json" \
          --data '{"purge_everything":true}'

    - name: Notify customers
      run: |
        # Send release notification
        ./scripts/send-release-notification.sh

    - name: Update status page
      run: |
        curl -X POST "https://api.statuspage.io/v1/pages/${{ secrets.STATUSPAGE_PAGE_ID }}/incidents" \
          -H "Authorization: OAuth ${{ secrets.STATUSPAGE_API_KEY }}" \
          -d '{"incident":{"name":"Deployment completed","status":"resolved"}}'
```

### Custom Notification

```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v1.24.0
  with:
    payload: |
      {
        "text": "Deployment successful",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Production Deployment Successful*\n*Version:* `${{ needs.build-and-push.outputs.version }}`\n*Environment:* <https://festivals.app|Production>"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## ArgoCD Integration (Alternative)

For GitOps with ArgoCD:

```yaml
deploy-argocd:
  runs-on: ubuntu-latest
  steps:
    - name: Install ArgoCD CLI
      run: |
        curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
        chmod +x argocd
        sudo mv argocd /usr/local/bin/

    - name: Login to ArgoCD
      run: |
        argocd login ${{ secrets.ARGOCD_SERVER }} \
          --username ${{ secrets.ARGOCD_USERNAME }} \
          --password ${{ secrets.ARGOCD_PASSWORD }}

    - name: Update image and sync
      run: |
        argocd app set festivals-production \
          --parameter api.image.tag=${{ needs.build-and-push.outputs.version }}
        argocd app sync festivals-production --prune
        argocd app wait festivals-production --timeout 600
```

## Monitoring Deployments

### View Deployment Status

```bash
# GitHub CLI
gh run list --workflow=deploy.yml

# Watch specific run
gh run watch <run-id>

# View deployment history
gh run list --workflow=deploy.yml --json conclusion,startedAt,displayTitle
```

### Deployment Metrics

Track these metrics:

- **Deployment frequency** - How often deployments occur
- **Lead time** - Time from commit to production
- **Change failure rate** - Percentage of failed deployments
- **Mean time to recovery** - Time to recover from failures

## Troubleshooting

### Failed Build

```bash
# View workflow logs
gh run view <run-id> --log

# Re-run failed jobs
gh run rerun <run-id> --failed
```

### Failed Deployment

```bash
# Check deployment status
kubectl rollout status deployment/prod-festivals-api -n festivals-production

# View pod events
kubectl describe pods -l app.kubernetes.io/name=festivals -n festivals-production

# Check logs
kubectl logs -l app.kubernetes.io/name=festivals -n festivals-production --tail=100
```

### Stuck Deployment

```bash
# Cancel stuck rollout
kubectl rollout undo deployment/prod-festivals-api -n festivals-production

# Force restart
kubectl rollout restart deployment/prod-festivals-api -n festivals-production
```
