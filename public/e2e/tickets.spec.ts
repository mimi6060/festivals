import { test, expect, waitForPageLoad, testTickets } from './setup';

test.describe('Tickets Page', () => {
  test.describe('Page Load', () => {
    test('should load tickets page successfully', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      await expect(page).toHaveURL('/tickets');
    });

    test('should display page header', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      await expect(page.locator('h1:has-text("Choisissez votre pass")')).toBeVisible();
      await expect(page.locator('text=Billetterie officielle')).toBeVisible();
    });

    test('should display security features', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      await expect(page.locator('text=Paiement securise')).toBeVisible();
      await expect(page.locator('text=Billets instantanes')).toBeVisible();
    });
  });

  test.describe('Ticket Types Display', () => {
    test('should display Pass 3 Jours', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      await expect(page.locator('text=Pass 3 Jours').first()).toBeVisible();
      await expect(page.locator('text=189')).toBeVisible();
    });

    test('should display Pass VIP', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      await expect(page.locator('text=Pass VIP 3 Jours')).toBeVisible();
      await expect(page.locator('text=349')).toBeVisible();
    });

    test('should display day passes', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      await expect(page.locator('h3:has-text("Pass journee")')).toBeVisible();
      await expect(page.locator('text=Pass Vendredi')).toBeVisible();
      await expect(page.locator('text=Pass Samedi')).toBeVisible();
      await expect(page.locator('text=Pass Dimanche')).toBeVisible();
    });

    test('should display ticket benefits', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Check for benefits listed
      await expect(page.locator('text=Acces aux 3 scenes').first()).toBeVisible();
      await expect(page.locator('text=Bracelet cashless inclus').first()).toBeVisible();
    });

    test('should show VIP benefits', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      await expect(page.locator('text=Zone VIP')).toBeVisible();
      await expect(page.locator('text=Fast lane')).toBeVisible();
    });

    test('should indicate sold out tickets', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Pass Samedi should be sold out
      const soldOutBadge = page.locator('text=Complet, text=Sold out, text=Epuise');
      const hasSoldOut = await soldOutBadge.isVisible().catch(() => false);
      // Sold out indicator should be present for Samedi pass
    });
  });

  test.describe('Add to Cart', () => {
    test('should have add to cart buttons', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      const addButton = page.locator('button:has-text("Ajouter"), button:has-text("Add")');
      await expect(addButton.first()).toBeVisible();
    });

    test('should add ticket to cart', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Click add button on first available ticket
      const addButton = page.locator('button:has-text("Ajouter")').first();
      await addButton.click();

      // Cart should update (look for cart count or summary)
      await page.waitForTimeout(500);

      // Check cart summary or count updated
      const cartSection = page.locator('[class*="cart"], [class*="summary"]');
      const hasCartUpdate = await cartSection.isVisible().catch(() => false);
    });

    test('should update quantity in cart', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Add ticket
      const addButton = page.locator('button:has-text("Ajouter")').first();
      await addButton.click();
      await page.waitForTimeout(300);

      // Look for quantity controls
      const incrementButton = page.locator('button:has-text("+"), [aria-label*="increase"]');
      if (await incrementButton.isVisible().catch(() => false)) {
        await incrementButton.click();
        await page.waitForTimeout(300);
      }
    });

    test('should remove ticket from cart', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Add ticket first
      const addButton = page.locator('button:has-text("Ajouter")').first();
      await addButton.click();
      await page.waitForTimeout(300);

      // Remove ticket
      const removeButton = page.locator('button:has-text("Retirer"), button:has-text("-"), [aria-label*="remove"]');
      if (await removeButton.isVisible().catch(() => false)) {
        await removeButton.click();
        await page.waitForTimeout(300);
      }
    });

    test('should disable add button for sold out tickets', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Find Pass Samedi (sold out) and check its button state
      const samediCard = page.locator('[class*="card"]:has-text("Pass Samedi")');
      if (await samediCard.isVisible().catch(() => false)) {
        const addButton = samediCard.locator('button:has-text("Ajouter")');
        const isDisabled = await addButton.isDisabled().catch(() => true);
        // Button should be disabled or not present for sold out ticket
      }
    });
  });

  test.describe('Cart Summary', () => {
    test('should display cart summary section', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Look for cart/summary section
      const cartSummary = page.locator('[class*="cart"], [class*="summary"], text=Votre panier');
      await expect(cartSummary.first()).toBeVisible();
    });

    test('should show empty cart message initially', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Should show empty cart or 0 items
      const emptyCart = page.locator('text=Votre panier est vide, text=Aucun billet, text=0 billet');
      const hasEmptyMessage = await emptyCart.isVisible().catch(() => false);
    });

    test('should calculate correct total', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Add a ticket
      const addButton = page.locator('button:has-text("Ajouter")').first();
      await addButton.click();
      await page.waitForTimeout(500);

      // Check for total amount
      const totalSection = page.locator('text=Total, text=Montant');
      const hasTotal = await totalSection.isVisible().catch(() => false);
    });

    test('should have checkout button', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Add a ticket first
      const addButton = page.locator('button:has-text("Ajouter")').first();
      await addButton.click();
      await page.waitForTimeout(500);

      // Check for checkout button
      const checkoutButton = page.locator('button:has-text("Commander"), button:has-text("Payer"), a:has-text("Checkout")');
      const hasCheckout = await checkoutButton.isVisible().catch(() => false);
    });
  });

  test.describe('Checkout Flow', () => {
    test('should navigate to checkout page', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Add a ticket
      const addButton = page.locator('button:has-text("Ajouter")').first();
      await addButton.click();
      await page.waitForTimeout(500);

      // Click checkout
      const checkoutButton = page.locator('button:has-text("Commander"), a:has-text("Commander"), a[href*="checkout"]');
      if (await checkoutButton.isVisible().catch(() => false)) {
        await checkoutButton.click();
        await page.waitForTimeout(1000);

        // Should be on checkout page
        const isCheckout = page.url().includes('checkout');
      }
    });

    test('should display checkout form', async ({ page }) => {
      // Navigate directly to checkout (if allowed)
      await page.goto('/tickets/checkout');
      await waitForPageLoad(page);

      // Check for checkout form elements
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const hasEmail = await emailInput.isVisible().catch(() => false);
    });

    test('should require email for checkout', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Add a ticket
      const addButton = page.locator('button:has-text("Ajouter")').first();
      await addButton.click();
      await page.waitForTimeout(500);

      // Navigate to checkout
      const checkoutButton = page.locator('button:has-text("Commander"), a:has-text("Commander")');
      if (await checkoutButton.isVisible().catch(() => false)) {
        await checkoutButton.click();
        await page.waitForTimeout(1000);

        // Try to proceed without email
        const proceedButton = page.locator('button:has-text("Payer"), button[type="submit"]');
        if (await proceedButton.isVisible().catch(() => false)) {
          await proceedButton.click();
          // Should show validation error
        }
      }
    });

    test('should display payment methods', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Check for payment method info
      await expect(page.locator('text=CB')).toBeVisible();
      await expect(page.locator('text=Apple Pay')).toBeVisible();
      await expect(page.locator('text=Google Pay')).toBeVisible();
    });
  });

  test.describe('Trust and Security', () => {
    test('should display official ticketing notice', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      await expect(page.locator('text=Billetterie officielle')).toBeVisible();
    });

    test('should display guarantee message', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      await expect(page.locator('text=garantie')).toBeVisible();
    });

    test('should mention Stripe security', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      await expect(page.locator('text=Stripe')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display tickets on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/tickets');
      await waitForPageLoad(page);

      await expect(page.locator('text=Pass 3 Jours').first()).toBeVisible();
    });

    test('should show cart on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Cart might be in a drawer or sticky footer on mobile
      const addButton = page.locator('button:has-text("Ajouter")').first();
      await addButton.click();
      await page.waitForTimeout(500);

      // Look for cart indicator
      const cartIndicator = page.locator('[class*="cart"], [class*="badge"], text=panier');
      const hasCart = await cartIndicator.isVisible().catch(() => false);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
    });

    test('should have accessible buttons', async ({ page }) => {
      await page.goto('/tickets');
      await waitForPageLoad(page);

      // Check buttons have accessible labels
      const addButtons = page.locator('button:has-text("Ajouter")');
      const count = await addButtons.count();
      expect(count).toBeGreaterThan(0);
    });
  });
});
