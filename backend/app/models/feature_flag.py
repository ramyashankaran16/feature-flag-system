from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.utils import utcnow


class FeatureFlag(Base):
    """A feature toggle. Its per-environment state lives in FeatureRollout."""
    __tablename__ = "feature_flags"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    created_by: Mapped["User | None"] = relationship(lazy="joined")  # noqa: F821
    rollouts: Mapped[list["FeatureRollout"]] = relationship(  # noqa: F821
        back_populates="flag",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="FeatureRollout.environment_id",
    )
    assignments: Mapped[list["UserAssignment"]] = relationship(  # noqa: F821
        back_populates="flag", cascade="all, delete-orphan", passive_deletes=True
    )

    @property
    def created_by_username(self) -> str | None:
        return self.created_by.username if self.created_by else None
