import { ReactNode } from 'react';
import { View, ViewStyle, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets, Edge } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';

export interface SafeAreaContainerProps {
  children: ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
  backgroundColor?: string;
  statusBarStyle?: 'light-content' | 'dark-content' | 'default';
  statusBarBackgroundColor?: string;
}

/**
 * Container that handles safe area insets consistently
 * Provides padding for notch/status bar and home indicator
 */
export function SafeAreaContainer({
  children,
  edges = ['top', 'bottom'],
  style,
  backgroundColor = colors.background,
  statusBarStyle = 'dark-content',
  statusBarBackgroundColor,
}: SafeAreaContainerProps) {
  const insets = useSafeAreaInsets();

  const paddingStyle: ViewStyle = {};

  if (edges.includes('top')) {
    paddingStyle.paddingTop = insets.top;
  }
  if (edges.includes('bottom')) {
    paddingStyle.paddingBottom = insets.bottom;
  }
  if (edges.includes('left')) {
    paddingStyle.paddingLeft = insets.left;
  }
  if (edges.includes('right')) {
    paddingStyle.paddingRight = insets.right;
  }

  return (
    <View style={[{ flex: 1, backgroundColor }, paddingStyle, style]}>
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor={statusBarBackgroundColor || backgroundColor}
        translucent={Platform.OS === 'android'}
      />
      {children}
    </View>
  );
}

/**
 * Container for screens with custom headers
 * Only applies bottom safe area padding
 */
export function ScreenContainer({
  children,
  style,
  backgroundColor = colors.background,
}: {
  children: ReactNode;
  style?: ViewStyle;
  backgroundColor?: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor,
          paddingBottom: insets.bottom,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Header container with proper safe area handling
 */
export interface HeaderContainerProps {
  children: ReactNode;
  backgroundColor?: string;
  style?: ViewStyle;
  statusBarStyle?: 'light-content' | 'dark-content';
}

export function HeaderContainer({
  children,
  backgroundColor = colors.primary.DEFAULT,
  style,
  statusBarStyle = 'light-content',
}: HeaderContainerProps) {
  const insets = useSafeAreaInsets();
  const isLightBg = statusBarStyle === 'dark-content';

  return (
    <View
      style={[
        {
          backgroundColor,
          paddingTop: insets.top,
        },
        style,
      ]}
    >
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor={backgroundColor}
        translucent={Platform.OS === 'android'}
      />
      {children}
    </View>
  );
}

/**
 * Bottom button container with safe area handling
 * Perfect for fixed bottom buttons/actions
 */
export function BottomActionContainer({
  children,
  style,
  backgroundColor = colors.surface,
  withBorder = true,
}: {
  children: ReactNode;
  style?: ViewStyle;
  backgroundColor?: string;
  withBorder?: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          backgroundColor,
          paddingBottom: Math.max(insets.bottom, 16),
          paddingTop: 16,
          paddingHorizontal: 16,
          borderTopWidth: withBorder ? 1 : 0,
          borderTopColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Hook to get safe area values with default minimums
 */
export function useSafeArea() {
  const insets = useSafeAreaInsets();

  return {
    top: insets.top,
    bottom: Math.max(insets.bottom, 16),
    left: insets.left,
    right: insets.right,
    // With minimum padding
    safeTop: Math.max(insets.top, 20),
    safeBottom: Math.max(insets.bottom, 20),
  };
}

export default SafeAreaContainer;
