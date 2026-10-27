# Build from the repository root: docker build -f wise-data-frontend/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY wise-data-backend/package.json wise-data-backend/
COPY e2e/package.json e2e/
COPY wise-data-frontend/package.json wise-data-frontend/
RUN pnpm install --frozen-lockfile --filter wise-data-frontend...
COPY packages/shared packages/shared
COPY wise-data-frontend wise-data-frontend
RUN pnpm --filter @wisedata/shared build && pnpm --filter wise-data-frontend build

# Static files plus a reverse proxy for /api, so the app and the API share one
# origin and the httpOnly session cookies just work.
FROM nginxinc/nginx-unprivileged:1.27-alpine
ENV API_UPSTREAM=http://api:3000
COPY wise-data-frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/wise-data-frontend/dist /usr/share/nginx/html
EXPOSE 8080
