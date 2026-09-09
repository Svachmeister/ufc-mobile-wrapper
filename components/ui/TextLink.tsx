import { Link, LinkProps } from 'expo-router';
import { StyleSheet } from 'react-native';

import { colors, typography } from '@/theme/tokens';

export function TextLink({ style, ...rest }: LinkProps) {
  return <Link style={[styles.link, style]} {...rest} />;
}

const styles = StyleSheet.create({
  link: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
