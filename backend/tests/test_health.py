import pytest
from sqlalchemy import text
from unittest.mock import AsyncMock

from app.db import get_db
from app.main import app


@pytest.mark.asyncio
async def test_health_ok(async_client, db_session):
    resp = await async_client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["db"] == "connected"


@pytest.mark.asyncio
async def test_health_db_disconnected(async_client):
    # Override get_db to simulate DB failure
    async def failing_get_db():
        # Yield a mock session that raises on execute
        mock = AsyncMock()
        mock.execute.side_effect = Exception("db down")
        yield mock

    app.dependency_overrides[get_db] = failing_get_db
    # Need to recreate client after override
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["db"] == "disconnected"
    # Restore
    app.dependency_overrides.pop(get_db, None)
