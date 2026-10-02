from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.utils import utcnow


class UserAssignment(Base):
    """Explicit per-user override of a flag in an environment.

    `user_identifier` is the ID of an end-user of the *client* application
    (e.g. a customer id or email) — not a platform user.
    is_enabled=True  -> user is always included (beta testers, staff)
    is_enabled=False -> user is always excluded
    """
    __tablename__ = "user_assignments"
    __table_args__ = (
        UniqueConstraint("flag_id", "environment_id", "user_identifier", name="uq_assignment_flag_env_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    flag_id: Mapped[int] = mapped_column(ForeignKey("feature_flags.id", ondelete="CASCADE"), index=True, nullable=False)
    environment_id: Mapped[int] = mapped_column(
        ForeignKey("environments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_identifier: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    note: Mapped[str | None] = mapped_column(String(255))
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    flag: Mapped["FeatureFlag"] = relationship(back_populates="assignments")  # noqa: F821
    environment: Mapped["Environment"] = relationship(lazy="joined")  # noqa: F821
    created_by: Mapped["User | None"] = relationship(lazy="joined")  # noqa: F821

    @property
    def environment_key(self) -> str:
        return self.environment.key

    @property
    def created_by_username(self) -> str | None:
        return self.created_by.username if self.created_by else None
