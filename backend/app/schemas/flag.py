from pydantic import BaseModel, Field

from app.schemas.common import ORMModel, UTCDateTime
from app.schemas.rollout import RolloutOut

FLAG_KEY_PATTERN = r"^[a-z0-9][a-z0-9_.-]*$"


class FlagCreate(BaseModel):
    key: str = Field(..., min_length=2, max_length=100, pattern=FLAG_KEY_PATTERN,
                     description="Immutable identifier used by client apps, e.g. `new-checkout`")
    name: str = Field(..., min_length=2, max_length=150)
    description: str | None = None


class FlagUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=150)
    description: str | None = None


class FlagOut(ORMModel):
    id: int
    key: str
    name: str
    description: str | None = None
    is_archived: bool
    created_by_username: str | None = None
    created_at: UTCDateTime
    updated_at: UTCDateTime
    rollouts: list[RolloutOut] = []
