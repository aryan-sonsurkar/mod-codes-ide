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
    const id = window.setTimeout(() => {
      try {
        saveSettings(settings);
      } catch {}
    }, 300);
    return () => window.clearTimeout(id);
  }, [settings]);

  const updateSetting = useCallback((category, key, value) => {
    setSettings((current) => {
      const currentCategory = current[category];
      // Return the same object when nothing changes: an identity change here
      // re-renders every consumer and re-ran dependent effects on every
      // redundant write (e.g. re-selecting the already-selected model).
      if (
        currentCategory &&
        typeof currentCategory === "object" &&
        !Array.isArray(currentCategory) &&
        Object.prototype.hasOwnProperty.call(currentCategory, key) &&
        Object.is(currentCategory[key], value)
      ) {
        return current;
      }
      return {
        ...current,
        [category]: {
          ...currentCategory,
          [key]: value,
        },
      };
    });
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