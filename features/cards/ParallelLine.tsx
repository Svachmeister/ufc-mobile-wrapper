import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui';
import { borderWidths, colors, radius, spacing, typography } from '@/theme/tokens';
import { parallelLineLabel, type ParallelInfo } from '@/lib/cards/cardGrouping';
import type { CardStatus } from '@/lib/cards/userCardStatuses';

export const OWNED_ICON = 'checkmark';
export const WANTED_ICON = 'search';

const LINE_ICON_SIZE = 12;
// Non-breaking, so an icon never wraps away from its label and a separator
// never starts a line.
const NBSP = ' ';

type ParallelLineProps = {
  parallels: ParallelInfo[];
  statusFor: (parallel: ParallelInfo) => CardStatus | undefined;
};

/**
 * A card's parallels as one wrapping line of text: `Base · Gold · /75 · 1/1`.
 * owned → black bold with a checkmark · wanted → black with a magnifier ·
 * neither → secondary grey. Icons are nested Text glyphs, so they sit on
 * the text baseline and wrap with their item. Read-only — the row around it
 * handles the press.
 */
export function ParallelLine({ parallels, statusFor }: ParallelLineProps) {
  return (
    <Text variant="body" color="textSecondary">
      {parallels.map((parallel, index) => {
        const status = statusFor(parallel);
        const label = parallelLineLabel(parallel);
        return (
          <Fragment key={parallel.id}>
            {index > 0 ? `${NBSP}· ` : null}
            {status === 'owned' ? (
              <Text variant="body" style={styles.owned}>
                <Ionicons name={OWNED_ICON} size={LINE_ICON_SIZE} color={colors.textPrimary} />
                {NBSP}
                {label}
              </Text>
            ) : status === 'wanted' ? (
              <Text variant="body">
                <Ionicons name={WANTED_ICON} size={LINE_ICON_SIZE} color={colors.textPrimary} />
                {NBSP}
                {label}
              </Text>
            ) : (
              label
            )}
          </Fragment>
        );
      })}
    </Text>
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
  owned: {
    fontFamily: typography.fontFamily.bodyBold,
  },
  rcTag: {
    borderWidth: borderWidths.structural,
    borderColor: colors.border,
    borderRadius: radius.none,
    paddingVertical: 1,
    paddingHorizontal: spacing.xs,
  },
});
