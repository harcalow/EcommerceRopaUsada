---
id: ADR-009
estado: aceptada   # propuesta | aceptada | reemplazada por ADR-XXX
aprobacion: dueño (Harold) el 2026-10-15, aplicada por el orquestador con su autorización explícita en el chat
fecha: 2026-10-15
---

# ADR-009 — Design system web: tokens, estilos, componentes y pruebas de accesibilidad

## Contexto
La 002 (hito 3) crea los tokens de marca Perchados y 6 componentes accesibles (WCAG 2.2 AA) para la web, con:
- Un catálogo fuera de producción.
- Pruebas automáticas de accesibilidad.
- El presupuesto de rendimiento de ADR-006 (JS inicial ≤ 200 KB gzip).

No hay manual de marca: los valores salen del mockup de la 001. Más adelante la app móvil necesitará los mismos tokens.

## Opciones consideradas
| Tema | Opciones | Elegida y porqué |
|------|----------|------------------|
| Fuente de los tokens | **TS tipado → variables CSS generadas** · Style Dictionary · CSS a mano | Un archivo tipado sirve a la web (CSS) y en el futuro a React Native (objeto JS). El generador es un script corto. Style Dictionary se reconsiderará si los tokens crecen |
| Estilos | **CSS Modules + variables CSS** · Tailwind v4 · CSS-in-JS | Cero JS en tiempo de ejecución; Stylelint obliga a usar los tokens (CA-037). Tailwind añade otra convención y CSS-in-JS penaliza el presupuesto y los Server Components |
| Componentes base | **HTML nativo propio** · React Aria Components · Radix | Los 6 componentes son controles nativos (`button`, `input`, `a`); el HTML nativo da la semántica gratis y pesa menos. Si aparecen widgets complejos (combobox, diálogo), se evaluará React Aria con un ADR |
| Ubicación | **`packages/ui-web`** (fuente TS transpilada por Next) · `apps/web/src/shared/ui` | Paquete aislado, con sus pruebas y su cobertura; deja sitio a un futuro `ui-native` |
| Iconos | **`lucide-react`** · SVG propios | Coincide con el estilo del mockup; importación por icono |
| Fuentes | **Plus Jakarta Sans** (títulos y cuerpo) + **IBM Plex Mono** (etiquetas) con `next/font/google` · Inter + JetBrains Mono | Las más parecidas al mockup (sans geométrica en negrita, mono espaciada). Autoalojadas en el build y sin peticiones a terceros |
| Catálogo | **Ruta propia `/dev/componentes`** · Storybook | Sin la configuración ni las dependencias de Storybook. Se prueba con el mismo Playwright y se desactiva por configuración en producción |
| Accesibilidad automática | **`vitest-axe` (unitarias) + `@axe-core/playwright` (catálogo)** · solo una de las dos | jsdom no calcula el contraste: hacen falta las dos. Además, una prueba unitaria recalcula los pares de contraste de los tokens |

## Decisión
Las opciones elegidas en la tabla. Paleta, contrastes y API de los componentes en `specs/features/002-fundaciones/diseno.md`.

## Consecuencias
- ➕ Marca centralizada: cambiar un token cambia todos los componentes. Se ajustará cuando exista el manual.
- ➕ Impacto mínimo en el presupuesto de JS.
- ➖ Los componentes complejos futuros pueden requerir una librería headless (ADR nuevo).
- ➖ `next/font/google` necesita red durante el build (CI y Docker).
- Los colores son aproximaciones de un PNG y deben validarse con el dueño.
