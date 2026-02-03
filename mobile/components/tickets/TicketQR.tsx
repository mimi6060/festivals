import { useEffect } from 'react';
import { View, Text, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Brightness from 'expo-brightness';

interface TicketQRProps {
  qrCode: string;
  ticketCode: string;
  holderName: string;
  eventName: string;
  boostBrightness?: boolean;
}

export function TicketQR({
  qrCode,
  ticketCode,
  holderName,
  eventName,
  boostBrightness = true,
}: TicketQRProps) {
  const { width } = useWindowDimensions();
  const qrSize = Math.min(width - 80, 280);

  useEffect(() => {
    let originalBrightness: number | undefined;

    const setBrightness = async () => {
      if (boostBrightness && Platform.OS !== 'web') {
        try {
          // Request permissions on Android
          const { status } = await Brightness.requestPermissionsAsync();

          if (status === 'granted') {
            // Save original brightness
            originalBrightness = await Brightness.getBrightnessAsync();

            // Set to maximum brightness
            await Brightness.setBrightnessAsync(1);
          }
        } catch (error) {
          console.log('Could not adjust brightness:', error);
        }
      }
    };

    setBrightness();

    // Restore original brightness on unmount
    return () => {
      const restoreBrightness = async () => {
        if (originalBrightness !== undefined && Platform.OS !== 'web') {
          try {
            await Brightness.setBrightnessAsync(originalBrightness);
          } catch (error) {
            console.log('Could not restore brightness:', error);
          }
        }
      };
      restoreBrightness();
    };
  }, [boostBrightness]);

  return (
    <View className="items-center">
      {/* QR Code Container */}
      <View className="bg-white rounded-3xl p-6 shadow-lg items-center">
        {/* Event Name Header */}
        <Text className="text-gray-600 text-sm mb-2 text-center">
          {eventName}
        </Text>

        {/* QR Code Placeholder */}
        <View
          style={{ width: qrSize, height: qrSize }}
          className="bg-white rounded-2xl items-center justify-center border-4 border-gray-100"
        >
          {/*
            In a real app, you would use a QR code library here:
            <QRCode value={qrCode} size={qrSize - 20} />

            For now, we show a placeholder with the QR icon
          */}
          <View className="items-center">
            <Ionicons name="qr-code" size={qrSize * 0.7} color="#1F2937" />
            {/* Decorative corners */}
            <View className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
            <View className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
            <View className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
            <View className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
          </View>
        </View>

        {/* Ticket Code */}
        <View className="mt-4 bg-gray-100 rounded-xl px-6 py-3">
          <Text className="text-gray-900 font-mono text-lg font-bold tracking-wider text-center">
            {ticketCode}
          </Text>
        </View>

        {/* Holder Name */}
        <View className="mt-4 flex-row items-center">
          <Ionicons name="person-circle-outline" size={20} color="#6B7280" />
          <Text className="text-gray-600 ml-2 font-medium">
            {holderName}
          </Text>
        </View>
      </View>

      {/* Instructions */}
      <View className="mt-6 px-4">
        <View className="flex-row items-center justify-center">
          <Ionicons name="scan-outline" size={20} color="#6366F1" />
          <Text className="text-primary ml-2 text-center">
            Presentez ce QR code a l'entree
          </Text>
        </View>
        <Text className="text-gray-400 text-sm text-center mt-2">
          La luminosite de l'ecran a ete augmentee automatiquement
        </Text>
      </View>

      {/* Brightness Indicator */}
      {boostBrightness && (
        <View className="mt-4 flex-row items-center bg-yellow-50 rounded-full px-4 py-2">
          <Ionicons name="sunny" size={16} color="#F59E0B" />
          <Text className="text-yellow-700 text-xs ml-2">
            Luminosite maximale
          </Text>
        </View>
      )}
    </View>
  );
}

export default TicketQR;
