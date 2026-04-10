import { Platform } from 'react-native'

export const colors = {
  bg: '#F7F7F8',
  surface: '#FFFFFF',
  surfaceSoft: '#F3F5F7',
  border: '#E3E6EB',
  borderStrong: '#D3D7DF',
  text: '#1F2430',
  muted: '#5F6777',
  accent: '#FF385C',
  accentStrong: '#E31C4B',
  accentSoft: '#FFF0F4',
  hero: '#111C2F',
  success: '#147D5A',
  warning: '#AA6A00',
  danger: '#B42318',
} as const

export const radii = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const

export const fonts = {
  sans: Platform.select({
    web: '"Inter", system-ui, sans-serif',
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }),
  serif: Platform.select({
    web: '"Playfair Display", Georgia, serif',
    ios: 'Georgia',
    android: 'serif',
    default: 'serif',
  }),
} as const

export const shadows = {
  control:
    '0 1px 2px rgba(17, 24, 39, 0.04), 0 16px 34px -22px rgba(17, 24, 39, 0.28), 0 28px 50px -34px rgba(17, 24, 39, 0.2)',
  panel:
    '0 22px 48px -28px rgba(17, 24, 39, 0.28), 0 38px 80px -44px rgba(17, 24, 39, 0.18), 0 2px 10px rgba(17, 24, 39, 0.04)',
  accent:
    '0 16px 30px -24px rgba(227, 28, 75, 0.85)',
  popover:
    '0 16px 34px -20px rgba(17, 24, 39, 0.45)',
} as const
