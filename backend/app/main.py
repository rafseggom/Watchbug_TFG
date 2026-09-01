from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.limiter import limiter
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


class NullOriginMiddleware(BaseHTTPMiddleware):
    """Reject Origin: null (sandboxed iframe/file://) with 403 before any other handling per SEC-01 / T-02-03-01."""

    async def dispatch(self, request: Request, call_next):
        if request.headers.get("origin") == "null":
            return JSONResponse(status_code=403, content={"detail": "origin not allowed"})
        return await call_next(request)


class IngestCorsMiddleware(BaseHTTPMiddleware):
    """Handle OPTIONS preflight for POST /api/incidents with any Origin.

    CORSMiddleware with allowlist would return 400 Disallowed for arbitrary origins,
    but ingest must be open per D-13. This middleware intercepts OPTIONS before CORS
    and returns 200 with echo for any origin (except null which is already rejected).
    """

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS" and request.url.path == "/api/incidents":
            origin = request.headers.get("origin")
            if origin and origin != "null":
                headers = {
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "POST, OPTIONS, GET, PATCH",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Watchbug-Key, X-Project-Key",
                    "Access-Control-Max-Age": "600",
                    "Vary": "Origin",
                }
                return Response(status_code=200, headers=headers)
            if not origin:
                return Response(status_code=200, headers={"Access-Control-Allow-Origin": "*", "Vary": "Origin"})
        return await call_next(request)


def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    # slowapi exc.detail contains string like "10 per 1 minute"
    # Return JSON envelope with Retry-After header per D-14
    return JSONResponse(
        status_code=429,
        content={"detail": "rate limit exceeded", "retry_after": str(exc.detail)},
        headers={"Retry-After": str(exc.detail)},
    )


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

    # Rate limiter setup — in-memory per process, single worker only (Pitfall 6)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

    # Middleware order: innermost first, outermost last (Starlette stacks reverse).
    # Diagram: Null (outermost, reject null early) -> IngestCors (OPTIONS open) -> CORS -> RateLimiter -> router
    # So add innermost first: SlowAPIMiddleware, then CORS, then IngestCors, then Null outermost.
    app.add_middleware(SlowAPIMiddleware)

    # CORS middleware - allowlist for admin, ingest handles open CORS via header echo (D-13)
    # Never allow_origins=["*"] with allow_credentials True (Pitfall 4 ValueError)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "PATCH", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Watchbug-Key", "X-Project-Key"],
    )

    app.add_middleware(IngestCorsMiddleware)

    app.add_middleware(NullOriginMiddleware)

    app.include_router(health.router)
    app.include_router(incidents.router)
    app.include_router(auth.router)

    return app


app = create_app()
