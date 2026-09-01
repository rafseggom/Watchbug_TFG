import json

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas.incident import IncidentCreate
from app.services.incident_service import create_incident
from app.services.project_service import resolve_project
from app.config import get_settings

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
async def list_incidents_placeholder(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException

    raise HTTPException(status_code=401, detail="not authenticated")


@router.patch("/{incident_id}/status", status_code=200)
async def update_status_placeholder(
    incident_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException

    raise HTTPException(status_code=401, detail="not authenticated")
