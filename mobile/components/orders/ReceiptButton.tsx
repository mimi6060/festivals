import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

interface ReceiptButtonProps {
  orderId: string;
  orderNumber: string;
  receiptUrl?: string;
  onDownload?: (orderId: string) => Promise<string | null>;
}

export function ReceiptButton({
  orderId,
  orderNumber,
  receiptUrl,
  onDownload,
}: ReceiptButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      // Get receipt URL (either from props or via callback)
      let url = receiptUrl;
      if (!url && onDownload) {
        url = await onDownload(orderId);
      }

      if (!url) {
        Alert.alert(
          'Recu non disponible',
          'Le recu pour cette commande n\'est pas encore disponible.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Check if sharing is available
      const isSharingAvailable = await Sharing.isAvailableAsync();

      if (isSharingAvailable) {
        // Download the file first
        const fileUri = `${FileSystem.cacheDirectory}receipt-${orderNumber}.pdf`;

        const downloadResult = await FileSystem.downloadAsync(url, fileUri);

        if (downloadResult.status === 200) {
          // Share the downloaded file
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Recu - ${orderNumber}`,
          });
        } else {
          throw new Error('Echec du telechargement');
        }
      } else {
        // Fallback: open URL in browser
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          Alert.alert(
            'Erreur',
            'Impossible d\'ouvrir le recu. Veuillez reessayer.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Receipt download error:', error);
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors du telechargement du recu.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleDownload}
      disabled={isDownloading}
      activeOpacity={0.7}
      className={`bg-primary rounded-xl p-4 flex-row items-center justify-center ${
        isDownloading ? 'opacity-70' : ''
      }`}
    >
      {isDownloading ? (
        <>
          <ActivityIndicator size="small" color="white" />
          <Text className="text-white font-semibold ml-2">
            Telechargement...
          </Text>
        </>
      ) : (
        <>
          <Ionicons name="download-outline" size={20} color="white" />
          <Text className="text-white font-semibold ml-2">
            Telecharger le recu
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// Compact inline version
export function ReceiptButtonInline({
  orderId,
  orderNumber,
  receiptUrl,
  onDownload,
}: ReceiptButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      let url = receiptUrl;
      if (!url && onDownload) {
        url = await onDownload(orderId);
      }

      if (url) {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        }
      }
    } catch (error) {
      console.error('Receipt download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleDownload}
      disabled={isDownloading}
      activeOpacity={0.7}
      className="flex-row items-center"
    >
      {isDownloading ? (
        <ActivityIndicator size="small" color="#6366F1" />
      ) : (
        <>
          <Ionicons name="receipt-outline" size={18} color="#6366F1" />
          <Text className="text-primary font-medium ml-1.5">Recu</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export default ReceiptButton;
