import uuid
from datetime import datetime

from sqlalchemy import String, LargeBinary, DateTime, ForeignKey, func, JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="Pending")
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    screenshot: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
