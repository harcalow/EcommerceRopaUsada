---
name: tareas
description: Etapa 4 SDD — Desglosa un diseño aprobado en bloques de tareas con ficha (rutas, interfaces, verificación) y hitos (tasks.md)
argument-hint: <NNN>
disable-model-invocation: true
---

Funcionalidad: $ARGUMENTS

1. Localiza `specs/features/$ARGUMENTS-*/`. Si `spec.md` o `diseno.md` no tienen `estado: aprobada`, DETENTE e informa.
2. Delega en el subagente `arquitecto` (etapa: tareas) la creación de `tasks.md` con la plantilla `specs/_plantillas/tasks.md`:
   - **Entre 6 y 12 tareas**, cada una un bloque coherente que un agente termina en una sesión (no un archivo por tarea).
   - **Ficha completa** en cada tarea: rutas permitidas, interfaces, componentes reutilizados y verificación acotada al paquete.
   - **Contexto de implementación** de una página (los implementadores lo leen en lugar de todo `diseno.md`).
   - **Hitos** de 2 a 4 tareas, con su verificación de cierre.
   - Una tarea de `qa-tester` por hito con las **E2E escritas desde el Gherkin**, sin dependencias, para ejecutarla en paralelo.
3. Comprueba:
   - Que cada RF, CA y CB esté cubierto por al menos una tarea.
   - Que cada tarea tenga agente y ficha completa.
   - Que las rutas permitidas de las tareas en paralelo no se solapen.
4. Muestra al usuario la tabla de tareas y los hitos.
5. DETENTE. No requiere aprobación formal. El siguiente paso es `/implementar NNN`.
