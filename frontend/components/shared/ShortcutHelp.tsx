'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import { useFocusTrap, useRestoreFocusWhenActive } from '@/lib/useFocusTrap';

const shortcuts = [
  { keys: 'Esc', description: 'Close modal or dialog' },
  { keys: 'Tab', description: 'Move focus between buttons, tabs, and fields' },
  { keys: 'Enter', description: 'Submit save (Progress tab) or activate focused control' },
  { keys: 'Ctrl / Cmd + Enter', description: 'Save key result score and notes (Progress tab)' },
  { keys: 'Alt + 1–6', description: 'Switch OKR detail tabs (when visible)' },
  { keys: '↑ / ↓', description: 'Move between key result rows (Progress tab)' },
  { keys: '? or Shift + /', description: 'Toggle this keyboard shortcut help' },
];

interface ShortcutHelpProps {
  open: boolean;
  onClose: () => void;
  className?: string;
}

export function ShortcutHelp({ open, onClose, className }: ShortcutHelpProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useRestoreFocusWhenActive(open);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-help-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        className={cn(
          'bg-card border rounded-xl shadow-xl w-full max-w-sm p-4 space-y-4',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="shortcut-help-title" className="font-semibold text-lg">
            Keyboard shortcuts
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            ×
          </Button>
        </div>
        <dl className="space-y-2 text-sm">
          {shortcuts.map(({ keys, description }) => (
            <div key={description} className="flex justify-between gap-4">
              <dt className="font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                {keys}
              </dt>
              <dd className="text-muted-foreground">{description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
