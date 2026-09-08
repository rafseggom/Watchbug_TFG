#!/usr/bin/env sh
set -eu

echo "Applying Alembic migrations..."
alembic -c alembic.ini upgrade head

echo "Starting uvicorn server..."
# Single worker required for slowapi in-memory limiter (Pitfall 6)
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1 --proxy-headers
