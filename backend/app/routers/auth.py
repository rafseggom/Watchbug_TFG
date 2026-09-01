import jwt
from fastapi import APIRouter, Depends, Request, Response, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest
from app.services.auth_service import create_access_token, create_refresh_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _is_secure() -> bool:
    settings = get_settings()
    return settings.ENV == "production"


@router.post("/login", status_code=200)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")

    settings = get_settings()
    access = create_access_token(str(user.id), settings.JWT_SECRET)
    refresh = create_refresh_token(str(user.id), settings.JWT_SECRET)

    secure = _is_secure()
    response.set_cookie(
        key="watchbug_access",
        value=access,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=3600,
        path="/",
    )
    response.set_cookie(
        key="watchbug_refresh",
        value=refresh,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=604800,
        path="/api/auth",
    )
    return {"message": "logged in"}


@router.post("/refresh", status_code=200)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    token = request.cookies.get("watchbug_refresh")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")

    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")

    import uuid

    try:
        user_id = uuid.UUID(sub)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")

    new_access = create_access_token(str(user.id), settings.JWT_SECRET)
    secure = _is_secure()
    response.set_cookie(
        key="watchbug_access",
        value=new_access,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=3600,
        path="/",
    )
    return {"message": "refreshed"}


@router.post("/logout", status_code=200)
async def logout(response: Response):
    secure = _is_secure()
    response.set_cookie(
        key="watchbug_access",
        value="",
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=0,
        path="/",
    )
    response.set_cookie(
        key="watchbug_refresh",
        value="",
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=0,
        path="/api/auth",
    )
    return {"message": "logged out"}
