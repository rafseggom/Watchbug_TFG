import base64
import binascii
import html
import re
import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incident import Incident

_EVENT_HANDLER_RE = re.compile(r"\bon\w+\s*=", re.IGNORECASE)
_JAVASCRIPT_RE = re.compile(r"javascript\s*:", re.IGNORECASE)


def sanitize_string(value: str) -> str:
    escaped = html.escape(value, quote=True)
    escaped = _EVENT_HANDLER_RE.sub("", escaped)
    escaped = _JAVASCRIPT_RE.sub("", escaped)
    return escaped


def sanitize_payload(payload: dict | list | str | object) -> object:
    if isinstance(payload, dict):
        return {k: sanitize_payload(v) for k, v in payload.items()}
    if isinstance(payload, list):
        return [sanitize_payload(v) for v in payload]
    if isinstance(payload, str):
        return sanitize_string(payload)
    return payload


def decode_screenshot(b64: str) -> bytes:
    # Strip data: URL prefix if present
    if b64.startswith("data:") and "," in b64:
        b64 = b64.split(",", 1)[1]
    try:
        return base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(status_code=422, detail="invalid screenshot encoding") from e


async def create_incident(db: AsyncSession, data, project_id: uuid.UUID) -> Incident:
    raw = data.model_dump()
    # Sanitize before storage
    try:
        from app.utils.sanitize import sanitize_payload as ext_sanitize  # type: ignore

        sanitized = ext_sanitize(raw)  # type: ignore
    except ImportError:
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
