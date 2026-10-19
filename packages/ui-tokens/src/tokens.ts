/**
 * Fuente única de la identidad visual de Perchados (ADR-009, diseno.md de la 001).
 * `src/tokens.css` se genera desde este archivo: no se edita a mano.
 */

export const colors = {
  primary: '#2E2CF5',
  primaryHover: '#2321C8',
  primarySubtle: '#EEEEFF',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#D5D5FF',
  accentOrange: '#FF7A1A',
  accentTeal: '#3DDBB0',
  accentPink: '#FF8FCB',
  ink: '#14142B',
  textMuted: '#5E5E7A',
  textPlaceholder: '#6E6E8A',
  borderControl: '#8A8AA3',
  borderSubtle: '#E4E4EE',
  surface: '#FFFFFF',
  surfaceSubtle: '#F4F4F8',
  error: '#C0262D',
  errorSubtle: '#FDECEC',
  success: '#166B40',
  successSubtle: '#E8F6EE',
  warning: '#8A4B00',
  warningSubtle: '#FFF4E5',
  focus: '#2E2CF5',
} as const;

export const fontFamily = {
  sans: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  bold: '700',
  extrabold: '800',
} as const;

/** Tamaños en rem para respetar el zoom del 200 %. */
export const fontSize = {
  xs: '0.75rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.5rem',
  '2xl': '2rem',
  '3xl': '3rem',
} as const;

export const letterSpacing = {
  label: '0.12em',
} as const;

export const radius = {
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.75rem',
  full: '9999px',
} as const;

/** Escala de 4 px: `space-N` = N x 4 px. */
export const space = {
  '0': '0',
  '1': '0.25rem',
  '2': '0.5rem',
  '3': '0.75rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '8': '2rem',
  '10': '2.5rem',
  '12': '3rem',
  '16': '4rem',
} as const;

/** Grupos de tokens; la clave es el prefijo de la variable CSS (`--color-primary`). */
export const tokens = {
  color: colors,
  font: fontFamily,
  'font-weight': fontWeight,
  'font-size': fontSize,
  'letter-spacing': letterSpacing,
  radius,
  space,
} as const;

export type ColorToken = keyof typeof colors;
