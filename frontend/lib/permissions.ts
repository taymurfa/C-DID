/**
 * Mirror of backend app/services/permissions.py for UI gating.
 * Given current user and objective/keyResult, compute what actions are allowed.
 */

import type { User } from '@/lib/auth';
import type { Objective, KeyResult } from '@/lib/api';
import { isDeptScopedLeaderRole } from '@/lib/roles';

export type OKRPermissions = {
  canEditObjective: boolean;
  canEditKr: (kr: KeyResult) => boolean;
  canSubmit: boolean;
  canApproveReject: boolean;
  canResubmit: boolean;
  canReopen: boolean;
  canDelete: boolean;
  canCreateShareLink: boolean;
};

function strEq(a: string | undefined | null, b: string | undefined | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

export function getOKRPermissions(
  user: User | null,
  objective: Objective,
  keyResults: KeyResult[] = []
): OKRPermissions {
  const role = user?.role ?? 'developer';
  const userId = user?.sub ?? '';
  const userDept = user?.departmentId ?? null;
  const objDept = objective.departmentId ?? null;
  const ownerId = objective.ownerId ?? null;

  const canEditObjective = Boolean(
    role === 'admin' ||
    (role !== 'view_only' && strEq(ownerId, userId)) ||
    (isDeptScopedLeaderRole(role) && objDept && userDept && strEq(objDept, userDept))
  );

  const canEditKr = (kr: KeyResult): boolean => {
    if (role === 'admin') return true;
    if (role === 'view_only') return false;
    if (strEq(kr.ownerId, userId)) return true;
    if (strEq(ownerId, userId)) return true;
    if (isDeptScopedLeaderRole(role) && objDept && userDept && strEq(objDept, userDept)) return true;
    return false;
  };

  const canSubmit =
    role === 'admin' ||
    isDeptScopedLeaderRole(role) ||
    (role !== 'view_only' && strEq(ownerId, userId));

  const canApproveReject = Boolean(
    role === 'admin' ||
    (isDeptScopedLeaderRole(role) && objDept && userDept && strEq(objDept, userDept))
  );

  const canResubmit = role === 'admin' || (role !== 'view_only' && strEq(ownerId, userId));

  const status = (objective.status ?? '').toString().toLowerCase();
  const canReopen =
    role === 'admin' &&
    (status === 'approved' || status === 'rejected');

  const canDelete = Boolean(
    role === 'admin' ||
    (isDeptScopedLeaderRole(role) && objDept && userDept && strEq(objDept, userDept))
  );

  const canCreateShareLink = Boolean(
    role !== 'view_only' &&
    (role === 'admin' ||
      strEq(ownerId, userId) ||
      (isDeptScopedLeaderRole(role) && objDept && userDept && strEq(objDept, userDept)))
  );

  return {
    canEditObjective,
    canEditKr,
    canSubmit,
    canApproveReject,
    canResubmit,
    canReopen,
    canDelete,
    canCreateShareLink,
  };
}
