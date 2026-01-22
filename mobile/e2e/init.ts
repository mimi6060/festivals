/**
 * Detox E2E Test Global Setup
 *
 * This file runs before each test file and sets up the testing environment.
 */

import { device, element, by, expect as detoxExpect } from 'detox';

// ============================================================================
// Global Configuration
// ============================================================================

declare global {
  namespace NodeJS {
    interface Global {
      device: typeof device;
      element: typeof element;
      by: typeof by;
      expect: typeof detoxExpect;
    }
  }
}

// ============================================================================
// Environment Variables
// ============================================================================

export const E2E_CONFIG = {
  // API Configuration
  apiBaseUrl: process.env.E2E_API_URL || 'http://localhost:8080/api/v1',

  // Test environment
  environment: process.env.E2E_ENVIRONMENT || 'test',

  // Debug mode
  debug: process.env.E2E_DEBUG === 'true',

  // Screenshots on failure
  screenshotOnFailure: process.env.E2E_SCREENSHOT_ON_FAILURE !== 'false',

  // Retry configuration
  retryCount: parseInt(process.env.E2E_RETRY_COUNT || '2', 10),
};

// ============================================================================
// Jest Lifecycle Hooks
// ============================================================================

beforeAll(async () => {
  // Set device permissions
  if (device.getPlatform() === 'ios') {
    await device.setStatusBar({
      time: '12:00',
      dataNetwork: 'wifi',
      wifiMode: 'active',
      wifiBars: 3,
      cellularMode: 'active',
      cellularBars: 4,
      batteryState: 'charged',
      batteryLevel: 100,
    });
  }

  // Launch app with initial permissions
  await device.launchApp({
    newInstance: true,
    permissions: {
      camera: 'YES',
      location: 'always',
      notifications: 'YES',
      photos: 'YES',
      contacts: 'NO',
      calendar: 'NO',
      microphone: 'NO',
    },
    languageAndLocale: {
      language: 'fr',
      locale: 'fr-FR',
    },
  });

  if (E2E_CONFIG.debug) {
    console.log('[E2E] App launched with configuration:', E2E_CONFIG);
  }
});

beforeEach(async () => {
  // Reset React Native state between tests
  await device.reloadReactNative();

  if (E2E_CONFIG.debug) {
    const testName = expect.getState().currentTestName;
    console.log(`[E2E] Starting test: ${testName}`);
  }
});

afterEach(async () => {
  const testName = expect.getState().currentTestName;
  const testPassed = expect.getState().numPassingAsserts > 0;

  if (E2E_CONFIG.debug) {
    console.log(`[E2E] Finished test: ${testName} - ${testPassed ? 'PASSED' : 'FAILED'}`);
  }

  // Take screenshot on failure
  if (!testPassed && E2E_CONFIG.screenshotOnFailure) {
    const screenshotName = `failure-${testName?.replace(/\s+/g, '-')}-${Date.now()}`;
    try {
      await device.takeScreenshot(screenshotName);
      console.log(`[E2E] Screenshot saved: ${screenshotName}`);
    } catch (error) {
      console.warn(`[E2E] Failed to take screenshot: ${error}`);
    }
  }
});

afterAll(async () => {
  // Cleanup
  if (E2E_CONFIG.debug) {
    console.log('[E2E] Test suite completed, cleaning up...');
  }

  try {
    await device.terminateApp();
  } catch {
    // App might already be terminated
  }
});

// ============================================================================
// Custom Jest Matchers
// ============================================================================

expect.extend({
  async toBeVisibleWithRetry(elementRef: Detox.NativeElement, timeout: number = 5000) {
    const startTime = Date.now();
    let lastError: Error | null = null;

    while (Date.now() - startTime < timeout) {
      try {
        await detoxExpect(elementRef).toBeVisible();
        return {
          pass: true,
          message: () => 'Element is visible',
        };
      } catch (error) {
        lastError = error as Error;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      pass: false,
      message: () => `Element was not visible after ${timeout}ms: ${lastError?.message}`,
    };
  },
});

// ============================================================================
// Global Error Handler
// ============================================================================

process.on('unhandledRejection', (reason, promise) => {
  console.error('[E2E] Unhandled Rejection at:', promise, 'reason:', reason);
});

// ============================================================================
// Console Enhancement for Better Debug Output
// ============================================================================

if (E2E_CONFIG.debug) {
  const originalConsoleLog = console.log;
  console.log = (...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    originalConsoleLog(`[${timestamp}]`, ...args);
  };
}

// ============================================================================
// Export for Use in Tests
// ============================================================================

export { device, element, by, detoxExpect as expect };
