"use client";

// Mock AdService — isolated from project data. Never receives source, .modcodes, prompts.
const MOCK_ADS = [
  { id: "mock-1", label: "Sponsored", title: "Learn WebGPU — Free course", cta: "Explore", href: "#" },
  { id: "mock-2", label: "Sponsored", title: "Hackathon toolkit — Ship faster", cta: "View", href: "#" },
  { id: "mock-3", label: "Sponsored", title: "Student dev tools", cta: "Learn more", href: "#" },
];

export function createAdService({ enabled = true } = {}) {
  let current = null;
  let impressionCount = 0;

  function requestAd({ placement } = {}) {
    if (!enabled) return null;
    // Never use project content for targeting. Round-robin mock.
    const ad = MOCK_ADS[impressionCount % MOCK_ADS.length];
    current = { ...ad, placement: String(placement || "generic"), requestedAt: Date.now() };
    return current;
  }

  function showAd() {
    if (!current) return null;
    impressionCount += 1;
    return current;
  }

  function dismissAd() {
    current = null;
  }

  function reportImpression() {
    // In prod this would call provider with no PII.
    return { impressions: impressionCount };
  }

  return { requestAd, showAd, dismissAd, reportImpression };
}
