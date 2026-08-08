'use client';

import { useEffect, useState, useRef, useCallback, type ComponentType } from 'react';
import { ScoreRing, getScoreStatusLabel, getScoreBarColorHex } from '@/components/shared/ScoreRing';
import { StatusPill } from '@/components/shared/StatusPill';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  X,
  FileDown,
  Presentation as PresentationIcon,
  FileText,
  Maximize2,
  Minimize2,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Link2,
  GitBranch,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { Objective, KeyResult } from '@/lib/api';
import { cn } from '@/components/ui/utils';

/** Title slide (story opening) */
export interface TitleSlide {
  type: 'title';
  title: string;
  subtitle?: string;
}

/** Agenda slide listing objectives (stories to cover) */
export interface AgendaSlide {
  type: 'agenda';
  title: string;
  items: { title: string }[];
}

/** AI-generated narrative / script slide */
export interface NarrativeSlide {
  type: 'narrative';
  content: string;
}

/** Slide indices in the same deck for related OKRs (objective slides only). */
export interface ObjectiveSlideNavigation {
  parentSlideIndex?: number;
  childSlideIndices: number[];
  upstreamSlideIndices: number[];
  downstreamSlideIndices: number[];
}

/** Single objective slide */
export interface ObjectiveSlide {
  type: 'objective';
  objective: Objective;
  score: number | null;
  keyResults: KeyResult[];
  /** Leadership narrative: persisted on objective, else derived from KR notes / description. */
  latestUpdateSummary?: string;
  navigation?: ObjectiveSlideNavigation;
}

export type PresentationSlide = TitleSlide | AgendaSlide | NarrativeSlide | ObjectiveSlide;

export function isObjectiveSlide(s: PresentationSlide): s is ObjectiveSlide {
  return s.type === 'objective';
}

export interface PresentationDeckStats {
  daysLeftInQuarter: number;
  /** Average OKR score 0–1 → display as % */
  portfolioAvgCompletionPct: number;
  /** % of key results at 100% */
  krsAtTargetPct: number;
  krsUpdatedThisWeek: number;
  krsTotal: number;
  /** Share of KRs with any update in the last 7 days (simple velocity signal). */
  weeklyTouchVelocityPct: number;
}

interface PresentationModeProps {
  slides: PresentationSlide[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onGoToSlide?: (index: number) => void;
  onExportPowerPoint?: () => Promise<void>;
  onExportGoogleSlides?: () => Promise<void>;
  narrative?: string | null;
  departments?: { _id: string; name: string }[];
  userNames?: { _id: string; name: string }[];
  deckStats?: PresentationDeckStats | null;
}

function deptName(deptId: string | null | undefined, departments: { _id: string; name: string }[]): string {
  if (!deptId) return '—';
  return departments.find((d) => d._id === deptId)?.name ?? deptId;
}

function ownerDisplay(ownerId: string | null | undefined, userNames: { _id: string; name: string }[]): string {
  if (!ownerId) return '—';
  return userNames.find((u) => u._id === ownerId)?.name ?? ownerId;
}

function krTrendIcon(score: number) {
  if (score >= 0.7) return <TrendingUp className="h-5 w-5 text-green-600 shrink-0" aria-hidden />;
  if (score >= 0.4) return <Minus className="h-5 w-5 text-amber-600 shrink-0" aria-hidden />;
  return <TrendingDown className="h-5 w-5 text-red-600 shrink-0" aria-hidden />;
}

function krRiskLevel(score: number): 'ok' | 'at_risk' | 'off' {
  if (score < 0.4) return 'off';
  if (score < 0.7) return 'at_risk';
  return 'ok';
}

export function PresentationMode({
  slides,
  currentIndex,
  onClose,
  onPrev,
  onNext,
  onGoToSlide,
  onExportPowerPoint,
  onExportGoogleSlides,
  narrative,
  departments = [],
  userNames = [],
  deckStats = null,
}: PresentationModeProps) {
  const [exportingPptx, setExportingPptx] = useState(false);
  const [exportingSlides, setExportingSlides] = useState(false);
  const [storyPopoutOpen, setStoryPopoutOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  const slide = slides[currentIndex];
  const total = slides.length;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < total - 1;
  const objectiveIds = slides.filter(isObjectiveSlide).map((s) => s.objective._id).filter(Boolean) as string[];
  const canExport = objectiveIds.length > 0;

  const syncFullscreen = useCallback(() => {
    setFullscreen(!!document.fullscreenElement);
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, [syncFullscreen]);

  const toggleFullscreen = async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (storyPopoutOpen) {
          setStoryPopoutOpen(false);
          return;
        }
        if (document.fullscreenElement) {
          void document.exitFullscreen();
          return;
        }
        onClose();
      }
      if (e.key === 'ArrowLeft') hasPrev && onPrev();
      if (e.key === 'ArrowRight') hasNext && onNext();
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
        const t = e.target as HTMLElement;
        if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') void toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onPrev, onNext, hasPrev, hasNext, storyPopoutOpen]);

  useEffect(() => {
    return () => {
      if (document.fullscreenElement === shellRef.current) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  if (total === 0) return null;

  const handleExportPptx = async () => {
    if (!onExportPowerPoint || !canExport) return;
    setExportingPptx(true);
    try {
      await onExportPowerPoint();
    } finally {
      setExportingPptx(false);
    }
  };

  const handleExportGoogle = async () => {
    if (!onExportGoogleSlides || !canExport) return;
    setExportingSlides(true);
    try {
      await onExportGoogleSlides();
    } finally {
      setExportingSlides(false);
    }
  };

  const NavChip = ({
    label,
    index,
    icon: Icon,
  }: {
    label: string;
    index: number;
    icon?: ComponentType<{ className?: string }>;
  }) => (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="h-9 gap-1.5 text-xs sm:text-sm"
      onClick={() => onGoToSlide?.(index)}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );

  return (
    <div
      ref={shellRef}
      className="fixed inset-0 z-50 bg-gradient-to-b from-background via-background to-muted/30 flex flex-col text-foreground"
      role="presentation"
      aria-label="Executive presentation mode"
    >
      <div className="flex items-center justify-between shrink-0 px-4 sm:px-6 py-3 border-b bg-card/80 backdrop-blur-sm flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Exit presentation (dashboard filters unchanged)" title="Close">
            <X className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9"
            onClick={() => void toggleFullscreen()}
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            title="Full screen (F)"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{fullscreen ? 'Exit full screen' : 'Full screen'}</span>
          </Button>
        </div>
        <span className="text-sm font-medium tabular-nums">
          Slide {currentIndex + 1} / {total}
        </span>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {narrative && (
            <Button variant="outline" size="sm" onClick={() => setStoryPopoutOpen(true)} className="gap-1.5 h-9">
              <FileText className="h-4 w-4" />
              Story
            </Button>
          )}
          {onExportPowerPoint && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPptx}
              disabled={!canExport || exportingPptx}
              className="gap-1.5 h-9 hidden sm:inline-flex"
            >
              <FileDown className="h-4 w-4" />
              {exportingPptx ? '…' : 'PowerPoint'}
            </Button>
          )}
          {onExportGoogleSlides && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportGoogle}
              disabled={!canExport || exportingSlides}
              className="gap-1.5 h-9 hidden sm:inline-flex"
            >
              <PresentationIcon className="h-4 w-4" />
              {exportingSlides ? '…' : 'Slides'}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={onPrev} disabled={!hasPrev} aria-label="Previous slide" className="h-9 w-9">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" onClick={onNext} disabled={!hasNext} aria-label="Next slide" className="h-9 w-9">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {deckStats && (
        <div className="shrink-0 px-4 sm:px-6 py-2 border-b bg-muted/40 flex flex-wrap gap-4 sm:gap-8 text-sm justify-center sm:justify-start">
          <span>
            <span className="text-muted-foreground">Portfolio avg </span>
            <strong className="tabular-nums">{deckStats.portfolioAvgCompletionPct}%</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Days left (Q) </span>
            <strong className="tabular-nums">{deckStats.daysLeftInQuarter}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">KRs at 100% </span>
            <strong className="tabular-nums">{deckStats.krsAtTargetPct}%</strong>
          </span>
          <span>
            <span className="text-muted-foreground">KRs touched (7d) </span>
            <strong className="tabular-nums">
              {deckStats.krsUpdatedThisWeek}/{deckStats.krsTotal}
            </strong>
          </span>
          <span>
            <span className="text-muted-foreground">Velocity (7d touch) </span>
            <strong className="tabular-nums">{deckStats.weeklyTouchVelocityPct}%</strong>
          </span>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-start sm:justify-center p-4 sm:p-8 overflow-auto">
        {slide.type === 'title' && (
          <div className="max-w-3xl w-full space-y-4 text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">{slide.title}</h1>
            {slide.subtitle && <p className="text-xl sm:text-2xl text-muted-foreground">{slide.subtitle}</p>}
            <p className="text-sm text-muted-foreground pt-4">Use arrow keys to navigate · F for full screen · Esc to exit</p>
          </div>
        )}

        {slide.type === 'agenda' && (
          <div className="max-w-3xl w-full space-y-6">
            <h2 className="text-xl font-semibold text-muted-foreground text-center">Agenda</h2>
            <h1 className="text-3xl sm:text-4xl font-bold text-center">{slide.title}</h1>
            <ul className="text-left space-y-3 list-none p-0">
              {slide.items.map((item, i) => (
                <li key={i} className="text-lg sm:text-xl flex gap-3 items-start border-b border-border/50 pb-3">
                  <span className="font-mono text-muted-foreground w-8 shrink-0">{i + 1}.</span>
                  <span>{item.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {slide.type === 'narrative' && (
          <div className="max-w-3xl w-full text-left space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">Presentation script</h2>
            <div className="text-base sm:text-lg leading-relaxed whitespace-pre-wrap">{slide.content}</div>
          </div>
        )}

        {slide.type === 'objective' && (() => {
          const o = slide.objective;
          const score = slide.score ?? 0;
          const hasScore = slide.score != null;
          const pct = hasScore ? Math.round(Math.min(1, Math.max(0, score)) * 100) : null;
          const isAtRisk = hasScore && score < 0.7 && score >= 0.4;
          const isOffTrack = hasScore && score < 0.4;
          const rejected = o.status === 'rejected';
          const statusLabel = hasScore ? getScoreStatusLabel(score) : 'No score';
          const nav = slide.navigation;

          return (
            <div
              className={cn(
                'max-w-4xl w-full space-y-5 sm:space-y-6 rounded-2xl border-2 p-5 sm:p-8 shadow-lg bg-card',
                rejected && 'border-red-500 ring-2 ring-red-500/30',
                !rejected && isOffTrack && 'border-red-500/80 bg-red-500/5',
                !rejected && isAtRisk && !isOffTrack && 'border-amber-500 bg-amber-500/5',
                !rejected && !isAtRisk && !isOffTrack && 'border-border'
              )}
            >
              {(rejected || isOffTrack || isAtRisk) && (
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold',
                    rejected || isOffTrack ? 'bg-red-600 text-white' : 'bg-amber-500 text-amber-950'
                  )}
                  role="status"
                >
                  <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
                  {rejected ? 'Objective rejected — needs attention' : isOffTrack ? 'Off track' : 'At risk'}
                </div>
              )}

              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="min-w-0 flex-1 space-y-3 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={o.status ?? 'draft'} />
                    <span className="text-sm font-medium capitalize px-2 py-0.5 rounded-md bg-muted">{o.level}</span>
                    {o.division && (
                      <span className="text-sm text-muted-foreground border border-border px-2 py-0.5 rounded-md">{o.division}</span>
                    )}
                  </div>
                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold leading-tight">{o.title}</h1>
                  {slide.latestUpdateSummary?.trim() ? (
                    <div className="rounded-xl border bg-muted/40 px-4 py-3 text-left">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Latest update
                      </p>
                      <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                        {slide.latestUpdateSummary.trim()}
                      </p>
                    </div>
                  ) : null}
                  <div className="grid sm:grid-cols-2 gap-2 text-base sm:text-lg">
                    <p>
                      <span className="text-muted-foreground font-medium">Department </span>
                      <span className="font-semibold">{deptName(o.departmentId, departments)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground font-medium">Owner </span>
                      <span className="font-semibold">{ownerDisplay(o.ownerId, userNames)}</span>
                    </p>
                  </div>
                  {o.quarter && (
                    <p className="text-sm text-muted-foreground">
                      {o.quarter} · FY{o.fiscalYear}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <ScoreRing score={hasScore ? score : null} size={140} strokeWidth={10} showLabel />
                  {hasScore && pct != null && (
                    <>
                      <p className="text-3xl font-bold tabular-nums">{pct}%</p>
                      <p
                        className={cn(
                          'text-lg font-semibold',
                          score >= 0.7 ? 'text-green-600' : score >= 0.4 ? 'text-amber-600' : 'text-red-600'
                        )}
                      >
                        {statusLabel}
                      </p>
                    </>
                  )}
                  {!hasScore && <p className="text-muted-foreground text-sm">No key result scores yet</p>}
                </div>
              </div>

              {hasScore && pct != null && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Overall progress</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: getScoreBarColorHex(score) }}
                    />
                  </div>
                </div>
              )}

              {nav &&
                (nav.parentSlideIndex != null ||
                  nav.childSlideIndices.length > 0 ||
                  nav.upstreamSlideIndices.length > 0 ||
                  nav.downstreamSlideIndices.length > 0) && (
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Related OKRs in this deck
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {nav.parentSlideIndex != null && (
                        <NavChip label="Parent objective" index={nav.parentSlideIndex} icon={ArrowUp} />
                      )}
                      {nav.childSlideIndices.map((idx, i) => (
                        <NavChip key={`c-${i}`} label={`Child ${i + 1}`} index={idx} icon={GitBranch} />
                      ))}
                      {nav.upstreamSlideIndices.map((idx, i) => (
                        <NavChip key={`u-${i}`} label={`Upstream ${i + 1}`} index={idx} icon={Link2} />
                      ))}
                      {nav.downstreamSlideIndices.map((idx, i) => (
                        <NavChip key={`d-${i}`} label={`Downstream ${i + 1}`} index={idx} icon={ArrowDown} />
                      ))}
                    </div>
                  </div>
                )}

              {slide.keyResults.length > 0 && (
                <div className="mt-2 text-left space-y-3">
                  <h2 className="text-lg sm:text-xl font-semibold border-b pb-2">Key results</h2>
                  <ul className="space-y-3 list-none p-0 m-0">
                    {slide.keyResults.map((kr) => {
                      const krScore = kr.score ?? 0;
                      const krPct = Math.round(krScore * 100);
                      const risk = krRiskLevel(krScore);
                      return (
                        <li
                          key={kr._id}
                          className={cn(
                            'p-4 rounded-xl border-2 flex flex-col gap-2',
                            risk === 'off' && 'border-red-500 bg-red-500/10',
                            risk === 'at_risk' && 'border-amber-500 bg-amber-500/10',
                            risk === 'ok' && 'border-border bg-background/50'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              {krTrendIcon(krScore)}
                              <div className="min-w-0">
                                <span className="font-semibold text-base block">{kr.title}</span>
                                <span className="text-xs text-muted-foreground">
                                  {risk === 'ok' ? 'On track' : risk === 'at_risk' ? 'At risk' : 'Off track'}
                                </span>
                              </div>
                            </div>
                            <span className="text-xl font-bold tabular-nums shrink-0">{krPct}%</span>
                          </div>
                          <Progress value={krPct} className="h-3" />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {storyPopoutOpen && narrative && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Presentation narrative"
          onClick={() => setStoryPopoutOpen(false)}
        >
          <div
            className="relative z-10 max-w-2xl w-full max-h-[80vh] overflow-hidden rounded-xl border bg-card shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b">
              <h3 className="font-semibold">OKR narrative</h3>
              <Button variant="ghost" size="icon" onClick={() => setStoryPopoutOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 whitespace-pre-wrap text-sm leading-relaxed">{narrative}</div>
          </div>
        </div>
      )}

      <div className="shrink-0 px-4 py-2 border-t bg-card/80 flex justify-center gap-1.5 flex-wrap">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onGoToSlide?.(i)}
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-colors',
              i === currentIndex ? 'bg-primary scale-125' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
            )}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === currentIndex ? 'true' : undefined}
          />
        ))}
      </div>
    </div>
  );
}
