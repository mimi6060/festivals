import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  festivalId: string;
  userId: string;
  status: 'ACTIVE' | 'CLOSED' | 'ESCALATED';
  messageCount: number;
  lastActivity: string;
  createdAt: string;
  messages: Message[];
}

interface ChatState {
  // State
  currentConversation: Conversation | null;
  messages: Message[];
  suggestedQuestions: string[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  // Actions
  setCurrentConversation: (conversation: Conversation | null) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setSuggestedQuestions: (questions: string[]) => void;
  setLoading: (loading: boolean) => void;
  setSending: (sending: boolean) => void;
  setError: (error: string | null) => void;
  clearChat: () => void;

  // API Actions
  startConversation: (festivalId: string) => Promise<Conversation>;
  sendMessage: (message: string) => Promise<Message>;
  loadConversation: (conversationId: string) => Promise<void>;
  escalateConversation: (reason?: string) => Promise<void>;
  closeConversation: () => Promise<void>;
  rateConversation: (rating: number, feedback?: string) => Promise<void>;
  fetchSuggestions: (festivalId: string) => Promise<void>;
}

// Mock API delay
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock AI responses
const mockResponses = [
  "Bien sur ! Je suis la pour vous aider. Les horaires du festival sont de 14h a 2h du matin chaque jour. Les scenes principales ouvrent a 16h.",
  "Le paiement cashless fonctionne avec votre bracelet NFC. Vous pouvez le recharger en ligne ou aux bornes presentes sur le site. Votre solde est debite automatiquement lors de vos achats.",
  "Pour recharger votre bracelet, vous pouvez utiliser l'application mobile, les bornes de recharge situees a chaque entree, ou les points de recharge pres des bars principaux.",
  "Oui, nous avons des consignes securisees pres de l'entree principale. Le tarif est de 5 euros pour la journee. Vous pouvez y deposer sacs et objets de valeur.",
  "Pour obtenir un remboursement de votre solde restant, rendez-vous sur l'application dans les 30 jours suivant le festival. Les remboursements sont traites sous 5 jours ouvrables.",
  "Je comprends votre question. Laissez-moi vous aider avec ca. Les toilettes sont situees pres de chaque scene et sont accessibles aux personnes a mobilite reduite.",
];

// Generate mock conversation ID
const generateId = () => `conv-${Date.now()}-${Math.random().toString(36).substring(7)}`;

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial State
      currentConversation: null,
      messages: [],
      suggestedQuestions: [
        "Quels sont les horaires du festival ?",
        "Comment fonctionne le paiement cashless ?",
        "Ou puis-je recharger mon bracelet ?",
        "Y a-t-il des consignes pour les objets ?",
        "Comment obtenir un remboursement ?",
      ],
      isLoading: false,
      isSending: false,
      error: null,

      // Basic Actions
      setCurrentConversation: (conversation) => set({ currentConversation: conversation }),
      addMessage: (message) => set((state) => ({
        messages: [...state.messages, message],
      })),
      setMessages: (messages) => set({ messages }),
      setSuggestedQuestions: (questions) => set({ suggestedQuestions: questions }),
      setLoading: (loading) => set({ isLoading: loading }),
      setSending: (sending) => set({ isSending: sending }),
      setError: (error) => set({ error }),
      clearChat: () => set({
        currentConversation: null,
        messages: [],
        error: null,
      }),

      // API Actions
      startConversation: async (festivalId: string) => {
        set({ isLoading: true, error: null });
        try {
          await mockDelay(500);

          // Check if there's an existing conversation
          const existing = get().currentConversation;
          if (existing && existing.festivalId === festivalId && existing.status === 'ACTIVE') {
            set({ isLoading: false });
            return existing;
          }

          // In real implementation:
          // const response = await api.post('/chat/start', { festivalId });
          // return response.data;

          const now = new Date().toISOString();
          const welcomeMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: "Bonjour ! Je suis l'assistant virtuel du festival. Comment puis-je vous aider aujourd'hui ?",
            createdAt: now,
          };

          const conversation: Conversation = {
            id: generateId(),
            festivalId,
            userId: 'user-123',
            status: 'ACTIVE',
            messageCount: 1,
            lastActivity: now,
            createdAt: now,
            messages: [welcomeMessage],
          };

          set({
            currentConversation: conversation,
            messages: [welcomeMessage],
            isLoading: false,
          });

          return conversation;
        } catch (error) {
          console.error('Failed to start conversation:', error);
          set({ error: 'Impossible de demarrer la conversation', isLoading: false });
          throw error;
        }
      },

      sendMessage: async (content: string) => {
        const { currentConversation, messages } = get();
        if (!currentConversation) {
          throw new Error('No active conversation');
        }

        set({ isSending: true, error: null });

        try {
          // Add user message immediately
          const userMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content,
            createdAt: new Date().toISOString(),
          };

          set((state) => ({
            messages: [...state.messages, userMessage],
          }));

          // Simulate API call
          await mockDelay(1000 + Math.random() * 1000);

          // In real implementation:
          // const response = await api.post(`/chat/${currentConversation.id}/message`, { message: content });
          // return response.data.response;

          // Generate mock AI response
          const aiContent = mockResponses[Math.floor(Math.random() * mockResponses.length)];
          const aiMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: aiContent,
            createdAt: new Date().toISOString(),
          };

          set((state) => ({
            messages: [...state.messages, aiMessage],
            currentConversation: state.currentConversation
              ? {
                  ...state.currentConversation,
                  messageCount: state.currentConversation.messageCount + 2,
                  lastActivity: new Date().toISOString(),
                }
              : null,
            isSending: false,
          }));

          return aiMessage;
        } catch (error) {
          console.error('Failed to send message:', error);
          set({ error: 'Impossible d\'envoyer le message', isSending: false });
          throw error;
        }
      },

      loadConversation: async (conversationId: string) => {
        set({ isLoading: true, error: null });
        try {
          await mockDelay(500);

          // In real implementation:
          // const response = await api.get(`/chat/${conversationId}`);
          // const conversation = response.data;

          // For mock, we'll just use the current conversation
          const current = get().currentConversation;
          if (current && current.id === conversationId) {
            set({ isLoading: false });
            return;
          }

          set({ isLoading: false });
        } catch (error) {
          console.error('Failed to load conversation:', error);
          set({ error: 'Impossible de charger la conversation', isLoading: false });
          throw error;
        }
      },

      escalateConversation: async (reason?: string) => {
        const { currentConversation } = get();
        if (!currentConversation) return;

        set({ isLoading: true, error: null });
        try {
          await mockDelay(500);

          // In real implementation:
          // await api.post(`/chat/${currentConversation.id}/escalate`, { reason });

          const systemMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'system',
            content: 'Votre conversation a ete transferee a un agent humain. Vous serez contacte prochainement.',
            createdAt: new Date().toISOString(),
          };

          set((state) => ({
            messages: [...state.messages, systemMessage],
            currentConversation: state.currentConversation
              ? { ...state.currentConversation, status: 'ESCALATED' }
              : null,
            isLoading: false,
          }));
        } catch (error) {
          console.error('Failed to escalate conversation:', error);
          set({ error: 'Impossible de transferer la conversation', isLoading: false });
          throw error;
        }
      },

      closeConversation: async () => {
        const { currentConversation } = get();
        if (!currentConversation) return;

        set({ isLoading: true, error: null });
        try {
          await mockDelay(300);

          // In real implementation:
          // await api.post(`/chat/${currentConversation.id}/close`);

          set((state) => ({
            currentConversation: state.currentConversation
              ? { ...state.currentConversation, status: 'CLOSED' }
              : null,
            isLoading: false,
          }));
        } catch (error) {
          console.error('Failed to close conversation:', error);
          set({ error: 'Impossible de fermer la conversation', isLoading: false });
          throw error;
        }
      },

      rateConversation: async (rating: number, feedback?: string) => {
        const { currentConversation } = get();
        if (!currentConversation) return;

        set({ isLoading: true, error: null });
        try {
          await mockDelay(300);

          // In real implementation:
          // await api.post(`/chat/${currentConversation.id}/rate`, { rating, feedback });

          set({ isLoading: false });
        } catch (error) {
          console.error('Failed to rate conversation:', error);
          set({ error: 'Impossible d\'envoyer votre avis', isLoading: false });
          throw error;
        }
      },

      fetchSuggestions: async (festivalId: string) => {
        try {
          await mockDelay(300);

          // In real implementation:
          // const response = await api.get(`/chat/suggestions/${festivalId}`);
          // set({ suggestedQuestions: response.data });

          // Mock suggestions
          set({
            suggestedQuestions: [
              "Quels sont les horaires du festival ?",
              "Comment fonctionne le paiement cashless ?",
              "Ou puis-je recharger mon bracelet ?",
              "Y a-t-il des consignes pour les objets ?",
              "Comment obtenir un remboursement ?",
            ],
          });
        } catch (error) {
          console.error('Failed to fetch suggestions:', error);
        }
      },
    }),
    {
      name: 'chat-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentConversation: state.currentConversation,
        messages: state.messages,
      }),
    }
  )
);
