'use client';

import type { ReactNode } from 'react';
import { cn } from '@/components/ui/utils';

type ChartAccessibleProps = {
  /** Short description of what the chart shows (screen readers). */
  summary: string;
  className?: string;
  children: ReactNode;
};

/**
 * Wraps a Recharts (or other) visualization: decorative SVG for AT + text alternative.
 */
export function ChartAccessible({ summary, className, children }: ChartAccessibleProps) {
  return (
    <figure className={cn('m-0', className)}>
      <div aria-hidden="true" className="min-h-0 [&_.recharts-surface]:outline-none">
        {children}
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
