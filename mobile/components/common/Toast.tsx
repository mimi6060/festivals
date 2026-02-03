import { useEffect, useRef, useCallback, createContext, useContext, useState, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Toast types
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastConfig {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastItemProps {
  toast: ToastConfig;
  onDismiss: (id: string) => void;
}

// Toast configuration by type
const toastStyles: Record<ToastType, {
  icon: keyof typeof Ionicons.glyphMap;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  titleColor: string;
  textColor: string;
}> = {
  success: {
    icon: 'checkmark-circle',
    bgColor: '#F0FDF4',
    borderColor: '#22C55E',
    iconColor: '#22C55E',
    titleColor: '#166534',
    textColor: '#15803D',
  },
  error: {
    icon: 'close-circle',
    bgColor: '#FEF2F2',
    borderColor: '#EF4444',
    iconColor: '#EF4444',
    titleColor: '#991B1B',
    textColor: '#DC2626',
  },
  info: {
    icon: 'information-circle',
    bgColor: '#EFF6FF',
    borderColor: '#3B82F6',
    iconColor: '#3B82F6',
    titleColor: '#1E40AF',
    textColor: '#2563EB',
  },
  warning: {
    icon: 'warning',
    bgColor: '#FFFBEB',
    borderColor: '#F59E0B',
    iconColor: '#F59E0B',
    titleColor: '#92400E',
    textColor: '#D97706',
  },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOAST_WIDTH = SCREEN_WIDTH - 32;

/**
 * Individual Toast component with animations
 */
function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  const style = toastStyles[toast.type];
  const duration = toast.duration || 4000;

  // Pan responder for swipe to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > TOAST_WIDTH * 0.3) {
          // Swipe out
          Animated.timing(translateX, {
            toValue: gestureState.dx > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onDismiss(toast.id));
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            friction: 6,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      dismissToast();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const dismissToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(toast.id));
  }, [toast.id, onDismiss]);

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          transform: [{ translateY }, { translateX }],
          opacity,
          backgroundColor: style.bgColor,
          borderLeftColor: style.borderColor,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.toastContent}>
        <Ionicons name={style.icon} size={24} color={style.iconColor} />
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: style.titleColor }]}>
            {toast.title}
          </Text>
          {toast.message && (
            <Text style={[styles.message, { color: style.textColor }]}>
              {toast.message}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={dismissToast} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={style.iconColor} />
        </TouchableOpacity>
      </View>

      {toast.action && (
        <TouchableOpacity
          onPress={() => {
            toast.action?.onPress();
            dismissToast();
          }}
          style={[styles.actionButton, { borderTopColor: style.borderColor }]}
        >
          <Text style={[styles.actionText, { color: style.iconColor }]}>
            {toast.action.label}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// Toast Context
interface ToastContextType {
  showToast: (config: Omit<ToastConfig, 'id'>) => string;
  hideToast: (id: string) => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
}

const ToastContext = createContext<ToastContextType | null>(null);

/**
 * Toast Provider component - wrap your app with this
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastConfig[]>([]);
  const insets = useSafeAreaInsets();

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const showToast = useCallback((config: Omit<ToastConfig, 'id'>) => {
    const id = generateId();
    setToasts((prev) => [...prev, { ...config, id }]);
    return id;
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((title: string, message?: string) => {
    return showToast({ type: 'success', title, message });
  }, [showToast]);

  const error = useCallback((title: string, message?: string) => {
    return showToast({ type: 'error', title, message });
  }, [showToast]);

  const info = useCallback((title: string, message?: string) => {
    return showToast({ type: 'info', title, message });
  }, [showToast]);

  const warning = useCallback((title: string, message?: string) => {
    return showToast({ type: 'warning', title, message });
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast, success, error, info, warning }}>
      {children}
      <View
        style={[
          styles.toastWrapper,
          { top: insets.top + 8 },
        ]}
        pointerEvents="box-none"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={hideToast}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

/**
 * Hook to use toast notifications
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toastContainer: {
    width: '100%',
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  message: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default { ToastProvider, useToast };
