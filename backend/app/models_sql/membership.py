from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models_sql.base import Base


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "org_id", name="uq_membership_user_org"),
    )

    user_id: Mapped[str] = mapped_column(String(255), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    org_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)

    department_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)
    team_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True)

    role: Mapped[str] = mapped_column(String(50), nullable=False, default="individual", index=True)
    title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

