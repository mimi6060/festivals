import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FriendStatus = 'ONLINE' | 'OFFLINE' | 'AT_FESTIVAL';
export type FriendRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface Friend {
  id: string;
  userId: string;
  name: string;
  username: string;
  avatarUrl?: string;
  status: FriendStatus;
  lastSeen?: string;
  location?: {
    latitude: number;
    longitude: number;
    updatedAt: string;
    poiName?: string;
  } | null;
  isLocationShared: boolean;
  addedAt: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUsername: string;
  fromAvatarUrl?: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: string;
}

export interface MoneyTransfer {
  id: string;
  fromUserId: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  currencyName: string;
  message?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

interface SocialState {
  // State
  friends: Friend[];
  friendRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  isLocationSharingEnabled: boolean;
  myLocation: {
    latitude: number;
    longitude: number;
    updatedAt: string;
  } | null;
  recentTransfers: MoneyTransfer[];

  // Loading states
  isLoadingFriends: boolean;
  isLoadingRequests: boolean;
  isSendingRequest: boolean;
  isSendingMoney: boolean;
  isUpdatingLocation: boolean;

  // Actions
  setFriends: (friends: Friend[]) => void;
  setFriendRequests: (requests: FriendRequest[]) => void;
  setSentRequests: (requests: FriendRequest[]) => void;
  setLocationSharingEnabled: (enabled: boolean) => void;
  updateMyLocation: (location: { latitude: number; longitude: number }) => void;

  // API Actions
  fetchFriends: () => Promise<void>;
  fetchFriendRequests: () => Promise<void>;
  sendFriendRequest: (identifier: string) => Promise<{ success: boolean; error?: string }>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  rejectFriendRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  sendMoney: (params: {
    friendId: string;
    amount: number;
    message?: string;
  }) => Promise<{ success: boolean; error?: string; transferId?: string }>;
  toggleLocationSharing: (friendId: string, enabled: boolean) => Promise<void>;
  getFriendById: (friendId: string) => Friend | undefined;
  searchUsers: (query: string) => Promise<{ id: string; name: string; username: string; avatarUrl?: string }[]>;
  cancelSentRequest: (requestId: string) => Promise<void>;
  getFriendsAtFestival: () => Friend[];
  getOnlineFriends: () => Friend[];
}

// Mock API delay
const mockDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock friends data
const mockFriends: Friend[] = [
  {
    id: 'friend_1',
    userId: 'user_101',
    name: 'Marie Martin',
    username: 'marie_m',
    avatarUrl: undefined,
    status: 'AT_FESTIVAL',
    lastSeen: new Date().toISOString(),
    location: {
      latitude: 48.8566,
      longitude: 2.3522,
      updatedAt: new Date().toISOString(),
      poiName: 'Main Stage',
    },
    isLocationShared: true,
    addedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: 'friend_2',
    userId: 'user_102',
    name: 'Pierre Durand',
    username: 'pierre_d',
    avatarUrl: undefined,
    status: 'AT_FESTIVAL',
    lastSeen: new Date(Date.now() - 300000).toISOString(),
    location: {
      latitude: 48.857,
      longitude: 2.353,
      updatedAt: new Date(Date.now() - 300000).toISOString(),
      poiName: 'Food Court',
    },
    isLocationShared: true,
    addedAt: new Date(Date.now() - 86400000 * 60).toISOString(),
  },
  {
    id: 'friend_3',
    userId: 'user_103',
    name: 'Sophie Bernard',
    username: 'sophie_b',
    avatarUrl: undefined,
    status: 'ONLINE',
    lastSeen: new Date(Date.now() - 60000).toISOString(),
    location: null,
    isLocationShared: false,
    addedAt: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: 'friend_4',
    userId: 'user_104',
    name: 'Lucas Petit',
    username: 'lucas_p',
    avatarUrl: undefined,
    status: 'OFFLINE',
    lastSeen: new Date(Date.now() - 3600000 * 5).toISOString(),
    location: null,
    isLocationShared: false,
    addedAt: new Date(Date.now() - 86400000 * 90).toISOString(),
  },
];

const mockFriendRequests: FriendRequest[] = [
  {
    id: 'req_1',
    fromUserId: 'user_201',
    fromUserName: 'Emma Wilson',
    fromUsername: 'emma_w',
    fromAvatarUrl: undefined,
    toUserId: 'user_123',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'req_2',
    fromUserId: 'user_202',
    fromUserName: 'Thomas Roux',
    fromUsername: 'thomas_r',
    fromAvatarUrl: undefined,
    toUserId: 'user_123',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      // Initial State
      friends: mockFriends,
      friendRequests: mockFriendRequests,
      sentRequests: [],
      isLocationSharingEnabled: true,
      myLocation: null,
      recentTransfers: [],

      // Loading states
      isLoadingFriends: false,
      isLoadingRequests: false,
      isSendingRequest: false,
      isSendingMoney: false,
      isUpdatingLocation: false,

      // Basic Actions
      setFriends: (friends) => set({ friends }),
      setFriendRequests: (friendRequests) => set({ friendRequests }),
      setSentRequests: (sentRequests) => set({ sentRequests }),
      setLocationSharingEnabled: (isLocationSharingEnabled) => set({ isLocationSharingEnabled }),

      updateMyLocation: (location) =>
        set({
          myLocation: {
            ...location,
            updatedAt: new Date().toISOString(),
          },
        }),

      // API Actions
      fetchFriends: async () => {
        set({ isLoadingFriends: true });
        try {
          await mockDelay(500);
          // In real implementation:
          // const response = await api.get('/social/friends');
          // set({ friends: response.data, isLoadingFriends: false });

          // Mock: update status randomly
          const updatedFriends = get().friends.map((friend) => ({
            ...friend,
            lastSeen: friend.status !== 'OFFLINE' ? new Date().toISOString() : friend.lastSeen,
          }));
          set({ friends: updatedFriends, isLoadingFriends: false });
        } catch (error) {
          console.error('Failed to fetch friends:', error);
          set({ isLoadingFriends: false });
          throw error;
        }
      },

      fetchFriendRequests: async () => {
        set({ isLoadingRequests: true });
        try {
          await mockDelay(400);
          // In real implementation:
          // const response = await api.get('/social/requests');
          // set({ friendRequests: response.data, isLoadingRequests: false });

          set({ isLoadingRequests: false });
        } catch (error) {
          console.error('Failed to fetch friend requests:', error);
          set({ isLoadingRequests: false });
          throw error;
        }
      },

      sendFriendRequest: async (identifier) => {
        set({ isSendingRequest: true });
        try {
          await mockDelay(600);
          // In real implementation:
          // const response = await api.post('/social/requests', { identifier });

          // Check if it looks like a username or QR code
          const isUsername = !identifier.startsWith('qr_');

          // Mock validation
          if (isUsername && identifier.length < 3) {
            set({ isSendingRequest: false });
            return { success: false, error: "Nom d'utilisateur invalide" };
          }

          // Check if already friends
          const existingFriend = get().friends.find(
            (f) => f.username.toLowerCase() === identifier.toLowerCase()
          );
          if (existingFriend) {
            set({ isSendingRequest: false });
            return { success: false, error: 'Vous etes deja amis avec cette personne' };
          }

          // Mock: Add to sent requests
          const newRequest: FriendRequest = {
            id: `req_sent_${Date.now()}`,
            fromUserId: 'user_123',
            fromUserName: 'Jean Dupont',
            fromUsername: 'jean_d',
            toUserId: `user_${Date.now()}`,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          };

          set((state) => ({
            sentRequests: [...state.sentRequests, newRequest],
            isSendingRequest: false,
          }));

          return { success: true };
        } catch (error) {
          console.error('Failed to send friend request:', error);
          set({ isSendingRequest: false });
          return { success: false, error: 'Une erreur est survenue' };
        }
      },

      acceptFriendRequest: async (requestId) => {
        try {
          await mockDelay(400);
          // In real implementation:
          // await api.post(`/social/requests/${requestId}/accept`);

          const request = get().friendRequests.find((r) => r.id === requestId);
          if (request) {
            // Add as friend
            const newFriend: Friend = {
              id: `friend_${Date.now()}`,
              userId: request.fromUserId,
              name: request.fromUserName,
              username: request.fromUsername,
              avatarUrl: request.fromAvatarUrl,
              status: 'ONLINE',
              lastSeen: new Date().toISOString(),
              location: null,
              isLocationShared: false,
              addedAt: new Date().toISOString(),
            };

            set((state) => ({
              friends: [...state.friends, newFriend],
              friendRequests: state.friendRequests.filter((r) => r.id !== requestId),
            }));
          }
        } catch (error) {
          console.error('Failed to accept friend request:', error);
          throw error;
        }
      },

      rejectFriendRequest: async (requestId) => {
        try {
          await mockDelay(300);
          // In real implementation:
          // await api.post(`/social/requests/${requestId}/reject`);

          set((state) => ({
            friendRequests: state.friendRequests.filter((r) => r.id !== requestId),
          }));
        } catch (error) {
          console.error('Failed to reject friend request:', error);
          throw error;
        }
      },

      removeFriend: async (friendId) => {
        try {
          await mockDelay(400);
          // In real implementation:
          // await api.delete(`/social/friends/${friendId}`);

          set((state) => ({
            friends: state.friends.filter((f) => f.id !== friendId),
          }));
        } catch (error) {
          console.error('Failed to remove friend:', error);
          throw error;
        }
      },

      sendMoney: async ({ friendId, amount, message }) => {
        set({ isSendingMoney: true });
        try {
          await mockDelay(800);
          // In real implementation:
          // const response = await api.post('/social/transfer', { friendId, amount, message });

          const friend = get().friends.find((f) => f.id === friendId);
          if (!friend) {
            set({ isSendingMoney: false });
            return { success: false, error: 'Ami introuvable' };
          }

          // Mock: Create transfer record
          const transfer: MoneyTransfer = {
            id: `transfer_${Date.now()}`,
            fromUserId: 'user_123',
            toUserId: friend.userId,
            toUserName: friend.name,
            amount,
            currencyName: 'Griffons',
            message,
            status: 'COMPLETED',
            createdAt: new Date().toISOString(),
          };

          set((state) => ({
            recentTransfers: [transfer, ...state.recentTransfers].slice(0, 20),
            isSendingMoney: false,
          }));

          return { success: true, transferId: transfer.id };
        } catch (error) {
          console.error('Failed to send money:', error);
          set({ isSendingMoney: false });
          return { success: false, error: 'Une erreur est survenue lors du transfert' };
        }
      },

      toggleLocationSharing: async (friendId, enabled) => {
        set({ isUpdatingLocation: true });
        try {
          await mockDelay(300);
          // In real implementation:
          // await api.patch(`/social/friends/${friendId}/location-sharing`, { enabled });

          set((state) => ({
            friends: state.friends.map((f) =>
              f.id === friendId ? { ...f, isLocationShared: enabled } : f
            ),
            isUpdatingLocation: false,
          }));
        } catch (error) {
          console.error('Failed to toggle location sharing:', error);
          set({ isUpdatingLocation: false });
          throw error;
        }
      },

      getFriendById: (friendId) => {
        return get().friends.find((f) => f.id === friendId);
      },

      searchUsers: async (query) => {
        await mockDelay(400);
        // In real implementation:
        // const response = await api.get('/social/search', { params: { q: query } });
        // return response.data;

        // Mock search results
        if (query.length < 2) return [];

        const mockUsers = [
          { id: 'user_301', name: 'Alice Moreau', username: 'alice_m', avatarUrl: undefined },
          { id: 'user_302', name: 'Hugo Laurent', username: 'hugo_l', avatarUrl: undefined },
          { id: 'user_303', name: 'Lea Fournier', username: 'lea_f', avatarUrl: undefined },
        ];

        return mockUsers.filter(
          (u) =>
            u.name.toLowerCase().includes(query.toLowerCase()) ||
            u.username.toLowerCase().includes(query.toLowerCase())
        );
      },

      cancelSentRequest: async (requestId) => {
        try {
          await mockDelay(300);
          // In real implementation:
          // await api.delete(`/social/requests/${requestId}`);

          set((state) => ({
            sentRequests: state.sentRequests.filter((r) => r.id !== requestId),
          }));
        } catch (error) {
          console.error('Failed to cancel sent request:', error);
          throw error;
        }
      },

      getFriendsAtFestival: () => {
        return get().friends.filter((f) => f.status === 'AT_FESTIVAL');
      },

      getOnlineFriends: () => {
        return get().friends.filter((f) => f.status === 'ONLINE' || f.status === 'AT_FESTIVAL');
      },
    }),
    {
      name: 'social-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        friends: state.friends,
        friendRequests: state.friendRequests,
        sentRequests: state.sentRequests,
        isLocationSharingEnabled: state.isLocationSharingEnabled,
        recentTransfers: state.recentTransfers,
      }),
    }
  )
);
