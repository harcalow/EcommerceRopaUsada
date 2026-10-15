---
name: archivar
description: Etapa 7 SDD — Guarda decisiones y aprendizajes en memoria (Engram y specs/02-memoria) y marca la funcionalidad como cumplida
argument-hint: <NNN>
disable-model-invocation: true
---

Funcionalidad: $ARGUMENTS

1. Localiza `specs/features/$ARGUMENTS-*/`. DETENTE si:
   - La última verificación no fue **APROBADO**.
   - Quedan tareas pendientes.
   - Falta la confirmación humana de una revisión ⚠️.
2. Delega en el subagente `documentador`. Pásale las salidas resumidas de los subagentes de esta funcionalidad. Él se encarga de:
   - Las entradas de aprendizajes.
   - El registro de componentes.
   - Las memorias de Engram.
   - Los estados `cumplida` y `completada`.
   - Los índices y el roadmap.
   - Si es una **rebanada vertical**: la revisión y limpieza de la memoria obsoleta.
3. Si es una **capa horizontal**: revisa los MCP y plugins habilitados (ADR-004) y propón retirar los que ya no se usen.
4. Si surgieron convenciones nuevas: propón crear o actualizar la skill correspondiente y su referencia en `CLAUDE.md` (no lo apliques sin confirmación).
5. Propón abrir el PR de la rama `feature/<NNN>-*`: una rama y un PR por rebanada. Usa el MCP de GitHub solo con autorización.
6. Guarda el cierre con `mem_session_summary`.
7. Muestra al usuario un resumen de lo archivado y el siguiente paso del roadmap.
