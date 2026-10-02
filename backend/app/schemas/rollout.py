from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.utils import to_naive_utc
from app.schemas.common import ORMModel, UTCDateTime


class RolloutUpdate(BaseModel):
    """Only the fields you send are changed. Send a schedule field as null to clear it."""
    is_enabled: bool | None = None
    rollout_percentage: int | None = Field(None, ge=0, le=100)
    scheduled_enable_at: datetime | None = None
    scheduled_disable_at: datetime | None = None

    @field_validator("scheduled_enable_at", "scheduled_disable_at")
    @classmethod
    def normalise(cls, v: datetime | None) -> datetime | None:
        return to_naive_utc(v)


class RollbackRequest(BaseModel):
    """Choose ONE option (or none to undo the most recent change):
    - audit_log_id: restore the state that existed *before* that change
    - to_version:   restore the rollout to a specific historical version
    """
    audit_log_id: int | None = None
    to_version: int | None = Field(None, ge=1)


class RolloutOut(ORMModel):
    id: int
    flag_id: int
    flag_key: str
    environment_id: int
    environment_key: str
    environment_name: str
    environment_is_protected: bool
    is_enabled: bool
    rollout_percentage: int
    scheduled_enable_at: UTCDateTime | None = None
    scheduled_disable_at: UTCDateTime | None = None
    version: int
    updated_by_username: str | None = None
    updated_at: UTCDateTime
