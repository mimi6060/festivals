import { test as base, expect, Page } from '@playwright/test';

// Test ticket data matching the page
export const testTickets = {
  pass3j: {
    id: 'pass-3j',
    name: 'Pass 3 Jours',
    price: 18900,
    priceDisplay: '189,00 EUR',
  },
  passVip: {
    id: 'pass-vip',
    name: 'Pass VIP 3 Jours',
    price: 34900,
    priceDisplay: '349,00 EUR',
  },
  passVendredi: {
    id: 'pass-1j-ven',
    name: 'Pass Vendredi',
    price: 7500,
    priceDisplay: '75,00 EUR',
  },
  passSamedi: {
    id: 'pass-1j-sam',
    name: 'Pass Samedi',
    price: 7500,
    priceDisplay: '75,00 EUR',
    soldOut: true,
  },
  passDimanche: {
    id: 'pass-1j-dim',
    name: 'Pass Dimanche',
    price: 7500,
    priceDisplay: '75,00 EUR',
  },
};

// Demo stages
export const testStages = [
  { id: 'main', name: 'Main Stage' },
  { id: 'electro', name: 'Electro Arena' },
  { id: 'chill', name: 'Chill Garden' },
];

// Demo days
export const testDays = ['2026-07-15', '2026-07-16', '2026-07-17'];

// Cart helper class
export class CartHelper {
  constructor(private page: Page) {}

  async addToCart(ticketId: string, quantity: number = 1) {
    // Click add button for specific ticket
    const addButton = this.page.locator(`[data-ticket-id="${ticketId}"] button:has-text("Ajouter"), button:has-text("Ajouter"):near(:has-text("${ticketId}"))`);
    for (let i = 0; i < quantity; i++) {
      if (await addButton.isVisible().catch(() => false)) {
        await addButton.click();
        await this.page.waitForTimeout(200);
      }
    }
  }

  async getCartTotal(): Promise<string | null> {
    const totalElement = this.page.locator('[class*="total"], text=Total').first();
    if (await totalElement.isVisible().catch(() => false)) {
      return await totalElement.textContent();
    }
    return null;
  }

  async clearCart() {
    const clearButton = this.page.locator('button:has-text("Vider"), button:has-text("Clear")');
    if (await clearButton.isVisible().catch(() => false)) {
      await clearButton.click();
    }
  }

  async getCartItemCount(): Promise<number> {
    // Try to find cart badge or count
    const countBadge = this.page.locator('[class*="cart"] [class*="badge"], [class*="count"]');
    if (await countBadge.isVisible().catch(() => false)) {
      const text = await countBadge.textContent() || '0';
      return parseInt(text, 10) || 0;
    }
    return 0;
  }
}

// Auth helper class for public site
export class AuthHelper {
  constructor(private page: Page) {}

  async login(email: string = 'test@example.com', password: string = 'TestPass123!') {
    await this.page.goto('/compte');

    const emailInput = this.page.locator('input[type="email"], input[name="email"]');
    const passwordInput = this.page.locator('input[type="password"], input[name="password"]');

    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(email);
    }
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill(password);
    }

    const submitButton = this.page.locator('button[type="submit"], button:has-text("Se connecter")');
    if (await submitButton.isVisible().catch(() => false)) {
      await submitButton.click();
    }
  }

  async logout() {
    const logoutButton = this.page.locator('button:has-text("Déconnexion"), button:has-text("Logout")');
    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click();
    }
  }

  async isLoggedIn(): Promise<boolean> {
    // Check for logged-in indicators
    const accountLink = this.page.locator('a:has-text("Mon compte"), [class*="user"], [class*="avatar"]');
    return await accountLink.isVisible().catch(() => false);
  }
}

// Extended test fixture
type TestFixtures = {
  cartHelper: CartHelper;
  authHelper: AuthHelper;
};

export const test = base.extend<TestFixtures>({
  cartHelper: async ({ page }, use) => {
    const cartHelper = new CartHelper(page);
    await use(cartHelper);
  },

  authHelper: async ({ page }, use) => {
    const authHelper = new AuthHelper(page);
    await use(authHelper);
  },
});

export { expect };

// Helper functions
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

export async function scrollToElement(page: Page, selector: string) {
  const element = page.locator(selector);
  if (await element.isVisible().catch(() => false)) {
    await element.scrollIntoViewIfNeeded();
  }
}

export function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} EUR`;
}
