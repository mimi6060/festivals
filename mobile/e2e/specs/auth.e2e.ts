/**
 * Authentication E2E Tests
 *
 * Tests for login, registration, logout, and biometric authentication
 */

import { device, element, by, expect, waitFor } from 'detox';
import {
  login,
  logout,
  register,
  loginWithBiometric,
  failBiometricLogin,
  attemptInvalidLogin,
  verifyErrorMessage,
  ensureLoggedOut,
  clearAppData,
  generateUniqueEmail,
} from '../utils/auth';
import { TIMEOUTS, waitForAnimation, waitForElementVisible } from '../utils/wait';
import {
  TEST_USERS,
  TEST_IDS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '../fixtures/testData';

describe('Authentication Flow', () => {
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
  // Login Tests
  // ==========================================================================

  describe('Login', () => {
    it('should display login screen with all required elements', async () => {
      await expect(element(by.id(TEST_IDS.loginEmailInput))).toBeVisible();
      await expect(element(by.id(TEST_IDS.loginPasswordInput))).toBeVisible();
      await expect(element(by.id(TEST_IDS.loginSubmitButton))).toBeVisible();
      await expect(element(by.id(TEST_IDS.forgotPasswordLink))).toBeVisible();
      await expect(element(by.id(TEST_IDS.registerLink))).toBeVisible();
    });

    it('should show error for empty credentials', async () => {
      await element(by.id(TEST_IDS.loginSubmitButton)).tap();

      await waitFor(element(by.text(ERROR_MESSAGES.emptyEmail)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.short);
    });

    it('should show error for invalid email format', async () => {
      await element(by.id(TEST_IDS.loginEmailInput)).typeText('invalid-email');
      await element(by.id(TEST_IDS.loginPasswordInput)).typeText('somepassword');
      await element(by.id(TEST_IDS.loginSubmitButton)).tap();

      await waitFor(element(by.text(ERROR_MESSAGES.invalidEmail)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.short);
    });

    it('should show error for incorrect credentials', async () => {
      await attemptInvalidLogin('wrong@email.com', 'wrongpassword');

      await waitFor(element(by.text(ERROR_MESSAGES.invalidCredentials)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should login successfully with valid credentials', async () => {
      await login(TEST_USERS.standard);

      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.long);

      // Verify profile shows correct user
      await element(by.text('Profil')).tap();
      await expect(element(by.text(TEST_USERS.standard.name))).toBeVisible();
    });

    it('should toggle password visibility', async () => {
      await element(by.id(TEST_IDS.loginPasswordInput)).typeText('testpassword');
      await element(by.id('toggle-password-visibility')).tap();

      // Password field should remain visible (type changed)
      await expect(element(by.id(TEST_IDS.loginPasswordInput))).toBeVisible();

      await element(by.id('toggle-password-visibility')).tap();
    });

    it('should navigate to forgot password screen', async () => {
      await element(by.id(TEST_IDS.forgotPasswordLink)).tap();

      await waitFor(element(by.id('forgot-password-email-input')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      await expect(element(by.text('Mot de passe oublie'))).toBeVisible();
    });

    it('should persist login state after app restart', async () => {
      await login(TEST_USERS.standard);

      // Reload app
      await device.reloadReactNative();

      // Should still be logged in
      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.long);
    });
  });

  // ==========================================================================
  // Registration Tests
  // ==========================================================================

  describe('Registration', () => {
    beforeEach(async () => {
      await element(by.id(TEST_IDS.registerLink)).tap();
      await waitFor(element(by.id(TEST_IDS.registerNameInput)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should display registration form with all required fields', async () => {
      await expect(element(by.id(TEST_IDS.registerNameInput))).toBeVisible();
      await expect(element(by.id(TEST_IDS.registerEmailInput))).toBeVisible();
      await expect(element(by.id(TEST_IDS.registerPasswordInput))).toBeVisible();
      await expect(element(by.id(TEST_IDS.registerConfirmPasswordInput))).toBeVisible();
      await expect(element(by.id(TEST_IDS.registerSubmitButton))).toBeVisible();
      await expect(element(by.id(TEST_IDS.termsCheckbox))).toBeVisible();
    });

    it('should show error for empty fields', async () => {
      await element(by.id(TEST_IDS.registerSubmitButton)).tap();

      await waitFor(element(by.text('Veuillez remplir tous les champs')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.short);
    });

    it('should show error for password mismatch', async () => {
      const testEmail = generateUniqueEmail();
      await element(by.id(TEST_IDS.registerNameInput)).typeText('Test User');
      await element(by.id(TEST_IDS.registerEmailInput)).typeText(testEmail);
      await element(by.id(TEST_IDS.registerPasswordInput)).typeText('Password123!');
      await element(by.id(TEST_IDS.registerConfirmPasswordInput)).typeText('DifferentPassword123!');
      await element(by.id(TEST_IDS.registerSubmitButton)).tap();

      await waitFor(element(by.text(ERROR_MESSAGES.passwordMismatch)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.short);
    });

    it('should show error for weak password', async () => {
      const testEmail = generateUniqueEmail();
      await element(by.id(TEST_IDS.registerNameInput)).typeText('Test User');
      await element(by.id(TEST_IDS.registerEmailInput)).typeText(testEmail);
      await element(by.id(TEST_IDS.registerPasswordInput)).typeText('123');
      await element(by.id(TEST_IDS.registerConfirmPasswordInput)).typeText('123');
      await element(by.id(TEST_IDS.registerSubmitButton)).tap();

      await waitFor(element(by.text(ERROR_MESSAGES.weakPassword)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.short);
    });

    it('should show error if terms not accepted', async () => {
      const testEmail = generateUniqueEmail();
      await element(by.id(TEST_IDS.registerNameInput)).typeText('Test User');
      await element(by.id(TEST_IDS.registerEmailInput)).typeText(testEmail);
      await element(by.id(TEST_IDS.registerPasswordInput)).typeText('Password123!');
      await element(by.id(TEST_IDS.registerConfirmPasswordInput)).typeText('Password123!');
      await element(by.id(TEST_IDS.registerSubmitButton)).tap();

      await waitFor(element(by.text(ERROR_MESSAGES.termsNotAccepted)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.short);
    });

    it('should register successfully with valid data', async () => {
      const testEmail = generateUniqueEmail();

      await register({
        name: 'New Test User',
        email: testEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        acceptTerms: true,
      });

      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.long);
    });

    it('should show error for existing email', async () => {
      await element(by.id(TEST_IDS.registerNameInput)).typeText('Test User');
      await element(by.id(TEST_IDS.registerEmailInput)).typeText(TEST_USERS.standard.email);
      await element(by.id(TEST_IDS.registerPasswordInput)).typeText('Password123!');
      await element(by.id(TEST_IDS.registerConfirmPasswordInput)).typeText('Password123!');
      await element(by.id(TEST_IDS.termsCheckbox)).tap();
      await element(by.id(TEST_IDS.registerSubmitButton)).tap();

      await waitFor(element(by.text(ERROR_MESSAGES.emailInUse)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should navigate back to login screen', async () => {
      await element(by.id('back-to-login-link')).tap();

      await waitFor(element(by.id(TEST_IDS.loginEmailInput)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show password requirements while typing', async () => {
      await element(by.id(TEST_IDS.registerPasswordInput)).tap();
      await element(by.id(TEST_IDS.registerPasswordInput)).typeText('test');

      await expect(element(by.id('password-requirements'))).toBeVisible();
    });
  });

  // ==========================================================================
  // Logout Tests
  // ==========================================================================

  describe('Logout', () => {
    beforeEach(async () => {
      await login(TEST_USERS.standard);
    });

    it('should logout successfully', async () => {
      await logout();

      await expect(element(by.id(TEST_IDS.loginEmailInput))).toBeVisible();
      await expect(element(by.id(TEST_IDS.loginPasswordInput))).toBeVisible();
    });

    it('should show logout confirmation dialog', async () => {
      await element(by.text('Profil')).tap();
      await element(by.id(TEST_IDS.logoutButton)).tap();

      await waitFor(element(by.text('Voulez-vous vraiment vous deconnecter ?')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.short);

      // Cancel logout
      await element(by.text('Annuler')).tap();

      // Should still be on profile screen
      await expect(element(by.text('Profil'))).toBeVisible();
    });

    it('should clear user data after logout', async () => {
      await logout();
      await login(TEST_USERS.standard);

      // Navigate to profile and verify user data is fresh
      await element(by.text('Profil')).tap();
      await expect(element(by.text(TEST_USERS.standard.name))).toBeVisible();
    });

    it('should redirect to login when accessing protected screen after logout', async () => {
      await logout();

      await expect(element(by.id(TEST_IDS.loginEmailInput))).toBeVisible();
    });
  });

  // ==========================================================================
  // Biometric Authentication Tests
  // ==========================================================================

  describe('Biometric Authentication', () => {
    beforeEach(async () => {
      // First login normally to enable biometric
      await login(TEST_USERS.standard);
      await logout();
    });

    it('should display biometric login option when available', async () => {
      await waitFor(element(by.id(TEST_IDS.biometricLoginButton)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should login successfully with biometric', async () => {
      await loginWithBiometric();

      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.long);
    });

    it('should show error on biometric failure', async () => {
      await failBiometricLogin();

      await waitFor(element(by.text('Authentification echouee')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should fall back to password login after biometric failure', async () => {
      await failBiometricLogin();

      // Should still see login form
      await expect(element(by.id(TEST_IDS.loginEmailInput))).toBeVisible();
      await expect(element(by.id(TEST_IDS.loginPasswordInput))).toBeVisible();

      // Login with password should work
      await login(TEST_USERS.standard);

      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.long);
    });
  });

  // ==========================================================================
  // Forgot Password Tests
  // ==========================================================================

  describe('Forgot Password', () => {
    beforeEach(async () => {
      await element(by.id(TEST_IDS.forgotPasswordLink)).tap();
      await waitFor(element(by.id('forgot-password-email-input')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should display forgot password form', async () => {
      await expect(element(by.text('Mot de passe oublie'))).toBeVisible();
      await expect(element(by.id('forgot-password-email-input'))).toBeVisible();
      await expect(element(by.id('forgot-password-submit-button'))).toBeVisible();
    });

    it('should show error for empty email', async () => {
      await element(by.id('forgot-password-submit-button')).tap();

      await waitFor(element(by.text(ERROR_MESSAGES.emptyEmail)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.short);
    });

    it('should show error for invalid email format', async () => {
      await element(by.id('forgot-password-email-input')).typeText('invalid-email');
      await element(by.id('forgot-password-submit-button')).tap();

      await waitFor(element(by.text(ERROR_MESSAGES.invalidEmail)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.short);
    });

    it('should send reset email successfully', async () => {
      await element(by.id('forgot-password-email-input')).typeText(TEST_USERS.standard.email);
      await element(by.id('forgot-password-submit-button')).tap();

      await waitFor(element(by.text(SUCCESS_MESSAGES.passwordResetSent)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      await expect(
        element(by.text('Consultez votre boite mail pour reinitialiser votre mot de passe'))
      ).toBeVisible();
    });

    it('should navigate back to login', async () => {
      await element(by.id('back-to-login-button')).tap();

      await waitFor(element(by.id(TEST_IDS.loginEmailInput)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });
  });

  // ==========================================================================
  // Session Management Tests
  // ==========================================================================

  describe('Session Management', () => {
    it('should handle expired session gracefully', async () => {
      await login(TEST_USERS.standard);

      // Simulate session expiration by clearing storage
      await clearAppData();

      // Should be redirected to login
      await waitFor(element(by.id(TEST_IDS.loginEmailInput)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should maintain session across app backgrounding', async () => {
      await login(TEST_USERS.standard);

      // Background the app
      await device.sendToHome();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Bring app back to foreground
      await device.launchApp({ newInstance: false });

      // Should still be logged in
      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });
  });
});
