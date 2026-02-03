import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';

interface SelectedMedia {
  uri: string;
  type: 'image' | 'video';
  fileName?: string;
  fileSize?: number;
}

export default function UploadScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { festivalId } = useAuthStore();

  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const stages = ['Main Stage', 'Tent 1', 'Tent 2', 'Club Stage'];
  const days = [1, 2, 3];

  const uploadMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // In real app, call API
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return { id: 'new-media-id' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      queryClient.invalidateQueries({ queryKey: ['my-photos'] });
      Alert.alert(
        'Succes',
        'Ta photo a ete envoyee et sera visible apres moderation.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    },
    onError: (error: Error) => {
      Alert.alert('Erreur', error.message || 'Une erreur est survenue');
    },
  });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin d\'acceder a ta galerie.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedMedia({
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
        fileName: asset.fileName || undefined,
        fileSize: asset.fileSize || undefined,
      });
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin d\'acceder a ta camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedMedia({
        uri: asset.uri,
        type: 'image',
        fileName: asset.fileName || undefined,
        fileSize: asset.fileSize || undefined,
      });
    }
  };

  const addTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 5) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleUpload = () => {
    if (!selectedMedia) {
      Alert.alert('Erreur', 'Selectionne une photo ou video');
      return;
    }

    if (!festivalId) {
      Alert.alert('Erreur', 'Festival non selectionne');
      return;
    }

    const formData = new FormData();
    formData.append('file', {
      uri: selectedMedia.uri,
      type: selectedMedia.type === 'video' ? 'video/mp4' : 'image/jpeg',
      name: selectedMedia.fileName || 'upload.jpg',
    } as any);
    formData.append('festivalId', festivalId);
    formData.append('type', selectedMedia.type === 'video' ? 'VIDEO' : 'PHOTO');

    if (description) {
      formData.append('description', description);
    }
    if (tags.length > 0) {
      tags.forEach((tag) => formData.append('tags', tag));
    }
    if (selectedDay) {
      formData.append('day', selectedDay.toString());
    }
    if (selectedStage) {
      formData.append('stageName', selectedStage);
    }

    uploadMutation.mutate(formData);
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 pt-12 pb-4 bg-white border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center"
          >
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold">Ajouter un souvenir</Text>
          <TouchableOpacity
            onPress={handleUpload}
            disabled={!selectedMedia || uploadMutation.isPending}
            className={`px-4 py-2 rounded-full ${
              selectedMedia && !uploadMutation.isPending
                ? 'bg-primary'
                : 'bg-gray-200'
            }`}
          >
            {uploadMutation.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text
                className={`font-medium ${
                  selectedMedia ? 'text-white' : 'text-gray-400'
                }`}
              >
                Publier
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Media Picker */}
        {selectedMedia ? (
          <View className="mb-6">
            <View className="relative">
              <Image
                source={{ uri: selectedMedia.uri }}
                className="w-full h-80 rounded-xl"
                resizeMode="cover"
              />
              {selectedMedia.type === 'video' && (
                <View className="absolute inset-0 items-center justify-center">
                  <View className="bg-black/50 rounded-full p-4">
                    <Ionicons name="play" size={32} color="white" />
                  </View>
                </View>
              )}
              <TouchableOpacity
                onPress={() => setSelectedMedia(null)}
                className="absolute top-2 right-2 bg-black/50 rounded-full p-2"
              >
                <Ionicons name="close" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View className="mb-6">
            <View className="flex-row space-x-4">
              <TouchableOpacity
                onPress={takePhoto}
                className="flex-1 bg-primary/10 rounded-xl p-8 items-center"
              >
                <Ionicons name="camera" size={48} color="#6366F1" />
                <Text className="text-primary font-medium mt-2">
                  Prendre une photo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickImage}
                className="flex-1 bg-gray-100 rounded-xl p-8 items-center"
              >
                <Ionicons name="images" size={48} color="#6B7280" />
                <Text className="text-gray-600 font-medium mt-2">
                  Galerie
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Description */}
        <View className="mb-6">
          <Text className="text-gray-700 font-medium mb-2">Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Decris ce moment..."
            multiline
            numberOfLines={3}
            className="bg-gray-100 rounded-xl p-4 text-gray-800"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Tags */}
        <View className="mb-6">
          <Text className="text-gray-700 font-medium mb-2">Tags</Text>
          <View className="flex-row items-center bg-gray-100 rounded-xl px-4">
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              placeholder="Ajoute un tag..."
              className="flex-1 py-3 text-gray-800"
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity onPress={addTag}>
              <Ionicons name="add-circle" size={24} color="#6366F1" />
            </TouchableOpacity>
          </View>
          {tags.length > 0 && (
            <View className="flex-row flex-wrap mt-2">
              {tags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => removeTag(tag)}
                  className="bg-primary/10 rounded-full px-3 py-1 mr-2 mb-2 flex-row items-center"
                >
                  <Text className="text-primary">#{tag}</Text>
                  <Ionicons name="close" size={14} color="#6366F1" className="ml-1" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Day Selection */}
        <View className="mb-6">
          <Text className="text-gray-700 font-medium mb-2">Jour du festival</Text>
          <View className="flex-row">
            {days.map((day) => (
              <TouchableOpacity
                key={day}
                onPress={() => setSelectedDay(selectedDay === day ? null : day)}
                className={`flex-1 py-3 mr-2 rounded-xl items-center ${
                  selectedDay === day ? 'bg-primary' : 'bg-gray-100'
                }`}
              >
                <Text
                  className={`font-medium ${
                    selectedDay === day ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  Jour {day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stage Selection */}
        <View className="mb-6">
          <Text className="text-gray-700 font-medium mb-2">Scene</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {stages.map((stage) => (
              <TouchableOpacity
                key={stage}
                onPress={() =>
                  setSelectedStage(selectedStage === stage ? null : stage)
                }
                className={`py-2 px-4 mr-2 rounded-full ${
                  selectedStage === stage ? 'bg-primary' : 'bg-gray-100'
                }`}
              >
                <Text
                  className={`font-medium ${
                    selectedStage === stage ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {stage}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Info */}
        <View className="bg-blue-50 rounded-xl p-4 mb-6">
          <View className="flex-row items-start">
            <Ionicons name="information-circle" size={20} color="#3B82F6" />
            <Text className="text-blue-700 ml-2 flex-1">
              Tes photos seront visibles apres verification par notre equipe.
              Cela prend generalement moins de 24h.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
