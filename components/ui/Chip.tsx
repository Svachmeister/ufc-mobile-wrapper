import { StyleSheet, View, ViewProps } from 'react-native';

import { borderWidths, colors, radius, spacing } from '@/theme/tokens';
import { Text } from './Text';

type ChipProps = ViewProps & {
  label: string;
};

export function Chip({ label, style, ...rest }: ChipProps) {
  return (
    <View style={[styles.chip, style]} {...rest}>
      <Text variant="label">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: borderWidths.structural,
    borderColor: colors.border,
    borderRadius: radius.none,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
});
