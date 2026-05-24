import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, spacing } from '@/src/lib/theme/tokens';

type ScreenHeaderProps = {
  action?: ReactNode;
  eyebrow?: string;
  title: string;
};

export function ScreenHeader({
  action,
  eyebrow = 'Fight Card Society',
  title,
}: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.kicker}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

type WebFallbackButtonProps = {
  label?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function WebFallbackButton({
  label = 'WebView',
  onPress,
  style,
  textStyle,
}: WebFallbackButtonProps) {
  return (
    <Pressable hitSlop={10} onPress={onPress} style={[styles.webButton, style]}>
      <Text style={[styles.webButtonText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

type StatTileProps = {
  label: string;
  value: string;
};

export function StatTile({ label, value }: StatTileProps) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

type SectionPanelProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SectionPanel({ children, style }: SectionPanelProps) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export const sharedScreenStyles = {
  scrollContent: {
    gap: spacing.sectionGap,
    paddingBottom: spacing.screenBottom,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenY,
  },
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerAction: {
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.cardPadding,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 5,
    textTransform: 'uppercase',
  },
  statTile: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderWidth: 1,
    flex: 1,
    padding: 13,
  },
  statValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 34,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  webButton: {
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  webButtonText: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
});
