import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import config from './base.js';

async function lint(code: string): Promise<string[]> {
  const result = await stylelint.lint({ code, config, codeFilename: 'componente.module.css' });
  return result.results.flatMap((file) => file.warnings.map((warning) => warning.text));
}

describe('preset de Stylelint de tokens', () => {
  it.each([
    ['hex en color', '.a { color: #fff; }'],
    ['hex en background-color', '.a { background-color: #2E2CF5; }'],
    ['hex en borde', '.a { border-color: #8A8AA3; }'],
    ['rgb() en outline-color', '.a { outline-color: rgb(0 0 0); }'],
    ['nombre de color', '.a { color: red; }'],
    ['hex en background', '.a { background: #fff; }'],
    ['hex en box-shadow', '.a { box-shadow: 0 0 0 2px #000; }'],
    ['font-family literal', '.a { font-family: Arial; }'],
    ['radio literal', '.a { border-radius: 8px; }'],
  ])('rechaza %s', async (_name, code) => {
    const warnings = await lint(code);
    expect(warnings).not.toHaveLength(0);
    expect(warnings.join(' ')).toContain('@perchados/ui-tokens');
  });

  it.each([
    ['color con token', '.a { color: var(--color-ink); }'],
    ['fondo con token', '.a { background-color: var(--color-surface); }'],
    ['transparent', '.a { background: transparent; }'],
    ['currentColor', '.a { border-color: currentColor; }'],
    ['radio con token y 0', '.a { border-radius: var(--radius-md); } .b { border-radius: 0; }'],
    ['propiedades sin token', '.a { min-height: 48px; padding: 8px; }'],
  ])('acepta %s', async (_name, code) => {
    expect(await lint(code)).toEqual([]);
  });
});
