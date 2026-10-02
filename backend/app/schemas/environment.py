from pydantic import BaseModel, Field

from app.schemas.common import ORMModel, UTCDateTime

KEY_PATTERN = r"^[a-z0-9][a-z0-9_-]*$"


class EnvironmentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    key: str = Field(..., min_length=2, max_length=50, pattern=KEY_PATTERN)
    description: str | None = Field(None, max_length=255)
    is_protected: bool = False


class EnvironmentUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=50)
    description: str | None = Field(None, max_length=255)
    is_protected: bool | None = None


class EnvironmentOut(ORMModel):
    id: int
    name: str
    key: str
    description: str | None = None
    api_key: str | None = None
    is_protected: bool
    created_at: UTCDateTime
    updated_at: UTCDateTime
