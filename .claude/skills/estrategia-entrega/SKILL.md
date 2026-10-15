---
name: estrategia-entrega
description: Estrategia de entrega del proyecto, capas horizontales (base transversal) y rebanadas verticales (valor de punta a punta). Úsalo al clasificar, dimensionar, priorizar o diseñar una funcionalidad.
user-invocable: false
---

# Estrategia de entrega: capas horizontales + rebanadas verticales

## Capas horizontales (la base, primero)
Elementos transversales que se construyen **una vez** y que usan todas las funcionalidades:
- Configuración y estructura del proyecto.
- CI y hooks.
- Autenticación.
- Manejo de errores y logging.
- Cliente de base de datos y migraciones.
- Design system o librería de componentes base (web y mobile).
- Utilidades compartidas (`Money`, validación, paginación…).
- Integraciones con puerto propio: almacenamiento de imágenes y pasarela de pagos (ADR-002).

Una capa horizontal se especifica con `tipo: horizontal`. No necesita historia de usuario final, pero sí criterios de aceptación verificables.

## Rebanadas verticales (el valor, después)
- Cada historia de usuario se entrega **de punta a punta**: UI (web y/o mobile) → lógica → API → datos → pruebas.
- Al terminar, queda **demostrable y desplegable**.
- **Tamaño:** de 1 a 3 días de trabajo humano equivalente. Si es mayor, se divide (por ejemplo, el camino feliz en una rebanada y los casos borde en otra).
- Cada rebanada tiene su propia spec SDD con `tipo: vertical`.

## Regla de oro
**Una rebanada vertical no crea infraestructura nueva.** Si necesita algo transversal que no existe:
1. Se detiene el diseño de la rebanada.
2. Se crea (o amplía) la funcionalidad horizontal correspondiente y se completa.
3. Se retoma la rebanada.

El `arquitecto` lo detecta en `/disenar` y el `revisor` lo comprueba en `/verificar`.

## Priorización
1. Las capas horizontales que bloquean la primera rebanada.
2. Las rebanadas por **valor y riesgo**: primero el camino feliz más importante del negocio, después los casos borde.
3. El riesgo técnico alto (p. ej. la concurrencia sobre prendas únicas) se ataca pronto para aprender barato.

El orden vigente vive en `specs/00-vision/roadmap.md`.

## Cómo distinguirlas
| Pregunta | Horizontal | Vertical |
|----------|------------|----------|
| ¿La percibe el usuario final? | No directamente | Sí |
| ¿La reutilizan varias funcionalidades? | Sí | No |
| ¿Se demuestra con una historia de usuario? | No | Sí |
