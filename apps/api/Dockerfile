# Plantilla multi-stage (ADR-003). Paquete esperado: @perchados/api.
# Contexto de build: la raíz del monorepo. Se validará al generar la app (spec 002).
# Ajustar las rutas de salida (dist/main.js) al resultado real de la app.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS pruned
RUN pnpm add -g turbo
COPY . .
RUN turbo prune @perchados/api --docker

FROM base AS deps
COPY --from=pruned /app/out/json/ .
COPY --from=pruned /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS dev
ENV NODE_ENV=development
COPY --from=pruned /app/out/full/ .
EXPOSE 3001
CMD ["pnpm", "--filter", "@perchados/api", "dev"]

FROM dev AS build
RUN pnpm turbo run build --filter=@perchados/api
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24-alpine AS prod
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3001/v1/health || exit 1
CMD ["node", "apps/api/dist/main.js"]
