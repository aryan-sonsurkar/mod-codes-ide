export const QUANT_FACTORS = {
  Q2_K: 0.25,
  Q3_K_M: 0.375,
  Q4_0: 0.5,
  Q4_K_M: 0.5,
  Q4_K_S: 0.47,
  Q5_0: 0.58,
  Q5_K_M: 0.6,
  Q5_K_S: 0.58,
  Q6_K: 0.75,
  Q8_0: 1.0,
  FP16: 2.0,
};

export const MODEL_KINDS = ["code", "general", "reasoning"];

export function quantizationBytesPerParam(tag) {
  if (typeof tag !== "string") {
    return null;
  }
  const factor = QUANT_FACTORS[tag.toUpperCase()];
  return typeof factor === "number" ? factor : null;
}

export const MODEL_CATALOG = [
  {
    id: "qwen2.5-coder:1.5b",
    base: "qwen2.5-coder",
    name: "Qwen2.5 Coder 1.5B",
    provider: "ollama",
    kind: "code",
    tags: ["code", "small", "fast"],
    contextLength: 32768,
    parametersB: 1.5,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 4, recommendedRamGb: 8 },
  },
  {
    id: "qwen2.5-coder:3b",
    base: "qwen2.5-coder",
    name: "Qwen2.5 Coder 3B",
    provider: "ollama",
    kind: "code",
    tags: ["code", "small"],
    contextLength: 32768,
    parametersB: 3.1,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 6, recommendedRamGb: 8 },
  },
  {
    id: "qwen2.5-coder:7b",
    base: "qwen2.5-coder",
    name: "Qwen2.5 Coder 7B",
    provider: "ollama",
    kind: "code",
    tags: ["code"],
    contextLength: 32768,
    parametersB: 7.6,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 8, recommendedRamGb: 16 },
  },
  {
    id: "qwen2.5-coder:14b",
    base: "qwen2.5-coder",
    name: "Qwen2.5 Coder 14B",
    provider: "ollama",
    kind: "code",
    tags: ["code", "high-quality"],
    contextLength: 32768,
    parametersB: 14.8,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 16, recommendedRamGb: 24 },
  },
  {
    id: "qwen2.5-coder:32b",
    base: "qwen2.5-coder",
    name: "Qwen2.5 Coder 32B",
    provider: "ollama",
    kind: "code",
    tags: ["code", "high-quality"],
    contextLength: 32768,
    parametersB: 32.8,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 24, recommendedRamGb: 32 },
  },
  {
    id: "deepseek-coder-v2:16b",
    base: "deepseek-coder-v2",
    name: "DeepSeek Coder V2 16B",
    provider: "ollama",
    kind: "code",
    tags: ["code", "moe"],
    contextLength: 131072,
    parametersB: 236,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 16, recommendedRamGb: 24 },
  },
  {
    id: "codellama:7b-code",
    base: "codellama",
    name: "Code Llama 7B (code)",
    provider: "ollama",
    kind: "code",
    tags: ["code", "fim"],
    contextLength: 16384,
    parametersB: 6.7,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 8, recommendedRamGb: 16 },
  },
  {
    id: "starcoder2:7b",
    base: "starcoder2",
    name: "StarCoder2 7B",
    provider: "ollama",
    kind: "code",
    tags: ["code", "fim"],
    contextLength: 16384,
    parametersB: 7.3,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 8, recommendedRamGb: 16 },
  },
  {
    id: "llama3.2:1b",
    base: "llama3.2",
    name: "Llama 3.2 1B",
    provider: "ollama",
    kind: "general",
    tags: ["general", "small", "fast"],
    contextLength: 131072,
    parametersB: 1.2,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 4, recommendedRamGb: 8 },
  },
  {
    id: "llama3.2:3b",
    base: "llama3.2",
    name: "Llama 3.2 3B",
    provider: "ollama",
    kind: "general",
    tags: ["general", "small"],
    contextLength: 131072,
    parametersB: 3.2,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 6, recommendedRamGb: 8 },
  },
  {
    id: "llama3.1:8b",
    base: "llama3.1",
    name: "Llama 3.1 8B",
    provider: "ollama",
    kind: "general",
    tags: ["general"],
    contextLength: 131072,
    parametersB: 8.0,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 8, recommendedRamGb: 16 },
  },
  {
    id: "phi3:mini",
    base: "phi3",
    name: "Phi-3 Mini",
    provider: "ollama",
    kind: "general",
    tags: ["general", "small"],
    contextLength: 131072,
    parametersB: 3.8,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 4, recommendedRamGb: 8 },
  },
  {
    id: "gemma2:9b",
    base: "gemma2",
    name: "Gemma 2 9B",
    provider: "ollama",
    kind: "general",
    tags: ["general"],
    contextLength: 8192,
    parametersB: 9.2,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 8, recommendedRamGb: 16 },
  },
  {
    id: "mistral:7b",
    base: "mistral",
    name: "Mistral 7B",
    provider: "ollama",
    kind: "general",
    tags: ["general"],
    contextLength: 32768,
    parametersB: 7.24,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 8, recommendedRamGb: 16 },
  },
  {
    id: "deepseek-r1:7b",
    base: "deepseek-r1",
    name: "DeepSeek R1 Distill 7B",
    provider: "ollama",
    kind: "reasoning",
    tags: ["reasoning"],
    contextLength: 32768,
    parametersB: 7.6,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 8, recommendedRamGb: 16 },
  },
  {
    id: "deepseek-r1:14b",
    base: "deepseek-r1",
    name: "DeepSeek R1 Distill 14B",
    provider: "ollama",
    kind: "reasoning",
    tags: ["reasoning"],
    contextLength: 32768,
    parametersB: 14.8,
    quantizations: ["Q4_K_M", "Q8_0"],
    footprint: { minRamGb: 16, recommendedRamGb: 24 },
  },
];

export function findModel(query) {
  if (typeof query !== "string" || query.length === 0) {
    return null;
  }
  return (
    MODEL_CATALOG.find((entry) => entry.id === query) ||
    MODEL_CATALOG.find((entry) => entry.base === query) ||
    null
  );
}

export function filterModels({
  kind = null,
  provider = "ollama",
  maxRamGb = null,
  quantTag = "Q4_K_M",
} = {}) {
  return MODEL_CATALOG.filter((entry) => {
    if (entry.provider !== provider) {
      return false;
    }
    if (kind && entry.kind !== kind) {
      return false;
    }
    if (maxRamGb != null && entry.footprint.minRamGb > maxRamGb) {
      return false;
    }
    return true;
  }).map((entry) => ({
    ...entry,
    estimatedRamGb: estimateModelRamGb(entry, { quantTag }),
  }));
}

export function estimateModelRamGb(model, { quantTag = "Q4_K_M", overheadGb = 0.5 } = {}) {
  const factor = quantizationBytesPerParam(quantTag);
  if (!model || typeof model.parametersB !== "number" || factor === null) {
    return null;
  }
  const weightGb = model.parametersB * factor;
  return Math.round((weightGb + overheadGb) * 10) / 10;
}

export function listModelKinds() {
  return [...MODEL_KINDS];
}