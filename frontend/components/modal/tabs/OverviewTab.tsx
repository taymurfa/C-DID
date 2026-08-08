'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScoreRing, getScoreStatusLabel } from '@/components/shared/ScoreRing';
import { StatusPill } from '@/components/shared/StatusPill';
import { Building2, User, Target, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { api, type Objective, type KeyResult } from '@/lib/api';
import { toast } from 'sonner';

const KEY_RESULTS_PREVIEW = 3;

function getDaysLeftInQuarter(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const q = Math.floor(month / 3) + 1;
  const quarterEnd = new Date(year, q * 3, 0);
  const diff = quarterEnd.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

interface OverviewTabProps {
  objective: Objective;
  keyResults: KeyResult[];
  onObjectiveUpdate: (updated: Objective) => void;
  readOnly?: boolean;
}

export function OverviewTab({
  objective,
  keyResults,
  onObjectiveUpdate,
  readOnly,
}: OverviewTabProps) {
  const [showMore, setShowMore] = useState(false);
  const [showMoreKrs, setShowMoreKrs] = useState(false);
  const [nextReviewDate, setNextReviewDate] = useState(objective.nextReviewDate?.slice(0, 10) ?? '');
  const [latestUpdateSummary, setLatestUpdateSummary] = useState(objective.latestUpdateSummary ?? '');
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    setNextReviewDate(objective.nextReviewDate?.slice(0, 10) ?? '');
    setLatestUpdateSummary(objective.latestUpdateSummary ?? '');
  }, [objective._id, objective.nextReviewDate, objective.latestUpdateSummary]);
  const avgScore =
    keyResults.length > 0
      ? keyResults.reduce((s, kr) => s + (kr.score ?? 0), 0) / keyResults.length
      : null;
  const scorePct = avgScore != null ? Math.round(avgScore * 100) : 0;
  const daysLeft = getDaysLeftInQuarter();
  const statusLabel = avgScore != null ? getScoreStatusLabel(avgScore) : '—';
  const hasLongDescription = (objective.description?.length ?? 0) > 120;
  const descriptionPreview =
    hasLongDescription && !showMore
      ? (objective.description ?? '').slice(0, 120).trim() + '…'
      : objective.description;
  const showExpandMeta = (objective.ownerId || objective.division) && !showMore;
  const krsToShow = showMoreKrs ? keyResults : keyResults.slice(0, KEY_RESULTS_PREVIEW);
  const hasMoreKrs = keyResults.length > KEY_RESULTS_PREVIEW;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <StatusPill status={objective.status ?? 'draft'} />
                <span className="text-sm text-muted-foreground capitalize">
                  {objective.level}
                </span>
                {showMore && objective.division && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {objective.division}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-semibold break-words">{objective.title}</h2>
              {descriptionPreview && (
                <p className="text-muted-foreground mt-1 text-sm break-words">
                  {descriptionPreview}
                </p>
              )}
              {showMore && objective.ownerId && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                  <User className="h-4 w-4 shrink-0" />
                  {objective.ownerId}
                </p>
              )}
              {(hasLongDescription || showExpandMeta) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 min-h-[44px] min-w-[44px] touch-manipulation"
                  onClick={() => setShowMore((v) => !v)}
                >
                  {showMore ? (
                    <>Show less <ChevronUp className="h-4 w-4 ml-1" /></>
                  ) : (
                    <>Show more <ChevronDown className="h-4 w-4 ml-1" /></>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review cadence &amp; latest update</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Next review date supports scheduling; latest update is shown on the objective page, in exports, and in
            presentation slides.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="okr-next-review" className="text-sm font-medium text-muted-foreground">
              Next review date
            </label>
            <input
              id="okr-next-review"
              type="date"
              className="mt-1 block w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[44px]"
              value={nextReviewDate}
              onChange={(e) => setNextReviewDate(e.target.value)}
              disabled={readOnly || savingMeta}
            />
          </div>
          <div>
            <label htmlFor="okr-latest-update" className="text-sm font-medium text-muted-foreground">
              Latest update (for leadership / slides)
            </label>
            <textarea
              id="okr-latest-update"
              rows={4}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Concise context for the current review cycle…"
              value={latestUpdateSummary}
              onChange={(e) => setLatestUpdateSummary(e.target.value)}
              disabled={readOnly || savingMeta}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground mt-1">{latestUpdateSummary.length}/2000</p>
          </div>
          {!readOnly && objective._id && (
            <Button
              type="button"
              size="sm"
              className="min-h-[44px] touch-manipulation"
              disabled={savingMeta}
              onClick={async () => {
                if (!objective._id) return;
                setSavingMeta(true);
                try {
                  const updated = await api.updateObjective(objective._id, {
                    nextReviewDate: nextReviewDate.trim() || null,
                    latestUpdateSummary: latestUpdateSummary.trim() || null,
                  });
                  onObjectiveUpdate(updated);
                  toast.success('Review fields saved');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Save failed');
                } finally {
                  setSavingMeta(false);
                }
              }}
            >
              {savingMeta ? 'Saving…' : 'Save review fields'}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4">
        <Card className="flex-1 min-w-[120px]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Overall Score
              </span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {avgScore != null ? `${scorePct}%` : '—'}
            </p>
            {avgScore != null && (
              <ScoreRing score={avgScore} size={36} strokeWidth={3} className="mt-2" />
            )}
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[120px]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Key Results
              </span>
            </div>
            <p className="text-2xl font-bold mt-1">{keyResults.length}</p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[120px]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Days in Quarter
              </span>
            </div>
            <p className="text-2xl font-bold mt-1">{daysLeft}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Key Results Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {keyResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">No key results yet.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {krsToShow.map((kr) => {
                  const s = kr.score ?? 0;
                  const pct = Math.round(s * 100);
                  return (
                    <li key={kr._id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">
                          {kr.title}
                        </span>
                        <span className="text-sm font-semibold shrink-0">
                          {pct}%
                        </span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </li>
                  );
                })}
              </ul>
              {hasMoreKrs && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 min-h-[44px] touch-manipulation"
                  onClick={() => setShowMoreKrs((v) => !v)}
                >
                  {showMoreKrs ? (
                    <>Show less <ChevronUp className="h-4 w-4 ml-1" /></>
                  ) : (
                    <>Show more ({keyResults.length - KEY_RESULTS_PREVIEW} more) <ChevronDown className="h-4 w-4 ml-1" /></>
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
