export const CAPABILITIES = {
  chat: "chat",
  streaming: "streaming",
  cancellation: "cancellation",
  tools: "tools",
  vision: "vision",
  largeContext: "largeContext",
  local: "local",
  browser: "browser",
  fileEditing: "fileEditing",
  structuredOutput: "structuredOutput",
  statistics: "statistics",
};

export function normalizeCapabilities(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const allowed = new Set(Object.values(CAPABILITIES));
  return [...new Set(list.filter((item) => typeof item === "string" && allowed.has(item)))];
}

export function hasCapability(providerOrModel, capability) {
  if (!providerOrModel || typeof capability !== "string") {
    return false;
  }
  const caps = providerOrModel.capabilities || providerOrModel.details?.capabilities || [];
  return Array.isArray(caps) && caps.includes(capability);
}

export function describeCapability(capability) {
  const labels = {
    chat: "Chat",
    streaming: "Streaming",
    cancellation: "Cancellation",
    tools: "Tools",
    vision: "Vision",
    largeContext: "Large context",
    local: "Local",
    browser: "Browser",
    fileEditing: "File editing",
    structuredOutput: "Structured output",
    statistics: "Statistics",
  };
  return labels[capability] || capability;
}

export function capabilityStatus(capability, supported) {
  return {
    capability,
    label: describeCapability(capability),
    supported: Boolean(supported),
  };
}
