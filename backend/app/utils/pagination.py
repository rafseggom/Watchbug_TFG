"""Pagination and filtering helpers — D-09/D-10 + Pitfall 7 BYTEA OOM.

Implements paginated filtered retrieval with:
- page/size math ceil(total/size)
- type/status comma-separated filtering with bound params (T-02-04-01)
- BYTEA exclusion via load_only for list queries
"""

from math import ceil

from sqlalchemy import func, select
from sqlalchemy.orm import load_only

from app.models.incident import Incident


ALLOWED_TYPES = {"Bug", "Feedback"}
TYPE_NORMALIZE = {"bug": "Bug", "feedback": "Feedback"}
ALLOWED_STATUSES = {"Pending", "In Progress", "Resolved"}


def parse_type_filter(raw: str | None) -> list[str] | None:
    """Parse comma-separated type filter, case-insensitive normalize.

    Returns normalized TitleCase list or raises ValueError for invalid values.
    Empty/None returns None (no filter).
    """
    if raw is None or raw.strip() == "":
        return None
    parts = [p.strip() for p in raw.split(",") if p.strip() != ""]
    if not parts:
        return None
    normalized: list[str] = []
    for p in parts:
        low = p.lower()
        if low in TYPE_NORMALIZE:
            normalized.append(TYPE_NORMALIZE[low])
        else:
            # Check if already TitleCase valid
            if p in ALLOWED_TYPES:
                normalized.append(p)
            else:
                raise ValueError(f"invalid type filter value: {p!r} — allowed: Bug, Feedback")
    # Validate all normalized are allowed
    for v in normalized:
        if v not in ALLOWED_TYPES:
            raise ValueError(f"invalid type filter value: {v!r}")
    # Dedup preserve order
    seen = set()
    deduped = []
    for v in normalized:
        if v not in seen:
            seen.add(v)
            deduped.append(v)
    return deduped


def parse_status_filter(raw: str | None) -> list[str] | None:
    """Parse comma-separated status filter preserving 'In Progress' space.

    Valid values: Pending, In Progress, Resolved (case-sensitive per spec).
    But we also handle normalized trimming. Invalid raises ValueError.
    """
    if raw is None or raw.strip() == "":
        return None
    # Split by comma, preserve inner space for "In Progress"
    parts = [p.strip() for p in raw.split(",") if p.strip() != ""]
    if not parts:
        return None
    for p in parts:
        if p not in ALLOWED_STATUSES:
            raise ValueError(f"invalid status filter value: {p!r} — allowed: Pending, In Progress, Resolved")
    # Dedup preserve order
    seen = set()
    deduped = []
    for p in parts:
        if p not in seen:
            seen.add(p)
            deduped.append(p)
    return deduped


async def paginate_and_filter(
    db,
    page: int,
    size: int,
    type_filter: str | None = None,
    status_filter: str | None = None,
):
    """Execute count + paginated query with BYTEA exclusion.

    Returns (items, total, pages). Uses bound params via .in_().
    Excludes screenshot LargeBinary via load_only to prevent OOM (T-02-04-03).
    """
    filters = []
    types = parse_type_filter(type_filter)
    if types:
        filters.append(Incident.type.in_(types))
    statuses = parse_status_filter(status_filter)
    if statuses:
        filters.append(Incident.status.in_(statuses))

    # Count query
    count_q = select(func.count()).select_from(Incident).where(*filters) if filters else select(func.count()).select_from(Incident)
    total = (await db.execute(count_q)).scalar_one()
    pages = ceil(total / size) if total else 0

    # Items query — exclude screenshot BYTEA via load_only
    # list endpoint only needs id, type, status, payload, project_id, created_at, updated_at
    items_q = (
        select(Incident)
        .where(*filters)
        .order_by(Incident.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .options(
            load_only(
                Incident.id,
                Incident.type,
                Incident.status,
                Incident.payload,
                Incident.project_id,
                Incident.created_at,
                Incident.updated_at,
            )
        )
    )
    if not filters:
        items_q = (
            select(Incident)
            .order_by(Incident.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
            .options(
                load_only(
                    Incident.id,
                    Incident.type,
                    Incident.status,
                    Incident.payload,
                    Incident.project_id,
                    Incident.created_at,
                    Incident.updated_at,
                )
            )
        )
    result = await db.execute(items_q)
    items = result.scalars().all()
    return items, total, pages
