import base64
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from slowapi.util import get_remote_address

from app.config import get_settings
from app.db import get_db
from app.dependencies import get_current_user
from app.limiter import limiter
from app.models.user import User
from app.schemas.incident import IncidentCreate, StatusUpdate
from app.services.incident_service import (
    create_incident,
    encode_screenshot,
    to_incident_detail,
    to_incident_out,
)
from app.services.project_service import resolve_project
from app.utils.pagination import paginate_and_filter

router = APIRouter(prefix="/api/incidents")


def _get_project_key(request: Request) -> str:
    """Composite key for per-project rate limit: IP + project key (T-02-03-04)."""
    key = request.headers.get("x-watchbug-key") or request.headers.get("x-project-key") or "unknown"
    return f"{get_remote_address(request)}:{key}"


@router.post("", status_code=201)
@limiter.limit("10/minute")
@limiter.limit("30/minute", key_func=_get_project_key)
async def post_incident(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    # SEC-01: explicit null origin rejection before any CORS handling (T-02-03-01)
    origin = request.headers.get("origin")
    if origin == "null":
        raise HTTPException(status_code=403, detail="origin not allowed")

    # CORS echo for open ingest — allow any customer domain (D-13). Admin allowlist is enforced by CORSMiddleware;
    # ingest must echo Origin when not in allowlist so browser accepts response (credentials omit, no Allow-Credentials).
    if origin and origin not in settings.cors_origins_list:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"

    # Project key check — 401 before size guard per D-08 distinct error split
    project = await resolve_project(request, db)

    # Payload size guard — 413 before validation per D-08 / SEC-04 / Pitfall 8.
    # Use actual len(await request.body()) not just Content-Length to handle chunked.
    body = await request.body()
    if len(body) > settings.MAX_PAYLOAD_BYTES:
        raise HTTPException(status_code=413, detail="payload too large")

    # Parse JSON and validate via Pydantic
    try:
        data_dict = json.loads(body) if body else {}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail="invalid json") from e

    # Validate via Pydantic (will raise 422 automatically if invalid via ValidationError handling)
    # We manually instantiate to get proper 422 response
    from fastapi.exceptions import RequestValidationError
    from pydantic import ValidationError

    try:
        data = IncidentCreate(**data_dict)
    except ValidationError as e:
        # Re-raise as RequestValidationError so FastAPI returns 422 with loc detail.
        # Prepend "body" to loc to match FastAPI automatic validation shape per D-06.
        errors = []
        for err in e.errors():
            loc = err.get("loc", ())
            # normalize loc to tuple
            if not isinstance(loc, tuple):
                loc = (loc,) if isinstance(loc, (str, int)) else tuple(loc)
            errors.append({**err, "loc": ("body",) + loc})
        raise RequestValidationError(errors=errors) from e

    incident = await create_incident(db, data, project.id)

    return {
        "id": str(incident.id),
        "status": incident.status,
        "created_at": incident.created_at.isoformat() if incident.created_at else None,
    }


@router.get("", status_code=200)
@limiter.limit("60/minute")
async def list_incidents(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1, description="Page number, 1-indexed"),
    size: int = Query(20, ge=1, le=100, description="Items per page, max 100"),
    type: str | None = Query(None, description="Bug or Feedback comma-separated, case-insensitive"),
    status: str | None = Query(None, description="Pending, In Progress, Resolved comma-separated"),
):
    """Paginated, filterable incident listing — D-09/D-10.

    Query params:
    - page: 1-indexed, default 1
    - size: 1..100, default 20, max 100 enforced by Query le=100 -> 422
    - type: Bug or Feedback comma-separated, case-insensitive normalized
    - status: Pending, In Progress, Resolved comma-separated

    Auth: Requires valid JWT cookie (AUTH-03) via Depends(get_current_user) before query.
    Filtering uses bound params via .in_() (T-02-04-01) and excludes BYTEA via load_only (T-02-04-03).
    """
    from app.utils.pagination import parse_status_filter, parse_type_filter

    # Validate filters explicitly to return 422 on invalid values per must_haves
    # parse_* raises ValueError which we map to 422
    try:
        parse_type_filter(type)
        parse_status_filter(status)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    try:
        items, total, pages = await paginate_and_filter(db, page, size, type, status)
    except ValueError as e:
        # Also catch from paginate_and_filter internal parsing
        raise HTTPException(status_code=422, detail=str(e)) from e

    serialized = [to_incident_out(it) for it in items]
    return {"items": serialized, "total": total, "page": page, "size": size, "pages": pages}


@router.get("/{incident_id}", status_code=200)
@limiter.limit("60/minute")
async def get_incident_detail(
    incident_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Detail endpoint returning full payload plus screenshot re-encoded as data URL.

    Auth required (AUTH-03). Returns 404 if not found, 404 if invalid UUID format per plan
    (FastAPI auto 422 for bad uuid via manual uuid.UUID parse mapped to 404 per existing behavior).
    """
    from sqlalchemy import select

    from app.models.incident import Incident

    try:
        iid = uuid.UUID(incident_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="incident not found")

    result = await db.execute(select(Incident).where(Incident.id == iid))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="incident not found")

    # Return detail with screenshot re-encoded
    return to_incident_detail(incident)


@router.patch("/{incident_id}/status", status_code=200)
@limiter.limit("60/minute")
async def update_status(
    incident_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import select

    from app.models.incident import Incident

    try:
        iid = uuid.UUID(incident_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="incident not found")
    result = await db.execute(select(Incident).where(Incident.id == iid))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="incident not found")

    # Parse body for status update — use StatusUpdate schema for validation
    try:
        body = await request.json()
    except Exception:
        body = {}
    raw_status = body.get("status") if isinstance(body, dict) else None

    # Validate via StatusUpdate Pydantic to get proper 422 loc shape
    from fastapi.exceptions import RequestValidationError
    from pydantic import ValidationError

    try:
        validated = StatusUpdate(status=raw_status)
    except ValidationError as e:
        errors = []
        for err in e.errors():
            loc = err.get("loc", ())
            if not isinstance(loc, tuple):
                loc = (loc,) if isinstance(loc, (str, int)) else tuple(loc)
            # Map to body loc per D-06 shape ["body","status"]
            errors.append({**err, "loc": ("body",) + loc})
        raise RequestValidationError(errors=errors) from e

    # Any->Any allowed among three states per D-12 — no state-machine check
    incident.status = validated.status
    await db.commit()
    await db.refresh(incident)
    return {"id": str(incident.id), "status": incident.status}
