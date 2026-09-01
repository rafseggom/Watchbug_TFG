from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, health, incidents


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed admin and default project idempotently
    try:
        from sqlalchemy.ext.asyncio import async_sessionmaker

        from app.db import get_engine
        from app.services.auth_service import seed_admin
        from app.services.project_service import seed_default_project

        settings = get_settings()
        engine = get_engine()
        # Try to seed; don't fail startup if DB not yet migrated or unreachable
        try:
            async_session = async_sessionmaker(engine, expire_on_commit=False)
            async with async_session() as session:
                await seed_admin(session, settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
                # seed default project from DEFAULT_PROJECT_API_KEY
                try:
                    await seed_default_project(session, settings.DEFAULT_PROJECT_API_KEY)
                except Exception:
                    pass
        except Exception:
            pass
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
    app.include_router(auth.router)

    return app


app = create_app()
