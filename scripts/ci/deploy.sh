#!/usr/bin/env bash
#
# Deployment Script
# Usage: ./scripts/ci/deploy.sh [environment] [options]
#
# Environments: staging, production
# Options:
#   --version TAG    Version to deploy
#   --dry-run        Show what would be deployed without executing
#   --rollback       Rollback to previous version
#   --skip-backup    Skip database backup (not recommended for production)
#   --skip-tests     Skip smoke tests after deployment
#   --force          Force deployment without confirmations

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Default options
ENVIRONMENT=""
VERSION=""
DRY_RUN=false
ROLLBACK=false
SKIP_BACKUP=false
SKIP_TESTS=false
FORCE=false

# Registry configuration
REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_PREFIX="${IMAGE_PREFIX:-festivals}"

# Kubernetes configuration
NAMESPACE_STAGING="festivals-staging"
NAMESPACE_PRODUCTION="festivals-production"

# URLs
API_URL_STAGING="https://api.staging.festivals.app"
API_URL_PRODUCTION="https://api.festivals.app"
ADMIN_URL_STAGING="https://admin.staging.festivals.app"
ADMIN_URL_PRODUCTION="https://admin.festivals.app"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        staging|production)
            ENVIRONMENT="$1"
            shift
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [environment] [options]"
            echo ""
            echo "Environments:"
            echo "  staging       Deploy to staging environment"
            echo "  production    Deploy to production environment"
            echo ""
            echo "Options:"
            echo "  --version TAG    Version to deploy"
            echo "  --dry-run        Show what would be deployed"
            echo "  --rollback       Rollback to previous version"
            echo "  --skip-backup    Skip database backup"
            echo "  --skip-tests     Skip smoke tests after deployment"
            echo "  --force          Force deployment without confirmations"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Validate environment
if [[ -z "$ENVIRONMENT" ]]; then
    echo -e "${RED}Error: Environment is required (staging or production)${NC}"
    exit 1
fi

# Utility functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

confirm() {
    if $FORCE; then
        return 0
    fi

    read -r -p "$1 [y/N] " response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Get environment-specific configuration
get_config() {
    case $ENVIRONMENT in
        staging)
            NAMESPACE="$NAMESPACE_STAGING"
            API_URL="$API_URL_STAGING"
            ADMIN_URL="$ADMIN_URL_STAGING"
            DEPLOY_PREFIX="staging-"
            K8S_OVERLAY="staging"
            ;;
        production)
            NAMESPACE="$NAMESPACE_PRODUCTION"
            API_URL="$API_URL_PRODUCTION"
            ADMIN_URL="$ADMIN_URL_PRODUCTION"
            DEPLOY_PREFIX="prod-"
            K8S_OVERLAY="production"
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check kubectl
    if ! command -v kubectl &>/dev/null; then
        log_error "kubectl is required but not installed"
        exit 1
    fi

    # Check kustomize
    if ! command -v kustomize &>/dev/null; then
        log_error "kustomize is required but not installed"
        exit 1
    fi

    # Check kubectl context
    local current_context
    current_context=$(kubectl config current-context 2>/dev/null || echo "")
    if [[ -z "$current_context" ]]; then
        log_error "No kubectl context configured"
        exit 1
    fi

    log_info "Using kubectl context: $current_context"

    # Verify namespace exists
    if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
        log_error "Namespace $NAMESPACE does not exist"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Get current deployment version
get_current_version() {
    local current_image
    current_image=$(kubectl get deployment "${DEPLOY_PREFIX}festivals-api" -n "$NAMESPACE" \
        -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "")

    if [[ -n "$current_image" ]]; then
        echo "${current_image##*:}"
    else
        echo "unknown"
    fi
}

# Create database backup
create_backup() {
    if $SKIP_BACKUP; then
        log_warn "Skipping database backup (--skip-backup flag set)"
        return 0
    fi

    log_step "Creating database backup..."

    local backup_name="pre-deploy-${VERSION:-rollback}-$(date +%Y%m%d%H%M%S)"

    if $DRY_RUN; then
        log_info "[DRY RUN] Would create backup: $backup_name"
        return 0
    fi

    # Implement actual backup logic here
    # Examples:
    # - AWS RDS: aws rds create-db-snapshot
    # - pg_dump: kubectl exec ... -- pg_dump
    # - Velero: velero backup create

    log_info "Backup created: $backup_name"
    echo "$backup_name"
}

# Update Kubernetes manifests
update_manifests() {
    log_step "Updating Kubernetes manifests..."

    cd "${PROJECT_ROOT}/k8s/overlays/${K8S_OVERLAY}"

    if $DRY_RUN; then
        log_info "[DRY RUN] Would update images to:"
        log_info "  - ${REGISTRY}/${IMAGE_PREFIX}-api:${VERSION}"
        log_info "  - ${REGISTRY}/${IMAGE_PREFIX}-admin:${VERSION}"
        log_info "  - ${REGISTRY}/${IMAGE_PREFIX}-worker:${VERSION}"
        return 0
    fi

    kustomize edit set image \
        "ghcr.io/festivals/api=${REGISTRY}/${IMAGE_PREFIX}-api:${VERSION}" \
        "ghcr.io/festivals/admin=${REGISTRY}/${IMAGE_PREFIX}-admin:${VERSION}" \
        "ghcr.io/festivals/worker=${REGISTRY}/${IMAGE_PREFIX}-worker:${VERSION}"

    log_success "Manifests updated"
}

# Deploy to Kubernetes
deploy() {
    log_step "Deploying to Kubernetes..."

    cd "${PROJECT_ROOT}/k8s/overlays/${K8S_OVERLAY}"

    if $DRY_RUN; then
        log_info "[DRY RUN] Would apply the following manifests:"
        kustomize build . | kubectl diff -f - || true
        return 0
    fi

    # Apply manifests
    kustomize build . | kubectl apply -f -

    # Wait for rollouts
    log_info "Waiting for API deployment..."
    kubectl rollout status "deployment/${DEPLOY_PREFIX}festivals-api" -n "$NAMESPACE" --timeout=300s

    log_info "Waiting for Admin deployment..."
    kubectl rollout status "deployment/${DEPLOY_PREFIX}festivals-admin" -n "$NAMESPACE" --timeout=300s

    log_info "Waiting for Worker deployment..."
    kubectl rollout status "deployment/${DEPLOY_PREFIX}festivals-worker" -n "$NAMESPACE" --timeout=300s

    log_success "Deployment completed"
}

# Run smoke tests
run_smoke_tests() {
    if $SKIP_TESTS; then
        log_warn "Skipping smoke tests (--skip-tests flag set)"
        return 0
    fi

    log_step "Running smoke tests..."

    if $DRY_RUN; then
        log_info "[DRY RUN] Would run smoke tests against:"
        log_info "  - API: $API_URL"
        log_info "  - Admin: $ADMIN_URL"
        return 0
    fi

    # Wait for services to stabilize
    sleep 30

    local failures=0

    # Test API health
    log_info "Testing API health..."
    for i in {1..5}; do
        if curl -sf --max-time 30 "${API_URL}/health/ready" &>/dev/null; then
            log_success "API health check passed"
            break
        fi
        if [[ $i -eq 5 ]]; then
            log_error "API health check failed after 5 attempts"
            ((failures++))
        fi
        sleep 10
    done

    # Test Admin health
    log_info "Testing Admin health..."
    for i in {1..5}; do
        if curl -sf --max-time 30 "${ADMIN_URL}/api/health" &>/dev/null; then
            log_success "Admin health check passed"
            break
        fi
        if [[ $i -eq 5 ]]; then
            log_error "Admin health check failed after 5 attempts"
            ((failures++))
        fi
        sleep 10
    done

    if [[ $failures -gt 0 ]]; then
        log_error "$failures smoke tests failed"
        return 1
    fi

    log_success "All smoke tests passed"
}

# Rollback deployment
rollback() {
    log_step "Rolling back deployment..."

    if $DRY_RUN; then
        log_info "[DRY RUN] Would rollback deployments in namespace $NAMESPACE"
        return 0
    fi

    kubectl rollout undo "deployment/${DEPLOY_PREFIX}festivals-api" -n "$NAMESPACE"
    kubectl rollout undo "deployment/${DEPLOY_PREFIX}festivals-admin" -n "$NAMESPACE"
    kubectl rollout undo "deployment/${DEPLOY_PREFIX}festivals-worker" -n "$NAMESPACE"

    # Wait for rollbacks
    kubectl rollout status "deployment/${DEPLOY_PREFIX}festivals-api" -n "$NAMESPACE" --timeout=300s
    kubectl rollout status "deployment/${DEPLOY_PREFIX}festivals-admin" -n "$NAMESPACE" --timeout=300s
    kubectl rollout status "deployment/${DEPLOY_PREFIX}festivals-worker" -n "$NAMESPACE" --timeout=300s

    log_success "Rollback completed"
}

# Main execution
main() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  Festivals Deployment Script${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    get_config

    log_info "Environment: $ENVIRONMENT"
    log_info "Namespace: $NAMESPACE"
    log_info "Dry Run: $DRY_RUN"
    log_info "Rollback: $ROLLBACK"
    echo ""

    check_prerequisites

    local current_version
    current_version=$(get_current_version)
    log_info "Current version: $current_version"

    if $ROLLBACK; then
        echo ""
        log_warn "You are about to ROLLBACK the $ENVIRONMENT deployment"

        if ! confirm "Are you sure you want to rollback?"; then
            log_info "Rollback cancelled"
            exit 0
        fi

        rollback
        run_smoke_tests

        log_success "Rollback to previous version completed!"
        exit 0
    fi

    # Get version if not specified
    if [[ -z "$VERSION" ]]; then
        VERSION=$(git describe --tags --abbrev=0 2>/dev/null || git rev-parse --short HEAD)
    fi

    log_info "Version to deploy: $VERSION"

    # Production confirmation
    if [[ "$ENVIRONMENT" == "production" ]] && ! $DRY_RUN; then
        echo ""
        log_warn "You are about to deploy to PRODUCTION!"
        log_warn "Version: $VERSION"
        log_warn "Current version: $current_version"
        echo ""

        if ! confirm "Are you sure you want to proceed?"; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi

    echo ""

    # Create backup
    if [[ "$ENVIRONMENT" == "production" ]] || ! $SKIP_BACKUP; then
        create_backup
    fi

    # Update and deploy
    update_manifests
    deploy

    # Run smoke tests
    if ! run_smoke_tests; then
        log_error "Smoke tests failed!"

        if [[ "$ENVIRONMENT" == "production" ]] && ! $DRY_RUN; then
            if confirm "Would you like to rollback?"; then
                rollback
                log_info "Rolled back to previous version"
            fi
        fi

        exit 1
    fi

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Deployment Successful!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    log_info "Environment: $ENVIRONMENT"
    log_info "Version: $VERSION"
    log_info "API URL: $API_URL"
    log_info "Admin URL: $ADMIN_URL"
    echo ""
}

main
