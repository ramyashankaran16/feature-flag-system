"""Application settings loaded from environment variables / .env file."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # General
    APP_NAME: str = "Feature Flag & Environment Management System"
    APP_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "mysql+pymysql://ffuser:ffpassword@localhost:3306/feature_flags?charset=utf8mb4"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL_SECONDS: int = 60
    ANALYTICS_RETENTION_DAYS: int = 90

    # JWT
    JWT_SECRET_KEY: str = "change-this-secret-key-in-production-please"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Login protection
    LOGIN_MAX_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15

    # CORS (JSON list in env, e.g. CORS_ORIGINS=["http://localhost:5173"])
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Scheduler
    SCHEDULER_ENABLED: bool = True
    SCHEDULER_INTERVAL_SECONDS: int = 30

    # Seeding
    FIRST_ADMIN_USERNAME: str = "admin"
    FIRST_ADMIN_EMAIL: str = "admin@example.com"
    FIRST_ADMIN_PASSWORD: str = "Admin@123"
    SEED_DEMO_DATA: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
