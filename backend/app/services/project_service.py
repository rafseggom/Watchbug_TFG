import uuid

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project


async def resolve_project(request: Request, db: AsyncSession) -> Project:
    key = request.headers.get("x-watchbug-key") or request.headers.get("x-project-key")
    if not key:
        raise HTTPException(status_code=401, detail="invalid project key")
    result = await db.execute(select(Project).where(Project.api_key == key))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=401, detail="invalid project key")
    return project


async def seed_default_project(db: AsyncSession, api_key: str, name: str = "default") -> Project:
    result = await db.execute(select(Project).where(Project.api_key == api_key))
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    project = Project(name=name, api_key=api_key)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project
