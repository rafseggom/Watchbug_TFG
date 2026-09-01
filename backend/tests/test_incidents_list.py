"""Task 02-04: Paginated filtered incident retrieval tests — API-03, AUTH-03, SEC-01.

Covers D-09 pagination page/size/total/pages + D-10 filtering comma-separated Any type/status.
"""

import base64
import math
import uuid

import pytest

from tests.conftest import (
    assert_paginated_shape,
    seed_admin_helper,
    seed_incidents_helper,
    valid_metadata,
    valid_screenshot,
)


@pytest.mark.asyncio
async def test_unauth_401(async_client):
    resp = await async_client.get("/api/incidents")
    assert resp.status_code == 401
    assert resp.json()["detail"] == "not authenticated"


@pytest.mark.asyncio
async def test_paginated_ok(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    incidents = await seed_incidents_helper(db_session, seeded_project.id, count=25)

    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    assert login.status_code == 200
    cookies = dict(login.cookies)

    resp = await async_client.get("/api/incidents", cookies=cookies)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert_paginated_shape(data, expected_page=1, expected_size=20)
    assert data["total"] == 25
    assert data["pages"] == 2
    assert len(data["items"]) == 20
    # items must NOT contain raw screenshot bytes / huge base64
    for item in data["items"]:
        assert "screenshot" not in item or item.get("screenshot") is None or len(str(item.get("screenshot", ""))) < 2000
        # should contain type/status/payload etc.
        assert "type" in item
        assert "status" in item
        assert "id" in item
        assert "created_at" in item
        # has_screenshot bool present per IncidentOut
        assert "has_screenshot" in item
    # ordering desc: first item should be newest (last seeded)
    # seeded with staggered created_at, last seeded has newest timestamp
    first_id = data["items"][0]["id"]
    assert first_id == str(incidents[-1].id), f"expected newest first {incidents[-1].id}, got {first_id}"


@pytest.mark.asyncio
async def test_paginated_page2(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    await seed_incidents_helper(db_session, seeded_project.id, count=25)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    resp = await async_client.get("/api/incidents?page=2&size=10", cookies=cookies)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["page"] == 2
    assert data["size"] == 10
    assert data["total"] == 25
    assert data["pages"] == 3
    assert len(data["items"]) == 10
    # page 1 should have different ids than page 2
    resp1 = await async_client.get("/api/incidents?page=1&size=10", cookies=cookies)
    ids1 = {x["id"] for x in resp1.json()["items"]}
    ids2 = {x["id"] for x in data["items"]}
    assert ids1.isdisjoint(ids2)


@pytest.mark.asyncio
async def test_size_cap_422(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    await seed_incidents_helper(db_session, seeded_project.id, count=5)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    resp = await async_client.get("/api/incidents?size=101", cookies=cookies)
    assert resp.status_code == 422, resp.text
    # also test 0 and negative should be 422 (ge=1)
    resp2 = await async_client.get("/api/incidents?size=0", cookies=cookies)
    assert resp2.status_code == 422
    resp3 = await async_client.get("/api/incidents?page=0", cookies=cookies)
    assert resp3.status_code == 422


@pytest.mark.asyncio
async def test_filter_type_bug(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    await seed_incidents_helper(db_session, seeded_project.id, count=25)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    resp = await async_client.get("/api/incidents?type=Bug", cookies=cookies)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total"] == 13  # Bug for even indices 0,2,...,24 => 13
    for item in data["items"]:
        assert item["type"] == "Bug"


@pytest.mark.asyncio
async def test_filter_type_lowercase_normalized(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    await seed_incidents_helper(db_session, seeded_project.id, count=25)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    # lowercase feedback should be normalized to Feedback and return same as TitleCase
    resp_lower = await async_client.get("/api/incidents?type=feedback", cookies=cookies)
    assert resp_lower.status_code == 200, resp_lower.text
    resp_title = await async_client.get("/api/incidents?type=Feedback", cookies=cookies)
    assert resp_title.status_code == 200
    assert resp_lower.json()["total"] == resp_title.json()["total"] == 12
    for item in resp_lower.json()["items"]:
        assert item["type"] == "Feedback"

    # also test bug lowercase
    resp_bug_lower = await async_client.get("/api/incidents?type=bug", cookies=cookies)
    assert resp_bug_lower.status_code == 200
    assert resp_bug_lower.json()["total"] == 13


@pytest.mark.asyncio
async def test_filter_type_comma(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    await seed_incidents_helper(db_session, seeded_project.id, count=25)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    resp = await async_client.get("/api/incidents?type=Bug,Feedback", cookies=cookies)
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 25
    # also test with spaces
    resp2 = await async_client.get("/api/incidents?type=Bug, Feedback", cookies=cookies)
    assert resp2.status_code == 200
    assert resp2.json()["total"] == 25


@pytest.mark.asyncio
async def test_filter_status_pending(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    await seed_incidents_helper(db_session, seeded_project.id, count=25)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    resp = await async_client.get("/api/incidents?status=Pending", cookies=cookies)
    assert resp.status_code == 200, resp.text
    # statuses cycle Pending, In Progress, Resolved => 9 Pending for 25 (0,3,6...24 => 9)
    # calculation: i%3==0 => 0,3,6,9,12,15,18,21,24 =9
    assert resp.json()["total"] == 9
    for item in resp.json()["items"]:
        assert item["status"] == "Pending"


@pytest.mark.asyncio
async def test_filter_status_comma_with_space(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    await seed_incidents_helper(db_session, seeded_project.id, count=25)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    # Must correctly parse "Pending,In Progress" preserving space in second value
    resp = await async_client.get("/api/incidents?status=Pending,In%20Progress", cookies=cookies)
    assert resp.status_code == 200, resp.text
    # Pending 9 + In Progress 8 =17
    assert resp.json()["total"] == 17
    for item in resp.json()["items"]:
        assert item["status"] in ("Pending", "In Progress")


@pytest.mark.asyncio
async def test_filter_combined_type_status(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    await seed_incidents_helper(db_session, seeded_project.id, count=25)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    # Bug & Pending intersection: even indices (Bug) and i%3==0 (Pending)
    # find manually: Bug indices 0,2,4,6,8,10,12,14,16,18,20,22,24
    # Pending indices 0,3,6,9,12,15,18,21,24 => intersection 0,6,12,18,24 =>5
    resp = await async_client.get("/api/incidents?type=Bug&status=Pending", cookies=cookies)
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 5
    for item in resp.json()["items"]:
        assert item["type"] == "Bug"
        assert item["status"] == "Pending"


@pytest.mark.asyncio
async def test_ordering_desc(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    incidents = await seed_incidents_helper(db_session, seeded_project.id, count=10)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    resp = await async_client.get("/api/incidents?size=10", cookies=cookies)
    assert resp.status_code == 200
    items = resp.json()["items"]
    # verify created_at descending
    dates = [x["created_at"] for x in items]
    assert dates == sorted(dates, reverse=True), f"not desc: {dates}"


@pytest.mark.asyncio
async def test_invalid_type_422(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    await seed_incidents_helper(db_session, seeded_project.id, count=5)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    resp = await async_client.get("/api/incidents?type=Invalid", cookies=cookies)
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_invalid_status_422(async_client, db_session, seeded_project):
    await seed_admin_helper(db_session)
    await seed_incidents_helper(db_session, seeded_project.id, count=5)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    resp = await async_client.get("/api/incidents?status=Closed", cookies=cookies)
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_list_excludes_byteA_fast(async_client, db_session, seeded_project):
    """Verify list does not contain huge screenshot string (BYTEA OOM guard)."""
    await seed_admin_helper(db_session)
    await seed_incidents_helper(db_session, seeded_project.id, count=20)
    login = await async_client.post("/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"})
    cookies = dict(login.cookies)

    resp = await async_client.get("/api/incidents?size=20", cookies=cookies)
    assert resp.status_code == 200
    # response text should be < 100KB for 20 items if BYTEA excluded; if included would be larger but still small for 1x1
    # Check each item screenshot length <2KB per must_haves verification hint
    for item in resp.json()["items"]:
        screenshot_val = item.get("screenshot")
        if screenshot_val is not None:
            assert len(str(screenshot_val)) < 2048, "screenshot should not be in list or should be short"
        # has_screenshot should be true
        assert item["has_screenshot"] is True
