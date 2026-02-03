import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationType =
  | 'ticket'
  | 'wallet'
  | 'lineup'
  | 'sos'
  | 'announcement'
  | 'general';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  // State
  pushToken: string | null;
  notifications: Notification[];

  // Computed
  unreadCount: number;

  // Actions
  setPushToken: (token: string | null) => void;
  addNotification: (notification: Notification) => void;
  setNotifications: (notifications: Notification[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      // Initial state
      pushToken: null,
      notifications: [],

      // Computed getter
      get unreadCount() {
        return get().notifications.filter(n => !n.read).length;
      },

      // Actions
      setPushToken: (token) => set({ pushToken: token }),

      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications],
        })),

      setNotifications: (notifications) => set({ notifications }),

      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),

      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'notification-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        pushToken: state.pushToken,
        notifications: state.notifications,
      }),
    }
  )
);

// Selector for unread count (more efficient for subscriptions)
export const selectUnreadCount = (state: NotificationState) =>
  state.notifications.filter((n) => !n.read).length;

// Selector for notifications grouped by date
export const selectNotificationsByDate = (state: NotificationState) => {
  const grouped: Record<string, Notification[]> = {};

  state.notifications.forEach((notification) => {
    const date = new Date(notification.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let key: string;

    if (isSameDay(date, today)) {
      key = "Aujourd'hui";
    } else if (isSameDay(date, yesterday)) {
      key = 'Hier';
    } else {
      key = date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(notification);
  });

  return grouped;
};

// Helper function
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}
