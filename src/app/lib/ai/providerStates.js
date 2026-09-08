/**
 * Unified provider states for the AI provider abstraction.
 *
 * Every provider (Ollama, Bonsai, future providers) maps its internal
 * states to these canonical states. The UI uses only these states
 * to render provider status.
 */
export const PROVIDER_STATES = {
  /** Initial state, no check performed yet */
  unknown: "unknown",
  /** Probing connection, listing models, or initializing */
  checking: "checking",
  /** Connected and at least one model is available */
  ready: "ready",
  /** Connected but no models are available */
  idle: "idle",
  /** Model loading, engine initializing, or download in progress */
  busy: "busy",
  /** Connection failed, server not reachable, or network error */
  unavailable: "unavailable",
  /** Provider exists but is not supported in this environment */
  unsupported: "unsupported",
  /** Connected but with degraded capabilities (e.g., slow, partial) */
  degraded: "degraded",
};

/**
 * Human-readable labels for provider states.
 */
export const PROVIDER_STATE_LABELS = {
  [PROVIDER_STATES.unknown]: "Checking…",
  [PROVIDER_STATES.checking]: "Checking connection…",
  [PROVIDER_STATES.ready]: "Ready",
  [PROVIDER_STATES.idle]: "Connected (no models)",
  [PROVIDER_STATES.busy]: "Loading…",
  [PROVIDER_STATES.unavailable]: "Not reachable",
  [PROVIDER_STATES.unsupported]: "Not supported",
  [PROVIDER_STATES.degraded]: "Connected (degraded)",
};

/**
 * Returns a human-readable label for a provider state.
 */
export function providerStateLabel(state, providerId = null) {
  const base = PROVIDER_STATE_LABELS[state] || PROVIDER_STATE_LABELS[PROVIDER_STATES.unknown];
  if (providerId === "browser-bonsai") {
    if (state === PROVIDER_STATES.unavailable) return "Bonsai is not ready";
    if (state === PROVIDER_STATES.ready) return "Bonsai ready";
    if (state === PROVIDER_STATES.unsupported) return "WebGPU not available";
  }
  if (providerId === "ollama") {
    if (state === PROVIDER_STATES.unavailable) return "Ollama is not reachable";
    if (state === PROVIDER_STATES.ready) return "Ollama connected";
    if (state === PROVIDER_STATES.idle) return "Ollama connected (no models)";
  }
  return base;
}

/**
 * CSS class name for a provider state (used for status coloring).
 */
export function providerStateClass(state) {
  switch (state) {
    case PROVIDER_STATES.ready:
      return "ai-status-ok";
    case PROVIDER_STATES.unavailable:
    case PROVIDER_STATES.unsupported:
      return "ai-status-error";
    case PROVIDER_STATES.busy:
    case PROVIDER_STATES.checking:
      return "ai-status-busy";
    case PROVIDER_STATES.degraded:
      return "ai-status-warning";
    default:
      return "";
  }
}
