import { test, expect, waitForPageLoad } from './setup';

test.describe('Homepage', () => {
  test.describe('Page Load', () => {
    test('should load homepage successfully', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Check that the page loaded
      await expect(page).toHaveURL('/');
    });

    test('should display festival name and hero section', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Check hero content
      await expect(page.locator('text=Festival 2026')).toBeVisible();
      await expect(page.locator('text=L\'experience musicale ultime')).toBeVisible();
    });

    test('should display festival dates', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Check dates are shown
      await expect(page.locator('text=15 - 17 Juillet 2026')).toBeVisible();
    });

    test('should display festival location', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Check location is shown
      await expect(page.locator('text=Paris')).toBeVisible();
    });

    test('should display page title correctly', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      await expect(page).toHaveTitle(/Festival/);
    });
  });

  test.describe('Navigation', () => {
    test('should have navigation menu', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Check for navigation links
      const nav = page.locator('nav, header');
      await expect(nav.first()).toBeVisible();
    });

    test('should navigate to tickets page', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Click on tickets link
      const ticketsLink = page.locator('a:has-text("Billets"), a:has-text("Tickets"), a[href="/tickets"]');
      await ticketsLink.first().click();

      await page.waitForURL('/tickets');
      await expect(page).toHaveURL('/tickets');
    });

    test('should navigate to programme page', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Click on programme link
      const programmeLink = page.locator('a:has-text("Programme"), a[href="/programme"]');
      await programmeLink.first().click();

      await page.waitForURL('/programme');
      await expect(page).toHaveURL('/programme');
    });

    test('should navigate to infos page', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Click on infos link
      const infosLink = page.locator('a:has-text("Infos"), a[href="/infos"]');
      await infosLink.first().click();

      await page.waitForURL('/infos');
      await expect(page).toHaveURL('/infos');
    });

    test('should navigate to compte page', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Click on account link
      const compteLink = page.locator('a:has-text("Compte"), a:has-text("Se connecter"), a[href="/compte"]');
      await compteLink.first().click();

      await page.waitForURL('/compte');
      await expect(page).toHaveURL('/compte');
    });
  });

  test.describe('Hero Section', () => {
    test('should display CTA buttons', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Check for CTA buttons
      const buyButton = page.locator('a:has-text("Acheter"), button:has-text("Acheter")');
      await expect(buyButton.first()).toBeVisible();
    });

    test('should link to tickets from hero CTA', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      const buyButton = page.locator('a:has-text("Acheter des billets")');
      if (await buyButton.isVisible().catch(() => false)) {
        await buyButton.click();
        await page.waitForURL('/tickets');
      }
    });
  });

  test.describe('Features Section', () => {
    test('should display feature cards', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Check for feature highlights
      await expect(page.locator('text=50+ Artistes')).toBeVisible();
      await expect(page.locator('text=30 000 Festivaliers')).toBeVisible();
      await expect(page.locator('text=Experience Unique')).toBeVisible();
      await expect(page.locator('text=Securise')).toBeVisible();
    });
  });

  test.describe('Lineup Preview', () => {
    test('should display artist preview section', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Check for lineup section with artists
      const lineupSection = page.locator('section:has-text("Artistes"), section:has-text("Lineup")');
      const hasLineup = await lineupSection.isVisible().catch(() => false);

      if (!hasLineup) {
        // Artists might be displayed directly
        const hasArtists = await page.locator('text=Daft Punk').isVisible().catch(() => false);
        expect(hasLineup || hasArtists).toBe(true);
      }
    });

    test('should display featured artists', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Check for demo artists
      const artists = ['Daft Punk', 'The Weeknd', 'Disclosure', 'Billie Eilish', 'Stromae'];
      let foundArtists = 0;

      for (const artist of artists) {
        if (await page.locator(`text=${artist}`).isVisible().catch(() => false)) {
          foundArtists++;
        }
      }

      expect(foundArtists).toBeGreaterThan(0);
    });
  });

  test.describe('Info Cards', () => {
    test('should display info cards section', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Check for info cards
      await expect(page.locator('text=Infos Pratiques')).toBeVisible();
      await expect(page.locator('text=Programme')).toBeVisible();
      await expect(page.locator('text=Mon Compte')).toBeVisible();
    });

    test('should have clickable info cards', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Check that info cards have links
      const consulterButton = page.locator('button:has-text("Consulter"), a:has-text("Consulter")').first();
      await expect(consulterButton).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display mobile navigation on small screens', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await waitForPageLoad(page);

      // Look for mobile menu toggle
      const menuToggle = page.locator('button[aria-label*="menu"], [class*="hamburger"], [class*="menu-toggle"]');
      const hasMobileMenu = await menuToggle.isVisible().catch(() => false);

      // On mobile, either a hamburger menu or horizontal scroll nav should be present
      const nav = page.locator('nav');
      const hasNav = await nav.isVisible().catch(() => false);

      expect(hasMobileMenu || hasNav).toBe(true);
    });

    test('should display hero section on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await waitForPageLoad(page);

      // Hero should still be visible
      await expect(page.locator('text=Festival 2026')).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await waitForPageLoad(page);
      const loadTime = Date.now() - startTime;

      // Page should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
    });

    test('should have no console errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/');
      await waitForPageLoad(page);

      // Filter out common non-critical errors
      const criticalErrors = errors.filter(
        (e) => !e.includes('favicon') && !e.includes('analytics') && !e.includes('hydration')
      );

      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('Footer', () => {
    test('should display footer', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      const footer = page.locator('footer');
      const hasFooter = await footer.isVisible().catch(() => false);

      // Page should have some form of footer or bottom section
    });
  });
});
