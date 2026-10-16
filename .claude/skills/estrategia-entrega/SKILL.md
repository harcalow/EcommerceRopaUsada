---
name: estrategia-entrega
description: Estrategia de entrega del proyecto (ADR-010), una carpeta de funcionalidad por requerimiento del dueño, con la base técnica que necesite dentro de su propio diseño. Úsalo al clasificar, dimensionar, priorizar o diseñar una funcionalidad.
user-invocable: false
---

# Estrategia de entrega: una funcionalidad por requerimiento (ADR-010)

## Regla de oro
**Solo existen las funcionalidades que el dueño pidió.** Cada requerimiento es una carpeta `specs/features/NNN-nombre/`. No se crean specs adicionales (capas horizontales, «fundaciones», specs de apoyo) sin que el dueño lo pida.

## Base técnica
Elementos transversales que se construyen **una vez** y que reutilizan las funcionalidades siguientes:
- Configuración y estructura del proyecto, CI y hooks.
- Autenticación y sesión.
- Manejo de errores y logging.
- Cliente de base de datos y migraciones.
- Design system o librería de componentes base (web y mobile).
- Utilidades compartidas (`Money`, validación, paginación…).
- Integraciones con puerto propio: almacenamiento de imágenes y pasarela de pagos (ADR-002).

Si una funcionalidad necesita algo transversal que no existe:
1. El `arquitecto` lo incluye en el `diseno.md` de esa misma funcionalidad como requisito técnico (`RT-xxx`), con su verificación y su origen (RNF de la spec, ADR o Definition of Done).
2. `tasks.md` lo construye en los primeros hitos, antes de las tareas de valor.
3. La spec no cambia por ello: la base técnica es «cómo», no «qué».
4. Las funcionalidades siguientes la reutilizan; el `revisor` comprueba en `/verificar` que no se duplique.

## Funcionalidades
- Cada requerimiento se entrega **de punta a punta**: UI (web y/o mobile) → lógica → API → datos → pruebas.
- Al terminar, queda **demostrable y desplegable**.
- Si es grande, se divide en **hitos** dentro de su `tasks.md` (un PR por hito), no en specs nuevas.

## Priorización
1. Lo que el dueño pidió primero, salvo que él indique otro orden.
2. Dentro de una funcionalidad: la base técnica que la bloquea, luego el camino feliz, después los casos borde.
3. El riesgo técnico alto (p. ej. la concurrencia sobre prendas únicas) se ataca pronto para aprender barato.

El orden vigente vive en `specs/00-vision/roadmap.md`.
