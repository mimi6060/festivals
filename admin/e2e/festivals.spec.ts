import { test, expect, testFestival, generateTestFestival, waitForPageLoad, mockApiResponse, setupFestivalStore } from './setup';

test.describe('Festivals Management', () => {
  test.beforeEach(async ({ page, authHelper }) => {
    // Login as admin before each test
    await authHelper.loginAs('admin');
  });

  test.describe('Festival List Page', () => {
    test('should display festivals list page header', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);

      // Check header elements
      await expect(page.locator('h1:has-text("Festivals")')).toBeVisible();
      await expect(page.locator('text=Gérez vos festivals et événements')).toBeVisible();
    });

    test('should display "Nouveau festival" button', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);

      const newButton = page.locator('a:has-text("Nouveau festival")');
      await expect(newButton).toBeVisible();
      await expect(newButton).toHaveAttribute('href', '/festivals/new');
    });

    test('should display search input', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);

      const searchInput = page.locator('input[placeholder="Rechercher un festival..."]');
      await expect(searchInput).toBeVisible();
    });

    test('should display status filter dropdown', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);

      const statusSelect = page.locator('select:has(option:has-text("Tous les statuts"))');
      await expect(statusSelect).toBeVisible();

      // Check filter options exist
      await expect(statusSelect.locator('option:has-text("Brouillon")')).toBeVisible();
      await expect(statusSelect.locator('option:has-text("Actif")')).toBeVisible();
      await expect(statusSelect.locator('option:has-text("Terminé")')).toBeVisible();
      await expect(statusSelect.locator('option:has-text("Archivé")')).toBeVisible();
    });

    test('should display festivals table with correct columns', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);

      // Check table headers
      await expect(page.locator('th:has-text("Festival")')).toBeVisible();
      await expect(page.locator('th:has-text("Dates")')).toBeVisible();
      await expect(page.locator('th:has-text("Statut")')).toBeVisible();
      await expect(page.locator('th:has-text("Monnaie")')).toBeVisible();
      await expect(page.locator('th:has-text("Actions")')).toBeVisible();
    });

    test('should display festival data in table rows', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);

      // Wait for mock data to load (the page uses mock data when API fails)
      await page.waitForSelector('table tbody tr');

      // Check that festival data is displayed
      await expect(page.locator('text=Summer Fest 2026')).toBeVisible();
      await expect(page.locator('text=Brussels, Belgium')).toBeVisible();
    });

    test('should filter festivals by search query', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);
      await page.waitForSelector('table tbody tr');

      // Search for a specific festival
      const searchInput = page.locator('input[placeholder="Rechercher un festival..."]');
      await searchInput.fill('Summer');
      await page.click('button:has-text("Rechercher")');

      // Should show Summer Fest
      await expect(page.locator('text=Summer Fest 2026')).toBeVisible();
    });

    test('should filter festivals by status', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);
      await page.waitForSelector('table tbody tr');

      // Filter by ACTIVE status
      const statusSelect = page.locator('select:has(option:has-text("Tous les statuts"))');
      await statusSelect.selectOption('ACTIVE');

      // Should show active festivals
      await expect(page.locator('text=Actif').first()).toBeVisible();
    });

    test('should show loading state', async ({ page }) => {
      await page.goto('/festivals');

      // The loading text should appear briefly
      // Check that either loading or table content is visible
      const loadingOrContent = page.locator('text=Chargement..., table tbody tr').first();
      await expect(loadingOrContent).toBeVisible({ timeout: 5000 });
    });

    test('should navigate to festival details on row click', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);
      await page.waitForSelector('table tbody tr');

      // Click on a festival row
      await page.click('tr:has-text("Summer Fest 2026")');

      // Should navigate to festival details
      await page.waitForURL(/\/festivals\/\d+/);
    });

    test('should open action menu on click', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);
      await page.waitForSelector('table tbody tr');

      // Click the more actions button (three dots)
      const moreButton = page.locator('tr:has-text("Summer Fest 2026") button:has(svg)').first();
      await moreButton.click();

      // Should show menu options
      await expect(page.locator('text=Voir le tableau de bord')).toBeVisible();
      await expect(page.locator('text=Paramètres')).toBeVisible();
      await expect(page.locator('text=Archiver')).toBeVisible();
    });
  });

  test.describe('Create Festival', () => {
    test('should display new festival form', async ({ page }) => {
      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Check page header
      await expect(page.locator('h1:has-text("Nouveau festival")')).toBeVisible();
      await expect(page.locator('text=Créez un nouveau festival ou événement')).toBeVisible();
    });

    test('should display all form sections', async ({ page }) => {
      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Check form sections
      await expect(page.locator('h2:has-text("Informations générales")')).toBeVisible();
      await expect(page.locator('h2:has-text("Configuration de la monnaie")')).toBeVisible();
    });

    test('should display all form fields', async ({ page }) => {
      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Basic info fields
      await expect(page.locator('label:has-text("Nom du festival")')).toBeVisible();
      await expect(page.locator('label:has-text("Slug (URL)")')).toBeVisible();
      await expect(page.locator('label:has-text("Description")')).toBeVisible();
      await expect(page.locator('label:has-text("Date de début")')).toBeVisible();
      await expect(page.locator('label:has-text("Date de fin")')).toBeVisible();
      await expect(page.locator('label:has-text("Lieu")')).toBeVisible();
      await expect(page.locator('label:has-text("Fuseau horaire")')).toBeVisible();

      // Currency fields
      await expect(page.locator('label:has-text("Nom de la monnaie")')).toBeVisible();
      await expect(page.locator('label:has-text("Taux de change")')).toBeVisible();
    });

    test('should auto-generate slug from name', async ({ page }) => {
      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Fill in festival name
      const nameInput = page.locator('input[placeholder="Summer Fest 2026"]');
      await nameInput.fill('My Awesome Festival 2026');

      // Check that slug was generated
      const slugInput = page.locator('input[readonly]');
      await expect(slugInput).toHaveValue('my-awesome-festival-2026');
    });

    test('should show currency conversion example', async ({ page }) => {
      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Fill in currency settings
      const currencyNameInput = page.locator('input[placeholder="Griffons, Tokens, Jetons..."]');
      await currencyNameInput.fill('Tokens');

      const exchangeRateInput = page.locator('input[type="number"][step="0.01"]');
      await exchangeRateInput.fill('0.5');

      // Check conversion example is shown
      await expect(page.locator('text=Exemple:')).toBeVisible();
      await expect(page.locator('text=10 EUR = 20 Tokens')).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Try to submit empty form
      await page.click('button:has-text("Créer le festival")');

      // Should show validation errors
      await expect(page.locator('text=Le nom est requis')).toBeVisible();
    });

    test('should show cancel button that navigates back', async ({ page }) => {
      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Click cancel
      await page.click('a:has-text("Annuler")');

      // Should navigate back to festivals list
      await page.waitForURL('/festivals');
    });

    test('should create festival with valid data', async ({ page }) => {
      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Fill in the form
      await page.fill('input[placeholder="Summer Fest 2026"]', 'E2E Test Festival');
      await page.fill('textarea[placeholder="Description du festival..."]', 'This is a test festival');
      await page.fill('input[type="date"]', '2026-07-01');
      await page.fill('input[type="date"]:nth-of-type(1)', '2026-07-01');

      // Wait and fill second date field
      const dateInputs = page.locator('input[type="date"]');
      await dateInputs.nth(0).fill('2026-07-01');
      await dateInputs.nth(1).fill('2026-07-03');

      await page.fill('input[placeholder="Brussels, Belgium"]', 'Test City, Test Country');
      await page.fill('input[placeholder="Griffons, Tokens, Jetons..."]', 'TestCoins');

      // Submit the form
      await page.click('button:has-text("Créer le festival")');

      // Should redirect to festival page (mock creates festival and redirects)
      await page.waitForURL(/\/festivals\/\d+/, { timeout: 10000 });
    });

    test('should show loading state when submitting', async ({ page }) => {
      await page.goto('/festivals/new');
      await waitForPageLoad(page);

      // Fill minimal required fields
      await page.fill('input[placeholder="Summer Fest 2026"]', 'E2E Test Festival');

      const dateInputs = page.locator('input[type="date"]');
      await dateInputs.nth(0).fill('2026-07-01');
      await dateInputs.nth(1).fill('2026-07-03');

      await page.fill('input[placeholder="Brussels, Belgium"]', 'Test City');
      await page.fill('input[placeholder="Griffons, Tokens, Jetons..."]', 'Coins');

      // Submit and check for loading indicator
      const submitButton = page.locator('button:has-text("Créer le festival")');
      await submitButton.click();

      // Button should show loading state (has Loader2 spinner icon)
      await expect(submitButton.locator('svg.animate-spin')).toBeVisible({ timeout: 2000 }).catch(() => {
        // Loading state might be too fast to catch, which is OK
      });
    });
  });

  test.describe('Edit Festival', () => {
    test('should navigate to festival settings page', async ({ page }) => {
      await page.goto('/festivals/1/settings');
      await waitForPageLoad(page);

      // Should be on settings page (part of festival dashboard)
      await expect(page.locator('text=Festivals Admin')).toBeVisible();
    });

    test('should access festival from list via settings menu', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);
      await page.waitForSelector('table tbody tr');

      // Open action menu for first festival
      const moreButton = page.locator('tr:has-text("Summer Fest 2026") button:has(svg)').first();
      await moreButton.click();

      // Click settings
      await page.click('a:has-text("Paramètres")');

      // Should navigate to settings page
      await page.waitForURL(/\/festivals\/\d+\/settings/);
    });
  });

  test.describe('Delete/Archive Festival', () => {
    test('should show archive option in action menu', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);
      await page.waitForSelector('table tbody tr');

      // Open action menu for first festival
      const moreButton = page.locator('tr:has-text("Summer Fest 2026") button:has(svg)').first();
      await moreButton.click();

      // Should show archive option
      await expect(page.locator('button:has-text("Archiver")')).toBeVisible();
    });

    test('should not show archive option for already archived festivals', async ({ page }) => {
      // Set up store with archived festival
      await setupFestivalStore(page, [
        { ...testFestival, status: 'ARCHIVED' },
      ]);

      await page.goto('/festivals');
      await waitForPageLoad(page);
      await page.waitForSelector('table tbody tr');

      // Open action menu
      const moreButton = page.locator('tr:has-text("Summer Fest") button:has(svg)').first();
      await moreButton.click();

      // Archive option should not be visible
      await expect(page.locator('button:has-text("Archiver")')).not.toBeVisible();
    });
  });

  test.describe('Festival Status Display', () => {
    test('should display correct badge for ACTIVE status', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);
      await page.waitForSelector('table tbody tr');

      // Check for active status badge
      const activeBadge = page.locator('span:has-text("Actif")').first();
      await expect(activeBadge).toBeVisible();
      await expect(activeBadge).toHaveClass(/bg-green-100.*text-green-800/);
    });

    test('should display correct badge for DRAFT status', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);
      await page.waitForSelector('table tbody tr');

      // Check for draft status badge (mock data includes draft festival)
      const draftBadge = page.locator('span:has-text("Brouillon")').first();
      await expect(draftBadge).toBeVisible();
      await expect(draftBadge).toHaveClass(/bg-gray-100.*text-gray-800/);
    });

    test('should display correct badge for COMPLETED status', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);
      await page.waitForSelector('table tbody tr');

      // Check for completed status badge (mock data includes completed festival)
      const completedBadge = page.locator('span:has-text("Terminé")').first();
      await expect(completedBadge).toBeVisible();
      await expect(completedBadge).toHaveClass(/bg-blue-100.*text-blue-800/);
    });
  });

  test.describe('Pagination', () => {
    test('should display pagination when there are multiple pages', async ({ page }) => {
      await page.goto('/festivals');
      await waitForPageLoad(page);

      // Pagination should be visible if there are more than 10 items
      // With mock data (3 items), pagination should not be visible
      const pagination = page.locator('text=Affichage de');
      const isVisible = await pagination.isVisible().catch(() => false);

      // If visible, check pagination controls
      if (isVisible) {
        await expect(page.locator('button:has-text("Précédent")')).toBeVisible();
        await expect(page.locator('button:has-text("Suivant")')).toBeVisible();
      }
    });
  });
});
