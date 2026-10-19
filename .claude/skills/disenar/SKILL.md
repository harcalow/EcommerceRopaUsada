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
4. **Revisión previa del diseño** (retrospectiva 001: los fallos de diseño que se descubren en la etapa 6 obligan a rehacer la 3):
   - Delega en `revisor` (modo: diseño) la lectura de `diseno.md` y los ADR con la skill `revision-seguridad` y `requisitos-plataforma`. Debe revisar en particular:
     - Confianza y origen de los datos: IP, cabeceras, proxies.
     - Datos personales en logs.
     - Presupuesto de rendimiento.
     - Límites de longitud y normalización.
     - Coherencia con los ADR vigentes.
   - Si hay hallazgos 🔴, devuélvelos al `arquitecto` en una sola ronda. Los 🟡 se muestran al usuario.
5. Muestra al usuario el resumen, los ADR propuestos, el impacto en lo existente, los riesgos y el resultado de la revisión previa.
6. DETENTE. **Aprobación humana:** el usuario revisa el diseño y los ADR y cambia su `estado` a `aprobada` / `aceptada`.
