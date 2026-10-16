# Plantilla multi-stage (ADR-003). Paquete esperado: @perchados/web.
# Contexto de build: la raíz del monorepo. Se validará al generar la app (spec 002).
# La etapa prod requiere output: 'standalone' en next.config (se fija al generar la web).

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS pruned
RUN pnpm add -g turbo
COPY . .
RUN turbo prune @perchados/web --docker

FROM base AS deps
COPY --from=pruned /app/out/json/ .
COPY --from=pruned /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS dev
ENV NODE_ENV=development
COPY --from=pruned /app/out/full/ .
EXPOSE 3000
CMD ["pnpm", "--filter", "@perchados/web", "dev"]

FROM dev AS build
RUN pnpm turbo run build --filter=@perchados/web

FROM node:24-alpine AS prod
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
  CMD wget -q -O /dev/null http://localhost:3000/ || exit 1
CMD ["node", "apps/web/server.js"]
