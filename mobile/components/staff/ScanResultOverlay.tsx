import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Vibration, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScanResultType, ScanMode } from '@/stores/ticketScanStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ScanResultOverlayProps {
  visible: boolean;
  resultType: ScanResultType;
  scanMode: ScanMode;
  holderName: string;
  ticketTypeName: string;
  message: string;
  entryCount?: number;
  onDismiss: () => void;
  autoDismissDelay?: number;
}

const RESULT_CONFIG: Record<ScanResultType, {
  backgroundColor: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
}> = {
  success: {
    backgroundColor: '#10B981',
    iconName: 'checkmark-circle',
    iconColor: '#FFFFFF',
    title: 'Valide',
  },
  error: {
    backgroundColor: '#EF4444',
    iconName: 'close-circle',
    iconColor: '#FFFFFF',
    title: 'Erreur',
  },
  already_used: {
    backgroundColor: '#F59E0B',
    iconName: 'alert-circle',
    iconColor: '#FFFFFF',
    title: 'Deja utilise',
  },
  invalid: {
    backgroundColor: '#EF4444',
    iconName: 'close-circle',
    iconColor: '#FFFFFF',
    title: 'Invalide',
  },
  expired: {
    backgroundColor: '#6B7280',
    iconName: 'time',
    iconColor: '#FFFFFF',
    title: 'Expire',
  },
};

export default function ScanResultOverlay({
  visible,
  resultType,
  scanMode,
  holderName,
  ticketTypeName,
  message,
  entryCount,
  onDismiss,
  autoDismissDelay = 2000,
}: ScanResultOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const iconScale = useRef(new Animated.Value(0)).current;

  const config = RESULT_CONFIG[resultType];

  useEffect(() => {
    if (visible) {
      // Vibration feedback
      if (resultType === 'success') {
        Vibration.vibrate([0, 100, 50, 100]);
      } else {
        Vibration.vibrate([0, 200, 100, 200, 100, 200]);
      }

      // Animate in
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(100),
          Animated.spring(iconScale, {
            toValue: 1,
            friction: 4,
            tension: 80,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Auto dismiss
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoDismissDelay);

      return () => clearTimeout(timer);
    } else {
      // Reset animations
      opacity.setValue(0);
      scale.setValue(0.8);
      iconScale.setValue(0);
    }
  }, [visible, resultType]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        { backgroundColor: config.backgroundColor, opacity },
      ]}
    >
      <Animated.View
        style={[
          styles.content,
          { transform: [{ scale }] },
        ]}
      >
        {/* Icon */}
        <Animated.View style={{ transform: [{ scale: iconScale }] }}>
          <Ionicons
            name={config.iconName}
            size={120}
            color={config.iconColor}
          />
        </Animated.View>

        {/* Title */}
        <Text style={styles.title}>{config.title}</Text>

        {/* Message */}
        <Text style={styles.message}>{message}</Text>

        {/* Holder info */}
        <View style={styles.infoContainer}>
          <Text style={styles.holderName}>{holderName}</Text>
          <Text style={styles.ticketType}>{ticketTypeName}</Text>
          {entryCount && entryCount > 1 && (
            <View style={styles.entryCountBadge}>
              <Text style={styles.entryCountText}>
                Entree #{entryCount}
              </Text>
            </View>
          )}
        </View>

        {/* Mode indicator */}
        <View style={styles.modeContainer}>
          <Ionicons
            name={scanMode === 'entry' ? 'enter-outline' : 'exit-outline'}
            size={20}
            color="rgba(255,255,255,0.7)"
          />
          <Text style={styles.modeText}>
            Mode {scanMode === 'entry' ? 'Entree' : 'Sortie'}
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    textAlign: 'center',
  },
  infoContainer: {
    marginTop: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  holderName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  ticketType: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  entryCountBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  entryCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
  },
  modeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 8,
  },
});
