import { Link, LinkProps } from 'expo-router';
import { StyleSheet } from 'react-native';

import { colors, typography } from '@/theme/tokens';

type Appearance = 'light' | 'dark';

type TextLinkProps = LinkProps & {
  appearance?: Appearance;
};

// Local to this primitive — theme/tokens.ts is outside this ticket's editable scope.
const DARK_MUTED_TEXT = 'rgba(255, 255, 255, 0.75)';

export function TextLink({ appearance = 'light', style, ...rest }: TextLinkProps) {
  return <Link style={[styles.link, appearance === 'dark' && styles.linkDark, style]} {...rest} />;
}

const styles = StyleSheet.create({
  link: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  linkDark: {
    color: DARK_MUTED_TEXT,
  },
});
