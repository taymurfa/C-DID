from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Float, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models_sql.base import Base


class Objective(Base):
    __tablename__ = "objectives"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))

    org_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    department_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)
    team_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_user_id: Mapped[str | None] = mapped_column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    level: Mapped[str] = mapped_column(String(30), nullable=False, default="strategic", index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    timeline: Mapped[str] = mapped_column(String(30), nullable=False, default="annual", index=True)
    fiscal_year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    quarter: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)

    division: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)

    parent_objective_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("objectives.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    next_review_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    latest_update_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)


Index("ix_objectives_org_level_fy", Objective.org_id, Objective.level, Objective.fiscal_year)


class KeyResult(Base):
    __tablename__ = "key_results"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    objective_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("objectives.id", ondelete="CASCADE"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    target: Mapped[str | None] = mapped_column(String(200), nullable=True)
    current_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
    unit: Mapped[str] = mapped_column(String(50), nullable=False, default="")

    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_score: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)

    owner_user_id: Mapped[str | None] = mapped_column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    last_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

