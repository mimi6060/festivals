import { useEffect, useRef, useState, memo } from 'react';
import { Text, TextStyle, Animated, Easing } from 'react-native';

export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  precision?: number;
  prefix?: string;
  suffix?: string;
  style?: TextStyle;
  className?: string;
  formatter?: (value: number) => string;
  easing?: (value: number) => number;
  onAnimationComplete?: () => void;
}

/**
 * Animated number counter component
 * Smoothly animates between number values
 * Perfect for wallet balance, stats, counters, etc.
 */
export const AnimatedNumber = memo(function AnimatedNumber({
  value,
  duration = 500,
  precision = 0,
  prefix = '',
  suffix = '',
  style,
  className,
  formatter,
  easing = Easing.out(Easing.cubic),
  onAnimationComplete,
}: AnimatedNumberProps) {
  const animatedValue = useRef(new Animated.Value(value)).current;
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const startValue = previousValue.current;
    previousValue.current = value;

    // If same value, no animation needed
    if (startValue === value) return;

    // Create animation
    const animation = Animated.timing(animatedValue, {
      toValue: value,
      duration,
      easing,
      useNativeDriver: false, // Can't use native driver for text
    });

    // Listen to animation value changes
    const listenerId = animatedValue.addListener(({ value: currentValue }) => {
      setDisplayValue(currentValue);
    });

    animation.start(({ finished }) => {
      if (finished) {
        setDisplayValue(value);
        onAnimationComplete?.();
      }
    });

    return () => {
      animatedValue.removeListener(listenerId);
      animation.stop();
    };
  }, [value, duration, easing, onAnimationComplete]);

  // Format the display value
  const formattedValue = formatter
    ? formatter(displayValue)
    : displayValue.toFixed(precision);

  return (
    <Text style={style} className={className}>
      {prefix}
      {formattedValue}
      {suffix}
    </Text>
  );
});

/**
 * Animated currency display
 * Specialized for currency/wallet balance display
 */
export interface AnimatedCurrencyProps {
  value: number;
  currency?: string;
  currencyPosition?: 'before' | 'after';
  duration?: number;
  style?: TextStyle;
  className?: string;
  showSign?: boolean; // Show +/- sign
  signClassName?: string;
  onAnimationComplete?: () => void;
}

export const AnimatedCurrency = memo(function AnimatedCurrency({
  value,
  currency = 'EUR',
  currencyPosition = 'after',
  duration = 500,
  style,
  className,
  showSign = false,
  onAnimationComplete,
}: AnimatedCurrencyProps) {
  const animatedValue = useRef(new Animated.Value(value)).current;
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const startValue = previousValue.current;
    previousValue.current = value;

    if (startValue === value) return;

    const animation = Animated.timing(animatedValue, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    const listenerId = animatedValue.addListener(({ value: currentValue }) => {
      setDisplayValue(currentValue);
    });

    animation.start(({ finished }) => {
      if (finished) {
        setDisplayValue(value);
        onAnimationComplete?.();
      }
    });

    return () => {
      animatedValue.removeListener(listenerId);
      animation.stop();
    };
  }, [value, duration, onAnimationComplete]);

  const formattedValue = displayValue.toFixed(2);
  const sign = showSign && value !== 0 ? (value > 0 ? '+' : '') : '';
  const displayText =
    currencyPosition === 'before'
      ? `${currency} ${sign}${formattedValue}`
      : `${sign}${formattedValue} ${currency}`;

  return (
    <Text style={style} className={className}>
      {displayText}
    </Text>
  );
});

/**
 * Animated percentage display
 */
export interface AnimatedPercentageProps {
  value: number; // 0-100
  duration?: number;
  precision?: number;
  style?: TextStyle;
  className?: string;
  onAnimationComplete?: () => void;
}

export const AnimatedPercentage = memo(function AnimatedPercentage({
  value,
  duration = 500,
  precision = 0,
  style,
  className,
  onAnimationComplete,
}: AnimatedPercentageProps) {
  return (
    <AnimatedNumber
      value={value}
      duration={duration}
      precision={precision}
      suffix="%"
      style={style}
      className={className}
      onAnimationComplete={onAnimationComplete}
    />
  );
});

/**
 * Animated countdown timer
 */
export interface AnimatedCountdownProps {
  seconds: number;
  onComplete?: () => void;
  style?: TextStyle;
  className?: string;
  format?: 'seconds' | 'mm:ss' | 'hh:mm:ss';
}

export function AnimatedCountdown({
  seconds: initialSeconds,
  onComplete,
  style,
  className,
  format = 'mm:ss',
}: AnimatedCountdownProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) {
      onComplete?.();
      return;
    }

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (totalSeconds: number): string => {
    if (format === 'seconds') {
      return `${totalSeconds}`;
    }

    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (format === 'hh:mm:ss') {
      return `${hours.toString().padStart(2, '0')}:${mins
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // mm:ss format
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  return (
    <Text style={style} className={className}>
      {formatTime(seconds)}
    </Text>
  );
}

/**
 * Animated stat with label
 */
export interface AnimatedStatProps {
  value: number;
  label: string;
  duration?: number;
  precision?: number;
  prefix?: string;
  suffix?: string;
  valueStyle?: TextStyle;
  labelStyle?: TextStyle;
  valueClassName?: string;
  labelClassName?: string;
}

export const AnimatedStat = memo(function AnimatedStat({
  value,
  label,
  duration = 500,
  precision = 0,
  prefix = '',
  suffix = '',
  valueStyle,
  labelStyle,
  valueClassName = 'text-3xl font-bold text-gray-900',
  labelClassName = 'text-sm text-gray-500 mt-1',
}: AnimatedStatProps) {
  return (
    <>
      <AnimatedNumber
        value={value}
        duration={duration}
        precision={precision}
        prefix={prefix}
        suffix={suffix}
        style={valueStyle}
        className={valueClassName}
      />
      <Text style={labelStyle} className={labelClassName}>
        {label}
      </Text>
    </>
  );
});

export default AnimatedNumber;
