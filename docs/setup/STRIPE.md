# Stripe Connect Setup Guide for Festivals Platform

This guide walks you through setting up Stripe Connect for the Festivals platform, enabling payment processing for ticket sales with automatic splits to festival organizers.

## Table of Contents

- [Part 1: Create Stripe Account](#part-1-create-stripe-account)
- [Part 2: Enable Stripe Connect](#part-2-enable-stripe-connect)
- [Part 3: Configure Connect Settings](#part-3-configure-connect-settings)
- [Part 4: Webhooks Setup](#part-4-webhooks-setup)
- [Part 5: Get API Keys](#part-5-get-api-keys)
- [Part 6: Test Cards](#part-6-test-cards)
- [Part 7: Integration Checklist](#part-7-integration-checklist)
- [Part 8: Go Live Checklist](#part-8-go-live-checklist)
- [Troubleshooting](#troubleshooting)

---

## Part 1: Create Stripe Account

### Step 1: Sign Up

1. Navigate to [https://stripe.com](https://stripe.com)
2. Click **Start now** or **Create account**
3. Enter your email address and create a password
4. Verify your email address

### Step 2: Complete Business Profile

You will need the following information:

| Information | Description |
|-------------|-------------|
| Business name | Legal name of your platform (e.g., "Festivals Platform Inc.") |
| Business type | Select appropriate type (LLC, Corporation, Sole Proprietor, etc.) |
| Business address | Physical address of your business |
| Tax ID (EIN) | For US businesses, your Employer Identification Number |
| Business website | Your platform URL |
| Industry | Select "Event Management" or "Ticketing" |
| Business description | Brief description of your festival ticketing platform |

### Step 3: Enable Test Mode

**IMPORTANT**: Always start in Test Mode to avoid processing real payments during development.

1. In the Stripe Dashboard, look at the top-right corner
2. Ensure the toggle shows **Test mode** (orange/yellow indicator)
3. All API keys and operations will be in test mode

> **Note**: Test mode uses completely separate data from live mode. Test transactions, customers, and connected accounts do not affect live data.

---

## Part 2: Enable Stripe Connect

Stripe Connect allows the Festivals platform to process payments on behalf of festival organizers and automatically split funds.

### Step 1: Access Connect Settings

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Connect** in the left sidebar
3. Click **Get started** if this is your first time

### Step 2: Platform Profile Setup

1. Go to **Connect** > **Settings**
2. Fill out your platform profile:
   - **Platform name**: "Festivals Platform"
   - **Platform URL**: Your production URL
   - **Support email**: support@yourplatform.com
   - **Support phone**: Your support phone number

### Step 3: Branding Configuration

Configure the branding that connected accounts (festival organizers) will see:

1. Go to **Connect** > **Settings** > **Branding**
2. Upload your platform logo (recommended: 512x512px PNG)
3. Set your brand color (hex code)
4. Configure the icon for the Connect onboarding flow

### Step 4: Choose Account Type

For the Festivals platform, we recommend **Express** accounts:

| Account Type | Best For | Platform Control | User Experience |
|--------------|----------|------------------|-----------------|
| **Express** (Recommended) | Most use cases | Medium | Stripe-hosted onboarding |
| Standard | Minimal platform involvement | Low | Full Stripe Dashboard access |
| Custom | Full control needed | High | Custom-built onboarding |

**Why Express for Festivals:**

- Simplified onboarding for festival organizers
- Stripe handles identity verification and compliance
- Organizers get a limited dashboard to view payouts
- Lower implementation complexity
- Automatic handling of tax forms (1099s)

To configure Express accounts:

1. Go to **Connect** > **Settings** > **Connect onboarding options**
2. Select **Express** as the default account type
3. Configure which information to collect:
   - Business information (required)
   - Bank account for payouts (required)
   - Identity verification (automatic)

---

## Part 3: Configure Connect Settings

### Step 1: Payout Schedule

Configure when connected accounts (festival organizers) receive their funds:

1. Go to **Connect** > **Settings** > **Payouts**
2. Configure the payout schedule:

| Setting | Recommended Value | Description |
|---------|-------------------|-------------|
| Payout speed | 2 business days | Standard for most regions |
| Payout schedule | Daily (automatic) | Funds transfer daily after holding period |
| Minimum payout | $1.00 | Minimum amount before payout triggers |

### Step 2: Platform Fees

Configure how the platform earns revenue from transactions:

#### Option A: Percentage-Based Fee

```
Platform fee: 5% of transaction
Example: $100 ticket sale
- Platform receives: $5.00
- Festival organizer receives: $95.00 (minus Stripe fees)
```

#### Option B: Fixed Fee Per Transaction

```
Platform fee: $0.50 per transaction
Example: $100 ticket sale
- Platform receives: $0.50
- Festival organizer receives: $99.50 (minus Stripe fees)
```

#### Option C: Combined Fee (Recommended)

```
Platform fee: 3% + $0.30 per transaction
Example: $100 ticket sale
- Platform receives: $3.30
- Festival organizer receives: $96.70 (minus Stripe fees)
```

**Implementation**: Fees are set per transaction in the code when creating PaymentIntents:

```go
// Example: 5% platform fee
applicationFeeAmount := int64(amount * 0.05)

paymentIntent, err := paymentintent.New(&stripe.PaymentIntentParams{
    Amount:               stripe.Int64(amount),
    Currency:             stripe.String("usd"),
    ApplicationFeeAmount: stripe.Int64(applicationFeeAmount),
    TransferData: &stripe.PaymentIntentTransferDataParams{
        Destination: stripe.String(connectedAccountID),
    },
})
```

### Step 3: Transfer Settings

Configure how funds move between accounts:

1. Go to **Connect** > **Settings** > **Transfers**
2. Enable **Separate charges and transfers** for flexibility
3. Configure automatic transfers or manual control

**Transfer Types:**

| Type | Description | Use Case |
|------|-------------|----------|
| Destination charges | Funds go directly to connected account | Simple ticket sales |
| Separate transfers | Platform holds funds, transfers later | Refund handling, complex splits |

---

## Part 4: Webhooks Setup

Webhooks allow Stripe to notify your platform of events in real-time.

### Step 1: Create Webhook Endpoint

1. Go to **Developers** > **Webhooks**
2. Click **Add endpoint**
3. Enter your endpoint URL:
   - Development: `https://your-ngrok-url.ngrok.io/api/webhooks/stripe`
   - Staging: `https://staging-api.yourplatform.com/api/webhooks/stripe`
   - Production: `https://api.yourplatform.com/api/webhooks/stripe`

### Step 2: Subscribe to Events

Select the following events for the Festivals platform:

#### Payment Events

| Event | Description | Required |
|-------|-------------|----------|
| `payment_intent.succeeded` | Payment completed successfully | Yes |
| `payment_intent.payment_failed` | Payment failed | Yes |
| `payment_intent.canceled` | Payment was canceled | Yes |
| `payment_intent.requires_action` | 3D Secure or additional action needed | Yes |

#### Charge Events

| Event | Description | Required |
|-------|-------------|----------|
| `charge.succeeded` | Charge was successful | Yes |
| `charge.failed` | Charge failed | Yes |
| `charge.refunded` | Charge was refunded | Yes |
| `charge.dispute.created` | Customer disputed charge | Yes |
| `charge.dispute.closed` | Dispute was resolved | Yes |

#### Connect Events

| Event | Description | Required |
|-------|-------------|----------|
| `account.updated` | Connected account was updated | Yes |
| `account.application.authorized` | Account authorized your platform | Yes |
| `account.application.deauthorized` | Account removed authorization | Yes |

#### Transfer Events

| Event | Description | Required |
|-------|-------------|----------|
| `transfer.created` | Transfer to connected account created | Yes |
| `transfer.failed` | Transfer failed | Recommended |
| `transfer.reversed` | Transfer was reversed | Recommended |

#### Payout Events

| Event | Description | Required |
|-------|-------------|----------|
| `payout.created` | Payout initiated | Recommended |
| `payout.paid` | Payout successful | Recommended |
| `payout.failed` | Payout failed | Yes |

### Step 3: Get Webhook Signing Secret

After creating the webhook endpoint:

1. Click on the webhook endpoint you created
2. Under **Signing secret**, click **Reveal**
3. Copy the secret (starts with `whsec_`)
4. Add to your environment variables as `STRIPE_WEBHOOK_SECRET`

### Step 4: Verify Webhook Signatures

Always verify webhook signatures to ensure requests are from Stripe:

```go
func HandleStripeWebhook(w http.ResponseWriter, r *http.Request) {
    const MaxBodyBytes = int64(65536)
    r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)

    payload, err := ioutil.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "Error reading body", http.StatusServiceUnavailable)
        return
    }

    endpointSecret := os.Getenv("STRIPE_WEBHOOK_SECRET")
    signatureHeader := r.Header.Get("Stripe-Signature")

    event, err := webhook.ConstructEvent(payload, signatureHeader, endpointSecret)
    if err != nil {
        http.Error(w, "Invalid signature", http.StatusBadRequest)
        return
    }

    // Handle the event
    switch event.Type {
    case "payment_intent.succeeded":
        // Handle successful payment
    case "payment_intent.payment_failed":
        // Handle failed payment
    // ... handle other events
    }

    w.WriteHeader(http.StatusOK)
}
```

---

## Part 5: Get API Keys

### Step 1: Access API Keys

1. Go to **Developers** > **API keys**
2. You will see both test and live keys

### Step 2: Key Types

| Key Type | Prefix | Usage | Security |
|----------|--------|-------|----------|
| Publishable Key | `pk_test_` / `pk_live_` | Frontend (client-side) | Safe to expose |
| Secret Key | `sk_test_` / `sk_live_` | Backend (server-side) | Never expose |
| Restricted Key | `rk_test_` / `rk_live_` | Limited permissions | Backend only |
| Webhook Secret | `whsec_` | Webhook verification | Backend only |

### Step 3: Environment Variables

Add to your `.env` file:

```bash
# Stripe API Keys (Test Mode)
STRIPE_PUBLISHABLE_KEY=pk_test_51...
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Connect
STRIPE_CONNECT_CLIENT_ID=ca_...  # Found in Connect > Settings

# Optional: Restricted keys for specific services
STRIPE_RESTRICTED_KEY=rk_test_...
```

### Step 4: Get Connect Client ID

For OAuth-based Connect onboarding:

1. Go to **Connect** > **Settings**
2. Find **Client ID** under Integration
3. Copy the client ID (starts with `ca_`)

### Step 5: Secure Key Storage

**Production Best Practices:**

- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- Never commit keys to version control
- Rotate keys periodically
- Use restricted keys with minimal permissions where possible

---

## Part 6: Test Cards

Use these test card numbers to simulate different scenarios.

### Successful Payments

| Card Number | Brand | Description |
|-------------|-------|-------------|
| `4242 4242 4242 4242` | Visa | Succeeds and immediately processes |
| `4000 0566 5566 5556` | Visa (debit) | Succeeds with debit card |
| `5555 5555 5555 4444` | Mastercard | Succeeds and immediately processes |
| `3782 822463 10005` | American Express | Succeeds and immediately processes |
| `6011 1111 1111 1117` | Discover | Succeeds and immediately processes |

### Declined Payments

| Card Number | Brand | Decline Reason |
|-------------|-------|----------------|
| `4000 0000 0000 0002` | Visa | Generic decline |
| `4000 0000 0000 9995` | Visa | Insufficient funds |
| `4000 0000 0000 9987` | Visa | Lost card |
| `4000 0000 0000 9979` | Visa | Stolen card |
| `4000 0000 0000 0069` | Visa | Expired card |
| `4000 0000 0000 0127` | Visa | Incorrect CVC |
| `4000 0000 0000 0119` | Visa | Processing error |

### 3D Secure (SCA) Testing

| Card Number | Behavior |
|-------------|----------|
| `4000 0027 6000 3184` | Requires authentication (succeeds) |
| `4000 0082 6000 3178` | Requires authentication (fails) |
| `4000 0025 0000 3155` | Requires authentication on setup |

### Disputes and Fraud

| Card Number | Behavior |
|-------------|----------|
| `4000 0000 0000 0259` | Charge succeeds, dispute created |
| `4100 0000 0000 0019` | Charge blocked as fraudulent |

### Test Card Details

Use any valid future date for expiration and any 3-digit CVC (4-digit for Amex):

```
Card Number: 4242 4242 4242 4242
Expiry: 12/34 (any future date)
CVC: 123 (any 3 digits)
ZIP: 12345 (any 5 digits for US)
```

### Testing Specific Scenarios

#### Simulate Slow Processing

```bash
# Use special amounts to trigger delays
Amount: $1.00 - Immediate processing
Amount: ending in .01 - 1 second delay
Amount: ending in .02 - 2 second delay
```

#### Simulate Specific Error Codes

See [Stripe Testing Documentation](https://stripe.com/docs/testing) for additional test scenarios.

---

## Part 7: Integration Checklist

Use this checklist to verify your integration is complete.

### Environment Setup

- [ ] Stripe account created and verified
- [ ] Test mode enabled
- [ ] API keys obtained (publishable and secret)
- [ ] Webhook signing secret obtained
- [ ] Connect client ID obtained

### Backend Configuration

- [ ] Environment variables set:
  ```
  STRIPE_PUBLISHABLE_KEY=pk_test_...
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_CONNECT_CLIENT_ID=ca_...
  ```
- [ ] Stripe SDK installed and configured
- [ ] API key loaded from environment (not hardcoded)

### Webhook Integration

- [ ] Webhook endpoint implemented (`/api/webhooks/stripe`)
- [ ] Webhook signature verification enabled
- [ ] All required events subscribed
- [ ] Webhook endpoint accessible from internet
- [ ] Error handling and logging in place

### Payment Flow Testing

- [ ] Create PaymentIntent works
- [ ] Successful payment with test card `4242...`
- [ ] Declined payment handled correctly
- [ ] 3D Secure authentication works
- [ ] Payment confirmation received via webhook
- [ ] Order status updated correctly

### Refund Flow Testing

- [ ] Full refund works
- [ ] Partial refund works
- [ ] Refund webhook received
- [ ] Ticket/order status updated

### Connect Integration

- [ ] Connected account onboarding flow works
- [ ] OAuth redirect properly configured
- [ ] Platform fees calculated correctly
- [ ] Transfers to connected accounts work
- [ ] `account.updated` webhook handled

### Error Handling

- [ ] Invalid card errors shown to user
- [ ] Network errors handled gracefully
- [ ] Webhook failures don't crash the app
- [ ] Retry logic for failed webhooks

### Logging and Monitoring

- [ ] Payment events logged
- [ ] Webhook events logged
- [ ] Errors logged with context
- [ ] Alerts set up for failures

---

## Part 8: Go Live Checklist

Before accepting real payments, complete this checklist.

### Step 1: Switch to Live Mode

1. In Stripe Dashboard, toggle off **Test mode**
2. Complete any remaining business verification
3. Verify bank account for payouts

### Step 2: Update API Keys

Replace test keys with live keys:

```bash
# Live Mode Keys
STRIPE_PUBLISHABLE_KEY=pk_live_51...
STRIPE_SECRET_KEY=sk_live_51...
STRIPE_WEBHOOK_SECRET=whsec_...  # New secret for live webhook
```

**IMPORTANT**: Create a new webhook endpoint for production with the live webhook signing secret.

### Step 3: Verify Webhook Endpoints

1. Create production webhook endpoint in Stripe
2. Subscribe to all required events
3. Update `STRIPE_WEBHOOK_SECRET` with new live secret
4. Test webhook delivery

### Step 4: PCI Compliance

The Festivals platform must maintain PCI compliance:

#### Using Stripe.js/Elements (Recommended)

If using Stripe.js or Stripe Elements, you qualify for **PCI SAQ-A**:

- Card data never touches your servers
- Lowest compliance burden
- Stripe handles sensitive data

#### Compliance Requirements

- [ ] Use HTTPS everywhere
- [ ] Never log card numbers
- [ ] Use Stripe.js/Elements for card collection
- [ ] Complete SAQ-A questionnaire annually
- [ ] Store `STRIPE_SECRET_KEY` securely

### Step 5: Connected Account Verification

- [ ] Verify connected accounts are properly onboarded
- [ ] Ensure payout bank accounts are verified
- [ ] Review any flagged accounts

### Step 6: Final Testing in Live Mode

- [ ] Make a small real payment ($0.50)
- [ ] Verify payment appears in Dashboard
- [ ] Refund the test payment
- [ ] Verify refund processed correctly

### Step 7: Monitoring Setup

- [ ] Set up Radar for fraud prevention
- [ ] Configure dispute notifications
- [ ] Set up payout failure alerts
- [ ] Monitor connected account health

---

## Troubleshooting

### Common Errors and Solutions

#### Webhook Signature Invalid

**Error**: `Webhook signature verification failed`

**Causes and Solutions**:

1. **Wrong webhook secret**
   ```bash
   # Ensure you're using the correct secret for the endpoint
   # Test and live endpoints have different secrets
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

2. **Payload modified**
   ```go
   // Read raw body, don't parse before verification
   body, _ := ioutil.ReadAll(r.Body)
   // Do NOT do: json.NewDecoder(r.Body).Decode(&data) before verification
   ```

3. **Timestamp tolerance**
   ```go
   // Default tolerance is 300 seconds (5 minutes)
   // Check server time is correct
   ```

4. **Using wrong endpoint secret**
   - Each webhook endpoint has its own secret
   - Test and live modes have separate secrets

#### Card Declined

**Error**: `Your card was declined`

**Common Decline Codes**:

| Code | Meaning | Solution |
|------|---------|----------|
| `card_declined` | Generic decline | Ask customer to try different card |
| `insufficient_funds` | Not enough balance | Customer needs to add funds |
| `incorrect_cvc` | CVC doesn't match | Customer re-enters CVC |
| `expired_card` | Card is expired | Customer uses different card |
| `processing_error` | Stripe processing issue | Retry in a few seconds |

**Implementation**:

```go
if stripeErr, ok := err.(*stripe.Error); ok {
    switch stripeErr.Code {
    case stripe.ErrorCodeCardDeclined:
        return errors.New("Your card was declined. Please try a different card.")
    case stripe.ErrorCodeExpiredCard:
        return errors.New("Your card has expired. Please use a different card.")
    case stripe.ErrorCodeIncorrectCVC:
        return errors.New("The CVC code is incorrect. Please check and try again.")
    default:
        return errors.New("Payment failed. Please try again.")
    }
}
```

#### Connect Account Not Found

**Error**: `No such connected account`

**Solutions**:

1. Verify the account ID is correct
2. Check if account has been deauthorized
3. Ensure account is fully onboarded
4. Verify you're using the correct mode (test/live)

#### Transfer Failed

**Error**: `Transfer could not be created`

**Common Causes**:

1. **Insufficient platform balance**
   - Ensure payment has cleared before transferring
   - Wait for `payment_intent.succeeded` webhook

2. **Connected account not verified**
   - Check account status via Dashboard
   - Prompt user to complete verification

3. **Invalid amount**
   - Transfer amount cannot exceed available balance
   - Account for platform fees in calculation

#### Authentication Required

**Error**: `This PaymentIntent requires a payment method with authentication`

**Solution**: Implement proper 3D Secure handling:

```javascript
const { error, paymentIntent } = await stripe.confirmCardPayment(
    clientSecret,
    {
        payment_method: {
            card: cardElement,
        },
    }
);

if (error) {
    if (error.type === 'card_error') {
        // Show error to customer
    }
} else if (paymentIntent.status === 'requires_action') {
    // 3D Secure authentication needed
    // Stripe.js handles this automatically
}
```

#### Webhook Endpoint Timeout

**Error**: Stripe retries webhooks / `Webhook timed out`

**Solutions**:

1. **Return 200 immediately, process async**
   ```go
   func HandleWebhook(w http.ResponseWriter, r *http.Request) {
       // Verify signature
       // ...

       // Return 200 immediately
       w.WriteHeader(http.StatusOK)

       // Process in background
       go processEvent(event)
   }
   ```

2. **Use a queue for processing**
   - Put webhook events in a queue
   - Process asynchronously
   - Implement retry logic

#### Rate Limiting

**Error**: `Too many requests`

**Solutions**:

1. Implement exponential backoff
2. Cache Stripe responses where possible
3. Batch operations when possible
4. Use webhooks instead of polling

### Debug Tips

1. **Enable Stripe CLI for local testing**
   ```bash
   stripe listen --forward-to localhost:8080/api/webhooks/stripe
   ```

2. **Check webhook delivery logs**
   - Dashboard > Developers > Webhooks > Select endpoint > Attempts

3. **Test specific events**
   ```bash
   stripe trigger payment_intent.succeeded
   ```

4. **View detailed logs**
   - Dashboard > Developers > Logs

---

## Additional Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [PCI Compliance Guide](https://stripe.com/docs/security/guide)

---

*Last updated: January 2026*
