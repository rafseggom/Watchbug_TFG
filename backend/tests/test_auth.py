import datetime
import jwt
import pytest

from app.config import get_settings


@pytest.mark.asyncio
async def test_password_is_hashed(db_session):
    from app.services.auth_service import hash_password, verify_password

    plain = "SuperSecret123!"
    hashed = hash_password(plain)
    assert hashed != plain
    assert len(hashed) == 60
    assert hashed.startswith("$2b$12$")
    assert verify_password(plain, hashed) is True
    assert verify_password("wrong", hashed) is False
    # distinct per call due to salt
    hashed2 = hash_password(plain)
    assert hashed != hashed2


@pytest.mark.asyncio
async def test_login_sets_cookies(async_client, db_session):
    from tests.conftest import seed_admin_helper

    await seed_admin_helper(db_session, "admin@watchbug.local", "Admin123!")
    resp = await async_client.post(
        "/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"}
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "logged in"
    # check Set-Cookie headers contain HttpOnly and SameSite and namespaced cookies
    set_cookies = resp.headers.get_list("set-cookie")
    joined = " ".join(set_cookies)
    assert "watchbug_access" in joined
    assert "watchbug_refresh" in joined
    assert "HttpOnly" in joined
    assert "SameSite" in joined or "samesite" in joined.lower()
    # check Max-Age values
    # access should be 3600, refresh 604800
    assert "Max-Age=3600" in joined
    assert "Max-Age=604800" in joined
    # Path checks
    assert "Path=/" in joined
    assert "Path=/api/auth" in joined
    # Secure should be absent in development (default ENV development)
    # At least not require Secure; production toggles it
    # Verify cookie jar contains both
    assert "watchbug_access" in resp.cookies
    assert "watchbug_refresh" in resp.cookies


@pytest.mark.asyncio
async def test_login_invalid_401(async_client, db_session):
    from tests.conftest import seed_admin_helper

    await seed_admin_helper(db_session)
    resp = await async_client.post(
        "/api/auth/login", json={"email": "admin@watchbug.local", "password": "wrongpass"}
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "invalid credentials"


@pytest.mark.asyncio
async def test_protected_401(async_client):
    resp = await async_client.get("/api/incidents")
    assert resp.status_code == 401
    assert resp.json()["detail"] == "not authenticated"


@pytest.mark.asyncio
async def test_protected_with_cookie_ok(async_client, db_session):
    from tests.conftest import seed_admin_helper

    await seed_admin_helper(db_session)
    login_resp = await async_client.post(
        "/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"}
    )
    assert login_resp.status_code == 200
    cookies = login_resp.cookies
    resp = await async_client.get("/api/incidents", cookies=cookies)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "size" in data
    assert "pages" in data


@pytest.mark.asyncio
async def test_logout_clears(async_client, db_session):
    from tests.conftest import seed_admin_helper

    await seed_admin_helper(db_session)
    login_resp = await async_client.post(
        "/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"}
    )
    cookies = login_resp.cookies
    # protected should succeed before logout
    r = await async_client.get("/api/incidents", cookies=cookies)
    assert r.status_code == 200
    # logout
    logout_resp = await async_client.post("/api/auth/logout", cookies=cookies)
    assert logout_resp.status_code == 200
    assert logout_resp.json()["message"] == "logged out"
    sc = " ".join(logout_resp.headers.get_list("set-cookie"))
    assert "Max-Age=0" in sc
    assert "watchbug_access" in sc
    assert "watchbug_refresh" in sc
    # subsequent GET without cookie should fail 401
    r2 = await async_client.get("/api/incidents")
    assert r2.status_code == 401


@pytest.mark.asyncio
async def test_refresh_flow(async_client, db_session):
    from tests.conftest import seed_admin_helper

    await seed_admin_helper(db_session)
    login_resp = await async_client.post(
        "/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"}
    )
    cookies = login_resp.cookies
    assert "watchbug_refresh" in cookies
    # refresh should reissue access cookie
    refresh_resp = await async_client.post("/api/auth/refresh", cookies=cookies)
    assert refresh_resp.status_code == 200
    assert refresh_resp.json()["message"] == "refreshed"
    sc = " ".join(refresh_resp.headers.get_list("set-cookie"))
    assert "watchbug_access" in sc
    assert "Max-Age=3600" in sc
    # new access cookie should allow protected access
    new_cookies = refresh_resp.cookies
    # httpx merges cookies automatically but we need to combine
    merged = {**dict(cookies), **dict(new_cookies)}
    r = await async_client.get("/api/incidents", cookies=merged)
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_token_expired(async_client, db_session):
    from tests.conftest import seed_admin_helper

    await seed_admin_helper(db_session)
    # login to ensure user exists
    login_resp = await async_client.post(
        "/api/auth/login", json={"email": "admin@watchbug.local", "password": "Admin123!"}
    )
    assert login_resp.status_code == 200
    settings = get_settings()
    # craft expired token manually
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": "00000000-0000-0000-0000-000000000001",
        "jti": "test-jti",
        "exp": now - datetime.timedelta(hours=2),
        "iat": now - datetime.timedelta(hours=3),
    }
    expired = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
    resp = await async_client.get("/api/incidents", cookies={"watchbug_access": expired})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "token expired"


@pytest.mark.asyncio
async def test_refresh_invalid_token(async_client):
    resp = await async_client.post("/api/auth/refresh", cookies={"watchbug_refresh": "invalid.token.here"})
    assert resp.status_code == 401
    assert resp.json()["detail"] in ("invalid token", "not authenticated")


@pytest.mark.asyncio
async def test_seed_admin_rotation(db_session):
    from app.services.auth_service import seed_admin, verify_password
    from sqlalchemy import select
    from app.models.user import User

    # initial seed
    await seed_admin(db_session, "admin@watchbug.local", "FirstPass123!")
    result = await db_session.execute(select(User).where(User.email == "admin@watchbug.local"))
    user = result.scalar_one()
    assert verify_password("FirstPass123!", user.password_hash)
    # rotate
    await seed_admin(db_session, "admin@watchbug.local", "SecondPass123!")
    await db_session.refresh(user)
    result2 = await db_session.execute(select(User).where(User.email == "admin@watchbug.local"))
    user2 = result2.scalar_one()
    assert verify_password("SecondPass123!", user2.password_hash)
    assert not verify_password("FirstPass123!", user2.password_hash)
