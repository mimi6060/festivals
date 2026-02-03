import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TicketStatus = 'VALID' | 'USED' | 'CANCELLED' | 'TRANSFERRED' | 'EXPIRED';
export type TicketType = 'DAY_PASS' | 'WEEKEND_PASS' | 'VIP' | 'CAMPING' | 'EARLY_BIRD';

export interface Ticket {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  eventEndDate?: string;
  eventLocation: string;
  ticketType: TicketType;
  ticketTypeName: string;
  holderName: string;
  holderEmail: string;
  status: TicketStatus;
  qrCode: string;
  ticketCode: string;
  purchaseDate: string;
  validFrom: string;
  validUntil: string;
  transferable: boolean;
  price: number;
  currency: string;
}

export interface TransferRequest {
  ticketId: string;
  recipientEmail: string;
}

interface TicketState {
  tickets: Ticket[];
  isLoading: boolean;
  error: string | null;
  lastFetched: string | null;

  // Actions
  fetchTickets: () => Promise<void>;
  getTicketById: (id: string) => Ticket | undefined;
  transferTicket: (request: TransferRequest) => Promise<{ success: boolean; error?: string }>;
  setTickets: (tickets: Ticket[]) => void;
  updateTicketStatus: (ticketId: string, status: TicketStatus) => void;
  clearError: () => void;
}

export const useTicketStore = create<TicketState>()(
  persist(
    (set, get) => ({
      // Initial state - no mock data in production
      tickets: [],
      isLoading: false,
      error: null,
      lastFetched: null,

      fetchTickets: async () => {
        set({ isLoading: true, error: null });

        try {
          // TODO: Replace with actual API call
          // const response = await api.get('/tickets');
          // set({
          //   tickets: response.data,
          //   isLoading: false,
          //   lastFetched: new Date().toISOString(),
          // });

          // For now, just mark loading complete (empty state until API is connected)
          set({
            isLoading: false,
            lastFetched: new Date().toISOString(),
          });
        } catch (error) {
          set({
            isLoading: false,
            error: 'Impossible de charger les billets. Veuillez réessayer.',
          });
        }
      },

      getTicketById: (id: string) => {
        return get().tickets.find((ticket) => ticket.id === id);
      },

      transferTicket: async (request: TransferRequest) => {
        set({ isLoading: true, error: null });

        try {
          const ticket = get().getTicketById(request.ticketId);

          if (!ticket) {
            throw new Error('Billet non trouve');
          }

          if (!ticket.transferable) {
            throw new Error('Ce billet ne peut pas etre transfere');
          }

          if (ticket.status !== 'VALID') {
            throw new Error('Seuls les billets valides peuvent etre transferes');
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(request.recipientEmail)) {
            throw new Error('Adresse email invalide');
          }

          // TODO: Replace with actual API call
          // const response = await api.post('/tickets/transfer', request);
          // Update local state after successful API response

          // For now, throw error since API is not connected
          throw new Error('Le transfert de billet necessite une connexion API');
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : 'Erreur lors du transfert. Veuillez reessayer.';

          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      setTickets: (tickets: Ticket[]) => set({ tickets }),

      updateTicketStatus: (ticketId: string, status: TicketStatus) => {
        set((state) => ({
          tickets: state.tickets.map((ticket) =>
            ticket.id === ticketId ? { ...ticket, status } : ticket
          ),
        }));
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'ticket-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
