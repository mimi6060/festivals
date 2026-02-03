import { forwardRef } from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  Pressable,
  PressableProps,
  View,
  Text,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import haptics from '@/lib/haptics';

export interface HapticButtonProps extends TouchableOpacityProps {
  hapticType?: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error' | 'none';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const hapticHandlers = {
  light: haptics.light,
  medium: haptics.medium,
  heavy: haptics.heavy,
  selection: haptics.selection,
  success: haptics.success,
  warning: haptics.warning,
  error: haptics.error,
  none: () => {},
};

/**
 * TouchableOpacity with built-in haptic feedback
 */
export const HapticTouchable = forwardRef<View, HapticButtonProps>(
  ({ hapticType = 'light', onPress, disabled, ...props }, ref) => {
    const handlePress = async (event: any) => {
      if (disabled) return;
      await hapticHandlers[hapticType]();
      onPress?.(event);
    };

    return (
      <TouchableOpacity
        ref={ref}
        onPress={handlePress}
        disabled={disabled}
        {...props}
      />
    );
  }
);

/**
 * Styled button with haptic feedback
 */
export function HapticButton({
  hapticType = 'light',
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  children,
  onPress,
  className = '',
  style,
  ...props
}: HapticButtonProps & { children?: React.ReactNode }) {
  const handlePress = async (event: any) => {
    if (disabled || loading) return;
    await hapticHandlers[hapticType]();
    onPress?.(event);
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-2',
    md: 'px-4 py-3',
    lg: 'px-6 py-4',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  // Variant classes
  const variantClasses = {
    primary: disabled ? 'bg-gray-300' : 'bg-primary',
    secondary: disabled ? 'bg-gray-200' : 'bg-gray-100',
    outline: disabled ? 'border border-gray-300' : 'border border-primary',
    ghost: '',
    danger: disabled ? 'bg-gray-300' : 'bg-danger',
  };

  const textVariantClasses = {
    primary: 'text-white',
    secondary: disabled ? 'text-gray-400' : 'text-gray-900',
    outline: disabled ? 'text-gray-400' : 'text-primary',
    ghost: disabled ? 'text-gray-400' : 'text-primary',
    danger: 'text-white',
  };

  const iconColors = {
    primary: '#FFFFFF',
    secondary: disabled ? '#9CA3AF' : '#111827',
    outline: disabled ? '#9CA3AF' : '#6366F1',
    ghost: disabled ? '#9CA3AF' : '#6366F1',
    danger: '#FFFFFF',
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      className={`
        rounded-xl flex-row items-center justify-center
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      style={style}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={iconColors[variant]}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={iconSizes[size]}
              color={iconColors[variant]}
              style={{ marginRight: 8 }}
            />
          )}
          {typeof children === 'string' ? (
            <Text
              className={`font-semibold ${textSizeClasses[size]} ${textVariantClasses[variant]}`}
            >
              {children}
            </Text>
          ) : (
            children
          )}
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={iconSizes[size]}
              color={iconColors[variant]}
              style={{ marginLeft: 8 }}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

/**
 * Icon button with haptic feedback
 */
export interface HapticIconButtonProps extends TouchableOpacityProps {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  backgroundColor?: string;
  hapticType?: 'light' | 'medium' | 'heavy' | 'selection' | 'none';
}

export function HapticIconButton({
  icon,
  size = 24,
  color = '#6366F1',
  backgroundColor,
  hapticType = 'light',
  disabled,
  onPress,
  className = '',
  style,
  ...props
}: HapticIconButtonProps) {
  const handlePress = async (event: any) => {
    if (disabled) return;
    if (hapticType !== 'none') {
      await hapticHandlers[hapticType]();
    }
    onPress?.(event);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      className={`items-center justify-center ${className}`}
      style={[
        backgroundColor ? { backgroundColor, borderRadius: size } : undefined,
        { width: size * 1.5, height: size * 1.5 },
        style,
      ]}
      {...props}
    >
      <Ionicons
        name={icon}
        size={size}
        color={disabled ? '#9CA3AF' : color}
      />
    </TouchableOpacity>
  );
}

export default HapticButton;
