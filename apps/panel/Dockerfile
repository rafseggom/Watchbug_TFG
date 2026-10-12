# Watchbug panel image — static SPA (INV-03), multi-stage: node build → nginx.
# Build context is the REPO ROOT (docker-compose sets it).
FROM node:24.21.0-alpine3.24 AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/panel/package.json apps/panel/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/panel apps/panel
RUN npm run build -w @watchbug/panel

# --- serve -----------------------------------------------------------------
FROM nginx:1.30.5-alpine3.24

# Same-origin API proxy (A-10) — `location /api/` → http://api:3000.
COPY apps/panel/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/panel/dist /usr/share/nginx/html

EXPOSE 80
