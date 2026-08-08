'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  api,
  DEFAULT_VIEW_PREFERENCES,
  type ViewPreferences,
} from '@/lib/api';

type ViewPreferencesContextValue = {
  preferences: ViewPreferences;
  loading: boolean;
  updatePreferences: (partial: Partial<ViewPreferences>) => Promise<void>;
  resetToDefault: () => Promise<void>;
};

const ViewPreferencesContext = createContext<ViewPreferencesContextValue | null>(null);

export function ViewPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<ViewPreferences>(DEFAULT_VIEW_PREFERENCES);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const prefs = await api.getViewPreferences();
      setPreferences(prefs);
    } catch {
      setPreferences(DEFAULT_VIEW_PREFERENCES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updatePreferences = useCallback(async (partial: Partial<ViewPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev };
      if (partial.lastDetailTab !== undefined) next.lastDetailTab = partial.lastDetailTab;
      if (partial.visibleTabs !== undefined) next.visibleTabs = { ...prev.visibleTabs, ...partial.visibleTabs };
      if (partial.dashboardSort !== undefined) next.dashboardSort = partial.dashboardSort;
      if (partial.dashboardSortDirection !== undefined) next.dashboardSortDirection = partial.dashboardSortDirection;
      if (partial.dashboardFilterUpdateType !== undefined) next.dashboardFilterUpdateType = partial.dashboardFilterUpdateType;
      if (partial.historyEventTypeFilter !== undefined) next.historyEventTypeFilter = partial.historyEventTypeFilter;
      return next;
    });
    try {
      const updated = await api.updateViewPreferences(partial);
      setPreferences(updated);
    } catch {
      // Revert on error
      load();
    }
  }, [load]);

  const resetToDefault = useCallback(async () => {
    try {
      const prefs = await api.resetViewPreferences();
      setPreferences(prefs);
    } catch {
      setPreferences(DEFAULT_VIEW_PREFERENCES);
      load();
    }
  }, [load]);

  return (
    <ViewPreferencesContext.Provider
      value={{ preferences, loading, updatePreferences, resetToDefault }}
    >
      {children}
    </ViewPreferencesContext.Provider>
  );
}

export function useViewPreferences(): ViewPreferencesContextValue {
  const ctx = useContext(ViewPreferencesContext);
  if (!ctx) {
    return {
      preferences: DEFAULT_VIEW_PREFERENCES,
      loading: false,
      updatePreferences: async () => {},
      resetToDefault: async () => {},
    };
  }
  return ctx;
}
