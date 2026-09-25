import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { borderWidths, colors, radius, spacing } from '@/theme/tokens';
import { parallelChipLabel, type ParallelInfo } from '@/lib/cards/cardGrouping';

export function ParallelChip({ parallel }: { parallel: ParallelInfo }) {
  const isOneOfOne = parallel.print_run === 1;
  return (
    <View style={[styles.chip, isOneOfOne && styles.chipOneOfOne]}>
      <Text variant="label" color={isOneOfOne ? 'surface' : 'textPrimary'}>
        {parallelChipLabel(parallel)}
      </Text>
    </View>
  );
}

export function RcTag() {
  return (
    <View style={styles.rcTag}>
      <Text variant="label">RC</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: borderWidths.structural,
    borderColor: colors.border,
    borderRadius: radius.none,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  chipOneOfOne: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  rcTag: {
    borderWidth: borderWidths.structural,
    borderColor: colors.border,
    borderRadius: radius.none,
    paddingVertical: 1,
    paddingHorizontal: spacing.xs,
  },
});
