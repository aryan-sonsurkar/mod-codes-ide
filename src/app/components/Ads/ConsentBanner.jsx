"use client";
import { useState, useEffect, useCallback } from "react";
import { useAdSense } from "../../contexts/AdSenseContext";

const CONSENT_KEY = "modcodes-ad-consent";

function loadConsentState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (raw === "granted") return true;
    if (raw === "denied") return false;
    return null;
  } catch {
    return null;
  }
}

function saveConsentState(granted) {
  try {
    window.localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
  } catch {}
}

export default function ConsentBanner() {
  const adsense = useAdSense();
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!adsense || !adsense.isAvailable) return false;
    return loadConsentState() === null;
  });

  useEffect(() => {
    if (!adsense || !adsense.isAvailable) return;
    const existing = loadConsentState();
    if (existing !== null) {
      adsense.setConsent(existing);
    }
  }, [adsense]);

  const handleAccept = useCallback(() => {
    saveConsentState(true);
    if (adsense) adsense.setConsent(true);
    setVisible(false);
  }, [adsense]);

  const handleDecline = useCallback(() => {
    saveConsentState(false);
    if (adsense) adsense.setConsent(false);
    setVisible(false);
  }, [adsense]);

  if (!visible || !adsense || !adsense.isAvailable) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: "#1a1a2e",
        color: "#e0e0e0",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.3)",
        fontSize: "13px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        flexWrap: "wrap",
      }}
    >
      <p style={{ margin: 0, flex: "1 1 400px" }}>
        We use ads to keep MODCODES free. Your files and code never leave your
        machine. By accepting, you consent to personalized ads.
      </p>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleDecline}
          style={{
            background: "transparent",
            color: "#aaa",
            border: "1px solid #444",
            borderRadius: "6px",
            padding: "6px 16px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Decline
        </button>
        <button
          type="button"
          onClick={handleAccept}
          style={{
            background: "#8B5CF6",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "6px 16px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
