#!/usr/bin/env python3
"""
One-time migration: copy objectives and key_results from MongoDB into PostgreSQL.

Prerequisites:
  - MONGODB_URI and DATABASE_URL set (e.g. backend/.env)
  - Alembic migrations applied (objectives, key_results, organizations, ...)

Usage (from repo root or backend/):
  cd backend && python migrate_mongo_okrs_to_postgres.py

  MIGRATE_FORCE=1  — run even if Postgres already has objectives (may duplicate)

Creates a default organization and departments if needed, maps Mongo department ids to
Postgres UUIDs, upserts users, then copies objectives (preserving parent links) and key results.
"""
from __future__ import annotations

import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent
# Load backend/.env even if cwd is not backend/
load_dotenv(_BACKEND_DIR / ".env")


def _slug(s: str, max_len: int = 100) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (s or "org").lower()).strip("-")
    return (s[:max_len] or "org")[:max_len]


def _mongo_key(doc_id) -> str:
    return str(doc_id)


def _parse_quarter(q):
    if q is None:
        return None
    if isinstance(q, int):
        return q
    if isinstance(q, str):
        s = q.strip().upper()
        if s.startswith("Q") and len(s) >= 2:
            try:
                return int(s[1:])
            except ValueError:
                return None
    try:
        return int(q)
    except (TypeError, ValueError):
        return None


def _safe_database_url(url: str) -> str:
    try:
        p = urlparse(url)
        auth = ""
        if p.username:
            auth = f"{p.username}:***@"
        host = p.hostname or ""
        port = f":{p.port}" if p.port else ""
        path = p.path or ""
        return f"{p.scheme}://{auth}{host}{port}{path}"
    except Exception:
        return "(could not parse DATABASE_URL)"


def _print_migration_target_hint() -> None:
    url = os.getenv("DATABASE_URL", "")
    print(f"Postgres target: {_safe_database_url(url)}")
    if os.path.exists("/.dockerenv"):
        print("Environment: Docker backend container (same DATABASE_URL as compose; data goes to the stack Postgres).")
    else:
        host = (urlparse(url).hostname or "").lower()
        if host in ("localhost", "127.0.0.1", "::1"):
            print(
                "\nIMPORTANT: DATABASE_URL points at localhost. If your API runs in Docker, that is often a\n"
                "different Postgres than the one in docker-compose (volume `pgdata`). The UI reads whatever\n"
                "DATABASE_URL the backend container has (usually postgres:5432). Migrate inside Docker:\n"
                "  make migrate-mongo-okrs-docker\n",
                file=sys.stderr,
            )


def _parse_dt(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str):
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def main() -> int:
    if not os.getenv("DATABASE_URL"):
        print("DATABASE_URL is required", file=sys.stderr)
        return 1
    if not os.getenv("MONGODB_URI"):
        print("MONGODB_URI is required", file=sys.stderr)
        return 1

    _print_migration_target_hint()

    from app.db.mongodb import init_db, get_db
    from app.db.postgres import init_pg, pg_session
    from sqlalchemy import func, select
    from app.models_sql import (
        Department,
        KeyResult,
        Membership,
        Objective,
        Organization,
        User,
    )

    init_db()
    init_pg()
    db = get_db()

    force = os.getenv("MIGRATE_FORCE", "").strip() in ("1", "true", "yes")

    with pg_session() as s:
        existing_obj = s.execute(select(Objective.id).limit(1)).scalar_one_or_none()
        if existing_obj and not force:
            print("Postgres already has objectives. Set MIGRATE_FORCE=1 to migrate anyway (duplicates risk).")
            return 0

    # --- Default organization ---
    org_id = os.getenv("MIGRATE_ORG_ID")
    now = datetime.now(timezone.utc)
    with pg_session() as s:
        if org_id:
            org = s.get(Organization, org_id)
            if not org:
                print(f"MIGRATE_ORG_ID={org_id} not found in Postgres", file=sys.stderr)
                return 1
        else:
            row = s.execute(select(Organization).limit(1)).scalar_one_or_none()
            if row:
                org_id = row.id
            else:
                org_id = str(uuid4())
                slug = _slug("migrated")
                slug_base = slug
                n = 0
                while s.execute(select(Organization).where(Organization.slug == slug)).scalar_one_or_none():
                    n += 1
                    slug = f"{slug_base}-{n}"[:100]
                s.add(
                    Organization(
                        id=org_id,
                        name="Migrated organization",
                        slug=slug,
                        created_at=now,
                    )
                )
                s.flush()
        print(f"Using organization id={org_id}")

    # --- Departments: Mongo -> Postgres UUID map ---
    dept_map: dict[str, str] = {}
    for doc in db.departments.find({}):
        mid = _mongo_key(doc["_id"])
        name = doc.get("name") or mid
        with pg_session() as s:
            canon = _slug(name, 120)
            existing = s.execute(
                select(Department).where(
                    Department.org_id == org_id,
                    Department.canonical_name == canon,
                )
            ).scalar_one_or_none()
            if existing:
                dept_map[mid] = existing.id
            else:
                did = str(uuid4())
                s.add(
                    Department(
                        id=did,
                        org_id=org_id,
                        canonical_name=canon,
                        display_name=name[:200],
                        parent_department_id=None,
                        created_at=now,
                    )
                )
                s.flush()
                dept_map[mid] = did
    print(f"Mapped {len(dept_map)} departments")

    # --- Users from Mongo ---
    for doc in db.users.find({}):
        uid = str(doc["_id"])
        with pg_session() as s:
            u = s.get(User, uid)
            if not u:
                s.add(
                    User(
                        id=uid,
                        email=doc.get("email"),
                        name=doc.get("name"),
                        created_at=now,
                    )
                )
                s.flush()

    # --- Memberships: every mongo user -> org ---
    for doc in db.users.find({}):
        uid = str(doc["_id"])
        with pg_session() as s:
            if s.get(Membership, (uid, org_id)):
                continue
            dept_id = doc.get("departmentId")
            pg_dept = None
            if dept_id is not None:
                pg_dept = dept_map.get(_mongo_key(dept_id))
            s.add(
                Membership(
                    user_id=uid,
                    org_id=org_id,
                    department_id=pg_dept,
                    team_id=None,
                    role=str(doc.get("role") or "individual")[:50],
                    title=None,
                    active=True,
                    created_at=now,
                )
            )
            s.flush()

    # --- Objectives ---
    mongo_objectives = [dict(d) for d in db.objectives.find({})]
    id_map: dict[str, str] = {}
    processed = set()

    def insert_objective(doc: dict) -> None:
        oid_m = _mongo_key(doc["_id"])
        new_id = str(uuid4())
        id_map[oid_m] = new_id

        dept_id = doc.get("departmentId")
        pg_dept = None
        if dept_id is not None:
            pg_dept = dept_map.get(_mongo_key(dept_id))

        parent_m = doc.get("parentObjectiveId")
        parent_pg = None
        if parent_m is not None:
            pk = _mongo_key(parent_m)
            parent_pg = id_map.get(pk)

        owner_id = doc.get("ownerId")
        if owner_id:
            owner_id = str(owner_id)
            with pg_session() as s:
                if not s.get(User, owner_id):
                    s.add(User(id=owner_id, email=None, name=None, created_at=now))
                    s.flush()

        # Always tie migrated rows to the target org (Mongo orgId may not exist in Postgres)
        use_org = org_id
        div = doc.get("division")
        division = str(div)[:120] if div is not None and div != "" else None

        with pg_session() as s:
            s.add(
                Objective(
                    id=new_id,
                    org_id=use_org,
                    department_id=pg_dept,
                    team_id=None,
                    owner_user_id=owner_id,
                    title=(doc.get("title") or "Untitled")[:500],
                    description=doc.get("description") or "",
                    level=doc.get("level") or "strategic",
                    status=doc.get("status") or "draft",
                    timeline=doc.get("timeline") or "annual",
                    fiscal_year=int(doc.get("fiscalYear") or now.year),
                    quarter=_parse_quarter(doc.get("quarter")),
                    division=division,
                    parent_objective_id=parent_pg,
                    next_review_date=_parse_dt(doc.get("nextReviewDate")),
                    latest_update_summary=doc.get("latestUpdateSummary"),
                    created_at=_parse_dt(doc.get("createdAt")) or now,
                    updated_at=_parse_dt(doc.get("updatedAt")) or now,
                )
            )
            s.flush()

    while len(processed) < len(mongo_objectives):
        ready = [
            d
            for d in mongo_objectives
            if id(d) not in processed
            and (
                not d.get("parentObjectiveId")
                or _mongo_key(d["parentObjectiveId"]) in id_map
            )
        ]
        if not ready:
            for d in mongo_objectives:
                if id(d) not in processed and d.get("parentObjectiveId"):
                    d.pop("parentObjectiveId", None)
            ready = [d for d in mongo_objectives if id(d) not in processed]
        for d in ready:
            insert_objective(d)
            processed.add(id(d))
        if not ready:
            break

    print(f"Migrated {len(id_map)} objectives")

    # --- Key results ---
    kr_count = 0
    for kr in db.key_results.find({}):
        oid_m = _mongo_key(kr.get("objectiveId"))
        new_oid = id_map.get(oid_m)
        if not new_oid:
            continue
        kid = str(uuid4())
        owner_id = kr.get("ownerId")
        if owner_id:
            owner_id = str(owner_id)
            with pg_session() as s:
                if not s.get(User, owner_id):
                    s.add(User(id=owner_id, email=None, name=None, created_at=now))
                    s.flush()
        ts = kr.get("targetScore")
        try:
            tsf = float(ts) if ts is not None else 1.0
        except (TypeError, ValueError):
            tsf = 1.0
        with pg_session() as s:
            s.add(
                KeyResult(
                    id=kid,
                    objective_id=new_oid,
                    title=(kr.get("title") or "Key result")[:500],
                    target=kr.get("target") and str(kr.get("target"))[:200],
                    current_value=kr.get("currentValue") and str(kr.get("currentValue"))[:200],
                    unit=(kr.get("unit") or "")[:50],
                    score=float(kr["score"]) if kr.get("score") is not None else None,
                    target_score=tsf,
                    owner_user_id=owner_id,
                    created_at=_parse_dt(kr.get("createdAt")) or now,
                    last_updated_at=_parse_dt(kr.get("lastUpdatedAt")) or now,
                )
            )
            s.flush()
        kr_count += 1

    print(f"Migrated {kr_count} key results")
    with pg_session() as s:
        n_obj = s.execute(select(func.count()).select_from(Objective)).scalar() or 0
        n_kr = s.execute(select(func.count()).select_from(KeyResult)).scalar() or 0
    print(f"Verified in this Postgres: {n_obj} objectives, {n_kr} key results.")
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
