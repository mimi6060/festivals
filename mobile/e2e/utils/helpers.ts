/**
 * Common Test Helpers for E2E Tests
 *
 * Provides utility functions for common operations in Detox tests.
 */

import { device, element, by, expect, waitFor } from 'detox';
import { TestIds } from './testIds';

// ==========================================================================
// Types
// ==========================================================================

export interface UserCredentials {
  email: string;
  password: string;
  name?: string;
}

export interface StaffCredentials extends UserCredentials {
  standName?: string;
}

// ==========================================================================
// Timeout Configuration
// ==========================================================================

export const TIMEOUTS = {
  /** Very short wait for animations (300ms) */
  animation: 300,

  /** Short timeout for quick operations (3s) */
  short: 3000,

  /** Medium timeout for standard operations (10s) */
  medium: 10000,

  /** Long timeout for network operations (30s) */
  long: 30000,

  /** Very long timeout for heavy operations (60s) */
  veryLong: 60000,

  /** Polling interval for retry operations */
  pollInterval: 100,
} as const;

// ==========================================================================
// Wait Functions
// ==========================================================================

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for animation to complete
 */
export async function waitForAnimation(): Promise<void> {
  await sleep(TIMEOUTS.animation);
}

/**
 * Wait for element to be visible by test ID
 */
export async function waitForElementVisible(
  testId: string,
  timeout: number = TIMEOUTS.medium
): Promise<void> {
  await waitFor(element(by.id(testId)))
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * Wait for element to not be visible by test ID
 */
export async function waitForElementNotVisible(
  testId: string,
  timeout: number = TIMEOUTS.medium
): Promise<void> {
  await waitFor(element(by.id(testId)))
    .not.toBeVisible()
    .withTimeout(timeout);
}

/**
 * Wait for text to be visible
 */
export async function waitForTextVisible(
  text: string,
  timeout: number = TIMEOUTS.medium
): Promise<void> {
  await waitFor(element(by.text(text)))
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * Wait for loading to complete
 */
export async function waitForLoadingComplete(
  loadingId: string = TestIds.common.loadingIndicator,
  timeout: number = TIMEOUTS.long
): Promise<void> {
  try {
    await waitFor(element(by.id(loadingId)))
      .not.toExist()
      .withTimeout(timeout);
  } catch {
    // Loading indicator might not exist
  }
  await waitForAnimation();
}

// ==========================================================================
// Scroll Functions
// ==========================================================================

/**
 * Scroll down in a scroll view
 */
export async function scrollDown(
  scrollViewId: string,
  pixels: number = 300
): Promise<void> {
  const scrollView = element(by.id(scrollViewId));
  await scrollView.scroll(pixels, 'down');
  await waitForAnimation();
}

/**
 * Scroll up in a scroll view
 */
export async function scrollUp(
  scrollViewId: string,
  pixels: number = 300
): Promise<void> {
  const scrollView = element(by.id(scrollViewId));
  await scrollView.scroll(pixels, 'up');
  await waitForAnimation();
}

/**
 * Pull to refresh
 */
export async function pullToRefresh(scrollViewId: string): Promise<void> {
  const scrollView = element(by.id(scrollViewId));
  await scrollView.scroll(200, 'down', NaN, 0.9);
  await waitForAnimation();
}

/**
 * Scroll to element
 */
export async function scrollToElement(
  targetId: string,
  scrollViewId: string,
  direction: 'up' | 'down' = 'down',
  scrollAmount: number = 200
): Promise<void> {
  await waitFor(element(by.id(targetId)))
    .toBeVisible()
    .whileElement(by.id(scrollViewId))
    .scroll(scrollAmount, direction);
}

// ==========================================================================
// Authentication Functions
// ==========================================================================

/**
 * Login with email and password
 */
export async function login(credentials: UserCredentials): Promise<void> {
  const { email, password } = credentials;

  // Wait for login screen
  await waitFor(element(by.id(TestIds.auth.emailInput)))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);

  // Clear and enter email
  await element(by.id(TestIds.auth.emailInput)).clearText();
  await element(by.id(TestIds.auth.emailInput)).typeText(email);

  // Clear and enter password
  await element(by.id(TestIds.auth.passwordInput)).clearText();
  await element(by.id(TestIds.auth.passwordInput)).typeText(password);

  // Dismiss keyboard
  await element(by.id(TestIds.auth.passwordInput)).tapReturnKey();

  // Submit login
  await element(by.id(TestIds.auth.loginButton)).tap();

  // Wait for successful login (main screen appears)
  await waitFor(element(by.text('Accueil')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.long);
}

/**
 * Login as staff member
 */
export async function loginAsStaff(credentials: StaffCredentials): Promise<void> {
  await login(credentials);

  // Verify staff navigation is visible
  await waitFor(element(by.text('Paiement')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);
}

/**
 * Attempt login with biometric authentication
 */
export async function loginWithBiometric(): Promise<void> {
  // Wait for biometric button to be visible
  await waitFor(element(by.id(TestIds.auth.biometricLoginButton)))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);

  // Tap biometric login
  await element(by.id(TestIds.auth.biometricLoginButton)).tap();

  // Simulate successful biometric on simulator
  if (device.getPlatform() === 'ios') {
    await device.matchFace();
  } else {
    await device.matchFinger();
  }

  // Wait for main screen
  await waitFor(element(by.text('Accueil')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.long);
}

/**
 * Fail biometric authentication (for testing error handling)
 */
export async function failBiometricLogin(): Promise<void> {
  await waitFor(element(by.id(TestIds.auth.biometricLoginButton)))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);

  await element(by.id(TestIds.auth.biometricLoginButton)).tap();

  if (device.getPlatform() === 'ios') {
    await device.unmatchFace();
  } else {
    await device.unmatchFinger();
  }
}

/**
 * Attempt login with invalid credentials
 */
export async function attemptInvalidLogin(
  email: string = 'invalid@test.com',
  password: string = 'wrongpassword'
): Promise<void> {
  await waitFor(element(by.id(TestIds.auth.emailInput)))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);

  await element(by.id(TestIds.auth.emailInput)).clearText();
  await element(by.id(TestIds.auth.emailInput)).typeText(email);

  await element(by.id(TestIds.auth.passwordInput)).clearText();
  await element(by.id(TestIds.auth.passwordInput)).typeText(password);

  await element(by.id(TestIds.auth.passwordInput)).tapReturnKey();
  await element(by.id(TestIds.auth.loginButton)).tap();
}

/**
 * Logout from the app
 */
export async function logout(): Promise<void> {
  // Navigate to profile
  await waitFor(element(by.text('Profil')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);
  await element(by.text('Profil')).tap();

  // Scroll to find logout button if needed
  try {
    await waitFor(element(by.id(TestIds.auth.logoutButton)))
      .toBeVisible()
      .withTimeout(TIMEOUTS.short);
  } catch {
    await element(by.id(TestIds.auth.profileScrollView)).scroll(300, 'down');
  }

  // Tap logout
  await element(by.id(TestIds.auth.logoutButton)).tap();

  // Confirm logout if dialog appears
  try {
    await waitFor(element(by.text('Confirmer')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.short);
    await element(by.text('Confirmer')).tap();
  } catch {
    // No confirmation dialog
  }

  // Wait for login screen
  await waitFor(element(by.id(TestIds.auth.emailInput)))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(): Promise<boolean> {
  try {
    await waitFor(element(by.text('Accueil')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.short);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure user is logged out
 */
export async function ensureLoggedOut(): Promise<void> {
  const loggedIn = await isLoggedIn();
  if (loggedIn) {
    await logout();
  }
}

/**
 * Ensure user is logged in (login if needed)
 */
export async function ensureLoggedIn(credentials: UserCredentials): Promise<void> {
  const loggedIn = await isLoggedIn();
  if (!loggedIn) {
    await login(credentials);
  }
}

/**
 * Clear all app data and start fresh
 */
export async function clearAppData(): Promise<void> {
  await device.launchApp({
    newInstance: true,
    delete: true,
    permissions: {
      camera: 'YES',
      location: 'always',
      notifications: 'YES',
    },
  });
}

/**
 * Generate unique email for registration tests
 */
export function generateUniqueEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-${timestamp}-${random}@festivals.app`;
}

// ==========================================================================
// Navigation Functions
// ==========================================================================

/**
 * Navigate to a specific tab
 */
export async function navigateToTab(tabName: string): Promise<void> {
  await waitFor(element(by.text(tabName)))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);
  await element(by.text(tabName)).tap();
  await waitForAnimation();
}

/**
 * Go back to previous screen
 */
export async function goBack(): Promise<void> {
  if (device.getPlatform() === 'ios') {
    try {
      await element(by.traits(['button']).and(by.label('Back'))).tap();
    } catch {
      await element(by.id(TestIds.common.backButton)).tap();
    }
  } else {
    await device.pressBack();
  }
  await waitForAnimation();
}

/**
 * Dismiss modal
 */
export async function dismissModal(): Promise<void> {
  try {
    await element(by.id(TestIds.common.modalCloseButton)).tap();
  } catch {
    // Try tapping outside or cancel button
    try {
      await element(by.id(TestIds.common.cancelButton)).tap();
    } catch {
      // Modal might have dismissed already
    }
  }
  await waitForAnimation();
}

// ==========================================================================
// Input Functions
// ==========================================================================

/**
 * Type text and dismiss keyboard
 */
export async function typeAndDismiss(
  elementId: string,
  text: string
): Promise<void> {
  await element(by.id(elementId)).clearText();
  await element(by.id(elementId)).typeText(text);
  await element(by.id(elementId)).tapReturnKey();
}

/**
 * Clear input field
 */
export async function clearInput(elementId: string): Promise<void> {
  await element(by.id(elementId)).clearText();
}

// ==========================================================================
// Verification Functions
// ==========================================================================

/**
 * Verify element is visible
 */
export async function verifyVisible(elementId: string): Promise<void> {
  await expect(element(by.id(elementId))).toBeVisible();
}

/**
 * Verify text is visible
 */
export async function verifyTextVisible(text: string): Promise<void> {
  await expect(element(by.text(text))).toBeVisible();
}

/**
 * Verify element is not visible
 */
export async function verifyNotVisible(elementId: string): Promise<void> {
  await expect(element(by.id(elementId))).not.toBeVisible();
}

/**
 * Verify element has specific text
 */
export async function verifyHasText(elementId: string, text: string): Promise<void> {
  await expect(element(by.id(elementId))).toHaveText(text);
}

// ==========================================================================
// Retry Functions
// ==========================================================================

/**
 * Retry an action until it succeeds
 */
export async function retryUntilSuccess<T>(
  action: () => Promise<T>,
  maxRetries: number = 3,
  delayBetweenRetries: number = TIMEOUTS.short
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await sleep(delayBetweenRetries);
      }
    }
  }

  throw new Error(`Action failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Wait for condition to be true
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number = TIMEOUTS.medium,
  pollInterval: number = TIMEOUTS.pollInterval
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(pollInterval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

// ==========================================================================
// Platform-specific Functions
// ==========================================================================

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return device.getPlatform() === 'ios';
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return device.getPlatform() === 'android';
}

/**
 * Execute platform-specific action
 */
export async function platformAction(
  iosAction: () => Promise<void>,
  androidAction: () => Promise<void>
): Promise<void> {
  if (isIOS()) {
    await iosAction();
  } else {
    await androidAction();
  }
}

// ==========================================================================
// Screenshot and Debug Functions
// ==========================================================================

/**
 * Take a screenshot with optional name
 */
export async function takeScreenshot(name?: string): Promise<void> {
  const screenshotName = name || `screenshot-${Date.now()}`;
  await device.takeScreenshot(screenshotName);
}

/**
 * Log message with timestamp
 */
export function logWithTimestamp(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}
