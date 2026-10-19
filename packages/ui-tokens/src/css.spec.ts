import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderTokensCss, toKebab } from './css';
import { colors } from './tokens';

describe('tokens.css', () => {
  it('coincide con lo que genera tokens.ts (si falla: pnpm --filter @perchados/ui-tokens css:generate)', () => {
    const onDisk = readFileSync(resolve(import.meta.dirname, 'tokens.css'), 'utf8');
    expect(onDisk).toBe(renderTokensCss());
  });

  it('declara una variable por cada color con su valor', () => {
    const css = renderTokensCss();
    expect(css).toContain('--color-primary: #2E2CF5;');
    expect(css).toContain('--color-on-primary-muted: #D5D5FF;');
    for (const name of Object.keys(colors)) {
      expect(css).toContain(`--color-${toKebab(name)}:`);
    }
  });

  it('incluye tipografía, radios y espaciados', () => {
    const css = renderTokensCss();
    expect(css).toContain('--font-size-3xl: 3rem;');
    expect(css).toContain('--radius-full: 9999px;');
    expect(css).toContain('--space-4: 1rem;');
    expect(css).toContain('--letter-spacing-label: 0.12em;');
  });
});

describe('toKebab', () => {
  it('convierte camelCase en kebab-case y respeta lo que ya lo es', () => {
    expect(toKebab('accentOrange')).toBe('accent-orange');
    expect(toKebab('2xl')).toBe('2xl');
  });
});
