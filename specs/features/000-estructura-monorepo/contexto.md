---
id: 000
titulo: Estructura base del monorepo
tipo: horizontal
---

# Contexto 000 — Estructura base del monorepo

## Idea original
"Implementa la arquitectura monorepo y crea la estructura necesaria. No instales tecnologías de momento. Importante usar Docker." Además, la pasarela de pago será Mercado Pago, pero debe poder cambiarse fácilmente.

## Lo que ya existe
- Estructura agéntica: `CLAUDE.md`, `.claude/` (agentes, skills, hooks) y `.mcp.json`.
- Specs: plantillas, visión (vacía), roadmap y glosario (vacío).
- ADR-001 (stack y monorepo), ADR-002 (pagos desacoplados) y ADR-003 (Docker), en `propuesta`.
- Ningún código de aplicación.
- Entorno: Python 3.12 disponible. **Node.js y Docker no están instalados.**

## Memoria relevante
Sin entradas todavía.

## Clasificación
- **Tipo:** horizontal.
- **Justificación:** es la base de configuración y estructura que usarán todas las funcionalidades; no aporta valor directo al usuario final.
- **Capas horizontales previas requeridas:** ninguna (es la primera).

## Riesgos y dudas iniciales
- Los Dockerfiles no se pueden probar hasta generar las apps con sus CLIs (siguiente capa horizontal).
- La imagen del emulador S3 debe elegirse verificando su licencia y disponibilidad.
