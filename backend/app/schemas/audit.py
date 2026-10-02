from typing import Any

from app.schemas.common import ORMModel, UTCDateTime


class AuditLogOut(ORMModel):
    id: int
    user_id: int | None = None
    username: str | None = None
    action: str
    entity_type: str
    entity_id: int | None = None
    flag_id: int | None = None
    environment_id: int | None = None
    old_value: dict[str, Any] | None = None
    new_value: dict[str, Any] | None = None
    description: str | None = None
    ip_address: str | None = None
    created_at: UTCDateTime
