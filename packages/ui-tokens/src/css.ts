import { tokens } from './tokens';

/** `accentOrange` pasa a `accent-orange` (los nombres de grupo ya vienen en kebab-case). */
export function toKebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Genera el contenido de `tokens.css` (variables en `:root`) a partir de `tokens.ts`. */
export function renderTokensCss(): string {
  const lines: string[] = [];
  for (const [group, values] of Object.entries(tokens)) {
    for (const [name, value] of Object.entries(values)) {
      lines.push(`  --${group}-${toKebab(name)}: ${value};`);
    }
  }
  return [
    '/* Generado desde src/tokens.ts con `pnpm --filter @perchados/ui-tokens css:generate`. No editar a mano. */',
    ':root {',
    ...lines,
    '}',
    '',
  ].join('\n');
}
