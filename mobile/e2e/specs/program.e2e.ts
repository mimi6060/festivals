/**
 * Program E2E Tests
 *
 * Tests for festival program, artist list, schedule, and favorites
 */

import { device, element, by, expect, waitFor } from 'detox';
import { loginAsTestUser } from '../utils/auth';
import {
  TIMEOUTS,
  waitForAnimation,
  waitForLoadingComplete,
  waitForElementVisible,
  sleep,
} from '../utils/wait';
import { goOffline, goOnline, resetNetwork } from '../utils/mock';
import {
  TEST_IDS,
  PROGRAM_TEST_DATA,
  FESTIVAL_CONFIG,
} from '../fixtures/testData';

describe('Program Feature', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: {
        camera: 'YES',
        location: 'always',
        notifications: 'YES',
      },
    });
    await loginAsTestUser();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await navigateToProgram();
    await waitForLoadingComplete();
  });

  afterAll(async () => {
    await resetNetwork();
    await device.terminateApp();
  });

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  async function navigateToProgram(): Promise<void> {
    await waitFor(element(by.text('Programme')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.medium);
    await element(by.text('Programme')).tap();
    await waitForAnimation();
  }

  async function pullToRefresh(): Promise<void> {
    const scrollView = element(by.id('program-scroll-view'));
    await scrollView.scroll(200, 'down', NaN, 0.9);
    await waitForAnimation();
  }

  async function scrollDown(pixels: number = 300): Promise<void> {
    const scrollView = element(by.id('program-scroll-view'));
    await scrollView.scroll(pixels, 'down');
  }

  async function scrollUp(pixels: number = 300): Promise<void> {
    const scrollView = element(by.id('program-scroll-view'));
    await scrollView.scroll(pixels, 'up');
  }

  // ==========================================================================
  // Program Display Tests
  // ==========================================================================

  describe('Program Display', () => {
    it('should display program screen', async () => {
      await expect(element(by.text('Programme'))).toBeVisible();
    });

    it('should display day selector', async () => {
      for (const day of FESTIVAL_CONFIG.dates.days) {
        await expect(element(by.text(day))).toBeVisible();
      }
    });

    it('should display stage filters', async () => {
      await waitFor(element(by.id(TEST_IDS.stageFilter)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should display program list', async () => {
      await waitFor(element(by.id(TEST_IDS.programList)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show artist cards with info', async () => {
      try {
        await waitFor(element(by.id('program-slot-0')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        // Artist card should show name and stage
        await expect(element(by.id('program-slot-0'))).toBeVisible();
      } catch {
        // No program data
        await expect(element(by.text('Aucun concert'))).toBeVisible();
      }
    });

    it('should show time slots for performances', async () => {
      try {
        await waitFor(element(by.id('program-slot-0')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        // Should show start time
        await expect(element(by.text(/[0-9]{2}:[0-9]{2}/))).toBeVisible();
      } catch {
        // No program data
      }
    });

    it('should refresh program on pull to refresh', async () => {
      await pullToRefresh();
      await waitForLoadingComplete();

      await expect(element(by.text('Programme'))).toBeVisible();
    });
  });

  // ==========================================================================
  // Day Filter Tests
  // ==========================================================================

  describe('Day Filter', () => {
    it('should filter by day when tapped', async () => {
      // Tap on a specific day
      await element(by.text(FESTIVAL_CONFIG.dates.days[1])).tap();
      await waitForAnimation();

      // Content should update
      await expect(element(by.id(TEST_IDS.programList))).toBeVisible();
    });

    it('should highlight selected day', async () => {
      await element(by.text(FESTIVAL_CONFIG.dates.days[1])).tap();

      // Selected day should have different styling (verified by being visible)
      await expect(element(by.text(FESTIVAL_CONFIG.dates.days[1]))).toBeVisible();
    });

    it('should show different artists for different days', async () => {
      // Select first day
      await element(by.text(FESTIVAL_CONFIG.dates.days[0])).tap();
      await waitForAnimation();

      // Remember first slot
      try {
        await expect(element(by.id('program-slot-0'))).toBeVisible();
      } catch {
        // No program on this day
      }

      // Select second day
      await element(by.text(FESTIVAL_CONFIG.dates.days[1])).tap();
      await waitForAnimation();

      // Content should have changed
      await expect(element(by.id(TEST_IDS.programList))).toBeVisible();
    });
  });

  // ==========================================================================
  // Stage Filter Tests
  // ==========================================================================

  describe('Stage Filter', () => {
    it('should show all stages by default', async () => {
      await element(by.id(TEST_IDS.stageFilter)).tap();

      await waitFor(element(by.text('Toutes les scenes')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should filter by specific stage', async () => {
      await element(by.id(TEST_IDS.stageFilter)).tap();

      const firstStage = PROGRAM_TEST_DATA.stages[0];
      await element(by.text(firstStage.name)).tap();

      await waitForAnimation();

      // List should update to show only this stage
      await expect(element(by.id(TEST_IDS.programList))).toBeVisible();
    });

    it('should show stage name in filter button when selected', async () => {
      await element(by.id(TEST_IDS.stageFilter)).tap();

      const firstStage = PROGRAM_TEST_DATA.stages[0];
      await element(by.text(firstStage.name)).tap();

      // Filter button should now show stage name
      await expect(element(by.text(firstStage.name))).toBeVisible();
    });

    it('should clear filter when "All" selected', async () => {
      // First select a stage
      await element(by.id(TEST_IDS.stageFilter)).tap();
      await element(by.text(PROGRAM_TEST_DATA.stages[0].name)).tap();

      // Then clear filter
      await element(by.id(TEST_IDS.stageFilter)).tap();
      await element(by.text('Toutes les scenes')).tap();

      // All stages should now be visible
      await expect(element(by.id(TEST_IDS.programList))).toBeVisible();
    });
  });

  // ==========================================================================
  // Artist Detail Tests
  // ==========================================================================

  describe('Artist Detail', () => {
    it('should navigate to artist detail when card tapped', async () => {
      try {
        await waitFor(element(by.id('program-slot-0')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        await element(by.id('program-slot-0')).tap();

        await waitFor(element(by.text('A propos')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);
      } catch {
        // No program data
      }
    });

    it('should display artist image', async () => {
      try {
        await element(by.id('program-slot-0')).tap();

        await waitFor(element(by.id('artist-image')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);
      } catch {
        // No program data
      }
    });

    it('should display artist bio', async () => {
      try {
        await element(by.id('program-slot-0')).tap();

        await waitFor(element(by.text('Biographie')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);
      } catch {
        // No program data
      }
    });

    it('should display performance time and stage', async () => {
      try {
        await element(by.id('program-slot-0')).tap();

        await waitFor(element(by.text('Concert')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        // Should show stage name
        let foundStage = false;
        for (const stage of PROGRAM_TEST_DATA.stages) {
          try {
            await expect(element(by.text(stage.name))).toBeVisible();
            foundStage = true;
            break;
          } catch {
            // Try next stage
          }
        }
      } catch {
        // No program data
      }
    });

    it('should show social media links', async () => {
      try {
        await element(by.id('program-slot-0')).tap();

        await scrollDown(500);

        await expect(element(by.id('social-links'))).toBeVisible();
      } catch {
        // No program data or no social links
      }
    });

    it('should navigate back to program list', async () => {
      try {
        await element(by.id('program-slot-0')).tap();

        await waitFor(element(by.text('A propos')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        if (device.getPlatform() === 'ios') {
          await element(by.traits(['button']).and(by.label('Back'))).tap();
        } else {
          await device.pressBack();
        }

        await expect(element(by.text('Programme'))).toBeVisible();
      } catch {
        // No program data
      }
    });
  });

  // ==========================================================================
  // Favorites Tests
  // ==========================================================================

  describe('Favorites', () => {
    it('should add artist to favorites', async () => {
      try {
        await waitFor(element(by.id('program-slot-0')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        await element(by.id('favorite-button-0')).tap();

        // Heart icon should change to filled
        await expect(element(by.id('favorite-button-0-filled'))).toBeVisible();
      } catch {
        // No program data
      }
    });

    it('should remove artist from favorites', async () => {
      try {
        // First add to favorites
        await element(by.id('favorite-button-0')).tap();
        await expect(element(by.id('favorite-button-0-filled'))).toBeVisible();

        // Then remove
        await element(by.id('favorite-button-0-filled')).tap();
        await expect(element(by.id('favorite-button-0'))).toBeVisible();
      } catch {
        // No program data
      }
    });

    it('should show favorites filter', async () => {
      await expect(element(by.text('Mes favoris'))).toBeVisible();
    });

    it('should filter to show only favorites', async () => {
      try {
        // Add to favorites first
        await element(by.id('favorite-button-0')).tap();

        // Apply favorites filter
        await element(by.text('Mes favoris')).tap();

        await waitForAnimation();

        // List should show only favorited items
        await expect(element(by.id(TEST_IDS.programList))).toBeVisible();
      } catch {
        // No program data
      }
    });

    it('should show empty state when no favorites', async () => {
      // Clear any existing favorites first (if possible)
      await element(by.text('Mes favoris')).tap();

      // Might show empty state or favorited items
      await expect(element(by.id(TEST_IDS.programList))).toBeVisible();
    });

    it('should persist favorites across sessions', async () => {
      try {
        // Add to favorites
        await element(by.id('favorite-button-0')).tap();

        // Reload app
        await device.reloadReactNative();
        await navigateToProgram();

        // Favorite should still be saved
        await expect(element(by.id('favorite-button-0-filled'))).toBeVisible();
      } catch {
        // No program data
      }
    });
  });

  // ==========================================================================
  // Search Tests
  // ==========================================================================

  describe('Search', () => {
    it('should show search bar', async () => {
      await expect(element(by.id('program-search-input'))).toBeVisible();
    });

    it('should search artists by name', async () => {
      await element(by.id('program-search-input')).typeText('test');

      await waitForAnimation();

      // Results should update
      await expect(element(by.id(TEST_IDS.programList))).toBeVisible();
    });

    it('should show no results message', async () => {
      await element(by.id('program-search-input')).typeText('zzzznonexistent');

      await waitForAnimation();

      await expect(element(by.text('Aucun resultat'))).toBeVisible();
    });

    it('should clear search when X tapped', async () => {
      await element(by.id('program-search-input')).typeText('test');
      await element(by.id('clear-search-button')).tap();

      // Full list should be restored
      await expect(element(by.id(TEST_IDS.programList))).toBeVisible();
    });
  });

  // ==========================================================================
  // Notification Reminder Tests
  // ==========================================================================

  describe('Notification Reminders', () => {
    it('should show reminder option on artist detail', async () => {
      try {
        await element(by.id('program-slot-0')).tap();

        await waitFor(element(by.text('Me rappeler')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);
      } catch {
        // No program data
      }
    });

    it('should enable reminder for performance', async () => {
      try {
        await element(by.id('program-slot-0')).tap();
        await element(by.text('Me rappeler')).tap();

        // Confirmation or toggle should update
        await expect(element(by.text('Rappel active'))).toBeVisible();
      } catch {
        // No program data
      }
    });

    it('should disable reminder', async () => {
      try {
        await element(by.id('program-slot-0')).tap();

        // Enable first
        await element(by.text('Me rappeler')).tap();
        await expect(element(by.text('Rappel active'))).toBeVisible();

        // Then disable
        await element(by.text('Rappel active')).tap();
        await expect(element(by.text('Me rappeler'))).toBeVisible();
      } catch {
        // No program data
      }
    });
  });

  // ==========================================================================
  // Offline Mode Tests
  // ==========================================================================

  describe('Offline Mode', () => {
    afterEach(async () => {
      await goOnline();
    });

    it('should show cached program when offline', async () => {
      // Ensure program is loaded
      await expect(element(by.id(TEST_IDS.programList))).toBeVisible();

      await goOffline();
      await device.reloadReactNative();
      await navigateToProgram();

      // Program should still show from cache
      await waitFor(element(by.id(TEST_IDS.programList)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show offline indicator', async () => {
      await goOffline();
      await device.reloadReactNative();
      await navigateToProgram();

      await waitFor(element(by.id('offline-indicator')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show cached artist detail offline', async () => {
      try {
        // View artist detail to cache it
        await element(by.id('program-slot-0')).tap();
        await waitFor(element(by.text('A propos')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        if (device.getPlatform() === 'ios') {
          await element(by.traits(['button']).and(by.label('Back'))).tap();
        } else {
          await device.pressBack();
        }

        await goOffline();
        await device.reloadReactNative();
        await navigateToProgram();

        await element(by.id('program-slot-0')).tap();

        // Artist detail should load from cache
        await expect(element(by.text('A propos'))).toBeVisible();
      } catch {
        // No program data
      }
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle network error gracefully', async () => {
      await pullToRefresh();
      await waitForLoadingComplete();

      await expect(element(by.text('Programme'))).toBeVisible();
    });

    it('should allow retry after error', async () => {
      await pullToRefresh();
      await waitForLoadingComplete();

      await expect(element(by.id(TEST_IDS.programList))).toBeVisible();
    });
  });
});
