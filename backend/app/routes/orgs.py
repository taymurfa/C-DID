from __future__ import annotations

import os
import re
from uuid import uuid4

from flask import Blueprint, jsonify, request
from sqlalchemy import and_, func, select, text

from app.routes.auth_backend import get_user_info_from_request, require_auth
from app.db.postgres import pg_session
from app.models_sql import Department, Membership, Objective, Organization, Team, User
from app.repositories.okr_repo_postgres import PostgresOKRRepository
from app.services.org_bootstrap import ensure_default_org_membership_in_session


bp = Blueprint("orgs", __name__)


def _user_can_create_department_in_org(s, user_id: str, org_id: str) -> bool:
    """
    Active membership, or objective owner in this org (membership row sometimes missing),
    or Mongo role admin / org owner (user management).
    """
    mem = s.get(Membership, {"user_id": user_id, "org_id": org_id})
    if mem and mem.active:
        return True
    owns = (
        s.execute(
            select(func.count())
            .select_from(Objective)
            .where(and_(Objective.org_id == org_id, Objective.owner_user_id == user_id))
        ).scalar()
        or 0
    )
    if int(owns) > 0:
        return True
    try:
        from app.db.mongodb import get_db
        from app.services.permissions import session_may_manage_app_users

        db = get_db()
        info = get_user_info_from_request()
        auth_em = (info.get('email') or '').strip() or None
        if session_may_manage_app_users(db, user_id, auth_em):
            return True
    except Exception:
        pass
    return False


def _canonical_from_display_name(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").strip().lower())
    s = s.strip("-")[:120]
    return s or "department"


def _require_pg():
    if not os.getenv("DATABASE_URL"):
        return jsonify({"error": "Postgres is not configured (DATABASE_URL missing)"}), 503
    return None


@bp.route("/orgs", methods=["GET"])
@require_auth
def list_orgs(user_id: str):
    err = _require_pg()
    if err:
        return err
    with pg_session() as s:
        ensure_default_org_membership_in_session(s, user_id)
        rows = (
            s.execute(
                select(Organization)
                .join(Membership, Membership.org_id == Organization.id)
                .where(Membership.user_id == user_id)
                .where(Membership.active.is_(True))
                .order_by(Organization.created_at.asc())
            )
            .scalars()
            .all()
        )
        # Single-tenant display: replace auto-generated "*'s organization" with APP_DEFAULT_ORG_NAME (e.g. "Select Quote").
        display_name = (os.getenv("APP_DEFAULT_ORG_NAME") or "").strip()
        if display_name:
            for o in rows:
                if (o.name or "").endswith("'s organization"):
                    o.name = display_name[:200]
            s.flush()
        return jsonify([{"id": o.id, "name": o.name, "slug": o.slug} for o in rows]), 200


@bp.route("/orgs/<org_id>/departments", methods=["POST"])
@require_auth
def create_org_department(org_id: str, user_id: str):
    """Create a department under an org (Postgres). Caller must be an active member."""
    err = _require_pg()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    display = (data.get("name") or "").strip()
    if not display:
        return jsonify({"error": "name is required"}), 400

    with pg_session() as s:
        if not _user_can_create_department_in_org(s, user_id, org_id):
            return jsonify({"error": "No access to this organization"}), 403

        org = s.get(Organization, org_id)
        if not org:
            return jsonify({"error": "Organization not found"}), 404

        base = _canonical_from_display_name(display)
        canonical = base
        n = 1
        while True:
            existing = (
                s.execute(
                    select(Department.id).where(Department.org_id == org_id).where(Department.canonical_name == canonical)
                )
                .scalar_one_or_none()
            )
            if existing is None:
                break
            n += 1
            canonical = f"{base}-{n}"[:120]

        dept = Department(
            id=str(uuid4()),
            org_id=org_id,
            canonical_name=canonical,
            display_name=display[:200],
        )
        s.add(dept)
        s.commit()
        return jsonify({"_id": dept.id, "name": dept.display_name}), 201


@bp.route("/orgs/<org_id>/tree", methods=["GET"])
@require_auth
def org_tree(org_id: str, user_id: str):
    err = _require_pg()
    if err:
        return err

    with pg_session() as s:
        # Basic membership check: user must be active in org.
        mem = s.get(Membership, {"user_id": user_id, "org_id": org_id})
        if not mem or not mem.active:
            return jsonify({"error": "No access to this organization"}), 403

        org = s.get(Organization, org_id)
        if not org:
            return jsonify({"error": "Organization not found"}), 404

        departments = s.execute(
            select(Department).where(Department.org_id == org_id).order_by(Department.display_name.asc())
        ).scalars().all()
        teams = s.execute(
            select(Team).where(Team.org_id == org_id).order_by(Team.display_name.asc())
        ).scalars().all()

        users = (
            s.execute(
                select(User)
                .join(Membership, Membership.user_id == User.id)
                .where(Membership.org_id == org_id)
                .where(Membership.active.is_(True))
            )
            .scalars()
            .all()
        )
        memberships = (
            s.execute(select(Membership).where(Membership.org_id == org_id).where(Membership.active.is_(True)))
            .scalars()
            .all()
        )

        users_by_id = {u.id: u for u in users}

        # Build dept -> teams -> users
        dept_nodes = {
            d.id: {
                "id": d.id,
                "canonicalName": d.canonical_name,
                "displayName": d.display_name,
                "parentDepartmentId": d.parent_department_id,
                "teams": [],
            }
            for d in departments
        }

        team_nodes = {
            t.id: {
                "id": t.id,
                "canonicalName": t.canonical_name,
                "displayName": t.display_name,
                "departmentId": t.department_id,
                "users": [],
            }
            for t in teams
        }

        # Assign teams to departments
        for t in teams:
            node = team_nodes[t.id]
            if t.department_id and t.department_id in dept_nodes:
                dept_nodes[t.department_id]["teams"].append(node)

        # Assign users to teams/depts based on membership
        unassigned_users = []
        for m in memberships:
            u = users_by_id.get(m.user_id)
            if not u:
                continue
            user_node = {"id": u.id, "name": u.name or "", "email": u.email or "", "role": m.role}
            if m.team_id and m.team_id in team_nodes:
                team_nodes[m.team_id]["users"].append(user_node)
            elif m.department_id and m.department_id in dept_nodes:
                # Place dept members without explicit team into a synthetic "Unassigned" group at dept level.
                dept = dept_nodes[m.department_id]
                bucket = next((t for t in dept["teams"] if t.get("id") == "unassigned"), None)
                if bucket is None:
                    bucket = {"id": "unassigned", "canonicalName": "unassigned", "displayName": "Unassigned", "departmentId": m.department_id, "users": []}
                    dept["teams"].append(bucket)
                bucket["users"].append(user_node)
            else:
                unassigned_users.append(user_node)

        # Stable ordering
        for d in dept_nodes.values():
            d["teams"] = sorted(d["teams"], key=lambda x: (x.get("displayName") or "").lower())
            for t in d["teams"]:
                t["users"] = sorted(t.get("users") or [], key=lambda x: (x.get("name") or x.get("email") or "").lower())

        return jsonify(
            {
                "org": {"id": org.id, "name": org.name, "slug": org.slug},
                "departments": sorted(dept_nodes.values(), key=lambda x: (x.get("displayName") or "").lower()),
                "unassignedUsers": sorted(unassigned_users, key=lambda x: (x.get("name") or x.get("email") or "").lower()),
            }
        ), 200


@bp.route("/okrs/scope/objectives", methods=["GET"])
@require_auth
def objectives_by_scope(user_id: str):
    err = _require_pg()
    if err:
        return err
    scope = (request.args.get("scope") or "").strip().lower()
    scope_id = (request.args.get("scopeId") or "").strip()
    fiscal_year = request.args.get("fiscalYear", type=int)
    if scope not in ("org", "department", "team", "user"):
        return jsonify({"error": "scope must be one of: org, department, team, user"}), 400
    if not scope_id:
        return jsonify({"error": "scopeId is required"}), 400

    with pg_session() as s:
        # Membership check for org scope; for narrower scopes, we rely on the objective query + future RBAC.
        if scope == "org":
            mem = s.get(Membership, {"user_id": user_id, "org_id": scope_id})
            if not mem or not mem.active:
                return jsonify({"error": "No access to this organization"}), 403

    # Direct SQLAlchemy query
    from app.models_sql.okr import Objective

    with pg_session() as s:
        stmt = select(Objective)
        if fiscal_year is not None:
            stmt = stmt.where(Objective.fiscal_year == fiscal_year)
        if scope == "org":
            stmt = stmt.where(Objective.org_id == scope_id)
        elif scope == "department":
            stmt = stmt.where(Objective.department_id == scope_id)
        elif scope == "team":
            stmt = stmt.where(Objective.team_id == scope_id)
        elif scope == "user":
            stmt = stmt.where(Objective.owner_user_id == scope_id)
        stmt = stmt.order_by(Objective.created_at.desc())
        rows = s.execute(stmt).scalars().all()
        repo = PostgresOKRRepository()
        return jsonify([repo._serialize_objective(o) for o in rows]), 200


@bp.route("/objectives/<objective_id>/ancestors", methods=["GET"])
@require_auth
def objective_ancestors(objective_id: str, user_id: str):
    """
    Return objective ancestor chain (root -> ... -> objective).
    Postgres: recursive CTE over objectives.parent_objective_id
    """
    err = _require_pg()
    if err:
        return err

    with pg_session() as s:
        # Access check: user must be in the same org as the objective (via membership).
        row = s.execute(
            text("select id, org_id from objectives where id = :id"),
            {"id": objective_id},
        ).mappings().first()
        if not row:
            return jsonify({"error": "Objective not found"}), 404
        mem = s.get(Membership, {"user_id": user_id, "org_id": row["org_id"]})
        if not mem or not mem.active:
            return jsonify({"error": "Not allowed to view this objective"}), 403

        chain = s.execute(
            text(
                """
with recursive ancestors as (
  select id, title, parent_objective_id
  from objectives
  where id = :start_id
  union all
  select o.id, o.title, o.parent_objective_id
  from objectives o
  join ancestors a on a.parent_objective_id = o.id
)
select id, title, parent_objective_id
from ancestors;
"""
            ),
            {"start_id": objective_id},
        ).mappings().all()

        # chain comes from leaf->root due to recursion; reverse for breadcrumbs
        chain = list(chain)
        chain.reverse()
        return jsonify(
            [
                {"_id": r["id"], "title": r["title"], "parentObjectiveId": r["parent_objective_id"]}
                for r in chain
            ]
        ), 200

