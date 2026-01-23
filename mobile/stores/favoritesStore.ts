import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/config/api';
import { useNetworkStore } from './networkStore';

export type FavoriteType = 'artist' | 'stage' | 'stand';

export interface FavoriteItem {
  id: string;
  type: FavoriteType;
  addedAt: string;
  synced: boolean;
}

export interface PendingSync {
  id: string;
  type: FavoriteType;
  action: 'add' | 'remove';
  timestamp: string;
  festivalId?: string;
}

export interface UpcomingFavoritePerformance {
  performanceId: string;
  artistId: string;
  artistName: string;
  artistPhoto?: string;
  stageId: string;
  stageName: string;
  stageColor?: string;
  startTime: string;
  endTime: string;
}

interface FavoritesState {
  // State
  favoriteArtists: string[];
  favoriteStages: string[];
  favoriteStands: string[];
  favorites: FavoriteItem[];
  pendingSync: PendingSync[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  lastSyncAt: string | null;
  currentFestivalId: string | null;
  upcomingFavoritePerformances: UpcomingFavoritePerformance[];

  // Actions
  setCurrentFestival: (festivalId: string) => void;
  addFavorite: (id: string, type: FavoriteType) => void;
  removeFavorite: (id: string, type: FavoriteType) => void;
  toggleFavorite: (id: string, type: FavoriteType) => void;
  clearAllFavorites: () => void;
  clearFavoritesByType: (type: FavoriteType) => void;

  // Sync actions
  syncWithBackend: (festivalId?: string) => Promise<void>;
  fetchFavoritesFromBackend: (festivalId?: string) => Promise<void>;
  fetchUpcomingFavoritePerformances: (festivalId?: string, limit?: number) => Promise<void>;
  processPendingSync: () => Promise<void>;

  // Selectors
  isFavorite: (id: string, type: FavoriteType) => boolean;
  getFavoritesByType: (type: FavoriteType) => string[];
  getFavoriteCount: (type?: FavoriteType) => number;
  hasPendingSync: () => boolean;
  getNextFavoritePerformance: () => UpcomingFavoritePerformance | null;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      // Initial state
      favoriteArtists: [],
      favoriteStages: [],
      favoriteStands: [],
      favorites: [],
      pendingSync: [],
      isLoading: false,
      isSyncing: false,
      error: null,
      lastSyncAt: null,
      currentFestivalId: null,
      upcomingFavoritePerformances: [],

      // Set current festival
      setCurrentFestival: (festivalId: string) => {
        set({ currentFestivalId: festivalId });
      },

      // Add a favorite
      addFavorite: (id: string, type: FavoriteType) => {
        const state = get();
        const isAlreadyFavorite = state.isFavorite(id, type);

        if (isAlreadyFavorite) return;

        const now = new Date().toISOString();
        const newFavorite: FavoriteItem = {
          id,
          type,
          addedAt: now,
          synced: false,
        };

        const pendingAction: PendingSync = {
          id,
          type,
          action: 'add',
          timestamp: now,
        };

        set((state) => {
          const updates: Partial<FavoritesState> = {
            favorites: [...state.favorites, newFavorite],
            pendingSync: [...state.pendingSync, pendingAction],
          };

          // Also update the type-specific arrays for quick access
          switch (type) {
            case 'artist':
              updates.favoriteArtists = [...state.favoriteArtists, id];
              break;
            case 'stage':
              updates.favoriteStages = [...state.favoriteStages, id];
              break;
            case 'stand':
              updates.favoriteStands = [...state.favoriteStands, id];
              break;
          }

          return updates;
        });

        // Try to sync immediately if online
        const isOnline = useNetworkStore.getState().isOnline;
        if (isOnline) {
          get().processPendingSync();
        }
      },

      // Remove a favorite
      removeFavorite: (id: string, type: FavoriteType) => {
        const state = get();
        const isCurrentlyFavorite = state.isFavorite(id, type);

        if (!isCurrentlyFavorite) return;

        const now = new Date().toISOString();
        const pendingAction: PendingSync = {
          id,
          type,
          action: 'remove',
          timestamp: now,
        };

        set((state) => {
          const updates: Partial<FavoritesState> = {
            favorites: state.favorites.filter((f) => !(f.id === id && f.type === type)),
            pendingSync: [...state.pendingSync, pendingAction],
          };

          // Also update the type-specific arrays
          switch (type) {
            case 'artist':
              updates.favoriteArtists = state.favoriteArtists.filter((fId) => fId !== id);
              break;
            case 'stage':
              updates.favoriteStages = state.favoriteStages.filter((fId) => fId !== id);
              break;
            case 'stand':
              updates.favoriteStands = state.favoriteStands.filter((fId) => fId !== id);
              break;
          }

          return updates;
        });

        // Try to sync immediately if online
        const isOnline = useNetworkStore.getState().isOnline;
        if (isOnline) {
          get().processPendingSync();
        }
      },

      // Toggle favorite status
      toggleFavorite: (id: string, type: FavoriteType) => {
        const state = get();
        if (state.isFavorite(id, type)) {
          state.removeFavorite(id, type);
        } else {
          state.addFavorite(id, type);
        }
      },

      // Clear all favorites
      clearAllFavorites: () => {
        set({
          favoriteArtists: [],
          favoriteStages: [],
          favoriteStands: [],
          favorites: [],
        });
      },

      // Clear favorites by type
      clearFavoritesByType: (type: FavoriteType) => {
        set((state) => {
          const updates: Partial<FavoritesState> = {
            favorites: state.favorites.filter((f) => f.type !== type),
          };

          switch (type) {
            case 'artist':
              updates.favoriteArtists = [];
              break;
            case 'stage':
              updates.favoriteStages = [];
              break;
            case 'stand':
              updates.favoriteStands = [];
              break;
          }

          return updates;
        });
      },

      // Sync all favorites with backend
      syncWithBackend: async (festivalId?: string) => {
        const state = get();
        if (state.isSyncing) return;

        const targetFestivalId = festivalId || state.currentFestivalId;

        set({ isSyncing: true, error: null });

        try {
          // First, fetch current state from backend
          await get().fetchFavoritesFromBackend(targetFestivalId || undefined);

          // Then, process any pending changes
          await get().processPendingSync();

          // Fetch upcoming performances
          await get().fetchUpcomingFavoritePerformances(targetFestivalId || undefined);

          set({
            isSyncing: false,
            lastSyncAt: new Date().toISOString(),
          });
        } catch (error) {
          set({
            isSyncing: false,
            error: error instanceof Error ? error.message : 'Failed to sync favorites',
          });
        }
      },

      // Fetch favorites from backend
      fetchFavoritesFromBackend: async (festivalId?: string) => {
        const state = get();
        const targetFestivalId = festivalId || state.currentFestivalId;

        set({ isLoading: true, error: null });

        try {
          // Use festival-specific endpoint if festivalId is available
          const url = targetFestivalId
            ? `${API_URL}/festivals/${targetFestivalId}/me/favorites`
            : `${API_URL}/users/me/favorites`;

          const response = await fetch(url);

          if (response.ok) {
            const data = await response.json();

            // Merge backend data with local favorites
            // Local favorites that aren't synced take precedence
            const localUnsynced = get().favorites.filter((f) => !f.synced);

            // Handle both old format (data.favorites) and new format (data.favorites[].favorite.artistId)
            const backendFavorites: FavoriteItem[] = (data.favorites || []).map((f: any) => {
              const favorite = f.favorite || f;
              return {
                id: favorite.artistId || favorite.id,
                type: 'artist' as FavoriteType,
                addedAt: favorite.createdAt || favorite.addedAt || new Date().toISOString(),
                synced: true,
              };
            });

            // Merge: backend + unsynced local (avoiding duplicates)
            const merged = [...backendFavorites];
            for (const local of localUnsynced) {
              const exists = merged.some((m) => m.id === local.id && m.type === local.type);
              if (!exists) {
                merged.push(local);
              }
            }

            // Update type-specific arrays
            const favoriteArtists = merged.filter((f) => f.type === 'artist').map((f) => f.id);
            const favoriteStages = merged.filter((f) => f.type === 'stage').map((f) => f.id);
            const favoriteStands = merged.filter((f) => f.type === 'stand').map((f) => f.id);

            set({
              favorites: merged,
              favoriteArtists,
              favoriteStages,
              favoriteStands,
              isLoading: false,
            });
          } else {
            // Keep local data on error
            set({ isLoading: false });
          }
        } catch (error) {
          console.warn('Failed to fetch favorites from backend:', error);
          set({ isLoading: false });
        }
      },

      // Fetch upcoming performances of favorited artists
      fetchUpcomingFavoritePerformances: async (festivalId?: string, limit: number = 10) => {
        const state = get();
        const targetFestivalId = festivalId || state.currentFestivalId;

        if (!targetFestivalId) return;

        try {
          const response = await fetch(
            `${API_URL}/festivals/${targetFestivalId}/me/favorites/upcoming?limit=${limit}`
          );

          if (response.ok) {
            const data = await response.json();

            const performances: UpcomingFavoritePerformance[] = (data || []).map((p: any) => ({
              performanceId: p.id,
              artistId: p.artistId,
              artistName: p.artist?.name || 'Unknown Artist',
              artistPhoto: p.artist?.imageUrl,
              stageId: p.stageId,
              stageName: p.stage?.name || 'Unknown Stage',
              stageColor: p.stage?.settings?.color,
              startTime: p.startTime,
              endTime: p.endTime,
            }));

            set({ upcomingFavoritePerformances: performances });
          }
        } catch (error) {
          console.warn('Failed to fetch upcoming favorite performances:', error);
        }
      },

      // Process pending sync operations
      processPendingSync: async () => {
        const state = get();
        if (state.pendingSync.length === 0) return;

        const isOnline = useNetworkStore.getState().isOnline;
        if (!isOnline) return;

        const pendingItems = [...state.pendingSync];
        const processedIds: string[] = [];
        const festivalId = state.currentFestivalId;

        for (const item of pendingItems) {
          try {
            // Use festival-specific endpoints for artists
            let endpoint: string;
            if (item.type === 'artist' && festivalId) {
              endpoint = `${API_URL}/festivals/${festivalId}/artists/${item.id}/favorite`;
            } else {
              endpoint = `${API_URL}/users/me/favorites`;
            }

            const method = item.action === 'add' ? 'POST' : 'DELETE';

            const response = await fetch(endpoint, {
              method,
              headers: {
                'Content-Type': 'application/json',
              },
              // Only send body for non-festival-specific endpoints
              ...(item.type !== 'artist' || !festivalId
                ? {
                    body: JSON.stringify({
                      id: item.id,
                      type: item.type,
                    }),
                  }
                : {}),
            });

            if (response.ok || response.status === 404 || response.status === 409) {
              // 404 is ok for DELETE (already removed)
              // 409 is ok for POST (already added)
              processedIds.push(`${item.id}-${item.type}-${item.timestamp}`);

              // Mark the favorite as synced
              if (item.action === 'add') {
                set((state) => ({
                  favorites: state.favorites.map((f) =>
                    f.id === item.id && f.type === item.type ? { ...f, synced: true } : f
                  ),
                }));
              }
            }
          } catch (error) {
            console.warn('Failed to sync favorite:', item, error);
          }
        }

        // Remove processed items from pending
        if (processedIds.length > 0) {
          set((state) => ({
            pendingSync: state.pendingSync.filter(
              (p) => !processedIds.includes(`${p.id}-${p.type}-${p.timestamp}`)
            ),
          }));
        }
      },

      // Check if an item is favorited
      isFavorite: (id: string, type: FavoriteType) => {
        const state = get();
        switch (type) {
          case 'artist':
            return state.favoriteArtists.includes(id);
          case 'stage':
            return state.favoriteStages.includes(id);
          case 'stand':
            return state.favoriteStands.includes(id);
          default:
            return false;
        }
      },

      // Get favorites by type
      getFavoritesByType: (type: FavoriteType) => {
        const state = get();
        switch (type) {
          case 'artist':
            return state.favoriteArtists;
          case 'stage':
            return state.favoriteStages;
          case 'stand':
            return state.favoriteStands;
          default:
            return [];
        }
      },

      // Get count of favorites
      getFavoriteCount: (type?: FavoriteType) => {
        const state = get();
        if (!type) {
          return state.favoriteArtists.length + state.favoriteStages.length + state.favoriteStands.length;
        }
        switch (type) {
          case 'artist':
            return state.favoriteArtists.length;
          case 'stage':
            return state.favoriteStages.length;
          case 'stand':
            return state.favoriteStands.length;
          default:
            return 0;
        }
      },

      // Check if there are pending sync operations
      hasPendingSync: () => {
        return get().pendingSync.length > 0;
      },

      // Get the next upcoming favorite performance
      getNextFavoritePerformance: () => {
        const state = get();
        if (state.upcomingFavoritePerformances.length === 0) return null;

        const now = new Date();
        const upcoming = state.upcomingFavoritePerformances.find(
          (p) => new Date(p.startTime) > now
        );
        return upcoming || null;
      },
    }),
    {
      name: 'favorites-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        favoriteArtists: state.favoriteArtists,
        favoriteStages: state.favoriteStages,
        favoriteStands: state.favoriteStands,
        favorites: state.favorites,
        pendingSync: state.pendingSync,
        lastSyncAt: state.lastSyncAt,
        currentFestivalId: state.currentFestivalId,
        upcomingFavoritePerformances: state.upcomingFavoritePerformances,
      }),
    }
  )
);

// Auto-sync when coming back online
useNetworkStore.subscribe((state, prevState) => {
  if (state.isOnline && !prevState.isOnline) {
    // Just came online - process pending sync
    useFavoritesStore.getState().processPendingSync();
  }
});
