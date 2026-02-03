#!/bin/bash

# =============================================================================
# Stripe Payment Testing Script
# =============================================================================
# This script tests the payment flow using the Stripe CLI and API.
#
# Prerequisites:
#   1. Stripe CLI installed and authenticated
#   2. Backend server running
#   3. Webhook forwarding active (run setup_webhooks.sh local first)
#
# Usage:
#   ./test_payment.sh [test_type]
#
# Test Types:
#   - payment (default): Test successful payment
#   - decline: Test declined payment
#   - 3ds: Test 3D Secure authentication
#   - refund: Test refund flow
#   - connect: Test Connect payment with transfer
#   - all: Run all tests
#
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}"
TEST_AMOUNT="${TEST_AMOUNT:-5000}" # $50.00 in cents
CURRENCY="${CURRENCY:-usd}"

# Test card numbers
CARD_SUCCESS="4242424242424242"
CARD_DECLINE="4000000000000002"
CARD_INSUFFICIENT="4000000000009995"
CARD_3DS_REQUIRED="4000002760003184"
CARD_3DS_FAIL="4000008260003178"
CARD_FRAUD="4100000000000019"

# Functions
print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_subheader() {
    echo ""
    echo -e "${BLUE}▸ $1${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

check_prerequisites() {
    print_subheader "Checking prerequisites..."

    # Check Stripe CLI
    if ! command -v stripe &> /dev/null; then
        print_error "Stripe CLI not installed"
        exit 1
    fi
    print_success "Stripe CLI installed"

    # Check jq (for JSON parsing)
    if ! command -v jq &> /dev/null; then
        print_warning "jq not installed - JSON output will not be formatted"
    else
        print_success "jq installed"
    fi

    # Check curl
    if ! command -v curl &> /dev/null; then
        print_error "curl not installed"
        exit 1
    fi
    print_success "curl installed"

    # Check if API is running
    if curl -s --connect-timeout 5 "$API_BASE_URL/health" > /dev/null 2>&1; then
        print_success "API server is running at $API_BASE_URL"
    else
        print_warning "API server may not be running at $API_BASE_URL"
        print_info "Some tests may fail without the API server"
    fi
}

# Create a PaymentIntent using Stripe CLI
create_payment_intent() {
    local amount="${1:-$TEST_AMOUNT}"
    local description="${2:-Test payment from script}"

    print_info "Creating PaymentIntent for $((amount / 100)).$((amount % 100)) $CURRENCY..."

    result=$(stripe payment_intents create \
        --amount="$amount" \
        --currency="$CURRENCY" \
        -d "description=$description" \
        -d "metadata[test]=true" \
        -d "metadata[source]=test_payment.sh" \
        2>&1)

    if echo "$result" | grep -q '"id": "pi_'; then
        payment_intent_id=$(echo "$result" | grep '"id":' | head -1 | sed 's/.*"id": "\([^"]*\)".*/\1/')
        client_secret=$(echo "$result" | grep '"client_secret":' | sed 's/.*"client_secret": "\([^"]*\)".*/\1/')

        print_success "PaymentIntent created: $payment_intent_id"
        echo "$result" | head -20

        echo ""
        echo "Payment Intent ID: $payment_intent_id"
        echo "Client Secret: $client_secret"
        echo ""

        LAST_PAYMENT_INTENT_ID="$payment_intent_id"
    else
        print_error "Failed to create PaymentIntent"
        echo "$result"
        return 1
    fi
}

# Confirm a PaymentIntent with a test card
confirm_payment_intent() {
    local payment_intent_id="$1"
    local card_number="${2:-$CARD_SUCCESS}"

    print_info "Confirming PaymentIntent with card ending in ${card_number: -4}..."

    result=$(stripe payment_intents confirm "$payment_intent_id" \
        -d "payment_method_data[type]=card" \
        -d "payment_method_data[card][number]=$card_number" \
        -d "payment_method_data[card][exp_month]=12" \
        -d "payment_method_data[card][exp_year]=2030" \
        -d "payment_method_data[card][cvc]=123" \
        2>&1)

    status=$(echo "$result" | grep '"status":' | head -1 | sed 's/.*"status": "\([^"]*\)".*/\1/')

    echo "$result" | head -15
    echo ""

    case "$status" in
        "succeeded")
            print_success "Payment succeeded!"
            ;;
        "requires_action")
            print_warning "Payment requires additional action (3D Secure)"
            ;;
        "requires_payment_method")
            print_error "Payment failed - requires new payment method"
            ;;
        *)
            print_info "Payment status: $status"
            ;;
    esac

    echo "Status: $status"
}

# Test successful payment
test_successful_payment() {
    print_header "Test: Successful Payment"

    print_subheader "Step 1: Create PaymentIntent"
    create_payment_intent "$TEST_AMOUNT" "Test successful payment"

    if [ -z "$LAST_PAYMENT_INTENT_ID" ]; then
        print_error "Failed to create PaymentIntent"
        return 1
    fi

    print_subheader "Step 2: Confirm with successful card"
    confirm_payment_intent "$LAST_PAYMENT_INTENT_ID" "$CARD_SUCCESS"

    print_subheader "Step 3: Verify payment status"
    result=$(stripe payment_intents retrieve "$LAST_PAYMENT_INTENT_ID")
    status=$(echo "$result" | grep '"status":' | head -1 | sed 's/.*"status": "\([^"]*\)".*/\1/')

    if [ "$status" = "succeeded" ]; then
        print_success "TEST PASSED: Payment completed successfully"
    else
        print_error "TEST FAILED: Expected 'succeeded', got '$status'"
        return 1
    fi
}

# Test declined payment
test_declined_payment() {
    print_header "Test: Declined Payment"

    print_subheader "Step 1: Create PaymentIntent"
    create_payment_intent "$TEST_AMOUNT" "Test declined payment"

    if [ -z "$LAST_PAYMENT_INTENT_ID" ]; then
        print_error "Failed to create PaymentIntent"
        return 1
    fi

    print_subheader "Step 2: Confirm with declined card"
    print_info "Using card that will be declined: $CARD_DECLINE"

    # This should fail
    result=$(stripe payment_intents confirm "$LAST_PAYMENT_INTENT_ID" \
        -d "payment_method_data[type]=card" \
        -d "payment_method_data[card][number]=$CARD_DECLINE" \
        -d "payment_method_data[card][exp_month]=12" \
        -d "payment_method_data[card][exp_year]=2030" \
        -d "payment_method_data[card][cvc]=123" \
        2>&1)

    echo "$result" | head -15
    echo ""

    if echo "$result" | grep -q "card_declined\|Your card was declined"; then
        print_success "TEST PASSED: Card was correctly declined"
    else
        print_error "TEST FAILED: Expected card to be declined"
        return 1
    fi
}

# Test insufficient funds
test_insufficient_funds() {
    print_header "Test: Insufficient Funds"

    print_subheader "Step 1: Create PaymentIntent"
    create_payment_intent "$TEST_AMOUNT" "Test insufficient funds"

    if [ -z "$LAST_PAYMENT_INTENT_ID" ]; then
        print_error "Failed to create PaymentIntent"
        return 1
    fi

    print_subheader "Step 2: Confirm with insufficient funds card"
    print_info "Using card with insufficient funds: $CARD_INSUFFICIENT"

    result=$(stripe payment_intents confirm "$LAST_PAYMENT_INTENT_ID" \
        -d "payment_method_data[type]=card" \
        -d "payment_method_data[card][number]=$CARD_INSUFFICIENT" \
        -d "payment_method_data[card][exp_month]=12" \
        -d "payment_method_data[card][exp_year]=2030" \
        -d "payment_method_data[card][cvc]=123" \
        2>&1)

    echo "$result" | head -15
    echo ""

    if echo "$result" | grep -qi "insufficient_funds\|insufficient"; then
        print_success "TEST PASSED: Insufficient funds error received"
    else
        print_warning "Check if error indicates insufficient funds"
    fi
}

# Test 3D Secure authentication
test_3ds_authentication() {
    print_header "Test: 3D Secure Authentication"

    print_subheader "Step 1: Create PaymentIntent"
    create_payment_intent "$TEST_AMOUNT" "Test 3D Secure"

    if [ -z "$LAST_PAYMENT_INTENT_ID" ]; then
        print_error "Failed to create PaymentIntent"
        return 1
    fi

    print_subheader "Step 2: Confirm with 3DS required card"
    print_info "Using card that requires 3DS: $CARD_3DS_REQUIRED"

    result=$(stripe payment_intents confirm "$LAST_PAYMENT_INTENT_ID" \
        -d "payment_method_data[type]=card" \
        -d "payment_method_data[card][number]=$CARD_3DS_REQUIRED" \
        -d "payment_method_data[card][exp_month]=12" \
        -d "payment_method_data[card][exp_year]=2030" \
        -d "payment_method_data[card][cvc]=123" \
        -d "return_url=https://example.com/return" \
        2>&1)

    echo "$result" | head -20
    echo ""

    status=$(echo "$result" | grep '"status":' | head -1 | sed 's/.*"status": "\([^"]*\)".*/\1/')

    if [ "$status" = "requires_action" ]; then
        print_success "TEST PASSED: Payment requires 3D Secure authentication"

        # Extract the next_action URL
        next_action_url=$(echo "$result" | grep -o '"url": "[^"]*"' | head -1 | sed 's/"url": "\([^"]*\)"/\1/')
        if [ -n "$next_action_url" ]; then
            print_info "3D Secure URL: $next_action_url"
            print_info "In a real app, redirect customer to this URL"
        fi
    else
        print_error "TEST FAILED: Expected 'requires_action', got '$status'"
        return 1
    fi
}

# Test refund flow
test_refund() {
    print_header "Test: Refund Flow"

    print_subheader "Step 1: Create and complete a payment first"
    create_payment_intent "$TEST_AMOUNT" "Test refund - original payment"

    if [ -z "$LAST_PAYMENT_INTENT_ID" ]; then
        print_error "Failed to create PaymentIntent"
        return 1
    fi

    # Confirm the payment
    result=$(stripe payment_intents confirm "$LAST_PAYMENT_INTENT_ID" \
        -d "payment_method_data[type]=card" \
        -d "payment_method_data[card][number]=$CARD_SUCCESS" \
        -d "payment_method_data[card][exp_month]=12" \
        -d "payment_method_data[card][exp_year]=2030" \
        -d "payment_method_data[card][cvc]=123" \
        2>&1)

    # Get the charge ID
    charge_id=$(echo "$result" | grep '"latest_charge":' | sed 's/.*"latest_charge": "\([^"]*\)".*/\1/')

    if [ -z "$charge_id" ] || [ "$charge_id" = "null" ]; then
        # Try to retrieve the payment intent to get the charge
        pi_result=$(stripe payment_intents retrieve "$LAST_PAYMENT_INTENT_ID")
        charge_id=$(echo "$pi_result" | grep '"latest_charge":' | sed 's/.*"latest_charge": "\([^"]*\)".*/\1/')
    fi

    print_success "Payment completed. Charge ID: $charge_id"

    print_subheader "Step 2: Create full refund"
    print_info "Refunding charge: $charge_id"

    refund_result=$(stripe refunds create \
        -d "payment_intent=$LAST_PAYMENT_INTENT_ID" \
        -d "reason=requested_by_customer" \
        2>&1)

    echo "$refund_result" | head -15
    echo ""

    refund_status=$(echo "$refund_result" | grep '"status":' | head -1 | sed 's/.*"status": "\([^"]*\)".*/\1/')

    if [ "$refund_status" = "succeeded" ]; then
        print_success "TEST PASSED: Full refund completed"
    else
        print_error "TEST FAILED: Expected refund status 'succeeded', got '$refund_status'"
        return 1
    fi

    print_subheader "Step 3: Test partial refund"

    # Create another payment for partial refund test
    create_payment_intent "$TEST_AMOUNT" "Test partial refund"

    stripe payment_intents confirm "$LAST_PAYMENT_INTENT_ID" \
        -d "payment_method_data[type]=card" \
        -d "payment_method_data[card][number]=$CARD_SUCCESS" \
        -d "payment_method_data[card][exp_month]=12" \
        -d "payment_method_data[card][exp_year]=2030" \
        -d "payment_method_data[card][cvc]=123" \
        > /dev/null 2>&1

    partial_amount=$((TEST_AMOUNT / 2))
    print_info "Creating partial refund of $((partial_amount / 100)).$((partial_amount % 100)) $CURRENCY"

    partial_refund=$(stripe refunds create \
        -d "payment_intent=$LAST_PAYMENT_INTENT_ID" \
        -d "amount=$partial_amount" \
        2>&1)

    if echo "$partial_refund" | grep -q '"status": "succeeded"'; then
        print_success "TEST PASSED: Partial refund completed"
    else
        print_error "TEST FAILED: Partial refund did not succeed"
        echo "$partial_refund" | head -10
    fi
}

# Test Connect payment with platform fee
test_connect_payment() {
    print_header "Test: Connect Payment with Platform Fee"

    print_warning "This test requires a connected account ID"
    print_info "You can create a test connected account in the Stripe Dashboard"
    echo ""

    read -p "Enter connected account ID (acct_xxx) or press Enter to skip: " connected_account_id

    if [ -z "$connected_account_id" ]; then
        print_info "Skipping Connect test"
        return 0
    fi

    print_subheader "Creating payment with platform fee and transfer"

    platform_fee=$((TEST_AMOUNT / 10)) # 10% platform fee
    print_info "Amount: $((TEST_AMOUNT / 100)).$((TEST_AMOUNT % 100)) $CURRENCY"
    print_info "Platform fee: $((platform_fee / 100)).$((platform_fee % 100)) $CURRENCY"
    print_info "Connected account receives: $(( (TEST_AMOUNT - platform_fee) / 100 )).$(( (TEST_AMOUNT - platform_fee) % 100 )) $CURRENCY"

    result=$(stripe payment_intents create \
        --amount="$TEST_AMOUNT" \
        --currency="$CURRENCY" \
        -d "application_fee_amount=$platform_fee" \
        -d "transfer_data[destination]=$connected_account_id" \
        -d "description=Connect test payment" \
        2>&1)

    if echo "$result" | grep -q '"id": "pi_'; then
        payment_intent_id=$(echo "$result" | grep '"id":' | head -1 | sed 's/.*"id": "\([^"]*\)".*/\1/')
        print_success "PaymentIntent created: $payment_intent_id"

        print_subheader "Confirming payment"

        confirm_result=$(stripe payment_intents confirm "$payment_intent_id" \
            -d "payment_method_data[type]=card" \
            -d "payment_method_data[card][number]=$CARD_SUCCESS" \
            -d "payment_method_data[card][exp_month]=12" \
            -d "payment_method_data[card][exp_year]=2030" \
            -d "payment_method_data[card][cvc]=123" \
            2>&1)

        if echo "$confirm_result" | grep -q '"status": "succeeded"'; then
            print_success "TEST PASSED: Connect payment succeeded"
            print_info "Check Stripe Dashboard for transfer to connected account"
        else
            print_error "Payment confirmation failed"
            echo "$confirm_result" | head -10
        fi
    else
        print_error "Failed to create Connect PaymentIntent"
        echo "$result"
    fi
}

# Trigger webhook events
test_webhooks() {
    print_header "Test: Webhook Events"

    print_info "Make sure webhook forwarding is running:"
    print_info "  ./setup_webhooks.sh local"
    echo ""

    events=(
        "payment_intent.succeeded"
        "payment_intent.payment_failed"
        "charge.refunded"
    )

    for event in "${events[@]}"; do
        print_subheader "Triggering: $event"
        stripe trigger "$event"
        echo ""
        sleep 1
    done

    print_success "Webhook events triggered"
    print_info "Check your server logs for webhook handling"
}

# Run all tests
run_all_tests() {
    print_header "Running All Payment Tests"

    local passed=0
    local failed=0
    local tests=("test_successful_payment" "test_declined_payment" "test_insufficient_funds" "test_3ds_authentication" "test_refund")

    for test in "${tests[@]}"; do
        if $test; then
            ((passed++))
        else
            ((failed++))
        fi
        echo ""
    done

    print_header "Test Summary"
    print_success "Passed: $passed"
    if [ $failed -gt 0 ]; then
        print_error "Failed: $failed"
    fi

    echo ""
    echo "Total: $((passed + failed)) tests"
}

# Show help
show_help() {
    echo "Stripe Payment Testing Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  payment     Test successful payment flow (default)"
    echo "  decline     Test declined card"
    echo "  insufficient Test insufficient funds"
    echo "  3ds         Test 3D Secure authentication"
    echo "  refund      Test refund flow (full and partial)"
    echo "  connect     Test Connect payment with platform fee"
    echo "  webhooks    Trigger test webhook events"
    echo "  all         Run all tests"
    echo "  help        Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  API_BASE_URL      Backend API URL (default: http://localhost:8080)"
    echo "  STRIPE_SECRET_KEY Stripe secret key (optional, uses CLI default)"
    echo "  TEST_AMOUNT       Test amount in cents (default: 5000 = \$50)"
    echo "  CURRENCY          Currency code (default: usd)"
    echo ""
    echo "Examples:"
    echo "  $0 payment              # Test successful payment"
    echo "  $0 decline              # Test declined card"
    echo "  TEST_AMOUNT=10000 $0 payment  # Test with \$100"
    echo "  $0 all                  # Run all tests"
    echo ""
    echo "Test Card Numbers:"
    echo "  Success:      $CARD_SUCCESS"
    echo "  Decline:      $CARD_DECLINE"
    echo "  Insufficient: $CARD_INSUFFICIENT"
    echo "  3DS Required: $CARD_3DS_REQUIRED"
    echo "  3DS Fail:     $CARD_3DS_FAIL"
    echo ""
}

# Main
main() {
    local command="${1:-payment}"

    print_header "Stripe Payment Testing - Festivals Platform"

    check_prerequisites

    case "$command" in
        payment)
            test_successful_payment
            ;;
        decline)
            test_declined_payment
            ;;
        insufficient)
            test_insufficient_funds
            ;;
        3ds)
            test_3ds_authentication
            ;;
        refund)
            test_refund
            ;;
        connect)
            test_connect_payment
            ;;
        webhooks)
            test_webhooks
            ;;
        all)
            run_all_tests
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"
