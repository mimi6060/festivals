import { TouchableOpacity, Text, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

interface UploadButtonProps {
  variant?: 'floating' | 'inline' | 'icon-only';
  onUploadStart?: () => void;
  festivalId?: string;
}

export function UploadButton({
  variant = 'floating',
  onUploadStart,
  festivalId,
}: UploadButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onUploadStart) {
      onUploadStart();
    }
    router.push('/memories/upload' as any);
  };

  const showMediaPicker = async () => {
    Alert.alert('Ajouter un souvenir', 'Choisis une option', [
      {
        text: 'Prendre une photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Permission requise',
              'Nous avons besoin d\'acceder a ta camera.'
            );
            return;
          }
          router.push('/memories/upload' as any);
        },
      },
      {
        text: 'Choisir de la galerie',
        onPress: async () => {
          const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Permission requise',
              'Nous avons besoin d\'acceder a ta galerie.'
            );
            return;
          }
          router.push('/memories/upload' as any);
        },
      },
      {
        text: 'Annuler',
        style: 'cancel',
      },
    ]);
  };

  if (variant === 'floating') {
    return (
      <TouchableOpacity
        onPress={showMediaPicker}
        className="absolute bottom-24 right-4 bg-primary rounded-full w-14 h-14 items-center justify-center shadow-lg"
        style={{
          shadowColor: '#6366F1',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons name="camera" size={28} color="white" />
      </TouchableOpacity>
    );
  }

  if (variant === 'icon-only') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        className="bg-primary rounded-full p-2"
      >
        <Ionicons name="camera" size={22} color="white" />
      </TouchableOpacity>
    );
  }

  // Inline variant
  return (
    <TouchableOpacity
      onPress={showMediaPicker}
      className="bg-primary rounded-xl py-3 px-6 flex-row items-center justify-center"
    >
      <Ionicons name="camera-outline" size={22} color="white" />
      <Text className="text-white font-semibold ml-2">Ajouter une photo</Text>
    </TouchableOpacity>
  );
}

// Quick upload button for the tab bar
export function TabBarUploadButton() {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push('/memories/upload' as any)}
      className="bg-primary rounded-full w-12 h-12 items-center justify-center -mt-6"
      style={{
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <Ionicons name="add" size={28} color="white" />
    </TouchableOpacity>
  );
}

// Empty state with upload prompt
export function EmptyGalleryPrompt({ message }: { message?: string }) {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center py-16 px-8">
      <View className="bg-gray-100 rounded-full p-6 mb-4">
        <Ionicons name="images-outline" size={48} color="#9CA3AF" />
      </View>
      <Text className="text-gray-500 text-center text-lg mb-2">
        {message || 'Pas encore de souvenirs'}
      </Text>
      <Text className="text-gray-400 text-center mb-6">
        Sois le premier a partager un moment!
      </Text>
      <TouchableOpacity
        onPress={() => router.push('/memories/upload' as any)}
        className="bg-primary rounded-full py-3 px-8 flex-row items-center"
      >
        <Ionicons name="camera" size={20} color="white" />
        <Text className="text-white font-semibold ml-2">Ajouter une photo</Text>
      </TouchableOpacity>
    </View>
  );
}
