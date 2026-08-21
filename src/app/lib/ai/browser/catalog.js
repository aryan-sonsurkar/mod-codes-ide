export const CATALOG_VERSION = 1;

export const BONSAI_MODEL_TIERS = [
  {
    id: "bonsai-1.7b",
    displayName: "Bonsai 1.7B",
    architecture: "qwen3",
    source: {
      repo: "prism-ml/Bonsai-1.7B-gguf",
      revision: "210a9e99f79cb184909d49595906526eb2b3dd9a",
      file: "Bonsai-1.7B-Q1_0.gguf",
      bytes: 248302272,
      sha256: null,
    },
    files: [
      {
        path: "1_7b/Bonsai-1.7B-Q1_0.gguf-00001-of-00001.gguf",
        bytes: 248302336,
        sha256: null,
        url:
          "https://huggingface.co/WaveCut/Bonsai-web-GGUF/resolve/112ea7a1a6229bde132b176b9a72477a7ecfde64/1_7b/Bonsai-1.7B-Q1_0.gguf-00001-of-00001.gguf",
      },
    ],
    downloadBytes: 248302336,
    contextLength: 32768,
    defaultContext: 4096,
    cpuFallback: true,
    largestTensorBytes: 43680672,
    requiredLimits: { maxStorageBufferBindingSize: 43680672 },
    runtimePolicy: { flashAttention: false, tokenEmbeddingOnWebGPU: true },
    chatTemplate: {
      markers: { think: true, toolCall: true, toolResponse: true },
    },
    tokenizer: {
      tokenizerJsonUrl:
        "https://huggingface.co/onnx-community/Bonsai-1.7B-ONNX/resolve/main/tokenizer.json",
      tokenizerConfigUrl:
        "https://huggingface.co/onnx-community/Bonsai-1.7B-ONNX/resolve/main/tokenizer_config.json",
    },
    note:
      "Only the 1.7B tier is shipped in this phase. 4B/8B/27B tiers exist in the WaveCut/Bonsai-web-GGUF manifest but their full metadata is not yet verified; they are not advertised to users.",
  },
];

export function getModelById(id) {
  return BONSAI_MODEL_TIERS.find((model) => model.id === id) || null;
}

export function listModels() {
  return BONSAI_MODEL_TIERS.map((model) => model.id);
}

export function modelVersionKey(model) {
  return `${model.source.revision}:${model.source.sha256 || "unverified"}`;
}

export function modelDownloadBytes(model) {
  return model.downloadBytes;
}

export function isDownloadAllowed(model) {
  return Boolean(
    model &&
      model.source &&
      model.source.repo &&
      Array.isArray(model.files) &&
      model.files.length > 0 &&
      model.files.every((file) => typeof file.url === "string" && file.url.length > 0)
  );
}