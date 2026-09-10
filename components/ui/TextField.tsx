import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { borderWidths, colors, radius, spacing, typography } from '@/theme/tokens';
import { Text } from './Text';

type Appearance = 'light' | 'dark';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  appearance?: Appearance;
};

// Dark-appearance tones, local to this primitive — theme/tokens.ts is outside
// this ticket's editable scope, and these colours are not used anywhere else.
const DARK_BORDER = 'rgba(255, 255, 255, 0.35)';
const DARK_MUTED_TEXT = 'rgba(255, 255, 255, 0.6)';

export function TextField({
  label,
  error,
  appearance = 'light',
  style,
  editable = true,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const isDark = appearance === 'dark';

  const borderColor = error
    ? colors.brandRed
    : isDark
      ? isFocused
        ? colors.surface
        : DARK_BORDER
      : colors.border;

  return (
    <View style={styles.container}>
      <Text variant="label" style={[styles.label, isDark && styles.labelDark]}>
        {label}
      </Text>
      <TextInput
        style={[
          styles.input,
          { borderColor },
          isDark && styles.inputDark,
          !editable ? styles.inputDisabled : null,
          style,
        ]}
        editable={editable}
        placeholderTextColor={isDark ? DARK_MUTED_TEXT : colors.textSecondary}
        keyboardAppearance={isDark ? 'dark' : 'default'}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        {...rest}
      />
      {error ? (
        <Text variant="body" color="brandRed" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
  },
  labelDark: {
    color: DARK_MUTED_TEXT,
  },
  input: {
    borderWidth: borderWidths.structural,
    borderColor: colors.border,
    borderRadius: radius.none,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },
  inputDark: {
    color: colors.surface,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  error: {
    marginTop: spacing.xs,
  },
});
