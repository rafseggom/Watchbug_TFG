from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel):
    """Generic paginated envelope — D-09 {items, total, page, size, pages}."""

    items: list[dict] = Field(default_factory=list)
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    size: int = Field(ge=1, le=100)
    pages: int = Field(ge=0)

    model_config = ConfigDict(from_attributes=True)


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1, description="Page number, 1-indexed")
    size: int = Field(default=20, ge=1, le=100, description="Items per page, max 100")

    model_config = ConfigDict(from_attributes=True)
