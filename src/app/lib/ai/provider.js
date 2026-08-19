import { AI_ERRORS, AiError } from "./errors";

export const KNOWN_PROVIDER_CAPABILITIES = new Set([
  "chat",
  "streaming",
  "tools",
  "embeddings",
  "vision",
]);

export function normalizeProviderCapabilities(capabilities) {
  return [...new Set(capabilities)].filter((capability) =>
    KNOWN_PROVIDER_CAPABILITIES.has(capability)
  );
}

export function createProviderDescriptor({ id, name, capabilities = [] }) {
  return {
    id,
    name,
    capabilities: normalizeProviderCapabilities(capabilities),
  };
}

export function assertProviderShape(provider) {
  if (!provider || typeof provider !== "object") {
    throw new AiError(AI_ERRORS.invalidRequest, "Provider must be an object.");
  }

  if (typeof provider.id !== "string" || provider.id.length === 0) {
    throw new AiError(AI_ERRORS.invalidRequest, "Provider requires an id.");
  }

  if (typeof provider.name !== "string" || provider.name.length === 0) {
    throw new AiError(AI_ERRORS.invalidRequest, "Provider requires a name.");
  }

  const required = ["getModels", "chat", "getCapabilities"];
  for (const method of required) {
    if (typeof provider[method] !== "function") {
      throw new AiError(
        AI_ERRORS.invalidRequest,
        `Provider "${provider.id}" is missing required method: ${method}`
      );
    }
  }

  if (
    provider.getCapabilities !== undefined &&
    typeof provider.getCapabilities !== "function"
  ) {
    throw new AiError(
      AI_ERRORS.invalidRequest,
      `Provider "${provider.id}" has an invalid getCapabilities.`
    );
  }

  if (
    provider.streamChat !== undefined &&
    typeof provider.streamChat !== "function"
  ) {
    throw new AiError(
      AI_ERRORS.invalidRequest,
      `Provider "${provider.id}" has an invalid streamChat.`
    );
  }

  return true;
}

/**
 * The provider contract:
 *
 * interface AiProvider {
 *   id: string;
 *   name: string;
 *   getCapabilities(): ProviderCapabilities;
 *   getModels(): Promise<AiModel[]>;
 *   chat(request: AiRequest): Promise<ChatResult>;
 *   streamChat?(request: AiRequest): Promise<AsyncIterable<StreamChunk>>;
 *   testConnection?(): Promise<{ ok: boolean }>;
 * }
 *
 * Providers never leak raw fetch errors; all failures are normalized to
 * AiError with a code from AI_ERRORS.
 */
export function defineProvider(provider) {
  assertProviderShape(provider);
  return provider;
}