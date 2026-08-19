import { AI_ERRORS, AiError } from "./errors";
import { assertProviderShape } from "./provider";

const providers = new Map();

export function registerProvider(provider) {
  assertProviderShape(provider);

  if (providers.has(provider.id)) {
    throw new AiError(
      AI_ERRORS.invalidRequest,
      `Provider "${provider.id}" is already registered.`
    );
  }

  providers.set(provider.id, provider);
  return provider;
}

export function getProvider(providerId) {
  if (typeof providerId !== "string") {
    return null;
  }
  return providers.get(providerId) || null;
}

export function listProviders() {
  return Array.from(providers.values());
}

export function hasProvider(providerId) {
  return typeof providerId === "string" && providers.has(providerId);
}

export function clearProviders() {
  providers.clear();
}