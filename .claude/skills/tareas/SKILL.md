---
name: tareas
description: Etapa 4 SDD — Desglosa un diseño aprobado en tareas pequeñas y verificables por sí solas (tasks.md)
argument-hint: <NNN>
disable-model-invocation: true
---

Funcionalidad: $ARGUMENTS

1. Localiza `specs/features/$ARGUMENTS-*/`. Si `spec.md` o `diseno.md` no tienen `estado: aprobada`, DETENTE e informa.
2. Delega en el subagente `arquitecto` (etapa: tareas) la creación de `tasks.md`.
3. Comprueba que cada RF y cada CB estén cubiertos por al menos una tarea, y que cada tarea tenga su agente y su verificación.
4. Muestra la tabla de tareas al usuario.
5. DETENTE. No requiere aprobación formal. El siguiente paso es `/implementar NNN`.
