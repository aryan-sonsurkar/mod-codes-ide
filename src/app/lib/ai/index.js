export { AI_ERRORS, AiError, aiError, isAiError, normalizeAiError } from "./errors";
export { AiModel, createModel, isKnownCapability } from "./model";
export { createAiRequest, normalizeMessage, normalizeMessages } from "./request";
export {
  STREAM_EVENTS,
  textChunk,
  doneChunk,
  errorChunk,
  toolChunk,
  isStreamChunk,
  createChatResult,
  createChatFailure,
} from "./response";
export {
  readLineStream,
  parseJsonLines,
  collectStreamText,
} from "./streaming";
export {
  KNOWN_PROVIDER_CAPABILITIES,
  normalizeProviderCapabilities,
  createProviderDescriptor,
  assertProviderShape,
  defineProvider,
} from "./provider";
export {
  registerProvider,
  getProvider,
  listProviders,
  hasProvider,
  clearProviders,
} from "./registry";
export {
  OLLAMA_PROVIDER_ID,
  OLLAMA_PROVIDER_NAME,
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_CAPABILITIES,
  normalizeBaseUrl,
  parseModelTag,
  mapOptions,
  serializeToolsForOllama,
  parseToolArguments,
  toolCallsFromMessage,
  toModel,
  ollamaStatusError,
  connectionError,
  createOllamaProvider,
  registerOllamaProvider,
} from "./providers";
export {
  MODEL_CATALOG,
  MODEL_KINDS,
  QUANT_FACTORS,
  quantizationBytesPerParam,
  findModel,
  filterModels,
  estimateModelRamGb,
  listModelKinds,
} from "./catalog";
export {
  detectDeviceMemory,
  detectCpuCores,
  detectGpuInfo,
  createHardwareProfile,
  hardwareTier,
  recommendModels,
  summarizeHardware,
} from "./hardware";
export { createAiSession } from "./session";
export {
  PERMISSION_LEVELS,
  PERMISSION_ORDER,
  AUTO_SAFE_LEVEL,
  permissionAllows,
  validateArgs,
  createTool,
  createToolRegistry,
  executeToolCall,
  BUILTIN_READONLY_TOOLS,
  getBuiltinTool,
} from "./tools";
export {
  CONTEXT_PRIORITY,
  CONTEXT_TYPES,
  createContextItem,
  contextItemLength,
  markTruncated,
  DEFAULT_CONTEXT_BUDGET,
  BUDGET_LIMITS,
  clampBudget,
  estimatedTokens,
  buildBudget,
  isSecretPath,
  excludeSecretPaths,
  currentFileSource,
  selectionSource,
  openDocumentsSource,
  symbolsSource,
  diagnosticsSource,
  graphSource,
  searchSource,
  explicitFilesSource,
  buildContext,
  createFallbackContext,
  buildContextPreview,
  serializeContextItems,
} from "./context";