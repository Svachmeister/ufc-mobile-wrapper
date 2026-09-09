import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, PressableProps } from 'react-native';

import { borderWidths, colors, radius, spacing } from '@/theme/tokens';
import { Text } from './Text';

type Variant = 'filled' | 'outline' | 'locked';

type ButtonProps = PropsWithChildren<
  PressableProps & {
    variant?: Variant;
    label: string;
  }
>;

export function Button({ variant = 'filled', label, style, disabled, ...rest }: ButtonProps) {
  const isLocked = variant === 'locked';

  return (
    <Pressable
      style={(pressState) => [
        styles.base,
        styles[variant],
        typeof style === 'function' ? style(pressState) : style,
      ]}
      disabled={disabled || isLocked}
      {...rest}
    >
      <Text variant="label" color={variant === 'filled' ? 'surface' : isLocked ? 'textSecondary' : 'textPrimary'}>
        {label}
      </Text>
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
