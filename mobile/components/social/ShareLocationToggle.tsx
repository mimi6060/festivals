import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Switch, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSocialStore } from '@/stores/socialStore';

interface ShareLocationToggleProps {
  friendId?: string;
  friendName?: string;
  isEnabled: boolean;
  onToggle?: (enabled: boolean) => void;
  showDescription?: boolean;
  compact?: boolean;
}

export default function ShareLocationToggle({
  friendId,
  friendName,
  isEnabled,
  onToggle,
  showDescription = true,
  compact = false,
}: ShareLocationToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);

  const { toggleLocationSharing, isLocationSharingEnabled, setLocationSharingEnabled, updateMyLocation } =
    useSocialStore();

  // Check location permission on mount
  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setHasLocationPermission(status === 'granted');
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setHasLocationPermission(granted);
    return granted;
  };

  const handleToggle = async (newValue: boolean) => {
    if (newValue && !hasLocationPermission) {
      // Request permission first
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert(
          'Permission requise',
          'Pour partager votre position, autorisez l\'acces a la localisation dans les parametres.',
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Parametres',
              onPress: () => {
                // Open app settings
                if (Platform.OS === 'ios') {
                  // iOS: Linking.openURL('app-settings:')
                }
              },
            },
          ]
        );
        return;
      }
    }

    setIsLoading(true);

    try {
      if (friendId) {
        // Toggle for specific friend
        await toggleLocationSharing(friendId, newValue);
        onToggle?.(newValue);
      } else {
        // Toggle global location sharing
        setLocationSharingEnabled(newValue);
        onToggle?.(newValue);

        if (newValue) {
          // Get and update location when enabled
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          updateMyLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      }
    } catch (error) {
      console.error('Failed to toggle location sharing:', error);
      Alert.alert('Erreur', 'Impossible de modifier le partage de position.');
    } finally {
      setIsLoading(false);
    }
  };

  if (compact) {
    return (
      <View className="flex-row items-center justify-between py-3">
        <View className="flex-row items-center flex-1">
          <View className="w-8 h-8 bg-primary/10 rounded-full items-center justify-center">
            <Ionicons name="location" size={16} color="#6366F1" />
          </View>
          <Text className="text-gray-900 font-medium ml-3">
            {friendId ? `Partager avec ${friendName || 'cet ami'}` : 'Partager ma position'}
          </Text>
        </View>
        {isLoading ? (
          <ActivityIndicator size="small" color="#6366F1" />
        ) : (
          <Switch
            value={isEnabled}
            onValueChange={handleToggle}
            trackColor={{ false: '#E5E7EB', true: '#A5B4FC' }}
            thumbColor={isEnabled ? '#6366F1' : '#F9FAFB'}
            ios_backgroundColor="#E5E7EB"
          />
        )}
      </View>
    );
  }

  return (
    <View className="bg-white rounded-xl p-4">
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center">
            <Ionicons name="location" size={20} color="#6366F1" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-gray-900 font-semibold">
              {friendId ? 'Partager ma position' : 'Partage de position'}
            </Text>
            {friendId && friendName && (
              <Text className="text-gray-500 text-sm">avec {friendName}</Text>
            )}
          </View>
        </View>
        {isLoading ? (
          <ActivityIndicator size="small" color="#6366F1" />
        ) : (
          <Switch
            value={isEnabled}
            onValueChange={handleToggle}
            trackColor={{ false: '#E5E7EB', true: '#A5B4FC' }}
            thumbColor={isEnabled ? '#6366F1' : '#F9FAFB'}
            ios_backgroundColor="#E5E7EB"
          />
        )}
      </View>

      {/* Description */}
      {showDescription && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <Text className="text-gray-500 text-sm">
            {isEnabled
              ? friendId
                ? `${friendName || 'Cet ami'} pourra voir votre position en temps reel pendant le festival.`
                : 'Vos amis autorises peuvent voir votre position en temps reel.'
              : friendId
                ? `Activez pour que ${friendName || 'cet ami'} puisse vous retrouver facilement.`
                : 'Activez pour permettre a vos amis de vous retrouver pendant le festival.'}
          </Text>
        </View>
      )}

      {/* Permission warning */}
      {hasLocationPermission === false && (
        <TouchableOpacity
          onPress={requestLocationPermission}
          className="mt-3 pt-3 border-t border-gray-100 flex-row items-center"
          activeOpacity={0.7}
        >
          <Ionicons name="warning" size={16} color="#F59E0B" />
          <Text className="text-yellow-600 text-sm ml-2 flex-1">
            Permission de localisation requise
          </Text>
          <Text className="text-primary text-sm font-medium">Activer</Text>
        </TouchableOpacity>
      )}

      {/* Status indicator when enabled */}
      {isEnabled && hasLocationPermission && (
        <View className="mt-3 pt-3 border-t border-gray-100 flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
          <Text className="text-green-600 text-sm">Position partagee en temps reel</Text>
        </View>
      )}
    </View>
  );
}

// Global location sharing toggle for settings
export function GlobalLocationToggle() {
  const { isLocationSharingEnabled, setLocationSharingEnabled } = useSocialStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    setIsLoading(true);
    try {
      if (enabled) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission refusee',
            'Activez la localisation dans les parametres pour partager votre position.'
          );
          setIsLoading(false);
          return;
        }
      }
      setLocationSharingEnabled(enabled);
    } catch (error) {
      console.error('Failed to toggle global location sharing:', error);
    }
    setIsLoading(false);
  };

  return (
    <View className="flex-row items-center justify-between py-3 px-4 bg-white rounded-xl">
      <View className="flex-row items-center flex-1">
        <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center">
          <Ionicons name="navigate" size={20} color="#3B82F6" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-gray-900 font-medium">Partage de position global</Text>
          <Text className="text-gray-500 text-xs">
            {isLocationSharingEnabled ? 'Active pour tous vos amis' : 'Desactive'}
          </Text>
        </View>
      </View>
      {isLoading ? (
        <ActivityIndicator size="small" color="#6366F1" />
      ) : (
        <Switch
          value={isLocationSharingEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: '#E5E7EB', true: '#A5B4FC' }}
          thumbColor={isLocationSharingEnabled ? '#6366F1' : '#F9FAFB'}
          ios_backgroundColor="#E5E7EB"
        />
      )}
    </View>
  );
}
