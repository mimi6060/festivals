import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChatStore, Message } from '@/stores/chatStore';
import ChatBubble, { TypingIndicator } from '@/components/chat/ChatBubble';
import ChatInput from '@/components/chat/ChatInput';
import {
  ChatQuickActions,
  EscalationPrompt,
  RatingPrompt,
} from '@/components/chat/QuickActions';

// Mock festival ID - in real app, this would come from navigation params or global state
const FESTIVAL_ID = 'festival-123';

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [showEscalationPrompt, setShowEscalationPrompt] = useState(false);
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);

  const {
    currentConversation,
    messages,
    suggestedQuestions,
    isLoading,
    isSending,
    error,
    startConversation,
    sendMessage,
    escalateConversation,
    closeConversation,
    rateConversation,
    fetchSuggestions,
    clearChat,
  } = useChatStore();

  // Initialize conversation
  useEffect(() => {
    initChat();
    fetchSuggestions(FESTIVAL_ID);
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Show escalation prompt after multiple messages without resolution
  useEffect(() => {
    if (messages.length > 0 && messages.length % 6 === 0) {
      setShowEscalationPrompt(true);
    }
  }, [messages.length]);

  const initChat = async () => {
    try {
      await startConversation(FESTIVAL_ID);
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  const handleSend = async (message: string) => {
    try {
      setShowEscalationPrompt(false);
      await sendMessage(message);
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le message. Veuillez reessayer.');
    }
  };

  const handleEscalate = async () => {
    Alert.alert(
      'Parler a un agent',
      'Voulez-vous vraiment transferer cette conversation a un agent humain ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await escalateConversation('Demande utilisateur');
              setShowEscalationPrompt(false);
              Alert.alert(
                'Conversation transferee',
                'Un agent vous contactera prochainement.'
              );
            } catch (err) {
              Alert.alert('Erreur', 'Impossible de transferer la conversation.');
            }
          },
        },
      ]
    );
  };

  const handleClose = async () => {
    if (currentConversation?.status === 'ACTIVE') {
      Alert.alert(
        'Fermer la conversation',
        'Voulez-vous vraiment fermer cette conversation ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Fermer',
            style: 'destructive',
            onPress: async () => {
              try {
                await closeConversation();
                setShowRatingPrompt(true);
              } catch (err) {
                router.back();
              }
            },
          },
        ]
      );
    } else {
      router.back();
    }
  };

  const handleRate = async (rating: number) => {
    try {
      await rateConversation(rating);
      setShowRatingPrompt(false);
      Alert.alert('Merci !', 'Votre avis a ete enregistre.');
      clearChat();
      router.back();
    } catch (err) {
      setShowRatingPrompt(false);
      router.back();
    }
  };

  const handleSkipRating = () => {
    setShowRatingPrompt(false);
    clearChat();
    router.back();
  };

  const handleQuickAction = (question: string) => {
    handleSend(question);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <ChatBubble message={item} />
  );

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center p-8">
      <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-4">
        <Ionicons name="chatbubbles" size={40} color="#6366F1" />
      </View>
      <Text className="text-gray-900 text-lg font-semibold text-center">
        Assistant du Festival
      </Text>
      <Text className="text-gray-500 text-center mt-2">
        Posez vos questions sur le festival, les horaires, le paiement cashless, et plus encore.
      </Text>
    </View>
  );

  const isConversationEnded =
    currentConversation?.status === 'CLOSED' ||
    currentConversation?.status === 'ESCALATED';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View
        className="bg-white border-b border-gray-200 flex-row items-center px-4"
        style={{ paddingTop: insets.top }}
      >
        <TouchableOpacity
          onPress={handleClose}
          className="w-10 h-10 items-center justify-center -ml-2"
        >
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-lg font-semibold text-gray-900">
            Assistant
          </Text>
          {currentConversation?.status === 'ESCALATED' && (
            <Text className="text-xs text-yellow-600">En attente d'un agent</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Options',
              '',
              [
                {
                  text: 'Nouvelle conversation',
                  onPress: () => {
                    clearChat();
                    initChat();
                  },
                },
                {
                  text: 'Fermer la conversation',
                  onPress: handleClose,
                  style: 'destructive',
                },
                { text: 'Annuler', style: 'cancel' },
              ]
            );
          }}
          className="w-10 h-10 items-center justify-center -mr-2"
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Loading state */}
      {isLoading && messages.length === 0 && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366F1" />
          <Text className="text-gray-500 mt-4">Chargement...</Text>
        </View>
      )}

      {/* Error state */}
      {error && messages.length === 0 && (
        <View className="flex-1 items-center justify-center p-8">
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text className="text-gray-900 font-medium mt-4">{error}</Text>
          <TouchableOpacity
            onPress={initChat}
            className="mt-4 bg-primary rounded-lg px-6 py-3"
          >
            <Text className="text-white font-medium">Reessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages list */}
      {!isLoading && !error && (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            flexGrow: 1,
            paddingVertical: 16,
          }}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={
            <>
              {isSending && <TypingIndicator />}
              {showEscalationPrompt && !isConversationEnded && (
                <EscalationPrompt
                  onEscalate={handleEscalate}
                  onDismiss={() => setShowEscalationPrompt(false)}
                />
              )}
              {showRatingPrompt && (
                <RatingPrompt onRate={handleRate} onSkip={handleSkipRating} />
              )}
            </>
          }
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
        />
      )}

      {/* Quick actions (shown when no messages or at start) */}
      {messages.length <= 1 && !isLoading && !isConversationEnded && (
        <ChatQuickActions
          onAskHours={() => handleQuickAction('Quels sont les horaires du festival ?')}
          onAskCashless={() => handleQuickAction('Comment fonctionne le paiement cashless ?')}
          onAskRecharge={() => handleQuickAction('Ou puis-je recharger mon bracelet ?')}
          onAskRefund={() => handleQuickAction('Comment obtenir un remboursement ?')}
          onEscalate={handleEscalate}
        />
      )}

      {/* Input */}
      {!isConversationEnded && !showRatingPrompt && (
        <View style={{ paddingBottom: insets.bottom }}>
          <ChatInput
            onSend={handleSend}
            onSuggestionPress={handleQuickAction}
            suggestions={messages.length <= 3 ? suggestedQuestions : []}
            disabled={isLoading}
            isSending={isSending}
            placeholder="Posez votre question..."
          />
        </View>
      )}

      {/* Ended conversation banner */}
      {isConversationEnded && !showRatingPrompt && (
        <View
          className="bg-gray-100 p-4"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Text className="text-gray-600 text-center mb-3">
            {currentConversation?.status === 'ESCALATED'
              ? 'Un agent prendra en charge votre demande.'
              : 'Cette conversation est terminee.'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              clearChat();
              initChat();
            }}
            className="bg-primary rounded-xl py-3 items-center"
          >
            <Text className="text-white font-semibold">
              Nouvelle conversation
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
