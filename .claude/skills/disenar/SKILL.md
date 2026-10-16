---
name: disenar
description: Etapa 3 SDD — Diseña componentes, contratos de API, modelo de datos e impacto en lo existente (diseno.md) de una spec aprobada
argument-hint: <NNN>
disable-model-invocation: true
---

Funcionalidad: $ARGUMENTS

1. Localiza `specs/features/$ARGUMENTS-*/spec.md`. Si su `estado` no es `aprobada`, DETENTE e informa.
2. Delega en el subagente `arquitecto` (etapa: diseño) la creación de `diseno.md` y de los ADR necesarios.
3. Si la funcionalidad necesita infraestructura nueva, el arquitecto la incluye en su propio diseño (requisitos `RT`) y en sus primeras tareas; no se crean specs aparte (ADR-010).
4. Muestra al usuario el resumen, los ADR propuestos, el impacto en lo existente y los riesgos.
5. DETENTE. **Aprobación humana:** el usuario revisa el diseño y los ADR y cambia su `estado` a `aprobada` / `aceptada`.
