import { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { borderWidths, colors, radius, spacing } from '@/theme/tokens';

export function Card({ style, children, ...rest }: PropsWithChildren<ViewProps>) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: borderWidths.structural,
    borderColor: colors.border,
    borderRadius: radius.none,
    padding: spacing.md,
  },
});
