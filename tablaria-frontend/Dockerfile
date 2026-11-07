# Build from the repository root: docker build -f tablaria-frontend/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY tablaria-backend/package.json tablaria-backend/
COPY e2e/package.json e2e/
COPY tablaria-frontend/package.json tablaria-frontend/
RUN pnpm install --frozen-lockfile --filter tablaria-frontend...
COPY packages/shared packages/shared
COPY tablaria-frontend tablaria-frontend
RUN pnpm --filter @tablaria/shared build && pnpm --filter tablaria-frontend build

# Static files plus a reverse proxy for /api, so the app and the API share one
# origin and the httpOnly session cookies just work.
FROM nginxinc/nginx-unprivileged:1.27-alpine
ENV API_UPSTREAM=http://api:3000
# Origin of the attachments bucket, allowed in the CSP for images (empty: none).
ENV STORAGE_ORIGIN=""
COPY tablaria-frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/tablaria-frontend/dist /usr/share/nginx/html
EXPOSE 8080
