import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_SETTINGS,
  clearSettings,
  loadSettings,
  saveSettings,
  type Settings,
} from "@/storage/settings";

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  configured: boolean;
  save: (next: Settings) => Promise<void>;
  reset: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await loadSettings();
      setSettings(stored);
      setReady(true);
    })();
  }, []);

  const save = useCallback(async (next: Settings) => {
    await saveSettings(next);
    setSettings(next);
  }, []);

  const reset = useCallback(async () => {
    await clearSettings();
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      ready,
      configured: Boolean(settings.host && settings.token),
      save,
      reset,
    }),
    [settings, ready, save, reset],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }
  return value;
}
