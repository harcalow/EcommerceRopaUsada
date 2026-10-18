# Dockerfile multi-stage de la web (ADR-003). Paquete: @perchados/web.
# Contexto de build: la raíz del monorepo. Etapas: base, pruned, deps, dev, build, prod.
# La etapa prod usa output: 'standalone' (next.config.ts).

FROM node:24.21.0-alpine3.23 AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV TURBO_TELEMETRY_DISABLED=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.34.7 --activate
WORKDIR /app

FROM base AS pruned
RUN npm install --global turbo@2.11.5
COPY . .
RUN turbo prune @perchados/web --docker

FROM base AS deps
COPY --from=pruned /app/out/json/ .
COPY --from=pruned /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Desarrollo (compose, target: dev): el código se monta desde el host y el comando
# compila los paquetes del workspace y arranca next dev.
FROM deps AS dev
ENV NODE_ENV=development
COPY --from=pruned /app/out/full/ .
# turbo prune no incluye los archivos de la raíz que extienden los tsconfig
COPY --from=pruned /app/tsconfig.base.json ./tsconfig.base.json
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec turbo run build --filter=@perchados/web^... && pnpm --filter @perchados/web dev"]

FROM dev AS build
ENV NODE_ENV=production
RUN pnpm exec turbo run build --filter=@perchados/web

FROM node:24.21.0-alpine3.23 AS prod
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "apps/web/server.js"]
