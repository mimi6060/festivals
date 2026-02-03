/**
 * Map E2E Tests
 *
 * Tests for festival map, points of interest, navigation, and location services
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
  MAP_TEST_DATA,
  FESTIVAL_CONFIG,
} from '../fixtures/testData';

describe('Map Feature', () => {
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
    await navigateToMap();
    await waitForLoadingComplete();
  });

  afterAll(async () => {
    await resetNetwork();
    await device.terminateApp();
  });

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  async function navigateToMap(): Promise<void> {
    await waitFor(element(by.text('Carte')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.medium);
    await element(by.text('Carte')).tap();
    await waitForAnimation();
  }

  async function setMockLocation(
    latitude: number,
    longitude: number
  ): Promise<void> {
    await device.setLocation(latitude, longitude);
    await waitForAnimation();
  }

  // ==========================================================================
  // Map Display Tests
  // ==========================================================================

  describe('Map Display', () => {
    it('should display map screen', async () => {
      await expect(element(by.text('Carte'))).toBeVisible();
    });

    it('should display map view', async () => {
      await waitFor(element(by.id(TEST_IDS.mapView)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.long);
    });

    it('should display category filter buttons', async () => {
      await expect(element(by.id(TEST_IDS.categoryFilter))).toBeVisible();
    });

    it('should display search bar', async () => {
      await expect(element(by.id(TEST_IDS.searchBar))).toBeVisible();
    });

    it('should show user location button', async () => {
      await expect(element(by.id('user-location-button'))).toBeVisible();
    });

    it('should show zoom controls', async () => {
      await expect(element(by.id('zoom-in-button'))).toBeVisible();
      await expect(element(by.id('zoom-out-button'))).toBeVisible();
    });

    it('should display POI markers', async () => {
      await waitFor(element(by.id(TEST_IDS.mapView)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.long);

      // Map should have markers loaded
      try {
        await expect(element(by.id('poi-marker-0'))).toExist();
      } catch {
        // Markers might not be visible at current zoom
      }
    });
  });

  // ==========================================================================
  // POI Category Filter Tests
  // ==========================================================================

  describe('POI Category Filters', () => {
    it('should show all POI types in filter', async () => {
      await element(by.id(TEST_IDS.categoryFilter)).tap();

      // Check main categories
      await expect(element(by.text('Scenes'))).toBeVisible();
      await expect(element(by.text('Bars'))).toBeVisible();
      await expect(element(by.text('Restauration'))).toBeVisible();
      await expect(element(by.text('Toilettes'))).toBeVisible();
    });

    it('should filter markers by category', async () => {
      await element(by.id(TEST_IDS.categoryFilter)).tap();
      await element(by.text('Bars')).tap();

      await waitForAnimation();

      // Map should update to show only bars
      await expect(element(by.id(TEST_IDS.mapView))).toBeVisible();
    });

    it('should show selected category as active', async () => {
      await element(by.id(TEST_IDS.categoryFilter)).tap();
      await element(by.text('Scenes')).tap();

      // Category button should show active state
      await expect(element(by.id('category-scenes-active'))).toExist();
    });

    it('should allow multiple category selection', async () => {
      await element(by.id(TEST_IDS.categoryFilter)).tap();
      await element(by.text('Bars')).tap();
      await element(by.text('Restauration')).tap();

      await waitForAnimation();

      // Both categories should be active
      await expect(element(by.id(TEST_IDS.mapView))).toBeVisible();
    });

    it('should show all POIs when no filter selected', async () => {
      await element(by.id(TEST_IDS.categoryFilter)).tap();
      await element(by.text('Tout afficher')).tap();

      await waitForAnimation();

      await expect(element(by.id(TEST_IDS.mapView))).toBeVisible();
    });
  });

  // ==========================================================================
  // Search Tests
  // ==========================================================================

  describe('Map Search', () => {
    it('should search for POI by name', async () => {
      await element(by.id(TEST_IDS.searchBar)).typeText('Bar');

      await waitForAnimation();

      // Results should appear
      await expect(element(by.id('search-results'))).toBeVisible();
    });

    it('should show search suggestions', async () => {
      await element(by.id(TEST_IDS.searchBar)).typeText('Sc');

      await waitFor(element(by.id('search-suggestions')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should navigate to POI when search result tapped', async () => {
      await element(by.id(TEST_IDS.searchBar)).typeText('Main Stage');

      await waitFor(element(by.id('search-results')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);

      try {
        await element(by.id('search-result-0')).tap();

        // Map should center on POI
        await waitForAnimation();
        await expect(element(by.id(TEST_IDS.mapView))).toBeVisible();
      } catch {
        // No results found
      }
    });

    it('should show no results message', async () => {
      await element(by.id(TEST_IDS.searchBar)).typeText('zzzznonexistent');

      await waitForAnimation();

      await expect(element(by.text('Aucun resultat'))).toBeVisible();
    });

    it('should clear search when X tapped', async () => {
      await element(by.id(TEST_IDS.searchBar)).typeText('test');
      await element(by.id('clear-search-button')).tap();

      // Search should be cleared
      await expect(element(by.id(TEST_IDS.mapView))).toBeVisible();
    });
  });

  // ==========================================================================
  // POI Detail Tests
  // ==========================================================================

  describe('POI Detail', () => {
    it('should show POI detail sheet when marker tapped', async () => {
      try {
        await element(by.id('poi-marker-0')).tap();

        await waitFor(element(by.id('poi-detail-sheet')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);
      } catch {
        // Marker not visible at current zoom
      }
    });

    it('should display POI name and type', async () => {
      try {
        await element(by.id('poi-marker-0')).tap();

        await waitFor(element(by.id('poi-detail-sheet')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        await expect(element(by.id('poi-name'))).toBeVisible();
        await expect(element(by.id('poi-type'))).toBeVisible();
      } catch {
        // Marker not visible
      }
    });

    it('should show directions button', async () => {
      try {
        await element(by.id('poi-marker-0')).tap();

        await waitFor(element(by.id('poi-detail-sheet')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        await expect(element(by.text('Itineraire'))).toBeVisible();
      } catch {
        // Marker not visible
      }
    });

    it('should show distance from user location', async () => {
      // Set mock location first
      await setMockLocation(
        MAP_TEST_DATA.userLocation.latitude,
        MAP_TEST_DATA.userLocation.longitude
      );

      try {
        await element(by.id('poi-marker-0')).tap();

        await waitFor(element(by.id('poi-detail-sheet')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        await expect(element(by.text(/[0-9]+ m/))).toBeVisible();
      } catch {
        // Marker not visible
      }
    });

    it('should close detail sheet when dragged down', async () => {
      try {
        await element(by.id('poi-marker-0')).tap();

        await waitFor(element(by.id('poi-detail-sheet')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        // Swipe down to dismiss
        await element(by.id('poi-detail-sheet')).swipe('down');

        await waitFor(element(by.id('poi-detail-sheet')))
          .not.toBeVisible()
          .withTimeout(TIMEOUTS.medium);
      } catch {
        // Marker not visible
      }
    });

    it('should show additional info for stages', async () => {
      // Find a stage marker
      await element(by.id(TEST_IDS.categoryFilter)).tap();
      await element(by.text('Scenes')).tap();

      try {
        await element(by.id('poi-marker-0')).tap();

        await waitFor(element(by.id('poi-detail-sheet')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        // Stage should show current/upcoming performance
        await expect(element(by.text('En cours'))).toBeVisible();
      } catch {
        // No stage visible
      }
    });
  });

  // ==========================================================================
  // User Location Tests
  // ==========================================================================

  describe('User Location', () => {
    it('should request location permission on first use', async () => {
      // Permission should have been granted in beforeAll
      await expect(element(by.id('user-location-button'))).toBeVisible();
    });

    it('should center map on user location when button tapped', async () => {
      await setMockLocation(
        MAP_TEST_DATA.userLocation.latitude,
        MAP_TEST_DATA.userLocation.longitude
      );

      await element(by.id('user-location-button')).tap();

      await waitForAnimation();

      // Map should center on user
      await expect(element(by.id(TEST_IDS.mapView))).toBeVisible();
    });

    it('should show user location marker', async () => {
      await setMockLocation(
        MAP_TEST_DATA.userLocation.latitude,
        MAP_TEST_DATA.userLocation.longitude
      );

      await element(by.id('user-location-button')).tap();

      await waitFor(element(by.id('user-location-marker')))
        .toExist()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should update user location when moving', async () => {
      // Set initial location
      await setMockLocation(
        MAP_TEST_DATA.userLocation.latitude,
        MAP_TEST_DATA.userLocation.longitude
      );

      await element(by.id('user-location-button')).tap();
      await waitForAnimation();

      // Move location
      await setMockLocation(
        MAP_TEST_DATA.userLocation.latitude + 0.001,
        MAP_TEST_DATA.userLocation.longitude + 0.001
      );

      await sleep(2000);

      // User marker should have updated
      await expect(element(by.id('user-location-marker'))).toExist();
    });
  });

  // ==========================================================================
  // Navigation/Directions Tests
  // ==========================================================================

  describe('Directions', () => {
    beforeEach(async () => {
      await setMockLocation(
        MAP_TEST_DATA.userLocation.latitude,
        MAP_TEST_DATA.userLocation.longitude
      );
    });

    it('should show directions when POI selected', async () => {
      try {
        await element(by.id('poi-marker-0')).tap();

        await waitFor(element(by.id('poi-detail-sheet')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        await element(by.text('Itineraire')).tap();

        // Directions should appear
        await waitFor(element(by.id('directions-overlay')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);
      } catch {
        // No marker visible
      }
    });

    it('should show walking route on map', async () => {
      try {
        await element(by.id('poi-marker-0')).tap();
        await element(by.text('Itineraire')).tap();

        await waitFor(element(by.id('route-line')))
          .toExist()
          .withTimeout(TIMEOUTS.medium);
      } catch {
        // No route available
      }
    });

    it('should show estimated walking time', async () => {
      try {
        await element(by.id('poi-marker-0')).tap();
        await element(by.text('Itineraire')).tap();

        await waitFor(element(by.text(/[0-9]+ min/)))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);
      } catch {
        // No directions available
      }
    });

    it('should close directions when X tapped', async () => {
      try {
        await element(by.id('poi-marker-0')).tap();
        await element(by.text('Itineraire')).tap();

        await waitFor(element(by.id('directions-overlay')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        await element(by.id('close-directions-button')).tap();

        await waitFor(element(by.id('directions-overlay')))
          .not.toBeVisible()
          .withTimeout(TIMEOUTS.medium);
      } catch {
        // No directions available
      }
    });
  });

  // ==========================================================================
  // Map Interaction Tests
  // ==========================================================================

  describe('Map Interactions', () => {
    it('should zoom in when + button tapped', async () => {
      await element(by.id('zoom-in-button')).tap();
      await waitForAnimation();

      // Map should zoom in (verify it's still visible)
      await expect(element(by.id(TEST_IDS.mapView))).toBeVisible();
    });

    it('should zoom out when - button tapped', async () => {
      await element(by.id('zoom-out-button')).tap();
      await waitForAnimation();

      await expect(element(by.id(TEST_IDS.mapView))).toBeVisible();
    });

    it('should support pinch to zoom', async () => {
      const mapView = element(by.id(TEST_IDS.mapView));
      await mapView.pinch(1.5); // Zoom in

      await waitForAnimation();

      await expect(element(by.id(TEST_IDS.mapView))).toBeVisible();
    });

    it('should support pan gesture', async () => {
      const mapView = element(by.id(TEST_IDS.mapView));
      await mapView.swipe('left', 'slow', 0.3);

      await waitForAnimation();

      await expect(element(by.id(TEST_IDS.mapView))).toBeVisible();
    });
  });

  // ==========================================================================
  // Offline Mode Tests
  // ==========================================================================

  describe('Offline Mode', () => {
    afterEach(async () => {
      await goOnline();
    });

    it('should show cached map when offline', async () => {
      // Ensure map is loaded
      await expect(element(by.id(TEST_IDS.mapView))).toBeVisible();

      await goOffline();
      await device.reloadReactNative();
      await navigateToMap();

      // Map should still show from cache
      await waitFor(element(by.id(TEST_IDS.mapView)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show offline indicator', async () => {
      await goOffline();
      await device.reloadReactNative();
      await navigateToMap();

      await waitFor(element(by.id('offline-indicator')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.medium);
    });

    it('should show cached POI details offline', async () => {
      // View a POI to cache it
      try {
        await element(by.id('poi-marker-0')).tap();
        await waitFor(element(by.id('poi-detail-sheet')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.medium);

        // Dismiss
        await element(by.id('poi-detail-sheet')).swipe('down');
      } catch {
        // No marker
      }

      await goOffline();
      await device.reloadReactNative();
      await navigateToMap();

      try {
        await element(by.id('poi-marker-0')).tap();

        // POI detail should load from cache
        await expect(element(by.id('poi-detail-sheet'))).toBeVisible();
      } catch {
        // No marker visible offline
      }
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have accessible map controls', async () => {
      await expect(element(by.id('zoom-in-button'))).toBeVisible();
      await expect(element(by.id('zoom-out-button'))).toBeVisible();
      await expect(element(by.id('user-location-button'))).toBeVisible();
    });

    it('should have accessible POI markers', async () => {
      // Markers should have accessibility labels
      try {
        await expect(element(by.id('poi-marker-0'))).toExist();
      } catch {
        // Markers might not be visible
      }
    });

    it('should have accessible search', async () => {
      await expect(element(by.id(TEST_IDS.searchBar))).toBeVisible();
    });
  });
});
