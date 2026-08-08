'use client';

import { cn } from '@/components/ui/utils';

const STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

interface ScoreSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export function ScoreSlider({ value, onChange, disabled, className }: ScoreSliderProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const index = STEPS.reduce((best, s, i) => (Math.abs(s - clamped) < Math.abs(STEPS[best] - clamped) ? i : best), 0);
  const displayValue = STEPS[index];

  return (
    <div className={cn('flex items-center gap-2 min-h-[44px]', className)}>
      <input
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={displayValue}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-32 h-3 touch-manipulation rounded-full appearance-none bg-muted accent-primary disabled:opacity-50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-grab"
        aria-label="Score 0 to 1"
      />
      <span className="text-sm font-medium tabular-nums w-10 shrink-0">
        {(displayValue * 100).toFixed(0)}%
      </span>
    </div>
  );
}
