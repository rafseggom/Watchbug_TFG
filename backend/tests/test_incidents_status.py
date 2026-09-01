"""Task 02-04: Status update and detail + E2E tests — API-04, AUTH-03.

Covers PATCH Any->Any, 404/422/401, detail BYTEA re-encode, health public, docs gating.
"""

import base64
import uuid

import pytest

from tests.conftest import seed_admin_helper, seed_incidents_helper, valid_metadata, valid_screenshot


@pytest.mark.asyncio
async def test_patch_status_ok(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    incidents = await seed_incidents_helper(db_session, seeded_project.id, count=3)
    target = incidents[0]  # Pending initially for i=0
    assert target.status == "Pending"

    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    resp = await async_client.patch(f"/api/incidents/{target.id}/status", json={"status": "In Progress"}, cookies=cookies)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id"] == str(target.id)
    assert data["status"] == "In Progress"

    # subsequent GET detail shows updated status
    detail = await async_client.get(f"/api/incidents/{target.id}", cookies=cookies)
    assert detail.status_code == 200
    assert detail.json()["status"] == "In Progress"


@pytest.mark.asyncio
async def test_patch_any_to_any_resolved_then_pending(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    incidents = await seed_incidents_helper(db_session, seeded_project.id, count=3)
    target = incidents[2]  # status Resolved for i=2 (0 Pending,1 In Progress,2 Resolved)
    assert target.status == "Resolved"

    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    # Resolved -> Pending should succeed per D-12 Any->Any
    resp = await async_client.patch(f"/api/incidents/{target.id}/status", json={"status": "Pending"}, cookies=cookies)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "Pending"


@pytest.mark.asyncio
async def test_patch_not_found_404(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    await seed_incidents_helper(db_session, seeded_project.id, count=2)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    fake = str(uuid.uuid4())
    resp = await async_client.patch(f"/api/incidents/{fake}/status", json={"status": "Resolved"}, cookies=cookies)
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_patch_invalid_status_422(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    incidents = await seed_incidents_helper(db_session, seeded_project.id, count=1)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    resp = await async_client.patch(f"/api/incidents/{incidents[0].id}/status", json={"status": "Closed"}, cookies=cookies)
    assert resp.status_code == 422, resp.text
    # loc should contain body/status per D-06 shape
    body = resp.json()
    assert "detail" in body
    # ensure loc includes status
    details = body["detail"] if isinstance(body["detail"], list) else [body["detail"]]
    loc_str = str(details)
    assert "status" in loc_str


@pytest.mark.asyncio
async def test_patch_unauth_401(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    incidents = await seed_incidents_helper(db_session, seeded_project.id, count=1)
    # No login
    resp = await async_client.patch(f"/api/incidents/{incidents[0].id}/status", json={"status": "Resolved"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_patch_invalid_uuid_404(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    resp = await async_client.patch("/api/incidents/not-a-uuid/status", json={"status": "Resolved"}, cookies=cookies)
    # Our implementation maps invalid UUID to 404 (not 422) for enumeration safety per T-02-04-04 note
    assert resp.status_code in (404, 422), resp.text
    # Accept either but prefer 404 per existing PATCH logic
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_detail_includes_screenshot_base64(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    incidents = await seed_incidents_helper(db_session, seeded_project.id, count=1)
    target = incidents[0]
    original_bytes = base64.b64decode(valid_screenshot())

    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    resp = await async_client.get(f"/api/incidents/{target.id}", cookies=cookies)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id"] == str(target.id)
    assert "screenshot" in data
    assert data["screenshot"] is not None
    assert data["screenshot"].startswith("data:image/png;base64,")
    b64_part = data["screenshot"].split(",", 1)[1]
    decoded = base64.b64decode(b64_part)
    assert decoded == original_bytes, "re-encoded bytes must match original upload"


@pytest.mark.asyncio
async def test_detail_unauth_401(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    incidents = await seed_incidents_helper(db_session, seeded_project.id, count=1)
    resp = await async_client.get(f"/api/incidents/{incidents[0].id}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_detail_not_found_404(async_client, db_session):
    await seed_admin_helper(db_session)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)
    fake = str(uuid.uuid4())
    resp = await async_client.get(f"/api/incidents/{fake}", cookies=cookies)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_health_still_public(async_client, db_session, seeded_project):
    # Health must remain public without auth even after auth flows
    await seed_admin_helper(db_session)
    # ensure login happened but health doesn't require it
    await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    resp = await async_client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["db"] in ("connected", "disconnected")


@pytest.mark.asyncio
async def test_docs_gated(async_client):
    # DOCS_ENABLED defaults false => /docs 404, /openapi.json 404
    resp = await async_client.get("/docs")
    assert resp.status_code == 404
    resp2 = await async_client.get("/openapi.json")
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_e2e_flow(async_client, db_session, seeded_project):
    """E2E per plan: login -> POST ingest as public with key -> GET list with cookie -> PATCH status -> GET detail verify screenshot -> logout verify 401."""
    await seed_admin_helper(db_session)
    # 1. login
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    assert login.status_code == 200
    cookies = dict(login.cookies)
    assert "watchbug_access" in cookies

    # 2. POST ingest as public with key (no auth cookie needed, but we have it; still should succeed)
    payload = {
        "type": "Bug",
        "screenshot": valid_screenshot(),
        "metadata": valid_metadata(),
        "consoleLogs": [{"level": "log", "args": ["hello"], "timestamp": "2026-08-31T00:00:00Z"}],
        "errors": [],
    }
    headers = {"X-Watchbug-Key": "test-project-key-123"}
    # Use fresh client without auth to prove public ingest
    resp_post = await async_client.post("/api/incidents", json=payload, headers=headers)
    assert resp_post.status_code == 201, resp_post.text
    incident_id = resp_post.json()["id"]
    assert incident_id

    # 3. GET list with cookie should include new incident
    resp_list = await async_client.get("/api/incidents", cookies=cookies)
    assert resp_list.status_code == 200
    ids = [x["id"] for x in resp_list.json()["items"]]
    assert incident_id in ids

    # 4. PATCH status
    resp_patch = await async_client.patch(f"/api/incidents/{incident_id}/status", json={"status": "Resolved"}, cookies=cookies)
    assert resp_patch.status_code == 200
    assert resp_patch.json()["status"] == "Resolved"

    # 5. GET detail verify screenshot re-encoded matches original
    resp_detail = await async_client.get(f"/api/incidents/{incident_id}", cookies=cookies)
    assert resp_detail.status_code == 200
    detail = resp_detail.json()
    assert detail["status"] == "Resolved"
    assert detail["screenshot"].startswith("data:image/png;base64,")
    b64_part = detail["screenshot"].split(",", 1)[1]
    assert base64.b64decode(b64_part) == base64.b64decode(valid_screenshot())

    # 6. logout verify 401
    logout = await async_client.post("/api/auth/logout", cookies=cookies)
    assert logout.status_code == 200
    # GET list without cookie should now fail 401 (fresh client no cookie)
    resp_after = await async_client.get("/api/incidents")
    assert resp_after.status_code == 401
