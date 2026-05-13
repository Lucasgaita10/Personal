# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile=false

FROM base AS build
# Copy the full /repo from deps so per-workspace node_modules (which pnpm
# creates as apps/*/node_modules and packages/*/node_modules) are present,
# then overlay source.
COPY --from=deps /repo /repo
COPY . .
# Next.js rewrites() is evaluated at build time, so API_BASE_URL must be
# set BEFORE `next build` runs — otherwise `/bff/*` proxies fall back to
# localhost:4000, which doesn't resolve inside the web container. Pin to
# the docker-compose service name "api" which is reachable on the internal
# network.
ENV API_BASE_URL=http://api:4000
RUN pnpm --filter @stone-gate/web build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3100
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3100
CMD ["node", "apps/web/server.js"]
