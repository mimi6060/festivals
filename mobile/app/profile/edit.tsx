import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useUserStore } from '@/stores/userStore';

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, updateProfile, updateAvatar, isUpdatingProfile } = useUserStore();

  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(profile?.avatarUrl);
  const [hasChanges, setHasChanges] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    setHasChanges(true);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    setHasChanges(true);
  };

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Veuillez autoriser l\'acces a votre galerie photo pour changer votre avatar.'
      );
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setHasChanges(true);
    }
  };

  const takePhoto = async () => {
    // Request camera permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Veuillez autoriser l\'acces a votre camera pour prendre une photo.'
      );
      return;
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setHasChanges(true);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Changer la photo',
      'Choisissez une option',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Prendre une photo', onPress: takePhoto },
        { text: 'Choisir dans la galerie', onPress: pickImage },
        ...(avatarUri
          ? [
              {
                text: 'Supprimer la photo',
                style: 'destructive' as const,
                onPress: () => {
                  setAvatarUri(undefined);
                  setHasChanges(true);
                },
              },
            ]
          : []),
      ],
      { cancelable: true }
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom ne peut pas etre vide');
      return;
    }

    try {
      // Update avatar if changed
      if (avatarUri !== profile?.avatarUrl) {
        if (avatarUri) {
          await updateAvatar(avatarUri);
        } else {
          await updateProfile({ avatarUrl: undefined });
        }
      }

      // Update profile
      await updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
      });

      Alert.alert('Succes', 'Votre profil a ete mis a jour', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de la mise a jour du profil');
    }
  };

  const renderAvatar = () => {
    if (avatarUri) {
      return (
        <Image source={{ uri: avatarUri }} className="w-28 h-28 rounded-full" resizeMode="cover" />
      );
    }

    const initials =
      name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2) || 'U';

    return (
      <View className="w-28 h-28 bg-primary rounded-full items-center justify-center">
        <Text className="text-white text-4xl font-bold">{initials}</Text>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Modifier le profil',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          ),
          headerRight: () =>
            hasChanges ? (
              <TouchableOpacity onPress={handleSave} disabled={isUpdatingProfile}>
                {isUpdatingProfile ? (
                  <ActivityIndicator size="small" color="#6366F1" />
                ) : (
                  <Text className="text-primary font-semibold text-base">Enregistrer</Text>
                )}
              </TouchableOpacity>
            ) : null,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 bg-gray-50">
          <View className="p-4">
            {/* Avatar Section */}
            <View className="items-center py-6">
              <TouchableOpacity onPress={showImageOptions} className="relative">
                {renderAvatar()}
                <View className="absolute bottom-0 right-0 bg-primary rounded-full p-2">
                  <Ionicons name="camera" size={20} color="white" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={showImageOptions} className="mt-3">
                <Text className="text-primary font-medium">Changer la photo</Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View className="bg-white rounded-xl p-4 space-y-4">
              {/* Name Field */}
              <View>
                <Text className="text-sm font-medium text-gray-500 mb-2">Nom complet</Text>
                <TextInput
                  value={name}
                  onChangeText={handleNameChange}
                  placeholder="Votre nom"
                  className="bg-gray-50 rounded-lg px-4 py-3 text-gray-900"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              {/* Email Field (read-only) */}
              <View>
                <Text className="text-sm font-medium text-gray-500 mb-2">Email</Text>
                <View className="bg-gray-100 rounded-lg px-4 py-3 flex-row items-center">
                  <Text className="text-gray-500 flex-1">{profile?.email}</Text>
                  <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
                </View>
                <Text className="text-xs text-gray-400 mt-1">
                  L'email ne peut pas etre modifie
                </Text>
              </View>

              {/* Phone Field */}
              <View>
                <Text className="text-sm font-medium text-gray-500 mb-2">Telephone</Text>
                <TextInput
                  value={phone}
                  onChangeText={handlePhoneChange}
                  placeholder="+33 6 12 34 56 78"
                  className="bg-gray-50 rounded-lg px-4 py-3 text-gray-900"
                  keyboardType="phone-pad"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Save Button */}
            {hasChanges && (
              <TouchableOpacity
                onPress={handleSave}
                disabled={isUpdatingProfile}
                className={`mt-6 rounded-xl p-4 flex-row items-center justify-center ${
                  isUpdatingProfile ? 'bg-gray-300' : 'bg-primary'
                }`}
              >
                {isUpdatingProfile ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={24} color="white" />
                    <Text className="text-white font-semibold ml-2">Enregistrer les modifications</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
