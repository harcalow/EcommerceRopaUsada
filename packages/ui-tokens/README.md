# @perchados/ui-tokens

Tokens de marca compartidos por web y mobile (ADR-009). Una sola definición de la identidad visual.

## Qué exporta
- `colors`, `fontFamily`, `fontSize`, `radius`, `space` y `tokens` (`src/tokens.ts`): **fuente única** de los valores.
- `renderTokensCss`, `toKebab` (`src/css.ts`): generan las variables CSS `--color-*`, `--font-*`, `--font-size-*`, `--radius-*` y `--space-*`.
- `contrastRatio`, `CONTRAST_PAIRS`, `FORBIDDEN_PAIRS`, `evaluatePairs`, `MIN_RATIO` (`src/contrast*.ts`): cálculo WCAG 2.2 y pares texto/fondo declarados.
- `@perchados/ui-tokens/tokens.css`: el CSS generado (`dist/tokens.css`).

## Cómo se usa
```ts
// apps/web/src/app/layout.tsx (una vez)
import '@perchados/ui-tokens/tokens.css';
```
```css
/* CSS Modules: solo variables, nunca valores literales */
.title { color: var(--color-ink); font-size: var(--font-size-lg); border-radius: var(--radius-md); }
```
En código TypeScript (p. ej. mobile): `import { colors } from '@perchados/ui-tokens'`.

## Reglas
- Los valores se definen **solo aquí**. Tras cambiar `src/tokens.ts`: `pnpm --filter @perchados/ui-tokens css:generate` (también corre en `build`). Una prueba falla si `src/tokens.css` está desactualizado.
- **Contraste AA (ADR-006):** 4,5:1 para texto y 3:1 para UI. Un color o par de uso nuevo se declara en `CONTRAST_PAIRS`; la prueba falla si queda bajo su mínimo y exige que el blanco sobre los acentos (`accentOrange`, `accentTeal`, `accentPink`) siga siendo inválido (`FORBIDDEN_PAIRS`).
- **Stylelint sin colores literales:** el preset `@perchados/config/stylelint` (`scale-unlimited/declaration-strict-value`) rechaza colores, `font-family`, `font-size`, `font-weight`, `border-radius`, `background` y `box-shadow` literales; solo `var(--…)` (se permiten `transparent`, `currentColor`, `inherit` y `0`).
- El paquete se compila con `tsup` (`pnpm --filter @perchados/ui-tokens build`) antes de que otros paquetes lo consuman; Turborepo ya lo ordena.

## Quién lo usa
`@perchados/ui-web`, `apps/web` y, en su momento, `apps/mobile`.

## Comandos
`pnpm --filter @perchados/ui-tokens test | lint | typecheck | build | css:generate`.
