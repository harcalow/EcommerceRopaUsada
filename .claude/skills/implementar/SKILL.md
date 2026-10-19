---
name: implementar
description: Etapa 5 SDD — Implementa un hito (o una tarea) de tasks.md con sus pruebas junto al código y lo verifica al cerrar el hito
argument-hint: <NNN> [T-xx | H-n]
disable-model-invocation: true
---

Argumentos: $ARGUMENTS (número de funcionalidad y, opcionalmente, una tarea `T-xx` o un hito `H-n`)

1. Localiza `specs/features/<NNN>-*/`. DETENTE si:
   - `spec.md` o `diseno.md` no tienen `estado: aprobada`.
   - No existe `tasks.md`.
   - Alguna tarea del hito no tiene ficha completa.
2. **Entorno:** si es la primera implementación de la sesión, aplica la skill `preparar-entorno`. Si falla, DETENTE con lo que falta.
3. **Rama:** cada funcionalidad tiene una rama `feature/<NNN>-<nombre>`. Si no estás en ella, propón crearla (requiere confirmación del usuario).
4. Si no se indicó nada, toma el primer hito con tareas `[ ]`.
5. **Delegación** (tú no programas: delegas, integras y verificas):
   - Lanza en paralelo las tareas del hito que no dependen entre sí y cuyas rutas permitidas no se solapan.
   - Incluye siempre la tarea E2E del `qa-tester`.
   - En el encargo de cada agente pasa **su ficha completa** (rutas permitidas, interfaces, verificación acotada) y la sección «Contexto de implementación». No le pidas releer todo el diseño.
   - Encadena las dependientes conforme terminen, sin pedir autorización por tarea.
6. Al recibir cada salida:
   - **Etapa 2:** si informa de una discrepancia con la spec o el diseño, NO se parchea. Propón volver a `/especificar` o `/disenar`.
   - Si escribió fuera de sus rutas permitidas, devuélvelo en la misma ronda.
   - No repitas su verificación. El agente verifica su paquete y el hook SubagentStop corre las pruebas afectadas sin cobertura.
7. **Cierre del hito** (una sola verificación completa, en segundo plano y sin otros procesos de pruebas en marcha):
   - Ejecuta `pnpm lint && pnpm typecheck && pnpm test` (con cobertura) y la E2E del hito.
   - Haz una pasada corta del `revisor` sobre el diff del hito.
   - Corrige los 🔴 dentro del hito antes de pasar al siguiente.
8. Muestra al usuario:
   - El resumen del hito.
   - Los archivos.
   - El resultado de la verificación y de la revisión.
   - El **mensaje de commit propuesto**: uno por tarea o uno por hito, según prefiera el usuario.

   Pide autorización para el commit.
9. DETENTE al cerrar el hito. El siguiente paso es `/implementar <NNN>` (siguiente hito) o `/verificar <NNN>` si no quedan.
