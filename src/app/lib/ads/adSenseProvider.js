"use client";

const ADSENSE_SCRIPT_URL = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

const DEFAULT_CONFIG = {
  enabled: false,
  publisherId: "",
  adsTxtPath: "/ads.txt",
  consentRequired: true,
  testMode: false,
};

function getConfig(overrides = {}) {
  if (typeof window === "undefined") return { ...DEFAULT_CONFIG, ...overrides };
  try {
    const env = window.__MODCODES_ADS_CONFIG || {};
    return {
      enabled: env.ADSENSE_ENABLED === "true" || env.ADSENSE_ENABLED === true || DEFAULT_CONFIG.enabled,
      publisherId: env.ADSENSE_PUBLISHER_ID || DEFAULT_CONFIG.publisherId,
      adsTxtPath: env.ADSENSE_ADS_TXT_PATH || DEFAULT_CONFIG.adsTxtPath,
      consentRequired: env.ADSENSE_CONSENT_REQUIRED !== "false",
      testMode: env.ADSENSE_TEST_MODE === "true" || env.ADSENSE_TEST_MODE === true,
      ...overrides,
    };
  } catch {
    return { ...DEFAULT_CONFIG, ...overrides };
  }
}

export const CONSENT_STATES = {
  UNKNOWN: "unknown",
  ACCEPTED: "accepted",
  DECLINED: "declined",
};

export function createAdSenseProvider(configOverrides = {}) {
  const config = getConfig(configOverrides);
  let scriptLoaded = false;
  let scriptError = false;
  let consentState = config.consentRequired ? CONSENT_STATES.UNKNOWN : CONSENT_STATES.ACCEPTED;

  function isAvailable() {
    return config.enabled && !!config.publisherId && !scriptError;
  }

  function getPublisherId() {
    return config.publisherId || null;
  }

  function isTestMode() {
    return config.testMode;
  }

  function hasConsent() {
    return consentState === CONSENT_STATES.ACCEPTED;
  }

  function getConsentState() {
    return consentState;
  }

  function setConsent(granted) {
    if (granted === true || granted === CONSENT_STATES.ACCEPTED) {
      consentState = CONSENT_STATES.ACCEPTED;
    } else if (granted === false || granted === CONSENT_STATES.DECLINED) {
      consentState = CONSENT_STATES.DECLINED;
    } else if (granted === CONSENT_STATES.UNKNOWN) {
      consentState = CONSENT_STATES.UNKNOWN;
    } else {
      consentState = !!granted ? CONSENT_STATES.ACCEPTED : CONSENT_STATES.DECLINED;
    }
  }

  function loadScript() {
    if (typeof window === "undefined") return Promise.resolve(false);
    if (scriptLoaded) return Promise.resolve(true);
    if (!config.publisherId) return Promise.resolve(false);

    return new Promise((resolve) => {
      try {
        const existing = document.querySelector(`script[src*="pagead2.googlesyndication.com"]`);
        if (existing) {
          scriptLoaded = true;
          resolve(true);
          return;
        }

        const script = document.createElement("script");
        script.src = `${ADSENSE_SCRIPT_URL}?ca=pub-${config.publisherId}`;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.onload = () => { scriptLoaded = true; resolve(true); };
        script.onerror = () => { scriptError = true; resolve(false); };

        document.head.appendChild(script);
      } catch {
        scriptError = true;
        resolve(false);
      }
    });
  }

  function renderAd(container, { format = "auto", responsive = true } = {}) {
    if (!container || !isAvailable() || !hasConsent()) return { ok: false, reason: "unavailable" };
    if (!scriptLoaded) return { ok: false, reason: "script-not-loaded" };

    try {
      const adElement = document.createElement("ins");
      adElement.className = "adsbygoogle";
      adElement.style.display = "block";
      adElement.setAttribute("data-ad-client", `ca-pub-${config.publisherId}`);
      adElement.setAttribute("data-ad-slot", "0");
      if (format) adElement.setAttribute("data-ad-format", format);
      if (responsive) adElement.setAttribute("data-full-width-responsive", "true");

      container.innerHTML = "";
      container.appendChild(adElement);

      if (window.adsbygoogle) {
        window.adsbygoogle.push({});
      }

      return { ok: true };
    } catch {
      return { ok: false, reason: "render-failed" };
    }
  }

  function getConfigSummary() {
    return {
      enabled: config.enabled,
      publisherId: config.publisherId ? `ca-pub-${config.publisherId.slice(0, 4)}...` : null,
      testMode: config.testMode,
      consentRequired: config.consentRequired,
      consentState,
      consentGranted: hasConsent(),
      scriptLoaded,
      scriptError,
      available: isAvailable(),
    };
  }

  return {
    isAvailable,
    getPublisherId,
    isTestMode,
    hasConsent,
    getConsentState,
    setConsent,
    loadScript,
    renderAd,
    getConfigSummary,
  };
}

export function generateAdsTxt(publisherId) {
  if (!publisherId) return null;
  return `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0`;
}
