import type { Objective, KeyResult } from '@/lib/api';
import type { DashboardFilters } from './FilterBar';
import type { DashboardRole } from './DashboardHeader';
import type { PresentationSlide, PresentationDeckStats } from '@/components/presentation/PresentationMode';

/**
 * Objectives tied to the signed-in user: owned, key-result contributor, plus roll-up/down the parent/child chain.
 */
export function getPersonalObjectiveIds(
  objectives: Objective[],
  keyResultsByObjective: Record<string, KeyResult[]>,
  userId: string
): Set<string> {
  const ids = new Set<string>();
  const byId = new Map<string, Objective>();
  for (const o of objectives) {
    if (o._id) byId.set(String(o._id), o);
  }
  const norm = (s: string | undefined | null) => (s == null ? '' : String(s));

  for (const o of objectives) {
    if (!o._id) continue;
    const oid = String(o._id);
    if (norm(o.ownerId) === userId) ids.add(oid);
    const krs = keyResultsByObjective[o._id] ?? [];
    if (krs.some((kr) => norm(kr.ownerId) === userId)) ids.add(oid);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...ids]) {
      const o = byId.get(id);
      const p = o?.parentObjectiveId;
      if (p != null && p !== '' && !ids.has(String(p))) {
        ids.add(String(p));
        changed = true;
      }
    }
  }
  changed = true;
  while (changed) {
    changed = false;
    for (const o of objectives) {
      if (!o._id) continue;
      const oid = String(o._id);
      const pid = o.parentObjectiveId;
      if (pid != null && pid !== '' && ids.has(String(pid)) && !ids.has(oid)) {
        ids.add(oid);
        changed = true;
      }
    }
  }
  return ids;
}

export function getDaysLeftInQuarter(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const q = Math.floor(month / 3) + 1;
  const quarterEnd = new Date(year, q * 3, 0);
  const diff = quarterEnd.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function filterObjective(
  obj: Objective,
  scoreMap: Record<string, number>,
  filters: DashboardFilters
): boolean {
  if (filters.search) {
    const q = filters.search.toLowerCase();
    if (
      !obj.title?.toLowerCase().includes(q) &&
      !obj.description?.toLowerCase().includes(q) &&
      !obj.division?.toLowerCase().includes(q)
    ) {
      return false;
    }
  }
  if (filters.tier !== 'all' && obj.level !== filters.tier) return false;
  if (filters.division !== 'all' && obj.division !== filters.division && obj.departmentId !== filters.division) return false;
  if (filters.owner.trim()) {
    const ownerQ = filters.owner.toLowerCase().trim();
    const ownerId = (obj.ownerId ?? '').toLowerCase();
    if (!ownerId || !ownerId.includes(ownerQ)) return false;
  }
  if (filters.status !== 'all' && (obj.status ?? 'draft') !== filters.status) return false;
  if (filters.scoreRange !== 'all' && obj._id) {
    const s = scoreMap[obj._id] ?? 0;
    if (filters.scoreRange === 'on_track' && s < 0.7) return false;
    if (filters.scoreRange === 'at_risk' && (s < 0.4 || s >= 0.7)) return false;
    if (filters.scoreRange === 'off_track' && s >= 0.4) return false;
  }
  return true;
}

export interface DashboardStats {
  totalObjectives: number;
  averageScore: number;
  onTrackPercent: number;
  daysLeftInQuarter: number;
}

export interface DepartmentInfo {
  _id: string;
  name: string;
  color?: string;
}

export interface UserNameInfo {
  _id: string;
  name: string;
}

export interface DashboardViewProps {
  role: DashboardRole;
  objectives: Objective[];
  strategic: Objective[];
  divisional: Objective[];
  tactical: Objective[];
  filteredAndSorted: Objective[];
  scoreByObjectiveId: Record<string, number>;
  keyResultsByObjective?: Record<string, { _id?: string }[]>;
  stats: DashboardStats;
  filters: DashboardFilters;
  setFilters: (f: DashboardFilters) => void;
  divisions: string[];
  departments?: DepartmentInfo[];
  userNames?: UserNameInfo[];
  presentationSlides: PresentationSlide[];
  /** Metrics strip in presentation mode (portfolio completion, days left, velocity). */
  presentationDeckStats?: PresentationDeckStats | null;
  presentationActive: boolean;
  setPresentationActive: (v: boolean) => void;
  presentationIndex: number;
  setPresentationIndex: (value: number | ((prev: number) => number)) => void;
  /** When true, show the presentation choice popout (info only vs AI story). */
  presentationChoiceOpen?: boolean;
  onClosePresentationChoice?: () => void;
  onSelectInfoOnly?: () => void;
  onStartWithNarrative?: (story: string) => void;
  generatePresentationStory?: () => Promise<string>;
  /** AI-generated narrative for presentation (when user chose "Generate with AI"). */
  presentationNarrative?: string | null;
  setPresentationNarrative?: (v: string | null) => void;
  /** Leader: objectives in_review in user's department */
  needsReviewObjectives?: Objective[];
  /** Standard: count of objectives owned by user */
  myObjectivesCount?: number;
  /** Standard: filtered objectives owned by user */
  myWorkObjectives?: Objective[];
  /** Leader: department count and on-track % */
  departmentStats?: { count: number; onTrackPercent: number };
  /** Full views only: sort/preferences and export */
  viewPreferences?: {
    sort: 'score' | 'owner' | 'updated';
    sortDirection: 'asc' | 'desc';
    onSortChange: (sort: 'score' | 'owner' | 'updated', direction: 'asc' | 'desc') => void;
    filterUpdateType: string;
    onFilterUpdateTypeChange: (value: string) => void;
    onResetToDefault: () => void;
  };
  onExport?: (format: 'json' | 'xlsx' | 'pdf') => Promise<void>;
  onExportGoogleSlides?: () => Promise<void>;
  /** Export current presentation (story slides) to PowerPoint. */
  onExportPresentationPowerPoint?: () => Promise<void>;
  /** Export current presentation to Google Slides. */
  onExportPresentationGoogleSlides?: () => Promise<void>;
  /** When user clicks Presentation in export menu, call this (e.g. open choice dialog). */
  onPresentationMode?: () => void;
  exporting?: boolean;
  exportingSlides?: boolean;
  /** Current user display name for reference-style header */
  currentUserName?: string;
  /** Override default "OKR Dashboard" title (e.g. My OKRs). */
  dashboardTitle?: string;
  /** Optional second line under the title. */
  dashboardSubtitle?: string;
  /** When true, empty state does not offer "Create objective" (viewers / personal scope with no items). */
  hideEmptyStateCreate?: boolean;
  /** True only when the signed-in account is admin (not role preview). Drives User management links. */
  showAdminUserManagement?: boolean;
}
