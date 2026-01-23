#!/usr/bin/env bash
#
# Docker Build Script
# Usage: ./scripts/ci/build_docker.sh [component] [options]
#
# Components: api, worker, admin, all
# Options:
#   --push         Push images to registry
#   --tag TAG      Image tag (default: git SHA or 'latest')
#   --registry     Container registry URL
#   --platform     Target platform(s)
#   --cache        Use/populate build cache
#   --no-cache     Build without cache
#   --scan         Run security scan after build

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Default options
COMPONENT="all"
PUSH=false
TAG="${GITHUB_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')}"
REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_PREFIX="${IMAGE_PREFIX:-festivals}"
PLATFORM="linux/amd64"
CACHE=false
NO_CACHE=false
SCAN=false
BUILDX=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        api|worker|admin|all)
            COMPONENT="$1"
            shift
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --tag)
            TAG="$2"
            shift 2
            ;;
        --registry)
            REGISTRY="$2"
            shift 2
            ;;
        --platform)
            PLATFORM="$2"
            BUILDX=true
            shift 2
            ;;
        --cache)
            CACHE=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --scan)
            SCAN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [component] [options]"
            echo ""
            echo "Components:"
            echo "  api         Build API server image"
            echo "  worker      Build worker image"
            echo "  admin       Build admin dashboard image"
            echo "  all         Build all images (default)"
            echo ""
            echo "Options:"
            echo "  --push         Push images to registry"
            echo "  --tag TAG      Image tag (default: git SHA)"
            echo "  --registry URL Container registry URL"
            echo "  --platform     Target platform(s) (e.g., linux/amd64,linux/arm64)"
            echo "  --cache        Use/populate build cache"
            echo "  --no-cache     Build without cache"
            echo "  --scan         Run security scan after build"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

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

# Setup Docker Buildx if needed
setup_buildx() {
    if $BUILDX; then
        log_info "Setting up Docker Buildx..."
        if ! docker buildx inspect festivals-builder &>/dev/null; then
            docker buildx create --name festivals-builder --driver docker-container --bootstrap
        fi
        docker buildx use festivals-builder
    fi
}

# Build an image
build_image() {
    local component=$1
    local context=$2
    local dockerfile=$3
    local target=${4:-}

    local image_name="${REGISTRY}/${IMAGE_PREFIX}-${component}:${TAG}"
    local image_latest="${REGISTRY}/${IMAGE_PREFIX}-${component}:latest"

    log_info "Building ${component}..."
    log_info "  Image: ${image_name}"
    log_info "  Context: ${context}"
    log_info "  Dockerfile: ${dockerfile}"
    [[ -n "$target" ]] && log_info "  Target: ${target}"

    local build_args=()

    # Add build context
    build_args+=("-f" "${dockerfile}")
    build_args+=("-t" "${image_name}")
    build_args+=("-t" "${image_latest}")

    # Add target if specified
    [[ -n "$target" ]] && build_args+=("--target" "${target}")

    # Add build arguments
    build_args+=("--build-arg" "VERSION=${TAG}")
    build_args+=("--build-arg" "COMMIT_SHA=${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}")
    build_args+=("--build-arg" "BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)")

    # Handle cache
    if $CACHE; then
        build_args+=("--cache-from" "type=registry,ref=${REGISTRY}/${IMAGE_PREFIX}-${component}:cache")
        if $PUSH; then
            build_args+=("--cache-to" "type=registry,ref=${REGISTRY}/${IMAGE_PREFIX}-${component}:cache,mode=max")
        fi
    fi

    if $NO_CACHE; then
        build_args+=("--no-cache")
    fi

    # Handle push
    if $PUSH; then
        build_args+=("--push")
    else
        build_args+=("--load")
    fi

    # Handle platform
    if $BUILDX; then
        build_args+=("--platform" "${PLATFORM}")
        docker buildx build "${build_args[@]}" "${context}"
    else
        # Standard docker build (single platform)
        docker build "${build_args[@]}" "${context}"
    fi

    log_success "Built ${image_name}"

    # Run security scan if requested
    if $SCAN && ! $PUSH; then
        scan_image "${image_name}"
    fi
}

# Scan image for vulnerabilities
scan_image() {
    local image=$1

    log_info "Scanning ${image} for vulnerabilities..."

    if command -v trivy &>/dev/null; then
        trivy image --severity HIGH,CRITICAL --exit-code 0 "${image}"
    elif command -v docker &>/dev/null && docker scout version &>/dev/null 2>&1; then
        docker scout cves "${image}" --only-severity critical,high || true
    else
        log_warn "No scanner available (trivy or docker scout). Skipping scan."
    fi
}

# Build API image
build_api() {
    build_image "api" "${PROJECT_ROOT}/backend" "${PROJECT_ROOT}/backend/Dockerfile" "api"
}

# Build Worker image
build_worker() {
    build_image "worker" "${PROJECT_ROOT}/backend" "${PROJECT_ROOT}/backend/Dockerfile" "worker"
}

# Build Admin image
build_admin() {
    build_image "admin" "${PROJECT_ROOT}/admin" "${PROJECT_ROOT}/admin/Dockerfile"
}

# Main execution
main() {
    log_info "Starting Docker build..."
    log_info "Component: $COMPONENT"
    log_info "Tag: $TAG"
    log_info "Registry: $REGISTRY"
    log_info "Push: $PUSH"

    # Setup Buildx if multi-platform
    if [[ "$PLATFORM" == *","* ]] || $BUILDX; then
        BUILDX=true
        setup_buildx
    fi

    local failed=false

    case $COMPONENT in
        api)
            build_api || failed=true
            ;;
        worker)
            build_worker || failed=true
            ;;
        admin)
            build_admin || failed=true
            ;;
        all)
            build_api || failed=true
            build_worker || failed=true
            build_admin || failed=true
            ;;
    esac

    if $failed; then
        log_error "Build failed"
        exit 1
    fi

    log_success "All builds completed successfully!"

    # Print image list
    echo ""
    log_info "Built images:"
    case $COMPONENT in
        api)
            echo "  - ${REGISTRY}/${IMAGE_PREFIX}-api:${TAG}"
            ;;
        worker)
            echo "  - ${REGISTRY}/${IMAGE_PREFIX}-worker:${TAG}"
            ;;
        admin)
            echo "  - ${REGISTRY}/${IMAGE_PREFIX}-admin:${TAG}"
            ;;
        all)
            echo "  - ${REGISTRY}/${IMAGE_PREFIX}-api:${TAG}"
            echo "  - ${REGISTRY}/${IMAGE_PREFIX}-worker:${TAG}"
            echo "  - ${REGISTRY}/${IMAGE_PREFIX}-admin:${TAG}"
            ;;
    esac
}

main
