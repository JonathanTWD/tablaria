# Build from the repository root: docker build -f wise-data-backend/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# Manifests first, so the dependency layer is reused until they change.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY wise-data-frontend/package.json wise-data-frontend/
COPY e2e/package.json e2e/
COPY wise-data-backend/package.json wise-data-backend/prisma.config.ts wise-data-backend/
# postinstall runs `prisma generate`, which needs the schema.
COPY wise-data-backend/prisma wise-data-backend/prisma
RUN pnpm install --frozen-lockfile --filter wise-data-backend...

FROM deps AS build
COPY packages/shared packages/shared
COPY wise-data-backend wise-data-backend
RUN pnpm --filter @wisedata/shared build && pnpm --filter wise-data-backend build

# One-off job that applies pending migrations; it needs the Prisma CLI (a dev dependency).
FROM build AS migrate
WORKDIR /repo/wise-data-backend
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# Production dependencies and compiled code only. The Prisma client is
# generated into src/, so it is already compiled inside dist/.
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY wise-data-frontend/package.json wise-data-frontend/
COPY e2e/package.json e2e/
COPY wise-data-backend/package.json wise-data-backend/
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter wise-data-backend...
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/wise-data-backend/dist wise-data-backend/dist
WORKDIR /repo/wise-data-backend
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1
CMD ["node", "dist/main"]
