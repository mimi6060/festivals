import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSyncStore, SyncResult } from '@/stores/syncStore';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export type SyncState = 'idle' | 'syncing' | 'success' | 'error' | 'cancelled';

interface SyncProgressOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Callback when overlay is dismissed */
  onClose: () => void;
  /** Whether the sync operation can be cancelled */
  cancellable?: boolean;
  /** Callback when cancel button is pressed */
  onCancel?: () => void;
  /** Auto-dismiss delay after completion (ms). Set to 0 to disable. */
  autoDismissDelay?: number;
  /** Custom title */
  title?: string;
}

const AUTO_DISMISS_DELAY = 2000;

/**
 * SyncProgressOverlay - Modal overlay showing sync progress
 * Displays progress indicator, cancel button, and success/failure feedback
 */
export default function SyncProgressOverlay({
  visible,
  onClose,
  cancellable = true,
  onCancel,
  autoDismissDelay = AUTO_DISMISS_DELAY,
  title = 'Synchronisation',
}: SyncProgressOverlayProps) {
  const { isSyncing, syncStatus, pendingCount, syncError } = useNetworkStatus();
  const { pendingTransactions, syncPendingTransactions } = useSyncStore();

  // Local state
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [isCancelled, setIsCancelled] = useState(false);

  // Animation values
  const progressWidth = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const spinRotation = useSharedValue(0);
  const errorShake = useSharedValue(0);

  // Start sync when overlay becomes visible
  useEffect(() => {
    if (visible && syncState === 'idle' && pendingTransactions.length > 0) {
      startSync();
    }
  }, [visible]);

  // Reset state when overlay closes
  useEffect(() => {
    if (!visible) {
      setSyncState('idle');
      setSyncResult(null);
      setProgress(0);
      setIsCancelled(false);
      progressWidth.value = 0;
      checkScale.value = 0;
    }
  }, [visible, progressWidth, checkScale]);

  // Spinner animation
  useEffect(() => {
    if (syncState === 'syncing') {
      spinRotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    }
  }, [syncState, spinRotation]);

  // Success checkmark animation
  useEffect(() => {
    if (syncState === 'success') {
      checkScale.value = withSpring(1, {
        damping: 10,
        stiffness: 200,
      });
    }
  }, [syncState, checkScale]);

  // Error shake animation
  useEffect(() => {
    if (syncState === 'error') {
      errorShake.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 100 }),
        withTiming(-10, { duration: 100 }),
        withTiming(10, { duration: 100 }),
        withTiming(0, { duration: 50 })
      );
    }
  }, [syncState, errorShake]);

  // Auto-dismiss on completion
  useEffect(() => {
    if ((syncState === 'success' || syncState === 'cancelled') && autoDismissDelay > 0) {
      const timeoutId = setTimeout(() => {
        onClose();
      }, autoDismissDelay);
      return () => clearTimeout(timeoutId);
    }
  }, [syncState, autoDismissDelay, onClose]);

  /**
   * Start the sync process
   */
  const startSync = async () => {
    setIsCancelled(false);
    setSyncState('syncing');
    setProgress(0);
    progressWidth.value = 0;

    try {
      // Animate progress
      const totalCount = pendingTransactions.length;
      progressWidth.value = withTiming(100, { duration: totalCount * 500 + 500 });

      const result = await syncPendingTransactions();

      if (isCancelled) {
        setSyncState('cancelled');
        return;
      }

      setSyncResult(result);

      if (result.success) {
        setSyncState('success');
        progressWidth.value = withTiming(100, { duration: 200 });
      } else {
        setSyncState('error');
      }
    } catch (error) {
      if (!isCancelled) {
        setSyncState('error');
        setSyncResult({
          success: false,
          syncedCount: 0,
          failedCount: pendingTransactions.length,
          errors: [{ id: '', error: error instanceof Error ? error.message : 'Unknown error' }],
        });
      }
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    setIsCancelled(true);
    setSyncState('cancelled');
    if (onCancel) {
      onCancel();
    }
  };

  /**
   * Handle retry
   */
  const handleRetry = () => {
    startSync();
  };

  // Animated styles
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinRotation.value}deg` }],
  }));

  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const errorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: errorShake.value }],
  }));

  // Render status icon
  const renderStatusIcon = () => {
    switch (syncState) {
      case 'syncing':
        return (
          <Animated.View style={spinnerStyle}>
            <Ionicons name="sync" size={48} color="#3B82F6" />
          </Animated.View>
        );
      case 'success':
        return (
          <Animated.View style={checkmarkStyle}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={32} color="#FFFFFF" />
            </View>
          </Animated.View>
        );
      case 'error':
        return (
          <Animated.View style={errorStyle}>
            <View style={styles.errorCircle}>
              <Ionicons name="close" size={32} color="#FFFFFF" />
            </View>
          </Animated.View>
        );
      case 'cancelled':
        return (
          <View style={styles.cancelledCircle}>
            <Ionicons name="stop" size={32} color="#FFFFFF" />
          </View>
        );
      default:
        return <ActivityIndicator size="large" color="#3B82F6" />;
    }
  };

  // Render status text
  const renderStatusText = () => {
    switch (syncState) {
      case 'syncing':
        return {
          title: 'Synchronisation en cours...',
          subtitle: `${pendingTransactions.length} element${pendingTransactions.length > 1 ? 's' : ''} a synchroniser`,
        };
      case 'success':
        return {
          title: 'Synchronisation reussie',
          subtitle: syncResult
            ? `${syncResult.syncedCount} element${syncResult.syncedCount > 1 ? 's' : ''} synchronise${syncResult.syncedCount > 1 ? 's' : ''}`
            : 'Tous les elements sont a jour',
        };
      case 'error':
        return {
          title: 'Erreur de synchronisation',
          subtitle: syncResult
            ? `${syncResult.failedCount} element${syncResult.failedCount > 1 ? 's' : ''} non synchronise${syncResult.failedCount > 1 ? 's' : ''}`
            : syncError || 'Une erreur est survenue',
        };
      case 'cancelled':
        return {
          title: 'Synchronisation annulee',
          subtitle: 'Les elements restants seront synchronises plus tard',
        };
      default:
        return {
          title: 'Preparation...',
          subtitle: '',
        };
    }
  };

  const statusText = renderStatusText();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={syncState !== 'syncing' ? onClose : undefined}
        />

        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown.duration(200)}
          style={styles.modal}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            {syncState !== 'syncing' && (
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Status Icon */}
            <View style={styles.iconContainer}>
              {renderStatusIcon()}
            </View>

            {/* Status Text */}
            <Text style={styles.statusTitle}>{statusText.title}</Text>
            {statusText.subtitle && (
              <Text style={styles.statusSubtitle}>{statusText.subtitle}</Text>
            )}

            {/* Progress Bar */}
            {syncState === 'syncing' && (
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <Animated.View style={[styles.progressBar, progressBarStyle]} />
                </View>
              </View>
            )}

            {/* Error Details */}
            {syncState === 'error' && syncResult && syncResult.errors.length > 0 && (
              <View style={styles.errorDetails}>
                {syncResult.errors.slice(0, 3).map((err, index) => (
                  <Text key={index} style={styles.errorText} numberOfLines={1}>
                    {err.error}
                  </Text>
                ))}
                {syncResult.errors.length > 3 && (
                  <Text style={styles.errorMore}>
                    +{syncResult.errors.length - 3} autres erreurs
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {syncState === 'syncing' && cancellable && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            )}

            {syncState === 'error' && (
              <>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryButtonText}>Fermer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleRetry}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Reessayer</Text>
                </TouchableOpacity>
              </>
            )}

            {(syncState === 'success' || syncState === 'cancelled') && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.primaryButtonText}>Fermer</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/**
 * Compact sync trigger button
 */
export function SyncButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  const { isSyncing, pendingCount, isConnected } = useNetworkStatus();

  const isDisabled = disabled || isSyncing || !isConnected || pendingCount === 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.syncButton, isDisabled && styles.syncButtonDisabled]}
      activeOpacity={0.7}
    >
      <Ionicons
        name={isSyncing ? 'sync' : 'refresh'}
        size={18}
        color={isDisabled ? '#9CA3AF' : '#FFFFFF'}
      />
      <Text
        style={[
          styles.syncButtonText,
          isDisabled && styles.syncButtonTextDisabled,
        ]}
      >
        {isSyncing ? 'Sync...' : 'Synchroniser'}
      </Text>
      {pendingCount > 0 && !isSyncing && (
        <View style={[styles.syncBadge, isDisabled && styles.syncBadgeDisabled]}>
          <Text style={styles.syncBadgeText}>{pendingCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * Mini sync status with progress
 */
export function SyncProgress() {
  const { isSyncing, pendingCount } = useNetworkStatus();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isSyncing) {
      progress.value = withRepeat(
        withTiming(100, { duration: 2000 }),
        -1,
        false
      );
    } else {
      progress.value = 0;
    }
  }, [isSyncing, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  if (!isSyncing && pendingCount === 0) {
    return null;
  }

  return (
    <View style={styles.miniProgress}>
      {isSyncing ? (
        <>
          <View style={styles.miniProgressTrack}>
            <Animated.View style={[styles.miniProgressBar, progressStyle]} />
          </View>
          <Text style={styles.miniProgressText}>Sync...</Text>
        </>
      ) : (
        <Text style={styles.miniProgressText}>
          {pendingCount} en attente
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelledCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginTop: 24,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  errorDetails: {
    width: '100%',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#991B1B',
    marginBottom: 4,
  },
  errorMore: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#3B82F6',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Sync button styles
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  syncButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  syncButtonTextDisabled: {
    color: '#9CA3AF',
  },
  syncBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  syncBadgeDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Mini progress styles
  miniProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniProgressTrack: {
    width: 60,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressBar: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  miniProgressText: {
    fontSize: 12,
    color: '#6B7280',
  },
});
