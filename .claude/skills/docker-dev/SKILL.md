---
name: docker-dev
description: Docker del proyecto (ADR-003). Cómo levantar la infraestructura y el perfil apps, puertos y variables, reseteo de datos, alta de servicios y reglas de los Dockerfiles. Úsala al tocar docker-compose.yml, un Dockerfile o .env.example.
user-invocable: false
---

# docker-dev

## Infraestructura (siempre)
| Servicio | Imagen (versión fijada) | Puerto host (variable, defecto) | Para qué |
|----------|-------------------------|---------------------------------|----------|
| `postgres` | `postgres:17-alpine` | `POSTGRES_PORT` 5432 | Base de datos |
| `storage` | `chrislusf/seaweedfs:4.48` | `STORAGE_API_PORT` 9000 (API S3), `STORAGE_CONSOLE_PORT` 9001 (UI del filer) | Emulador S3 |
| `storage-init` | misma de `storage` | — | Crea `STORAGE_BUCKET` y termina |
| `mailpit` | `axllent/mailpit:v1.27` | `MAILPIT_SMTP_PORT` 1025, `MAILPIT_UI_PORT` 8025 | Captura de emails |

**Por qué SeaweedFS:** MinIO CE dejó de publicar imágenes en 2025. SeaweedFS tiene licencia Apache-2.0, imagen oficial en Docker Hub, mantenimiento activo y API S3 compatible. Riesgo: el emulador S3 es menos común que MinIO; si la API S3 mostrara incompatibilidades con el SDK, se reevalúa (alternativa: RustFS, Apache-2.0) y se actualiza el ADR-003. El proveedor real (S3, R2) será solo configuración.

## Comandos
```bash
cp .env.example .env              # una vez; el archivo local nunca se versiona
docker compose up -d              # solo infraestructura (CB-001)
docker compose --profile apps up -d --build   # + api y web (código montado, recarga en caliente)
docker compose ps                 # los 3 servicios deben quedar healthy
docker compose logs -f postgres
docker compose down               # para; conserva datos (CB-004)
docker compose down -v            # BORRA los volúmenes: reset total de datos
```
Reset parcial: `docker compose down && docker volume rm perchados_postgres-data`.
Scripts SQL en `docker/postgres/init/` se ejecutan solo con el volumen de Postgres vacío (tras un reset).

## Reglas
- Toda variable usada en `docker-compose.yml` existe en `.env.example` con comentario (CA-006).
- Puertos siempre parametrizados: `"${POSTGRES_PORT:-5432}:5432"` (CB-002).
- Versiones de imagen fijadas; nunca `latest`.
- Dentro de la red de Compose los servicios se alcanzan por nombre (`postgres:5432`), no por `localhost`.
- Los secretos de ejemplo no son reales; los reales viven solo en el archivo de entorno local.

```yaml
# ❌ latest, puerto fijo, sin healthcheck ni volumen
cache:
  image: redis:latest
  ports: ["6379:6379"]
# ✅
cache:
  image: redis:7.4-alpine
  ports: ["${REDIS_PORT:-6379}:6379"]
  volumes: [cache-data:/data]
  healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 5s, timeout: 3s, retries: 10 }
```

## Añadir un servicio nuevo
1. Imagen oficial con versión fijada y licencia verificada (decisión relevante: ADR).
2. `healthcheck`, volumen con nombre declarado en `volumes:` y puertos desde variables con valor por defecto.
3. Añade sus variables a `.env.example` con comentario.
4. Si lo consumen `api` o `web`, añade `depends_on` con `condition: service_healthy`.
5. Valida: `docker compose --env-file .env.example config -q` (también con `--profile apps`).

## Dockerfiles (`apps/api`, `apps/web`)
Etapas: `base` (node:24-alpine, pnpm vía corepack) → `pruned` (`turbo prune <paquete> --docker`) → `deps` (instala con lockfile congelado) → `dev` (compose, `target: dev`) → `build` → `prod`.
- Contexto de build: raíz del monorepo. Paquetes: `@perchados/api`, `@perchados/web`.
- `prod`: usuario `node`, `NODE_ENV=production`, solo artefactos necesarios, `HEALTHCHECK`.
- La web necesita `output: 'standalone'` en `next.config` para `prod`.
- `.dockerignore` excluye `node_modules`, `dist`, `.next`, `.turbo`, entorno (salvo el ejemplo), `.git`, `specs`, `.claude`.
- Estado: validados con las apps reales (T-14 de la 001). Imágenes base fijadas (`node:24.21.0-alpine3.23`); pnpm 10.34.7 vía corepack; `turbo@2.11.5`.
- `dev`: el repo se monta en `/app` y cada `node_modules` va en un volumen con nombre (`*-nm-*`; si se añade un paquete al workspace, añadirlo al servicio en compose); `.next` de la web en el volumen `web-next`; sondeo de archivos activado (WSL/Windows). Tras cambiar dependencias: bajar el perfil y borrar los volúmenes `*-nm-*`.
- Base de pruebas E2E: `perchados_e2e` la crea `docker/postgres/init/01-e2e-database.sql` (solo con volumen vacío; en uno existente: `docker exec perchados-postgres-1 psql -U perchados -d perchados -f /docker-entrypoint-initdb.d/01-e2e-database.sql`). Migrar: `DATABASE_URL=postgresql://<usuario>:<clave>@localhost:5432/perchados_e2e pnpm --filter @perchados/api db:migrate:deploy`.

```dockerfile
# ❌ imagen sin fijar, root, copia todo
FROM node:latest
COPY . .
CMD ["node", "dist/main.js"]
# ✅ etapa prod mínima
FROM node:24-alpine AS prod
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
USER node
HEALTHCHECK CMD wget -q -O /dev/null http://localhost:3001/v1/health || exit 1
```
