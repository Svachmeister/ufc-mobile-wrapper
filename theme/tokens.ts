export const colors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#6B6B6B',
  border: '#E5E5E5',
  brandRed: '#E10600',
  championGold: '#E8B923',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const borderWidths = {
  structural: 1,
  emphasis: 3,
} as const;

export const radius = {
  none: 0,
} as const;

export const typography = {
  fontFamily: {
    heading: 'BarlowCondensed_700Bold',
    headingMedium: 'BarlowCondensed_600SemiBold',
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodyBold: 'Inter_700Bold',
  },
  display: {
    fontSize: 32,
    lineHeight: 36,
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: 20,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
  numeric: {
    fontSize: 24,
    lineHeight: 28,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textTransform: 'none',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
} as const;

export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type BorderWidths = typeof borderWidths;
export type Radius = typeof radius;
export type Typography = typeof typography;
