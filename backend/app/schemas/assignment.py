from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel, UTCDateTime


class AssignmentCreate(BaseModel):
    environment_id: int
    user_identifier: str = Field(..., min_length=1, max_length=255)
    is_enabled: bool = True
    note: str | None = Field(None, max_length=255)

    @field_validator("user_identifier")
    @classmethod
    def strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("user_identifier cannot be blank")
        return v


class AssignmentBulkCreate(BaseModel):
    environment_id: int
    user_identifiers: list[str] = Field(..., min_length=1, max_length=1000)
    is_enabled: bool = True
    note: str | None = Field(None, max_length=255)


class AssignmentOut(ORMModel):
    id: int
    flag_id: int
    environment_id: int
    environment_key: str
    user_identifier: str
    is_enabled: bool
    note: str | None = None
    created_by_username: str | None = None
    created_at: UTCDateTime
