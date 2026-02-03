/**
 * Theme constants for consistent UI across the app
 * Use these values instead of magic numbers
 */

// Color palette (matching tailwind.config.js)
export const colors = {
  primary: {
    DEFAULT: '#6366F1',
    50: '#ECEEFF',
    100: '#D8DCFE',
    200: '#B2B9FD',
    300: '#8B95FC',
    400: '#6572FB',
    500: '#6366F1',
    600: '#3538CD',
    700: '#2A2D9F',
    800: '#1F2171',
    900: '#141643',
  },
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  // Grays
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Semantic colors
  background: '#F9FAFB',
  surface: '#FFFFFF',
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    disabled: '#9CA3AF',
    inverse: '#FFFFFF',
  },
  border: '#E5E7EB',
};

// Spacing scale (4px base unit)
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
} as const;

// Semantic spacing
export const layout = {
  screenPadding: spacing[4], // 16px
  cardPadding: spacing[4], // 16px
  sectionSpacing: spacing[6], // 24px
  itemSpacing: spacing[3], // 12px
  iconSpacing: spacing[2], // 8px
  inputPadding: spacing[3], // 12px
};

// Border radius
export const borderRadius = {
  none: 0,
  sm: 4,
  DEFAULT: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

// Typography
export const typography = {
  // Font sizes
  size: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },

  // Line heights
  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  // Font weights (as strings for React Native)
  weight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

// Shadows
export const shadows = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  DEFAULT: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
};

// Animation durations
export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: {
    friction: 8,
    tension: 40,
  },
};

// Z-index scale
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
};

// Icon sizes
export const iconSize = {
  xs: 12,
  sm: 16,
  DEFAULT: 20,
  md: 24,
  lg: 32,
  xl: 48,
};

// Hit slop for touchable elements
export const hitSlop = {
  small: { top: 8, right: 8, bottom: 8, left: 8 },
  medium: { top: 12, right: 12, bottom: 12, left: 12 },
  large: { top: 16, right: 16, bottom: 16, left: 16 },
};

// Default component styles
export const componentStyles = {
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: layout.cardPadding,
    ...shadows.sm,
  },
  input: {
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.xl,
    paddingHorizontal: layout.inputPadding,
    paddingVertical: layout.inputPadding,
    fontSize: typography.size.base,
    color: colors.text.primary,
  },
  button: {
    primary: {
      backgroundColor: colors.primary.DEFAULT,
      borderRadius: borderRadius.xl,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
    },
    secondary: {
      backgroundColor: colors.gray[100],
      borderRadius: borderRadius.xl,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
    },
  },
};

// Export a theme object for convenience
const theme = {
  colors,
  spacing,
  layout,
  borderRadius,
  typography,
  shadows,
  animation,
  zIndex,
  iconSize,
  hitSlop,
  componentStyles,
};

export default theme;
