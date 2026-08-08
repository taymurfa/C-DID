'use client';

import { cn } from '@/components/ui/utils';
import { Badge } from '@/components/ui/badge';

export type WorkflowStatus = 'draft' | 'in_review' | 'approved' | 'rejected';

const statusConfig: Record<
  WorkflowStatus,
  { label: string; className: string }
> = {
  draft: { label: 'Draft', className: 'border-slate-400 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  in_review: { label: 'In Review', className: 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200' },
  approved: { label: 'Approved', className: 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950/50 dark:text-green-200' },
  rejected: { label: 'Rejected', className: 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200' },
};

interface StatusPillProps {
  status: WorkflowStatus | string | null | undefined;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const key = (status || 'draft') as WorkflowStatus;
  const config = statusConfig[key] ?? statusConfig.draft;
  const label = config?.label ?? (status || 'Draft');

  return (
    <Badge
      variant="outline"
      className={cn('font-medium', config.className, className)}
    >
      {label}
    </Badge>
  );
}
