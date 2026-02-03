import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Share, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '@/stores/authStore';

interface QRCodeShareProps {
  size?: number;
}

// Simple QR code visualization component
// In production, replace with react-native-qrcode-svg:
// import QRCode from 'react-native-qrcode-svg';
const QRCodeSVG: React.FC<{ value: string; size: number }> = ({ value, size }) => {
  // Generate a simple pattern based on the value hash
  const generatePattern = (str: string): boolean[][] => {
    const gridSize = 25;
    const pattern: boolean[][] = [];

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    // Generate pattern with fixed corners (like real QR codes)
    for (let y = 0; y < gridSize; y++) {
      pattern[y] = [];
      for (let x = 0; x < gridSize; x++) {
        // Finder patterns (top-left, top-right, bottom-left corners)
        const isFinderPattern =
          (x < 7 && y < 7) || // Top-left
          (x >= gridSize - 7 && y < 7) || // Top-right
          (x < 7 && y >= gridSize - 7); // Bottom-left

        if (isFinderPattern) {
          // Create the finder pattern
          const isOuterBorder =
            x === 0 || y === 0 ||
            x === 6 || y === 6 ||
            x === gridSize - 1 || y === gridSize - 1 ||
            x === gridSize - 7 || y === gridSize - 7;
          const isInnerSquare =
            (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
            (x >= gridSize - 5 && x <= gridSize - 3 && y >= 2 && y <= 4) ||
            (x >= 2 && x <= 4 && y >= gridSize - 5 && y <= gridSize - 3);

          pattern[y][x] = isOuterBorder || isInnerSquare;
        } else {
          // Generate pseudo-random pattern for data area
          const seed = (hash + x * 31 + y * 17) & 0xFFFFFFFF;
          pattern[y][x] = (seed % 3) !== 0;
        }
      }
    }

    return pattern;
  };

  const pattern = generatePattern(value);
  const cellSize = size / pattern.length;

  return (
    <View style={{ width: size, height: size, flexDirection: 'column' }}>
      {pattern.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {row.map((cell, x) => (
            <View
              key={`${x}-${y}`}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: cell ? '#1F2937' : '#FFFFFF',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

export default function QRCodeShare({ size = 200 }: QRCodeShareProps) {
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);

  // Generate QR code value
  const qrValue = useMemo(() => {
    if (!user) return '';
    return `festival_friend_${user.id}`;
  }, [user]);

  // Generate shareable link
  const shareLink = useMemo(() => {
    if (!user) return '';
    return `https://festival.app/add-friend/${user.id}`;
  }, [user]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Ajoutez-moi comme ami sur Festival App! ${shareLink}`,
        title: 'Ajouter un ami',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de copier le lien');
    }
  };

  if (!user) {
    return (
      <View className="items-center justify-center py-12">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <View className="items-center px-4">
      {/* User Info */}
      <View className="items-center mb-6">
        <View className="w-20 h-20 bg-primary rounded-full items-center justify-center mb-3">
          <Text className="text-white text-2xl font-bold">{initials}</Text>
        </View>
        <Text className="text-gray-900 text-xl font-bold">{user.name}</Text>
        <Text className="text-gray-500">Partagez ce QR code pour ajouter des amis</Text>
      </View>

      {/* QR Code */}
      <View className="bg-white rounded-2xl p-6 shadow-lg mb-6">
        {/*
          In production, use:
          <QRCode value={qrValue} size={size} />

          Install with: npm install react-native-qrcode-svg react-native-svg
          or: expo install react-native-svg && npm install react-native-qrcode-svg
        */}
        <QRCodeSVG value={qrValue} size={size} />
      </View>

      {/* Instructions */}
      <View className="bg-primary/10 rounded-xl p-4 mb-6 w-full">
        <View className="flex-row items-start">
          <Ionicons name="information-circle" size={20} color="#6366F1" />
          <View className="flex-1 ml-2">
            <Text className="text-primary font-medium">Comment ca marche ?</Text>
            <Text className="text-gray-600 text-sm mt-1">
              Demandez a votre ami de scanner ce QR code avec l'application Festival pour vous
              ajouter instantanement.
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="w-full space-y-3">
        {/* Share Button */}
        <TouchableOpacity
          onPress={handleShare}
          className="bg-primary rounded-xl p-4 flex-row items-center justify-center"
          activeOpacity={0.8}
        >
          <Ionicons name="share-social" size={20} color="white" />
          <Text className="text-white font-semibold ml-2">Partager mon profil</Text>
        </TouchableOpacity>

        {/* Copy Link Button */}
        <TouchableOpacity
          onPress={handleCopyLink}
          className="bg-gray-100 rounded-xl p-4 flex-row items-center justify-center mt-3"
          activeOpacity={0.8}
        >
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={20} color="#6B7280" />
          <Text className="text-gray-700 font-semibold ml-2">
            {copied ? 'Lien copie !' : 'Copier le lien'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Link Display */}
      <View className="mt-6 w-full">
        <Text className="text-gray-400 text-xs text-center mb-2">Ou partagez ce lien</Text>
        <View className="bg-gray-100 rounded-lg p-3">
          <Text className="text-gray-600 text-sm text-center" numberOfLines={1}>
            {shareLink}
          </Text>
        </View>
      </View>
    </View>
  );
}

// Compact QR code display (for inline use)
interface CompactQRCodeProps {
  size?: number;
  onPress?: () => void;
}

export function CompactQRCode({ size = 100, onPress }: CompactQRCodeProps) {
  const { user } = useAuthStore();

  const qrValue = useMemo(() => {
    if (!user) return '';
    return `festival_friend_${user.id}`;
  }, [user]);

  if (!user) {
    return null;
  }

  const content = (
    <View className="bg-white rounded-xl p-3 items-center">
      <QRCodeSVG value={qrValue} size={size} />
      <Text className="text-gray-500 text-xs mt-2">Mon QR code</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// QR code button for navigation
interface QRCodeButtonProps {
  onPress: () => void;
}

export function QRCodeButton({ onPress }: QRCodeButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center bg-white rounded-xl p-4 border border-gray-200"
      activeOpacity={0.8}
    >
      <View className="w-12 h-12 bg-primary/10 rounded-xl items-center justify-center">
        <Ionicons name="qr-code" size={24} color="#6366F1" />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-gray-900 font-semibold">Mon QR code</Text>
        <Text className="text-gray-500 text-sm">Partagez pour ajouter des amis</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}
