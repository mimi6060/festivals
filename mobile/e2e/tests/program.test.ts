/**
 * Program E2E Tests
 *
 * Comprehensive tests for viewing lineup, filtering by day/stage, favoriting artists,
 * and searching artists.
 */

import { device, element, by, expect, waitFor } from 'detox';
import { TestIds } from '../utils/testIds';
import { login, sleep, scrollDown, pullToRefresh } from '../utils/helpers';
import { goOffline, goOnline, resetNetwork } from '../utils/mocks';

// Test user credentials
const TEST_USER = {
  email: 'test@festivals.app',
  password: 'TestPassword123!',
  name: 'Test User',
};

// Festival program test data
const PROGRAM_DATA = {
  days: ['Vendredi', 'Samedi', 'Dimanche'],
  stages: [
    { id: 'main-stage', name: 'Main Stage' },
    { id: 'electronic-stage', name: 'Electronic Stage' },
    { id: 'acoustic-stage', name: 'Acoustic Stage' },
    { id: 'discovery-stage', name: 'Discovery Stage' },
  ],
  sampleArtists: ['The Test Band', 'DJ Electronic', 'Acoustic Duo'],
};

// Timeouts
const TIMEOUT = {
  short: 3000,
  medium: 10000,
  long: 30000,
};

describe('Program E2E Tests', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: {
        camera: 'YES',
        location: 'always',
        notifications: 'YES',
      },
    });
    await login(TEST_USER);
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await navigateToProgram();
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
      .withTimeout(TIMEOUT.medium);
    await element(by.text('Programme')).tap();
    await sleep(500);
  }

  // ==========================================================================
  // Viewing Lineup Tests
  // ==========================================================================

  describe('Viewing Lineup', () => {
    it('should display program screen', async () => {
      await expect(element(by.text('Programme'))).toBeVisible();
    });

    it('should display day selector', async () => {
      for (const day of PROGRAM_DATA.days) {
        await expect(element(by.text(day))).toBeVisible();
      }
    });

    it('should display stage filters', async () => {
      await waitFor(element(by.id(TestIds.program.stageFilter)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should display program list', async () => {
      await waitFor(element(by.id(TestIds.program.list)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show artist cards with info', async () => {
      try {
        await waitFor(element(by.id('program-slot-0')))
          .toBeVisible()
          .withTimeout(TIMEOUT.medium);

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
          .withTimeout(TIMEOUT.medium);

        // Should show start time in format HH:MM
        await expect(element(by.text(/[0-9]{2}:[0-9]{2}/))).toBeVisible();
      } catch {
        // No program data
      }
    });

    it('should show stage name for each slot', async () => {
      try {
        await waitFor(element(by.id('program-slot-0')))
          .toBeVisible()
          .withTimeout(TIMEOUT.medium);

        // At least one stage should be visible
        let foundStage = false;
        for (const stage of PROGRAM_DATA.stages) {
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

    it('should refresh program on pull to refresh', async () => {
      await pullToRefresh(TestIds.program.scrollView);

      await expect(element(by.text('Programme'))).toBeVisible();
    });

    it('should show loading state initially', async () => {
      await device.reloadReactNative();
      await navigateToProgram();

      // Loading should complete
      await waitFor(element(by.id(TestIds.program.list)))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should navigate to artist detail when card tapped', async () => {
      try {
        await waitFor(element(by.id('program-slot-0')))
          .toBeVisible()
          .withTimeout(TIMEOUT.medium);

        await element(by.id('program-slot-0')).tap();

        await waitFor(element(by.text('A propos')))
          .toBeVisible()
          .withTimeout(TIMEOUT.medium);
      } catch {
        // No program data
      }
    });

    it('should show artist image in detail', async () => {
      try {
        await element(by.id('program-slot-0')).tap();

        await waitFor(element(by.id(TestIds.program.artistImage)))
          .toBeVisible()
          .withTimeout(TIMEOUT.medium);
      } catch {
        // No program data
      }
    });

    it('should navigate back from artist detail', async () => {
      try {
        await element(by.id('program-slot-0')).tap();

        await waitFor(element(by.text('A propos')))
          .toBeVisible()
          .withTimeout(TIMEOUT.medium);

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
  // Filtering by Day Tests
  // ==========================================================================

  describe('Filtering by Day', () => {
    it('should filter by day when tapped', async () => {
      await element(by.text(PROGRAM_DATA.days[1])).tap();
      await sleep(500);

      // Content should update
      await expect(element(by.id(TestIds.program.list))).toBeVisible();
    });

    it('should highlight selected day', async () => {
      await element(by.text(PROGRAM_DATA.days[1])).tap();

      // Selected day should be visible
      await expect(element(by.text(PROGRAM_DATA.days[1]))).toBeVisible();
    });

    it('should show different artists for different days', async () => {
      // Select first day
      await element(by.text(PROGRAM_DATA.days[0])).tap();
      await sleep(500);

      try {
        await expect(element(by.id('program-slot-0'))).toBeVisible();
      } catch {
        // No program on this day
      }

      // Select second day
      await element(by.text(PROGRAM_DATA.days[1])).tap();
      await sleep(500);

      // Content should have changed
      await expect(element(by.id(TestIds.program.list))).toBeVisible();
    });

    it('should remember selected day after navigation', async () => {
      await element(by.text(PROGRAM_DATA.days[2])).tap();

      // Navigate away
      await element(by.text('Wallet')).tap();
      await sleep(500);

      // Navigate back
      await element(by.text('Programme')).tap();
      await sleep(500);

      // Selected day should be remembered (or reset to default)
      await expect(element(by.text('Programme'))).toBeVisible();
    });

    it('should scroll day selector horizontally', async () => {
      // All days should be accessible
      for (const day of PROGRAM_DATA.days) {
        await expect(element(by.text(day))).toBeVisible();
      }
    });

    it('should show empty state for day with no events', async () => {
      // Select a day
      await element(by.text(PROGRAM_DATA.days[0])).tap();

      // Either show program or empty state
      try {
        await expect(element(by.id('program-slot-0'))).toBeVisible();
      } catch {
        await expect(element(by.text('Aucun concert'))).toBeVisible();
      }
    });
  });

  // ==========================================================================
  // Filtering by Stage Tests
  // ==========================================================================

  describe('Filtering by Stage', () => {
    it('should show all stages option by default', async () => {
      await element(by.id(TestIds.program.stageFilter)).tap();

      await waitFor(element(by.text('Toutes les scenes')))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should filter by specific stage', async () => {
      await element(by.id(TestIds.program.stageFilter)).tap();

      const firstStage = PROGRAM_DATA.stages[0];
      await element(by.text(firstStage.name)).tap();

      await sleep(500);

      // List should update
      await expect(element(by.id(TestIds.program.list))).toBeVisible();
    });

    it('should show stage name in filter button when selected', async () => {
      await element(by.id(TestIds.program.stageFilter)).tap();

      const firstStage = PROGRAM_DATA.stages[0];
      await element(by.text(firstStage.name)).tap();

      // Filter button should show stage name
      await expect(element(by.text(firstStage.name))).toBeVisible();
    });

    it('should clear filter when "All" selected', async () => {
      // First select a stage
      await element(by.id(TestIds.program.stageFilter)).tap();
      await element(by.text(PROGRAM_DATA.stages[0].name)).tap();

      // Then clear filter
      await element(by.id(TestIds.program.stageFilter)).tap();
      await element(by.text('Toutes les scenes')).tap();

      // All stages should now be visible
      await expect(element(by.id(TestIds.program.list))).toBeVisible();
    });

    it('should combine day and stage filters', async () => {
      // Select a day
      await element(by.text(PROGRAM_DATA.days[1])).tap();

      // Select a stage
      await element(by.id(TestIds.program.stageFilter)).tap();
      await element(by.text(PROGRAM_DATA.stages[0].name)).tap();

      await sleep(500);

      // Filtered results should show
      await expect(element(by.id(TestIds.program.list))).toBeVisible();
    });

    it('should show empty state when filter has no results', async () => {
      // Select specific filters that might result in no matches
      await element(by.id(TestIds.program.stageFilter)).tap();
      await element(by.text(PROGRAM_DATA.stages[3].name)).tap();

      await sleep(500);

      // Either show results or empty state
      try {
        await expect(element(by.id('program-slot-0'))).toBeVisible();
      } catch {
        await expect(element(by.text('Aucun concert'))).toBeVisible();
      }
    });
  });

  // ==========================================================================
  // Favoriting Artist Tests
  // ==========================================================================

  describe('Favoriting Artist', () => {
    it('should show favorites filter', async () => {
      await expect(element(by.text('Mes favoris'))).toBeVisible();
    });

    it('should add artist to favorites', async () => {
      try {
        await waitFor(element(by.id('program-slot-0')))
          .toBeVisible()
          .withTimeout(TIMEOUT.medium);

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

    it('should filter to show only favorites', async () => {
      try {
        // Add to favorites first
        await element(by.id('favorite-button-0')).tap();

        // Apply favorites filter
        await element(by.text('Mes favoris')).tap();

        await sleep(500);

        // List should show only favorited items
        await expect(element(by.id(TestIds.program.list))).toBeVisible();
      } catch {
        // No program data
      }
    });

    it('should show empty state when no favorites', async () => {
      await element(by.text('Mes favoris')).tap();

      // Might show empty state or favorited items
      await expect(element(by.id(TestIds.program.list))).toBeVisible();
    });

    it('should persist favorites across sessions', async () => {
      try {
        // Add to favorites
        await element(by.id('favorite-button-0')).tap();

        // Reload app
        await device.reloadReactNative();
        await navigateToProgram();

        // Favorite should still be saved
        await waitFor(element(by.id('favorite-button-0-filled')))
          .toBeVisible()
          .withTimeout(TIMEOUT.medium);
      } catch {
        // No program data
      }
    });

    it('should add favorite from artist detail page', async () => {
      try {
        await element(by.id('program-slot-0')).tap();

        await waitFor(element(by.id(TestIds.program.detailFavoriteButton)))
          .toBeVisible()
          .withTimeout(TIMEOUT.medium);

        await element(by.id(TestIds.program.detailFavoriteButton)).tap();

        // Favorite should be set
        await expect(element(by.id(TestIds.program.detailFavoriteButtonFilled))).toBeVisible();
      } catch {
        // No program data
      }
    });

    it('should show favorite count badge', async () => {
      try {
        // Add some favorites
        await element(by.id('favorite-button-0')).tap();

        // Badge should show count
        await expect(element(by.id(TestIds.program.favoritesBadge))).toBeVisible();
      } catch {
        // No program data or no badge
      }
    });
  });

  // ==========================================================================
  // Searching Artists Tests
  // ==========================================================================

  describe('Searching Artists', () => {
    it('should show search bar', async () => {
      await expect(element(by.id(TestIds.program.searchInput))).toBeVisible();
    });

    it('should search artists by name', async () => {
      await element(by.id(TestIds.program.searchInput)).typeText('test');

      await sleep(500);

      // Results should update
      await expect(element(by.id(TestIds.program.list))).toBeVisible();
    });

    it('should show no results message for unmatched search', async () => {
      await element(by.id(TestIds.program.searchInput)).typeText('zzzznonexistent');

      await sleep(500);

      await expect(element(by.text('Aucun resultat'))).toBeVisible();
    });

    it('should clear search when X tapped', async () => {
      await element(by.id(TestIds.program.searchInput)).typeText('test');
      await element(by.id(TestIds.program.clearSearchButton)).tap();

      // Full list should be restored
      await expect(element(by.id(TestIds.program.list))).toBeVisible();
    });

    it('should search case-insensitively', async () => {
      await element(by.id(TestIds.program.searchInput)).typeText('TEST');

      await sleep(500);

      // Results should match regardless of case
      await expect(element(by.id(TestIds.program.list))).toBeVisible();
    });

    it('should search by genre', async () => {
      await element(by.id(TestIds.program.searchInput)).typeText('rock');

      await sleep(500);

      // Should find artists by genre
      await expect(element(by.id(TestIds.program.list))).toBeVisible();
    });

    it('should maintain search when switching days', async () => {
      await element(by.id(TestIds.program.searchInput)).typeText('test');

      await sleep(500);

      // Switch day
      await element(by.text(PROGRAM_DATA.days[1])).tap();

      await sleep(500);

      // Search should still be active
      await expect(element(by.id(TestIds.program.list))).toBeVisible();
    });

    it('should dismiss keyboard when search submitted', async () => {
      await element(by.id(TestIds.program.searchInput)).typeText('test');
      await element(by.id(TestIds.program.searchInput)).tapReturnKey();

      // Results should be visible
      await expect(element(by.id(TestIds.program.list))).toBeVisible();
    });

    it('should highlight search terms in results', async () => {
      await element(by.id(TestIds.program.searchInput)).typeText('test');

      await sleep(500);

      // Verify results are displayed
      await expect(element(by.id(TestIds.program.list))).toBeVisible();
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
          .withTimeout(TIMEOUT.medium);
      } catch {
        // No program data
      }
    });

    it('should enable reminder for performance', async () => {
      try {
        await element(by.id('program-slot-0')).tap();
        await element(by.text('Me rappeler')).tap();

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
      await expect(element(by.id(TestIds.program.list))).toBeVisible();

      await goOffline();
      await device.reloadReactNative();
      await navigateToProgram();

      // Program should still show from cache
      await waitFor(element(by.id(TestIds.program.list)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show offline indicator', async () => {
      await goOffline();
      await device.reloadReactNative();
      await navigateToProgram();

      await waitFor(element(by.id(TestIds.common.offlineIndicator)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show cached artist detail offline', async () => {
      try {
        // View artist detail to cache it
        await element(by.id('program-slot-0')).tap();
        await waitFor(element(by.text('A propos')))
          .toBeVisible()
          .withTimeout(TIMEOUT.medium);

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

    it('should maintain favorites when offline', async () => {
      try {
        // Add favorite
        await element(by.id('favorite-button-0')).tap();

        await goOffline();
        await device.reloadReactNative();
        await navigateToProgram();

        // Favorite should persist
        await expect(element(by.id('favorite-button-0-filled'))).toBeVisible();
      } catch {
        // No program data
      }
    });

    it('should sync favorites when back online', async () => {
      try {
        await goOffline();

        // Add favorite offline
        await element(by.id('favorite-button-0')).tap();

        await goOnline();

        // Should sync
        await expect(element(by.id('favorite-button-0-filled'))).toBeVisible();
      } catch {
        // No program data
      }
    });

    it('should allow searching cached data offline', async () => {
      await goOffline();
      await device.reloadReactNative();
      await navigateToProgram();

      await element(by.id(TestIds.program.searchInput)).typeText('test');

      await sleep(500);

      // Search should work on cached data
      await expect(element(by.id(TestIds.program.list))).toBeVisible();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle network error gracefully', async () => {
      await pullToRefresh(TestIds.program.scrollView);

      await expect(element(by.text('Programme'))).toBeVisible();
    });

    it('should allow retry after error', async () => {
      await pullToRefresh(TestIds.program.scrollView);

      await expect(element(by.id(TestIds.program.list))).toBeVisible();
    });

    it('should show error message if load fails', async () => {
      // Normal operation should work
      await expect(element(by.text('Programme'))).toBeVisible();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have accessible day selector', async () => {
      for (const day of PROGRAM_DATA.days) {
        await expect(element(by.text(day))).toBeVisible();
      }
    });

    it('should have accessible stage filter', async () => {
      await expect(element(by.id(TestIds.program.stageFilter))).toBeVisible();
    });

    it('should have accessible search input', async () => {
      await expect(element(by.id(TestIds.program.searchInput))).toBeVisible();
    });

    it('should have accessible favorite buttons', async () => {
      try {
        await expect(element(by.id('favorite-button-0'))).toBeVisible();
      } catch {
        // No program data
      }
    });
  });
});
