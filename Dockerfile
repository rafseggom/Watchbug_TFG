# syntax=docker/dockerfile:1.7

# Stage 0 — Panel builder (Node 22-alpine)
# Builds Vite SPA into backend/api/static/panel/ per panel/vite.config.ts outDir
FROM node:22-alpine AS panel-builder
WORKDIR /app
# Copy dependency manifests first for layer caching
COPY panel/package.json panel/package-lock.json* ./panel/
RUN --mount=type=cache,target=/root/.npm npm --prefix panel ci
# Copy panel source and backend/api (needed for vite outDir "../backend/api/static/panel")
COPY panel/ ./panel/
COPY backend/api/ ./backend/api/
RUN npm --prefix panel run build

# Stage 1 — Python runtime (python:3.12-slim-bookworm)
# Installs deps from pyproject.toml, copies backend + panel dist, runs as non-root
FROM python:3.12-slim-bookworm AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app
WORKDIR /app

# Install curl for HEALTHCHECK, create non-root user, set up app directory
RUN groupadd --system --gid 10001 app && \
    useradd --system --uid 10001 --gid 10001 --create-home --home-dir /home/app app && \
    apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    install -d -o app -g app /app/data

# Copy Python dependencies (layer cache: pyproject.toml first)
COPY backend/pyproject.toml backend/README.md* ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Copy backend source
COPY backend/ ./

# Copy panel dist from builder stage
COPY --from=panel-builder /app/backend/api/static/panel ./api/static/panel

# Copy entrypoint and set permissions
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && chown -R app:app /app

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=60s \
    CMD curl -f http://localhost:8000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
