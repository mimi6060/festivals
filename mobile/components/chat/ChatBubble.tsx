import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '@/stores/chatStore';

interface ChatBubbleProps {
  message: Message;
  isTyping?: boolean;
}

export default function ChatBubble({ message, isTyping = false }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Format time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // System message style
  if (isSystem) {
    return (
      <View className="flex-row justify-center my-2 px-4">
        <View className="bg-gray-100 rounded-full px-4 py-2 flex-row items-center">
          <Ionicons name="information-circle" size={16} color="#6B7280" />
          <Text className="text-gray-600 text-sm ml-2">{message.content}</Text>
        </View>
      </View>
    );
  }

  // Typing indicator
  if (isTyping) {
    return (
      <View className="flex-row justify-start mb-3 px-4">
        <View className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%]">
          <View className="flex-row items-center space-x-1">
            <View className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
            <View className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
            <View className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      className={`flex-row mb-3 px-4 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* Avatar for assistant */}
      {!isUser && (
        <View className="w-8 h-8 rounded-full bg-primary items-center justify-center mr-2 mt-1">
          <Ionicons name="chatbubble-ellipses" size={16} color="white" />
        </View>
      )}

      <View className="max-w-[75%]">
        {/* Message bubble */}
        <View
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-primary rounded-br-sm'
              : 'bg-gray-100 rounded-bl-sm'
          }`}
        >
          <Text
            className={`text-base ${isUser ? 'text-white' : 'text-gray-900'}`}
          >
            {message.content}
          </Text>
        </View>

        {/* Timestamp */}
        <Text
          className={`text-xs text-gray-400 mt-1 ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {formatTime(message.createdAt)}
        </Text>
      </View>

      {/* Avatar placeholder for user (for alignment) */}
      {isUser && <View className="w-2" />}
    </View>
  );
}

// Typing indicator component
export function TypingIndicator() {
  return (
    <View className="flex-row justify-start mb-3 px-4">
      <View className="w-8 h-8 rounded-full bg-primary items-center justify-center mr-2 mt-1">
        <Ionicons name="chatbubble-ellipses" size={16} color="white" />
      </View>
      <View className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <View className="flex-row items-center space-x-1">
          <TypingDot delay={0} />
          <TypingDot delay={150} />
          <TypingDot delay={300} />
        </View>
      </View>
    </View>
  );
}

// Animated typing dot
function TypingDot({ delay }: { delay: number }) {
  const [opacity, setOpacity] = React.useState(0.3);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setOpacity((prev) => (prev === 0.3 ? 1 : 0.3));
    }, 600);

    const timeout = setTimeout(() => {
      setOpacity(1);
    }, delay);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [delay]);

  return (
    <View
      className="w-2 h-2 bg-gray-400 rounded-full mx-0.5"
      style={{ opacity }}
    />
  );
}
