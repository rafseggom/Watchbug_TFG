from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ConsoleEntry(BaseModel):
    level: Literal["log", "warn", "error", "info"]
    args: list[str]
    timestamp: str


class IncidentCreate(BaseModel):
    type: str = Field(description="Bug or Feedback, case-insensitive")
    screenshot: str = Field(min_length=1, description="Base64 PNG, data URL prefix optional")
    metadata: dict
    consoleLogs: list[ConsoleEntry] | None = None
    errors: list[str] = Field(default_factory=list)
    notes: str | None = None

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v: object) -> object:
        if isinstance(v, str) and v.lower() in ("bug", "feedback"):
            mapping = {"bug": "Bug", "feedback": "Feedback", "Bug": "Bug", "Feedback": "Feedback"}
            # handle lowercase and title case
            if v in mapping:
                return mapping[v]
            return mapping[v.lower()]
        return v

    @field_validator("type", mode="after")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ("Bug", "Feedback"):
            raise ValueError("type must be Bug or Feedback")
        return v

    @field_validator("consoleLogs", mode="after")
    @classmethod
    def check_console_logs_for_bug(cls, v: list[ConsoleEntry] | None, info) -> list[ConsoleEntry] | None:
        typ = info.data.get("type")
        if typ == "Bug" and (v is None or len(v) == 0):
            raise ValueError("consoleLogs is required for type=Bug")
        return v

    @field_validator("metadata", mode="after")
    @classmethod
    def check_metadata(cls, v: dict) -> dict:
        if not isinstance(v, dict) or len(v) == 0:
            raise ValueError("metadata is required")
        for key in ("url", "userAgent", "timestamp"):
            val = v.get(key)
            if not isinstance(val, str) or not val.strip():
                raise ValueError(f"metadata.{key} is required")
        return v


class IncidentOut(BaseModel):
    id: str
    status: str
    created_at: str
