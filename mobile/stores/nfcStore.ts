import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nfcManager, NFCTag, NFCError, isNFCSupported, isNFCEnabled } from '@/lib/nfc';

export type NFCTagStatus = 'active' | 'inactive' | 'lost' | 'pending';

export interface LinkedNFCTag {
  uid: string;
  linkedAt: string;
  status: NFCTagStatus;
  walletId?: string;
  lastUsedAt?: string;
  nickname?: string;
}

export interface NFCState {
  // State
  linkedTag: LinkedNFCTag | null;
  isScanning: boolean;
  isNFCSupported: boolean | null;
  isNFCEnabled: boolean | null;
  scanError: NFCError | null;
  lastScannedTag: NFCTag | null;

  // Actions
  setLinkedTag: (tag: LinkedNFCTag | null) => void;
  setIsScanning: (isScanning: boolean) => void;
  setScanError: (error: NFCError | null) => void;
  setLastScannedTag: (tag: NFCTag | null) => void;

  // NFC Operations
  checkNFCAvailability: () => Promise<{ supported: boolean; enabled: boolean }>;
  activateTag: (uid: string, walletId?: string) => Promise<void>;
  deactivateTag: () => Promise<void>;
  checkTagStatus: () => Promise<NFCTagStatus>;
  reportLost: () => Promise<void>;
  transferToNewTag: (newUid: string) => Promise<void>;
  scanForTag: () => Promise<NFCTag>;
  setTagNickname: (nickname: string) => void;
  updateLastUsed: () => void;

  // API Actions (mock implementations)
  fetchLinkedTag: () => Promise<void>;
  linkTagToWallet: (uid: string, walletId: string) => Promise<void>;
  unlinkTagFromWallet: () => Promise<void>;
}

// Mock API delay
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useNFCStore = create<NFCState>()(
  persist(
    (set, get) => ({
      // Initial State
      linkedTag: null,
      isScanning: false,
      isNFCSupported: null,
      isNFCEnabled: null,
      scanError: null,
      lastScannedTag: null,

      // Basic Actions
      setLinkedTag: (tag) => set({ linkedTag: tag }),
      setIsScanning: (isScanning) => set({ isScanning }),
      setScanError: (error) => set({ scanError: error }),
      setLastScannedTag: (tag) => set({ lastScannedTag: tag }),

      // Check NFC availability on device
      checkNFCAvailability: async () => {
        try {
          const supported = await isNFCSupported();
          const enabled = supported ? await isNFCEnabled() : false;

          set({
            isNFCSupported: supported,
            isNFCEnabled: enabled,
          });

          return { supported, enabled };
        } catch (error) {
          console.error('Failed to check NFC availability:', error);
          set({
            isNFCSupported: false,
            isNFCEnabled: false,
          });
          return { supported: false, enabled: false };
        }
      },

      // Activate/link a new NFC tag
      activateTag: async (uid: string, walletId?: string) => {
        try {
          // In production, this would call the API to link the tag
          await mockDelay(500);

          const newTag: LinkedNFCTag = {
            uid,
            linkedAt: new Date().toISOString(),
            status: 'active',
            walletId,
            lastUsedAt: new Date().toISOString(),
          };

          set({
            linkedTag: newTag,
            scanError: null,
          });
        } catch (error) {
          console.error('Failed to activate tag:', error);
          throw error;
        }
      },

      // Deactivate/unlink the current NFC tag
      deactivateTag: async () => {
        const { linkedTag } = get();

        if (!linkedTag) {
          return;
        }

        try {
          // In production, this would call the API to deactivate the tag
          await mockDelay(500);

          set({
            linkedTag: {
              ...linkedTag,
              status: 'inactive',
            },
          });

          // After a brief period, remove the tag entirely
          setTimeout(() => {
            set({ linkedTag: null });
          }, 2000);
        } catch (error) {
          console.error('Failed to deactivate tag:', error);
          throw error;
        }
      },

      // Check the current status of the linked tag
      checkTagStatus: async (): Promise<NFCTagStatus> => {
        const { linkedTag } = get();

        if (!linkedTag) {
          return 'inactive';
        }

        try {
          // In production, this would call the API to check tag status
          await mockDelay(300);

          // Mock: tag is always active unless marked otherwise
          return linkedTag.status;
        } catch (error) {
          console.error('Failed to check tag status:', error);
          return 'inactive';
        }
      },

      // Report the tag as lost
      reportLost: async () => {
        const { linkedTag } = get();

        if (!linkedTag) {
          throw new Error('No tag linked');
        }

        try {
          // In production, this would call the API to report the tag as lost
          await mockDelay(500);

          set({
            linkedTag: {
              ...linkedTag,
              status: 'lost',
            },
          });
        } catch (error) {
          console.error('Failed to report tag as lost:', error);
          throw error;
        }
      },

      // Transfer wallet link to a new tag
      transferToNewTag: async (newUid: string) => {
        const { linkedTag } = get();

        if (!linkedTag) {
          throw new Error('No tag linked');
        }

        try {
          // In production, this would:
          // 1. Deactivate the old tag
          // 2. Link the new tag to the wallet
          await mockDelay(800);

          const newTag: LinkedNFCTag = {
            uid: newUid,
            linkedAt: new Date().toISOString(),
            status: 'active',
            walletId: linkedTag.walletId,
            lastUsedAt: new Date().toISOString(),
            nickname: linkedTag.nickname,
          };

          set({
            linkedTag: newTag,
            scanError: null,
          });
        } catch (error) {
          console.error('Failed to transfer to new tag:', error);
          throw error;
        }
      },

      // Scan for an NFC tag
      scanForTag: async (): Promise<NFCTag> => {
        set({ isScanning: true, scanError: null });

        try {
          const tag = await nfcManager.readTag(
            'Approchez votre bracelet NFC',
            30000 // 30 second timeout
          );

          set({
            isScanning: false,
            lastScannedTag: tag,
          });

          return tag;
        } catch (error) {
          const nfcError = error as NFCError;
          set({
            isScanning: false,
            scanError: nfcError,
          });
          throw nfcError;
        }
      },

      // Set a nickname for the tag
      setTagNickname: (nickname: string) => {
        const { linkedTag } = get();

        if (linkedTag) {
          set({
            linkedTag: {
              ...linkedTag,
              nickname,
            },
          });
        }
      },

      // Update the last used timestamp
      updateLastUsed: () => {
        const { linkedTag } = get();

        if (linkedTag) {
          set({
            linkedTag: {
              ...linkedTag,
              lastUsedAt: new Date().toISOString(),
            },
          });
        }
      },

      // Fetch linked tag from server
      fetchLinkedTag: async () => {
        try {
          // In production, this would fetch from the API
          await mockDelay(500);

          // Mock: return stored tag or null
          // The actual data comes from persistence
        } catch (error) {
          console.error('Failed to fetch linked tag:', error);
          throw error;
        }
      },

      // Link tag to wallet via API
      linkTagToWallet: async (uid: string, walletId: string) => {
        try {
          // In production, this would call:
          // await api.post('/nfc/link', { uid, walletId });
          await mockDelay(800);

          const newTag: LinkedNFCTag = {
            uid,
            linkedAt: new Date().toISOString(),
            status: 'active',
            walletId,
            lastUsedAt: new Date().toISOString(),
          };

          set({
            linkedTag: newTag,
            scanError: null,
          });
        } catch (error) {
          console.error('Failed to link tag to wallet:', error);
          throw error;
        }
      },

      // Unlink tag from wallet via API
      unlinkTagFromWallet: async () => {
        const { linkedTag } = get();

        if (!linkedTag) {
          return;
        }

        try {
          // In production, this would call:
          // await api.post('/nfc/unlink', { uid: linkedTag.uid });
          await mockDelay(500);

          set({ linkedTag: null });
        } catch (error) {
          console.error('Failed to unlink tag from wallet:', error);
          throw error;
        }
      },
    }),
    {
      name: 'nfc-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        linkedTag: state.linkedTag,
      }),
    }
  )
);
