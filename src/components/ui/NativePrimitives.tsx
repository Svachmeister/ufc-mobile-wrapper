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

import { colors, radius, spacing, typography } from '@/src/lib/theme/tokens';

type ScreenHeaderProps = {
  action?: ReactNode;
  eyebrow?: string;
  subtitle?: string;
  title: string;
};

export function ScreenHeader({
  action,
  eyebrow = 'Fight Card Society',
  subtitle,
  title,
}: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.kicker}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

type ActionButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: 'primary' | 'secondary' | 'inverse';
};

export function ActionButton({
  disabled,
  label,
  onPress,
  style,
  textStyle,
  variant = 'primary',
}: ActionButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === 'secondary' ? styles.actionButtonSecondary : null,
        variant === 'inverse' ? styles.actionButtonInverse : null,
        (pressed || disabled) ? styles.actionButtonPressed : null,
        style,
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          variant === 'secondary' ? styles.actionButtonSecondaryText : null,
          variant === 'inverse' ? styles.actionButtonInverseText : null,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
    <ActionButton
      label={label}
      onPress={onPress}
      style={style}
      textStyle={textStyle}
      variant="secondary"
    />
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
  accent?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'surface' | 'inverse' | 'muted';
};

export function SectionPanel({
  accent,
  children,
  style,
  variant = 'surface',
}: SectionPanelProps) {
  return (
    <View
      style={[
        styles.panel,
        variant === 'inverse' ? styles.panelInverse : null,
        variant === 'muted' ? styles.panelMuted : null,
        accent ? styles.panelAccent : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

type StatusBadgeProps = {
  label: string;
  tone?: 'neutral' | 'red' | 'success' | 'warning' | 'dark';
};

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <Text
      style={[
        styles.statusBadge,
        tone === 'red' ? styles.statusBadgeRed : null,
        tone === 'success' ? styles.statusBadgeSuccess : null,
        tone === 'warning' ? styles.statusBadgeWarning : null,
        tone === 'dark' ? styles.statusBadgeDark : null,
      ]}
    >
      {label}
    </Text>
  );
}

type ListRowProps = {
  action?: ReactNode;
  meta?: string;
  onPress?: () => void;
  title: string;
};

export function ListRow({ action, meta, onPress, title }: ListRowProps) {
  const content = (
    <>
      <View style={styles.listRowText}>
        <Text numberOfLines={1} style={styles.listRowTitle}>{title}</Text>
        {meta ? <Text numberOfLines={1} style={styles.listRowMeta}>{meta}</Text> : null}
      </View>
      {action ? <View style={styles.listRowAction}>{action}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.listRow}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.listRow}>{content}</View>;
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
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.red,
    borderColor: colors.red,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: spacing.controlHeight,
    paddingHorizontal: 14,
  },
  actionButtonInverse: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  actionButtonInverseText: {
    color: colors.textInverse,
  },
  actionButtonPressed: {
    opacity: 0.72,
  },
  actionButtonSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.ink,
  },
  actionButtonSecondaryText: {
    color: colors.ink,
  },
  actionButtonText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.25,
    textTransform: 'uppercase',
  },
  header: {
    alignItems: 'flex-start',
    borderBottomColor: colors.ink,
    borderBottomWidth: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 11,
  },
  headerAction: {
    flexShrink: 0,
    marginLeft: 12,
    marginTop: 2,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: colors.red,
    fontSize: typography.kicker,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  listRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    padding: spacing.rowPadding,
  },
  listRowAction: {
    flexShrink: 0,
  },
  listRowMeta: {
    color: colors.gray500,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  listRowText: {
    flex: 1,
    minWidth: 0,
  },
  listRowTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderTopColor: colors.red,
    borderTopWidth: 2,
    borderWidth: 1,
    padding: spacing.cardPadding,
  },
  panelAccent: {
    borderLeftColor: colors.red,
    borderLeftWidth: 4,
    borderTopWidth: 1,
  },
  panelInverse: {
    backgroundColor: colors.inverseSurface,
    borderColor: colors.ink,
    borderTopColor: colors.red,
  },
  panelMuted: {
    backgroundColor: colors.surfaceAlt,
  },
  statLabel: {
    color: colors.gray500,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 3,
    textTransform: 'uppercase',
  },
  statTile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderTopColor: colors.ink,
    borderTopWidth: 3,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  statValue: {
    color: colors.ink,
    fontSize: typography.stat,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.gray700,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  statusBadgeDark: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    color: colors.textInverse,
  },
  statusBadgeRed: {
    backgroundColor: colors.red,
    borderColor: colors.red,
    color: colors.textInverse,
  },
  statusBadgeSuccess: {
    borderColor: colors.success,
    color: colors.success,
  },
  statusBadgeWarning: {
    borderColor: colors.warning,
    color: colors.warning,
  },
  subtitle: {
    color: colors.gray700,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 5,
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: typography.titleLine,
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
