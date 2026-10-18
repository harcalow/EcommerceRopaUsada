import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';
import {
  CONTRAST_PAIRS,
  FORBIDDEN_PAIRS,
  evaluatePair,
  evaluatePairs,
  type ContrastPair,
} from './contrast-pairs';
import { colors } from './tokens';

describe('contrastRatio', () => {
  it('negro sobre blanco es 21:1 y es simétrico', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  });

  it('un color sobre sí mismo es 1:1', () => {
    expect(contrastRatio('#2E2CF5', '#2E2CF5')).toBeCloseTo(1, 5);
  });

  it('rechaza colores que no son #RRGGBB', () => {
    expect(() => relativeLuminance('red')).toThrow('Color no válido');
    expect(() => relativeLuminance('#FFF')).toThrow('Color no válido');
  });
});

describe('pares de contraste declarados (WCAG 2.2 AA)', () => {
  it.each(CONTRAST_PAIRS.map((item) => [`${item.foreground} sobre ${item.background}`, item] as const))(
    '%s cumple su mínimo',
    (_name, item) => {
      const result = evaluatePair(item);
      expect(result.ratio).toBeGreaterThanOrEqual(result.minimum);
    },
  );

  it('cada par usa colores existentes y no se repite', () => {
    const keys = CONTRAST_PAIRS.map((item) => `${item.foreground}/${item.background}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const item of CONTRAST_PAIRS) {
      expect(colors).toHaveProperty(item.foreground);
      expect(colors).toHaveProperty(item.background);
    }
  });

  it('coincide con las cifras del diseño', () => {
    const byKey = new Map(evaluatePairs().map((r) => [`${r.foreground}/${r.background}`, r.ratio]));
    expect(byKey.get('onPrimary/primary')).toBeCloseTo(7.5, 1);
    expect(byKey.get('ink/surface')).toBeCloseTo(18, 0);
    expect(byKey.get('textPlaceholder/surface')).toBeCloseTo(4.9, 1);
    expect(byKey.get('borderControl/surface')).toBeCloseTo(3.4, 1);
    expect(byKey.get('error/errorSubtle')).toBeCloseTo(5.2, 1);
    expect(byKey.get('warning/warningSubtle')).toBeCloseTo(6.3, 1);
  });

  it('detecta como inválido el blanco sobre los acentos (prohibido)', () => {
    for (const item of FORBIDDEN_PAIRS) {
      expect(evaluatePair(item).passes).toBe(false);
    }
    expect(evaluatePairs(FORBIDDEN_PAIRS).every((r) => r.ratio < 3)).toBe(true);
  });

  it('un par por debajo del mínimo falla: texto con borde-control sobre superficie suave no llega a 4,5:1', () => {
    const weak: ContrastPair = {
      foreground: 'borderControl',
      background: 'surfaceSubtle',
      kind: 'text',
      usage: 'ejemplo',
    };
    expect(evaluatePair(weak).passes).toBe(false);
  });

  it('evalúa contra otra paleta: un cambio de color que baja el contraste se detecta', () => {
    const degraded = { ...colors, textMuted: '#AAAAAA' };
    const failing = evaluatePairs(CONTRAST_PAIRS, degraded).filter((r) => !r.passes);
    expect(failing.map((r) => r.foreground)).toContain('textMuted');
  });
});
