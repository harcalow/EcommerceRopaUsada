---
id: ADR-012
estado: aceptada   # propuesta | aceptada | reemplazada por ADR-XXX
aprobacion: dueño (Harold) el 2026-10-18, aplicada por el orquestador con su autorización explícita en el chat
fecha: 2026-10-18
---

# ADR-012 — Esquemas de navegador con zod/mini en `@perchados/contracts/client`

## Contexto
ADR-008 y el RT-004 de la 001 establecen que los esquemas viven una sola vez en Zod en `packages/contracts` y alimentan la API, OpenAPI y la web. Zod clásico importado en el navegador superaba el presupuesto de JS inicial (ADR-006: ≤ 200 KB gzip por ruta): `/login` medía 239,5 KB gzip. Con zod/mini (incluido en el paquete `zod` 4, sin dependencia nueva) bajó a unos 162 KB.

## Opciones consideradas
1. **Un solo juego en Zod clásico también en el navegador** — ➕ fuente única literal · ➖ incumple el presupuesto de JS.
2. **Validación en el navegador escrita a mano** — ➕ sin peso · ➖ duplica reglas y mensajes sin garantía de paridad.
3. **Migrar todo a zod/mini** — ➕ un solo juego · ➖ `@asteasolutions/zod-to-openapi` trabaja sobre Zod clásico; cambiaría la generación del contrato (ADR-008).
4. **Dos juegos con fuente única de reglas y prueba de paridad** (elegida) — ➕ cumple el presupuesto sin tocar la cadena del contrato · ➖ un segundo juego que mantener, acotado por las condiciones siguientes.

## Decisión
**Opción 4**, como excepción acotada a «los esquemas viven una sola vez»:
1. Reglas y mensajes (longitudes, patrones, textos) viven solo en archivos `*.rules.ts` de `packages/contracts`; ninguno de los dos juegos declara literales propios.
2. Cada esquema de `@perchados/contracts/client` tiene una **prueba de paridad** obligatoria con su homólogo clásico (mismo resultado, valor normalizado y mensajes sobre los mismos casos, bordes incluidos).
3. `apps/web/src/**` importa solo `@perchados/contracts/client`; `lint` lo hace cumplir. La API y las pruebas en Node usan la entrada principal.
4. `/client` contiene solo lo que necesita el navegador (esquemas de formularios, nombres de cookies y cabeceras, tipos), nunca el registro OpenAPI.

## Consecuencias
- ➕ El presupuesto de JS se cumple y el contrato sigue generándose igual.
- ➖ Cada formulario nuevo con validación en el navegador añade su esquema mini y su caso de paridad.
- Si `zod-to-openapi` llegara a soportar zod/mini, se reevaluará la opción 3 con un ADR que reemplace a este.
