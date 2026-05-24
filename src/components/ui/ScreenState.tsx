import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/src/lib/theme/tokens';

type ScreenStateProps = {
  actionLabel?: string;
  label?: string;
  message?: string;
  onAction?: () => void;
  title?: string;
};

export function LoadingScreen({ label = 'Loading' }: ScreenStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.loadingMark}>
        <ActivityIndicator color={colors.red} size="small" />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function ScreenState({
  actionLabel,
  message,
  onAction,
  title = 'Nothing here yet',
}: ScreenStateProps) {
  return (
    <View style={styles.stateWrap}>
      <View style={styles.panel}>
        <Text style={styles.kicker}>Fight Card Society</Text>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {actionLabel && onAction ? (
          <Pressable style={styles.button} onPress={onAction}>
            <Text style={styles.buttonText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.red,
    borderColor: colors.red,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: spacing.controlHeight,
    paddingHorizontal: 18,
  },
  buttonText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  container: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    flex: 1,
    justifyContent: 'center',
  },
  kicker: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  label: {
    color: colors.gray700,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  loadingMark: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderTopColor: colors.ink,
    borderTopWidth: 3,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  message: {
    color: colors.gray700,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 10,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderTopColor: colors.red,
    borderTopWidth: 3,
    borderWidth: 1,
    marginHorizontal: 22,
    padding: 18,
  },
  stateWrap: {
    backgroundColor: colors.canvas,
    paddingVertical: 6,
  },
  title: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.2,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
});
