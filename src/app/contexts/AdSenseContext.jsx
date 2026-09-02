"use client";
import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createAdSenseProvider, CONSENT_STATES } from "../lib/ads/adSenseProvider";

const CONSENT_STORAGE_KEY = "modcodes-ad-consent";

function loadPersistedConsent() {
  if (typeof window === "undefined") return CONSENT_STATES.UNKNOWN;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (raw === "accepted") return CONSENT_STATES.ACCEPTED;
    if (raw === "declined") return CONSENT_STATES.DECLINED;
    return CONSENT_STATES.UNKNOWN;
  } catch {
    return CONSENT_STATES.UNKNOWN;
  }
}

function persistConsent(state) {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, state);
  } catch {}
}

const AdSenseContext = createContext(null);

export function AdSenseProvider({ children, configOverrides = {} }) {
  const [provider] = useState(() => createAdSenseProvider(configOverrides));
  const [scriptState, setScriptState] = useState(() => provider.isAvailable() ? "idle" : "unavailable");
  const [consentState, setConsentState] = useState(() => {
    const persisted = loadPersistedConsent();
    provider.setConsent(persisted);
    return persisted;
  });
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
    if (!provider.hasConsent()) return;
    provider.loadScript().then((ok) => {
      if (mountedRef.current) setScriptState(ok ? "ready" : "error");
    });
  }, [provider, consentState]);

  const setConsent = useCallback((state) => {
    let resolved;
    if (state === true || state === CONSENT_STATES.ACCEPTED) {
      resolved = CONSENT_STATES.ACCEPTED;
    } else if (state === false || state === CONSENT_STATES.DECLINED) {
      resolved = CONSENT_STATES.DECLINED;
    } else if (state === CONSENT_STATES.UNKNOWN) {
      resolved = CONSENT_STATES.UNKNOWN;
    } else {
      resolved = !!state ? CONSENT_STATES.ACCEPTED : CONSENT_STATES.DECLINED;
    }
    provider.setConsent(resolved);
    persistConsent(resolved);
    setConsentState(resolved);
  }, [provider]);

  const value = useMemo(() => ({
    provider,
    scriptState,
    consentState,
    consent: consentState === CONSENT_STATES.ACCEPTED,
    setConsent,
    isAvailable: provider.isAvailable(),
    configSummary: provider.getConfigSummary(),
  }), [provider, scriptState, consentState, setConsent]);

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

export { CONSENT_STATES };
