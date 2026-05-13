# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile=false

FROM base AS build
# Copy the full /repo from deps so per-workspace node_modules (which pnpm
# creates as packages/*/node_modules) are present, then overlay source.
COPY --from=deps /repo /repo
COPY . .
RUN pnpm --filter @stone-gate/db prisma:generate && \
    pnpm --filter @stone-gate/api build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# Copy the whole /repo so the Prisma client (in packages/db/node_modules/.prisma)
# and all workspace symlinks under packages/*/node_modules survive into runtime.
COPY --from=build /repo /app
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
