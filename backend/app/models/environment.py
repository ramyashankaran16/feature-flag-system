from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.utils import utcnow


class Environment(Base):
    """Deployment environment (development / testing / production ...).

    Each environment owns an API key that client applications send in the
    `X-Environment-Key` header when evaluating flags.
    """
    __tablename__ = "environments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    key: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    api_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    is_protected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    rollouts: Mapped[list["FeatureRollout"]] = relationship(  # noqa: F821
        back_populates="environment", cascade="all, delete-orphan", passive_deletes=True
    )
