import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSocialStore } from '@/stores/socialStore';

type AddMode = 'username' | 'qr';

interface AddFriendModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
}

export default function AddFriendModal({ visible, onClose, onSuccess }: AddFriendModalProps) {
  const [mode, setMode] = useState<AddMode>('username');
  const [username, setUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [scanned, setScanned] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();

  const { sendFriendRequest, searchUsers } = useSocialStore();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setMode('username');
      setUsername('');
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
      setSuccess(false);
      setScanned(false);
    }
  }, [visible]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const results = await searchUsers(searchQuery);
          setSearchResults(results);
        } catch (err) {
          console.error('Search error:', err);
        }
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const handleSendRequest = async (identifier: string) => {
    setIsSending(true);
    setError(null);

    const result = await sendFriendRequest(identifier);

    setIsSending(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } else {
      setError(result.error || 'Une erreur est survenue');
    }
  };

  const handleSubmitUsername = () => {
    if (username.trim().length < 3) {
      setError("Nom d'utilisateur trop court");
      return;
    }
    handleSendRequest(username.trim());
  };

  const handleSelectUser = (user: SearchResult) => {
    handleSendRequest(user.username);
  };

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned) return;
      setScanned(true);

      // Validate QR code format
      if (data.startsWith('qr_') || data.startsWith('festival_friend_')) {
        handleSendRequest(data);
      } else {
        Alert.alert('QR Code invalide', 'Ce QR code ne correspond pas a un profil utilisateur.', [
          { text: 'Reessayer', onPress: () => setScanned(false) },
        ]);
      }
    },
    [scanned]
  );

  const renderUsernameMode = () => (
    <View className="flex-1">
      {/* Search Input */}
      <View className="px-4 pt-4">
        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            className="flex-1 ml-3 text-gray-900 text-base"
            placeholder="Rechercher par nom ou @username"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setUsername(text);
              setError(null);
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        {error && <Text className="text-red-500 text-sm mt-2 px-1">{error}</Text>}
      </View>

      {/* Search Results */}
      <ScrollView className="flex-1 px-4 mt-4" keyboardShouldPersistTaps="handled">
        {isSearching && (
          <View className="items-center py-8">
            <ActivityIndicator size="small" color="#6366F1" />
            <Text className="text-gray-500 mt-2">Recherche...</Text>
          </View>
        )}

        {!isSearching && searchResults.length > 0 && (
          <View className="bg-white rounded-xl">
            {searchResults.map((user, index) => (
              <TouchableOpacity
                key={user.id}
                onPress={() => handleSelectUser(user)}
                disabled={isSending}
                className={`flex-row items-center p-4 ${
                  index < searchResults.length - 1 ? 'border-b border-gray-100' : ''
                }`}
                activeOpacity={0.7}
              >
                {/* Avatar */}
                <View className="w-12 h-12 bg-primary rounded-full items-center justify-center">
                  <Text className="text-white font-bold text-lg">
                    {user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1 ml-3">
                  <Text className="font-semibold text-gray-900">{user.name}</Text>
                  <Text className="text-gray-500">@{user.username}</Text>
                </View>
                <Ionicons name="person-add" size={20} color="#6366F1" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
          <View className="items-center py-8">
            <Ionicons name="search-outline" size={48} color="#D1D5DB" />
            <Text className="text-gray-500 mt-2">Aucun resultat</Text>
            <Text className="text-gray-400 text-sm text-center mt-1 px-4">
              Essayez un autre nom ou ajoutez directement par username
            </Text>
          </View>
        )}

        {searchQuery.length < 2 && (
          <View className="items-center py-8">
            <View className="bg-primary/10 rounded-full p-4 mb-4">
              <Ionicons name="people" size={32} color="#6366F1" />
            </View>
            <Text className="text-gray-600 text-center px-4">
              Entrez un nom ou @username pour rechercher des amis
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Direct Add Button */}
      {searchQuery.length >= 3 && !isSearching && (
        <View className="px-4 pb-4 pt-2 bg-white border-t border-gray-100">
          <TouchableOpacity
            onPress={handleSubmitUsername}
            disabled={isSending}
            className="bg-primary rounded-xl p-4 items-center flex-row justify-center"
            activeOpacity={0.8}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="person-add" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">
                  Ajouter @{searchQuery.startsWith('@') ? searchQuery.slice(1) : searchQuery}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderQRMode = () => {
    if (!permission?.granted) {
      return (
        <View className="flex-1 items-center justify-center px-4">
          <View className="bg-gray-100 rounded-full p-6 mb-4">
            <Ionicons name="camera-outline" size={48} color="#6B7280" />
          </View>
          <Text className="text-gray-900 font-semibold text-lg text-center">
            Acces a la camera requis
          </Text>
          <Text className="text-gray-500 text-center mt-2 px-4">
            Pour scanner un QR code, autorisez l'acces a la camera.
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            className="bg-primary rounded-xl px-6 py-3 mt-6"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold">Autoriser la camera</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="flex-1">
        {/* Camera */}
        <View className="flex-1 mx-4 mt-4 rounded-2xl overflow-hidden">
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          >
            {/* Scan Frame Overlay */}
            <View className="flex-1 items-center justify-center">
              <View className="w-64 h-64 relative">
                {/* Corner markers */}
                <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
              </View>
            </View>
          </CameraView>
        </View>

        {/* Instructions */}
        <View className="p-4 items-center">
          <Text className="text-gray-600 text-center">
            Placez le QR code de votre ami dans le cadre
          </Text>
          {scanned && !success && !error && (
            <View className="flex-row items-center mt-3">
              <ActivityIndicator size="small" color="#6366F1" />
              <Text className="text-primary ml-2">Verification...</Text>
            </View>
          )}
          {error && (
            <Text className="text-red-500 mt-2">{error}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderSuccessState = () => (
    <View className="flex-1 items-center justify-center px-4">
      <View className="bg-green-100 rounded-full p-6">
        <Ionicons name="checkmark-circle" size={64} color="#10B981" />
      </View>
      <Text className="text-gray-900 text-xl font-bold mt-6">Demande envoyee !</Text>
      <Text className="text-gray-500 text-center mt-2">
        Votre demande d'ami a ete envoyee avec succes.
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        className="flex-1 bg-gray-50"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
          <TouchableOpacity onPress={onClose} className="p-2 -ml-2">
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-900">Ajouter un ami</Text>
          <View style={{ width: 40 }} />
        </View>

        {success ? (
          renderSuccessState()
        ) : (
          <>
            {/* Mode Tabs */}
            <View className="flex-row bg-white border-b border-gray-200">
              <TouchableOpacity
                onPress={() => setMode('username')}
                className={`flex-1 py-3 items-center border-b-2 ${
                  mode === 'username' ? 'border-primary' : 'border-transparent'
                }`}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name="search"
                    size={20}
                    color={mode === 'username' ? '#6366F1' : '#9CA3AF'}
                  />
                  <Text
                    className={`ml-2 font-medium ${
                      mode === 'username' ? 'text-primary' : 'text-gray-500'
                    }`}
                  >
                    Rechercher
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode('qr')}
                className={`flex-1 py-3 items-center border-b-2 ${
                  mode === 'qr' ? 'border-primary' : 'border-transparent'
                }`}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name="qr-code"
                    size={20}
                    color={mode === 'qr' ? '#6366F1' : '#9CA3AF'}
                  />
                  <Text
                    className={`ml-2 font-medium ${
                      mode === 'qr' ? 'text-primary' : 'text-gray-500'
                    }`}
                  >
                    Scanner QR
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Content */}
            {mode === 'username' ? renderUsernameMode() : renderQRMode()}
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
