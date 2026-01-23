#!/bin/bash

# Memory Profiling Script for Festivals Backend
# This script collects memory and heap profiles from a running application

set -e

# Configuration
APP_HOST="${APP_HOST:-localhost}"
APP_PORT="${APP_PORT:-8080}"
OUTPUT_DIR="${OUTPUT_DIR:-./profiles}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
INTERVAL="${INTERVAL:-10}" # Seconds between snapshots for trending

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${GREEN}=== Memory Profiling Script ===${NC}"
echo "Target: http://${APP_HOST}:${APP_PORT}"
echo ""

# Check if pprof endpoint is available
check_pprof() {
    echo -e "${YELLOW}Checking pprof availability...${NC}"
    if curl -s -f "http://${APP_HOST}:${APP_PORT}/debug/pprof/" > /dev/null 2>&1; then
        echo -e "${GREEN}pprof endpoint is available${NC}"
        return 0
    else
        echo -e "${RED}pprof endpoint is not available${NC}"
        return 1
    fi
}

# Collect heap profile
collect_heap_profile() {
    local suffix="${1:-}"
    local output_file="${OUTPUT_DIR}/heap_${TIMESTAMP}${suffix}.prof"
    echo -e "${YELLOW}Collecting heap profile...${NC}"

    curl -s "http://${APP_HOST}:${APP_PORT}/debug/pprof/heap" \
        -o "$output_file"

    if [ -s "$output_file" ]; then
        echo -e "${GREEN}Heap profile saved to: ${output_file}${NC}"
        echo "$output_file"
        return 0
    else
        echo -e "${RED}Failed to collect heap profile${NC}"
        rm -f "$output_file"
        return 1
    fi
}

# Collect allocs profile (all allocations since start)
collect_allocs_profile() {
    local output_file="${OUTPUT_DIR}/allocs_${TIMESTAMP}.prof"
    echo -e "${YELLOW}Collecting allocs profile...${NC}"

    curl -s "http://${APP_HOST}:${APP_PORT}/debug/pprof/allocs" \
        -o "$output_file"

    if [ -s "$output_file" ]; then
        echo -e "${GREEN}Allocs profile saved to: ${output_file}${NC}"
        return 0
    else
        echo -e "${RED}Failed to collect allocs profile${NC}"
        rm -f "$output_file"
        return 1
    fi
}

# Collect threadcreate profile
collect_threadcreate_profile() {
    local output_file="${OUTPUT_DIR}/threadcreate_${TIMESTAMP}.prof"
    echo -e "${YELLOW}Collecting thread creation profile...${NC}"

    curl -s "http://${APP_HOST}:${APP_PORT}/debug/pprof/threadcreate" \
        -o "$output_file"

    if [ -s "$output_file" ]; then
        echo -e "${GREEN}Thread creation profile saved to: ${output_file}${NC}"
        return 0
    else
        echo -e "${RED}Failed to collect thread creation profile${NC}"
        rm -f "$output_file"
        return 1
    fi
}

# Collect block profile
collect_block_profile() {
    local output_file="${OUTPUT_DIR}/block_${TIMESTAMP}.prof"
    echo -e "${YELLOW}Collecting block profile...${NC}"

    curl -s "http://${APP_HOST}:${APP_PORT}/debug/pprof/block" \
        -o "$output_file"

    if [ -s "$output_file" ]; then
        echo -e "${GREEN}Block profile saved to: ${output_file}${NC}"
        return 0
    else
        echo -e "${RED}Failed to collect block profile${NC}"
        rm -f "$output_file"
        return 1
    fi
}

# Analyze heap profile
analyze_heap() {
    local profile_file="$1"

    if [ ! -f "$profile_file" ]; then
        echo -e "${RED}Profile file not found: ${profile_file}${NC}"
        return 1
    fi

    echo -e "${YELLOW}Analyzing heap profile...${NC}"
    echo ""

    # Top by inuse_space (current allocations)
    echo -e "${BLUE}=== Top by In-Use Space ===${NC}"
    go tool pprof -top -inuse_space "$profile_file" 2>/dev/null | head -20
    echo ""

    # Top by inuse_objects (number of objects)
    echo -e "${BLUE}=== Top by In-Use Objects ===${NC}"
    go tool pprof -top -inuse_objects "$profile_file" 2>/dev/null | head -20
    echo ""

    # Top by alloc_space (total allocated)
    echo -e "${BLUE}=== Top by Allocated Space ===${NC}"
    go tool pprof -top -alloc_space "$profile_file" 2>/dev/null | head -20
    echo ""

    # Generate reports
    local report_file="${profile_file%.prof}_report.txt"
    {
        echo "Heap Profile Analysis - $(date)"
        echo "================================"
        echo ""
        echo "=== In-Use Space ==="
        go tool pprof -top -inuse_space "$profile_file" 2>/dev/null
        echo ""
        echo "=== In-Use Objects ==="
        go tool pprof -top -inuse_objects "$profile_file" 2>/dev/null
        echo ""
        echo "=== Allocated Space ==="
        go tool pprof -top -alloc_space "$profile_file" 2>/dev/null
    } > "$report_file"

    echo -e "${GREEN}Full report saved to: ${report_file}${NC}"
}

# Compare two heap profiles
compare_profiles() {
    local base_file="$1"
    local diff_file="$2"

    if [ ! -f "$base_file" ] || [ ! -f "$diff_file" ]; then
        echo -e "${RED}Both profile files must exist for comparison${NC}"
        return 1
    fi

    echo -e "${BLUE}=== Heap Comparison (diff from base to new) ===${NC}"
    go tool pprof -top -diff_base="$base_file" "$diff_file" 2>/dev/null | head -30
    echo ""
}

# Collect multiple heap snapshots for trending
collect_heap_trend() {
    local num_snapshots="${1:-5}"
    local interval="${2:-$INTERVAL}"

    echo -e "${YELLOW}Collecting ${num_snapshots} heap snapshots (${interval}s interval)...${NC}"

    local snapshots=()
    for i in $(seq 1 "$num_snapshots"); do
        echo -e "${BLUE}Snapshot $i of $num_snapshots${NC}"
        local file=$(collect_heap_profile "_snap${i}")
        if [ -n "$file" ]; then
            snapshots+=("$file")
        fi

        if [ "$i" -lt "$num_snapshots" ]; then
            echo "Waiting ${interval}s..."
            sleep "$interval"
        fi
    done

    echo ""
    echo -e "${GREEN}Collected ${#snapshots[@]} snapshots${NC}"

    # Compare first and last snapshot
    if [ ${#snapshots[@]} -ge 2 ]; then
        echo ""
        echo -e "${YELLOW}Comparing first and last snapshots...${NC}"
        compare_profiles "${snapshots[0]}" "${snapshots[-1]}"
    fi
}

# Generate SVG memory graph
generate_memory_svg() {
    local profile_file="$1"
    local svg_file="${profile_file%.prof}_inuse.svg"

    echo -e "${YELLOW}Generating memory SVG graph...${NC}"

    if go tool pprof -svg -inuse_space "$profile_file" > "$svg_file" 2>/dev/null; then
        echo -e "${GREEN}SVG saved to: ${svg_file}${NC}"
    else
        echo -e "${YELLOW}Could not generate SVG (graphviz may not be installed)${NC}"
    fi
}

# Print usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  heap       - Collect and analyze heap profile (default)"
    echo "  allocs     - Collect all allocations profile"
    echo "  all        - Collect all memory-related profiles"
    echo "  trend      - Collect multiple snapshots for memory trending"
    echo "  block      - Collect blocking operations profile"
    echo ""
    echo "Environment variables:"
    echo "  APP_HOST     - Application host (default: localhost)"
    echo "  APP_PORT     - Application port (default: 8080)"
    echo "  OUTPUT_DIR   - Output directory (default: ./profiles)"
    echo "  INTERVAL     - Seconds between trend snapshots (default: 10)"
    echo ""
}

# Main execution
main() {
    local command="${1:-heap}"

    if ! check_pprof; then
        exit 1
    fi

    echo ""

    case "$command" in
        heap)
            if collect_heap_profile; then
                analyze_heap "${OUTPUT_DIR}/heap_${TIMESTAMP}.prof"
                generate_memory_svg "${OUTPUT_DIR}/heap_${TIMESTAMP}.prof"
            fi
            ;;
        allocs)
            collect_allocs_profile
            ;;
        all)
            collect_heap_profile
            collect_allocs_profile
            collect_threadcreate_profile
            collect_block_profile
            echo ""
            analyze_heap "${OUTPUT_DIR}/heap_${TIMESTAMP}.prof"
            generate_memory_svg "${OUTPUT_DIR}/heap_${TIMESTAMP}.prof"
            ;;
        trend)
            collect_heap_trend 5 "$INTERVAL"
            ;;
        block)
            collect_block_profile
            ;;
        help|--help|-h)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown command: ${command}${NC}"
            usage
            exit 1
            ;;
    esac

    echo ""
    echo -e "${GREEN}=== Memory Profiling Complete ===${NC}"
    echo ""
    echo "To analyze interactively:"
    echo "  go tool pprof ${OUTPUT_DIR}/heap_${TIMESTAMP}.prof"
    echo ""
    echo "Useful pprof flags for memory analysis:"
    echo "  -inuse_space    - Show memory currently in use"
    echo "  -inuse_objects  - Show objects currently allocated"
    echo "  -alloc_space    - Show total memory allocated"
    echo "  -alloc_objects  - Show total objects allocated"
    echo ""
}

# Run main
main "$@"
