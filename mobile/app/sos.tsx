import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/stores/authStore';
import { useFestivalStore } from '@/stores/festivalStore';
import {
  getCurrentLocation,
  requestLocationPermissions,
  formatCoordinates,
  LocationCoordinates,
} from '@/lib/location';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';
const SOS_COOLDOWN_KEY = 'sos-last-sent';
const SOS_COOLDOWN_MINUTES = 5;

type SOSType = 'SOS' | 'MEDICAL' | 'THEFT' | 'LOST_CHILD' | 'OTHER';

interface SOSOption {
  type: SOSType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
}

const sosOptions: SOSOption[] = [
  {
    type: 'SOS',
    label: 'Urgence',
    icon: 'warning',
    color: '#EF4444',
    description: 'Besoin d\'aide immediate',
  },
  {
    type: 'MEDICAL',
    label: 'Medical',
    icon: 'medkit',
    color: '#F97316',
    description: 'Probleme de sante',
  },
  {
    type: 'THEFT',
    label: 'Vol',
    icon: 'alert-circle',
    color: '#8B5CF6',
    description: 'Vol ou agression',
  },
  {
    type: 'LOST_CHILD',
    label: 'Enfant perdu',
    icon: 'people',
    color: '#3B82F6',
    description: 'Enfant perdu ou separe',
  },
  {
    type: 'OTHER',
    label: 'Autre',
    icon: 'help-circle',
    color: '#6B7280',
    description: 'Autre probleme',
  },
];

export default function SOSScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { currentFestival } = useFestivalStore();

  const [selectedType, setSelectedType] = useState<SOSType>('SOS');
  const [message, setMessage] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check cooldown on mount
  useEffect(() => {
    checkCooldown();
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);

  // Get location on mount
  useEffect(() => {
    fetchLocation();
  }, []);

  const checkCooldown = async () => {
    try {
      const lastSent = await AsyncStorage.getItem(SOS_COOLDOWN_KEY);
      if (lastSent) {
        const lastSentTime = parseInt(lastSent, 10);
        const now = Date.now();
        const cooldownMs = SOS_COOLDOWN_MINUTES * 60 * 1000;
        const remaining = cooldownMs - (now - lastSentTime);

        if (remaining > 0) {
          setCooldownRemaining(Math.ceil(remaining / 1000));
          startCooldownTimer();
        }
      }
    } catch (error) {
      console.error('Error checking cooldown:', error);
    }
  };

  const startCooldownTimer = () => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }

    cooldownIntervalRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const fetchLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const coords = await getCurrentLocation();
      if (coords) {
        setLocation(coords);
      }
    } catch (error) {
      console.error('Error fetching location:', error);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const formatCooldownTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSOSPress = () => {
    if (cooldownRemaining > 0) {
      Alert.alert(
        'Veuillez patienter',
        `Vous pourrez envoyer un nouveau SOS dans ${formatCooldownTime(cooldownRemaining)}.`,
        [{ text: 'OK' }]
      );
      return;
    }

    if (!location) {
      Alert.alert(
        'Localisation requise',
        'Nous avons besoin de votre position pour envoyer l\'alerte. Veuillez autoriser l\'acces a la localisation.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Autoriser', onPress: fetchLocation },
        ]
      );
      return;
    }

    setIsConfirming(true);
  };

  const handleConfirmSOS = async () => {
    if (!location || !token || !currentFestival) {
      Alert.alert('Erreur', 'Impossible d\'envoyer l\'alerte. Veuillez reessayer.');
      return;
    }

    setIsSending(true);
    Vibration.vibrate([0, 100, 100, 100]);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/festivals/${currentFestival.id}/sos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: message || `${selectedType} - Alerte SOS`,
            location: {
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy || 0,
              description: '',
            },
            contactPhone: contactPhone || undefined,
          }),
        }
      );

      if (response.status === 429) {
        const data = await response.json();
        Alert.alert('Limite atteinte', data.error?.message || 'Veuillez patienter avant d\'envoyer un nouveau SOS.');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to send SOS');
      }

      // Set cooldown
      await AsyncStorage.setItem(SOS_COOLDOWN_KEY, Date.now().toString());
      setCooldownRemaining(SOS_COOLDOWN_MINUTES * 60);
      startCooldownTimer();

      Alert.alert(
        'Alerte envoyee',
        'Votre alerte SOS a ete envoyee. L\'equipe de securite a ete notifiee et va intervenir rapidement.',
        [
          {
            text: 'OK',
            onPress: () => {
              setIsConfirming(false);
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error sending SOS:', error);
      Alert.alert(
        'Erreur',
        'Impossible d\'envoyer l\'alerte. Veuillez reessayer ou contacter la securite directement.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelConfirm = () => {
    setIsConfirming(false);
  };

  if (isConfirming) {
    return (
      <SafeAreaView className="flex-1 bg-red-50">
        <View className="flex-1 p-6 justify-center items-center">
          <View className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-lg">
            <View className="items-center mb-6">
              <View className="w-20 h-20 bg-red-500 rounded-full items-center justify-center mb-4">
                <Ionicons name="warning" size={40} color="white" />
              </View>
              <Text className="text-2xl font-bold text-gray-900 text-center">
                Confirmer l'alerte SOS ?
              </Text>
              <Text className="text-gray-600 text-center mt-2">
                L'equipe de securite sera immediatement notifiee de votre position.
              </Text>
            </View>

            {location && (
              <View className="bg-gray-100 rounded-xl p-4 mb-6">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="location" size={16} color="#6B7280" />
                  <Text className="text-gray-600 ml-2 text-sm">Votre position</Text>
                </View>
                <Text className="text-gray-900 font-mono text-sm">
                  {formatCoordinates(location.latitude, location.longitude)}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleConfirmSOS}
              disabled={isSending}
              className={`bg-red-500 rounded-xl py-4 mb-3 ${isSending ? 'opacity-70' : ''}`}
            >
              {isSending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-bold text-lg">
                  CONFIRMER L'ALERTE
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCancelConfirm}
              disabled={isSending}
              className="bg-gray-200 rounded-xl py-4"
            >
              <Text className="text-gray-700 text-center font-medium">
                Annuler
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-xl font-semibold text-gray-900 ml-2">Besoin d'aide</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Warning notice */}
        <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <View className="flex-row items-start">
            <Ionicons name="information-circle" size={24} color="#D97706" />
            <Text className="flex-1 ml-3 text-yellow-800">
              Utilisez cette fonction uniquement en cas de reel besoin. Les fausses alertes peuvent
              retarder l'intervention aupres de personnes en danger.
            </Text>
          </View>
        </View>

        {/* Location status */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-200">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View
                className={`w-3 h-3 rounded-full mr-3 ${
                  location ? 'bg-green-500' : isLoadingLocation ? 'bg-yellow-500' : 'bg-red-500'
                }`}
              />
              <Text className="text-gray-700">
                {isLoadingLocation
                  ? 'Localisation en cours...'
                  : location
                    ? 'Position GPS active'
                    : 'Position GPS inactive'}
              </Text>
            </View>
            {!location && !isLoadingLocation && (
              <TouchableOpacity onPress={fetchLocation}>
                <Ionicons name="refresh" size={20} color="#6366F1" />
              </TouchableOpacity>
            )}
          </View>
          {location && (
            <Text className="text-gray-500 text-sm mt-2 font-mono">
              {formatCoordinates(location.latitude, location.longitude)}
            </Text>
          )}
        </View>

        {/* Type selection */}
        <Text className="text-lg font-semibold text-gray-900 mb-3">Type d'urgence</Text>
        <View className="flex-row flex-wrap mb-6">
          {sosOptions.map((option) => (
            <TouchableOpacity
              key={option.type}
              onPress={() => setSelectedType(option.type)}
              className={`w-[48%] mr-[4%] mb-3 p-4 rounded-xl border-2 ${
                selectedType === option.type
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 bg-white'
              }`}
              style={{ marginRight: option.type === 'THEFT' || option.type === 'OTHER' ? 0 : '4%' }}
            >
              <View
                className="w-10 h-10 rounded-full items-center justify-center mb-2"
                style={{ backgroundColor: option.color }}
              >
                <Ionicons name={option.icon} size={20} color="white" />
              </View>
              <Text className="font-semibold text-gray-900">{option.label}</Text>
              <Text className="text-gray-500 text-sm">{option.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Message input */}
        <Text className="text-lg font-semibold text-gray-900 mb-3">Message (optionnel)</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Decrivez votre situation..."
          multiline
          numberOfLines={3}
          className="bg-white border border-gray-200 rounded-xl p-4 mb-4 text-gray-900"
          placeholderTextColor="#9CA3AF"
          textAlignVertical="top"
        />

        {/* Phone input */}
        <Text className="text-lg font-semibold text-gray-900 mb-3">Telephone (optionnel)</Text>
        <TextInput
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="Numero de telephone"
          keyboardType="phone-pad"
          className="bg-white border border-gray-200 rounded-xl p-4 mb-6 text-gray-900"
          placeholderTextColor="#9CA3AF"
        />

        {/* SOS Button */}
        <TouchableOpacity
          onPress={handleSOSPress}
          disabled={cooldownRemaining > 0 || isLoadingLocation}
          className={`rounded-2xl py-6 items-center ${
            cooldownRemaining > 0 || isLoadingLocation ? 'bg-gray-400' : 'bg-red-500'
          }`}
        >
          {cooldownRemaining > 0 ? (
            <>
              <Ionicons name="time-outline" size={32} color="white" />
              <Text className="text-white text-xl font-bold mt-2">
                Attendre {formatCooldownTime(cooldownRemaining)}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="warning" size={40} color="white" />
              <Text className="text-white text-2xl font-bold mt-2">ENVOYER SOS</Text>
              <Text className="text-white/80 text-sm mt-1">
                L'equipe de securite sera alertee
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Emergency contact info */}
        <View className="mt-6 bg-gray-100 rounded-xl p-4">
          <Text className="text-gray-700 font-semibold mb-2">En cas d'urgence vitale</Text>
          <Text className="text-gray-600">
            Appelez le 112 (numero d'urgence europeen) ou le 15 (SAMU).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
