---
id: ADR-010
estado: aceptada   # propuesta | aceptada | reemplazada por ADR-XXX
fecha: 2026-10-15
---

# ADR-010 — La base técnica se entrega dentro de la primera funcionalidad

## Contexto
La estrategia de entrega preveía capas horizontales como funcionalidades separadas (000 estructura y Docker; 002 fundaciones) antes de la primera rebanada vertical (001 login de administrador), con la regla «una rebanada vertical no crea infraestructura».

El dueño (Harold, 15-10-2026) decidió que el proyecto tenga **una sola funcionalidad**, la 001, que es el único requerimiento que pidió. Tener tres specs para un solo requerimiento multiplicaba aprobaciones, trazabilidad y documentos sin aportar valor al usuario. Ya hay un commit de respaldo de la situación anterior (84c8856).

## Opciones consideradas
1. **Mantener 000 → 002 → 001 como funcionalidades separadas.**
   - Pros: separación clara entre base técnica y valor; cada base se aprueba por separado.
   - Contras: tres specs, tres diseños y tres ciclos de verificación para un único requerimiento; la base se diseña sin una historia que la justifique; contradice la decisión del dueño.
2. **Fusionar la base técnica en la 001, trazada como requisitos técnicos (RT-xxx) en su `diseno.md`.**
   - Pros: una sola spec que el dueño reconoce; la base se recorta a lo que el login y la Definition of Done necesitan; trazabilidad RF/CA/CB + RT en un único `tasks.md`.
   - Contras: la primera funcionalidad es grande (se mitiga con hitos y un PR por hito); la base técnica no queda en una spec de producto, sino en el diseño.
3. **Añadir los requisitos técnicos a la `spec.md` de la 001.**
   - Contras: mezcla requisitos de producto con decisiones técnicas en un documento que aprueba negocio; obliga a reaprobar la spec.

## Decisión
**Opción 2.** La base técnica (monorepo, Docker, apps, contrato, errores, logs, configuración, base de datos, sesión, límites, design system, E2E, CI) forma parte del diseño y de las tareas de la funcionalidad que la necesita primero:
- Se describe en su `diseno.md` como «Requisitos técnicos de base (RT-xxx)», cada uno con su verificación y su origen (RNF de la spec, ADR o Definition of Done).
- Se entrega en hitos con un PR por hito dentro de la misma rama.
- Se recorta lo que no aporta a esa funcionalidad ni a la Definition of Done, y se anota en «Fuera de alcance de esta funcionalidad».
- La regla «capas horizontales como funcionalidades separadas» queda **derogada**. Las funcionalidades siguientes reutilizan esta base; si necesitan infraestructura nueva, su diseño la incluye como RT y la justifica.

## Consecuencias
- ➕ Una sola funcionalidad (001) y un solo flujo SDD para lo que pidió el dueño.
- ➕ Menos base especulativa: solo se construye lo que el login usa (p. ej. sin `Checkbox`, sin catálogo de componentes, sin `DocsModule`).
- ➖ PR grandes: se mitiga con 4 hitos y un commit por tarea.
- ➖ Hay que actualizar fuera de `specs/` las referencias a la regla antigua: la skill `estrategia-entrega`, `CLAUDE.md` (flujo y «Estado actual») y cualquier skill o agente que cite 000 o 002. Lo hace el orquestador.
- Los ADR-001 a ADR-009 no cambian de decisión. Como están `aceptada`, no se editan: sus referencias a «la 000» y «la 002» (ADR-004, ADR-007, ADR-008 y ADR-009), y a `specs/features/002-fundaciones/diseno.md`, **se leen como «001 (base técnica)»** y `specs/features/001-login-administrador/diseno.md`, que contiene el detalle (paleta, contraste, componentes, herramientas, sesión).
