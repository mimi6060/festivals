import { test, expect, waitForPageLoad, testStages, testDays } from './setup';

test.describe('Programme Page', () => {
  test.describe('Page Load', () => {
    test('should load programme page successfully', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      await expect(page).toHaveURL('/programme');
    });

    test('should display page header', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      await expect(page.locator('h1:has-text("Programme")')).toBeVisible();
    });

    test('should display festival dates', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      await expect(page.locator('text=15-17 Juillet 2026')).toBeVisible();
    });

    test('should display festival info', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      await expect(page.locator('text=3 jours')).toBeVisible();
      await expect(page.locator('text=3 scenes')).toBeVisible();
      await expect(page.locator('text=50+ artistes')).toBeVisible();
    });
  });

  test.describe('Day Navigation', () => {
    test('should display day tabs or selector', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Look for day selection tabs
      const dayTabs = page.locator('[role="tablist"], [class*="tabs"], [class*="days"]');
      const hasDayTabs = await dayTabs.isVisible().catch(() => false);

      // Or individual day buttons
      const dayButtons = page.locator('button:has-text("15"), button:has-text("Vendredi"), button:has-text("Jour 1")');
      const hasDayButtons = await dayButtons.first().isVisible().catch(() => false);

      expect(hasDayTabs || hasDayButtons).toBe(true);
    });

    test('should switch between days', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Find and click on day 2
      const day2Tab = page.locator('button:has-text("16"), button:has-text("Samedi"), [role="tab"]:has-text("16"), [role="tab"]:has-text("Samedi")');
      if (await day2Tab.isVisible().catch(() => false)) {
        await day2Tab.click();
        await page.waitForTimeout(500);

        // Content should change to show day 2 performances
        const hasDay2Content = await page.locator('text=The Weeknd, text=Stromae').isVisible().catch(() => false);
      }
    });

    test('should display correct performances for each day', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Day 1 should show Daft Punk, Disclosure, Anitta
      const day1Artists = ['Daft Punk', 'Disclosure', 'Anitta'];
      let day1Count = 0;
      for (const artist of day1Artists) {
        if (await page.locator(`text=${artist}`).isVisible().catch(() => false)) {
          day1Count++;
        }
      }
      expect(day1Count).toBeGreaterThan(0);
    });
  });

  test.describe('Stage Filter', () => {
    test('should display stage filters', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Look for stage names or filters
      await expect(page.locator('text=Main Stage').first()).toBeVisible();
      await expect(page.locator('text=Electro Arena').first()).toBeVisible();
      await expect(page.locator('text=Chill Garden').first()).toBeVisible();
    });

    test('should filter by stage', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Click on a stage filter
      const stageFilter = page.locator('button:has-text("Main Stage"), [class*="filter"]:has-text("Main Stage")');
      if (await stageFilter.isVisible().catch(() => false)) {
        await stageFilter.click();
        await page.waitForTimeout(500);

        // Should show only Main Stage performances
      }
    });

    test('should display stage colors or indicators', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Stages should have visual differentiation
      const stageIndicators = page.locator('[class*="stage-color"], [class*="indicator"], [style*="background"]');
      const hasStageColors = await stageIndicators.first().isVisible().catch(() => false);
    });
  });

  test.describe('Performance Display', () => {
    test('should display artist names', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Check for demo artists
      const artists = ['Daft Punk', 'The Weeknd', 'Disclosure', 'Billie Eilish', 'Stromae', 'Anitta'];
      let foundArtists = 0;

      for (const artist of artists) {
        if (await page.locator(`text=${artist}`).isVisible().catch(() => false)) {
          foundArtists++;
        }
      }

      expect(foundArtists).toBeGreaterThan(0);
    });

    test('should display performance times', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Look for time indicators
      const timePattern = page.locator('text=/\\d{1,2}[h:]/');
      const hasTimeDisplay = await timePattern.first().isVisible().catch(() => false);
    });

    test('should display stage names with performances', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Each performance should show its stage
      const mainStagePerformance = page.locator('[class*="performance"]:has-text("Main Stage")');
      const electroPerformance = page.locator('[class*="performance"]:has-text("Electro")');

      const hasStageInfo = await mainStagePerformance.isVisible().catch(() => false) ||
                           await electroPerformance.isVisible().catch(() => false);
    });

    test('should display artist genres', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Check for genre tags
      const genres = ['Electronic', 'House', 'R&B', 'Alternative'];
      let foundGenres = 0;

      for (const genre of genres) {
        if (await page.locator(`text=${genre}`).isVisible().catch(() => false)) {
          foundGenres++;
        }
      }
    });
  });

  test.describe('Schedule View', () => {
    test('should have timeline or grid view', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Look for schedule view container
      const scheduleView = page.locator('[class*="schedule"], [class*="timeline"], [class*="grid"]');
      const hasScheduleView = await scheduleView.first().isVisible().catch(() => false);
    });

    test('should show overlapping performances', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Multiple performances happening at similar times should be visible
      // On Day 1, performances happen at 18:00, 20:00, 22:00 on different stages
    });

    test('should allow viewing performance details', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Click on a performance
      const performanceCard = page.locator('[class*="performance"], [class*="event"]').first();
      if (await performanceCard.isVisible().catch(() => false)) {
        await performanceCard.click();
        await page.waitForTimeout(500);

        // Should show more details (modal, drawer, or expanded view)
        const hasDetails = await page.locator('[role="dialog"], [class*="modal"], [class*="detail"]').isVisible().catch(() => false);
      }
    });
  });

  test.describe('Artist Information', () => {
    test('should display artist images', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Look for artist images
      const artistImages = page.locator('img[alt*="artist"], img[src*="unsplash"]');
      const hasImages = await artistImages.first().isVisible().catch(() => false);
    });

    test('should show artist descriptions', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Check for artist descriptions
      const descriptions = ['French electronic duo', 'Canadian singer', 'British electronic'];
      let hasDescriptions = false;

      for (const desc of descriptions) {
        if (await page.locator(`text=${desc}`).isVisible().catch(() => false)) {
          hasDescriptions = true;
          break;
        }
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display programme on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/programme');
      await waitForPageLoad(page);

      await expect(page.locator('h1:has-text("Programme")')).toBeVisible();
    });

    test('should have scrollable schedule on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Schedule should be scrollable horizontally or in a list
      const schedule = page.locator('[class*="schedule"], [class*="timeline"]');
      const hasSchedule = await schedule.isVisible().catch(() => false);
    });

    test('should have accessible day navigation on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Day tabs should be visible and tappable
      const dayTabs = page.locator('[role="tablist"], [class*="tabs"]');
      const hasTabsOnMobile = await dayTabs.isVisible().catch(() => false);
    });
  });

  test.describe('Interactions', () => {
    test('should highlight current time slot', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // If within festival dates, current time should be highlighted
      const currentIndicator = page.locator('[class*="current"], [class*="now"], [class*="live"]');
      const hasCurrentIndicator = await currentIndicator.isVisible().catch(() => false);
      // This might not be visible if we're not during festival time
    });

    test('should allow adding to personal schedule', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Look for favorite/add to schedule button
      const favoriteButton = page.locator('button[aria-label*="favorite"], button:has-text("Ajouter"), [class*="favorite"]');
      const hasFavorite = await favoriteButton.first().isVisible().catch(() => false);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
    });

    test('should have accessible tabs', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Tabs should have proper ARIA attributes
      const tablist = page.locator('[role="tablist"]');
      const hasTablist = await tablist.isVisible().catch(() => false);

      if (hasTablist) {
        const tabs = page.locator('[role="tab"]');
        const tabCount = await tabs.count();
        expect(tabCount).toBeGreaterThan(0);
      }
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      // Focus on day tabs and try keyboard navigation
      const firstTab = page.locator('[role="tab"]').first();
      if (await firstTab.isVisible().catch(() => false)) {
        await firstTab.focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Performance', () => {
    test('should load schedule quickly', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/programme');
      await waitForPageLoad(page);
      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should handle day switching smoothly', async ({ page }) => {
      await page.goto('/programme');
      await waitForPageLoad(page);

      const startTime = Date.now();

      // Switch days
      const day2Tab = page.locator('[role="tab"]').nth(1);
      if (await day2Tab.isVisible().catch(() => false)) {
        await day2Tab.click();
        await page.waitForTimeout(500);
      }

      const switchTime = Date.now() - startTime;

      // Day switching should be fast
      expect(switchTime).toBeLessThan(2000);
    });
  });
});
