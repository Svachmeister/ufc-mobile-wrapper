import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius, typography } from '@/theme/tokens';
import { parseLastFive, type FormResult } from '@/lib/fantasy/pickDisplay';
import { Text } from './Text';

const FORM_SQUARE = 18;
const FORM_ROW_HEIGHT = FORM_SQUARE;

// Reserved for a W square — used nowhere else in the app.
const FORM_WIN_COLOR = '#1E8E3E';
const FORM_COLORS: Record<FormResult, string> = {
  W: FORM_WIN_COLOR,
  L: colors.brandRed,
  D: colors.textSecondary,
  N: colors.textSecondary,
};

type FormIndicatorProps = {
  lastFive: string | null | undefined;
  style?: StyleProp<ViewStyle>;
};

// Fixed-height row regardless of how many results there are — including zero,
// which is every fighter's state until the backfill job runs.
export function FormIndicator({ lastFive, style }: FormIndicatorProps) {
  const results = parseLastFive(lastFive);

  return (
    <View style={[styles.formRow, style]}>
      {results.map((result, position) => (
        <View key={`${position}-${result}`} style={[styles.formSquare, { backgroundColor: FORM_COLORS[result] }]}>
          <Text variant="label" color="surface" style={styles.formSquareLabel}>
            {result}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  formRow: {
    height: FORM_ROW_HEIGHT,
    flexDirection: 'row',
    gap: 2,
  },
  formSquare: {
    width: FORM_SQUARE,
    height: FORM_SQUARE,
    borderRadius: radius.none,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSquareLabel: {
    fontFamily: typography.fontFamily.heading,
    fontSize: 11,
    lineHeight: 13,
  },
});
