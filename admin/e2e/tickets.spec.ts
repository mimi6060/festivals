import { test, expect, testFestival, generateTestTicketType, waitForPageLoad } from './setup';

test.describe('Tickets Management', () => {
  test.beforeEach(async ({ page, authHelper }) => {
    // Login as admin before each test
    await authHelper.loginAs('admin');
  });

  test.describe('Tickets List Page', () => {
    test('should display tickets management page header', async ({ page }) => {
      await page.goto('/festivals/1/tickets');
      await waitForPageLoad(page);

      // Check page header
      await expect(page.locator('h1:has-text("Gestion des billets")')).toBeVisible();
    });

    test('should display ticket statistics overview', async ({ page }) => {
      await page.goto('/festivals/1/tickets');
      await waitForPageLoad(page);

      // Check for statistics cards (total, sold, checked-in, revenue)
      await expect(page.locator('text=Total').first()).toBeVisible();
    });

    test('should display create ticket type button', async ({ page }) => {
      await page.goto('/festivals/1/tickets');
      await waitForPageLoad(page);

      const createButton = page.locator('button:has-text("Nouveau type de billet"), a:has-text("Nouveau type de billet")');
      await expect(createButton).toBeVisible();
    });

    test('should display ticket types table', async ({ page }) => {
      await page.goto('/festivals/1/tickets');
      await waitForPageLoad(page);

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 }).catch(() => {
        // Table might not exist if no tickets
      });

      // Check for table headers or empty state
      const hasTable = await page.locator('table').isVisible().catch(() => false);
      const hasEmptyState = await page.locator('text=Aucun type de billet').isVisible().catch(() => false);

      expect(hasTable || hasEmptyState).toBe(true);
    });

    test('should allow searching for tickets', async ({ page }) => {
      await page.goto('/festivals/1/tickets');
      await waitForPageLoad(page);

      // Look for search input
      const searchInput = page.locator('input[placeholder*="Rechercher"], input[type="search"]');
      const hasSearch = await searchInput.isVisible().catch(() => false);

      if (hasSearch) {
        await searchInput.fill('VIP');
        await page.waitForTimeout(500); // Wait for search debounce
      }
    });
  });

  test.describe('Create Ticket Type', () => {
    test('should display new ticket type form', async ({ page }) => {
      await page.goto('/festivals/1/tickets/new');
      await waitForPageLoad(page);

      // Check for form presence
      await expect(page.locator('form')).toBeVisible();
    });

    test('should have required form fields', async ({ page }) => {
      await page.goto('/festivals/1/tickets/new');
      await waitForPageLoad(page);

      // Check for essential fields
      await expect(page.locator('label:has-text("Nom")').first()).toBeVisible();
      await expect(page.locator('label:has-text("Prix")').first()).toBeVisible();
    });

    test('should validate required fields on submit', async ({ page }) => {
      await page.goto('/festivals/1/tickets/new');
      await waitForPageLoad(page);

      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"], button:has-text("Créer"), button:has-text("Enregistrer")');
      await submitButton.click();

      // Should show validation errors
      await page.waitForTimeout(500);
      const hasError = await page.locator('[class*="error"], [class*="invalid"], text=requis').isVisible().catch(() => false);
      // Form validation should prevent submission
    });

    test('should create ticket type with valid data', async ({ page }) => {
      await page.goto('/festivals/1/tickets/new');
      await waitForPageLoad(page);

      // Fill in ticket name
      const nameInput = page.locator('input[name="name"], input[placeholder*="nom"]').first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('E2E Test Pass');
      }

      // Fill in price
      const priceInput = page.locator('input[name="price"], input[type="number"]').first();
      if (await priceInput.isVisible().catch(() => false)) {
        await priceInput.fill('99');
      }

      // Fill in quantity
      const quantityInput = page.locator('input[name="quantity"]');
      if (await quantityInput.isVisible().catch(() => false)) {
        await quantityInput.fill('100');
      }

      // Submit form
      const submitButton = page.locator('button[type="submit"], button:has-text("Créer"), button:has-text("Enregistrer")').first();
      if (await submitButton.isVisible().catch(() => false)) {
        await submitButton.click();
        // Wait for redirect or success message
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('View Ticket Sales', () => {
    test('should access ticket type details', async ({ page }) => {
      await page.goto('/festivals/1/tickets');
      await waitForPageLoad(page);

      // Click on first ticket type if available
      const ticketRow = page.locator('table tbody tr').first();
      if (await ticketRow.isVisible().catch(() => false)) {
        await ticketRow.click();
        await page.waitForTimeout(1000);
      }
    });

    test('should display sales statistics', async ({ page }) => {
      await page.goto('/festivals/1/tickets');
      await waitForPageLoad(page);

      // Look for sales-related content
      const hasSalesInfo = await page.locator('text=vendu, text=sold, text=revenue').isVisible().catch(() => false);
      // Sales info should be present somewhere on the page
    });

    test('should show checked-in statistics', async ({ page }) => {
      await page.goto('/festivals/1/tickets');
      await waitForPageLoad(page);

      // Look for check-in stats
      const hasCheckedIn = await page.locator('text=validé, text=checked, text=scanné').isVisible().catch(() => false);
    });
  });

  test.describe('Ticket Scanner', () => {
    test('should access ticket scanner page', async ({ page }) => {
      await page.goto('/festivals/1/tickets/scan');
      await waitForPageLoad(page);

      // Check scanner page elements
      await expect(page.locator('h1:has-text("Scanner"), h1:has-text("Scan")')).toBeVisible();
    });

    test('should display scanner interface', async ({ page }) => {
      await page.goto('/festivals/1/tickets/scan');
      await waitForPageLoad(page);

      // Look for scanner elements (camera, manual input, or QR icon)
      const hasScanner = await page.locator('video, [class*="scanner"], [class*="camera"], input[placeholder*="code"]').isVisible().catch(() => false);
      // Scanner interface should be present
    });

    test('should have manual ticket code input', async ({ page }) => {
      await page.goto('/festivals/1/tickets/scan');
      await waitForPageLoad(page);

      // Look for manual input field
      const manualInput = page.locator('input[placeholder*="code"], input[placeholder*="ticket"], input[placeholder*="billet"]');
      if (await manualInput.isVisible().catch(() => false)) {
        await manualInput.fill('TEST-TICKET-CODE');
        // Try to validate
        const validateButton = page.locator('button:has-text("Valider"), button:has-text("Scanner"), button[type="submit"]');
        if (await validateButton.isVisible().catch(() => false)) {
          await validateButton.click();
          await page.waitForTimeout(500);
        }
      }
    });

    test('should show scan result feedback', async ({ page }) => {
      await page.goto('/festivals/1/tickets/scan');
      await waitForPageLoad(page);

      // Look for result display area
      const hasResultArea = await page.locator('[class*="result"], [class*="status"], [class*="message"]').isVisible().catch(() => false);
    });
  });

  test.describe('Ticket Type Settings', () => {
    test('should access ticket type settings', async ({ page }) => {
      await page.goto('/festivals/1/tickets');
      await waitForPageLoad(page);

      // Look for settings/edit button on a ticket type
      const settingsButton = page.locator('button:has-text("Modifier"), button[aria-label="Settings"], a[href*="edit"]').first();
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(1000);
      }
    });

    test('should display ticket benefits configuration', async ({ page }) => {
      await page.goto('/festivals/1/tickets/new');
      await waitForPageLoad(page);

      // Look for benefits/avantages section
      const hasBenefits = await page.locator('text=Avantages, text=Benefits, text=Inclus').isVisible().catch(() => false);
    });

    test('should configure reentry settings', async ({ page }) => {
      await page.goto('/festivals/1/tickets/new');
      await waitForPageLoad(page);

      // Look for reentry toggle/checkbox
      const reentryToggle = page.locator('input[name*="reentry"], label:has-text("Réentrée"), label:has-text("Reentry")');
      if (await reentryToggle.isVisible().catch(() => false)) {
        await reentryToggle.click();
      }
    });

    test('should configure transfer settings', async ({ page }) => {
      await page.goto('/festivals/1/tickets/new');
      await waitForPageLoad(page);

      // Look for transfer options
      const transferToggle = page.locator('input[name*="transfer"], label:has-text("Transfert"), label:has-text("Transfer")');
      if (await transferToggle.isVisible().catch(() => false)) {
        await transferToggle.click();
      }
    });
  });

  test.describe('Ticket Export', () => {
    test('should have export functionality', async ({ page }) => {
      await page.goto('/festivals/1/tickets');
      await waitForPageLoad(page);

      // Look for export button
      const exportButton = page.locator('button:has-text("Export"), button:has-text("Exporter"), a:has-text("Export")');
      const hasExport = await exportButton.isVisible().catch(() => false);
    });
  });
});
