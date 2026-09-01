import json

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.incident import IncidentCreate
from app.services.incident_service import create_incident
from app.services.project_service import resolve_project

router = APIRouter(prefix="/api/incidents")


@router.post("", status_code=201)
async def post_incident(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    # CORS echo for open ingest
    origin = request.headers.get("origin")
    if origin and origin not in settings.cors_origins_list:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    if origin == "null":
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="origin not allowed")

    # Project key check
    project = await resolve_project(request, db)

    # Payload size guard (read raw body)
    body = await request.body()
    if len(body) > settings.MAX_PAYLOAD_BYTES:
        from fastapi import HTTPException

        raise HTTPException(status_code=413, detail="payload too large")

    # Parse JSON and validate via Pydantic
    try:
        data_dict = json.loads(body) if body else {}
    except json.JSONDecodeError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail="invalid json") from e

    # Validate via Pydantic (will raise 422 automatically if invalid via ValidationError handling)
    # We manually instantiate to get proper 422 response
    from fastapi.exceptions import RequestValidationError
    from pydantic import ValidationError

    try:
        data = IncidentCreate(**data_dict)
    except ValidationError as e:
        # Re-raise as RequestValidationError so FastAPI returns 422 with loc detail
        raise RequestValidationError(errors=e.errors()) from e

    incident = await create_incident(db, data, project.id)

    return {
        "id": str(incident.id),
        "status": incident.status,
        "created_at": incident.created_at.isoformat() if incident.created_at else None,
    }


@router.get("", status_code=200)
async def list_incidents(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Minimal paginated response for 02-02 auth gating; full filtering in 02-03
    from sqlalchemy import func, select

    from app.models.incident import Incident

    # Parse pagination params with defaults
    try:
        page = int(request.query_params.get("page", "1"))
        size = int(request.query_params.get("size", "20"))
    except ValueError:
        page, size = 1, 20
    page = max(1, page)
    size = min(100, max(1, size))

    total_result = await db.execute(select(func.count()).select_from(Incident))
    total = total_result.scalar_one()
    pages = (total + size - 1) // size if total else 0
    result = await db.execute(
        select(Incident).order_by(Incident.created_at.desc()).offset((page - 1) * size).limit(size)
    )
    items = result.scalars().all()
    # Serialize minimal
    serialized = [
        {
            "id": str(it.id),
            "type": it.type,
            "status": it.status,
            "created_at": it.created_at.isoformat() if it.created_at else None,
        }
        for it in items
    ]
    return {"items": serialized, "total": total, "page": page, "size": size, "pages": pages}


@router.patch("/{incident_id}/status", status_code=200)
async def update_status(
    incident_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import uuid

    from sqlalchemy import select

    from app.models.incident import Incident

    try:
        iid = uuid.UUID(incident_id)
    except ValueError:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="incident not found")
    result = await db.execute(select(Incident).where(Incident.id == iid))
    incident = result.scalar_one_or_none()
    if not incident:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="incident not found")

    # Parse body for status update
    try:
        body = await request.json()
    except Exception:
        body = {}
    new_status = body.get("status")
    allowed = {"Pending", "In Progress", "Resolved"}
    if new_status not in allowed:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail="invalid status")
    incident.status = new_status
    await db.commit()
    await db.refresh(incident)
    return {"id": str(incident.id), "status": incident.status}
