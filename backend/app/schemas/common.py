from pydantic import BaseModel, Field


class PaginatedResponse(BaseModel):
    items: list[dict]
    total: int
    page: int
    size: int
    pages: int
