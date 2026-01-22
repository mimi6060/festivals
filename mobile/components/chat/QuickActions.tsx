import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QuickAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  action: () => void;
  color?: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
  title?: string;
  horizontal?: boolean;
}

export default function QuickActions({
  actions,
  title,
  horizontal = true,
}: QuickActionsProps) {
  if (horizontal) {
    return (
      <View className="py-3">
        {title && (
          <Text className="text-xs text-gray-500 mb-2 px-4 uppercase tracking-wide">
            {title}
          </Text>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {actions.map((action) => (
            <TouchableOpacity
              key={action.id}
              onPress={action.action}
              className="flex-row items-center bg-white rounded-full px-4 py-2 mr-2 border border-gray-200"
              activeOpacity={0.7}
            >
              <Ionicons
                name={action.icon}
                size={18}
                color={action.color || '#6366F1'}
              />
              <Text className="text-gray-700 text-sm ml-2 font-medium">
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="p-4">
      {title && (
        <Text className="text-xs text-gray-500 mb-3 uppercase tracking-wide">
          {title}
        </Text>
      )}
      <View className="flex-row flex-wrap">
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            onPress={action.action}
            className="w-1/2 p-1"
            activeOpacity={0.7}
          >
            <View className="bg-white rounded-xl p-4 border border-gray-200 flex-row items-center">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: `${action.color || '#6366F1'}20` }}
              >
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={action.color || '#6366F1'}
                />
              </View>
              <Text className="text-gray-700 text-sm font-medium flex-1">
                {action.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Predefined quick actions for chat
export function ChatQuickActions({
  onAskHours,
  onAskCashless,
  onAskRecharge,
  onAskRefund,
  onEscalate,
}: {
  onAskHours?: () => void;
  onAskCashless?: () => void;
  onAskRecharge?: () => void;
  onAskRefund?: () => void;
  onEscalate?: () => void;
}) {
  const actions: QuickAction[] = [
    {
      id: 'hours',
      label: 'Horaires',
      icon: 'time-outline',
      action: onAskHours || (() => {}),
      color: '#10B981',
    },
    {
      id: 'cashless',
      label: 'Cashless',
      icon: 'card-outline',
      action: onAskCashless || (() => {}),
      color: '#6366F1',
    },
    {
      id: 'recharge',
      label: 'Recharger',
      icon: 'wallet-outline',
      action: onAskRecharge || (() => {}),
      color: '#F59E0B',
    },
    {
      id: 'refund',
      label: 'Remboursement',
      icon: 'cash-outline',
      action: onAskRefund || (() => {}),
      color: '#EF4444',
    },
  ];

  return (
    <View>
      <QuickActions actions={actions} title="Actions rapides" horizontal />
      {onEscalate && (
        <View className="px-4 pb-2">
          <TouchableOpacity
            onPress={onEscalate}
            className="flex-row items-center justify-center py-3"
            activeOpacity={0.7}
          >
            <Ionicons name="person" size={16} color="#6B7280" />
            <Text className="text-gray-500 text-sm ml-2">
              Parler a un agent
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Floating quick action button
interface FloatingActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label?: string;
  color?: string;
  position?: 'left' | 'right';
}

export function FloatingQuickAction({
  icon,
  onPress,
  label,
  color = '#6366F1',
  position = 'right',
}: FloatingActionProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`absolute bottom-24 ${
        position === 'right' ? 'right-4' : 'left-4'
      }`}
      activeOpacity={0.7}
    >
      <View
        className="flex-row items-center rounded-full px-4 py-3 shadow-lg"
        style={{ backgroundColor: color }}
      >
        <Ionicons name={icon} size={20} color="white" />
        {label && (
          <Text className="text-white font-medium ml-2">{label}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Escalation prompt component
interface EscalationPromptProps {
  onEscalate: () => void;
  onDismiss: () => void;
  message?: string;
}

export function EscalationPrompt({
  onEscalate,
  onDismiss,
  message = "Vous avez encore des questions ?",
}: EscalationPromptProps) {
  return (
    <View className="mx-4 my-2 bg-blue-50 rounded-xl p-4">
      <View className="flex-row items-start">
        <Ionicons name="information-circle" size={24} color="#3B82F6" />
        <View className="flex-1 ml-3">
          <Text className="text-blue-900 font-medium">{message}</Text>
          <Text className="text-blue-700 text-sm mt-1">
            Un agent humain peut vous aider si besoin.
          </Text>
          <View className="flex-row mt-3 space-x-2">
            <TouchableOpacity
              onPress={onEscalate}
              className="bg-blue-600 rounded-lg px-4 py-2"
              activeOpacity={0.7}
            >
              <Text className="text-white font-medium text-sm">
                Parler a un agent
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDismiss}
              className="bg-white rounded-lg px-4 py-2 border border-blue-200"
              activeOpacity={0.7}
            >
              <Text className="text-blue-700 font-medium text-sm">
                Non merci
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// Rating prompt after conversation ends
interface RatingPromptProps {
  onRate: (rating: number) => void;
  onSkip: () => void;
}

export function RatingPrompt({ onRate, onSkip }: RatingPromptProps) {
  const [selectedRating, setSelectedRating] = React.useState<number | null>(null);

  const handleSubmit = () => {
    if (selectedRating) {
      onRate(selectedRating);
    }
  };

  return (
    <View className="mx-4 my-2 bg-gray-50 rounded-xl p-4">
      <Text className="text-gray-900 font-medium text-center mb-3">
        Comment evaluez-vous cette conversation ?
      </Text>
      <View className="flex-row justify-center space-x-2 mb-4">
        {[1, 2, 3, 4, 5].map((rating) => (
          <TouchableOpacity
            key={rating}
            onPress={() => setSelectedRating(rating)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={selectedRating && selectedRating >= rating ? 'star' : 'star-outline'}
              size={32}
              color={selectedRating && selectedRating >= rating ? '#F59E0B' : '#D1D5DB'}
            />
          </TouchableOpacity>
        ))}
      </View>
      <View className="flex-row justify-center space-x-3">
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!selectedRating}
          className={`rounded-lg px-6 py-2 ${
            selectedRating ? 'bg-primary' : 'bg-gray-200'
          }`}
          activeOpacity={0.7}
        >
          <Text className={`font-medium ${selectedRating ? 'text-white' : 'text-gray-400'}`}>
            Envoyer
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSkip}
          className="rounded-lg px-6 py-2"
          activeOpacity={0.7}
        >
          <Text className="text-gray-500 font-medium">Passer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
