#!/bin/bash

# Trace Analysis Script for Festivals Backend
# This script collects and analyzes execution traces

set -e

# Configuration
APP_HOST="${APP_HOST:-localhost}"
APP_PORT="${APP_PORT:-8080}"
TRACE_DURATION="${TRACE_DURATION:-5}"
OUTPUT_DIR="${OUTPUT_DIR:-./profiles}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${GREEN}=== Trace Analysis Script ===${NC}"
echo "Target: http://${APP_HOST}:${APP_PORT}"
echo "Duration: ${TRACE_DURATION}s"
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

# Collect execution trace
collect_trace() {
    local output_file="${OUTPUT_DIR}/trace_${TIMESTAMP}.out"
    echo -e "${YELLOW}Collecting execution trace for ${TRACE_DURATION}s...${NC}"
    echo "This will capture scheduling, goroutine creation, GC events, etc."

    curl -s "http://${APP_HOST}:${APP_PORT}/debug/pprof/trace?seconds=${TRACE_DURATION}" \
        -o "$output_file"

    if [ -s "$output_file" ]; then
        echo -e "${GREEN}Trace saved to: ${output_file}${NC}"
        echo "$output_file"
        return 0
    else
        echo -e "${RED}Failed to collect trace${NC}"
        rm -f "$output_file"
        return 1
    fi
}

# Collect mutex contention profile
collect_mutex_profile() {
    local output_file="${OUTPUT_DIR}/mutex_${TIMESTAMP}.prof"
    echo -e "${YELLOW}Collecting mutex contention profile...${NC}"

    curl -s "http://${APP_HOST}:${APP_PORT}/debug/pprof/mutex" \
        -o "$output_file"

    if [ -s "$output_file" ]; then
        echo -e "${GREEN}Mutex profile saved to: ${output_file}${NC}"
        return 0
    else
        echo -e "${RED}Failed to collect mutex profile${NC}"
        rm -f "$output_file"
        return 1
    fi
}

# Collect goroutine dump
collect_goroutine_dump() {
    local output_file="${OUTPUT_DIR}/goroutines_${TIMESTAMP}.txt"
    echo -e "${YELLOW}Collecting goroutine dump...${NC}"

    curl -s "http://${APP_HOST}:${APP_PORT}/debug/pprof/goroutine?debug=2" \
        -o "$output_file"

    if [ -s "$output_file" ]; then
        echo -e "${GREEN}Goroutine dump saved to: ${output_file}${NC}"

        # Count goroutines by state
        echo ""
        echo -e "${BLUE}Goroutine Summary:${NC}"
        local total=$(grep -c "^goroutine" "$output_file" 2>/dev/null || echo "0")
        echo "  Total goroutines: $total"

        # Count by state
        echo "  By state:"
        grep -o '\[.*\]' "$output_file" 2>/dev/null | sort | uniq -c | while read count state; do
            echo "    $state: $count"
        done

        return 0
    else
        echo -e "${RED}Failed to collect goroutine dump${NC}"
        rm -f "$output_file"
        return 1
    fi
}

# Analyze trace file
analyze_trace() {
    local trace_file="$1"

    if [ ! -f "$trace_file" ]; then
        echo -e "${RED}Trace file not found: ${trace_file}${NC}"
        return 1
    fi

    echo ""
    echo -e "${YELLOW}Opening trace viewer...${NC}"
    echo "This will open a web browser with the trace visualization"
    echo ""
    echo "In the trace viewer, look for:"
    echo "  - Long goroutine blocks (scheduling latency)"
    echo "  - GC pauses (stop-the-world events)"
    echo "  - Syscall latency"
    echo "  - Network blocking"
    echo ""

    # Open trace in browser
    go tool trace "$trace_file"
}

# Generate trace summary
generate_trace_summary() {
    local trace_file="$1"
    local summary_file="${trace_file%.out}_summary.txt"

    if [ ! -f "$trace_file" ]; then
        echo -e "${RED}Trace file not found${NC}"
        return 1
    fi

    echo -e "${YELLOW}Generating trace summary...${NC}"

    # Extract basic info from trace (this is limited without the trace tool)
    {
        echo "Trace Summary - $(date)"
        echo "========================"
        echo ""
        echo "Trace file: $trace_file"
        echo "File size: $(ls -lh "$trace_file" | awk '{print $5}')"
        echo ""
        echo "To analyze this trace, run:"
        echo "  go tool trace $trace_file"
        echo ""
        echo "Key metrics to look for:"
        echo "  - Scheduler latency: time between goroutine becoming runnable and running"
        echo "  - GC pause time: stop-the-world garbage collection pauses"
        echo "  - Syscall duration: time spent in system calls"
        echo "  - Network wait: time waiting for network I/O"
        echo ""
    } > "$summary_file"

    echo -e "${GREEN}Summary saved to: ${summary_file}${NC}"
}

# Analyze mutex contention
analyze_mutex() {
    local profile_file="$1"

    if [ ! -f "$profile_file" ]; then
        echo -e "${RED}Mutex profile not found${NC}"
        return 1
    fi

    echo ""
    echo -e "${BLUE}=== Mutex Contention Analysis ===${NC}"
    go tool pprof -top "$profile_file" 2>/dev/null | head -20
    echo ""
}

# Detect potential issues
detect_issues() {
    local goroutine_file="${OUTPUT_DIR}/goroutines_${TIMESTAMP}.txt"

    if [ ! -f "$goroutine_file" ]; then
        return 0
    fi

    echo ""
    echo -e "${BLUE}=== Potential Issues ===${NC}"

    # Check for goroutine leaks (high number of goroutines in same state)
    local running=$(grep -c '\[running\]' "$goroutine_file" 2>/dev/null || echo "0")
    local waiting=$(grep -c '\[chan receive\]' "$goroutine_file" 2>/dev/null || echo "0")
    local sleeping=$(grep -c '\[sleep\]' "$goroutine_file" 2>/dev/null || echo "0")
    local select_wait=$(grep -c '\[select\]' "$goroutine_file" 2>/dev/null || echo "0")
    local io_wait=$(grep -c '\[IO wait\]' "$goroutine_file" 2>/dev/null || echo "0")

    if [ "$waiting" -gt 100 ]; then
        echo -e "${YELLOW}WARNING: $waiting goroutines waiting on channel receive${NC}"
        echo "  This may indicate blocked workers or missing channel senders"
    fi

    if [ "$io_wait" -gt 50 ]; then
        echo -e "${YELLOW}NOTE: $io_wait goroutines in IO wait${NC}"
        echo "  This is normal for network-heavy applications"
    fi

    local total=$(grep -c "^goroutine" "$goroutine_file" 2>/dev/null || echo "0")
    if [ "$total" -gt 10000 ]; then
        echo -e "${RED}WARNING: Very high goroutine count ($total)${NC}"
        echo "  This may indicate a goroutine leak"
    fi

    # Check for deadlocks (goroutines all waiting)
    if [ "$running" -eq 0 ] && [ "$total" -gt 0 ]; then
        echo -e "${RED}WARNING: No running goroutines - possible deadlock!${NC}"
    fi

    echo ""
}

# Print usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  trace      - Collect and analyze execution trace (default)"
    echo "  mutex      - Collect mutex contention profile"
    echo "  goroutines - Collect goroutine dump"
    echo "  all        - Collect all tracing data"
    echo "  view FILE  - Open trace file in viewer"
    echo ""
    echo "Environment variables:"
    echo "  APP_HOST        - Application host (default: localhost)"
    echo "  APP_PORT        - Application port (default: 8080)"
    echo "  TRACE_DURATION  - Trace duration in seconds (default: 5)"
    echo "  OUTPUT_DIR      - Output directory (default: ./profiles)"
    echo ""
}

# Main execution
main() {
    local command="${1:-trace}"

    case "$command" in
        trace)
            if ! check_pprof; then
                exit 1
            fi
            echo ""
            local trace_file=$(collect_trace)
            if [ -n "$trace_file" ]; then
                generate_trace_summary "$trace_file"
                collect_goroutine_dump
                detect_issues
                echo ""
                echo -e "${GREEN}=== Trace Collection Complete ===${NC}"
                echo ""
                echo "To view the trace interactively, run:"
                echo "  go tool trace $trace_file"
            fi
            ;;
        mutex)
            if ! check_pprof; then
                exit 1
            fi
            echo ""
            collect_mutex_profile
            analyze_mutex "${OUTPUT_DIR}/mutex_${TIMESTAMP}.prof"
            ;;
        goroutines)
            if ! check_pprof; then
                exit 1
            fi
            echo ""
            collect_goroutine_dump
            detect_issues
            ;;
        all)
            if ! check_pprof; then
                exit 1
            fi
            echo ""
            collect_trace
            collect_mutex_profile
            collect_goroutine_dump
            echo ""
            detect_issues
            echo ""
            echo -e "${GREEN}=== All Traces Collected ===${NC}"
            echo ""
            echo "Files in ${OUTPUT_DIR}:"
            ls -la "${OUTPUT_DIR}/"*_${TIMESTAMP}* 2>/dev/null || echo "  (none)"
            ;;
        view)
            local trace_file="$2"
            if [ -z "$trace_file" ]; then
                echo -e "${RED}Please specify a trace file${NC}"
                exit 1
            fi
            analyze_trace "$trace_file"
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
}

# Run main
main "$@"
