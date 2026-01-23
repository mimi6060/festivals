/**
 * Journey Tests Index
 *
 * This module exports all journey test utilities and provides
 * documentation for the critical user journeys being tested.
 *
 * Journey Tests:
 *
 * 1. ticket-purchase.spec.ts
 *    - Complete ticket purchase flow
 *    - Select tickets -> Enter details -> Payment -> Confirmation
 *    - Verifies email sent and QR code generation
 *
 * 2. wallet-topup.spec.ts
 *    - User wallet top-up flow
 *    - Login -> Navigate to wallet -> Add funds via Stripe -> Verify balance
 *
 * 3. staff-payment.spec.ts
 *    - Staff processing customer payments
 *    - Login -> Staff mode -> Scan QR -> Process payment -> Verify transaction
 *
 * 4. festival-setup.spec.ts
 *    - Admin festival setup flow
 *    - Create festival -> Configure -> Add stands/products -> Add staff -> Publish
 *
 * 5. refund-flow.spec.ts
 *    - Refund request and processing
 *    - User requests -> Admin reviews -> Approve/Reject -> User confirmation
 *
 * Running Journey Tests:
 *   npm run test:e2e:journeys
 *
 * Running specific journey:
 *   npx playwright test e2e/journeys/ticket-purchase.spec.ts
 */

export {};
