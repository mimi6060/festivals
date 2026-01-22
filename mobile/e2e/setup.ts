import { device, element, by, expect, waitFor } from 'detox';

// ============================================================================
// Test Configuration
// ============================================================================

export const TEST_CONFIG = {
  timeouts: {
    short: 5000,
    medium: 10000,
    long: 30000,
    animation: 500,
  },
  testUser: {
    email: 'test@festivals.app',
    password: 'TestPassword123!',
    name: 'Test User',
  },
  mockData: {
    walletBalance: 150,
    currencyName: 'Griffons',
  },
};

// ============================================================================
// Detox Setup & Teardown
// ============================================================================

/**
 * Initialize the app for testing
 * Call this in beforeAll() hook
 */
export async function initializeApp(): Promise<void> {
  await device.launchApp({
    newInstance: true,
    permissions: {
      camera: 'YES',
      location: 'always',
      notifications: 'YES',
    },
  });
}

/**
 * Reset app state between tests
 * Call this in beforeEach() hook
 */
export async function resetAppState(): Promise<void> {
  await device.reloadReactNative();
}

/**
 * Clean up after all tests
 * Call this in afterAll() hook
 */
export async function cleanupApp(): Promise<void> {
  await device.terminateApp();
}

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Navigate to a specific tab in the app
 */
export async function navigateToTab(tabName: 'Accueil' | 'Billets' | 'Wallet' | 'Programme' | 'Carte' | 'Profil'): Promise<void> {
  await waitFor(element(by.text(tabName)))
    .toBeVisible()
    .withTimeout(TEST_CONFIG.timeouts.medium);
  await element(by.text(tabName)).tap();
  await sleep(TEST_CONFIG.timeouts.animation);
}

/**
 * Wait for the app to fully load after launch
 */
export async function waitForAppReady(): Promise<void> {
  // Wait for splash screen to hide and main content to appear
  await waitFor(element(by.text('Accueil')))
    .toBeVisible()
    .withTimeout(TEST_CONFIG.timeouts.long);
}

/**
 * Go back to previous screen
 */
export async function goBack(): Promise<void> {
  if (device.getPlatform() === 'ios') {
    await element(by.traits(['button']).and(by.label('Back'))).tap();
  } else {
    await device.pressBack();
  }
  await sleep(TEST_CONFIG.timeouts.animation);
}

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Login with test credentials
 */
export async function login(
  email: string = TEST_CONFIG.testUser.email,
  password: string = TEST_CONFIG.testUser.password
): Promise<void> {
  // Wait for login screen
  await waitFor(element(by.id('login-email-input')))
    .toBeVisible()
    .withTimeout(TEST_CONFIG.timeouts.medium);

  // Enter credentials
  await element(by.id('login-email-input')).clearText();
  await element(by.id('login-email-input')).typeText(email);

  await element(by.id('login-password-input')).clearText();
  await element(by.id('login-password-input')).typeText(password);

  // Hide keyboard
  await element(by.id('login-password-input')).tapReturnKey();

  // Tap login button
  await element(by.id('login-submit-button')).tap();

  // Wait for navigation to main screen
  await waitFor(element(by.text('Accueil')))
    .toBeVisible()
    .withTimeout(TEST_CONFIG.timeouts.long);
}

/**
 * Logout from the app
 */
export async function logout(): Promise<void> {
  await navigateToTab('Profil');

  await waitFor(element(by.id('logout-button')))
    .toBeVisible()
    .withTimeout(TEST_CONFIG.timeouts.medium);

  await element(by.id('logout-button')).tap();

  // Confirm logout if there's a dialog
  try {
    await element(by.text('Confirmer')).tap();
  } catch {
    // No confirmation dialog, continue
  }

  // Wait for login screen
  await waitFor(element(by.id('login-email-input')))
    .toBeVisible()
    .withTimeout(TEST_CONFIG.timeouts.medium);
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(): Promise<boolean> {
  try {
    await waitFor(element(by.text('Accueil')))
      .toBeVisible()
      .withTimeout(TEST_CONFIG.timeouts.short);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Form Helpers
// ============================================================================

/**
 * Fill a text input by test ID
 */
export async function fillInput(testId: string, text: string): Promise<void> {
  const input = element(by.id(testId));
  await waitFor(input).toBeVisible().withTimeout(TEST_CONFIG.timeouts.medium);
  await input.clearText();
  await input.typeText(text);
}

/**
 * Tap a button by test ID
 */
export async function tapButton(testId: string): Promise<void> {
  const button = element(by.id(testId));
  await waitFor(button).toBeVisible().withTimeout(TEST_CONFIG.timeouts.medium);
  await button.tap();
}

/**
 * Tap a button by text
 */
export async function tapButtonByText(text: string): Promise<void> {
  const button = element(by.text(text));
  await waitFor(button).toBeVisible().withTimeout(TEST_CONFIG.timeouts.medium);
  await button.tap();
}

// ============================================================================
// Scroll Helpers
// ============================================================================

/**
 * Scroll down in a scrollable view
 */
export async function scrollDown(scrollViewId?: string, pixels: number = 300): Promise<void> {
  const scrollable = scrollViewId
    ? element(by.id(scrollViewId))
    : element(by.type('RCTScrollView')).atIndex(0);

  await scrollable.scroll(pixels, 'down');
}

/**
 * Scroll up in a scrollable view
 */
export async function scrollUp(scrollViewId?: string, pixels: number = 300): Promise<void> {
  const scrollable = scrollViewId
    ? element(by.id(scrollViewId))
    : element(by.type('RCTScrollView')).atIndex(0);

  await scrollable.scroll(pixels, 'up');
}

/**
 * Scroll to an element
 */
export async function scrollToElement(testId: string, scrollViewId?: string): Promise<void> {
  const scrollable = scrollViewId
    ? element(by.id(scrollViewId))
    : element(by.type('RCTScrollView')).atIndex(0);

  await waitFor(element(by.id(testId)))
    .toBeVisible()
    .whileElement(scrollable)
    .scroll(200, 'down');
}

// ============================================================================
// Pull to Refresh Helper
// ============================================================================

/**
 * Perform pull-to-refresh gesture
 */
export async function pullToRefresh(scrollViewId?: string): Promise<void> {
  const scrollable = scrollViewId
    ? element(by.id(scrollViewId))
    : element(by.type('RCTScrollView')).atIndex(0);

  await scrollable.scroll(200, 'down', NaN, 0.9);
  await sleep(TEST_CONFIG.timeouts.animation);
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert element is visible by test ID
 */
export async function assertVisible(testId: string): Promise<void> {
  await waitFor(element(by.id(testId)))
    .toBeVisible()
    .withTimeout(TEST_CONFIG.timeouts.medium);
}

/**
 * Assert element is not visible by test ID
 */
export async function assertNotVisible(testId: string): Promise<void> {
  await waitFor(element(by.id(testId)))
    .not.toBeVisible()
    .withTimeout(TEST_CONFIG.timeouts.medium);
}

/**
 * Assert text is visible on screen
 */
export async function assertTextVisible(text: string): Promise<void> {
  await waitFor(element(by.text(text)))
    .toBeVisible()
    .withTimeout(TEST_CONFIG.timeouts.medium);
}

/**
 * Assert text is not visible on screen
 */
export async function assertTextNotVisible(text: string): Promise<void> {
  await waitFor(element(by.text(text)))
    .not.toBeVisible()
    .withTimeout(TEST_CONFIG.timeouts.medium);
}

/**
 * Assert element contains text
 */
export async function assertContainsText(testId: string, text: string): Promise<void> {
  await waitFor(element(by.id(testId)))
    .toHaveText(text)
    .withTimeout(TEST_CONFIG.timeouts.medium);
}

// ============================================================================
// Wait Helpers
// ============================================================================

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for element to appear
 */
export async function waitForElement(testId: string, timeout?: number): Promise<void> {
  await waitFor(element(by.id(testId)))
    .toExist()
    .withTimeout(timeout ?? TEST_CONFIG.timeouts.medium);
}

/**
 * Wait for element to disappear
 */
export async function waitForElementToDisappear(testId: string, timeout?: number): Promise<void> {
  await waitFor(element(by.id(testId)))
    .not.toExist()
    .withTimeout(timeout ?? TEST_CONFIG.timeouts.medium);
}

/**
 * Wait for loading to complete
 */
export async function waitForLoadingToComplete(loadingIndicatorId: string = 'loading-indicator'): Promise<void> {
  try {
    await waitFor(element(by.id(loadingIndicatorId)))
      .not.toExist()
      .withTimeout(TEST_CONFIG.timeouts.long);
  } catch {
    // Loading indicator might not exist, which is fine
  }
}

// ============================================================================
// Modal Helpers
// ============================================================================

/**
 * Dismiss modal by tapping outside or close button
 */
export async function dismissModal(): Promise<void> {
  try {
    // Try close button first
    await element(by.id('modal-close-button')).tap();
  } catch {
    // Try tapping outside
    await element(by.id('modal-backdrop')).tap();
  }
  await sleep(TEST_CONFIG.timeouts.animation);
}

/**
 * Confirm modal action
 */
export async function confirmModal(): Promise<void> {
  try {
    await element(by.text('Confirmer')).tap();
  } catch {
    await element(by.text('OK')).tap();
  }
  await sleep(TEST_CONFIG.timeouts.animation);
}

// ============================================================================
// Platform Specific Helpers
// ============================================================================

/**
 * Get current platform
 */
export function getPlatform(): 'ios' | 'android' {
  return device.getPlatform() as 'ios' | 'android';
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return getPlatform() === 'ios';
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return getPlatform() === 'android';
}

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate a unique email for testing
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  return `test-${timestamp}@festivals.app`;
}

/**
 * Generate a random ticket code
 */
export function generateTicketCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'TST-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================================================
// Debug Helpers
// ============================================================================

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(name: string): Promise<void> {
  await device.takeScreenshot(name);
}

/**
 * Print element hierarchy (useful for debugging)
 */
export async function printElementTree(): Promise<void> {
  const tree = await device.getUiTree();
  console.log(JSON.stringify(tree, null, 2));
}

// ============================================================================
// Export commonly used Detox functions for convenience
// ============================================================================

export { device, element, by, expect, waitFor };
