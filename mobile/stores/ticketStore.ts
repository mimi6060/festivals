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

// Mock data for demonstration
const mockTickets: Ticket[] = [
  {
    id: 'ticket-001',
    eventId: 'event-2026-summer',
    eventName: 'Festival des Griffons 2026',
    eventDate: '2026-07-15',
    eventEndDate: '2026-07-17',
    eventLocation: 'Parc des Expositions, Lyon',
    ticketType: 'WEEKEND_PASS',
    ticketTypeName: 'Pass Weekend',
    holderName: 'Jean Dupont',
    holderEmail: 'jean.dupont@email.com',
    status: 'VALID',
    qrCode: 'QR-GRIF-2026-WKD-001',
    ticketCode: 'GRIF-WKD-2026-001',
    purchaseDate: '2026-01-10',
    validFrom: '2026-07-15T08:00:00Z',
    validUntil: '2026-07-17T23:59:59Z',
    transferable: true,
    price: 149.99,
    currency: 'EUR',
  },
  {
    id: 'ticket-002',
    eventId: 'event-2026-summer',
    eventName: 'Festival des Griffons 2026',
    eventDate: '2026-07-15',
    eventEndDate: '2026-07-17',
    eventLocation: 'Parc des Expositions, Lyon',
    ticketType: 'CAMPING',
    ticketTypeName: 'Pass Camping',
    holderName: 'Jean Dupont',
    holderEmail: 'jean.dupont@email.com',
    status: 'VALID',
    qrCode: 'QR-GRIF-2026-CMP-002',
    ticketCode: 'GRIF-CMP-2026-002',
    purchaseDate: '2026-01-10',
    validFrom: '2026-07-14T14:00:00Z',
    validUntil: '2026-07-18T12:00:00Z',
    transferable: false,
    price: 50.00,
    currency: 'EUR',
  },
  {
    id: 'ticket-003',
    eventId: 'event-2025-winter',
    eventName: 'Winter Music Fest',
    eventDate: '2025-12-28',
    eventLocation: 'Zenith Paris',
    ticketType: 'VIP',
    ticketTypeName: 'VIP Access',
    holderName: 'Jean Dupont',
    holderEmail: 'jean.dupont@email.com',
    status: 'USED',
    qrCode: 'QR-WMF-2025-VIP-003',
    ticketCode: 'WMF-VIP-2025-003',
    purchaseDate: '2025-11-15',
    validFrom: '2025-12-28T18:00:00Z',
    validUntil: '2025-12-29T04:00:00Z',
    transferable: true,
    price: 299.99,
    currency: 'EUR',
  },
];

export const useTicketStore = create<TicketState>()(
  persist(
    (set, get) => ({
      tickets: mockTickets,
      isLoading: false,
      error: null,
      lastFetched: null,

      fetchTickets: async () => {
        set({ isLoading: true, error: null });

        try {
          // Simulate API call delay
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // In a real app, this would be an API call:
          // const response = await api.get('/tickets');
          // const tickets = response.data;

          set({
            tickets: mockTickets,
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
          // Simulate API call delay
          await new Promise((resolve) => setTimeout(resolve, 1500));

          const ticket = get().getTicketById(request.ticketId);

          if (!ticket) {
            throw new Error('Billet non trouvé');
          }

          if (!ticket.transferable) {
            throw new Error('Ce billet ne peut pas être transféré');
          }

          if (ticket.status !== 'VALID') {
            throw new Error('Seuls les billets valides peuvent être transférés');
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(request.recipientEmail)) {
            throw new Error('Adresse email invalide');
          }

          // In a real app, this would be an API call:
          // await api.post('/tickets/transfer', request);

          // Update local state - mark ticket as transferred
          set((state) => ({
            tickets: state.tickets.map((t) =>
              t.id === request.ticketId
                ? { ...t, status: 'TRANSFERRED' as TicketStatus }
                : t
            ),
            isLoading: false,
          }));

          return { success: true };
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : 'Erreur lors du transfert. Veuillez réessayer.';

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
