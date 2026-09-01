from functools import lru_cache

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = Field(default="postgresql+asyncpg://watchbug:watchbug@localhost:5432/watchbug")
    JWT_SECRET: str = Field(default="dev-secret-must-be-at-least-32-chars-long-please-change")
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)
    ADMIN_EMAIL: str = Field(default="admin@watchbug.local")
    ADMIN_PASSWORD: str = Field(default="Admin123!", min_length=8)
    CORS_ORIGINS: str = Field(default="http://localhost:5173")
    DOCS_ENABLED: bool = Field(default=False)
    MAX_PAYLOAD_BYTES: int = Field(default=102400)
    DEFAULT_PROJECT_API_KEY: str = Field(default="wb_test_project_key_123")

    @computed_field  # type: ignore[misc]
    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
