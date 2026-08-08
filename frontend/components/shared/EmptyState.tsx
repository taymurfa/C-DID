'use client';

import { ReactNode } from 'react';
import { Target, FileQuestion, Filter } from 'lucide-react';

export interface EmptyStateProps {
  icon?: 'target' | 'filter' | 'generic';
  title: string;
  description: string;
  /** Primary action button */
  action?: { label: string; onClick: () => void };
  /** Secondary link (e.g. "Learn how to add OKRs") */
  secondaryLink?: { label: string; href: string };
  className?: string;
}

const iconMap = {
  target: Target,
  filter: Filter,
  generic: FileQuestion,
};

export function EmptyState({
  icon = 'target',
  title,
  description,
  action,
  secondaryLink,
  className = '',
}: EmptyStateProps) {
  const Icon = iconMap[icon];

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center ${className}`}
    >
      <Icon className="h-12 w-12 text-muted-foreground/70" aria-hidden />
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {action.label}
        </button>
      )}
      {secondaryLink && (
        <a
          href={secondaryLink.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 text-sm text-primary hover:underline"
        >
          {secondaryLink.label}
        </a>
      )}
    </div>
  );
}
