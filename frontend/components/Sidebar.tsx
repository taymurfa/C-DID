'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Target,
  BarChart3,
  Building2,
  Plus,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Users,
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { resolveDepartmentIdForPostgres } from '@/lib/legacyDepartments';
import { useViewRole } from '@/lib/ViewRoleContext';
import { shouldShowUserManagementNav, userCanCreateObjectives } from '@/lib/roles';
import { useMobileSidebar } from '@/components/MobileSidebarContext';

const MD_MIN_WIDTH = 768;

function useIsDesktopMd() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MD_MIN_WIDTH}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isDesktop;
}

export function Sidebar() {
  const { roleForUI, userForPermissions, user: sessionUser, rolePreview } = useViewRole();
  const role = roleForUI;
  const { mobileOpen, closeMobile } = useMobileSidebar();
  const isDesktop = useIsDesktopMd();
  const [collapsed, setCollapsed] = useState(false);
  const effectiveCollapsed = collapsed && isDesktop;
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [orgTree, setOrgTree] = useState<any | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    strategic: 0,
    functional: 0,
    tactical: 0,
    keyResults: 0,
  });
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  const onNavActivate = useCallback(() => {
    if (!isDesktop) closeMobile();
  }, [isDesktop, closeMobile]);

  const mainNavigation = [
    { id: 'dashboard', name: 'Company dashboard', icon: Home, href: '/dashboard' },
    { id: 'my-okrs', name: 'My OKRs', icon: CircleUserRound, href: '/my-okrs' },
    { id: 'organization', name: 'Organization', icon: Building2, href: '/divisions' },
    { id: 'objectives', name: 'Objectives', icon: Target, href: '/okrs' },
    { id: 'analytics', name: 'Analytics', icon: BarChart3, href: '/analytics' },
  ];

  useEffect(() => {
    (async () => {
      try {
        const d = await api.getDepartments();
        setDepartments(d);
      } catch {
        setDepartments([]);
      }
    })();
  }, []);

  useEffect(() => {
    loadStats();
  }, [userForPermissions?.departmentId, departments, role]);

  useEffect(() => {
    loadOrgHierarchy();
  }, []);

  useEffect(() => {
    if (!selectedOrgId) return;
    (async () => {
      try {
        const tree = await api.getOrgTree(selectedOrgId);
        setOrgTree(tree);
        const firstDept = tree?.departments?.[0]?.id;
        if (firstDept) setExpandedDepts(new Set([firstDept]));
      } catch {
        setOrgTree(null);
      }
    })();
  }, [selectedOrgId]);

  const loadOrgHierarchy = async () => {
    try {
      const list = await api.getOrgs();
      setOrgs(list);
      setSelectedOrgId(list?.[0]?.id ?? null);
    } catch {
      setOrgs([]);
      setSelectedOrgId(null);
      setOrgTree(null);
    }
  };

  const loadStats = async () => {
    try {
      const fiscalYear = new Date().getFullYear();
      const isScoped =
        ((role === 'leader' ||
          role === 'manager' ||
          role === 'director' ||
          role === 'vp' ||
          role === 'executive' ||
          role === 'org_owner') ||
          role === 'view_only') &&
        userForPermissions?.departmentId;
      const rawDept = isScoped ? userForPermissions!.departmentId! : undefined;
      const departmentId = rawDept
        ? resolveDepartmentIdForPostgres(rawDept, departments) ?? rawDept
        : undefined;
      const data = await api.getObjectivesStats({ fiscalYear, departmentId: departmentId ?? undefined });
      setStats({
        strategic: data.strategic,
        functional: data.functional,
        tactical: data.tactical,
        keyResults: data.keyResults,
      });
    } catch {
      // Ignore errors
    }
  };

  const isActive = (href: string) => {
    if (href === '/my-okrs') {
      return pathname === '/my-okrs';
    }
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    if (href === '/okrs') {
      return pathname?.startsWith('/okrs');
    }
    if (href === '/analytics') {
      return pathname === '/analytics';
    }
    if (href === '/divisions') {
      return pathname === '/divisions';
    }
    return false;
  };

  const statsData = [
    { label: 'Strategic', value: String(stats.strategic), icon: TrendingUp, color: 'text-purple-600' },
    { label: 'Functional', value: String(stats.functional), icon: Building2, color: 'text-blue-600' },
    { label: 'Tactical', value: String(stats.tactical), icon: Calendar, color: 'text-green-600' },
    { label: 'Key Results', value: String(stats.keyResults), icon: Target, color: 'text-orange-600' },
  ];

  return (
    <div
      className={cn(
        'relative z-50 flex h-full flex-col border-r border-border bg-sidebar shadow-xl transition-transform duration-300 ease-out md:shadow-none',
        'fixed inset-y-0 left-0 w-[min(17.5rem,88vw)] md:relative md:inset-auto md:h-auto',
        mobileOpen ? 'translate-x-0' : 'max-md:-translate-x-full',
        'md:translate-x-0',
        effectiveCollapsed ? 'md:w-[72px]' : 'md:w-60'
      )}
    >
      {/* Logo / Header */}
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        {!effectiveCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Target className="h-5 w-5" />
            </div>
            <span className="font-semibold tracking-tight text-sidebar-foreground">Goals</span>
          </div>
        )}
        {effectiveCollapsed && (
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Target className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* New objective: any role unless admin disabled creation for this account */}
      {userCanCreateObjectives(sessionUser) && (
        <div className="p-3">
          <Button asChild className="w-full rounded-lg touch-manipulation" size={effectiveCollapsed ? 'icon' : 'default'}>
            <Link
              href="/okrs/new"
              aria-label="New objective"
              className={cn(effectiveCollapsed ? 'justify-center' : 'justify-start')}
              onClick={onNavActivate}
            >
              <Plus className="h-4 w-4" />
              {!effectiveCollapsed && <span className="ml-2">New objective</span>}
            </Link>
          </Button>
        </div>
      )}

      {/* Main navigation */}
      <nav className="flex-1 space-y-0.5 px-2 pt-2">
        {mainNavigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavActivate}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <Icon className="h-4.5 w-4.5 flex-shrink-0 opacity-90" />
              {!effectiveCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}

        {shouldShowUserManagementNav(sessionUser, rolePreview) && (
          <Link
            href="/admin/users"
            onClick={onNavActivate}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation',
              pathname?.startsWith('/admin/users')
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            )}
          >
            <Users className="h-4.5 w-4.5 flex-shrink-0 opacity-90" />
            {!effectiveCollapsed && <span>User management</span>}
          </Link>
        )}

        {/* Hierarchy navigation (org -> dept -> team -> user) */}
        {!effectiveCollapsed && orgs.length > 0 && (
          <div className="mt-3 rounded-lg border border-sidebar-border bg-background/40 p-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                Hierarchy
              </span>
              {orgs.length > 1 && (
                <select
                  className="h-7 rounded border bg-background px-2 text-xs"
                  value={selectedOrgId ?? ''}
                  onChange={(e) => setSelectedOrgId(e.target.value || null)}
                >
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedOrgId && (
              <Link
                href={`/okrs/scope/org/${selectedOrgId}`}
                onClick={onNavActivate}
                className={cn(
                  'block rounded-md px-2 py-1.5 text-sm font-medium touch-manipulation',
                  pathname?.startsWith(`/okrs/scope/org/${selectedOrgId}`)
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                {orgs.find((o) => o.id === selectedOrgId)?.name ?? 'Organization'}
              </Link>
            )}

            {orgTree?.departments?.length ? (
              <div className="mt-2 space-y-1">
                {orgTree.departments.map((d: any) => {
                  const isOpen = expandedDepts.has(d.id);
                  return (
                    <div key={d.id} className="rounded-md">
                      <button
                        type="button"
                        onClick={() => {
                          const next = new Set(expandedDepts);
                          if (next.has(d.id)) next.delete(d.id);
                          else next.add(d.id);
                          setExpandedDepts(next);
                        }}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      >
                        <span className="truncate">{d.displayName}</span>
                        <span className="text-xs text-sidebar-foreground/50">{isOpen ? '–' : '+'}</span>
                      </button>

                      {isOpen && (
                        <div className="ml-2 mt-1 space-y-1 border-l border-sidebar-border pl-2">
                          <Link
                            href={`/okrs/scope/department/${d.id}`}
                            onClick={onNavActivate}
                            className="block rounded px-2 py-1 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground touch-manipulation"
                          >
                            View department OKRs
                          </Link>
                          {(d.teams || []).map((t: any) => {
                            const teamOpen = expandedTeams.has(t.id);
                            return (
                              <div key={t.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = new Set(expandedTeams);
                                    if (next.has(t.id)) next.delete(t.id);
                                    else next.add(t.id);
                                    setExpandedTeams(next);
                                  }}
                                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                                >
                                  <span className="truncate">{t.displayName}</span>
                                  <span className="text-[10px] text-sidebar-foreground/50">{teamOpen ? '–' : '+'}</span>
                                </button>
                                {teamOpen && (
                                  <div className="ml-2 mt-1 space-y-1 border-l border-sidebar-border pl-2">
                                    <Link
                                      href={`/okrs/scope/team/${t.id}`}
                                      onClick={onNavActivate}
                                      className="block rounded px-2 py-1 text-[11px] text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground touch-manipulation"
                                    >
                                      View team OKRs
                                    </Link>
                                    {(t.users || []).slice(0, 8).map((u: any) => (
                                      <Link
                                        key={u.id}
                                        href={`/okrs/scope/user/${encodeURIComponent(u.id)}`}
                                        onClick={onNavActivate}
                                        className="block truncate rounded px-2 py-1 text-[11px] text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground touch-manipulation"
                                        title={u.email || u.name || u.id}
                                      >
                                        {u.name || u.email || u.id}
                                      </Link>
                                    ))}
                                    {(t.users || []).length > 8 && (
                                      <div className="px-2 py-1 text-[11px] text-sidebar-foreground/50">
                                        +{(t.users || []).length - 8} more
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 px-2 py-1 text-xs text-sidebar-foreground/50">
                No org hierarchy configured yet.
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Overview stats (hidden for view_only) */}
      {!effectiveCollapsed && role !== 'view_only' && (
        <div className="border-t border-sidebar-border p-3">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Overview
          </p>
          <div className="space-y-1.5">
            {statsData.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-3.5 w-3.5', stat.color)} />
                    <span className="text-sidebar-foreground/70">{stat.label}</span>
                  </div>
                  <span className="font-semibold tabular-nums text-sidebar-foreground">{stat.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapse Button */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 hidden h-7 w-7 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted md:flex touch-manipulation"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
