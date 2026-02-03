import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  roles: string[];
}

export interface Festival {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  logoUrl?: string;
  isActive: boolean;
}

export interface NotificationPreferences {
  email: {
    transactions: boolean;
    lineup: boolean;
    promotions: boolean;
  };
  push: {
    transactions: boolean;
    lineup: boolean;
    promotions: boolean;
  };
}

interface UserState {
  // State
  profile: UserProfile | null;
  festivals: Festival[];
  activeFestivalId: string | null;
  notificationPreferences: NotificationPreferences;
  isLoadingProfile: boolean;
  isLoadingFestivals: boolean;
  isUpdatingProfile: boolean;
  isUpdatingPreferences: boolean;

  // Actions
  setProfile: (profile: UserProfile | null) => void;
  setFestivals: (festivals: Festival[]) => void;
  setActiveFestival: (festivalId: string) => void;
  setNotificationPreferences: (preferences: NotificationPreferences) => void;

  // API Actions
  fetchProfile: () => Promise<void>;
  fetchFestivals: () => Promise<void>;
  updateProfile: (data: Partial<Pick<UserProfile, 'name' | 'phone' | 'avatarUrl'>>) => Promise<void>;
  updateAvatar: (imageUri: string) => Promise<string>;
  updateNotificationPreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>;
  getActiveFestival: () => Festival | null;
}

// Mock API delay
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      // Initial State
      profile: {
        id: 'user_123',
        email: 'jean.dupont@email.com',
        name: 'Jean Dupont',
        phone: '+33 6 12 34 56 78',
        avatarUrl: undefined,
        roles: ['ATTENDEE'],
      },
      festivals: [
        {
          id: 'fest_1',
          name: 'Rock en Seine 2026',
          startDate: '2026-08-21',
          endDate: '2026-08-23',
          location: 'Domaine de Saint-Cloud',
          isActive: true,
        },
        {
          id: 'fest_2',
          name: 'Les Vieilles Charrues',
          startDate: '2026-07-16',
          endDate: '2026-07-19',
          location: 'Carhaix-Plouguer',
          isActive: false,
        },
      ],
      activeFestivalId: 'fest_1',
      notificationPreferences: {
        email: {
          transactions: true,
          lineup: true,
          promotions: false,
        },
        push: {
          transactions: true,
          lineup: true,
          promotions: true,
        },
      },
      isLoadingProfile: false,
      isLoadingFestivals: false,
      isUpdatingProfile: false,
      isUpdatingPreferences: false,

      // Basic Actions
      setProfile: (profile) => set({ profile }),

      setFestivals: (festivals) => set({ festivals }),

      setActiveFestival: (festivalId) => set({ activeFestivalId: festivalId }),

      setNotificationPreferences: (preferences) =>
        set({ notificationPreferences: preferences }),

      // API Actions
      fetchProfile: async () => {
        set({ isLoadingProfile: true });
        try {
          await mockDelay(500);
          // In real implementation:
          // const response = await api.get('/user/profile');
          // set({ profile: response.data, isLoadingProfile: false });

          // Mock: keep existing profile
          set({ isLoadingProfile: false });
        } catch (error) {
          console.error('Failed to fetch profile:', error);
          set({ isLoadingProfile: false });
          throw error;
        }
      },

      fetchFestivals: async () => {
        set({ isLoadingFestivals: true });
        try {
          await mockDelay(500);
          // In real implementation:
          // const response = await api.get('/user/festivals');
          // set({ festivals: response.data, isLoadingFestivals: false });

          // Mock: keep existing festivals
          set({ isLoadingFestivals: false });
        } catch (error) {
          console.error('Failed to fetch festivals:', error);
          set({ isLoadingFestivals: false });
          throw error;
        }
      },

      updateProfile: async (data) => {
        set({ isUpdatingProfile: true });
        try {
          await mockDelay(800);
          // In real implementation:
          // const response = await api.patch('/user/profile', data);
          // set({ profile: response.data, isUpdatingProfile: false });

          // Mock: update local profile
          const currentProfile = get().profile;
          if (currentProfile) {
            set({
              profile: { ...currentProfile, ...data },
              isUpdatingProfile: false,
            });
          }
        } catch (error) {
          console.error('Failed to update profile:', error);
          set({ isUpdatingProfile: false });
          throw error;
        }
      },

      updateAvatar: async (imageUri: string) => {
        set({ isUpdatingProfile: true });
        try {
          await mockDelay(1000);
          // In real implementation:
          // const formData = new FormData();
          // formData.append('avatar', { uri: imageUri, type: 'image/jpeg', name: 'avatar.jpg' });
          // const response = await api.post('/user/avatar', formData);
          // return response.data.avatarUrl;

          // Mock: return the same URI as the "uploaded" URL
          const avatarUrl = imageUri;
          const currentProfile = get().profile;
          if (currentProfile) {
            set({
              profile: { ...currentProfile, avatarUrl },
              isUpdatingProfile: false,
            });
          }
          return avatarUrl;
        } catch (error) {
          console.error('Failed to upload avatar:', error);
          set({ isUpdatingProfile: false });
          throw error;
        }
      },

      updateNotificationPreferences: async (preferences) => {
        set({ isUpdatingPreferences: true });
        try {
          await mockDelay(500);
          // In real implementation:
          // await api.patch('/user/notifications', preferences);

          // Mock: merge with existing preferences
          const currentPrefs = get().notificationPreferences;
          const updatedPrefs: NotificationPreferences = {
            email: {
              ...currentPrefs.email,
              ...(preferences.email || {}),
            },
            push: {
              ...currentPrefs.push,
              ...(preferences.push || {}),
            },
          };
          set({
            notificationPreferences: updatedPrefs,
            isUpdatingPreferences: false,
          });
        } catch (error) {
          console.error('Failed to update notification preferences:', error);
          set({ isUpdatingPreferences: false });
          throw error;
        }
      },

      getActiveFestival: () => {
        const { festivals, activeFestivalId } = get();
        return festivals.find((f) => f.id === activeFestivalId) || null;
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        profile: state.profile,
        festivals: state.festivals,
        activeFestivalId: state.activeFestivalId,
        notificationPreferences: state.notificationPreferences,
      }),
    }
  )
);
