from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import false, select

from app.db.postgres import pg_session
from app.legacy_department_ids import LEGACY_MONGO_ID_TO_DISPLAY_NAME
from app.models_sql import Department, KeyResult, Objective

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)


def resolve_department_id_for_filter(session, raw: str) -> str | None:
    """
    Map API departmentId to Postgres UUID. Accepts UUID strings, canonical_name, or legacy
    Mongo department ids (e.g. d1) via Mongo lookup + display_name match.
    """
    if not raw:
        return None
    rs = str(raw).strip()
    if _UUID_RE.match(rs):
        return rs
    row = session.execute(select(Department.id).where(Department.canonical_name == rs)).scalar_one_or_none()
    if row:
        return row
    legacy_name = LEGACY_MONGO_ID_TO_DISPLAY_NAME.get(rs)
    if legacy_name:
        rid = session.execute(
            select(Department.id).where(Department.display_name == legacy_name[:200])
        ).scalars().first()
        if rid:
            return rid
    try:
        from app.db.mongodb import get_db

        db = get_db()
        doc = db.departments.find_one({"_id": rs})
        if doc is None:
            from bson import ObjectId
            from bson.errors import InvalidId

            try:
                doc = db.departments.find_one({"_id": ObjectId(rs)})
            except (InvalidId, TypeError):
                doc = None
        if doc:
            name = (doc.get("name") or "").strip()
            if name:
                rid = session.execute(
                    select(Department.id).where(Department.display_name == name[:200])
                ).scalars().first()
                if rid:
                    return rid
    except Exception:
        pass
    return None


def _utcnow():
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None):
    if not dt:
        return None
    return dt.astimezone(timezone.utc).isoformat()


def _normalize_quarter(q: Any) -> int | None:
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


class PostgresOKRRepository:
    """
    Postgres-backed OKR repository.

    Note: we keep a response shape close to existing Mongo endpoints (e.g. `_id` string).
    """

    def list_departments(self, user_id: str) -> list[dict[str, Any]]:
        with pg_session() as s:
            rows = s.execute(select(Department)).scalars().all()
            return [{"_id": d.id, "name": d.display_name} for d in rows]

    def list_objectives(self, user_id: str, filters: dict[str, Any]) -> list[dict[str, Any]]:
        with pg_session() as s:
            stmt = select(Objective)
            for k, v in (filters or {}).items():
                # For migration parity, support only a subset used by frontend.
                if k == "fiscalYear":
                    stmt = stmt.where(Objective.fiscal_year == int(v))
                elif k == "level":
                    stmt = stmt.where(Objective.level == v)
                elif k == "division":
                    stmt = stmt.where(Objective.division == v)
                elif k == "status":
                    stmt = stmt.where(Objective.status == v)
                elif k == "ownerId":
                    stmt = stmt.where(Objective.owner_user_id == v)
                elif k == "departmentId":
                    resolved = resolve_department_id_for_filter(s, str(v))
                    if resolved:
                        stmt = stmt.where(Objective.department_id == resolved)
                    else:
                        stmt = stmt.where(false())
                elif k == "parentObjectiveId":
                    stmt = stmt.where(Objective.parent_objective_id == v)
                elif k == "__no_parent__":
                    stmt = stmt.where(Objective.parent_objective_id.is_(None))
            stmt = stmt.order_by(Objective.created_at.desc())
            rows = s.execute(stmt).scalars().all()
            return [self._serialize_objective(o) for o in rows]

    def get_objective(self, user_id: str, objective_id: str) -> dict[str, Any] | None:
        with pg_session() as s:
            obj = s.get(Objective, objective_id)
            return self._serialize_objective(obj) if obj else None

    def create_objective(self, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
        # org_id is required in Postgres mode
        org_id = data.get("orgId") or data.get("org_id")
        if not org_id:
            raise ValueError("orgId is required for Postgres-backed objectives")
        now = _utcnow()
        with pg_session() as s:
            obj = Objective(
                id=str(uuid4()),
                org_id=org_id,
                department_id=data.get("departmentId"),
                team_id=data.get("teamId"),
                owner_user_id=data.get("ownerId") or user_id,
                title=data["title"],
                description=data.get("description") or "",
                level=data.get("level") or "strategic",
                status=data.get("status") or "draft",
                timeline=data.get("timeline") or "annual",
                fiscal_year=int(data["fiscalYear"]),
                quarter=_normalize_quarter(data.get("quarter")),
                division=data.get("division"),
                parent_objective_id=data.get("parentObjectiveId") or None,
                next_review_date=data.get("nextReviewDate"),
                latest_update_summary=data.get("latestUpdateSummary"),
                created_at=now,
                updated_at=now,
            )
            s.add(obj)
            s.flush()
            return self._serialize_objective(obj)

    def update_objective(self, user_id: str, objective_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
        with pg_session() as s:
            obj = s.get(Objective, objective_id)
            if not obj:
                return None
            for key, setter in (
                ("title", lambda v: setattr(obj, "title", v)),
                ("description", lambda v: setattr(obj, "description", v or "")),
                ("ownerId", lambda v: setattr(obj, "owner_user_id", v)),
                ("level", lambda v: setattr(obj, "level", v)),
                ("timeline", lambda v: setattr(obj, "timeline", v)),
                ("fiscalYear", lambda v: setattr(obj, "fiscal_year", int(v))),
                ("quarter", lambda v: setattr(obj, "quarter", _normalize_quarter(v))),
                ("division", lambda v: setattr(obj, "division", v)),
                ("status", lambda v: setattr(obj, "status", v)),
                ("departmentId", lambda v: setattr(obj, "department_id", v)),
                ("teamId", lambda v: setattr(obj, "team_id", v)),
                ("parentObjectiveId", lambda v: setattr(obj, "parent_objective_id", v or None)),
                ("nextReviewDate", lambda v: setattr(obj, "next_review_date", v)),
                ("latestUpdateSummary", lambda v: setattr(obj, "latest_update_summary", v)),
            ):
                if key in data:
                    setter(data.get(key))
            obj.updated_at = _utcnow()
            s.add(obj)
            s.flush()
            return self._serialize_objective(obj)

    def delete_objective(self, user_id: str, objective_id: str) -> bool:
        with pg_session() as s:
            obj = s.get(Objective, objective_id)
            if not obj:
                return False
            s.delete(obj)
            return True

    def get_objective_tree(self, user_id: str, objective_id: str) -> dict[str, Any] | None:
        with pg_session() as s:
            root = s.get(Objective, objective_id)
            if not root:
                return None

            def build_node(obj: Objective) -> dict[str, Any]:
                node = self._serialize_objective(obj)
                children = s.execute(
                    select(Objective).where(Objective.parent_objective_id == obj.id).order_by(Objective.created_at.asc())
                ).scalars().all()
                node["children"] = [build_node(c) for c in children]
                krs = s.execute(select(KeyResult).where(KeyResult.objective_id == obj.id)).scalars().all()
                node["keyResults"] = [self._serialize_kr(kr) for kr in krs]
                scores = [kr.score for kr in krs if kr.score is not None]
                node["averageScore"] = round(sum(scores) / len(scores), 1) if scores else None
                return node

            return build_node(root)

    def list_key_results(self, user_id: str, objective_id: str) -> list[dict[str, Any]]:
        with pg_session() as s:
            rows = s.execute(select(KeyResult).where(KeyResult.objective_id == objective_id)).scalars().all()
            return [self._serialize_kr(r) for r in rows]

    def get_key_result(self, user_id: str, key_result_id: str) -> dict[str, Any] | None:
        with pg_session() as s:
            kr = s.get(KeyResult, key_result_id)
            return self._serialize_kr(kr) if kr else None

    def create_key_result(self, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
        now = _utcnow()
        with pg_session() as s:
            kr = KeyResult(
                id=str(uuid4()),
                objective_id=data["objectiveId"],
                title=data["title"],
                target=data.get("target"),
                current_value=data.get("currentValue"),
                unit=data.get("unit") or "",
                score=data.get("score"),
                target_score=float(data.get("targetScore") or 1.0),
                owner_user_id=data.get("ownerId") or user_id,
                created_at=now,
                last_updated_at=now,
            )
            s.add(kr)
            s.flush()
            return self._serialize_kr(kr)

    def update_key_result(self, user_id: str, key_result_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
        with pg_session() as s:
            kr = s.get(KeyResult, key_result_id)
            if not kr:
                return None
            for key, attr in (
                ("title", "title"),
                ("target", "target"),
                ("currentValue", "current_value"),
                ("unit", "unit"),
                ("score", "score"),
                ("targetScore", "target_score"),
                ("ownerId", "owner_user_id"),
            ):
                if key in data:
                    setattr(kr, attr, data.get(key))
            kr.last_updated_at = _utcnow()
            s.add(kr)
            s.flush()
            return self._serialize_kr(kr)

    def delete_key_result(self, user_id: str, key_result_id: str) -> bool:
        with pg_session() as s:
            kr = s.get(KeyResult, key_result_id)
            if not kr:
                return False
            s.delete(kr)
            return True

    def _serialize_objective(self, o: Objective) -> dict[str, Any]:
        return {
            "_id": o.id,
            "orgId": o.org_id,
            "departmentId": o.department_id,
            "teamId": o.team_id,
            "ownerId": o.owner_user_id,
            "title": o.title,
            "description": o.description or "",
            "level": o.level,
            "status": o.status,
            "timeline": o.timeline,
            "fiscalYear": o.fiscal_year,
            "quarter": o.quarter,
            "division": o.division,
            "parentObjectiveId": o.parent_objective_id,
            "nextReviewDate": _iso(o.next_review_date),
            "latestUpdateSummary": o.latest_update_summary,
            "createdAt": _iso(o.created_at),
            "updatedAt": _iso(o.updated_at),
        }

    def _serialize_kr(self, kr: KeyResult) -> dict[str, Any]:
        return {
            "_id": kr.id,
            "objectiveId": kr.objective_id,
            "title": kr.title,
            "target": kr.target,
            "currentValue": kr.current_value,
            "unit": kr.unit or "",
            "score": kr.score,
            "targetScore": kr.target_score,
            "ownerId": kr.owner_user_id,
            "createdAt": _iso(kr.created_at),
            "lastUpdatedAt": _iso(kr.last_updated_at),
        }

