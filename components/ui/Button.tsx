import { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, PressableProps } from 'react-native';

import { borderWidths, colors, radius, spacing } from '@/theme/tokens';
import { Text } from './Text';

type Variant = 'filled' | 'outline' | 'locked';

type ButtonProps = PropsWithChildren<
  PressableProps & {
    variant?: Variant;
    label: string;
    loading?: boolean;
  }
>;

export function Button({ variant = 'filled', label, loading = false, style, disabled, ...rest }: ButtonProps) {
  const isLocked = variant === 'locked';
  const textColor = variant === 'filled' ? 'surface' : isLocked ? 'textSecondary' : 'textPrimary';

  return (
    <Pressable
      style={(pressState) => [
        styles.base,
        styles[variant],
        typeof style === 'function' ? style(pressState) : style,
      ]}
      disabled={disabled || isLocked || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'filled' ? colors.surface : colors.textPrimary} />
      ) : (
        <Text variant="label" color={textColor}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.none,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: {
    backgroundColor: colors.brandRed,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: borderWidths.structural,
    borderColor: colors.textPrimary,
  },
  locked: {
    backgroundColor: colors.surface,
    borderWidth: borderWidths.structural,
    borderColor: colors.border,
    opacity: 0.6,
  },
});
