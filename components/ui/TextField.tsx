import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
const DARK_INPUT_BACKGROUND = '#1C1C1E';
const TOGGLE_TOUCH_TARGET = 44;

export function TextField({
  label,
  error,
  appearance = 'light',
  style,
  editable = true,
  secureTextEntry = false,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isDark = appearance === 'dark';
  const isPasswordField = secureTextEntry;
  const showToggle = isDark && isPasswordField;

  const borderColor = error
    ? colors.brandRed
    : isDark
      ? isFocused
        ? colors.surface
        : DARK_BORDER
      : colors.border;

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <Text variant="label" style={[styles.label, isDark && styles.labelDark]}>
        {label}
      </Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={[
            styles.input,
            { borderColor },
            isDark && styles.inputDark,
            showToggle && styles.inputWithToggle,
            !editable ? styles.inputDisabled : null,
            style,
          ]}
          editable={editable}
          placeholderTextColor={isDark ? DARK_MUTED_TEXT : colors.textSecondary}
          keyboardAppearance={isDark ? 'dark' : 'default'}
          secureTextEntry={isPasswordField ? !isPasswordVisible : secureTextEntry}
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
        {showToggle ? (
          <Pressable
            onPress={() => setIsPasswordVisible((visible) => !visible)}
            style={styles.toggle}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
          >
            <Ionicons name={isPasswordVisible ? 'eye-off' : 'eye'} size={20} color={DARK_MUTED_TEXT} />
          </Pressable>
        ) : null}
      </View>
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
  containerDark: {
    marginBottom: spacing.sm,
  },
  label: {
    marginBottom: spacing.xs,
  },
  labelDark: {
    color: DARK_MUTED_TEXT,
  },
  inputWrap: {
    justifyContent: 'center',
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
    height: 52,
    backgroundColor: DARK_INPUT_BACKGROUND,
    color: colors.surface,
  },
  inputWithToggle: {
    paddingRight: TOGGLE_TOUCH_TARGET,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  toggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: TOGGLE_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    marginTop: spacing.xs,
  },
});
