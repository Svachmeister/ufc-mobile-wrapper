import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderWidths, colors, radius, spacing, typography } from '@/theme/tokens';

type Option<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    borderWidth: borderWidths.structural,
    borderColor: colors.textPrimary,
    borderRadius: radius.none,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.textPrimary,
  },
  label: {
    fontFamily: typography.fontFamily.heading,
    fontSize: 14,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  labelActive: {
    color: colors.surface,
  },
});
