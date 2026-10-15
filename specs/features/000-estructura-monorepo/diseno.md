---
id: 000
spec: ./spec.md
estado: borrador
autor: arquitecto
---

# Diseño 000 — Estructura base del monorepo

## Resumen de la solución
Crear solo archivos de configuración, carpetas (con `.gitkeep`) y documentación por aplicación, siguiendo ADR-001, ADR-002 y ADR-003. Ninguna dependencia se instala.

## Cobertura de requisitos
| RF / CB | Cómo se resuelve |
|---------|------------------|
| RF-001 | Archivos raíz del monorepo (T-01) |
| RF-002 | Skills `nestjs-hexagonal`, `nextjs-app-router`, `expo-router-mvvm`, `docker-dev` (T-02, T-03, T-04, T-06) |
| RF-003 | Estructura hexagonal de `payments` (T-02) |
| RF-004, CB-001, CB-004 | `docker-compose.yml` con perfil `apps` y volúmenes con nombre (T-06) |
| RF-005 | Dockerfiles multi-stage (T-06) |
| RF-006, CB-002, CB-003 | `.env.example` con puertos parametrizados; `.env` en `.gitignore` (T-01, T-06) |

## Componentes
```
/
├── package.json             Raíz del workspace (scripts de Turborepo, sin dependencias)
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .nvmrc                   24
├── .editorconfig
├── .gitignore
├── .dockerignore
├── .env.example
├── docker-compose.yml
├── docker/postgres/init/    Scripts SQL de inicialización (vacío)
├── apps/
│   ├── api/
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── catalog/     ┐
│   │       │   ├── inventory/   │ cada uno con:
│   │       │   ├── cart/        │   domain/ application/ infrastructure/ interface/
│   │       │   ├── orders/      │
│   │       │   ├── users/       │
│   │       │   ├── media/       ┘
│   │       │   └── payments/
│   │       │       ├── domain/
│   │       │       ├── application/ports/
│   │       │       ├── infrastructure/adapters/{mercadopago,fake}/
│   │       │       └── interface/
│   │       └── shared/          Utilidades transversales (errores, Money, config)
│   ├── web/
│   │   ├── Dockerfile
│   │   └── src/{app,features,shared}/
│   └── mobile/
│       └── src/{app,features,shared}/
└── packages/
    ├── contracts/README.md
    ├── api-client/README.md
    ├── ui-tokens/README.md
    └── config/README.md

.claude/skills/              Convenciones por tema (ejemplos ✅ / ❌)
├── nestjs-hexagonal/        apps/api: módulos, capas, puertos y adaptadores
├── nextjs-app-router/       apps/web: rutas, features, Server/Client Components
├── expo-router-mvvm/        apps/mobile: rutas, features, view-models
└── docker-dev/              Compose, perfiles, Dockerfiles y variables
```
Al crear cada skill se añade al campo `skills:` del subagente que la usa (`backend-dev`, `frontend-dev`).

**Docker:**
- **`docker-compose.yml`:**
  - `postgres`, `storage` (emulador S3) y `mailpit`, con imágenes de versión fijada, healthchecks, volúmenes con nombre y puertos tomados de `.env`.
  - Perfil `apps` con `api` y `web` (target `dev`, código montado como volumen).
- **Dockerfiles:** etapas `base` → `pruned` (`turbo prune`) → `deps` → `dev` → `build` → `prod`. Usuario `node` en `prod`.

## Contratos de API
No aplica (no hay endpoints en esta capa).

## Modelo de datos
No aplica. `docker/postgres/init/` queda vacío; las migraciones llegarán con la capa "Cliente de base de datos".

## Impacto en lo existente
- **Hook `guardia_escritura.py`:** las rutas de código pasan a escribirse solo con una funcionalidad aprobada. Sin cambios en el hook.
- **`CLAUDE.md` raíz:** se actualizan la estructura, las referencias a las skills nuevas y los comandos de Docker (T-07).
- **Subagentes `backend-dev` y `frontend-dev`:** precargan las skills nuevas.
- **`.gitignore`:** ya existe (creado con ADR-004 para `logs/`); T-01 lo amplía.
- Sin código previo que pueda sufrir regresiones.

## Decisiones técnicas
ADR-001, ADR-002, ADR-003 y ADR-004 (skills de convenciones).

## Seguridad y privacidad
- `.env` en `.gitignore`.
- `.env.example` sin valores reales.
- Imágenes de producción sin root.

## Estrategia de pruebas
- Validación sintáctica de JSON y YAML.
- Comprobación manual de los CA y CB.
- `docker compose config` cuando Docker esté instalado.

## Riesgos
- Los Dockerfiles no se pueden probar hasta generar las apps con sus CLIs. Se validarán en la siguiente capa horizontal.
