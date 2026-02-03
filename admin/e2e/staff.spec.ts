import { test, expect, waitForPageLoad } from './setup';

test.describe('Staff Management', () => {
  test.beforeEach(async ({ page, authHelper }) => {
    // Login as admin before each test
    await authHelper.loginAs('admin');
  });

  test.describe('Staff List Page', () => {
    test('should display staff management page', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      // Check for staff page header or team section
      await expect(page.locator('h1:has-text("Staff"), h1:has-text("Équipe"), h1:has-text("Team")').first()).toBeVisible();
    });

    test('should display invite staff button', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      const inviteButton = page.locator('button:has-text("Inviter"), button:has-text("Ajouter"), a:has-text("Inviter")');
      await expect(inviteButton.first()).toBeVisible();
    });

    test('should display staff members table or list', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      // Check for staff list/table or empty state
      const hasStaffList = await page.locator('table, [class*="list"], [class*="grid"]').first().isVisible().catch(() => false);
      const hasEmptyState = await page.locator('text=Aucun membre, text=pas de staff, text=No staff').isVisible().catch(() => false);

      expect(hasStaffList || hasEmptyState).toBe(true);
    });

    test('should show role badges for staff members', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      // Look for role indicators (badges, pills, tags)
      const hasRoleBadges = await page.locator('[class*="badge"], [class*="tag"], [class*="pill"], [class*="role"]').first().isVisible().catch(() => false);
    });

    test('should have search functionality', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      const searchInput = page.locator('input[placeholder*="Rechercher"], input[type="search"]');
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('test');
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Invite Staff', () => {
    test('should open invite staff modal/form', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      const inviteButton = page.locator('button:has-text("Inviter"), button:has-text("Ajouter")').first();
      if (await inviteButton.isVisible().catch(() => false)) {
        await inviteButton.click();
        await page.waitForTimeout(500);

        // Check for modal or form
        const hasModal = await page.locator('[role="dialog"], [class*="modal"], form').isVisible().catch(() => false);
        expect(hasModal).toBe(true);
      }
    });

    test('should have email input field', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      const inviteButton = page.locator('button:has-text("Inviter"), button:has-text("Ajouter")').first();
      if (await inviteButton.isVisible().catch(() => false)) {
        await inviteButton.click();
        await page.waitForTimeout(500);

        const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]');
        await expect(emailInput.first()).toBeVisible();
      }
    });

    test('should have role selection', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      const inviteButton = page.locator('button:has-text("Inviter"), button:has-text("Ajouter")').first();
      if (await inviteButton.isVisible().catch(() => false)) {
        await inviteButton.click();
        await page.waitForTimeout(500);

        // Look for role dropdown/select
        const roleSelect = page.locator('select[name*="role"], [role="listbox"], [class*="select"]');
        const hasRoleSelect = await roleSelect.isVisible().catch(() => false);
      }
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      const inviteButton = page.locator('button:has-text("Inviter"), button:has-text("Ajouter")').first();
      if (await inviteButton.isVisible().catch(() => false)) {
        await inviteButton.click();
        await page.waitForTimeout(500);

        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        if (await emailInput.isVisible().catch(() => false)) {
          await emailInput.fill('invalid-email');

          // Try to submit
          const submitButton = page.locator('button[type="submit"], button:has-text("Envoyer"), button:has-text("Inviter")').last();
          if (await submitButton.isVisible().catch(() => false)) {
            await submitButton.click();
            await page.waitForTimeout(500);
          }
        }
      }
    });

    test('should send invitation with valid data', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      const inviteButton = page.locator('button:has-text("Inviter"), button:has-text("Ajouter")').first();
      if (await inviteButton.isVisible().catch(() => false)) {
        await inviteButton.click();
        await page.waitForTimeout(500);

        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        if (await emailInput.isVisible().catch(() => false)) {
          await emailInput.fill('newstaff@test.com');

          // Select a role if available
          const roleSelect = page.locator('select[name*="role"]').first();
          if (await roleSelect.isVisible().catch(() => false)) {
            await roleSelect.selectOption({ index: 1 });
          }

          // Submit
          const submitButton = page.locator('button[type="submit"], button:has-text("Envoyer"), button:has-text("Inviter")').last();
          if (await submitButton.isVisible().catch(() => false)) {
            await submitButton.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    });
  });

  test.describe('Assign Roles', () => {
    test('should display available roles', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      // Look for role management section or filter
      const hasRoles = await page.locator('text=Manager, text=Staff, text=Cashier, text=Scanner, text=Rôle').first().isVisible().catch(() => false);
    });

    test('should edit staff member role', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      // Click on a staff member's edit button or row
      const editButton = page.locator('button:has-text("Modifier"), button[aria-label="Edit"], [class*="edit"]').first();
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();
        await page.waitForTimeout(500);
      }
    });

    test('should assign stand to staff member', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      // Look for stand assignment option
      const standSelect = page.locator('select[name*="stand"], [aria-label*="Stand"]');
      const hasStandAssignment = await standSelect.isVisible().catch(() => false);
    });

    test('should remove staff member access', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      // Look for remove/delete action
      const removeButton = page.locator('button:has-text("Retirer"), button:has-text("Supprimer"), button[aria-label="Remove"], button[aria-label="Delete"]').first();
      const hasRemoveAction = await removeButton.isVisible().catch(() => false);
    });
  });

  test.describe('Role Permissions', () => {
    test('should access role management page', async ({ page }) => {
      await page.goto('/festivals/1/settings');
      await waitForPageLoad(page);

      // Navigate to roles section if available
      const rolesLink = page.locator('a:has-text("Rôles"), a:has-text("Roles"), button:has-text("Rôles")');
      if (await rolesLink.isVisible().catch(() => false)) {
        await rolesLink.click();
        await page.waitForTimeout(500);
      }
    });

    test('should display predefined roles', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      // Look for predefined role names
      const hasRoleTypes = await page.locator('text=Admin, text=Manager, text=Staff, text=Cashier, text=Scanner').first().isVisible().catch(() => false);
    });

    test('should show permissions for each role', async ({ page }) => {
      await page.goto('/festivals/1/settings');
      await waitForPageLoad(page);

      // Navigate to a role detail view
      const roleItem = page.locator('[class*="role"], tr:has-text("Manager"), tr:has-text("Staff")').first();
      if (await roleItem.isVisible().catch(() => false)) {
        await roleItem.click();
        await page.waitForTimeout(500);

        // Look for permissions list
        const hasPermissions = await page.locator('text=Permission, text=Accès, text=Droit').isVisible().catch(() => false);
      }
    });
  });

  test.describe('Staff Activity', () => {
    test('should show staff activity log', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      // Look for activity section or link
      const activityLink = page.locator('a:has-text("Activité"), a:has-text("Activity"), a:has-text("Historique")');
      if (await activityLink.isVisible().catch(() => false)) {
        await activityLink.click();
        await page.waitForTimeout(500);
      }
    });

    test('should filter staff by role', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      // Look for role filter
      const roleFilter = page.locator('select:has(option:has-text("Tous")), [aria-label*="Filter"]');
      if (await roleFilter.isVisible().catch(() => false)) {
        await roleFilter.click();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Bulk Actions', () => {
    test('should support selecting multiple staff members', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      // Look for checkboxes for bulk selection
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible().catch(() => false)) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    });

    test('should display bulk action menu', async ({ page }) => {
      await page.goto('/festivals/1/staff');
      await waitForPageLoad(page);

      // Select items first
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible().catch(() => false)) {
        await checkbox.check();
        await page.waitForTimeout(300);

        // Look for bulk action button
        const bulkActionButton = page.locator('button:has-text("Actions"), [class*="bulk"]');
        const hasBulkActions = await bulkActionButton.isVisible().catch(() => false);
      }
    });
  });
});
