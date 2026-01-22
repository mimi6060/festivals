/**
 * Wait Helpers for E2E Tests
 *
 * Provides utilities for waiting, timeouts, and element synchronization
 */

import { device, element, by, waitFor } from 'detox';

// ============================================================================
// Timeout Configuration
// ============================================================================

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

// ============================================================================
// Basic Wait Functions
// ============================================================================

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
 * Wait for a longer animation
 */
export async function waitForLongAnimation(): Promise<void> {
  await sleep(TIMEOUTS.animation * 2);
}

// ============================================================================
// Element Wait Functions
// ============================================================================

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
 * Wait for element to be not visible by test ID
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
 * Wait for element to exist by test ID
 */
export async function waitForElementExists(
  testId: string,
  timeout: number = TIMEOUTS.medium
): Promise<void> {
  await waitFor(element(by.id(testId)))
    .toExist()
    .withTimeout(timeout);
}

/**
 * Wait for element to not exist by test ID
 */
export async function waitForElementNotExists(
  testId: string,
  timeout: number = TIMEOUTS.medium
): Promise<void> {
  await waitFor(element(by.id(testId)))
    .not.toExist()
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
 * Wait for text to not be visible
 */
export async function waitForTextNotVisible(
  text: string,
  timeout: number = TIMEOUTS.medium
): Promise<void> {
  await waitFor(element(by.text(text)))
    .not.toBeVisible()
    .withTimeout(timeout);
}

/**
 * Wait for text matching regex to be visible
 */
export async function waitForTextMatchingVisible(
  regex: RegExp,
  timeout: number = TIMEOUTS.medium
): Promise<void> {
  await waitFor(element(by.text(regex)))
    .toBeVisible()
    .withTimeout(timeout);
}

// ============================================================================
// Loading State Functions
// ============================================================================

/**
 * Wait for loading indicator to appear
 */
export async function waitForLoadingStart(
  loadingIndicatorId: string = 'loading-indicator',
  timeout: number = TIMEOUTS.short
): Promise<void> {
  try {
    await waitFor(element(by.id(loadingIndicatorId)))
      .toBeVisible()
      .withTimeout(timeout);
  } catch {
    // Loading might be too fast to catch
  }
}

/**
 * Wait for loading indicator to disappear
 */
export async function waitForLoadingComplete(
  loadingIndicatorId: string = 'loading-indicator',
  timeout: number = TIMEOUTS.long
): Promise<void> {
  try {
    await waitFor(element(by.id(loadingIndicatorId)))
      .not.toExist()
      .withTimeout(timeout);
  } catch {
    // Loading indicator might not exist
  }
}

/**
 * Wait for full page loading to complete
 */
export async function waitForPageLoad(
  timeout: number = TIMEOUTS.long
): Promise<void> {
  // Wait for any loading spinners to disappear
  const loadingIndicators = ['loading-indicator', 'page-loader', 'spinner'];

  for (const indicator of loadingIndicators) {
    try {
      await waitFor(element(by.id(indicator)))
        .not.toExist()
        .withTimeout(timeout);
    } catch {
      // Indicator might not exist
    }
  }

  // Small wait for any final rendering
  await waitForAnimation();
}

/**
 * Wait for skeleton loader to be replaced by content
 */
export async function waitForSkeletonToDisappear(
  skeletonId: string = 'skeleton-loader',
  timeout: number = TIMEOUTS.long
): Promise<void> {
  await waitFor(element(by.id(skeletonId)))
    .not.toExist()
    .withTimeout(timeout);
}

// ============================================================================
// Network Wait Functions
// ============================================================================

/**
 * Wait for network request to complete (by waiting for UI update)
 */
export async function waitForNetworkIdle(
  targetElementId: string,
  timeout: number = TIMEOUTS.long
): Promise<void> {
  await waitForElementVisible(targetElementId, timeout);
  await waitForAnimation();
}

/**
 * Wait for refresh to complete after pull-to-refresh
 */
export async function waitForRefreshComplete(
  refreshIndicatorId: string = 'refresh-indicator',
  timeout: number = TIMEOUTS.long
): Promise<void> {
  // Wait for refresh indicator to disappear
  try {
    await waitFor(element(by.id(refreshIndicatorId)))
      .not.toExist()
      .withTimeout(timeout);
  } catch {
    // Indicator might not exist
  }

  await waitForAnimation();
}

// ============================================================================
// Conditional Wait Functions
// ============================================================================

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

// ============================================================================
// Modal Wait Functions
// ============================================================================

/**
 * Wait for modal to appear
 */
export async function waitForModalVisible(
  modalId: string = 'modal-container',
  timeout: number = TIMEOUTS.medium
): Promise<void> {
  await waitForElementVisible(modalId, timeout);
  await waitForAnimation();
}

/**
 * Wait for modal to disappear
 */
export async function waitForModalDismissed(
  modalId: string = 'modal-container',
  timeout: number = TIMEOUTS.medium
): Promise<void> {
  await waitForElementNotVisible(modalId, timeout);
  await waitForAnimation();
}

/**
 * Wait for alert dialog to appear
 */
export async function waitForAlert(
  timeout: number = TIMEOUTS.medium
): Promise<void> {
  // Alert content varies, but usually has OK/Cancel buttons
  try {
    await waitFor(element(by.text('OK')))
      .toBeVisible()
      .withTimeout(timeout);
  } catch {
    await waitFor(element(by.text('Confirmer')))
      .toBeVisible()
      .withTimeout(timeout);
  }
}

// ============================================================================
// Navigation Wait Functions
// ============================================================================

/**
 * Wait for navigation to complete
 */
export async function waitForNavigationComplete(
  expectedScreenId: string,
  timeout: number = TIMEOUTS.medium
): Promise<void> {
  await waitForElementVisible(expectedScreenId, timeout);
  await waitForAnimation();
}

/**
 * Wait for back navigation to complete
 */
export async function waitForBackNavigation(
  previousScreenId: string,
  timeout: number = TIMEOUTS.medium
): Promise<void> {
  await waitForElementVisible(previousScreenId, timeout);
  await waitForAnimation();
}

/**
 * Wait for tab change to complete
 */
export async function waitForTabChange(
  tabContentId: string,
  timeout: number = TIMEOUTS.medium
): Promise<void> {
  await waitForElementVisible(tabContentId, timeout);
  await waitForAnimation();
}

// ============================================================================
// App State Wait Functions
// ============================================================================

/**
 * Wait for app to be ready after launch
 */
export async function waitForAppReady(
  timeout: number = TIMEOUTS.veryLong
): Promise<void> {
  // Wait for splash screen to hide and main content to appear
  await waitFor(element(by.text('Accueil')))
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * Wait for app to become interactive after background
 */
export async function waitForAppForeground(
  timeout: number = TIMEOUTS.medium
): Promise<void> {
  // Just wait a moment for app to resume
  await sleep(500);
}

/**
 * Wait for keyboard to appear
 */
export async function waitForKeyboard(
  timeout: number = TIMEOUTS.short
): Promise<void> {
  // Keyboard appears after tapping input
  await sleep(300);
}

/**
 * Wait for keyboard to dismiss
 */
export async function waitForKeyboardDismiss(
  timeout: number = TIMEOUTS.short
): Promise<void> {
  await sleep(300);
}

// ============================================================================
// Scroll Wait Functions
// ============================================================================

/**
 * Wait while scrolling until element is visible
 */
export async function waitWhileScrolling(
  targetElementId: string,
  scrollViewId: string,
  direction: 'up' | 'down' | 'left' | 'right' = 'down',
  scrollAmount: number = 200
): Promise<void> {
  await waitFor(element(by.id(targetElementId)))
    .toBeVisible()
    .whileElement(by.id(scrollViewId))
    .scroll(scrollAmount, direction);
}

/**
 * Wait for scroll to complete
 */
export async function waitForScrollComplete(): Promise<void> {
  await waitForAnimation();
}
