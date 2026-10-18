# Dockerfile multi-stage de la API (ADR-003). Paquete: @perchados/api.
# Contexto de build: la raíz del monorepo. Etapas: base, pruned, deps, dev, build, prod.

FROM node:24.21.0-alpine3.23 AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV TURBO_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.34.7 --activate
WORKDIR /app

FROM base AS pruned
RUN npm install --global turbo@2.11.5
COPY . .
RUN turbo prune @perchados/api --docker

FROM base AS deps
COPY --from=pruned /app/out/json/ .
COPY --from=pruned /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Desarrollo (compose, target: dev): el código se monta desde el host y el comando
# compila los paquetes del workspace, genera el cliente de Prisma y arranca nest --watch.
FROM deps AS dev
ENV NODE_ENV=development
COPY --from=pruned /app/out/full/ .
# turbo prune no incluye los archivos de la raíz que extienden los tsconfig
COPY --from=pruned /app/tsconfig.base.json ./tsconfig.base.json
EXPOSE 3001
CMD ["sh", "-c", "pnpm exec turbo run build --filter=@perchados/api^... && pnpm --filter @perchados/api db:generate && pnpm --filter @perchados/api dev"]

# Compila (turbo ejecuta db:generate antes de compilar).
FROM dev AS build
RUN pnpm exec turbo run build --filter=@perchados/api

# Dependencias de producción con el lockfile congelado (los paquetes del workspace quedan enlazados).
FROM base AS proddeps
COPY --from=pruned /app/out/json/ .
COPY --from=pruned /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24.21.0-alpine3.23 AS prod
ENV NODE_ENV=production
ENV API_PORT=3001
WORKDIR /app
COPY --from=proddeps --chown=node:node /app/node_modules ./node_modules
COPY --from=proddeps --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=proddeps --chown=node:node /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=build --chown=node:node /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=node:node /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3001/v1/health || exit 1
CMD ["node", "apps/api/dist/src/main.js"]
