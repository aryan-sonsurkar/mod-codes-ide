"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from "../lib/settings/settingsStorage";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => loadSettings());

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSetting = useCallback((category, key, value) => {
    setSettings((current) => ({
      ...current,
      [category]: {
        ...current[category],
        [key]: value,
      },
    }));
  }, []);

  const value = useMemo(
    () => ({ settings, updateSetting }),
    [settings, updateSetting]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }

  return context;
}

export { DEFAULT_SETTINGS };