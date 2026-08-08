'use client';

import { Info } from 'lucide-react';

export interface InlineHelpProps {
  children: React.ReactNode;
  className?: string;
}

export function InlineHelp({ children, className = '' }: InlineHelpProps) {
  return (
    <div
      className={`flex gap-2 rounded-md border border-blue-200 bg-blue-50/80 px-3 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200 ${className}`}
    >
      <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
      <div className="min-w-0">
        <p>{children}</p>
      </div>
    </div>
  );
}
