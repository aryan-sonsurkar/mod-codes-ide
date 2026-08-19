const KNOWN_CAPABILITIES = new Set([
  "chat",
  "streaming",
  "tools",
  "embeddings",
  "vision",
]);

export function isKnownCapability(capability) {
  return KNOWN_CAPABILITIES.has(capability);
}

export class AiModel {
  constructor({
    id,
    name,
    provider,
    capabilities = [],
    contextLength = null,
    metadata = {},
  }) {
    if (typeof id !== "string" || id.length === 0) {
      throw new TypeError("AiModel requires an id");
    }
    if (typeof provider !== "string" || provider.length === 0) {
      throw new TypeError("AiModel requires a provider id");
    }

    this.id = id;
    this.name = typeof name === "string" && name.length > 0 ? name : id;
    this.provider = provider;
    this.capabilities = [...new Set(capabilities)];
    this.contextLength =
      Number.isFinite(contextLength) && contextLength > 0
        ? contextLength
        : null;
    this.metadata = metadata && typeof metadata === "object" ? metadata : {};
  }

  supports(capability) {
    return this.capabilities.includes(capability);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      capabilities: this.capabilities,
      contextLength: this.contextLength,
      metadata: this.metadata,
    };
  }
}

export function createModel(definition) {
  return new AiModel(definition);
}