'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OverviewTab } from './tabs/OverviewTab';
import { ProgressTab } from './tabs/ProgressTab';
import { UpdatesTab } from './tabs/UpdatesTab';
import { HistoryTab } from './tabs/HistoryTab';
import { DependenciesTab } from './tabs/DependenciesTab';
import { FilesTab } from './tabs/FilesTab';
import { useViewPreferences } from '@/lib/useViewPreferences';
import { getOKRPermissions, type OKRPermissions } from '@/lib/permissions';
import type { User } from '@/lib/auth';
import type { Objective, KeyResult } from '@/lib/api';

const TAB_IDS = ['overview', 'progress', 'updates', 'history', 'dependencies', 'files'] as const;
const TAB_LABELS: Record<(typeof TAB_IDS)[number], string> = {
  overview: 'Overview',
  progress: 'Progress',
  updates: 'Updates',
  history: 'History',
  dependencies: 'Dependencies',
  files: 'Files',
};

interface OKRDetailViewProps {
  objective: Objective;
  keyResults: KeyResult[];
  onObjectiveUpdate: (updated: Objective) => void;
  onKeyResultsUpdate?: () => void;
  /** Current user (for permission gating). */
  user?: User | null;
  /** effectiveRole from ViewRoleContext (view_only vs developer) for read-only override. */
  effectiveRole?: string;
  /** Number of current viewers (for presence). Show "N others viewing" when > 1. */
  viewerCount?: number;
  /** When set (e.g. from ?tab=progress), open this tab on mount. */
  initialTab?: (typeof TAB_IDS)[number];
  /** Raw `tab` query value on `/okrs/[id]` — keeps detail in sync with the URL (durable deep links). */
  urlTab?: string | null;
  /** Persist active tab to the URL (e.g. router.replace with ?tab=). */
  onPersistTabToUrl?: (tab: (typeof TAB_IDS)[number]) => void;
}

export function OKRDetailView({
  objective,
  keyResults,
  onObjectiveUpdate,
  onKeyResultsUpdate,
  user,
  effectiveRole,
  viewerCount,
  initialTab: initialTabProp,
  urlTab,
  onPersistTabToUrl,
}: OKRDetailViewProps) {
  const isViewOnly = effectiveRole === 'view_only';
  const permissions: OKRPermissions = getOKRPermissions(user ?? null, objective, keyResults);
  const { preferences, updatePreferences } = useViewPreferences();
  const visibleTabIdsRaw = TAB_IDS.filter((id) => preferences.visibleTabs[id] !== false);
  // If prefs are corrupted or all hidden, fall back so the modal always works
  const visibleTabIds =
    visibleTabIdsRaw.length > 0 ? visibleTabIdsRaw : (['overview'] as (typeof TAB_IDS)[number][]);
  const defaultTab = visibleTabIds.includes(preferences.lastDetailTab as (typeof TAB_IDS)[number])
    ? preferences.lastDetailTab
    : visibleTabIds[0] ?? 'overview';
  const urlTabValid =
    urlTab &&
    (TAB_IDS as readonly string[]).includes(urlTab) &&
    visibleTabIds.includes(urlTab as (typeof TAB_IDS)[number])
      ? (urlTab as (typeof TAB_IDS)[number])
      : null;
  const tabToUse =
    urlTabValid ??
    (initialTabProp && visibleTabIds.includes(initialTabProp) ? initialTabProp : defaultTab);
  const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(tabToUse as (typeof TAB_IDS)[number]);
  const touchStartX = useRef<number | null>(null);

  // Browser back/forward: follow ?tab=
  useEffect(() => {
    if (urlTabValid) setActiveTab(urlTabValid);
  }, [urlTabValid]);

  // When visible tabs change and current tab is hidden, switch to first visible
  useEffect(() => {
    if (visibleTabIds.length && !visibleTabIds.includes(activeTab)) {
      const next = (visibleTabIds[0] ?? 'overview') as (typeof TAB_IDS)[number];
      setActiveTab(next);
      onPersistTabToUrl?.(next);
    }
  }, [visibleTabIds.join(','), activeTab, onPersistTabToUrl]);

  // Restore last-selected tab from preferences when they first load (run once when defaultTab becomes available). Skip when URL or initial tab is provided.
  const appliedDefaultRef = useRef(false);
  useEffect(() => {
    if (urlTabValid || initialTabProp) return;
    if (appliedDefaultRef.current || !defaultTab || !visibleTabIds.includes(defaultTab as (typeof TAB_IDS)[number])) return;
    appliedDefaultRef.current = true;
    setActiveTab(defaultTab as (typeof TAB_IDS)[number]);
  }, [defaultTab, visibleTabIds, initialTabProp, urlTabValid]);

  const persistTab = useCallback(
    (tab: (typeof TAB_IDS)[number]) => {
      setActiveTab(tab);
      updatePreferences({ lastDetailTab: tab });
      onPersistTabToUrl?.(tab);
    },
    [updatePreferences, onPersistTabToUrl]
  );

  // Keyboard shortcuts Alt+1–6 for tabs
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key >= '1' && e.key <= '6') {
        const index = parseInt(e.key, 10) - 1;
        if (visibleTabIds[index]) {
          e.preventDefault();
          const tab = visibleTabIds[index];
          persistTab(tab);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visibleTabIds, persistTab]);

  const handleTabChange = useCallback(
    (value: string) => {
      const tab = value as (typeof TAB_IDS)[number];
      persistTab(tab);
    },
    [persistTab]
  );

  const goToTab = useCallback(
    (dir: 1 | -1) => {
      setActiveTab((current) => {
        const idx = visibleTabIds.indexOf(current);
        const next = Math.max(0, Math.min(visibleTabIds.length - 1, idx + dir));
        const nextTab = visibleTabIds[next];
        if (nextTab) {
          updatePreferences({ lastDetailTab: nextTab });
          onPersistTabToUrl?.(nextTab);
        }
        return nextTab ?? current;
      });
    },
    [visibleTabIds, updatePreferences, onPersistTabToUrl]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current == null) return;
      const endX = e.changedTouches[0].clientX;
      const delta = touchStartX.current - endX;
      touchStartX.current = null;
      const threshold = 50;
      if (delta > threshold) goToTab(1);
      else if (delta < -threshold) goToTab(-1);
    },
    [goToTab]
  );

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Mobile: dropdown tab selector (44px touch target) */}
        <div className="md:hidden mb-3 flex-1 min-w-0">
          <Select value={activeTab} onValueChange={handleTabChange}>
            <SelectTrigger className="w-full min-h-[44px] text-base" aria-label="Select tab">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibleTabIds.map((id) => (
                <SelectItem key={id} value={id} className="min-h-[44px] flex items-center">
                  {TAB_LABELS[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Desktop: horizontal tabs */}
        <TabsList className="hidden md:flex flex-wrap h-auto gap-1 min-h-[44px] [&>button]:min-h-[44px] [&>button]:px-3 flex-1">
          {visibleTabIds.map((id, index) => (
            <TabsTrigger
              key={id}
              value={id}
              className="min-h-[44px]"
              title={`${TAB_LABELS[id]} (Alt+${index + 1})`}
            >
              {TAB_LABELS[id]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* Swipeable content area for mobile */}
      <div
        className="mt-4 touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'pan-y' }}
      >
        {visibleTabIds.includes('overview') && (
          <TabsContent value="overview" className="mt-0">
            <OverviewTab
              objective={objective}
              keyResults={keyResults}
              onObjectiveUpdate={onObjectiveUpdate}
              readOnly={isViewOnly || !permissions.canEditObjective}
            />
          </TabsContent>
        )}
        {visibleTabIds.includes('progress') && (
          <TabsContent value="progress" className="mt-0">
            <ProgressTab
              objective={objective}
              keyResults={keyResults}
              onKeyResultsUpdate={onKeyResultsUpdate}
              readOnly={isViewOnly}
              canEditKr={permissions.canEditKr}
            />
          </TabsContent>
        )}
        {visibleTabIds.includes('updates') && (
          <TabsContent value="updates" className="mt-0">
            <UpdatesTab
              objective={objective}
              readOnly={isViewOnly}
              refreshIntervalMs={activeTab === 'updates' ? 35000 : 0}
            />
          </TabsContent>
        )}
        {visibleTabIds.includes('history') && (
          <TabsContent value="history" className="mt-0">
            <HistoryTab
            objective={objective}
            eventTypeFilter={preferences.historyEventTypeFilter}
            onEventTypeFilterChange={(v) => updatePreferences({ historyEventTypeFilter: v })}
          />
          </TabsContent>
        )}
        {visibleTabIds.includes('dependencies') && (
          <TabsContent value="dependencies" className="mt-0">
            <DependenciesTab
              objective={objective}
              onObjectiveUpdate={onObjectiveUpdate}
              readOnly={isViewOnly || !permissions.canEditObjective}
            />
          </TabsContent>
        )}
        {visibleTabIds.includes('files') && (
          <TabsContent value="files" className="mt-0">
            <FilesTab
              objective={objective}
              keyResults={keyResults}
              readOnly={isViewOnly || !permissions.canEditObjective}
            />
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
}
