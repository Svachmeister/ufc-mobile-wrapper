import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { borderWidths, colors, radius, spacing, typography } from '@/theme/tokens';
import { Text } from './Text';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function TextField({ label, error, style, editable = true, ...rest }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text variant="label" style={styles.label}>
        {label}
      </Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, !editable ? styles.inputDisabled : null, style]}
        editable={editable}
        placeholderTextColor={colors.textSecondary}
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
  inputError: {
    borderColor: colors.brandRed,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  error: {
    marginTop: spacing.xs,
  },
});
