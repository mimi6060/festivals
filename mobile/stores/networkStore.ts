import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

interface NetworkState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  setOnline: (isOnline: boolean) => void;
  setSyncing: (isSyncing: boolean) => void;
  setPendingCount: (count: number) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
}));

// Initialize network listener
NetInfo.addEventListener((state) => {
  useNetworkStore.getState().setOnline(state.isConnected ?? false);
});
