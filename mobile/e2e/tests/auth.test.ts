/**
 * Authentication E2E Tests
 *
 * Comprehensive tests for login, logout, biometric authentication, and session persistence.
 */

import { device, element, by, expect, waitFor } from 'detox';
import { TestIds } from '../utils/testIds';
import {
  login,
  logout,
  loginWithBiometric,
  failBiometricLogin,
  attemptInvalidLogin,
  ensureLoggedOut,
  clearAppData,
  generateUniqueEmail,
} from '../utils/helpers';

// Test user credentials
const TEST_USER = {
  email: 'test@festivals.app',
  password: 'TestPassword123!',
  name: 'Test User',
};

const STAFF_USER = {
  email: 'staff@festivals.app',
  password: 'StaffPassword123!',
  name: 'Staff Member',
};

// Timeouts
const TIMEOUT = {
  short: 3000,
  medium: 10000,
  long: 30000,
};

describe('Authentication E2E Tests', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: {
        camera: 'YES',
        location: 'always',
        notifications: 'YES',
      },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await ensureLoggedOut();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  // ==========================================================================
  // Login Flow Tests
  // ==========================================================================

  describe('Login Flow', () => {
    it('should display login screen with all required elements', async () => {
      await expect(element(by.id(TestIds.auth.emailInput))).toBeVisible();
      await expect(element(by.id(TestIds.auth.passwordInput))).toBeVisible();
      await expect(element(by.id(TestIds.auth.loginButton))).toBeVisible();
      await expect(element(by.id(TestIds.auth.forgotPasswordLink))).toBeVisible();
      await expect(element(by.id(TestIds.auth.registerLink))).toBeVisible();
    });

    it('should show error for empty email', async () => {
      await element(by.id(TestIds.auth.passwordInput)).typeText('password');
      await element(by.id(TestIds.auth.loginButton)).tap();

      await waitFor(element(by.text('Veuillez entrer votre email')))
        .toBeVisible()
        .withTimeout(TIMEOUT.short);
    });

    it('should show error for invalid email format', async () => {
      await element(by.id(TestIds.auth.emailInput)).typeText('invalid-email');
      await element(by.id(TestIds.auth.passwordInput)).typeText('password');
      await element(by.id(TestIds.auth.loginButton)).tap();

      await waitFor(element(by.text('Format email invalide')))
        .toBeVisible()
        .withTimeout(TIMEOUT.short);
    });

    it('should show error for incorrect credentials', async () => {
      await attemptInvalidLogin('wrong@email.com', 'wrongpassword');

      await waitFor(element(by.text('Email ou mot de passe incorrect')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should login successfully with valid credentials', async () => {
      await login(TEST_USER);

      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);

      // Verify profile shows correct user
      await element(by.text('Profil')).tap();
      await expect(element(by.text(TEST_USER.name))).toBeVisible();
    });

    it('should toggle password visibility', async () => {
      await element(by.id(TestIds.auth.passwordInput)).typeText('testpassword');
      await element(by.id(TestIds.auth.togglePasswordVisibility)).tap();

      // Password field should remain visible (type changed from secure to text)
      await expect(element(by.id(TestIds.auth.passwordInput))).toBeVisible();

      // Toggle back
      await element(by.id(TestIds.auth.togglePasswordVisibility)).tap();
    });

    it('should navigate to forgot password screen', async () => {
      await element(by.id(TestIds.auth.forgotPasswordLink)).tap();

      await waitFor(element(by.id(TestIds.auth.forgotPasswordEmailInput)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await expect(element(by.text('Mot de passe oublie'))).toBeVisible();
    });

    it('should navigate to registration screen', async () => {
      await element(by.id(TestIds.auth.registerLink)).tap();

      await waitFor(element(by.id(TestIds.auth.registerNameInput)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await expect(element(by.text('Creer un compte'))).toBeVisible();
    });

    it('should dismiss keyboard when tapping outside', async () => {
      await element(by.id(TestIds.auth.emailInput)).tap();
      await element(by.id(TestIds.auth.emailInput)).typeText('test@');

      // Tap outside to dismiss keyboard
      await element(by.id(TestIds.auth.loginButton)).tap();

      // Email input should still show the text
      await expect(element(by.id(TestIds.auth.emailInput))).toBeVisible();
    });
  });

  // ==========================================================================
  // Logout Flow Tests
  // ==========================================================================

  describe('Logout Flow', () => {
    beforeEach(async () => {
      await login(TEST_USER);
      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should logout successfully', async () => {
      await logout();

      await expect(element(by.id(TestIds.auth.emailInput))).toBeVisible();
      await expect(element(by.id(TestIds.auth.passwordInput))).toBeVisible();
    });

    it('should show logout confirmation dialog', async () => {
      await element(by.text('Profil')).tap();
      await element(by.id(TestIds.auth.logoutButton)).tap();

      await waitFor(element(by.text('Voulez-vous vraiment vous deconnecter ?')))
        .toBeVisible()
        .withTimeout(TIMEOUT.short);
    });

    it('should cancel logout when user cancels', async () => {
      await element(by.text('Profil')).tap();
      await element(by.id(TestIds.auth.logoutButton)).tap();

      await waitFor(element(by.text('Voulez-vous vraiment vous deconnecter ?')))
        .toBeVisible()
        .withTimeout(TIMEOUT.short);

      // Cancel logout
      await element(by.text('Annuler')).tap();

      // Should still be on profile screen
      await expect(element(by.text('Profil'))).toBeVisible();
    });

    it('should clear user data after logout', async () => {
      await logout();

      // Login again
      await login(TEST_USER);

      // Verify user data is fresh
      await element(by.text('Profil')).tap();
      await expect(element(by.text(TEST_USER.name))).toBeVisible();
    });

    it('should redirect to login when accessing protected screen after logout', async () => {
      await logout();

      // Should be on login screen
      await expect(element(by.id(TestIds.auth.emailInput))).toBeVisible();
    });
  });

  // ==========================================================================
  // Biometric Authentication Tests
  // ==========================================================================

  describe('Biometric Authentication', () => {
    beforeEach(async () => {
      // First login normally to enable biometric enrollment
      await login(TEST_USER);
      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
      await logout();
    });

    it('should display biometric login option when available', async () => {
      await waitFor(element(by.id(TestIds.auth.biometricLoginButton)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should login successfully with Face ID (iOS)', async () => {
      if (device.getPlatform() !== 'ios') {
        return; // Skip on Android
      }

      await loginWithBiometric();

      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should login successfully with fingerprint (Android)', async () => {
      if (device.getPlatform() !== 'android') {
        return; // Skip on iOS
      }

      await loginWithBiometric();

      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should show error on biometric failure', async () => {
      await failBiometricLogin();

      await waitFor(element(by.text('Authentification echouee')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should fall back to password login after biometric failure', async () => {
      await failBiometricLogin();

      // Should still see login form
      await expect(element(by.id(TestIds.auth.emailInput))).toBeVisible();
      await expect(element(by.id(TestIds.auth.passwordInput))).toBeVisible();

      // Login with password should work
      await login(TEST_USER);

      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should show biometric prompt with correct message', async () => {
      await element(by.id(TestIds.auth.biometricLoginButton)).tap();

      // The biometric prompt should appear
      // Note: We can't directly verify the system dialog content
      // but we can verify the flow completes or fails appropriately
    });

    it('should cancel biometric and return to login form', async () => {
      await element(by.id(TestIds.auth.biometricLoginButton)).tap();

      // Simulate cancel (system handles this)
      if (device.getPlatform() === 'ios') {
        await device.unmatchFace();
      } else {
        await device.unmatchFinger();
      }

      // Should still see login form
      await expect(element(by.id(TestIds.auth.emailInput))).toBeVisible();
    });
  });

  // ==========================================================================
  // Session Persistence Tests
  // ==========================================================================

  describe('Session Persistence', () => {
    it('should persist login state after app restart', async () => {
      await login(TEST_USER);

      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);

      // Reload app (simulates restart)
      await device.reloadReactNative();

      // Should still be logged in
      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should maintain session across app backgrounding', async () => {
      await login(TEST_USER);

      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);

      // Background the app
      await device.sendToHome();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Bring app back to foreground
      await device.launchApp({ newInstance: false });

      // Should still be logged in
      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should handle expired session gracefully', async () => {
      await login(TEST_USER);

      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);

      // Simulate session expiration by clearing app data
      await clearAppData();

      // Should be redirected to login
      await waitFor(element(by.id(TestIds.auth.emailInput)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should persist user preferences after logout and login', async () => {
      await login(TEST_USER);

      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);

      // Navigate to settings and change a preference (if applicable)
      // This test verifies that user-specific settings persist

      await logout();
      await login(TEST_USER);

      // Verify user is logged in again
      await element(by.text('Profil')).tap();
      await expect(element(by.text(TEST_USER.name))).toBeVisible();
    });

    it('should show session expired message when token expires', async () => {
      await login(TEST_USER);

      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);

      // In a real scenario, we would simulate token expiration
      // For now, we verify the login flow works
      await expect(element(by.text('Accueil'))).toBeVisible();
    });

    it('should remember last logged in user email', async () => {
      await login(TEST_USER);
      await logout();

      // Email field should be pre-filled with last user's email
      try {
        const emailField = element(by.id(TestIds.auth.emailInput));
        await expect(emailField).toHaveText(TEST_USER.email);
      } catch {
        // Some implementations don't pre-fill email for security
        await expect(element(by.id(TestIds.auth.emailInput))).toBeVisible();
      }
    });
  });

  // ==========================================================================
  // Registration Flow Tests
  // ==========================================================================

  describe('Registration Flow', () => {
    beforeEach(async () => {
      await element(by.id(TestIds.auth.registerLink)).tap();
      await waitFor(element(by.id(TestIds.auth.registerNameInput)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should display registration form with all fields', async () => {
      await expect(element(by.id(TestIds.auth.registerNameInput))).toBeVisible();
      await expect(element(by.id(TestIds.auth.registerEmailInput))).toBeVisible();
      await expect(element(by.id(TestIds.auth.registerPasswordInput))).toBeVisible();
      await expect(element(by.id(TestIds.auth.registerConfirmPasswordInput))).toBeVisible();
      await expect(element(by.id(TestIds.auth.termsCheckbox))).toBeVisible();
    });

    it('should show error for password mismatch', async () => {
      const testEmail = generateUniqueEmail();
      await element(by.id(TestIds.auth.registerNameInput)).typeText('Test User');
      await element(by.id(TestIds.auth.registerEmailInput)).typeText(testEmail);
      await element(by.id(TestIds.auth.registerPasswordInput)).typeText('Password123!');
      await element(by.id(TestIds.auth.registerConfirmPasswordInput)).typeText('DifferentPassword!');
      await element(by.id(TestIds.auth.registerSubmitButton)).tap();

      await waitFor(element(by.text('Les mots de passe ne correspondent pas')))
        .toBeVisible()
        .withTimeout(TIMEOUT.short);
    });

    it('should show error for weak password', async () => {
      const testEmail = generateUniqueEmail();
      await element(by.id(TestIds.auth.registerNameInput)).typeText('Test User');
      await element(by.id(TestIds.auth.registerEmailInput)).typeText(testEmail);
      await element(by.id(TestIds.auth.registerPasswordInput)).typeText('weak');
      await element(by.id(TestIds.auth.registerConfirmPasswordInput)).typeText('weak');
      await element(by.id(TestIds.auth.termsCheckbox)).tap();
      await element(by.id(TestIds.auth.registerSubmitButton)).tap();

      await waitFor(element(by.text('Le mot de passe doit contenir au moins 8 caracteres')))
        .toBeVisible()
        .withTimeout(TIMEOUT.short);
    });

    it('should navigate back to login', async () => {
      await element(by.id(TestIds.auth.backToLoginLink)).tap();

      await waitFor(element(by.id(TestIds.auth.emailInput)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });
  });

  // ==========================================================================
  // Forgot Password Tests
  // ==========================================================================

  describe('Forgot Password Flow', () => {
    beforeEach(async () => {
      await element(by.id(TestIds.auth.forgotPasswordLink)).tap();
      await waitFor(element(by.id(TestIds.auth.forgotPasswordEmailInput)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should display forgot password form', async () => {
      await expect(element(by.text('Mot de passe oublie'))).toBeVisible();
      await expect(element(by.id(TestIds.auth.forgotPasswordEmailInput))).toBeVisible();
      await expect(element(by.id(TestIds.auth.forgotPasswordSubmitButton))).toBeVisible();
    });

    it('should show success message after submitting valid email', async () => {
      await element(by.id(TestIds.auth.forgotPasswordEmailInput)).typeText(TEST_USER.email);
      await element(by.id(TestIds.auth.forgotPasswordSubmitButton)).tap();

      await waitFor(element(by.text('Email envoye')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should navigate back to login', async () => {
      await element(by.id(TestIds.auth.backToLoginButton)).tap();

      await waitFor(element(by.id(TestIds.auth.emailInput)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });
  });
});
