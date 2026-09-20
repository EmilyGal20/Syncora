from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "sqlite+aiosqlite:///./syncora.db"
    jwt_secret: str = Field(default="development-only-secret-change-me-32-chars")
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    cors_origins: str = "http://localhost:8600"
    audit_service_url: str = "http://localhost:8501"
    audit_service_key: str = "development-audit-key"
    dev_admin_email: str = "admin@syncora.dev"
    dev_admin_password: str = "ChangeMe123!"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
