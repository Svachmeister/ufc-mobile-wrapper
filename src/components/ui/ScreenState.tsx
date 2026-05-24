import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/lib/theme/tokens';

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
      <ActivityIndicator color={colors.text} size="small" />
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
    <View style={styles.container}>
      <View style={styles.panel}>
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
    backgroundColor: colors.accent,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 46,
    paddingHorizontal: 18,
  },
  buttonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  message: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'center',
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderTopColor: colors.accent,
    borderTopWidth: 2,
    borderWidth: 1,
    marginHorizontal: 24,
    padding: 20,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
