import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { borderWidths, colors, radius, spacing } from '@/theme/tokens';
import { parallelChipLabel, type ParallelInfo } from '@/lib/cards/cardGrouping';
import type { CardStatus } from '@/lib/cards/userCardStatuses';

type ParallelChipProps = {
  parallel: ParallelInfo;
  status?: CardStatus;
};

/**
 * owned wins outright (filled, regardless of print run) · otherwise a 1/1
 * gets the 3px border · wanted adds a dot on top of whatever border applies.
 * Chips are read-only everywhere they're used — marking only happens on the
 * card detail screen.
 */
export function ParallelChip({ parallel, status }: ParallelChipProps) {
  const isOwned = status === 'owned';
  const isWanted = status === 'wanted';
  const isOneOfOne = parallel.print_run === 1;

  return (
    <View style={[styles.chip, isOneOfOne && !isOwned && styles.chipOneOfOne, isOwned && styles.chipOwned]}>
      {isWanted ? <View style={styles.wantedDot} /> : null}
      <Text variant="label" color={isOwned ? 'surface' : 'textPrimary'}>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: borderWidths.structural,
    borderColor: colors.border,
    borderRadius: radius.none,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  chipOneOfOne: {
    borderWidth: borderWidths.emphasis,
    borderColor: colors.textPrimary,
  },
  chipOwned: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  // The one deliberately round mark in an otherwise sharp-cornered app — the
  // ticket calls for a "dot", which a square can't read as.
  wantedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textPrimary,
  },
  rcTag: {
    borderWidth: borderWidths.structural,
    borderColor: colors.border,
    borderRadius: radius.none,
    paddingVertical: 1,
    paddingHorizontal: spacing.xs,
  },
});
