---
name: implementar
description: Etapa 5 SDD — Implementa UNA tarea (o la siguiente pendiente) con sus pruebas junto al código
argument-hint: <NNN> [T-xx]
disable-model-invocation: true
---

Argumentos: $ARGUMENTS (número de funcionalidad y, opcionalmente, ID de tarea)

1. Localiza `specs/features/<NNN>-*/`. Si `spec.md` o `diseno.md` no tienen `estado: aprobada`, o no existe `tasks.md`, DETENTE.
2. **Rama:** cada funcionalidad tiene una rama `feature/<NNN>-<nombre>`. Si no estás en ella, propón crearla (requiere confirmación del usuario).
3. Si no se indicó tarea, elige la primera `[ ]` con sus dependencias en `[x]`.
4. Delega la tarea en el subagente asignado (`backend-dev` o `frontend-dev`). Tú no programas: delegas, integras y verificas.
5. Al recibir su salida:
   - **Etapa 2:** si informa de una discrepancia con la spec o el diseño, NO se parchea. Propón volver a `/especificar` o `/disenar`.
   - Comprueba que las pruebas, el lint y el typecheck pasaron. Los hooks PostToolUse y SubagentStop lo verifican.
6. Muestra al usuario:
   - El resumen.
   - Los archivos modificados.
   - El resultado de las pruebas.
   - El **mensaje de commit propuesto** (un commit pequeño por tarea).
   
   Pide que revise el diff y autorice el commit.
7. DETENTE. Una sola tarea por invocación. Si la próxima tarea no tiene relación con esta, sugiere `/clear`.
