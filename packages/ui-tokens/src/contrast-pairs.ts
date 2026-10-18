import { colors, type ColorToken } from './tokens';
import { MIN_RATIO, contrastRatio, type ContrastKind } from './contrast';

export interface ContrastPair {
  readonly foreground: ColorToken;
  readonly background: ColorToken;
  readonly kind: ContrastKind;
  readonly usage: string;
}

export interface ContrastResult extends ContrastPair {
  readonly ratio: number;
  readonly minimum: number;
  readonly passes: boolean;
}

type Palette = Readonly<Record<ColorToken, string>>;

function pair(
  foreground: ColorToken,
  background: ColorToken,
  kind: ContrastKind,
  usage: string,
): ContrastPair {
  return { foreground, background, kind, usage };
}

/** Pares texto/fondo y control/fondo que la interfaz usa de verdad; todos deben cumplir AA. */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  pair('ink', 'surface', 'text', 'Título y texto principal'),
  pair('ink', 'surfaceSubtle', 'text', 'Texto sobre fondo suave'),
  pair('ink', 'primarySubtle', 'text', 'Texto de Alert info'),
  pair('textMuted', 'surface', 'text', 'Texto secundario'),
  pair('textMuted', 'surfaceSubtle', 'text', 'Texto secundario sobre fondo suave'),
  pair('textPlaceholder', 'surface', 'text', 'Placeholder de campos'),
  pair('primary', 'surface', 'text', 'Enlaces y etiquetas mono'),
  pair('primary', 'surfaceSubtle', 'text', 'Enlaces sobre fondo suave'),
  pair('primary', 'primarySubtle', 'text', 'Enlaces dentro de Alert info'),
  pair('primaryHover', 'surface', 'text', 'Enlace en hover'),
  pair('onPrimary', 'primary', 'text', 'Texto del botón primario y del panel de marca'),
  pair('onPrimary', 'primaryHover', 'text', 'Botón primario en hover o activo'),
  pair('onPrimaryMuted', 'primary', 'text', 'Texto secundario del panel de marca'),
  pair('ink', 'accentOrange', 'text', 'Texto sobre el acento naranja'),
  pair('ink', 'accentTeal', 'text', 'Texto sobre el acento turquesa'),
  pair('ink', 'accentPink', 'text', 'Texto sobre el acento rosa'),
  pair('error', 'errorSubtle', 'text', 'Alert error'),
  pair('error', 'surface', 'text', 'Mensaje de error bajo el campo'),
  pair('success', 'successSubtle', 'text', 'Alert success'),
  pair('warning', 'warningSubtle', 'text', 'Aviso de Bloq Mayús y Alert warning'),
  pair('borderControl', 'surface', 'ui', 'Borde de campos'),
  pair('borderControl', 'surfaceSubtle', 'ui', 'Borde de campos sobre fondo suave'),
  pair('focus', 'surface', 'ui', 'Anillo de foco sobre fondo claro'),
  pair('surface', 'primary', 'ui', 'Anillo de foco blanco sobre el primario'),
];

/** Combinaciones prohibidas: deben seguir siendo inválidas (blanco sobre los acentos). */
export const FORBIDDEN_PAIRS: readonly ContrastPair[] = [
  pair('onPrimary', 'accentOrange', 'text', 'Blanco sobre naranja'),
  pair('onPrimary', 'accentTeal', 'text', 'Blanco sobre turquesa'),
  pair('onPrimary', 'accentPink', 'text', 'Blanco sobre rosa'),
];

export function evaluatePair(item: ContrastPair, palette: Palette = colors): ContrastResult {
  const ratio = contrastRatio(palette[item.foreground], palette[item.background]);
  const minimum = MIN_RATIO[item.kind];
  return { ...item, ratio, minimum, passes: ratio >= minimum };
}

export function evaluatePairs(
  pairs: readonly ContrastPair[] = CONTRAST_PAIRS,
  palette: Palette = colors,
): ContrastResult[] {
  return pairs.map((item) => evaluatePair(item, palette));
}
