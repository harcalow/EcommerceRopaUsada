---
name: especificar
description: Etapa 2 SDD — Redacta la spec (requisitos, criterios Gherkin y casos borde) de una funcionalidad explorada
argument-hint: <NNN>
disable-model-invocation: true
---

Funcionalidad: $ARGUMENTS

1. Localiza `specs/features/$ARGUMENTS-*/contexto.md`. Si no existe, DETENTE y pide ejecutar `/explorar` primero.
2. Delega en el subagente `analista-specs` la creación o corrección de `spec.md`. Si vuelves de la etapa 5 o 6, pásale la discrepancia detectada.
3. Muestra al usuario el resumen, el tipo, el número de RF, CA y CB, y las preguntas `[POR ACLARAR]`.
4. DETENTE. **Aprobación humana:** el usuario revisa la spec y cambia su `estado` a `aprobada`.
