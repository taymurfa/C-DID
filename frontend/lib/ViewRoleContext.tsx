'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { clearUserCache, setCurrentUserCache, type User } from '@/lib/auth';
import { api } from '@/lib/api';
import { isAdminAccount } from '@/lib/roles';

const VIEW_AS_KEY = 'viewAsRole';
const ROLE_PREVIEW_KEY = 'okrRolePreview';

export type ViewRole = 'developer' | 'view_only';

export type AppRole =
  | 'admin'
  | 'leader'
  | 'standard'
  | 'view_only'
  | 'developer'
  | 'manager'
  | 'director'
  | 'vp'
  | 'executive'
  | 'org_owner';

type ViewRoleContextValue = {
  effectiveRole: ViewRole;
  setEffectiveRole: (role: ViewRole) => void;
  actualRole: string | undefined;
  /** Current user from backend (role, departmentId). Refetched on focus so permission changes apply. */
  user: User | null;
  refetchUser: () => Promise<void>;
  /** Role used for UI (nav, dashboard, permissions). When set, overrides real role for testing. */
  roleForUI: string | undefined;
  /** Set role preview for testing (null = use actual role). Persisted in localStorage. */
  setRolePreview: (role: AppRole | null) => void;
  /** Current role preview override (null = using actual role). */
  rolePreview: AppRole | null;
  /** User with role overridden for permission checks when testing. Use this when passing "user" to permission-sensitive components. */
  userForPermissions: User | null;
};

const ViewRoleContext = createContext<ViewRoleContextValue | null>(null);

function getStoredViewRole(): ViewRole | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(VIEW_AS_KEY);
  if (v === 'view_only' || v === 'developer') return v;
  return null;
}

function getStoredRolePreview(): AppRole | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(ROLE_PREVIEW_KEY);
  if (
    v === 'admin' ||
    v === 'leader' ||
    v === 'standard' ||
    v === 'view_only' ||
    v === 'developer' ||
    v === 'manager' ||
    v === 'director' ||
    v === 'vp' ||
    v === 'executive' ||
    v === 'org_owner'
  )
    return v;
  return null;
}

export function ViewRoleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [override, setOverrideState] = useState<ViewRole | null>(null);
  const [rolePreview, setRolePreviewState] = useState<AppRole | null>(null);

  // Restore role preview / override from localStorage after mount so server and initial client render match (avoids hydration mismatch).
  useEffect(() => {
    setOverrideState(getStoredViewRole());
    setRolePreviewState(getStoredRolePreview());
  }, []);

  const refetchUser = useCallback(async () => {
    try {
      clearUserCache();
      const u = (await api.getCurrentUser()) as User | null;
      setCurrentUserCache(u);
      setUser(u);
    } catch {
      setCurrentUserCache(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refetchUser();
  }, [refetchUser, pathname]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refetchUser();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refetchUser]);

  const setEffectiveRole = useCallback((role: ViewRole) => {
    if (typeof window !== 'undefined') localStorage.setItem(VIEW_AS_KEY, role);
    setOverrideState(role);
  }, []);

  const setRolePreview = useCallback((role: AppRole | null) => {
    if (typeof window !== 'undefined') {
      if (role) localStorage.setItem(ROLE_PREVIEW_KEY, role);
      else localStorage.removeItem(ROLE_PREVIEW_KEY);
    }
    setRolePreviewState(role);
  }, []);

  /** Non-admins cannot keep “preview → Admin” in localStorage. */
  useEffect(() => {
    if (rolePreview === 'admin' && user && !isAdminAccount(user)) {
      setRolePreview(null);
    }
  }, [rolePreview, user, setRolePreview]);

  const actualRole = user?.role;
  const roleForUI = rolePreview ?? actualRole;
  const effectiveRole: ViewRole =
    override ?? (roleForUI === 'view_only' ? 'view_only' : 'developer');
  const userForPermissions: User | null =
    user && rolePreview
      ? { ...user, role: rolePreview }
      : user;

  return (
    <ViewRoleContext.Provider
      value={{
        effectiveRole,
        setEffectiveRole,
        actualRole,
        user,
        refetchUser,
        roleForUI,
        setRolePreview,
        rolePreview,
        userForPermissions,
      }}
    >
      {children}
    </ViewRoleContext.Provider>
  );
}

export function useViewRole(): ViewRoleContextValue {
  const ctx = useContext(ViewRoleContext);
  if (!ctx) {
    return {
      effectiveRole: 'developer',
      setEffectiveRole: () => {},
      actualRole: undefined,
      user: null,
      refetchUser: async () => {},
      roleForUI: undefined,
      setRolePreview: () => {},
      rolePreview: null,
      userForPermissions: null,
    };
  }
  return ctx;
}
