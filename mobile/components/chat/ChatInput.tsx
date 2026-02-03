import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Keyboard,
  ActivityIndicator,
  ScrollView,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ChatInputProps {
  onSend: (message: string) => void;
  onSuggestionPress?: (suggestion: string) => void;
  suggestions?: string[];
  disabled?: boolean;
  isSending?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  onSuggestionPress,
  suggestions = [],
  disabled = false,
  isSending = false,
  placeholder = "Ecrivez votre message...",
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);

  const handleSend = () => {
    if (message.trim() && !disabled && !isSending) {
      onSend(message.trim());
      setMessage('');
      setShowSuggestions(false);
      Keyboard.dismiss();
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    if (onSuggestionPress) {
      onSuggestionPress(suggestion);
    } else {
      onSend(suggestion);
    }
    setShowSuggestions(false);
  };

  const handleFocus = () => {
    // Keep suggestions visible when focused
  };

  const handleBlur = () => {
    // Optionally hide suggestions after a delay
  };

  return (
    <View className="bg-white border-t border-gray-200">
      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && message.length === 0 && (
        <View className="px-4 py-3 border-b border-gray-100">
          <Text className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
            Questions suggerees
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row"
          >
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleSuggestionPress(suggestion)}
                disabled={disabled || isSending}
                className="bg-gray-100 rounded-full px-4 py-2 mr-2"
                activeOpacity={0.7}
              >
                <Text className="text-gray-700 text-sm">{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input area */}
      <View className="flex-row items-end p-3 space-x-2">
        {/* Text input */}
        <View className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 min-h-[44px] max-h-[120px]">
          <TextInput
            value={message}
            onChangeText={setMessage}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            editable={!disabled && !isSending}
            className="text-base text-gray-900 leading-5"
            style={{ maxHeight: 100 }}
          />
        </View>

        {/* Send button */}
        <TouchableOpacity
          onPress={handleSend}
          disabled={!message.trim() || disabled || isSending}
          className={`w-11 h-11 rounded-full items-center justify-center ${
            message.trim() && !disabled && !isSending
              ? 'bg-primary'
              : 'bg-gray-200'
          }`}
          activeOpacity={0.7}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons
              name="send"
              size={20}
              color={message.trim() && !disabled ? 'white' : '#9CA3AF'}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Quick action input variant with icons
interface QuickActionInputProps {
  onSend: (message: string) => void;
  onAttach?: () => void;
  onVoice?: () => void;
  disabled?: boolean;
  isSending?: boolean;
  placeholder?: string;
}

export function QuickActionInput({
  onSend,
  onAttach,
  onVoice,
  disabled = false,
  isSending = false,
  placeholder = "Ecrivez votre message...",
}: QuickActionInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled && !isSending) {
      onSend(message.trim());
      setMessage('');
      Keyboard.dismiss();
    }
  };

  return (
    <View className="bg-white border-t border-gray-200">
      <View className="flex-row items-end p-3 space-x-2">
        {/* Attach button */}
        {onAttach && (
          <TouchableOpacity
            onPress={onAttach}
            disabled={disabled}
            className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center"
            activeOpacity={0.7}
          >
            <Ionicons name="attach" size={22} color="#6B7280" />
          </TouchableOpacity>
        )}

        {/* Text input */}
        <View className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 min-h-[44px] max-h-[120px]">
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            editable={!disabled && !isSending}
            className="text-base text-gray-900 leading-5"
            style={{ maxHeight: 100 }}
          />
        </View>

        {/* Voice/Send button */}
        {message.trim() ? (
          <TouchableOpacity
            onPress={handleSend}
            disabled={disabled || isSending}
            className="w-11 h-11 rounded-full bg-primary items-center justify-center"
            activeOpacity={0.7}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        ) : onVoice ? (
          <TouchableOpacity
            onPress={onVoice}
            disabled={disabled}
            className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center"
            activeOpacity={0.7}
          >
            <Ionicons name="mic" size={22} color="#6B7280" />
          </TouchableOpacity>
        ) : (
          <View className="w-11 h-11 rounded-full bg-gray-200 items-center justify-center">
            <Ionicons name="send" size={20} color="#9CA3AF" />
          </View>
        )}
      </View>
    </View>
  );
}
