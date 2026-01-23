#!/usr/bin/env bash
#
# Run Tests with Coverage
# Usage: ./scripts/ci/run_tests.sh [component] [options]
#
# Components: backend, admin, mobile, all
# Options:
#   --coverage     Generate coverage report
#   --parallel     Run tests in parallel
#   --verbose      Verbose output
#   --ci           CI mode (non-interactive)
#   --junit        Generate JUnit XML report
#   --threshold N  Fail if coverage is below N%

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
COVERAGE_DIR="${PROJECT_ROOT}/coverage"

# Default options
COMPONENT="all"
COVERAGE=false
PARALLEL=false
VERBOSE=false
CI_MODE=false
JUNIT=false
THRESHOLD=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        backend|admin|mobile|all)
            COMPONENT="$1"
            shift
            ;;
        --coverage)
            COVERAGE=true
            shift
            ;;
        --parallel)
            PARALLEL=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --ci)
            CI_MODE=true
            shift
            ;;
        --junit)
            JUNIT=true
            shift
            ;;
        --threshold)
            THRESHOLD="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [component] [options]"
            echo ""
            echo "Components:"
            echo "  backend     Run Go backend tests"
            echo "  admin       Run Next.js admin tests"
            echo "  mobile      Run React Native mobile tests"
            echo "  all         Run all tests (default)"
            echo ""
            echo "Options:"
            echo "  --coverage     Generate coverage report"
            echo "  --parallel     Run tests in parallel"
            echo "  --verbose      Verbose output"
            echo "  --ci           CI mode (non-interactive)"
            echo "  --junit        Generate JUnit XML report"
            echo "  --threshold N  Fail if coverage is below N%"
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

# Check coverage threshold
check_coverage_threshold() {
    local coverage_file=$1
    local component=$2

    if [[ $THRESHOLD -gt 0 ]] && [[ -f "$coverage_file" ]]; then
        local coverage

        if [[ "$component" == "backend" ]]; then
            # Parse Go coverage
            coverage=$(go tool cover -func="$coverage_file" | grep total | awk '{print $3}' | tr -d '%')
        else
            # Parse lcov coverage
            coverage=$(grep -E "^LF:|^LH:" "$coverage_file" | awk -F: '
                /^LF:/ {lf+=$2}
                /^LH:/ {lh+=$2}
                END {if(lf>0) printf "%.1f", (lh/lf)*100; else print "0"}
            ')
        fi

        log_info "Coverage for $component: ${coverage}%"

        if (( $(echo "$coverage < $THRESHOLD" | bc -l) )); then
            log_error "Coverage ${coverage}% is below threshold ${THRESHOLD}%"
            return 1
        fi
    fi
    return 0
}

# Run backend tests
run_backend_tests() {
    log_info "Running backend tests..."
    cd "${PROJECT_ROOT}/backend"

    local test_args=("-v" "-race")

    if $COVERAGE; then
        mkdir -p "${COVERAGE_DIR}/backend"
        test_args+=("-coverprofile=${COVERAGE_DIR}/backend/coverage.out" "-covermode=atomic")
    fi

    if $PARALLEL; then
        test_args+=("-parallel=4")
    fi

    if $VERBOSE; then
        test_args+=("-v")
    fi

    if $JUNIT; then
        # Use gotestsum for JUnit output
        if command -v gotestsum &> /dev/null; then
            gotestsum --junitfile "${COVERAGE_DIR}/backend/junit.xml" -- "${test_args[@]}" ./...
        else
            log_warn "gotestsum not found, running standard tests"
            go test "${test_args[@]}" ./...
        fi
    else
        go test "${test_args[@]}" ./...
    fi

    if $COVERAGE; then
        log_info "Generating coverage report..."
        go tool cover -func="${COVERAGE_DIR}/backend/coverage.out" > "${COVERAGE_DIR}/backend/coverage-summary.txt"
        go tool cover -html="${COVERAGE_DIR}/backend/coverage.out" -o "${COVERAGE_DIR}/backend/coverage.html"

        check_coverage_threshold "${COVERAGE_DIR}/backend/coverage.out" "backend"
    fi

    log_success "Backend tests completed"
}

# Run admin tests
run_admin_tests() {
    log_info "Running admin tests..."
    cd "${PROJECT_ROOT}/admin"

    local test_args=("--run")

    if $COVERAGE; then
        mkdir -p "${COVERAGE_DIR}/admin"
        test_args+=("--coverage" "--coverageDirectory=${COVERAGE_DIR}/admin")
    fi

    if $PARALLEL; then
        test_args+=("--maxWorkers=4")
    fi

    if $VERBOSE; then
        test_args+=("--verbose")
    fi

    if $CI_MODE; then
        test_args+=("--ci")
    fi

    if $JUNIT; then
        test_args+=("--reporter=junit" "--outputFile=${COVERAGE_DIR}/admin/junit.xml")
    fi

    # Use pnpm if available
    if command -v pnpm &> /dev/null; then
        pnpm test "${test_args[@]}"
    else
        npm test -- "${test_args[@]}"
    fi

    if $COVERAGE && [[ -f "${COVERAGE_DIR}/admin/lcov.info" ]]; then
        check_coverage_threshold "${COVERAGE_DIR}/admin/lcov.info" "admin"
    fi

    log_success "Admin tests completed"
}

# Run mobile tests
run_mobile_tests() {
    log_info "Running mobile tests..."
    cd "${PROJECT_ROOT}/mobile"

    local test_args=()

    if $COVERAGE; then
        mkdir -p "${COVERAGE_DIR}/mobile"
        test_args+=("--coverage" "--coverageDirectory=${COVERAGE_DIR}/mobile")
    fi

    if $PARALLEL; then
        test_args+=("--maxWorkers=4")
    fi

    if $VERBOSE; then
        test_args+=("--verbose")
    fi

    if $CI_MODE; then
        test_args+=("--ci" "--passWithNoTests")
    fi

    if $JUNIT; then
        test_args+=("--reporters=jest-junit")
        export JEST_JUNIT_OUTPUT_DIR="${COVERAGE_DIR}/mobile"
    fi

    npm test -- "${test_args[@]}"

    if $COVERAGE && [[ -f "${COVERAGE_DIR}/mobile/lcov.info" ]]; then
        check_coverage_threshold "${COVERAGE_DIR}/mobile/lcov.info" "mobile"
    fi

    log_success "Mobile tests completed"
}

# Main execution
main() {
    log_info "Starting test runner..."
    log_info "Component: $COMPONENT"
    log_info "Coverage: $COVERAGE"
    log_info "Parallel: $PARALLEL"
    log_info "CI Mode: $CI_MODE"

    if $COVERAGE; then
        mkdir -p "${COVERAGE_DIR}"
    fi

    local failed=false

    case $COMPONENT in
        backend)
            run_backend_tests || failed=true
            ;;
        admin)
            run_admin_tests || failed=true
            ;;
        mobile)
            run_mobile_tests || failed=true
            ;;
        all)
            run_backend_tests || failed=true
            run_admin_tests || failed=true
            run_mobile_tests || failed=true
            ;;
    esac

    if $failed; then
        log_error "Some tests failed"
        exit 1
    fi

    log_success "All tests completed successfully!"

    if $COVERAGE; then
        log_info "Coverage reports available in: ${COVERAGE_DIR}"
    fi
}

main
