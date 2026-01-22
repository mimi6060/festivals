/**
 * Authentication Helpers for E2E Tests
 *
 * Provides utilities for login, logout, and session management
 */

import { device, element, by, expect, waitFor } from 'detox';
import { TIMEOUTS } from './wait';
import { TEST_USERS } from '../fixtures/testData';

// ============================================================================
// Types
// ============================================================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegistrationData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms?: boolean;
}

// ============================================================================
// Login Functions
// ============================================================================

/**
 * Login with email and password
 */
export async function login(
  credentials?: LoginCredentials
): Promise<void> {
  const { email, password } = credentials || TEST_USERS.standard;

  // Wait for login screen
  await waitFor(element(by.id('login-email-input')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);

  // Clear and enter email
  await element(by.id('login-email-input')).clearText();
  await element(by.id('login-email-input')).typeText(email);

  // Clear and enter password
  await element(by.id('login-password-input')).clearText();
  await element(by.id('login-password-input')).typeText(password);

  // Dismiss keyboard
  await element(by.id('login-password-input')).tapReturnKey();

  // Submit login
  await element(by.id('login-submit-button')).tap();

  // Wait for successful login (main screen appears)
  await waitFor(element(by.text('Accueil')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.long);
}

/**
 * Login with test user account
 */
export async function loginAsTestUser(): Promise<void> {
  await login(TEST_USERS.standard);
}

/**
 * Login as staff member
 */
export async function loginAsStaff(): Promise<void> {
  await login(TEST_USERS.staff);
}

/**
 * Login as admin
 */
export async function loginAsAdmin(): Promise<void> {
  await login(TEST_USERS.admin);
}

/**
 * Attempt login with biometric authentication
 */
export async function loginWithBiometric(): Promise<void> {
  // Wait for biometric button to be visible
  await waitFor(element(by.id('biometric-login-button')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);

  // Tap biometric login
  await element(by.id('biometric-login-button')).tap();

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
  await waitFor(element(by.id('biometric-login-button')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);

  await element(by.id('biometric-login-button')).tap();

  if (device.getPlatform() === 'ios') {
    await device.unmatchFace();
  } else {
    await device.unmatchFinger();
  }
}

// ============================================================================
// Registration Functions
// ============================================================================

/**
 * Register a new account
 */
export async function register(data: RegistrationData): Promise<void> {
  // Navigate to registration screen
  await waitFor(element(by.id('register-link')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);
  await element(by.id('register-link')).tap();

  // Wait for registration form
  await waitFor(element(by.id('register-name-input')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);

  // Fill in registration form
  await element(by.id('register-name-input')).typeText(data.name);
  await element(by.id('register-email-input')).typeText(data.email);
  await element(by.id('register-password-input')).typeText(data.password);
  await element(by.id('register-confirm-password-input')).typeText(data.confirmPassword);

  // Accept terms if required
  if (data.acceptTerms !== false) {
    await element(by.id('terms-checkbox')).tap();
  }

  // Submit registration
  await element(by.id('register-submit-button')).tap();

  // Wait for successful registration
  await waitFor(element(by.text('Accueil')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.long);
}

/**
 * Generate unique email for registration tests
 */
export function generateUniqueEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-${timestamp}-${random}@festivals.app`;
}

// ============================================================================
// Logout Functions
// ============================================================================

/**
 * Logout from the app
 */
export async function logout(): Promise<void> {
  // Navigate to profile
  await navigateToProfile();

  // Scroll to find logout button if needed
  try {
    await waitFor(element(by.id('logout-button')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.short);
  } catch {
    await element(by.id('profile-scroll-view')).scroll(300, 'down');
  }

  // Tap logout
  await element(by.id('logout-button')).tap();

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
  await waitFor(element(by.id('login-email-input')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);
}

// ============================================================================
// Session Management
// ============================================================================

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
 * Ensure user is logged in (login if needed)
 */
export async function ensureLoggedIn(credentials?: LoginCredentials): Promise<void> {
  const loggedIn = await isLoggedIn();
  if (!loggedIn) {
    await login(credentials);
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

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Navigate to profile tab
 */
export async function navigateToProfile(): Promise<void> {
  await waitFor(element(by.text('Profil')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);
  await element(by.text('Profil')).tap();
}

// ============================================================================
// Password Recovery
// ============================================================================

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<void> {
  // Navigate to forgot password
  await waitFor(element(by.id('forgot-password-link')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);
  await element(by.id('forgot-password-link')).tap();

  // Wait for forgot password form
  await waitFor(element(by.id('forgot-password-email-input')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);

  // Enter email
  await element(by.id('forgot-password-email-input')).typeText(email);

  // Submit
  await element(by.id('forgot-password-submit-button')).tap();

  // Wait for success message
  await waitFor(element(by.text('Email envoye')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);
}

// ============================================================================
// Error Handling Tests
// ============================================================================

/**
 * Attempt login with invalid credentials
 */
export async function attemptInvalidLogin(
  email: string = 'invalid@test.com',
  password: string = 'wrongpassword'
): Promise<void> {
  await waitFor(element(by.id('login-email-input')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);

  await element(by.id('login-email-input')).clearText();
  await element(by.id('login-email-input')).typeText(email);

  await element(by.id('login-password-input')).clearText();
  await element(by.id('login-password-input')).typeText(password);

  await element(by.id('login-password-input')).tapReturnKey();
  await element(by.id('login-submit-button')).tap();
}

/**
 * Verify error message is displayed
 */
export async function verifyErrorMessage(expectedMessage: string): Promise<void> {
  await waitFor(element(by.text(expectedMessage)))
    .toBeVisible()
    .withTimeout(TIMEOUTS.medium);
}
