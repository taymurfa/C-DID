'use client';

import { Target, TrendingUp, Calendar, CheckCircle2, Users, Briefcase, AlertCircle } from 'lucide-react';
import { isDeptScopedLeaderRole } from '@/lib/roles';

export type DashboardRole =
  | 'view_only'
  | 'standard'
  | 'leader'
  | 'admin'
  | 'developer'
  | 'manager'
  | 'director'
  | 'vp'
  | 'executive'
  | 'org_owner'
  | undefined;

interface DashboardHeaderProps {
  totalObjectives: number;
  averageScore: number;
  onTrackPercent: number;
  daysLeftInQuarter: number;
  role?: DashboardRole;
  /** When set, used only for the User management tile (avoids role-preview “admin”). */
  accountRole?: DashboardRole;
  myObjectivesCount?: number;
  departmentStats?: { count: number; onTrackPercent: number };
  /** Reference design: 4 stat cards with colored icon boxes */
  variant?: 'default' | 'reference';
}

function StatBlock({
  label,
  value,
  subValue,
  icon: Icon,
  className = '',
  highlight = false,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${highlight ? 'border-green-200 bg-green-50/80 dark:border-green-800/50 dark:bg-green-950/30' : 'border-border bg-card'} ${className}`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${highlight ? 'bg-green-100 dark:bg-green-900/50' : 'bg-muted'}`}>
        <Icon className={highlight ? 'h-5 w-5 text-green-600 dark:text-green-400' : 'h-5 w-5 text-muted-foreground'} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold tabular-nums ${highlight ? 'text-green-700 dark:text-green-300' : ''}`}>{value}</p>
        {subValue != null && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
      </div>
    </div>
  );
}

function ReferenceStatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardHeader({
  totalObjectives,
  averageScore,
  onTrackPercent,
  daysLeftInQuarter,
  role,
  accountRole,
  myObjectivesCount,
  departmentStats,
  variant = 'default',
}: DashboardHeaderProps) {
  const showUserManagementTile =
    accountRole !== undefined ? accountRole === 'admin' : role === 'admin';
  if (variant === 'reference') {
    return (
      <div className="grid grid-cols-4 gap-4 mb-6">
        <ReferenceStatCard
          label="Total Objectives"
          value={totalObjectives}
          icon={Target}
          iconBg="bg-blue-100 dark:bg-blue-950/50"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <ReferenceStatCard
          label="Average Score"
          value={averageScore.toFixed(2)}
          icon={TrendingUp}
          iconBg="bg-green-100 dark:bg-green-950/50"
          iconColor="text-green-600 dark:text-green-400"
        />
        <ReferenceStatCard
          label="On Track"
          value={`${Math.round(onTrackPercent)}%`}
          icon={AlertCircle}
          iconBg="bg-purple-100 dark:bg-purple-950/50"
          iconColor="text-purple-600 dark:text-purple-400"
        />
        <ReferenceStatCard
          label={`Days Left in Q${Math.ceil((new Date().getMonth() + 1) / 3)}`}
          value={daysLeftInQuarter}
          icon={Calendar}
          iconBg="bg-orange-100 dark:bg-orange-950/50"
          iconColor="text-orange-600 dark:text-orange-400"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium text-muted-foreground">
          FY {new Date().getFullYear()} · Q{Math.ceil((new Date().getMonth() + 1) / 3)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {myObjectivesCount !== undefined && (
          <StatBlock
            label="My objectives"
            value={myObjectivesCount}
            icon={Briefcase}
            className="border-primary/30 bg-primary/5"
          />
        )}
        {isDeptScopedLeaderRole(role) && departmentStats && (
          <StatBlock
            label="Your department"
            value={departmentStats.count}
            subValue={`${Math.round(departmentStats.onTrackPercent)}% on track`}
            icon={Target}
            className="border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20"
          />
        )}
        <StatBlock label="Total objectives" value={totalObjectives} icon={Target} />
        <StatBlock label="Average progress" value={`${Math.round(averageScore * 100)}%`} icon={TrendingUp} />
        <StatBlock
          label="On track"
          value={`${Math.round(onTrackPercent)}%`}
          icon={CheckCircle2}
          highlight={onTrackPercent >= 70}
        />
        <StatBlock label="Days left" value={daysLeftInQuarter} icon={Calendar} />
        {showUserManagementTile && (
          <a
            href="/admin/users"
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Admin</p>
              <p className="text-sm font-semibold text-primary">User management →</p>
            </div>
          </a>
        )}
      </div>
    </div>
  );
}
