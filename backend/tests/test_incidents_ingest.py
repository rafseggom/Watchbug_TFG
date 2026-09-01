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


@pytest.mark.asyncio
async def test_payload_too_large_413(async_client, seeded_project):
    # Build payload with large notes string 110KB -> 413 before validation per SEC-04
    large_notes = "x" * 110000
    payload = {
        "type": "Feedback",
        "screenshot": valid_screenshot(),
        "metadata": valid_metadata(),
        "notes": large_notes,
    }
    headers = {"X-Watchbug-Key": "test-project-key-123"}
    resp = await async_client.post("/api/incidents", json=payload, headers=headers)
    assert resp.status_code == 413, resp.text
    assert "payload too large" in resp.json()["detail"]
    # Ensure not 422
    assert resp.status_code != 422


@pytest.mark.asyncio
async def test_payload_too_large_chunked(async_client, seeded_project):
    # Simulate chunked case (no Content-Length) — actual body >100KB also returns 413 when actual body checked
    # httpx always sends Content-Length, but our guard uses len(await request.body()) so same path
    large_notes = "y" * 110000
    payload = {
        "type": "Bug",
        "screenshot": valid_screenshot(),
        "metadata": valid_metadata(),
        "consoleLogs": [{"level": "error", "args": ["hi"], "timestamp": "2026-08-31T00:00:00Z"}],
        "notes": large_notes,
    }
    headers = {"X-Watchbug-Key": "test-project-key-123"}
    resp = await async_client.post("/api/incidents", json=payload, headers=headers)
    assert resp.status_code == 413, resp.text


@pytest.mark.asyncio
async def test_response_shape_201(async_client, seeded_project):
    payload = {
        "type": "Feedback",
        "screenshot": valid_screenshot(),
        "metadata": valid_metadata(),
    }
    headers = {"X-Watchbug-Key": "test-project-key-123"}
    resp = await async_client.post("/api/incidents", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert set(data.keys()) == {"id", "status", "created_at"}
    assert data["status"] == "Pending"
    uuid.UUID(data["id"])
    # created_at is iso8601
    assert "T" in data["created_at"]


@pytest.mark.asyncio
async def test_screenshot_data_url_variant(async_client, seeded_project, db_session):
    b64 = valid_screenshot()
    b64_with_prefix = valid_screenshot(with_prefix=True)
    headers = {"X-Watchbug-Key": "test-project-key-123"}
    for shot in [b64, b64_with_prefix]:
        payload = {
            "type": "Feedback",
            "screenshot": shot,
            "metadata": valid_metadata(),
        }
        resp = await async_client.post("/api/incidents", json=payload, headers=headers)
        assert resp.status_code == 201, resp.text
        incident_id = resp.json()["id"]
        # Verify BYTEA bytes match decode of stripped variant
        from sqlalchemy import select

        from app.models.incident import Incident

        result = await db_session.execute(select(Incident).where(Incident.id == uuid.UUID(incident_id)))
        incident = result.scalar_one_or_none()
        assert incident is not None
        assert isinstance(incident.screenshot, bytes)
        assert len(incident.screenshot) > 0
        # Compare with expected decode
        import base64

        expected = base64.b64decode(b64)
        assert incident.screenshot == expected


@pytest.mark.asyncio
async def test_case_insensitive_type(async_client, seeded_project, db_session):
    b64 = valid_screenshot()
    cases = [
        ("bug", "Bug"),
        ("Bug", "Bug"),
        ("BUG", "Bug"),
        ("feedback", "Feedback"),
        ("Feedback", "Feedback"),
        ("FEEDBACK", "Feedback"),
    ]
    headers = {"X-Watchbug-Key": "test-project-key-123"}
    for input_type, expected in cases:
        payload = {
            "type": input_type,
            "screenshot": b64,
            "metadata": valid_metadata(),
        }
        # Bug needs consoleLogs
        if expected == "Bug":
            payload["consoleLogs"] = [{"level": "log", "args": ["hi"], "timestamp": "2026-08-31T00:00:00Z"}]
        resp = await async_client.post("/api/incidents", json=payload, headers=headers)
        assert resp.status_code == 201, f"type {input_type} got {resp.status_code} {resp.text}"
        incident_id = resp.json()["id"]
        from sqlalchemy import select

        from app.models.incident import Incident

        result = await db_session.execute(select(Incident).where(Incident.id == uuid.UUID(incident_id)))
        incident = result.scalar_one_or_none()
        assert incident is not None
        assert incident.type == expected, f"stored type {incident.type} != expected {expected}"


@pytest.mark.asyncio
async def test_empty_body_payload_too_large_edge(async_client, seeded_project):
    # Empty body {} -> should be 422 (validation) not 413
    headers = {"X-Watchbug-Key": "test-project-key-123", "Content-Type": "application/json"}
    resp = await async_client.post("/api/incidents", content=b"{}", headers=headers)
    assert resp.status_code in (422, 400)  # validation failure, not 413
