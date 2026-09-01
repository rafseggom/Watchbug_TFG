import base64
import binascii
import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incident import Incident
from app.utils.sanitize import sanitize_payload


def decode_screenshot(b64: str) -> bytes:
    # Strip data: URL prefix if present
    if b64.startswith("data:") and "," in b64:
        b64 = b64.split(",", 1)[1]
    try:
        return base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(status_code=422, detail="invalid screenshot encoding") from e


def encode_screenshot(raw: bytes) -> str:
    """Re-encode BYTEA bytes to Base64 data URL for Panel img src (Pattern 13)."""
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:image/png;base64,{b64}"


def to_incident_out(incident) -> dict:
    """Map Incident ORM to list serialization without BYTEA (Pitfall 7).

    When screenshot is deferred via load_only, don't trigger lazy load — infer
    has_screenshot via inspection. All incidents have screenshot, so default True.
    """
    # Avoid lazy loading BYTEA when deferred (load_only excludes screenshot)
    try:
        from sqlalchemy import inspect

        state = inspect(incident)
        # If screenshot is deferred/unloaded, don't access it
        if "screenshot" in state.unloaded:
            has_screenshot = True  # all incidents have screenshot per ingest contract
        else:
            has_screenshot = bool(getattr(incident, "screenshot", None))
    except Exception:
        # Fallback without inspection
        has_screenshot = True

    return {
        "id": str(incident.id),
        "type": incident.type,
        "status": incident.status,
        "payload": incident.payload,
        "project_id": str(incident.project_id) if incident.project_id else None,
        "created_at": incident.created_at.isoformat() if incident.created_at else None,
        "updated_at": incident.updated_at.isoformat() if getattr(incident, "updated_at", None) else None,
        "has_screenshot": has_screenshot,
    }


def to_incident_detail(incident) -> dict:
    """Map to detail serialization with screenshot re-encoded (Pitfall 7 detail)."""
    data = to_incident_out(incident)
    # Replace has_screenshot with actual screenshot data URL
    screenshot_bytes = getattr(incident, "screenshot", None)
    if screenshot_bytes:
        data["screenshot"] = encode_screenshot(screenshot_bytes)
    else:
        data["screenshot"] = None
    # keep has_screenshot for compat, detail consumers use screenshot
    return data


async def update_incident_status(db: AsyncSession, incident_id: uuid.UUID, new_status: str):
    """Update incident status Any->Any per D-12, returns incident or None."""
    # Caller should have fetched; this is helper for service layer reuse
    incident = await db.get(Incident, incident_id)
    if not incident:
        return None
    allowed = {"Pending", "In Progress", "Resolved"}
    if new_status not in allowed:
        raise HTTPException(status_code=422, detail="invalid status")
    incident.status = new_status
    await db.commit()
    await db.refresh(incident)
    return incident


async def create_incident(db: AsyncSession, data, project_id: uuid.UUID) -> Incident:
    raw = data.model_dump()
    # Sanitize before storage — SEC-03 / D-15 double defense, primary gate is at ingest
    sanitized = sanitize_payload(raw)  # type: ignore

    screenshot_b64 = raw.get("screenshot", "")
    screenshot_bytes = decode_screenshot(screenshot_b64)

    # Remove screenshot from JSONB payload per spec (store separately as BYTEA)
    if isinstance(sanitized, dict):
        sanitized.pop("screenshot", None)

    incident = Incident(
        type=sanitized["type"] if isinstance(sanitized, dict) else raw["type"],
        status="Pending",
        payload=sanitized,  # type: ignore[arg-type]
        screenshot=screenshot_bytes,
        project_id=project_id,
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return incident
