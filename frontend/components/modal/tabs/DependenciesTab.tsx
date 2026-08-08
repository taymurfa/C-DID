'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusPill } from '@/components/shared/StatusPill';
import { ScoreRing, getScoreBarColorHex, getScoreStatusLabel } from '@/components/shared/ScoreRing';
import { api, type Objective } from '@/lib/api';
import { Link2, Trash2, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/components/ui/utils';

interface DependenciesTabProps {
  objective: Objective;
  onObjectiveUpdate?: (updated: Objective) => void;
  readOnly?: boolean;
}

const POLL_MS = 45_000;

type Direction = 'upstream' | 'downstream';

function riskFromDependency(dep: Objective): 'off' | 'at_risk' | 'ok' | 'unknown' {
  if (dep.status === 'rejected') return 'off';
  const s = dep.averageScore;
  if (s != null && s < 0.4) return 'off';
  if (s != null && s < 0.7) return 'at_risk';
  const lh = dep.linkHealth;
  if (lh != null && lh < 0.4) return 'off';
  if (lh != null && lh < 0.7) return 'at_risk';
  if (s == null && lh == null) return 'unknown';
  return 'ok';
}

function riskBorderClass(risk: ReturnType<typeof riskFromDependency>): string {
  switch (risk) {
    case 'off':
      return 'border-l-4 border-l-red-500 bg-red-500/5';
    case 'at_risk':
      return 'border-l-4 border-l-amber-500 bg-amber-500/5';
    default:
      return 'border-l-4 border-l-transparent';
  }
}

function riskBadge(risk: ReturnType<typeof riskFromDependency>): string | null {
  if (risk === 'off') return 'Off track';
  if (risk === 'at_risk') return 'At risk';
  return null;
}

export function DependenciesTab({
  objective,
  onObjectiveUpdate,
  readOnly,
}: DependenciesTabProps) {
  const objectiveId = objective._id;
  const [upstream, setUpstream] = useState<Objective[]>([]);
  const [downstream, setDownstream] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [candidates, setCandidates] = useState<Objective[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [userNames, setUserNames] = useState<{ _id: string; name: string }[]>([]);
  const fiscalYear = objective.fiscalYear ?? new Date().getFullYear();
  const healthDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    api.getDepartments().then(setDepartments).catch(() => {});
    api.getUserNames().then(setUserNames).catch(() => {});
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!objectiveId) return;
    if (opts?.silent) setRefreshing(true);
    else setLoading(true);
    try {
      const { upstream: u, downstream: d } = await api.getDependencies(objectiveId);
      setUpstream(u);
      setDownstream(d);
    } catch (e) {
      console.error(e);
      if (!opts?.silent) toast.error('Could not load dependencies');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [objectiveId]);

  const relatedKey = (objective.relatedObjectiveIds ?? []).join(',');

  useEffect(() => {
    load();
  }, [load, relatedKey]);

  useEffect(() => {
    if (!objectiveId) return;
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        load({ silent: true });
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [objectiveId, load]);

  const deptById = Object.fromEntries(departments.map((d) => [d._id, d.name]));
  const nameByUserId = Object.fromEntries(userNames.map((u) => [u._id, u.name]));

  const ownerLabel = (ownerId?: string | null) => {
    if (!ownerId) return '—';
    return nameByUserId[ownerId] || ownerId;
  };

  const loadCandidates = async () => {
    try {
      const all = await api.getObjectives({ fiscalYear });
      const currentIds = new Set(
        [objectiveId, ...(objective.relatedObjectiveIds ?? []), ...upstream.map((o) => o._id)].filter(Boolean)
      );
      setCandidates(all.filter((o) => o._id && !currentIds.has(o._id)));
    } catch (e) {
      console.error(e);
      toast.error('Could not load objectives to link');
    }
  };

  const handleAddLink = async (id: string) => {
    if (!objectiveId || readOnly) return;
    const current = objective.relatedObjectiveIds ?? [];
    if (current.includes(id)) return;
    try {
      const updated = await api.updateObjective(objectiveId, {
        relatedObjectiveIds: [...current, id],
      });
      onObjectiveUpdate?.(updated);
      await load();
      setSearchOpen(false);
      toast.success('Dependency linked');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not link');
    }
  };

  const handleRemoveUpstreamLink = async (upstreamId: string) => {
    if (!objectiveId || readOnly) return;
    const current = objective.relatedObjectiveIds ?? [];
    try {
      const updated = await api.updateObjective(objectiveId, {
        relatedObjectiveIds: current.filter((x) => x !== upstreamId),
      });
      onObjectiveUpdate?.(updated);
      await load();
      toast.success('Link removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove link');
    }
  };

  const handleRemoveDownstreamLink = async (childObjectiveId: string) => {
    if (!objectiveId || readOnly) return;
    try {
      const raw = await api.getObjective(childObjectiveId);
      if (raw && typeof raw === 'object' && 'unchanged' in raw && raw.unchanged) {
        toast.error('Could not load linked objective');
        return;
      }
      const child = raw as Objective;
      const next = (child.relatedObjectiveIds ?? []).filter((x) => x !== objectiveId);
      await api.updateObjective(childObjectiveId, { relatedObjectiveIds: next });
      await load();
      toast.success('Downstream link removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove downstream link');
    }
  };

  const scheduleHealthSave = (ownerObjectiveId: string, relatedObjectiveId: string, score: number) => {
    const key = `${ownerObjectiveId}:${relatedObjectiveId}`;
    if (healthDebounceRef.current[key]) clearTimeout(healthDebounceRef.current[key]);
    healthDebounceRef.current[key] = setTimeout(async () => {
      try {
        const updated = await api.patchDependencyHealth(ownerObjectiveId, relatedObjectiveId, score);
        if (ownerObjectiveId === objectiveId) {
          onObjectiveUpdate?.(updated);
        }
        await load({ silent: true });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save dependency score');
      } finally {
        delete healthDebounceRef.current[key];
      }
    }, 500);
  };

  const clearHealthRating = async (ownerObjectiveId: string, relatedObjectiveId: string) => {
    try {
      const updated = await api.patchDependencyHealth(ownerObjectiveId, relatedObjectiveId, null);
      if (ownerObjectiveId === objectiveId) {
        onObjectiveUpdate?.(updated);
      }
      await load({ silent: true });
      toast.success('Rating cleared');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not clear rating');
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredCandidates = q
    ? candidates.filter((o) => {
        const deptName = (o.departmentId && deptById[o.departmentId]) || '';
        const ownerN = ownerLabel(o.ownerId).toLowerCase();
        return (
          (o.title ?? '').toLowerCase().includes(q) ||
          (o.division ?? '').toLowerCase().includes(q) ||
          deptName.toLowerCase().includes(q) ||
          ownerN.includes(q) ||
          (o.level ?? '').toLowerCase().includes(q)
        );
      })
    : candidates;

  const DepCard = ({ dep, direction }: { dep: Objective; direction: Direction }) => {
    const score = dep.averageScore ?? null;
    const progressPct = score != null ? Math.round(Math.min(1, Math.max(0, score)) * 100) : 0;
    const risk = riskFromDependency(dep);
    const badge = riskBadge(risk);
    const ownerOid = direction === 'upstream' ? objectiveId! : dep._id!;
    const relatedOid = direction === 'upstream' ? dep._id! : objectiveId!;
    const sliderValue = dep.linkHealth ?? 0.5;
    const showHealthSlider = !readOnly && ownerOid && relatedOid;
    const showHealthReadOnly = readOnly && dep.linkHealth != null && dep.linkHealth !== undefined;

    return (
      <Card className={cn('overflow-hidden', riskBorderClass(risk))}>
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <ScoreRing score={score} size={32} strokeWidth={3} />
                {dep._id && (
                  <a href={`/okrs/${dep._id}`} className="font-medium truncate hover:underline text-foreground">
                    {dep.title}
                  </a>
                )}
                {!dep._id && <span className="font-medium truncate">{dep.title}</span>}
                {badge && (
                  <span
                    className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
                      risk === 'off' ? 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                    )}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                <span>
                  <span className="font-medium text-foreground/80">Owner: </span>
                  {ownerLabel(dep.ownerId)}
                </span>
                <span>
                  <span className="font-medium text-foreground/80">Department: </span>
                  {dep.departmentId ? deptById[dep.departmentId] ?? dep.departmentId : '—'}
                </span>
                {dep.division && (
                  <span>
                    <span className="font-medium text-foreground/80">Division: </span>
                    {dep.division}
                  </span>
                )}
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground/80">Status: </span>
                  <StatusPill status={dep.status ?? 'draft'} />
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>OKR progress (from key results)</span>
                  <span>
                    {score != null ? (
                      <>
                        {progressPct}% · {getScoreStatusLabel(score)}
                      </>
                    ) : (
                      'No score yet'
                    )}
                  </span>
                </div>
                {score != null && (
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progressPct}%`,
                        backgroundColor: getScoreBarColorHex(score),
                      }}
                    />
                  </div>
                )}
              </div>
              {showHealthReadOnly && (
                <p className="text-sm pt-1 border-t border-border/60">
                  <span className="font-medium text-foreground">Dependency score: </span>
                  {dep.linkHealth!.toFixed(1)} / 1.0
                </p>
              )}
              {showHealthSlider && (
                <div className="space-y-2 pt-1 border-t border-border/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-sm font-medium text-foreground">
                      Your dependency score (0–1, step 0.1)
                    </Label>
                    {dep.linkHealth != null && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground"
                        onClick={() => clearHealthRating(ownerOid, relatedOid)}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {direction === 'upstream'
                      ? 'How healthy is this upstream OKR for your delivery?'
                      : 'This rating lives on the downstream OKR (you can edit if you own it).'}
                  </p>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full h-2 accent-primary cursor-pointer disabled:opacity-50"
                    disabled={readOnly}
                    value={sliderValue}
                    aria-valuemin={0}
                    aria-valuemax={1}
                    aria-valuenow={sliderValue}
                    aria-label={`Dependency score for ${dep.title}`}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      scheduleHealthSave(ownerOid, relatedOid, v);
                    }}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0</span>
                    <span className="font-medium text-foreground">{sliderValue.toFixed(1)}</span>
                    <span>1</span>
                  </div>
                </div>
              )}
            </div>
            {!readOnly && dep._id && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive min-h-[44px] min-w-[44px] touch-manipulation shrink-0 self-start"
                onClick={() =>
                  direction === 'upstream' ? handleRemoveUpstreamLink(dep._id!) : handleRemoveDownstreamLink(dep._id!)
                }
                aria-label={direction === 'upstream' ? 'Remove upstream link' : 'Remove downstream link'}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Dependencies</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Upstream: OKRs this objective relates to. Downstream: OKRs that list this one as a dependency. Data
              refreshes automatically every {POLL_MS / 1000}s while this tab is open.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px] shrink-0 touch-manipulation"
            disabled={loading || refreshing}
            onClick={() => load({ silent: true })}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} aria-hidden />
            Refresh now
          </Button>
        </CardHeader>
        <CardContent>
          {!readOnly && (
            <div className="mb-4">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] touch-manipulation"
                onClick={() => {
                  const next = !searchOpen;
                  setSearchOpen(next);
                  if (next) loadCandidates();
                }}
              >
                <Link2 className="h-4 w-4 mr-2" aria-hidden />
                Find and link OKR
              </Button>
              {searchOpen && (
                <div className="mt-3 p-3 border rounded-lg space-y-2 max-h-72 overflow-auto" role="search">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      placeholder="Search by title, division, department, owner, or level…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                      aria-label="Search objectives to link"
                    />
                  </div>
                  {filteredCandidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No matching objectives to link.</p>
                  ) : (
                    <ul className="space-y-1 list-none p-0 m-0">
                      {filteredCandidates.slice(0, 50).map((o) => (
                        <li key={o._id}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-left min-h-[44px] touch-manipulation h-auto py-2"
                            onClick={() => o._id && handleAddLink(o._id)}
                          >
                            <span className="flex flex-col items-start gap-0.5 min-w-0">
                              <span className="font-medium truncate w-full">{o.title}</span>
                              <span className="text-xs text-muted-foreground truncate w-full">
                                {[o.level, o.division, o.departmentId ? deptById[o.departmentId] : null]
                                  .filter(Boolean)
                                  .join(' · ') || '—'}
                              </span>
                            </span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Upstream (this relates to)</CardTitle>
              <p className="text-sm text-muted-foreground">OKRs your team depends on.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {upstream.length === 0 ? (
                <p className="text-sm text-muted-foreground">None linked. Use &quot;Find and link OKR&quot; to add one.</p>
              ) : (
                upstream.map((dep) => <DepCard key={dep._id} dep={dep} direction="upstream" />)
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Downstream (depends on this)</CardTitle>
              <p className="text-sm text-muted-foreground">Other OKRs that reference this objective.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {downstream.length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                downstream.map((dep) => <DepCard key={dep._id} dep={dep} direction="downstream" />)
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
