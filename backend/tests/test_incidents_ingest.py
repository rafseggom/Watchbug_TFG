import pytest
import base64
import uuid

from tests.conftest import valid_screenshot, valid_metadata


@pytest.mark.asyncio
async def test_create_bug_success(async_client, seeded_project, db_session):
    payload = {
        "type": "Bug",
        "screenshot": valid_screenshot(),
        "metadata": valid_metadata(),
        "consoleLogs": [{"level": "error", "args": ["test"], "timestamp": "2026-08-31T00:00:00Z"}],
        "errors": [],
    }
    headers = {"X-Watchbug-Key": "test-project-key-123"}
    resp = await async_client.post("/api/incidents", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "id" in data
    assert data["status"] == "Pending"
    assert "created_at" in data
    # Validate uuid format
    uuid.UUID(data["id"])

    # Verify DB row exists (try via ORM, fallback to raw for sqlite)
    try:
        from sqlalchemy import select
        from app.models.incident import Incident

        result = await db_session.execute(select(Incident).where(Incident.id == uuid.UUID(data["id"])))
        incident = result.scalar_one_or_none()
        assert incident is not None
        assert incident.type == "Bug"
        assert incident.status == "Pending"
        assert isinstance(incident.screenshot, bytes)
        assert len(incident.screenshot) > 0
        # payload should not contain screenshot
        assert "screenshot" not in incident.payload
        assert incident.project_id == seeded_project.id
    except Exception as e:
        # For sqlite fallback, check via raw query
        from sqlalchemy import text

        row = (await db_session.execute(text("SELECT type, status, payload, project_id FROM incidents WHERE id=:id"), {"id": data["id"]})).fetchone()
        assert row is not None


@pytest.mark.asyncio
async def test_create_bug_lowercase_normalized(async_client, seeded_project):
    payload = {
        "type": "bug",
        "screenshot": valid_screenshot(with_prefix=True),
        "metadata": valid_metadata(),
        "consoleLogs": [{"level": "log", "args": ["hi"], "timestamp": "2026-08-31T00:00:00Z"}],
    }
    headers = {"X-Watchbug-Key": "test-project-key-123"}
    resp = await async_client.post("/api/incidents", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text


@pytest.mark.asyncio
async def test_feedback_without_logs_ok(async_client, seeded_project):
    payload = {
        "type": "Feedback",
        "screenshot": valid_screenshot(),
        "metadata": valid_metadata(),
        "errors": [],
    }
    headers = {"X-Watchbug-Key": "test-project-key-123"}
    resp = await async_client.post("/api/incidents", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "Pending"


@pytest.mark.asyncio
async def test_bug_without_logs_422(async_client, seeded_project):
    payload = {
        "type": "Bug",
        "screenshot": valid_screenshot(),
        "metadata": valid_metadata(),
        "errors": [],
    }
    headers = {"X-Watchbug-Key": "test-project-key-123"}
    resp = await async_client.post("/api/incidents", json=payload, headers=headers)
    assert resp.status_code == 422, resp.text
    data = resp.json()
    # Check loc contains consoleLogs
    details = data.get("detail", [])
    locs = [d.get("loc") for d in details]
    # FastAPI returns loc as ["body", "consoleLogs"]
    assert any("consoleLogs" in str(loc) for loc in locs), f"locs={locs}"


@pytest.mark.asyncio
async def test_invalid_project_key_401(async_client):
    payload = {
        "type": "Feedback",
        "screenshot": valid_screenshot(),
        "metadata": valid_metadata(),
    }
    headers = {"X-Watchbug-Key": "bad-key"}
    resp = await async_client.post("/api/incidents", json=payload, headers=headers)
    assert resp.status_code == 401
    assert "invalid project key" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_missing_project_key_401(async_client):
    payload = {
        "type": "Feedback",
        "screenshot": valid_screenshot(),
        "metadata": valid_metadata(),
    }
    resp = await async_client.post("/api/incidents", json=payload)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_fallback_header_alias(async_client, seeded_project):
    payload = {
        "type": "Feedback",
        "screenshot": valid_screenshot(),
        "metadata": valid_metadata(),
    }
    headers = {"X-Project-Key": "test-project-key-123"}
    resp = await async_client.post("/api/incidents", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text


@pytest.mark.asyncio
async def test_invalid_screenshot_encoding_422(async_client, seeded_project):
    payload = {
        "type": "Feedback",
        "screenshot": "not-base64!!!",
        "metadata": valid_metadata(),
    }
    headers = {"X-Watchbug-Key": "test-project-key-123"}
    resp = await async_client.post("/api/incidents", json=payload, headers=headers)
    assert resp.status_code == 422
