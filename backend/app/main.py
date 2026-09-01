from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health, incidents


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed placeholder (real seeding after DB migration)
    # Import here to avoid circular deps
    try:
        from app.db import get_engine

        # Try to seed if DB reachable; don't fail startup if DB down (health will show disconnected)
        settings = get_settings()
        # Seed is deferred to explicit migration step for tracer; no-op here
        _ = settings
    except Exception:
        pass
    yield
    # Shutdown: dispose engine
    try:
        from app.db import get_engine

        engine = get_engine()
        await engine.dispose()
    except Exception:
        pass


def create_app() -> FastAPI:
    settings = get_settings()
    docs_url = "/docs" if settings.DOCS_ENABLED else None
    openapi_url = "/openapi.json" if settings.DOCS_ENABLED else None
    redoc_url = "/redoc" if settings.DOCS_ENABLED else None

    app = FastAPI(
        lifespan=lifespan,
        docs_url=docs_url,
        openapi_url=openapi_url,
        redoc_url=redoc_url,
    )

    # CORS middleware - allowlist for admin, ingest handles open CORS via header echo
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "PATCH", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Watchbug-Key", "X-Project-Key"],
    )

    app.include_router(health.router)
    app.include_router(incidents.router)

    return app


app = create_app()
