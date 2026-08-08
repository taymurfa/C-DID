'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreSlider } from '@/components/shared/ScoreSlider';
import { ScoreRing, getScoreStatusLabel } from '@/components/shared/ScoreRing';
import { api, ApiConflictError, type Objective, type KeyResult, type ScoreHistoryEntry } from '@/lib/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, AlertTriangle, Pencil, ListChecks } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { InlineHelp } from '@/components/shared/InlineHelp';
import { FieldLabel } from '@/components/shared/FieldLabel';
import { EmptyState } from '@/components/shared/EmptyState';
import { toast } from 'sonner';

interface ProgressTabProps {
  objective: Objective;
  keyResults: KeyResult[];
  onKeyResultsUpdate?: () => void;
  readOnly?: boolean;
  /** When provided, per-KR edit permission (overrides readOnly for each KR). */
  canEditKr?: (kr: KeyResult) => boolean;
}

function KRProgressRow({
  kr,
  onUpdate,
  readOnly,
  index = 0,
  totalCount = 1,
  onFocusRow = () => {},
  focusedIndex = 0,
  objectiveUpdatedAt,
  rowButtonRef,
  bulkSelectMode,
  bulkSelected,
  onBulkToggle,
}: {
  kr: KeyResult;
  onUpdate: () => void;
  readOnly?: boolean;
  index?: number;
  totalCount?: number;
  onFocusRow?: (i: number) => void;
  focusedIndex?: number;
  objectiveUpdatedAt?: string;
  /** Parent registers row button for arrow-key focus management */
  rowButtonRef?: (el: HTMLButtonElement | null) => void;
  bulkSelectMode?: boolean;
  bulkSelected?: boolean;
  onBulkToggle?: (keyResultId: string, selected: boolean) => void;
}) {
  const rowRef = useRef<HTMLButtonElement | null>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [score, setScore] = useState(kr.score ?? 0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ScoreHistoryEntry[]>([]);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<{ score: number; notes?: KeyResult['notes'] } | null>(null);

  useEffect(() => {
    setScore(kr.score ?? 0);
  }, [kr.score]);

  useEffect(() => {
    if (!kr._id || !expanded) return;
    api.getKeyResultHistory(kr._id).then(setHistory).catch(() => setHistory([]));
  }, [kr._id, expanded]);

  const buildPayload = (): { score: number; notes?: KeyResult['notes']; lastUpdatedAt?: string } => {
    const payload: { score: number; notes?: KeyResult['notes']; lastUpdatedAt?: string } = { score };
    if (notes.trim()) {
      const newNote = { text: notes.trim(), createdAt: new Date().toISOString() };
      const existing = Array.isArray(kr.notes) ? kr.notes : [];
      payload.notes = [...existing, newNote];
    }
    if (kr.lastUpdatedAt) payload.lastUpdatedAt = kr.lastUpdatedAt;
    return payload;
  };

  const handleSave = async (forceOverwrite = false) => {
    if (!kr._id) return;
    setLoading(true);
    setConflictOpen(false);
    setPendingPayload(null);
    try {
      const payload = buildPayload();
      if (forceOverwrite) delete payload.lastUpdatedAt;
      await api.updateKeyResult(kr._id, payload);
      setNotes('');
      onUpdate();
      toast.success('Score updated', { description: `Key result score saved.` });
      if (expanded) {
        const next = await api.getKeyResultHistory(kr._id);
        setHistory(next);
      }
    } catch (e) {
      if (e instanceof ApiConflictError && e.status === 409) {
        const p = buildPayload();
        setPendingPayload({ score: p.score, notes: p.notes });
        setConflictOpen(true);
      } else {
        const msg = e instanceof Error ? e.message : 'Failed to save';
        toast.error('Update failed', { description: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConflictReload = () => {
    setConflictOpen(false);
    setPendingPayload(null);
    onUpdate();
  };

  const handleConflictOverwrite = () => {
    if (pendingPayload && kr._id) {
      const payload = { ...pendingPayload };
      setPendingPayload(null);
      setConflictOpen(false);
      (async () => {
        setLoading(true);
        try {
          await api.updateKeyResult(kr._id!, payload);
          setNotes('');
          onUpdate();
          toast.success('Score updated');
          if (expanded) {
            const next = await api.getKeyResultHistory(kr._id!);
            setHistory(next);
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Update failed');
        } finally {
          setLoading(false);
        }
      })();
    }
  };

  const prevScore = history.length >= 2 ? history[history.length - 2].score : null;
  const delta = prevScore != null ? score - prevScore : null;
  const daysInQuarter = 90;
  const quarterStart = objectiveUpdatedAt ? new Date(objectiveUpdatedAt) : new Date(new Date().getFullYear(), 0, 1);
  const daysPassed = Math.max(0, (Date.now() - quarterStart.getTime()) / (1000 * 60 * 60 * 24));
  const expectedProgress = Math.min(1, daysPassed / daysInQuarter);
  const isBehind = score < expectedProgress || score < 0.4;
  const statusLabel = getScoreStatusLabel(score);
  const velocity = history.length >= 2 && history[0].recordedAt && history[history.length - 1].recordedAt
    ? (history[history.length - 1].score - history[0].score) / (new Date(history[history.length - 1].recordedAt).getTime() - new Date(history[0].recordedAt).getTime()) * (1000 * 60 * 60 * 24 * 7)
    : null;
  const weeksToFull =
    velocity != null && velocity > 0.001 && score < 0.995 ? Math.ceil((1 - score) / velocity) : null;

  const quarterStartMs = quarterStart.getTime();
  const quarterEndMs = quarterStartMs + daysInQuarter * 24 * 60 * 60 * 1000;
  const chartData = history
    .map((h) => {
      const t = h.recordedAt ? new Date(h.recordedAt).getTime() : 0;
      const expected = Math.min(1, Math.max(0, (t - quarterStartMs) / (quarterEndMs - quarterStartMs)));
      return {
        date: h.recordedAt ? new Date(h.recordedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
        score: h.score,
        expected,
        pct: Math.round(h.score * 100),
      };
    })
    .slice(-20);

  const handleQuickUpdate = () => {
    setExpanded(true);
  };

  const setRowButtonRef = useCallback(
    (el: HTMLButtonElement | null) => {
      rowRef.current = el;
      rowButtonRef?.(el);
    },
    [rowButtonRef]
  );

  const krId = kr._id ?? '';

  return (
    <Card className="overflow-hidden">
      <div className="w-full flex items-center gap-2 px-4 py-3 min-h-[44px]">
        {bulkSelectMode && krId && onBulkToggle && (
          <label className="flex shrink-0 items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation">
            <input
              type="checkbox"
              checked={!!bulkSelected}
              onChange={(e) => onBulkToggle(krId, e.target.checked)}
              className="h-5 w-5 rounded border-input"
              aria-label={`Select ${kr.title ?? 'key result'} for bulk update`}
            />
          </label>
        )}
        <button
          type="button"
          ref={setRowButtonRef}
          tabIndex={focusedIndex === index ? 0 : -1}
          className="flex items-center gap-2 flex-1 min-w-0 text-left hover:bg-muted/50 active:bg-muted/70 touch-manipulation rounded -m-2 p-2"
          onClick={() => setExpanded((e) => !e)}
          onFocus={() => onFocusRow(index)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <ScoreRing score={score} size={28} strokeWidth={3} />
          <span className="font-medium flex-1 truncate">{kr.title}</span>
          <span className={cn(
            'text-sm font-medium',
            score >= 0.7 ? 'text-green-600' : score >= 0.4 ? 'text-amber-600' : 'text-red-600'
          )}>
            {statusLabel}
          </span>
          {delta !== null && (
            <span className={cn('flex items-center gap-0.5 text-sm', delta >= 0 ? 'text-green-600' : 'text-red-600')}>
              {delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {(delta >= 0 ? '+' : '') + (delta * 100).toFixed(0)}%
            </span>
          )}
        </button>
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={(e) => { e.stopPropagation(); handleQuickUpdate(); }}
            title="Quick Update (expand and edit score)"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Quick Update
          </Button>
        )}
      </div>
      {expanded && (
        <CardContent className="pt-0 border-t space-y-4">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
          >
          {isBehind && (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {score < expectedProgress
                  ? `Behind schedule — current ${(score * 100).toFixed(0)}% vs expected ${(expectedProgress * 100).toFixed(0)}% at this point.`
                  : 'Behind schedule — consider updating target or scope.'}
              </span>
            </div>
          )}
          {velocity != null && expanded && (
            <p className="text-xs text-muted-foreground">
              Velocity: ~{(velocity * 100).toFixed(1)}% per week (from history).
              {weeksToFull != null && weeksToFull > 0 && weeksToFull < 520 && (
                <span className="block mt-1">
                  If pace holds, ~{weeksToFull} week{weeksToFull !== 1 ? 's' : ''} to 100% (illustrative).
                </span>
              )}
            </p>
          )}
          {(kr.target != null && kr.target !== '') || (kr.currentValue != null && kr.currentValue !== '') || kr.unit ? (
            <p className="text-xs text-muted-foreground rounded-md bg-muted/50 px-2 py-1.5">
              <span className="font-medium text-foreground">Measure: </span>
              Current {kr.currentValue ?? '—'}
              {kr.unit ? ` ${kr.unit}` : ''} · Target {kr.target ?? '—'}
              {kr.unit ? ` ${kr.unit}` : ''} · Score {Math.round(score * 100)}% of completion scale
            </p>
          ) : null}
          {!readOnly && (
            <>
              <InlineHelp className="mb-3">
                Score is 0–100% of target achieved. Update regularly so roll-ups and dashboards stay accurate. Use 10% steps.
              </InlineHelp>
              <div className="flex flex-wrap items-end gap-4">
                <div ref={sliderContainerRef} className="min-w-0 flex-1">
                  <FieldLabel
                    className="text-muted-foreground mb-1"
                    tooltip="Completion as a share of the KR target (0–100%). Drives roll-up scores and status colors on the dashboard."
                  >
                    Score (0–100%)
                  </FieldLabel>
                  <ScoreSlider value={score} onChange={setScore} disabled={loading} />
                </div>
                <Button type="submit" size="sm" disabled={loading} className="min-h-[44px] min-w-[44px] touch-manipulation" title="Save (Ctrl+Enter or Enter)">
                  {loading ? 'Saving…' : 'Save'}
                </Button>
              </div>
              <div>
                <FieldLabel
                  htmlFor={kr._id ? `kr-notes-${kr._id}` : undefined}
                  className="text-muted-foreground mb-1"
                  tooltip="Optional context saved with this score update (visible in history)."
                >
                  Notes
                </FieldLabel>
                <textarea
                  id={kr._id ? `kr-notes-${kr._id}` : undefined}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add progress note..."
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </>
          )}
          {chartData.length > 0 && (
            <div className="h-[160px] sm:h-[200px] w-full min-w-0 -mx-1 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v * 100}%`} width={28} />
                  <Tooltip formatter={(v: number) => `${(Number(v) * 100).toFixed(0)}%`} />
                  <Line type="monotone" dataKey="score" name="Actual" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="expected" name="Expected" stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">No score history yet. Save a score to see the trend.</p>
          )}
          </form>
        </CardContent>
      )}
      {conflictOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
          <div className="bg-card border rounded-lg shadow-lg p-4 max-w-sm w-full space-y-3">
            <h3 id="conflict-title" className="font-semibold">Update conflict</h3>
            <p className="text-sm text-muted-foreground">
              This key result was updated by someone else. Reload to see their changes, or overwrite with your version?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleConflictReload}>
                Reload
              </Button>
              <Button size="sm" onClick={handleConflictOverwrite}>
                Overwrite
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export function ProgressTab({
  objective,
  keyResults,
  onKeyResultsUpdate,
  readOnly,
  canEditKr,
}: ProgressTabProps) {
  const refresh = onKeyResultsUpdate ?? (() => {});
  const [focusedIndex, setFocusedIndex] = useState(0);
  const progressNavRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkScore, setBulkScore] = useState(0.7);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [lastFailedIds, setLastFailedIds] = useState<string[]>([]);

  const rowEditable = (kr: KeyResult) =>
    !readOnly && (!canEditKr || !!canEditKr(kr));

  const editableKrs = keyResults.filter((kr) => rowEditable(kr) && kr._id);

  const toggleBulk = (id: string, on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runBulkApply = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBulkRunning(true);
    setLastFailedIds([]);
    const failed: string[] = [];
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const kr = keyResults.find((k) => k._id === id);
        const payload: { score: number; lastUpdatedAt?: string } = { score: bulkScore };
        if (kr?.lastUpdatedAt) payload.lastUpdatedAt = kr.lastUpdatedAt;
        await api.updateKeyResult(id, payload);
      })
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') failed.push(ids[i]!);
    });
    setBulkRunning(false);
    setBulkConfirmOpen(false);
    const ok = ids.length - failed.length;
    if (ok > 0) {
      toast.success(`Updated ${ok} of ${ids.length} key results`, {
        description: failed.length ? `${failed.length} failed — you can retry them.` : undefined,
      });
      refresh();
    } else {
      toast.error('Bulk update failed', { description: 'None of the selected key results could be updated.' });
    }
    if (failed.length) {
      setLastFailedIds(failed);
      setSelectedIds(new Set(failed));
    } else {
      setSelectedIds(new Set());
      setBulkSelectMode(false);
    }
  };

  useEffect(() => {
    rowRefs.current.length = keyResults.length;
  }, [keyResults.length]);

  useEffect(() => {
    const root = progressNavRef.current;
    if (!root || keyResults.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const t = e.target as HTMLElement | null;
      if (!t || !root.contains(t)) return;
      if (t.tagName === 'TEXTAREA') return;
      if (t.closest('form')) return;
      if (t.closest('[role="slider"]')) return;
      if (t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'range') return;
      e.preventDefault();
      setFocusedIndex((prev) => {
        const next =
          e.key === 'ArrowDown'
            ? Math.min(prev + 1, keyResults.length - 1)
            : Math.max(0, prev - 1);
        requestAnimationFrame(() => rowRefs.current[next]?.focus());
        return next;
      });
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [keyResults.length]);

  return (
    <div className="space-y-4" ref={progressNavRef}>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Key result progress</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Update scores (0.0–1.0), add notes, and view history. Expand a row to see the trend chart and expected vs
                actual. Use bulk mode to set the same score on multiple KRs you can edit.
              </p>
            </div>
            {editableKrs.length > 0 && (
              <Button
                type="button"
                variant={bulkSelectMode ? 'secondary' : 'outline'}
                size="sm"
                className="min-h-[44px] shrink-0 touch-manipulation gap-2"
                onClick={() => {
                  setBulkSelectMode((v) => !v);
                  if (bulkSelectMode) setSelectedIds(new Set());
                }}
              >
                <ListChecks className="h-4 w-4" />
                {bulkSelectMode ? 'Exit bulk' : 'Bulk update'}
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>
      {bulkSelectMode && editableKrs.length > 0 && (
        <Card className="border-primary/30 bg-muted/30">
          <CardContent className="pt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-[44px] touch-manipulation"
                onClick={() => setSelectedIds(new Set(editableKrs.map((k) => k._id!)))}
              >
                Select all ({editableKrs.length})
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-[44px] touch-manipulation"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
              {lastFailedIds.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] touch-manipulation"
                  onClick={() => {
                    setSelectedIds(new Set(lastFailedIds));
                    setBulkConfirmOpen(true);
                  }}
                >
                  Retry failed ({lastFailedIds.length})
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} selected · choose a score then confirm to apply to all selected.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 max-w-md">
                <FieldLabel className="text-muted-foreground mb-1">Bulk score (0–100%)</FieldLabel>
                <ScoreSlider value={bulkScore} onChange={setBulkScore} disabled={bulkRunning} />
              </div>
              <Button
                type="button"
                className="min-h-[44px] touch-manipulation"
                disabled={selectedIds.size === 0 || bulkRunning}
                onClick={() => setBulkConfirmOpen(true)}
              >
                Review &amp; apply…
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {bulkConfirmOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-confirm-title"
        >
          <div className="bg-card border rounded-lg shadow-lg max-w-lg w-full max-h-[min(80vh,520px)] flex flex-col">
            <div className="p-4 border-b space-y-2">
              <h3 id="bulk-confirm-title" className="font-semibold text-lg">
                Confirm bulk score update
              </h3>
              <p className="text-sm text-muted-foreground">
                Set score to <strong>{Math.round(bulkScore * 100)}%</strong> for {selectedIds.size} key result
                {selectedIds.size !== 1 ? 's' : ''}:
              </p>
            </div>
            <ul className="p-4 overflow-y-auto text-sm space-y-1 border-b max-h-[40vh] list-disc pl-5">
              {[...selectedIds].map((id) => {
                const kr = keyResults.find((k) => k._id === id);
                return (
                  <li key={id}>
                    {kr?.title ?? id}
                  </li>
                );
              })}
            </ul>
            <div className="p-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] touch-manipulation"
                disabled={bulkRunning}
                onClick={() => setBulkConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="min-h-[44px] touch-manipulation"
                disabled={bulkRunning}
                onClick={() => runBulkApply([...selectedIds])}
              >
                {bulkRunning ? 'Applying…' : 'Apply to all'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {keyResults.length === 0 ? (
        <EmptyState
          icon="target"
          title="No key results yet"
          description="Add key results to this objective to track progress. Each key result can have a score and notes."
        />
      ) : (
        <div className="space-y-2">
          {keyResults.map((kr, index) => (
            <KRProgressRow
              key={kr._id}
              kr={kr}
              onUpdate={refresh}
              readOnly={readOnly || (canEditKr ? !canEditKr(kr) : false)}
              index={index}
              totalCount={keyResults.length}
              onFocusRow={setFocusedIndex}
              focusedIndex={focusedIndex}
              objectiveUpdatedAt={objective.updatedAt ?? undefined}
              rowButtonRef={(el) => {
                rowRefs.current[index] = el;
              }}
              bulkSelectMode={bulkSelectMode && rowEditable(kr) && !!kr._id}
              bulkSelected={kr._id ? selectedIds.has(kr._id) : false}
              onBulkToggle={toggleBulk}
            />
          ))}
        </div>
      )}
    </div>
  );
}
