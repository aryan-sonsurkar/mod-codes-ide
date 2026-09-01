"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useAdSense } from "../../contexts/AdSenseContext";
import { canShowAd, recordAdShown } from "../../lib/ads/adFrequency";

export function AdContainer({
  placement,
  format = "auto",
  responsive = true,
  className = "",
  style = {},
  label = "Sponsored",
  cooldownMs,
}) {
  const adsense = useAdSense();
  const containerRef = useRef(null);
  const [adState, setAdState] = useState("idle");
  const [dismissed, setDismissed] = useState(false);
  const mountedRef = useRef(true);
  const frequencyBlocked = useMemo(() => {
    if (!adsense || !adsense.isAvailable || !adsense.consent) return false;
    return !canShowAd(placement, cooldownMs);
  }, [adsense, placement, cooldownMs]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!adsense || !adsense.isAvailable || !adsense.consent || dismissed || frequencyBlocked) return;

    const container = containerRef.current;
    if (!container) return;

    const result = adsense.provider.renderAd(container, { format, responsive });
    if (result.ok) {
      recordAdShown(placement);
    }
    if (mountedRef.current) setAdState(result.ok ? "ready" : "error");
  }, [adsense, format, responsive, dismissed, placement, frequencyBlocked]);

  const dismiss = useCallback(() => setDismissed(true), []);

  if (dismissed || frequencyBlocked) return null;

  return (
    <div
      className={`modcodes-ad-container ${className}`}
      role="complementary"
      aria-label={label}
      data-placement={placement}
      style={{
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      <span
        style={{
          fontSize: "10px",
          color: "#888",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </span>
      <div ref={containerRef} style={{ minHeight: "50px" }} />
      {adState === "error" && (
        <div style={{ fontSize: "11px", color: "#999", padding: "4px" }}>
          Ad unavailable
        </div>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss advertisement"
        style={{
          position: "absolute",
          top: "2px",
          right: "2px",
          background: "none",
          border: "none",
          color: "#999",
          cursor: "pointer",
          fontSize: "12px",
          padding: "2px 4px",
        }}
      >
        ×
      </button>
    </div>
  );
}

export function ProjectOpenAd() {
  return (
    <AdContainer
      placement="project-open"
      format="auto"
      responsive={true}
      cooldownMs={5 * 60 * 1000}
      style={{
        margin: "8px 0",
        padding: "8px",
        background: "#fafafa",
        borderRadius: "4px",
        border: "1px solid #eee",
      }}
    />
  );
}

export function DashboardAd() {
  return (
    <AdContainer
      placement="dashboard"
      format="auto"
      responsive={true}
      cooldownMs={10 * 60 * 1000}
      style={{
        margin: "16px 0",
        padding: "12px",
        background: "#fafafa",
        borderRadius: "6px",
        border: "1px solid #eee",
      }}
    />
  );
}

export function IDESecondaryAd() {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Show sponsored content"
        style={{
          fontSize: "10px",
          color: "#999",
          background: "none",
          border: "1px solid #eee",
          borderRadius: "3px",
          padding: "2px 6px",
          cursor: "pointer",
        }}
      >
        Sponsored
      </button>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <AdContainer
        placement="ide-secondary"
        format="horizontal"
        responsive={false}
        cooldownMs={15 * 60 * 1000}
        style={{
          margin: "8px 0",
          padding: "8px",
          background: "#fafafa",
          borderRadius: "4px",
          border: "1px solid #eee",
          maxHeight: "100px",
          overflow: "hidden",
        }}
      />
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        aria-label="Collapse sponsored content"
        style={{
          position: "absolute",
          top: "4px",
          right: "20px",
          background: "none",
          border: "none",
          color: "#999",
          cursor: "pointer",
          fontSize: "10px",
        }}
      >
        collapse
      </button>
    </div>
  );
}
