# @perchados/ui-web

Componentes React accesibles del design system web (ADR-009). Se publican como **fuente TypeScript**; `apps/web` los transpila con `transpilePackages: ['@perchados/ui-web']`. Estilos con CSS Modules sobre los tokens de `@perchados/ui-tokens`.

## Qué exporta
| Componente | Resumen |
|------------|---------|
| `Button` | `<button>` nativo; `variant` primary/secondary, `loading` (aria-busy/aria-disabled, sigue enfocable, anula clic y envío, anuncia `loadingLabel`), `iconEnd`, `fullWidth`; alto mínimo 48 px |
| `TextField` | `<label htmlFor>` con `useId`, `icon` decorativo, `endAdornment`, `help`, `error` (aria-invalid, aria-describedby, región `aria-live="polite"`); la etiqueta vacía lanza error en desarrollo |
| `PasswordField` | Envuelve `TextField`; conmutador «Mostrar/Ocultar contraseña» que no mueve el foco ni envía; `notice` (p. ej. Bloq Mayús) en región `aria-live`; no bloquea pegar; `autoComplete` por defecto `current-password` |
| `Link` | `<a>` subrayado siempre; `external`, `newTab` (rel seguro y texto oculto) y `linkComponent` para rutas internas |
| `Alert` | `variant` info/success/warning/error; `error`/`warning` usan `role="alert"`, `info`/`success` `role="status"`; icono y prefijo oculto para no depender del color |
| `@perchados/ui-web/focus.css` | Anillo `:focus-visible` de 2 px (`--color-focus`), visible en `forced-colors` |

`VisuallyHidden` y `Spinner` son **internos** (`src/internal/`): no se exportan. Todos los componentes aceptan `data-testid`. Ejemplos de uso y rutas: `specs/02-memoria/registro-componentes.md`.

## Cómo se usa
```tsx
// layout (una vez)
import '@perchados/ui-tokens/tokens.css';
import '@perchados/ui-web/focus.css';

import NextLink from 'next/link';
import { Alert, Button, Link, PasswordField, TextField } from '@perchados/ui-web';

<TextField label="Nombre de usuario" name="username" autoComplete="username" error={errors.username} data-testid="login-username" />
<PasswordField label="Contraseña" name="password" data-testid="login-password" />
<Button type="submit" fullWidth loading={pending} loadingLabel="Verificando…">Entrar al panel</Button>
<Link href="/login" linkComponent={NextLink}>Acceso</Link>
{error ? <Alert variant="error">Usuario o contraseña incorrectos</Alert> : null}
```

## Reglas
- **Sin dependencia de Next.js:** para rutas internas se pasa `linkComponent` (p. ej. `next/link`); `ui-web` solo depende de React (peer).
- **Tokens AA, sin literales:** todo valor visual sale de `var(--…)` de `ui-tokens`. `pnpm lint` ejecuta ESLint (incluye `jsx-a11y`) y Stylelint (`@perchados/config/stylelint`), que **rechaza colores, tamaños de fuente, radios y fondos literales**. Un par de colores nuevo se declara en `CONTRAST_PAIRS` de `ui-tokens`.
- **Iconos:** solo `lucide-react` (versión fijada), siempre `aria-hidden` cuando son decorativos; el significado nunca depende solo del color o del icono.
- **Accesibilidad (WCAG 2.2 AA):** HTML semántico, foco visible, objetivos táctiles ≥ 44 px, errores asociados con `aria-describedby`, anuncios con `aria-live`/`role`. Cada componente tiene una prueba con `expectNoA11yViolations` (axe-core vía `vitest-axe`).
- **Pruebas:** Vitest + jsdom + Testing Library. Usa siempre `const user = userEvent.setup({ delay: null })` (sin retrasos artificiales: evita pruebas lentas e inestables) y `data-testid`/roles accesibles como selectores. `readCss` (`src/test/read-css.ts`) permite comprobar reglas CSS.
- Un componente nuevo: carpeta propia `src/<Nombre>/` con `.tsx`, `.module.css`, prueba, export en `src/index.ts` y alta en `registro-componentes.md`.

## Comandos
`pnpm --filter @perchados/ui-web test | lint | typecheck`.
