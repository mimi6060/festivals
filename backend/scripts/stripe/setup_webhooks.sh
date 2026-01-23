#!/bin/bash

# =============================================================================
# Stripe Webhooks Setup Script
# =============================================================================
# This script creates and configures Stripe webhook endpoints using the Stripe CLI.
#
# Prerequisites:
#   1. Stripe CLI installed: https://stripe.com/docs/stripe-cli
#   2. Stripe CLI authenticated: stripe login
#
# Usage:
#   ./setup_webhooks.sh [environment]
#
# Environments:
#   - local (default): Sets up webhook forwarding for local development
#   - staging: Creates webhook endpoint for staging environment
#   - production: Creates webhook endpoint for production environment
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-local}"
LOCAL_PORT="${LOCAL_PORT:-8080}"
WEBHOOK_PATH="/api/webhooks/stripe"

# Environment-specific URLs
STAGING_URL="${STAGING_URL:-https://staging-api.festivals.example.com}"
PRODUCTION_URL="${PRODUCTION_URL:-https://api.festivals.example.com}"

# Events to subscribe to
EVENTS=(
    # Payment events
    "payment_intent.succeeded"
    "payment_intent.payment_failed"
    "payment_intent.canceled"
    "payment_intent.requires_action"
    "payment_intent.created"

    # Charge events
    "charge.succeeded"
    "charge.failed"
    "charge.refunded"
    "charge.dispute.created"
    "charge.dispute.closed"
    "charge.dispute.updated"

    # Checkout events (if using Stripe Checkout)
    "checkout.session.completed"
    "checkout.session.expired"

    # Connect events
    "account.updated"
    "account.application.authorized"
    "account.application.deauthorized"
    "account.external_account.created"
    "account.external_account.deleted"

    # Transfer events
    "transfer.created"
    "transfer.failed"
    "transfer.reversed"
    "transfer.updated"

    # Payout events
    "payout.created"
    "payout.paid"
    "payout.failed"
    "payout.canceled"

    # Customer events (optional)
    "customer.created"
    "customer.updated"

    # Refund events
    "refund.created"
    "refund.updated"
)

# Functions
print_header() {
    echo ""
    echo -e "${BLUE}=============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=============================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

check_stripe_cli() {
    print_info "Checking Stripe CLI installation..."

    if ! command -v stripe &> /dev/null; then
        print_error "Stripe CLI is not installed."
        echo ""
        echo "Please install the Stripe CLI:"
        echo "  macOS:   brew install stripe/stripe-cli/stripe"
        echo "  Linux:   See https://stripe.com/docs/stripe-cli#install"
        echo "  Windows: scoop install stripe"
        echo ""
        exit 1
    fi

    print_success "Stripe CLI is installed"
}

check_stripe_login() {
    print_info "Checking Stripe CLI authentication..."

    if ! stripe config --list &> /dev/null; then
        print_warning "Stripe CLI is not authenticated."
        echo ""
        echo "Please run: stripe login"
        echo ""
        read -p "Would you like to login now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            stripe login
        else
            exit 1
        fi
    fi

    print_success "Stripe CLI is authenticated"
}

get_events_string() {
    local events_str=""
    for event in "${EVENTS[@]}"; do
        if [ -z "$events_str" ]; then
            events_str="$event"
        else
            events_str="$events_str,$event"
        fi
    done
    echo "$events_str"
}

setup_local_webhook() {
    print_header "Setting up Local Webhook Forwarding"

    local endpoint_url="http://localhost:${LOCAL_PORT}${WEBHOOK_PATH}"
    local events_str=$(get_events_string)

    print_info "Endpoint: $endpoint_url"
    print_info "Subscribing to ${#EVENTS[@]} events"
    echo ""

    echo "Events being subscribed to:"
    for event in "${EVENTS[@]}"; do
        echo "  - $event"
    done
    echo ""

    print_warning "This will start webhook forwarding in the foreground."
    print_warning "Keep this terminal open while testing."
    echo ""

    read -p "Start webhook forwarding? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        print_info "Starting webhook forwarding..."
        print_info "Webhook signing secret will be displayed below."
        print_info "Add this to your .env as STRIPE_WEBHOOK_SECRET"
        echo ""

        # Start forwarding
        stripe listen --forward-to "$endpoint_url" --events "$events_str"
    fi
}

setup_remote_webhook() {
    local env_name="$1"
    local base_url="$2"
    local endpoint_url="${base_url}${WEBHOOK_PATH}"

    print_header "Setting up $env_name Webhook Endpoint"

    print_info "Endpoint URL: $endpoint_url"
    print_info "Subscribing to ${#EVENTS[@]} events"
    echo ""

    echo "Events to subscribe:"
    for event in "${EVENTS[@]}"; do
        echo "  - $event"
    done
    echo ""

    read -p "Create webhook endpoint? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Skipped."
        return
    fi

    # Build events array for API call
    local events_json="["
    local first=true
    for event in "${EVENTS[@]}"; do
        if [ "$first" = true ]; then
            events_json+="\"$event\""
            first=false
        else
            events_json+=",\"$event\""
        fi
    done
    events_json+="]"

    echo ""
    print_info "Creating webhook endpoint..."

    # Create webhook endpoint using Stripe CLI
    result=$(stripe webhook_endpoints create \
        --url="$endpoint_url" \
        --enabled-events="$(get_events_string)" \
        2>&1)

    if echo "$result" | grep -q "whsec_"; then
        print_success "Webhook endpoint created successfully!"
        echo ""

        # Extract webhook secret
        webhook_id=$(echo "$result" | grep '"id":' | head -1 | sed 's/.*"id": "\([^"]*\)".*/\1/')

        echo "Webhook Details:"
        echo "$result" | grep -E '"id"|"url"|"secret"' | sed 's/^/  /'
        echo ""

        print_warning "IMPORTANT: Save the webhook signing secret!"
        print_warning "Add it to your $env_name .env file as STRIPE_WEBHOOK_SECRET"
        echo ""

        # Get the signing secret
        print_info "To view the signing secret later, run:"
        echo "  stripe webhook_endpoints list"
        echo ""

    else
        print_error "Failed to create webhook endpoint"
        echo "$result"
        exit 1
    fi
}

list_webhooks() {
    print_header "Current Webhook Endpoints"

    stripe webhook_endpoints list
}

delete_webhook() {
    print_header "Delete Webhook Endpoint"

    # List current webhooks
    echo "Current webhook endpoints:"
    stripe webhook_endpoints list
    echo ""

    read -p "Enter webhook endpoint ID to delete (we_xxx): " webhook_id

    if [ -z "$webhook_id" ]; then
        print_info "No ID provided. Skipping."
        return
    fi

    read -p "Are you sure you want to delete $webhook_id? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        stripe webhook_endpoints delete "$webhook_id"
        print_success "Webhook endpoint deleted"
    fi
}

trigger_test_event() {
    print_header "Trigger Test Event"

    echo "Available test events:"
    echo "  1. payment_intent.succeeded"
    echo "  2. payment_intent.payment_failed"
    echo "  3. charge.refunded"
    echo "  4. account.updated"
    echo "  5. checkout.session.completed"
    echo "  6. Custom event"
    echo ""

    read -p "Select event to trigger (1-6): " choice

    case $choice in
        1) event="payment_intent.succeeded" ;;
        2) event="payment_intent.payment_failed" ;;
        3) event="charge.refunded" ;;
        4) event="account.updated" ;;
        5) event="checkout.session.completed" ;;
        6)
            read -p "Enter custom event name: " event
            ;;
        *)
            print_error "Invalid choice"
            return
            ;;
    esac

    print_info "Triggering event: $event"
    stripe trigger "$event"
}

show_help() {
    echo "Stripe Webhooks Setup Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  local       Set up local webhook forwarding (default)"
    echo "  staging     Create webhook endpoint for staging"
    echo "  production  Create webhook endpoint for production"
    echo "  list        List current webhook endpoints"
    echo "  delete      Delete a webhook endpoint"
    echo "  trigger     Trigger a test webhook event"
    echo "  help        Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  LOCAL_PORT      Local server port (default: 8080)"
    echo "  STAGING_URL     Staging API base URL"
    echo "  PRODUCTION_URL  Production API base URL"
    echo ""
    echo "Examples:"
    echo "  $0 local                    # Start local webhook forwarding"
    echo "  $0 staging                  # Create staging webhook"
    echo "  LOCAL_PORT=3000 $0 local    # Forward to port 3000"
    echo ""
}

# Main script
main() {
    print_header "Stripe Webhook Setup for Festivals Platform"

    check_stripe_cli
    check_stripe_login

    case "$ENVIRONMENT" in
        local)
            setup_local_webhook
            ;;
        staging)
            setup_remote_webhook "Staging" "$STAGING_URL"
            ;;
        production)
            print_warning "You are about to create a PRODUCTION webhook endpoint."
            read -p "Are you sure? (yes/no) " confirm
            if [ "$confirm" = "yes" ]; then
                setup_remote_webhook "Production" "$PRODUCTION_URL"
            else
                print_info "Cancelled."
            fi
            ;;
        list)
            list_webhooks
            ;;
        delete)
            delete_webhook
            ;;
        trigger)
            trigger_test_event
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $ENVIRONMENT"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main
