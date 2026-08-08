'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'okr-theme';

/**
 * Applies the `dark` class on <html> from localStorage or system preference (WCAG: respect user display modes).
 */
export function ThemePreference() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark') document.documentElement.classList.add('dark');
      else if (stored === 'light') document.documentElement.classList.remove('dark');
      else document.documentElement.classList.toggle('dark', mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return null;
}
