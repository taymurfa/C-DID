'use client';

import { Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export type WorkflowStatus = 'draft' | 'in_review' | 'approved' | 'rejected';

export function getStatusIcon(status: string | null | undefined) {
  const s = (status ?? 'draft').toString().toLowerCase();
  switch (s) {
    case 'draft':
      return Clock;
    case 'in_review':
      return AlertCircle;
    case 'approved':
      return CheckCircle;
    case 'rejected':
      return XCircle;
    default:
      return Clock;
  }
}

export function getStatusLabel(status: string | null | undefined): string {
  const s = (status ?? 'draft').toString().toLowerCase();
  switch (s) {
    case 'draft':
      return 'Draft';
    case 'in_review':
      return 'In Review';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Draft';
  }
}

export function getStatusTooltip(status: string | null | undefined): string {
  const s = (status ?? 'draft').toString().toLowerCase();
  switch (s) {
    case 'draft':
      return 'This objective is in draft mode and can be edited freely';
    case 'in_review':
      return 'This objective is under review by leadership and awaiting approval';
    case 'approved':
      return 'This objective has been approved and is actively tracked';
    case 'rejected':
      return 'This objective was rejected and requires revision';
    default:
      return '';
  }
}

export function getStatusBadgeClass(status: string | null | undefined): string {
  const s = (status ?? 'draft').toString().toLowerCase();
  switch (s) {
    case 'approved':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-200 dark:border-green-800';
    case 'in_review':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-800';
    case 'rejected':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800';
    case 'draft':
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600';
  }
}

export const WORKFLOW_STEPS = [
  { status: 'draft' as const, label: 'Draft' },
  { status: 'in_review' as const, label: 'In Review' },
  { status: 'approved' as const, label: 'Approved' },
];

export function getCurrentStepIndex(status: string | null | undefined): number {
  const s = (status ?? 'draft').toString().toLowerCase();
  if (s === 'rejected') return -1;
  const idx = WORKFLOW_STEPS.findIndex((step) => step.status === s);
  return idx >= 0 ? idx : 0;
}
