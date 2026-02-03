import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic feedback utilities using expo-haptics
 * Provides consistent haptic feedback across the app
 */

// Check if haptics are available (iOS has better support)
const isHapticsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Light impact feedback - for UI interactions like button taps
 */
export async function impactLight(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
}

/**
 * Medium impact feedback - for more significant interactions
 */
export async function impactMedium(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
}

/**
 * Heavy impact feedback - for important or destructive actions
 */
export async function impactHeavy(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
}

/**
 * Selection feedback - for picker/selection changes
 */
export async function selection(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.selectionAsync();
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
}

/**
 * Success notification feedback - for successful operations
 * Use for: payment success, login success, successful scan, etc.
 */
export async function notificationSuccess(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
}

/**
 * Warning notification feedback - for warnings
 * Use for: low balance, invalid input, etc.
 */
export async function notificationWarning(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
}

/**
 * Error notification feedback - for errors
 * Use for: payment failed, scan failed, network error, etc.
 */
export async function notificationError(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
}

// Semantic aliases for common use cases
export const haptics = {
  // General feedback
  light: impactLight,
  medium: impactMedium,
  heavy: impactHeavy,
  selection,

  // Notification feedback
  success: notificationSuccess,
  warning: notificationWarning,
  error: notificationError,

  // UI-specific feedback
  buttonPress: impactLight,
  buttonPressHeavy: impactMedium,
  toggle: selection,
  tabChange: selection,
  sliderChange: selection,
  pullToRefreshTrigger: impactMedium,
  swipeAction: impactLight,

  // Payment-specific feedback
  paymentSuccess: notificationSuccess,
  paymentError: notificationError,
  insufficientFunds: notificationWarning,

  // Scan-specific feedback
  scanSuccess: notificationSuccess,
  scanError: notificationError,
  scanInProgress: impactLight,

  // NFC-specific feedback
  nfcDetected: impactMedium,
  nfcSuccess: notificationSuccess,
  nfcError: notificationError,

  // Ticket-specific feedback
  ticketValidated: notificationSuccess,
  ticketInvalid: notificationError,
  ticketAlreadyUsed: notificationWarning,

  // Social feedback
  friendRequestReceived: impactMedium,
  friendRequestAccepted: notificationSuccess,
  messageSent: impactLight,

  // List/scroll feedback
  endOfListReached: impactLight,
  itemDeleted: impactMedium,
  itemMoved: selection,
};

/**
 * Custom haptic pattern - series of haptic feedback
 * Useful for special celebrations or important events
 */
export async function celebrationPattern(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await notificationSuccess();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await impactLight();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await impactLight();
  } catch (error) {
    console.warn('Haptic celebration pattern failed:', error);
  }
}

/**
 * Double tap pattern
 */
export async function doubleTapPattern(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await impactLight();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await impactLight();
  } catch (error) {
    console.warn('Haptic double tap pattern failed:', error);
  }
}

/**
 * Countdown pattern (3, 2, 1)
 */
export async function countdownPattern(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await impactHeavy();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await impactMedium();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await impactLight();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await notificationSuccess();
  } catch (error) {
    console.warn('Haptic countdown pattern failed:', error);
  }
}

export default haptics;
