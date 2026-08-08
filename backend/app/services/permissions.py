"""Role-based permissions for OKR actions. User role from db.users (keyed by Auth0 sub).

Creating objectives: any role may create by default. Admins can set ``okrCreateDisabled`` on a user
document to block creation for that account. Mongo path uses ``db.users``; Postgres OKR storage
still consults the same permission helper via Mongo user records.

Bootstrap admins:

- ``APP_ADMIN_USER_IDS``: comma-separated Auth0 ``sub`` values (e.g. ``auth0|abc123``).
- ``APP_ADMIN_EMAILS``: comma-separated emails (case-insensitive). On login, those accounts get
  ``admin`` in Mongo and in ``get_user_role`` (no need to know ``sub`` ahead of time).
- ``APP_ORG_OWNER_EMAILS``: comma-separated emails (case-insensitive). On login, those accounts get
  ``org_owner`` unless they are bootstrap admins (admin wins).
"""
import os
from typing import Optional

ROLE_ADMIN = 'admin'
ROLE_LEADER = 'leader'
ROLE_STANDARD = 'standard'
ROLE_VIEW_ONLY = 'view_only'
ROLE_DEVELOPER = 'developer'
# Leadership / OKR owner roles (lowest typical owner: manager)
ROLE_EXECUTIVE = 'executive'
ROLE_ORG_OWNER = 'org_owner'
ROLE_VP = 'vp'
ROLE_DIRECTOR = 'director'
ROLE_MANAGER = 'manager'

# Leadership roles used for approval / dept-scoped actions (not for “who may create” — any role may create unless okrCreateDisabled).
OKR_LEADERSHIP_ROLES = frozenset({
    ROLE_ADMIN,
    ROLE_LEADER,
    ROLE_EXECUTIVE,
    ROLE_ORG_OWNER,
    ROLE_VP,
    ROLE_DIRECTOR,
    ROLE_MANAGER,
})

# Roles that can approve/reject and edit objectives in their department (same rules as legacy "leader").
DEPT_SCOPED_LEADER_ROLES = frozenset({
    ROLE_LEADER,
    ROLE_MANAGER,
    ROLE_DIRECTOR,
    ROLE_VP,
    ROLE_EXECUTIVE,
    ROLE_ORG_OWNER,
})


def _is_dept_scoped_leader(role: str) -> bool:
    return role in DEPT_SCOPED_LEADER_ROLES


def _bootstrap_admin_ids() -> frozenset[str]:
    raw = os.getenv("APP_ADMIN_USER_IDS", "").strip()
    if not raw:
        return frozenset()
    return frozenset(x.strip() for x in raw.split(",") if x.strip())


def _bootstrap_admin_emails() -> frozenset[str]:
    raw = os.getenv("APP_ADMIN_EMAILS", "").strip()
    if not raw:
        return frozenset()
    return frozenset(e.strip().lower() for e in raw.split(",") if e.strip())


def is_bootstrap_admin_email(email: Optional[str]) -> bool:
    """True if ``email`` is listed in ``APP_ADMIN_EMAILS`` (case-insensitive)."""
    if not email or not str(email).strip():
        return False
    return str(email).strip().lower() in _bootstrap_admin_emails()


def _bootstrap_org_owner_emails() -> frozenset[str]:
    raw = os.getenv("APP_ORG_OWNER_EMAILS", "").strip()
    if not raw:
        return frozenset()
    return frozenset(e.strip().lower() for e in raw.split(",") if e.strip())


def is_bootstrap_org_owner_email(email: Optional[str]) -> bool:
    """True if ``email`` is listed in ``APP_ORG_OWNER_EMAILS`` (case-insensitive)."""
    if not email or not str(email).strip():
        return False
    return str(email).strip().lower() in _bootstrap_org_owner_emails()


def get_user_role(db, user_id: str, auth_email: Optional[str] = None) -> str:
    """Get role for user_id (Auth0 sub). Bootstrap IDs/emails force admin; org-owner emails; else Mongo ``users.role``.

    ``auth_email`` should be the email from the current session or JWT when available so bootstrap lists apply even if
    Mongo ``users.email`` is missing or outdated.
    """
    if user_id in _bootstrap_admin_ids():
        return ROLE_ADMIN
    user = db.users.find_one({'_id': user_id})
    if not user:
        return ROLE_DEVELOPER
    email = (auth_email or user.get("email") or "").strip()
    if is_bootstrap_admin_email(email):
        return ROLE_ADMIN
    if is_bootstrap_org_owner_email(email):
        return ROLE_ORG_OWNER
    return user.get('role', ROLE_DEVELOPER)


def get_user_department_id(db, user_id: str) -> Optional[str]:
    """Get departmentId for user (string)."""
    user = db.users.find_one({'_id': user_id})
    if not user or not user.get('departmentId'):
        return None
    return str(user['departmentId'])


def is_okr_create_disabled(db, user_id: str) -> bool:
    """True when admin set ``okrCreateDisabled`` on the user document."""
    user = db.users.find_one({'_id': user_id})
    if not user:
        return False
    return bool(user.get('okrCreateDisabled'))


def can_create_objective(db, user_id: str) -> bool:
    """True unless ``okrCreateDisabled`` is set. Admins always may create."""
    role = get_user_role(db, user_id)
    if role == ROLE_ADMIN:
        return True
    if is_okr_create_disabled(db, user_id):
        return False
    return True


def can_view_objective(db, user_id: str, objective: dict) -> bool:
    """True if user can view this objective. Admin always; otherwise owner or same department."""
    role = get_user_role(db, user_id)
    if role == ROLE_ADMIN:
        return True
    if not objective:
        return False
    if objective.get('ownerId') == user_id:
        return True
    obj_dept = objective.get('departmentId')
    user_dept = get_user_department_id(db, user_id)
    if obj_dept and user_dept and str(obj_dept) == user_dept:
        return True
    # If objective has no department, allow only leadership roles to view it (keeps org-level OKRs restricted).
    if not obj_dept and role in OKR_LEADERSHIP_ROLES:
        return True
    return False


def build_objective_visibility_query(db, user_id: str) -> dict:
    """Mongo query fragment limiting which objectives user can see (for list endpoints)."""
    role = get_user_role(db, user_id)
    if role == ROLE_ADMIN:
        return {}
    user_dept = get_user_department_id(db, user_id)
    clauses = [{'ownerId': user_id}]
    if user_dept:
        clauses.append({'departmentId': user_dept})
    if role in OKR_LEADERSHIP_ROLES:
        clauses.append({'departmentId': None})
        clauses.append({'departmentId': {'$exists': False}})
    return {'$or': clauses} if clauses else {}


def can_edit_objective(db, user_id: str, objective: dict) -> bool:
    """True if user can edit this objective (and its KRs). Owner, dept-scoped leader of same dept, or admin."""
    role = get_user_role(db, user_id)
    if role == ROLE_ADMIN:
        return True
    if role == ROLE_VIEW_ONLY:
        return False
    if objective.get('ownerId') == user_id:
        return True
    if _is_dept_scoped_leader(role):
        obj_dept = objective.get('departmentId')
        user_dept = get_user_department_id(db, user_id)
        if obj_dept and user_dept and str(obj_dept) == user_dept:
            return True
    return False


def can_edit_kr(db, user_id: str, kr: dict, objective: Optional[dict] = None) -> bool:
    """True if user can edit this key result. KR owner, objective owner, dept leader in dept, or admin."""
    role = get_user_role(db, user_id)
    if role == ROLE_ADMIN:
        return True
    if role == ROLE_VIEW_ONLY:
        return False
    if kr.get('ownerId') == user_id:
        return True
    if objective and objective.get('ownerId') == user_id:
        return True
    if objective and _is_dept_scoped_leader(role):
        obj_dept = objective.get('departmentId')
        user_dept = get_user_department_id(db, user_id)
        if obj_dept and user_dept and str(obj_dept) == user_dept:
            return True
    return False


def can_submit_for_review(db, user_id: str, objective: dict) -> bool:
    """Submit for review: admin, any dept-scoped leader, or objective owner (if not view-only)."""
    role = get_user_role(db, user_id)
    if role == ROLE_ADMIN or _is_dept_scoped_leader(role):
        return True
    if role == ROLE_VIEW_ONLY:
        return False
    return objective.get('ownerId') == user_id


def can_approve_reject(db, user_id: str, objective: dict) -> bool:
    """Approve/reject/request changes: dept-scoped leader (same dept), admin."""
    role = get_user_role(db, user_id)
    if role == ROLE_ADMIN:
        return True
    if not _is_dept_scoped_leader(role):
        return False
    obj_dept = objective.get('departmentId')
    user_dept = get_user_department_id(db, user_id)
    return obj_dept and user_dept and str(obj_dept) == user_dept


def can_resubmit(db, user_id: str, objective: dict) -> bool:
    """Resubmit after reject: owner, admin."""
    role = get_user_role(db, user_id)
    if role == ROLE_ADMIN:
        return True
    if role == ROLE_VIEW_ONLY:
        return False
    return objective.get('ownerId') == user_id


def can_reopen(db, user_id: str, objective: dict) -> bool:
    """Reopen (approved/rejected -> draft): admin only."""
    role = get_user_role(db, user_id)
    if role != ROLE_ADMIN:
        return False
    status = (objective.get('status') or '').lower()
    return status in ('approved', 'rejected')


def can_delete_objective(db, user_id: str, objective: dict) -> bool:
    """Full control: admin or dept-scoped leader in dept."""
    role = get_user_role(db, user_id)
    if role == ROLE_ADMIN:
        return True
    if not _is_dept_scoped_leader(role):
        return False
    obj_dept = objective.get('departmentId')
    user_dept = get_user_department_id(db, user_id)
    return obj_dept and user_dept and str(obj_dept) == user_dept


USER_APP_ROLES = frozenset({
    ROLE_ADMIN,
    ROLE_LEADER,
    ROLE_STANDARD,
    ROLE_VIEW_ONLY,
    ROLE_DEVELOPER,
    ROLE_EXECUTIVE,
    ROLE_ORG_OWNER,
    ROLE_VP,
    ROLE_DIRECTOR,
    ROLE_MANAGER,
})


def can_manage_app_users(role: str) -> bool:
    """List/update Mongo user roles: full admins and org owners."""
    return role in (ROLE_ADMIN, ROLE_ORG_OWNER)


def is_dev_allow_all_user_management() -> bool:
    """When True, any authenticated user may call user-management list/PATCH APIs.

    Disabled in production. Opt-in via ``APP_DEV_ALLOW_ALL_USER_MANAGEMENT`` for local/hackathon setups
    where Mongo still has ``view_only`` but you need User management without editing the DB first.
    """
    if (os.getenv("FLASK_ENV") or "").strip().lower() == "production":
        return False
    v = (os.getenv("APP_DEV_ALLOW_ALL_USER_MANAGEMENT") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def session_may_manage_app_users(db, user_id: str, auth_email: Optional[str] = None) -> bool:
    """Whether this session may use User management APIs (role check or dev bypass)."""
    if is_dev_allow_all_user_management():
        return True
    return can_manage_app_users(get_user_role(db, user_id, auth_email))


def can_create_share_link(db, user_id: str, objective: dict) -> bool:
    """True if user can create a share link for this objective. Not view_only; admin, owner, or dept leader in same dept."""
    role = get_user_role(db, user_id)
    if role == ROLE_VIEW_ONLY:
        return False
    if role == ROLE_ADMIN:
        return True
    if objective.get('ownerId') == user_id:
        return True
    if _is_dept_scoped_leader(role):
        obj_dept = objective.get('departmentId')
        user_dept = get_user_department_id(db, user_id)
        if obj_dept and user_dept and str(obj_dept) == user_dept:
            return True
    return False
