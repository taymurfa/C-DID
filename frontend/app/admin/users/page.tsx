'use client';

import { useEffect, useMemo, useState } from 'react';
import { clearUserCache, login, User } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useViewRole } from '@/lib/ViewRoleContext';
import { AppLayout } from '@/components/AppLayout';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ASSIGNABLE_APP_ROLES, canManageUsersAccount } from '@/lib/roles';
import { cn } from '@/components/ui/utils';

type UserRecord = {
  _id: string;
  role: string;
  departmentId?: string;
  name?: string;
  email?: string;
  okrCreateDisabled?: boolean;
  /** When true, User management links are hidden for this user (admin / org owner only). */
  hideUserManagementNav?: boolean;
};

const ROLES = ASSIGNABLE_APP_ROLES as unknown as readonly string[];

/** Short hint for the role column in User management. */
function rolePermissionSummary(role: string): string {
  switch (role) {
    case 'admin':
      return 'Full access: users, data, and configuration.';
    case 'org_owner':
      return 'Organization management: users and permissions (cannot assign admin).';
    case 'view_only':
      return 'Read-only: cannot edit OKRs or integrations.';
    case 'standard':
    case 'developer':
      return 'Contributor: create and edit per policy (objectives unless creation is blocked).';
    default:
      return 'Leadership: create and review OKRs in scope.';
  }
}

function UserRow({
  user: u,
  saving,
  onUpdate,
  roles,
  roleEditLocked,
}: {
  user: UserRecord;
  saving: boolean;
  onUpdate: (updates: {
    role?: string;
    departmentId?: string | null;
    okrCreateDisabled?: boolean;
    hideUserManagementNav?: boolean;
  }) => void;
  roles: readonly string[];
  /** Org owners cannot reassign admin accounts */
  roleEditLocked?: boolean;
}) {
  const [role, setRole] = useState(u.role);
  const [departmentId, setDepartmentId] = useState(u.departmentId ?? '');
  const [okrCreateDisabled, setOkrCreateDisabled] = useState(!!u.okrCreateDisabled);
  const [hideUserManagementNav, setHideUserManagementNav] = useState(!!u.hideUserManagementNav);

  useEffect(() => {
    setRole(u.role);
    setDepartmentId(u.departmentId ?? '');
    setOkrCreateDisabled(!!u.okrCreateDisabled);
    setHideUserManagementNav(!!u.hideUserManagementNav);
  }, [u._id, u.role, u.departmentId, u.okrCreateDisabled, u.hideUserManagementNav]);

  useEffect(() => {
    if (role === 'admin') setOkrCreateDisabled(false);
  }, [role]);

  const isAdminRole = role === 'admin';
  const canCreateObjectives = isAdminRole ? true : !okrCreateDisabled;

  const hasChanges =
    role !== u.role ||
    (departmentId.trim() || null) !== (u.departmentId ?? null) ||
    !!okrCreateDisabled !== !!u.okrCreateDisabled ||
    !!hideUserManagementNav !== !!u.hideUserManagementNav;

  const handleSave = () => {
    onUpdate({
      role,
      departmentId: departmentId.trim() || null,
      okrCreateDisabled,
      hideUserManagementNav,
    });
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-4 shadow-sm',
        'grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_auto]'
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="font-medium leading-snug truncate" title={u.name || u.email}>
          {u.name || u.email || 'No name'}
        </p>
        {u.email && u.name && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
        <p className="font-mono text-[11px] text-muted-foreground truncate" title={u._id}>
          {u._id}
        </p>
        <div className="flex flex-wrap gap-1 pt-1">
          {role === 'admin' && <Badge>Admin</Badge>}
          {role === 'view_only' && (
            <Badge variant="secondary">View only</Badge>
          )}
          {!isAdminRole && (
            <Badge variant={canCreateObjectives ? 'outline' : 'destructive'}>
              {canCreateObjectives ? 'Can create OKRs' : 'Cannot create OKRs'}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Role (access level)</Label>
        {roleEditLocked ? (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium">{role}</div>
        ) : (
          <Select value={role} onValueChange={setRole} disabled={saving}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-[11px] leading-snug text-muted-foreground">{rolePermissionSummary(role)}</p>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Department (ID)</Label>
          <Input
            className="mt-1 h-9"
            value={departmentId}
            placeholder="Optional — UUID or empty"
            onChange={(e) => setDepartmentId(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-input"
              checked={canCreateObjectives}
              disabled={saving || isAdminRole}
              onChange={(e) => {
                if (isAdminRole) return;
                setOkrCreateDisabled(!e.target.checked);
              }}
              title={isAdminRole ? 'Admins can always create objectives' : undefined}
            />
            <span>
              <span className="font-medium">Allow creating objectives</span>
              <span className="block text-xs text-muted-foreground">
                Turn off to block only OKR creation; other role permissions still apply.
              </span>
            </span>
          </label>
        </div>
        {(role === 'admin' || role === 'org_owner') && (
          <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-input"
                checked={hideUserManagementNav}
                disabled={saving}
                onChange={(e) => setHideUserManagementNav(e.target.checked)}
              />
              <span>
                <span className="font-medium">Hide User management button</span>
                <span className="block text-xs text-muted-foreground">
                  Removes User management from the sidebar, profile, and dashboard header for this account. They can
                  still open <code className="text-[10px]">/admin/users</code> directly if they know the URL.
                </span>
              </span>
            </label>
          </div>
        )}
      </div>

      <div className="flex items-end lg:justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges} className="min-w-[88px]">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { rolePreview, user: sessionUser, refetchUser, setRolePreview } = useViewRole();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const canAccessUserManagement = canManageUsersAccount(user);

  const assignableRoles = useMemo(() => {
    if (!user) return ROLES;
    if (user.role === 'org_owner') {
      return ROLES.filter((r) => r !== 'admin');
    }
    return ROLES;
  }, [user]);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      setIsLoading(true);
      clearUserCache();
      // Direct API call avoids stale in-memory getCurrentUser() cache after role changes.
      const me = (await api.getCurrentUser()) as User;
      if (!me) {
        await login();
        return;
      }
      setUser(me);
      await refetchUser();
      if (canManageUsersAccount(me)) {
        await loadUsers();
      }
    } catch {
      await login();
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const list = await api.getUsers();
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUpdate = async (
    uid: string,
    updates: {
      role?: string;
      departmentId?: string | null;
      okrCreateDisabled?: boolean;
      hideUserManagementNav?: boolean;
    }
  ) => {
    setSavingId(uid);
    setError(null);
    try {
      await api.updateUser(uid, updates);
      setUsers((prev) =>
        prev.map((u) =>
          u._id === uid
            ? {
                ...u,
                role: updates.role ?? u.role,
                departmentId: updates.departmentId !== undefined ? (updates.departmentId ?? undefined) : u.departmentId,
                okrCreateDisabled:
                  updates.okrCreateDisabled !== undefined ? updates.okrCreateDisabled : u.okrCreateDisabled,
                hideUserManagementNav:
                  updates.hideUserManagementNav !== undefined
                    ? updates.hideUserManagementNav
                    : u.hideUserManagementNav,
              }
            : u
        )
      );
      if (sessionUser?.sub && uid === sessionUser.sub) {
        await refetchUser();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user');
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="User management" description="Loading…">
        <div className="text-center text-muted-foreground py-8">Loading…</div>
      </AppLayout>
    );
  }

  if (!user) {
    return null;
  }

  if (!canAccessUserManagement) {
    return (
      <AppLayout title="Access restricted" description="Admin or org owner role required on the server">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>No permission for user management</CardTitle>
            <p className="text-sm text-muted-foreground">
              Your session is valid, but your server role is not <code className="text-xs">admin</code> or{' '}
              <code className="text-xs">org_owner</code>.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Server role (real account):</strong>{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{user.role ?? 'unset'}</code>
            </p>
            {rolePreview != null && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-medium text-amber-950 dark:text-amber-50">Role preview is on</p>
                <p className="mt-1">
                  Preview only changes parts of the UI; APIs still use your real server role{' '}
                  <code className="text-xs">{user.role}</code>.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setRolePreview(null);
                    void loadUser();
                  }}
                >
                  Clear preview and retry
                </Button>
              </div>
            )}
            <p>
              To access this page you need <code className="text-xs">role: &quot;admin&quot;</code> or{' '}
              <code className="text-xs">role: &quot;org_owner&quot;</code> in MongoDB for your user (Auth0{' '}
              <code className="text-xs">sub</code>), or set bootstrap env vars:{' '}
              <code className="text-xs">APP_ADMIN_USER_IDS</code> / <code className="text-xs">APP_ADMIN_EMAILS</code> for
              admins, or <code className="text-xs">APP_ORG_OWNER_EMAILS</code> for org owners (comma-separated emails).
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" onClick={() => router.push('/dashboard')}>
                Go to dashboard
              </Button>
              <Button type="button" variant="outline" onClick={() => void loadUser()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="User management" description="Roles, department, and permissions (admin or org owner)">
      <div className="space-y-6 max-w-6xl">
        {rolePreview && sessionUser && rolePreview !== sessionUser.role && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            <strong>Role preview is on.</strong> The UI simulates <strong>{rolePreview}</strong>; APIs still use your real
            role (<strong>{sessionUser.role}</strong>). Listing and edits require{' '}
            <strong className="text-foreground">admin</strong> or <strong className="text-foreground">org_owner</strong>{' '}
            on the server.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <Card>
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Users</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Combined <strong className="text-foreground">Auth0 + MongoDB</strong> list: people in your directory
                  plus anyone with an app record. <strong>Role</strong> sets the baseline;{' '}
                  <strong>Allow creating objectives</strong> toggles only that permission. For{' '}
                  <strong className="text-foreground">admin</strong> / <strong className="text-foreground">org owner</strong>{' '}
                  rows you can hide the User management button in the app.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className="text-xs font-normal">
                  {loadingUsers ? '…' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
                </Badge>
                <Button variant="outline" size="sm" onClick={loadUsers} disabled={loadingUsers}>
                  Refresh list
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loadingUsers ? (
              <div className="text-center text-muted-foreground py-12">Loading users…</div>
            ) : users.length === 0 ? (
              <div className="space-y-3 text-center text-muted-foreground py-10 text-sm max-w-lg mx-auto">
                <p>No users in the list.</p>
                <p>
                  After first sign-in a MongoDB user document should appear. Set{' '}
                  <code className="text-xs rounded bg-muted px-1">APP_ADMIN_USER_IDS</code>,{' '}
                  <code className="text-xs rounded bg-muted px-1">APP_ORG_OWNER_EMAILS</code>, or{' '}
                  <code className="text-xs rounded bg-muted px-1">role: &quot;admin&quot;</code>, then{' '}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-4 font-medium"
                    onClick={() => {
                      void refetchUser();
                      loadUsers();
                    }}
                  >
                    refresh
                  </button>
                  .
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_auto] gap-4 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>User</span>
                  <span>Role</span>
                  <span>Department, OKR create &amp; nav</span>
                  <span className="text-right">Action</span>
                </div>
                {users.map((u) => (
                  <UserRow
                    key={u._id}
                    user={u}
                    saving={savingId === u._id}
                    onUpdate={(updates) => handleUpdate(u._id, updates)}
                    roles={assignableRoles}
                    roleEditLocked={user.role === 'org_owner' && u.role === 'admin'}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
