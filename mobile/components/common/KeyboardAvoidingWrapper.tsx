import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  View,
  ViewStyle,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface KeyboardAvoidingWrapperProps {
  children: ReactNode;
  scrollEnabled?: boolean;
  dismissOnTouch?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  keyboardVerticalOffset?: number;
}

/**
 * Wrapper component that handles keyboard avoiding behavior consistently
 * across iOS and Android platforms
 */
export function KeyboardAvoidingWrapper({
  children,
  scrollEnabled = true,
  dismissOnTouch = true,
  style,
  contentContainerStyle,
  keyboardVerticalOffset = 0,
}: KeyboardAvoidingWrapperProps) {
  const insets = useSafeAreaInsets();

  // Default offset accounts for header height on iOS
  const defaultOffset = Platform.OS === 'ios' ? 64 : 0;
  const offset = keyboardVerticalOffset || defaultOffset;

  const content = scrollEnabled ? (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: insets.bottom },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.container, style]}>{children}</View>
  );

  const wrapped = dismissOnTouch ? (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      {content}
    </TouchableWithoutFeedback>
  ) : (
    content
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={offset}
    >
      {wrapped}
    </KeyboardAvoidingView>
  );
}

/**
 * Simple keyboard dismisser component
 * Wraps content and dismisses keyboard when tapped outside inputs
 */
export function DismissKeyboard({ children }: { children: ReactNode }) {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>{children}</View>
    </TouchableWithoutFeedback>
  );
}

/**
 * Hook to get keyboard avoiding view offset based on header
 */
export function useKeyboardOffset(hasHeader: boolean = true): number {
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'android') {
    return 0;
  }

  // iOS: account for status bar and header
  return hasHeader ? insets.top + 44 : insets.top;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
});

export default KeyboardAvoidingWrapper;
