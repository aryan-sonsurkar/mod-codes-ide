import { PROVIDER_STATES } from "../providerStates";
import { MODEL_STATES } from "./registry";

/**
 * A model can serve chat traffic once its weights are on disk (`downloaded`)
 * or once the engine is resident (`ready`). Gating only on `downloaded` locked
 * the chat input permanently after the first reply, because loading the engine
 * flips the state to `ready`.
 */
export function isModelUsableForChat(info) {
  if (!info) {
    return false;
  }
  return (
    info.state === MODEL_STATES.downloaded || info.state === MODEL_STATES.ready
  );
}

/**
 * True when the chat input must be disabled.
 *
 * Pure so it can be unit tested without mounting the panel.
 */
export function isBonsaiInputDisabled({
  status,
  providerId,
  browserModelInfo,
} = {}) {
  if (status !== PROVIDER_STATES.ready) {
    return true;
  }
  if (providerId !== "browser-bonsai") {
    return false;
  }
  return !isModelUsableForChat(browserModelInfo);
}
