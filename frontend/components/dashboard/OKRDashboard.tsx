'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { api, Objective, KeyResult } from '@/lib/api';
import {
  type PresentationSlide,
  type ObjectiveSlide,
  type NarrativeSlide,
  type PresentationDeckStats,
} from '@/components/presentation/PresentationMode';
import { defaultFilters, type DashboardFilters } from './FilterBar';
import { useViewPreferences } from '@/lib/useViewPreferences';
import { useViewRole } from '@/lib/ViewRoleContext';
import {
  filterObjective,
  getDaysLeftInQuarter,
  getPersonalObjectiveIds,
  type DashboardViewProps,
} from './dashboardShared';
import { isDeptScopedLeaderRole, shouldShowUserManagementNav, userCanCreateObjectives } from '@/lib/roles';
import { resolveDepartmentIdForPostgres } from '@/lib/legacyDepartments';
import { FullDashboardView } from './FullDashboardView';

/** Text for presentation slides: saved leadership update, else newest KR note, else description. */
function presentationLatestSummary(objective: Objective, krs: KeyResult[]): string {
  const persisted = objective.latestUpdateSummary?.trim();
  if (persisted) return persisted.slice(0, 500);
  const noteEntries = krs.flatMap((kr) =>
    (Array.isArray(kr.notes) ? kr.notes : []).map((n) => ({
      text: (n.text ?? '').trim(),
      t: n.createdAt ? new Date(n.createdAt).getTime() : 0,
    }))
  );
  noteEntries.sort((a, b) => b.t - a.t);
  if (noteEntries[0]?.text) return noteEntries[0].text.slice(0, 500);
  const desc = (objective.description ?? '').trim();
  if (desc) return desc.slice(0, 400);
  return '';
}

export function OKRDashboard() {
  const pathname = usePathname();
  const isPersonalHome = pathname === '/my-okrs';
  const { userForPermissions, user: sessionUser, rolePreview } = useViewRole();
  const user = userForPermissions;
  const role = user?.role;
  const fiscalYear = new Date().getFullYear();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [keyResultsByObjective, setKeyResultsByObjective] = useState<Record<string, KeyResult[]>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [presentationActive, setPresentationActive] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState(0);
  const [presentationChoiceOpen, setPresentationChoiceOpen] = useState(false);
  const [presentationNarrative, setPresentationNarrative] = useState<string | null>(null);
  const { preferences, updatePreferences, resetToDefault } = useViewPreferences();
  const [exporting, setExporting] = useState(false);
  const [exportingSlides, setExportingSlides] = useState(false);
  const [departments, setDepartments] = useState<{ _id: string; name: string; color?: string }[]>([]);
  const [userNames, setUserNames] = useState<{ _id: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getDepartments().catch(() => []), api.getUserNames().catch(() => [])]).then(
      ([depts, names]) => {
        if (!cancelled) {
          setDepartments(depts);
          setUserNames(names);
        }
      }
    );
    return () => { cancelled = true; };
  }, []);

  const effectiveDepartmentId = useMemo(
    () => resolveDepartmentIdForPostgres(user?.departmentId, departments),
    [user?.departmentId, departments]
  );

  const visibilityUser = useMemo(() => {
    if (!user) return null;
    const dept = effectiveDepartmentId ?? user.departmentId;
    return { ...user, departmentId: dept };
  }, [user, effectiveDepartmentId]);

  // List all objectives for the org (no departmentId: unresolved legacy ids made Postgres return zero rows;
  // no fiscalYear: migrated FY may differ from the current calendar year).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const objs = await api.getObjectives({});
        if (cancelled) return;
        setObjectives(objs);
        const krMap: Record<string, KeyResult[]> = {};
        await Promise.all(
          objs.map(async (o) => {
            if (!o._id) return;
            try {
              const krs = await api.getKeyResults(o._id);
              if (!cancelled) krMap[o._id] = krs;
            } catch {
              // ignore
            }
          })
        );
        if (!cancelled) setKeyResultsByObjective(krMap);
      } catch (e) {
        console.error('Failed to load dashboard data', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    setLoading(true);
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const scoreByObjectiveId = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [oid, krs] of Object.entries(keyResultsByObjective)) {
      if (krs.length === 0) continue;
      const sum = krs.reduce((s, kr) => s + (kr.score ?? 0), 0);
      out[oid] = sum / krs.length;
    }
    return out;
  }, [keyResultsByObjective]);

  const personalIds = useMemo(() => {
    if (!isPersonalHome || !user?.sub) return null;
    return getPersonalObjectiveIds(objectives, keyResultsByObjective, user.sub);
  }, [isPersonalHome, user?.sub, objectives, keyResultsByObjective]);

  const scopeObjectives = useMemo(() => {
    if (!personalIds) return objectives;
    return objectives.filter((o) => o._id && personalIds.has(String(o._id)));
  }, [personalIds, objectives]);

  const filtered = useMemo(() => {
    return scopeObjectives.filter((o) => filterObjective(o, scoreByObjectiveId, filters));
  }, [scopeObjectives, scoreByObjectiveId, filters]);

  const filteredAndSorted = useMemo(() => {
    let list = [...filtered];
    const sort = preferences.dashboardSort;
    const dir = preferences.dashboardSortDirection;
    const cutoff =
      preferences.dashboardFilterUpdateType === 'recent'
        ? Date.now() - 7 * 24 * 60 * 60 * 1000
        : 0;
    if (cutoff > 0) {
      list = list.filter((o) => {
        const u = o.updatedAt ? new Date(o.updatedAt).getTime() : 0;
        return u >= cutoff;
      });
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sort === 'score') {
        const sa = a._id ? (scoreByObjectiveId[a._id] ?? 0) : 0;
        const sb = b._id ? (scoreByObjectiveId[b._id] ?? 0) : 0;
        cmp = sa - sb;
      } else if (sort === 'owner') {
        const oa = (a.ownerId ?? '').toLowerCase();
        const ob = (b.ownerId ?? '').toLowerCase();
        cmp = oa.localeCompare(ob);
      } else {
        const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        cmp = ua - ub;
      }
      return dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [
    filtered,
    preferences.dashboardSort,
    preferences.dashboardSortDirection,
    preferences.dashboardFilterUpdateType,
    scoreByObjectiveId,
  ]);

  const strategic = useMemo(
    () => filteredAndSorted.filter((o) => o.level === 'strategic' && !o.parentObjectiveId),
    [filteredAndSorted]
  );
  const divisional = useMemo(
    () => filteredAndSorted.filter((o) => o.level === 'functional'),
    [filteredAndSorted]
  );
  const tactical = useMemo(
    () => filteredAndSorted.filter((o) => o.level === 'tactical'),
    [filteredAndSorted]
  );

  const needsReviewObjectives = useMemo(() => {
    if (!isDeptScopedLeaderRole(role) || !visibilityUser?.departmentId) return [];
    const pool = isPersonalHome ? scopeObjectives : objectives;
    const ud = visibilityUser.departmentId;
    return pool.filter(
      (o) =>
        (o.status ?? 'draft') === 'in_review' &&
        (o.departmentId === ud || String(o.departmentId) === ud)
    );
  }, [objectives, scopeObjectives, isPersonalHome, role, visibilityUser?.departmentId]);

  const myObjectivesCount = useMemo(() => {
    if (!user?.sub) return 0;
    return objectives.filter((o) => o.ownerId === user.sub).length;
  }, [objectives, user?.sub]);

  const myWorkObjectives = useMemo(() => {
    if (!user?.sub) return [];
    return filteredAndSorted.filter((o) => o.ownerId === user.sub);
  }, [user?.sub, filteredAndSorted]);

  const departmentStats = useMemo(() => {
    if (!isDeptScopedLeaderRole(role) || !visibilityUser?.departmentId) return null;
    const ud = visibilityUser.departmentId;
    const dept = objectives.filter(
      (o) => o.departmentId === ud || String(o.departmentId) === ud
    );
    const withScores = dept.filter((o) => o._id && scoreByObjectiveId[o._id] !== undefined);
    const onTrack = withScores.filter(
      (o) => o._id && (scoreByObjectiveId[o._id] ?? 0) >= 0.7
    ).length;
    const onTrackPct = withScores.length > 0 ? (onTrack / withScores.length) * 100 : 0;
    return { count: dept.length, onTrackPercent: onTrackPct };
  }, [objectives, role, visibilityUser?.departmentId, scoreByObjectiveId]);

  const handleSortChange = useCallback(
    (sort: 'score' | 'owner' | 'updated', direction: 'asc' | 'desc') => {
      updatePreferences({ dashboardSort: sort, dashboardSortDirection: direction });
    },
    [updatePreferences]
  );

  const presentationSlides = useMemo<PresentationSlide[]>(() => {
    const list = [...strategic, ...divisional, ...tactical];
    const quarter = Math.ceil((new Date().getMonth() + 1) / 3);
    const year = new Date().getFullYear();
    const titleSlide: PresentationSlide = {
      type: 'title',
      title: 'OKR Presentation',
      subtitle: `Q${quarter} ${year} • Executive review • ${list.length} objective${list.length !== 1 ? 's' : ''} • AWS Postgres • RBAC • Gmail reminders`,
    };
    const agendaSlide: PresentationSlide = {
      type: 'agenda',
      title: "Today's OKRs",
      items: list.map((o) => ({ title: o.title ?? 'Untitled' })),
    };
    const narrativeSlide: NarrativeSlide | null =
      presentationNarrative?.trim() ? { type: 'narrative', content: presentationNarrative.trim() } : null;
    const baseObjectiveSlideIndex = narrativeSlide ? 3 : 2;
    const idToIndex = new Map<string, number>();
    list.forEach((obj, i) => {
      if (obj._id) idToIndex.set(String(obj._id), baseObjectiveSlideIndex + i);
    });
    const objectiveSlides: PresentationSlide[] = list.map((objective) => {
      const oid = objective._id;
      const navigation =
        oid != null
          ? {
              parentSlideIndex:
                objective.parentObjectiveId != null
                  ? idToIndex.get(String(objective.parentObjectiveId))
                  : undefined,
              childSlideIndices: [
                ...new Set(
                  list
                    .filter(
                      (c) =>
                        c.parentObjectiveId != null && String(c.parentObjectiveId) === String(oid)
                    )
                    .map((c) => (c._id ? idToIndex.get(String(c._id)) : undefined))
                    .filter((x): x is number => x !== undefined)
                ),
              ],
              upstreamSlideIndices: [
                ...new Set(
                  (objective.relatedObjectiveIds ?? [])
                    .map((rid) => idToIndex.get(String(rid)))
                    .filter((x): x is number => x !== undefined)
                ),
              ],
              downstreamSlideIndices: [
                ...new Set(
                  list
                    .filter((c) =>
                      (c.relatedObjectiveIds ?? []).some((r) => String(r) === String(oid))
                    )
                    .map((c) => (c._id ? idToIndex.get(String(c._id)) : undefined))
                    .filter((x): x is number => x !== undefined)
                ),
              ],
            }
          : undefined;
      const krs = oid ? (keyResultsByObjective[oid] ?? []) : [];
      return {
        type: 'objective' as const,
        objective,
        score: oid ? (scoreByObjectiveId[oid] ?? null) : null,
        keyResults: krs,
        latestUpdateSummary: presentationLatestSummary(objective, krs),
        navigation,
      };
    });
    return narrativeSlide
      ? [titleSlide, agendaSlide, narrativeSlide, ...objectiveSlides]
      : [titleSlide, agendaSlide, ...objectiveSlides];
  }, [strategic, divisional, tactical, scoreByObjectiveId, keyResultsByObjective, presentationNarrative]);

  const presentationDeckStats = useMemo((): PresentationDeckStats | null => {
    const list = [...strategic, ...divisional, ...tactical];
    if (list.length === 0) return null;
    const scores = list
      .map((o) => (o._id ? scoreByObjectiveId[o._id] : undefined))
      .filter((s): s is number => s !== undefined);
    const portfolioAvgCompletionPct =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)
        : 0;
    let krsTotal = 0;
    let krsAtTarget = 0;
    let krsUpdated7d = 0;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const o of list) {
      if (!o._id) continue;
      const krs = keyResultsByObjective[o._id] ?? [];
      for (const kr of krs) {
        krsTotal++;
        const sc = kr.score ?? 0;
        if (sc >= 0.999) krsAtTarget++;
        const lu = kr.lastUpdatedAt ? new Date(kr.lastUpdatedAt).getTime() : 0;
        if (lu >= weekAgo) krsUpdated7d++;
      }
    }
    const krsAtTargetPct = krsTotal > 0 ? Math.round((krsAtTarget / krsTotal) * 100) : 0;
    const weeklyTouchVelocityPct =
      krsTotal > 0 ? Math.round((krsUpdated7d / krsTotal) * 100) : 0;
    return {
      daysLeftInQuarter: getDaysLeftInQuarter(),
      portfolioAvgCompletionPct,
      krsAtTargetPct,
      krsUpdatedThisWeek: krsUpdated7d,
      krsTotal,
      weeklyTouchVelocityPct,
    };
  }, [strategic, divisional, tactical, scoreByObjectiveId, keyResultsByObjective]);

  const handleExport = useCallback(
    async (format: 'json' | 'xlsx' | 'pdf') => {
      setExporting(true);
      try {
        await api.exportObjectivesDownload({
          format,
          fiscalYear,
          level: filters.tier !== 'all' ? filters.tier : undefined,
          division: filters.division !== 'all' ? filters.division : undefined,
          status: filters.status !== 'all' ? filters.status : undefined,
          tree: format === 'json',
        });
      } catch (e) {
        console.error('Export failed', e);
        alert(e instanceof Error ? e.message : 'Export failed');
      } finally {
        setExporting(false);
      }
    },
    [fiscalYear, filters]
  );

  const handleExportGoogleSlides = useCallback(async () => {
    const ids = filteredAndSorted.map((o) => o._id).filter(Boolean) as string[];
    if (ids.length === 0) {
      alert('No objectives to export.');
      return;
    }
    setExportingSlides(true);
    try {
      const result = await api.exportToGoogleSlides({ objectiveIds: ids });
      if (result?.link) window.open(result.link, '_blank');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed';
      if (msg.includes('not connected') || msg.includes('not configured')) {
        alert('Connect your Google account in Settings first.');
        window.location.href = '/profile';
      } else {
        alert(msg);
      }
    } finally {
      setExportingSlides(false);
    }
  }, [filteredAndSorted]);

  const objectiveIdsFromPresentation = useMemo(() => {
    return presentationSlides.filter((s): s is ObjectiveSlide => s.type === 'objective').map((s) => s.objective._id).filter(Boolean) as string[];
  }, [presentationSlides]);

  const handleOpenPresentationChoice = useCallback(() => {
    setPresentationIndex(0);
    setPresentationChoiceOpen(true);
  }, []);

  const handlePresentationInfoOnly = useCallback(() => {
    setPresentationNarrative(null);
    setPresentationIndex(0);
    setPresentationActive(true);
    setPresentationChoiceOpen(false);
  }, []);

  const handleStartWithNarrative = useCallback((story: string) => {
    setPresentationNarrative(story);
    setPresentationIndex(0);
    setPresentationActive(true);
    setPresentationChoiceOpen(false);
  }, []);

  const generatePresentationStory = useCallback(async () => {
    const { api } = await import('@/lib/api');
    const res = await api.generatePresentationStory(objectiveIdsFromPresentation);
    return res.story ?? '';
  }, [objectiveIdsFromPresentation]);

  const handleExportPresentationPowerPoint = useCallback(async () => {
    if (objectiveIdsFromPresentation.length === 0) return;
    try {
      await api.exportToPowerPoint(objectiveIdsFromPresentation, presentationNarrative);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PowerPoint export failed');
    }
  }, [objectiveIdsFromPresentation, presentationNarrative]);

  const handleExportPresentationGoogleSlides = useCallback(async () => {
    if (objectiveIdsFromPresentation.length === 0) return;
    try {
      const result = await api.exportToGoogleSlides({ objectiveIds: objectiveIdsFromPresentation });
      if (result?.link) window.open(result.link, '_blank');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed';
      if (msg.includes('not connected') || msg.includes('not configured')) {
        alert('Connect your Google account in Settings first.');
        window.location.href = '/profile';
      } else {
        alert(msg);
      }
    }
  }, [objectiveIdsFromPresentation]);

  const displayObjectives = useMemo(
    () => (isPersonalHome ? scopeObjectives : objectives),
    [isPersonalHome, scopeObjectives, objectives]
  );

  const divisions = useMemo(() => {
    const set = new Set<string>();
    displayObjectives.forEach((o) => {
      if (o.division) set.add(o.division);
    });
    return Array.from(set).sort();
  }, [displayObjectives]);

  const stats = useMemo(() => {
    const total = displayObjectives.length;
    const allScores = displayObjectives
      .map((o) => (o._id ? scoreByObjectiveId[o._id] : undefined))
      .filter((s): s is number => s !== undefined);
    const avg =
      allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
    const onTrackCount = allScores.filter((s) => s >= 0.7).length;
    const onTrackPct = allScores.length > 0 ? (onTrackCount / allScores.length) * 100 : 0;
    return {
      totalObjectives: total,
      averageScore: avg,
      onTrackPercent: onTrackPct,
      daysLeftInQuarter: getDaysLeftInQuarter(),
    };
  }, [displayObjectives, scoreByObjectiveId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  const viewPreferences: DashboardViewProps['viewPreferences'] =
    role === 'view_only'
      ? undefined
      : {
          sort: preferences.dashboardSort,
          sortDirection: preferences.dashboardSortDirection,
          onSortChange: handleSortChange,
          filterUpdateType: preferences.dashboardFilterUpdateType,
          onFilterUpdateTypeChange: (v) => updatePreferences({ dashboardFilterUpdateType: v }),
          onResetToDefault: resetToDefault,
        };

  const baseProps: DashboardViewProps = {
    role: role as DashboardViewProps['role'],
    objectives: displayObjectives,
    strategic,
    divisional,
    tactical,
    filteredAndSorted,
    scoreByObjectiveId,
    keyResultsByObjective,
    stats,
    filters,
    setFilters,
    divisions,
    departments,
    userNames,
    presentationSlides,
    presentationDeckStats,
    presentationActive,
    setPresentationActive,
    presentationIndex,
    setPresentationIndex,
    presentationChoiceOpen,
    onClosePresentationChoice: () => setPresentationChoiceOpen(false),
    onSelectInfoOnly: handlePresentationInfoOnly,
    onStartWithNarrative: handleStartWithNarrative,
    generatePresentationStory,
    presentationNarrative,
    setPresentationNarrative,
    needsReviewObjectives: isDeptScopedLeaderRole(role) ? needsReviewObjectives : undefined,
    myObjectivesCount,
    myWorkObjectives,
    departmentStats: departmentStats ?? undefined,
    viewPreferences,
    onExport: role !== 'view_only' ? handleExport : undefined,
    onExportGoogleSlides: role !== 'view_only' ? handleExportGoogleSlides : undefined,
    onExportPresentationPowerPoint: role !== 'view_only' ? handleExportPresentationPowerPoint : undefined,
    onExportPresentationGoogleSlides: role !== 'view_only' ? handleExportPresentationGoogleSlides : undefined,
    onPresentationMode: handleOpenPresentationChoice,
    exporting,
    exportingSlides,
    currentUserName: user?.name ?? user?.email ?? 'User',
    dashboardTitle: isPersonalHome ? 'My OKRs' : undefined,
    dashboardSubtitle: isPersonalHome
      ? 'Objectives you own or contribute to, plus roll-up in the hierarchy'
      : undefined,
    hideEmptyStateCreate: isPersonalHome && !userCanCreateObjectives(sessionUser),
    showAdminUserManagement: shouldShowUserManagementNav(sessionUser, rolePreview),
  };

  // Use admin (FullDashboardView) layout for all roles so design is consistent; filtering handles role-specific data.
  return <FullDashboardView {...baseProps} />;
}
