"use client";
import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createAdSenseProvider } from "../../lib/ads/adSenseProvider";

const AdSenseContext = createContext(null);

export function AdSenseProvider({ children, configOverrides = {} }) {
  const [provider] = useState(() => createAdSenseProvider(configOverrides));
  const [scriptState, setScriptState] = useState(() => provider.isAvailable() ? "idle" : "unavailable");
  const [consent, setConsentState] = useState(() => provider.hasConsent());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!provider.isAvailable()) {
      if (mountedRef.current) setScriptState("unavailable");
      return;
    }
    provider.loadScript().then((ok) => {
      if (mountedRef.current) setScriptState(ok ? "ready" : "error");
    });
  }, [provider]);

  const setConsent = useCallback((granted) => {
    provider.setConsent(granted);
    setConsentState(granted);
  }, [provider]);

  const value = useMemo(() => ({
    provider,
    scriptState,
    consent,
    setConsent,
    isAvailable: provider.isAvailable(),
    configSummary: provider.getConfigSummary(),
  }), [provider, scriptState, consent, setConsent]);

  return (
    <AdSenseContext.Provider value={value}>
      {children}
    </AdSenseContext.Provider>
  );
}

export function useAdSense() {
  const ctx = useContext(AdSenseContext);
  if (!ctx) return null;
  return ctx;
}
