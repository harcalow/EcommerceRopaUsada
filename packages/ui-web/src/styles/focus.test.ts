import { colors, contrastRatio, MIN_RATIO } from '@perchados/ui-tokens';
import { describe, expect, it } from 'vitest';

import { readCss } from '../test/read-css';

const css = readCss('styles/focus.css');

describe('foco global', () => {
  it('usa :focus-visible con un anillo de 2 px del token focus y sin suprimirlo', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-focus\)/);
    expect(css).toMatch(/outline-offset:\s*2px/);
    expect(css).not.toMatch(/outline:\s*(none|0)/);
  });

  it('se mantiene visible en modo de alto contraste (forced-colors)', () => {
    expect(css).toMatch(/@media \(forced-colors: active\)\s*\{[^}]*:focus-visible[^}]*outline:\s*2px solid/);
  });

  it.each([
    ['surface', colors.surface],
    ['surface-subtle', colors.surfaceSubtle],
    ['primary-subtle', colors.primarySubtle],
  ])('el anillo contrasta al menos 3:1 sobre %s', (_name, background) => {
    expect(contrastRatio(colors.focus, background)).toBeGreaterThanOrEqual(MIN_RATIO.ui);
  });
});
