'use client';

import { cn } from '@/components/ui/utils';

/** Score 0.0–1.0. Colors: On Track 0.7–1, At Risk 0.4–0.69, Off Track 0–0.39 */
export function getScoreRingColor(score: number): string {
  if (score >= 0.7) return 'stroke-green-500';
  if (score >= 0.4) return 'stroke-amber-500';
  return 'stroke-red-500';
}

/** Hex color for progress bar fill (reference design). */
export function getScoreBarColorHex(score: number): string {
  if (score >= 0.7) return '#10B981';
  if (score >= 0.4) return '#F59E0B';
  return '#EF4444';
}

export function getScoreStatusLabel(score: number): 'On Track' | 'At Risk' | 'Off Track' {
  if (score >= 0.7) return 'On Track';
  if (score >= 0.4) return 'At Risk';
  return 'Off Track';
}

interface ScoreRingProps {
  score: number | null | undefined;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
}

export function ScoreRing({
  score,
  size = 40,
  strokeWidth = 4,
  className,
  showLabel = false,
}: ScoreRingProps) {
  const value = score != null ? Math.max(0, Math.min(1, score)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - value);
  const colorClass = getScoreRingColor(value);

  const labelText = score != null ? `${Math.round(value * 100)}%` : '—';
  const labelSizeClass = size >= 48 ? 'text-xs' : 'text-[10px]';

  return (
    <div className={cn('relative inline-flex flex-col items-center', className)}>
      <svg width={size} height={size} className="rotate-[-90deg]" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className={cn('transition-[stroke-dashoffset]', colorClass)}
        />
      </svg>
      {showLabel && (
        <span
          className={cn('absolute inset-0 flex items-center justify-center font-medium text-muted-foreground pointer-events-none', labelSizeClass)}
          aria-hidden
        >
          {labelText}
        </span>
      )}
    </div>
  );
}
