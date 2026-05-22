import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/lib/theme/tokens';

type ScreenStateProps = {
  label?: string;
};

export function LoadingScreen({ label = 'Loading' }: ScreenStateProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.text} size="small" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
