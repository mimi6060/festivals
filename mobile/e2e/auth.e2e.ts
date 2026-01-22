import {
  device,
  element,
  by,
  expect,
  waitFor,
  initializeApp,
  resetAppState,
  cleanupApp,
  TEST_CONFIG,
  fillInput,
  tapButton,
  tapButtonByText,
  assertTextVisible,
  assertVisible,
  assertNotVisible,
  sleep,
  generateTestEmail,
  navigateToTab,
  login,
  logout,
  isLoggedIn,
} from './setup';

describe('Authentication Flow', () => {
  beforeAll(async () => {
    await initializeApp();
  });

  beforeEach(async () => {
    await resetAppState();
  });

  afterAll(async () => {
    await cleanupApp();
  });

  // ==========================================================================
  // Login Tests
  // ==========================================================================

  describe('Login', () => {
    it('should display login screen with all required elements', async () => {
      // Check login screen elements are visible
      await expect(element(by.id('login-email-input'))).toBeVisible();
      await expect(element(by.id('login-password-input'))).toBeVisible();
      await expect(element(by.id('login-submit-button'))).toBeVisible();
      await expect(element(by.id('forgot-password-link'))).toBeVisible();
      await expect(element(by.id('register-link'))).toBeVisible();
    });

    it('should show error for empty credentials', async () => {
      // Tap login without entering credentials
      await tapButton('login-submit-button');

      // Check error message is displayed
      await waitFor(element(by.text('Veuillez entrer votre email')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.short);
    });

    it('should show error for invalid email format', async () => {
      // Enter invalid email
      await fillInput('login-email-input', 'invalid-email');
      await fillInput('login-password-input', 'somepassword');
      await tapButton('login-submit-button');

      // Check error message
      await waitFor(element(by.text('Format email invalide')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.short);
    });

    it('should show error for incorrect credentials', async () => {
      // Enter wrong credentials
      await fillInput('login-email-input', 'wrong@email.com');
      await fillInput('login-password-input', 'wrongpassword');
      await tapButton('login-submit-button');

      // Check error message
      await waitFor(element(by.text('Email ou mot de passe incorrect')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.medium);
    });

    it('should login successfully with valid credentials', async () => {
      // Enter valid credentials
      await fillInput('login-email-input', TEST_CONFIG.testUser.email);
      await fillInput('login-password-input', TEST_CONFIG.testUser.password);
      await tapButton('login-submit-button');

      // Wait for main screen to appear
      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.long);

      // Verify user is logged in
      await navigateToTab('Profil');
      await expect(element(by.text(TEST_CONFIG.testUser.name))).toBeVisible();
    });

    it('should toggle password visibility', async () => {
      // Enter password
      await fillInput('login-password-input', 'testpassword');

      // Tap show password button
      await tapButton('toggle-password-visibility');

      // Password should now be visible (text input type changed)
      await expect(element(by.id('login-password-input'))).toBeVisible();

      // Tap again to hide
      await tapButton('toggle-password-visibility');
    });

    it('should navigate to forgot password screen', async () => {
      await tapButton('forgot-password-link');

      // Check forgot password screen is displayed
      await waitFor(element(by.id('forgot-password-email-input')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.medium);

      await expect(element(by.text('Mot de passe oublie'))).toBeVisible();
    });

    it('should persist login state after app restart', async () => {
      // Login first
      await login();

      // Verify logged in
      const loggedIn = await isLoggedIn();
      expect(loggedIn).toBe(true);

      // Reload app
      await device.reloadReactNative();

      // Should still be logged in
      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.long);
    });
  });

  // ==========================================================================
  // Registration Tests
  // ==========================================================================

  describe('Registration', () => {
    beforeEach(async () => {
      // Navigate to registration screen
      await tapButton('register-link');
      await waitFor(element(by.id('register-name-input')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.medium);
    });

    it('should display registration form with all required fields', async () => {
      await expect(element(by.id('register-name-input'))).toBeVisible();
      await expect(element(by.id('register-email-input'))).toBeVisible();
      await expect(element(by.id('register-password-input'))).toBeVisible();
      await expect(element(by.id('register-confirm-password-input'))).toBeVisible();
      await expect(element(by.id('register-submit-button'))).toBeVisible();
      await expect(element(by.id('terms-checkbox'))).toBeVisible();
    });

    it('should show error for empty fields', async () => {
      await tapButton('register-submit-button');

      await waitFor(element(by.text('Veuillez remplir tous les champs')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.short);
    });

    it('should show error for password mismatch', async () => {
      await fillInput('register-name-input', 'Test User');
      await fillInput('register-email-input', generateTestEmail());
      await fillInput('register-password-input', 'Password123!');
      await fillInput('register-confirm-password-input', 'DifferentPassword123!');
      await tapButton('register-submit-button');

      await waitFor(element(by.text('Les mots de passe ne correspondent pas')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.short);
    });

    it('should show error for weak password', async () => {
      await fillInput('register-name-input', 'Test User');
      await fillInput('register-email-input', generateTestEmail());
      await fillInput('register-password-input', '123');
      await fillInput('register-confirm-password-input', '123');
      await tapButton('register-submit-button');

      await waitFor(element(by.text('Le mot de passe doit contenir au moins 8 caracteres')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.short);
    });

    it('should show error if terms not accepted', async () => {
      const testEmail = generateTestEmail();
      await fillInput('register-name-input', 'Test User');
      await fillInput('register-email-input', testEmail);
      await fillInput('register-password-input', 'Password123!');
      await fillInput('register-confirm-password-input', 'Password123!');
      await tapButton('register-submit-button');

      await waitFor(element(by.text('Veuillez accepter les conditions')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.short);
    });

    it('should register successfully with valid data', async () => {
      const testEmail = generateTestEmail();

      await fillInput('register-name-input', 'New Test User');
      await fillInput('register-email-input', testEmail);
      await fillInput('register-password-input', 'Password123!');
      await fillInput('register-confirm-password-input', 'Password123!');

      // Accept terms
      await tapButton('terms-checkbox');

      await tapButton('register-submit-button');

      // Wait for success or redirect to main screen
      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.long);
    });

    it('should show error for existing email', async () => {
      await fillInput('register-name-input', 'Test User');
      await fillInput('register-email-input', TEST_CONFIG.testUser.email); // Existing email
      await fillInput('register-password-input', 'Password123!');
      await fillInput('register-confirm-password-input', 'Password123!');
      await tapButton('terms-checkbox');
      await tapButton('register-submit-button');

      await waitFor(element(by.text('Cet email est deja utilise')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.medium);
    });

    it('should navigate back to login screen', async () => {
      await tapButton('back-to-login-link');

      await waitFor(element(by.id('login-email-input')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.medium);
    });

    it('should show password requirements while typing', async () => {
      await element(by.id('register-password-input')).tap();
      await element(by.id('register-password-input')).typeText('test');

      // Check password requirements hints are visible
      await expect(element(by.id('password-requirements'))).toBeVisible();
    });
  });

  // ==========================================================================
  // Logout Tests
  // ==========================================================================

  describe('Logout', () => {
    beforeEach(async () => {
      // Ensure user is logged in before each logout test
      await login();
    });

    it('should logout successfully', async () => {
      await logout();

      // Verify login screen is displayed
      await expect(element(by.id('login-email-input'))).toBeVisible();
      await expect(element(by.id('login-password-input'))).toBeVisible();
    });

    it('should show logout confirmation dialog', async () => {
      await navigateToTab('Profil');
      await tapButton('logout-button');

      // Check confirmation dialog
      await waitFor(element(by.text('Voulez-vous vraiment vous deconnecter ?')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.short);

      // Cancel logout
      await tapButtonByText('Annuler');

      // Should still be on profile screen
      await expect(element(by.text('Profil'))).toBeVisible();
    });

    it('should clear user data after logout', async () => {
      await logout();
      await login();

      // Navigate to profile and verify user data is fresh
      await navigateToTab('Profil');
      await expect(element(by.text(TEST_CONFIG.testUser.name))).toBeVisible();
    });

    it('should redirect to login when accessing protected screen after logout', async () => {
      await logout();

      // Try to navigate directly (app should show login)
      await expect(element(by.id('login-email-input'))).toBeVisible();
    });
  });

  // ==========================================================================
  // Forgot Password Tests
  // ==========================================================================

  describe('Forgot Password', () => {
    beforeEach(async () => {
      await tapButton('forgot-password-link');
      await waitFor(element(by.id('forgot-password-email-input')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.medium);
    });

    it('should display forgot password form', async () => {
      await expect(element(by.text('Mot de passe oublie'))).toBeVisible();
      await expect(element(by.id('forgot-password-email-input'))).toBeVisible();
      await expect(element(by.id('forgot-password-submit-button'))).toBeVisible();
    });

    it('should show error for empty email', async () => {
      await tapButton('forgot-password-submit-button');

      await waitFor(element(by.text('Veuillez entrer votre email')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.short);
    });

    it('should show error for invalid email format', async () => {
      await fillInput('forgot-password-email-input', 'invalid-email');
      await tapButton('forgot-password-submit-button');

      await waitFor(element(by.text('Format email invalide')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.short);
    });

    it('should send reset email successfully', async () => {
      await fillInput('forgot-password-email-input', TEST_CONFIG.testUser.email);
      await tapButton('forgot-password-submit-button');

      // Wait for success message
      await waitFor(element(by.text('Email envoye')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.medium);

      await expect(
        element(by.text('Consultez votre boite mail pour reinitialiser votre mot de passe'))
      ).toBeVisible();
    });

    it('should navigate back to login', async () => {
      await tapButton('back-to-login-button');

      await waitFor(element(by.id('login-email-input')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.medium);
    });
  });

  // ==========================================================================
  // Session Management Tests
  // ==========================================================================

  describe('Session Management', () => {
    it('should handle expired session gracefully', async () => {
      await login();

      // Simulate session expiration by clearing storage
      await device.launchApp({
        newInstance: true,
        delete: true,
      });

      // Should be redirected to login
      await waitFor(element(by.id('login-email-input')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.medium);
    });

    it('should maintain session across app backgrounding', async () => {
      await login();

      // Background the app
      await device.sendToHome();
      await sleep(2000);

      // Bring app back to foreground
      await device.launchApp({ newInstance: false });

      // Should still be logged in
      await waitFor(element(by.text('Accueil')))
        .toBeVisible()
        .withTimeout(TEST_CONFIG.timeouts.medium);
    });
  });
});
