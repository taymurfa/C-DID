'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Download, Presentation } from 'lucide-react';

interface ExportDropdownProps {
  onExport: (format: 'json' | 'xlsx' | 'pdf') => Promise<void>;
  onExportGoogleSlides?: () => Promise<void>;
  /** When provided, adds "Present / Slide view" to the dropdown */
  onPresentationMode?: () => void;
  exporting?: boolean;
  exportingSlides?: boolean;
  disabled?: boolean;
  /** Optional: show Download icon on trigger (e.g. Leader view) */
  showDownloadIcon?: boolean;
  className?: string;
}

export function ExportDropdown({
  onExport,
  onExportGoogleSlides,
  onPresentationMode,
  exporting = false,
  exportingSlides = false,
  disabled = false,
  showDownloadIcon = false,
  className,
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const busy = exporting || exportingSlides;
  const triggerDisabled = disabled || busy;

  const run = async (fn: () => void | Promise<void>) => {
    setOpen(false);
    await fn();
  };

  return (
    <div className={`relative inline-block ${className ?? ''}`} ref={ref}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        disabled={triggerDisabled}
        className="h-9 shrink-0 gap-1.5"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {showDownloadIcon && <Download className="h-4 w-4" />}
        Export
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
          role="menu"
        >
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
            onClick={() => run(() => onExport('json'))}
            disabled={exporting}
            role="menuitem"
          >
            JSON
          </button>
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
            onClick={() => run(() => onExport('xlsx'))}
            disabled={exporting}
            role="menuitem"
          >
            Excel
          </button>
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
            onClick={() => run(() => onExport('pdf'))}
            disabled={exporting}
            role="menuitem"
          >
            PDF
          </button>
          {onExportGoogleSlides && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => run(onExportGoogleSlides)}
              disabled={exportingSlides}
              role="menuitem"
            >
              Google Slides
            </button>
          )}
          {onPresentationMode && (
            <>
              <div className="my-1 border-t border-border" role="separator" />
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => run(onPresentationMode)}
                disabled={disabled}
                role="menuitem"
              >
                <Presentation className="h-4 w-4" />
                Present / Slide view
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
