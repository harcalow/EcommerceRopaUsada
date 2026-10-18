/** Cálculo de contraste según WCAG 2.2 (criterios 1.4.3 y 1.4.11). */

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa de un color `#RRGGBB` (0 = negro, 1 = blanco). */
export function relativeLuminance(hex: string): number {
  if (!HEX_COLOR.test(hex)) {
    throw new Error(`Color no válido (se espera #RRGGBB): ${hex}`);
  }
  const red = channelToLinear(Number.parseInt(hex.slice(1, 3), 16));
  const green = channelToLinear(Number.parseInt(hex.slice(3, 5), 16));
  const blue = channelToLinear(Number.parseInt(hex.slice(5, 7), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** Relación de contraste entre dos colores (de 1 a 21). */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Mínimo exigido por tipo de uso: texto normal 4,5:1; texto grande y componentes de UI 3:1. */
export const MIN_RATIO = {
  text: 4.5,
  largeText: 3,
  ui: 3,
} as const;

export type ContrastKind = keyof typeof MIN_RATIO;
