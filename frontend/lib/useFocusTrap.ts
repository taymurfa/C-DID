'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getVisibleFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
}

/**
 * Keeps keyboard focus inside `containerRef` when `enabled` is true.
 * Uses Tab wrapping and a capture-phase focusin listener so focus cannot move to the page behind an overlay.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean
): void {
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const focusFirst = () => {
      const list = getVisibleFocusables(container);
      if (list.length > 0) {
        requestAnimationFrame(() => list[0].focus());
      }
    };
    focusFirst();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = getVisibleFocusables(container);
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || (active && !container.contains(active))) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || (active && !container.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Node | null;
      if (target && container.contains(target)) return;
      queueMicrotask(() => {
        const list = getVisibleFocusables(container);
        if (list.length > 0) list[0].focus();
      });
    };

    container.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [containerRef, enabled]);
}

/**
 * When `active` is true, saves the currently focused element and restores it when `active` becomes false or the effect cleans up.
 */
export function useRestoreFocusWhenActive(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    return () => {
      previous?.focus?.();
    };
  }, [active]);
}

/**
 * Restores focus to the element that was focused when the component mounted (e.g. modal opened). Use when the whole dialog unmounts on close.
 */
export function useRestoreFocusOnUnmount(): void {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => {
      previous?.focus?.();
    };
  }, []);
}
