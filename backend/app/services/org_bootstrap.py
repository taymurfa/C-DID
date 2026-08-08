"""Ensure every authenticated Postgres user has at least one org membership.

Without this, ``GET /api/orgs`` is empty for new accounts, so the UI cannot resolve
``orgId`` for departments or objectives (chicken-and-egg).
"""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models_sql import Membership, Organization, User


def ensure_default_org_membership_in_session(s: Session, user_id: str) -> None:
    """
    If the user has no active membership, create a default organization and add them as a member.
    Idempotent when called within a transaction that commits successfully.
    """
    cnt = s.execute(
        select(func.count())
        .select_from(Membership)
        .where(Membership.user_id == user_id)
        .where(Membership.active.is_(True))
    ).scalar_one()
    if int(cnt or 0) > 0:
        return

    u = s.get(User, user_id)
    if u is None:
        u = User(id=user_id)
        s.add(u)
        s.flush()

    configured = (os.getenv("APP_DEFAULT_ORG_NAME") or "").strip()
    if configured:
        org_name = configured[:200]
        slug_base = re.sub(r"[^a-z0-9]+", "-", configured.lower()).strip("-")[:40] or "org"
    else:
        label = (u.name or "").strip() or (u.email or "").split("@")[0].strip() or "My"
        org_name = f"{label}'s organization"[:200]
        slug_base = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")[:40] or "org"
    slug = f"{slug_base}-{uuid4().hex[:8]}"[:100]
    n = 0
    while s.execute(select(Organization.id).where(Organization.slug == slug)).scalar_one_or_none() is not None:
        n += 1
        suffix = f"-{n}"
        slug = f"{slug_base}-{uuid4().hex[:6]}{suffix}"[:100]

    org = Organization(
        id=str(uuid4()),
        name=org_name,
        slug=slug,
        created_at=datetime.now(timezone.utc),
    )
    s.add(org)
    s.flush()

    s.add(
        Membership(
            user_id=user_id,
            org_id=org.id,
            role="individual",
            active=True,
        )
    )


def ensure_user_default_org_id(user_id: str) -> str | None:
    """Return the user's first active org id, creating a default org if needed."""
    if not os.getenv("DATABASE_URL"):
        return None
    from app.db.postgres import pg_session

    with pg_session() as s:
        ensure_default_org_membership_in_session(s, user_id)
        return s.execute(
            select(Membership.org_id)
            .where(Membership.user_id == user_id)
            .where(Membership.active.is_(True))
            .order_by(Membership.created_at.asc())
            .limit(1)
        ).scalar_one_or_none()
