from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.utils import utcnow


class FeatureRollout(Base):
    """State of one flag in one environment: on/off, % rollout and schedule."""
    __tablename__ = "feature_rollouts"
    __table_args__ = (
        UniqueConstraint("flag_id", "environment_id", name="uq_rollout_flag_env"),
        CheckConstraint("rollout_percentage >= 0 AND rollout_percentage <= 100", name="ck_rollout_percentage"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    flag_id: Mapped[int] = mapped_column(ForeignKey("feature_flags.id", ondelete="CASCADE"), index=True, nullable=False)
    environment_id: Mapped[int] = mapped_column(
        ForeignKey("environments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rollout_percentage: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    scheduled_enable_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    scheduled_disable_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    flag: Mapped["FeatureFlag"] = relationship(back_populates="rollouts")  # noqa: F821
    environment: Mapped["Environment"] = relationship(back_populates="rollouts", lazy="joined")  # noqa: F821
    updated_by: Mapped["User | None"] = relationship(lazy="joined")  # noqa: F821

    # Convenience properties used by the Pydantic response schemas
    @property
    def flag_key(self) -> str:
        return self.flag.key

    @property
    def environment_key(self) -> str:
        return self.environment.key

    @property
    def environment_name(self) -> str:
        return self.environment.name

    @property
    def environment_is_protected(self) -> bool:
        return self.environment.is_protected

    @property
    def updated_by_username(self) -> str | None:
        return self.updated_by.username if self.updated_by else None
