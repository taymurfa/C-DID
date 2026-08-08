'use client';

import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

export interface FieldLabelProps {
  htmlFor?: string;
  children: React.ReactNode;
  /** Hover tooltip text */
  tooltip?: string;
  required?: boolean;
  className?: string;
}

export function FieldLabel({
  htmlFor,
  children,
  tooltip,
  required,
  className = '',
}: FieldLabelProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTooltip || !tooltip) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTooltip, tooltip]);

  return (
    <label
      htmlFor={htmlFor}
      className={`block text-sm font-medium text-foreground ${className}`}
    >
      <span className="inline-flex items-center gap-1.5">
        {children}
        {required && <span className="text-red-500" aria-hidden>*</span>}
        {tooltip && (
          <span
            ref={triggerRef}
            className="relative inline-flex cursor-help text-muted-foreground hover:text-foreground"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            tabIndex={0}
            role="button"
            aria-label={`Help: ${tooltip}`}
          >
            <HelpCircle className="h-4 w-4" />
            {showTooltip && (
              <div
                ref={tooltipRef}
                className="absolute left-0 top-full z-50 mt-1 max-w-xs rounded-md border bg-popover px-2.5 py-1.5 text-xs font-normal text-popover-foreground shadow-md"
                role="tooltip"
              >
                {tooltip}
              </div>
            )}
          </span>
        )}
      </span>
    </label>
  );
}
