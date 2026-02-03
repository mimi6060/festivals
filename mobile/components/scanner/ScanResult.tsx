import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Vibration,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { QRType, ScanEntry } from '@/stores/scanStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ScanResultProps {
  visible: boolean;
  scan: ScanEntry | null;
  onNavigate: () => void;
  onDismiss: () => void;
  onScanAgain: () => void;
  autoDismissDelay?: number;
}

const TYPE_CONFIG: Record<QRType, {
  backgroundColor: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  actionLabel: string;
}> = {
  ticket: {
    backgroundColor: '#6366F1',
    iconName: 'ticket',
    iconColor: '#FFFFFF',
    title: 'Billet detecte',
    actionLabel: 'Valider le billet',
  },
  wallet: {
    backgroundColor: '#10B981',
    iconName: 'wallet',
    iconColor: '#FFFFFF',
    title: 'Wallet detecte',
    actionLabel: 'Proceder au paiement',
  },
  stand: {
    backgroundColor: '#F59E0B',
    iconName: 'storefront',
    iconColor: '#FFFFFF',
    title: 'Stand detecte',
    actionLabel: 'Voir les infos',
  },
  unknown: {
    backgroundColor: '#6B7280',
    iconName: 'help-circle',
    iconColor: '#FFFFFF',
    title: 'QR Code inconnu',
    actionLabel: 'Fermer',
  },
};

export default function ScanResult({
  visible,
  scan,
  onNavigate,
  onDismiss,
  onScanAgain,
  autoDismissDelay,
}: ScanResultProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(100)).current;

  const config = scan ? TYPE_CONFIG[scan.qrType] : TYPE_CONFIG.unknown;

  useEffect(() => {
    if (visible && scan) {
      // Vibration feedback
      if (scan.successful) {
        Vibration.vibrate([0, 100, 50, 100]);
      } else {
        Vibration.vibrate([0, 200, 100, 200]);
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
        Animated.spring(slideUp, {
          toValue: 0,
          friction: 8,
          tension: 80,
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

      // Auto dismiss for unknown types
      if (autoDismissDelay && scan.qrType === 'unknown') {
        const timer = setTimeout(() => {
          handleDismiss();
        }, autoDismissDelay);
        return () => clearTimeout(timer);
      }
    } else {
      // Reset animations
      opacity.setValue(0);
      scale.setValue(0.8);
      iconScale.setValue(0);
      slideUp.setValue(100);
    }
  }, [visible, scan]);

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

  const handleNavigate = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 100,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onNavigate();
    });
  };

  if (!visible || !scan) return null;

  const showNavigateButton = scan.qrType !== 'unknown' && scan.resourceId;

  return (
    <Animated.View
      style={[
        styles.overlay,
        { backgroundColor: config.backgroundColor, opacity },
      ]}
    >
      <TouchableOpacity
        style={styles.dismissArea}
        activeOpacity={1}
        onPress={handleDismiss}
      />

      <Animated.View
        style={[
          styles.content,
          { transform: [{ scale }, { translateY: slideUp }] },
        ]}
      >
        {/* Icon */}
        <Animated.View style={{ transform: [{ scale: iconScale }] }}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={config.iconName}
              size={64}
              color={config.iconColor}
            />
          </View>
        </Animated.View>

        {/* Title */}
        <Text style={styles.title}>{config.title}</Text>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.displayName}>{scan.displayName}</Text>
          <Text style={styles.description}>{scan.description}</Text>

          {/* QR Type Badge */}
          <View style={styles.badgeContainer}>
            <View style={[styles.badge, { backgroundColor: `${config.backgroundColor}40` }]}>
              <Ionicons
                name={config.iconName}
                size={14}
                color={config.backgroundColor}
              />
              <Text style={[styles.badgeText, { color: config.backgroundColor }]}>
                {scan.qrType.toUpperCase()}
              </Text>
            </View>

            {scan.resourceId && (
              <View style={styles.idBadge}>
                <Ionicons name="finger-print-outline" size={14} color="#6B7280" />
                <Text style={styles.idText}>
                  {scan.resourceId.slice(0, 8)}...
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {showNavigateButton ? (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleNavigate}
              >
                <Text style={styles.primaryButtonText}>{config.actionLabel}</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onScanAgain}
              >
                <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
                <Text style={styles.secondaryButtonText}>Scanner a nouveau</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onScanAgain}
              >
                <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Scanner a nouveau</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleDismiss}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
                <Text style={styles.secondaryButtonText}>Fermer</Text>
              </TouchableOpacity>
            </>
          )}
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
  dismissArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
    textAlign: 'center',
  },
  infoCard: {
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  badgeContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    gap: 4,
  },
  idText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    marginTop: 24,
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
