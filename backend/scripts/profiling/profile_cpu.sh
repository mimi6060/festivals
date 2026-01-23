#!/bin/bash

# CPU Profiling Script for Festivals Backend
# This script collects CPU profiles from a running application

set -e

# Configuration
APP_HOST="${APP_HOST:-localhost}"
APP_PORT="${APP_PORT:-8080}"
PROFILE_DURATION="${PROFILE_DURATION:-30}"
OUTPUT_DIR="${OUTPUT_DIR:-./profiles}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${GREEN}=== CPU Profiling Script ===${NC}"
echo "Target: http://${APP_HOST}:${APP_PORT}"
echo "Duration: ${PROFILE_DURATION}s"
echo ""

# Check if pprof endpoint is available
check_pprof() {
    echo -e "${YELLOW}Checking pprof availability...${NC}"
    if curl -s -f "http://${APP_HOST}:${APP_PORT}/debug/pprof/" > /dev/null 2>&1; then
        echo -e "${GREEN}pprof endpoint is available${NC}"
        return 0
    else
        echo -e "${RED}pprof endpoint is not available at http://${APP_HOST}:${APP_PORT}/debug/pprof/${NC}"
        echo "Make sure the application is running with pprof enabled"
        return 1
    fi
}

# Collect CPU profile
collect_cpu_profile() {
    local output_file="${OUTPUT_DIR}/cpu_${TIMESTAMP}.prof"
    echo -e "${YELLOW}Collecting CPU profile for ${PROFILE_DURATION}s...${NC}"

    curl -s "http://${APP_HOST}:${APP_PORT}/debug/pprof/profile?seconds=${PROFILE_DURATION}" \
        -o "$output_file"

    if [ -s "$output_file" ]; then
        echo -e "${GREEN}CPU profile saved to: ${output_file}${NC}"
        return 0
    else
        echo -e "${RED}Failed to collect CPU profile${NC}"
        rm -f "$output_file"
        return 1
    fi
}

# Collect goroutine profile
collect_goroutine_profile() {
    local output_file="${OUTPUT_DIR}/goroutine_${TIMESTAMP}.prof"
    echo -e "${YELLOW}Collecting goroutine profile...${NC}"

    curl -s "http://${APP_HOST}:${APP_PORT}/debug/pprof/goroutine" \
        -o "$output_file"

    if [ -s "$output_file" ]; then
        echo -e "${GREEN}Goroutine profile saved to: ${output_file}${NC}"
        return 0
    else
        echo -e "${RED}Failed to collect goroutine profile${NC}"
        rm -f "$output_file"
        return 1
    fi
}

# Analyze profile with go tool pprof
analyze_profile() {
    local profile_file="$1"
    local analysis_type="$2"

    if [ ! -f "$profile_file" ]; then
        echo -e "${RED}Profile file not found: ${profile_file}${NC}"
        return 1
    fi

    echo -e "${YELLOW}Analyzing ${analysis_type} profile...${NC}"

    # Generate text report
    local report_file="${profile_file%.prof}_report.txt"
    go tool pprof -text "$profile_file" > "$report_file" 2>/dev/null || true

    # Generate top functions
    local top_file="${profile_file%.prof}_top.txt"
    go tool pprof -top "$profile_file" > "$top_file" 2>/dev/null || true

    # Generate flame graph data (if flamegraph.pl is available)
    if command -v go-torch &> /dev/null; then
        local svg_file="${profile_file%.prof}_flame.svg"
        go-torch --file="$svg_file" "$profile_file" 2>/dev/null || true
    fi

    echo -e "${GREEN}Analysis complete${NC}"
}

# Generate SVG graph
generate_svg() {
    local profile_file="$1"
    local svg_file="${profile_file%.prof}.svg"

    echo -e "${YELLOW}Generating SVG graph...${NC}"

    if go tool pprof -svg "$profile_file" > "$svg_file" 2>/dev/null; then
        echo -e "${GREEN}SVG saved to: ${svg_file}${NC}"
    else
        echo -e "${YELLOW}Could not generate SVG (graphviz may not be installed)${NC}"
    fi
}

# Main execution
main() {
    echo ""

    # Check pprof availability
    if ! check_pprof; then
        exit 1
    fi

    echo ""

    # Collect CPU profile
    if collect_cpu_profile; then
        analyze_profile "${OUTPUT_DIR}/cpu_${TIMESTAMP}.prof" "CPU"
        generate_svg "${OUTPUT_DIR}/cpu_${TIMESTAMP}.prof"
    fi

    echo ""

    # Collect goroutine profile
    if collect_goroutine_profile; then
        analyze_profile "${OUTPUT_DIR}/goroutine_${TIMESTAMP}.prof" "goroutine"
    fi

    echo ""
    echo -e "${GREEN}=== Profiling Complete ===${NC}"
    echo ""
    echo "To analyze interactively:"
    echo "  go tool pprof ${OUTPUT_DIR}/cpu_${TIMESTAMP}.prof"
    echo ""
    echo "Available commands in pprof:"
    echo "  top       - Show top functions by CPU time"
    echo "  list fn   - Show source code for function"
    echo "  web       - Open call graph in browser"
    echo "  svg       - Generate SVG call graph"
    echo ""
    echo "To profile with load testing:"
    echo "  1. Start the profiler in one terminal"
    echo "  2. Run load tests in another terminal"
    echo "  3. Analyze the collected profiles"
}

# Run main
main "$@"
