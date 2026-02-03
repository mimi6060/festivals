import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Dimensions, StyleSheet } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.7;
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 4;
const SCAN_LINE_HEIGHT = 3;

interface ScannerOverlayProps {
  isActive?: boolean;
  accentColor?: string;
  scanAreaSize?: number;
}

export default function ScannerOverlay({
  isActive = true,
  accentColor = '#6366F1',
  scanAreaSize = SCAN_AREA_SIZE,
}: ScannerOverlayProps) {
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cornerOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (isActive) {
      // Scanning line animation
      const scanLineAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      // Corner pulse animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      // Corner opacity animation
      const opacityAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(cornerOpacity, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(cornerOpacity, {
            toValue: 0.7,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );

      scanLineAnimation.start();
      pulseAnimation.start();
      opacityAnimation.start();

      return () => {
        scanLineAnimation.stop();
        pulseAnimation.stop();
        opacityAnimation.stop();
      };
    } else {
      scanLineAnim.setValue(0);
      pulseAnim.setValue(1);
      cornerOpacity.setValue(0.5);
    }
  }, [isActive, scanLineAnim, pulseAnim, cornerOpacity]);

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, scanAreaSize - SCAN_LINE_HEIGHT * 2],
  });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Top overlay */}
      <View className="flex-1 bg-black/60" />

      {/* Middle section with scan area */}
      <View className="flex-row">
        {/* Left overlay */}
        <View className="flex-1 bg-black/60" />

        {/* Scan area */}
        <Animated.View
          style={[
            {
              width: scanAreaSize,
              height: scanAreaSize,
              transform: [{ scale: pulseAnim }],
            },
          ]}
          className="relative"
        >
          {/* Corner decorations - Top Left */}
          <Animated.View
            style={[
              styles.corner,
              styles.topLeft,
              { borderColor: accentColor, opacity: cornerOpacity },
            ]}
          />

          {/* Corner decorations - Top Right */}
          <Animated.View
            style={[
              styles.corner,
              styles.topRight,
              { borderColor: accentColor, opacity: cornerOpacity },
            ]}
          />

          {/* Corner decorations - Bottom Left */}
          <Animated.View
            style={[
              styles.corner,
              styles.bottomLeft,
              { borderColor: accentColor, opacity: cornerOpacity },
            ]}
          />

          {/* Corner decorations - Bottom Right */}
          <Animated.View
            style={[
              styles.corner,
              styles.bottomRight,
              { borderColor: accentColor, opacity: cornerOpacity },
            ]}
          />

          {/* Scan line */}
          {isActive && (
            <Animated.View
              style={[
                styles.scanLine,
                {
                  backgroundColor: accentColor,
                  transform: [{ translateY: scanLineTranslateY }],
                },
              ]}
            />
          )}

          {/* Inner frame glow effect */}
          <View
            style={[
              styles.innerGlow,
              { shadowColor: accentColor },
            ]}
          />
        </Animated.View>

        {/* Right overlay */}
        <View className="flex-1 bg-black/60" />
      </View>

      {/* Bottom overlay */}
      <View className="flex-1 bg-black/60" />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: 'absolute',
    left: CORNER_SIZE / 2,
    right: CORNER_SIZE / 2,
    height: SCAN_LINE_HEIGHT,
    borderRadius: SCAN_LINE_HEIGHT / 2,
  },
  innerGlow: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
});
