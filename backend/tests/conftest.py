import asyncio
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.main import app
from app.db import get_db, Base
from app.config import get_settings
from app.models.project import Project

# Use TEST_DATABASE_URL if set, else DATABASE_URL, fallback to docker network postgres if host fails
# For host Windows with Docker Desktop, asyncpg localhost is broken; tests should run via docker
# So we try to use postgres:5432 when DATABASE_URL contains localhost and we are not in docker

TEST_DB_URL = None

def _get_test_db_url():
    import os
    url = os.getenv("TEST_DATABASE_URL") or get_settings().DATABASE_URL
    # If running inside docker (postgres host reachable), use it as is via link
    # For host, try to use localhost; if that fails, tests will fallback to attempting connection and skip
    return url

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture(scope="function")
async def db_session():
    url = _get_test_db_url()
    # Try to create engine and create tables; if pg not reachable, fallback to sqlite for host local dev
    # But we prefer real PG; so we attempt PG first
    from sqlalchemy import text

    engine = None
    use_sqlite = False
    try:
        engine = create_async_engine(url, poolclass=NullPool, echo=False)
        async with engine.begin() as conn:
            # Try simple query to test connectivity
            await conn.execute(text("SELECT 1"))
            # Create tables if not exists (for test isolation, create_all)
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        # Fallback to sqlite for host where Docker Desktop port forwarding fails
        if engine:
            try:
                await engine.dispose()
            except:
                pass
        use_sqlite = True
        import pathlib, tempfile, os
        db_path = pathlib.Path(tempfile.gettempdir()) / "watchbug_test.db"
        # Ensure fresh DB for sqlite fallback - remove existing file to avoid stale schema
        try:
            if db_path.exists():
                db_path.unlink()
        except:
            pass
        engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", poolclass=NullPool, echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print(f"[conftest] PG not reachable ({e}), using sqlite fallback for host")

    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as session:
        yield session
        # Cleanup: truncate tables for isolation
        try:
            from sqlalchemy import text
            await session.execute(text("DELETE FROM incidents"))
            await session.execute(text("DELETE FROM projects"))
            await session.execute(text("DELETE FROM users"))
            await session.commit()
        except:
            pass
    await engine.dispose()


@pytest.fixture(scope="function")
async def async_client(db_session):
    # Override get_db
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def seeded_project(db_session):
    # Seed project for tests
    from sqlalchemy import select
    # Check existing
    result = await db_session.execute(select(Project).where(Project.api_key == "test-project-key-123"))
    proj = result.scalar_one_or_none()
    if not proj:
        proj = Project(name="test-project", api_key="test-project-key-123")
        db_session.add(proj)
        await db_session.commit()
        await db_session.refresh(proj)
    return proj


def valid_screenshot(with_prefix=False):
    # 1x1 red dot PNG base64 (minimal)
    b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC"
    if with_prefix:
        return f"data:image/png;base64,{b64}"
    return b64


def valid_metadata():
    return {"url": "https://example.com", "userAgent": "test-agent", "timestamp": "2026-08-31T00:00:00Z"}


async def login_helper(client, email="admin@watchbug.local", password="Admin123!"):
    """Helper to login and return cookie dict."""
    resp = await client.post("/api/auth/login", json={"email": email, "password": password})
    return resp, dict(resp.cookies)


async def seed_admin_helper(db_session, email="admin@watchbug.local", password="Admin123!"):
    from app.services.auth_service import seed_admin

    await seed_admin(db_session, email, password)
