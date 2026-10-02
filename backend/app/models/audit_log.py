from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.utils import utcnow


class AuditLog(Base):
    """Immutable change history. old_value/new_value hold JSON snapshots,
    which also power the rollback feature.

    flag_id / environment_id are intentionally NOT foreign keys so history
    survives deletion of the flag or environment.
    """
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    username: Mapped[str | None] = mapped_column(String(50))
    action: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer, index=True)
    flag_id: Mapped[int | None] = mapped_column(Integer, index=True)
    environment_id: Mapped[int | None] = mapped_column(Integer, index=True)
    old_value: Mapped[dict | None] = mapped_column(JSON)
    new_value: Mapped[dict | None] = mapped_column(JSON)
    description: Mapped[str | None] = mapped_column(String(500))
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True, nullable=False)
