/**
 * App roles aligned with backend app/services/permissions.py.
 * Every role (including view_only) may create objectives unless an admin sets ``okrCreateDisabled`` on the user.
 */

export const OKR_LEADERSHIP_ROLES = [
  'admin',
  'leader',
  'executive',
  'org_owner',
  'vp',
  'director',
  'manager',
] as const;

export type OKRLeadershipRole = (typeof OKR_LEADERSHIP_ROLES)[number];

export const DEPT_SCOPED_LEADER_ROLES = [
  'leader',
  'manager',
  'director',
  'vp',
  'executive',
  'org_owner',
] as const;

export function isOKRLeadershipRole(role: string | undefined | null): role is OKRLeadershipRole {
  if (!role) return false;
  return (OKR_LEADERSHIP_ROLES as readonly string[]).includes(role);
}

export function isDeptScopedLeaderRole(role: string | undefined | null): boolean {
  if (!role) return false;
  return (DEPT_SCOPED_LEADER_ROLES as readonly string[]).includes(role);
}

function normalizeAppRole(role: string | undefined | null): string {
  return (role ?? '').trim().toLowerCase();
}

/** True when the signed-in account is **admin** from `/auth/me` (not “Switch role” preview). */
export function isAdminAccount(u: { role?: string } | null | undefined): boolean {
  return normalizeAppRole(u?.role) === 'admin';
}

/** True when the signed-in account is **org_owner** from `/auth/me`. */
export function isOrgOwnerAccount(u: { role?: string } | null | undefined): boolean {
  return normalizeAppRole(u?.role) === 'org_owner';
}

/**
 * True when `/auth/me` allows User management APIs (admin/org_owner, or dev bypass flag on the server).
 */
export function canManageUsersAccount(
  u: { role?: string; canManageAppUsers?: boolean } | null | undefined
): boolean {
  if (u?.canManageAppUsers === true) return true;
  return isAdminAccount(u) || isOrgOwnerAccount(u);
}

/**
 * User management in nav, dashboard, and Settings: hidden if the account opted out.
 * Real admin/org_owner: always show unless previewing a non-management role (IC demos).
 * Everyone else: show only when “Test role (preview)” is org owner (UI only; APIs still use the real server role).
 */
export function shouldShowUserManagementNav(
  user: { role?: string; hideUserManagementNav?: boolean } | null | undefined,
  rolePreview: string | null | undefined
): boolean {
  if (!user) return false;
  if (user.hideUserManagementNav === true) return false;

  const preview = rolePreview != null ? normalizeAppRole(rolePreview) : null;

  if (canManageUsersAccount(user)) {
    if (preview == null) return true;
    return preview === 'admin' || preview === 'org_owner';
  }

  return preview === 'org_owner';
}

/**
 * Profile (and similar) link to User management: any signed-in user unless the account opted out of the nav.
 * Actual list/edit APIs remain restricted to admin / org_owner on the server.
 */
export function shouldShowUserManagementProfileLink(
  user: { hideUserManagementNav?: boolean } | null | undefined
): boolean {
  if (!user) return false;
  return user.hideUserManagementNav !== true;
}

/** True if this account may create objectives (all roles; only blocked when ``okrCreateDisabled``). Admins ignore the flag. */
export function userCanCreateObjectives(
  u: { role?: string; okrCreateDisabled?: boolean } | null | undefined
): boolean {
  if (!u) return false;
  if (isAdminAccount(u)) return true;
  if (u.okrCreateDisabled === true) return false;
  return true;
}

/** All roles assignable in Admin → User management (must match backend USER_APP_ROLES). */
export const ASSIGNABLE_APP_ROLES = [
  'admin',
  'executive',
  'org_owner',
  'vp',
  'director',
  'manager',
  'leader',
  'standard',
  'view_only',
  'developer',
] as const;
