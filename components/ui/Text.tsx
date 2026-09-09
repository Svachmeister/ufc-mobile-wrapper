import { PropsWithChildren } from 'react';
import { StyleSheet, Text as RNText, TextProps as RNTextProps } from 'react-native';

import { colors, typography } from '@/theme/tokens';

type Variant = 'display' | 'heading' | 'body' | 'label' | 'numeric';

type TextProps = PropsWithChildren<
  RNTextProps & {
    variant?: Variant;
    color?: keyof typeof colors;
  }
>;

export function Text({ variant = 'body', color = 'textPrimary', style, children, ...rest }: TextProps) {
  return (
    <RNText style={[styles[variant], { color: colors[color] }, style]} {...rest}>
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  display: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.display.fontSize,
    lineHeight: typography.display.lineHeight,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    textTransform: 'uppercase',
  },
  numeric: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.numeric.fontSize,
    lineHeight: typography.numeric.lineHeight,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  label: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    textTransform: 'uppercase',
  },
});
