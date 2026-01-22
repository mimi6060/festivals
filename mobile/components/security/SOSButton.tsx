import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';

interface SOSButtonProps {
  /**
   * Button size: 'small' (48px), 'medium' (64px), or 'large' (80px)
   */
  size?: 'small' | 'medium' | 'large';
  /**
   * Whether to show the label text
   */
  showLabel?: boolean;
  /**
   * Whether to show a pulsing animation
   */
  pulse?: boolean;
  /**
   * Custom style for the container
   */
  style?: object;
  /**
   * Position mode: 'inline' for normal flow, 'floating' for absolute positioning
   */
  position?: 'inline' | 'floating';
}

const SIZES = {
  small: { button: 48, icon: 24, text: 10 },
  medium: { button: 64, icon: 32, text: 12 },
  large: { button: 80, icon: 40, text: 14 },
};

export function SOSButton({
  size = 'medium',
  showLabel = true,
  pulse = false,
  style,
  position = 'inline',
}: SOSButtonProps) {
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (pulse) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [pulse, pulseAnim]);

  const handlePress = () => {
    router.push('/sos');
  };

  const dimensions = SIZES[size];

  const containerStyle = position === 'floating' ? styles.floatingContainer : {};

  return (
    <View style={[containerStyle, style]}>
      <Animated.View
        style={[
          styles.shadowContainer,
          pulse && { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.8}
          style={[
            styles.button,
            {
              width: dimensions.button,
              height: dimensions.button,
              borderRadius: dimensions.button / 2,
            },
          ]}
        >
          <Ionicons name="warning" size={dimensions.icon} color="white" />
        </TouchableOpacity>
      </Animated.View>
      {showLabel && (
        <Text
          style={[
            styles.label,
            { fontSize: dimensions.text },
          ]}
        >
          SOS
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    alignItems: 'center',
    zIndex: 1000,
  },
  shadowContainer: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  button: {
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#EF4444',
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
});

// Floating SOS button that can be used across screens
export function FloatingSOSButton(props: Omit<SOSButtonProps, 'position'>) {
  return <SOSButton {...props} position="floating" pulse />;
}

export default SOSButton;
