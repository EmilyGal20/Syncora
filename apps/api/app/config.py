from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "sqlite+aiosqlite:///./syncora.db"
    jwt_secret: str = Field(default="development-only-secret-change-me-32-chars")
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    cors_origins: str = "http://localhost:8600,http://127.0.0.1:8600"
    cors_origin_regex: str | None = (
        r"^https?://(localhost|127\.0\.0\.1|\[::1\]|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|[a-zA-Z0-9-]+(?:\.local)?):8600$"
    )
    audit_service_url: str = "http://localhost:8501"
    audit_service_key: str = "development-audit-key"
    dev_admin_email: str = "admin@syncora.dev"
    dev_admin_password: str = "ChangeMe123!"
    cookie_secure: bool | None = None
    storage_backend: str = "local"
    storage_local_root: str = "./storage"
    upload_max_bytes: int = 25 * 1024 * 1024
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
