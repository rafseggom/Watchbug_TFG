# Watchbug API image — pinned per STACK.md (Node 24 LTS, "Krypton").
# Build context is the REPO ROOT (docker-compose sets it): the workspace
# manifests of packages/* and apps/* are needed by `npm ci`.
FROM node:24.21.0-alpine3.24 AS build

WORKDIR /app

# Manifests first so the (heavy) install layer caches on lockfile changes only.
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/panel/package.json apps/panel/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build -w @watchbug/api

# --- runtime ---------------------------------------------------------------
FROM node:24.21.0-alpine3.24 AS runtime

WORKDIR /app
ENV NODE_ENV=production

# node_modules (external at runtime: esbuild bundles the app, `--packages=external`)
# plus the committed Drizzle migration set, which the boot command applies.
COPY --from=build /app /app

WORKDIR /app/apps/api
EXPOSE 3000

# Apply the committed migration (idempotent) before serving, so a clean
# `docker compose up` has the schema without a manual step (DEP-01). Drizzle
# reads DATABASE_URL from the compose environment; the generated SQL under
# drizzle/ is the reviewable artifact.
CMD ["sh", "-c", "/app/node_modules/.bin/drizzle-kit migrate && node dist/index.mjs"]
