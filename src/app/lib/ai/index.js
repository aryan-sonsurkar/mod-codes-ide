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
  MODCODES_CODER_PROVIDER_ID,
  MODCODES_CODER_PROVIDER_NAME,
  MODCODES_CODER_VERSION,
  MODCODES_CODER_CAPABILITIES,
  createModcodesCoderProvider,
  registerModcodesCoderProvider,
} from "./providers/modcodesCoder";
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
  describeDeviceTier,
  recommendModels,
  summarizeHardware,
} from "./hardware";
export { createAiSession } from "./session";
export {
  normalizeStats,
  formatTokensPerSecond,
  formatDurationMs,
  createStatsTracker,
} from "./instrumentation";
export {
  CONVERSATION_ROLES,
  CONVERSATION_STATES,
  createMessage,
  createConversation,
  appendMessage,
  updateMessage,
  clearConversation,
  conversationToHistory,
  resetMessageIdForTests,
} from "./conversation";
export {
  CODE_ACTION_IDS,
  CODE_ACTIONS,
  getCodeAction,
  buildCodeActionPrompt,
  isSelectionRequired,
} from "./codeActions";
export {
  computeChangedRanges,
  createDiff,
  acceptDiff,
  rejectDiff,
  createDiffSession,
  createMultiFileDiffSession,
  resetDiffIdForTests,
} from "./diffEngine";
export {
  WORKSPACE_COMMAND_IDS,
  WORKSPACE_COMMANDS,
  getWorkspaceCommand,
  buildWorkspacePrompt,
} from "./workspaceCommands";
export {
  REFERENCE_TYPES,
  createReference,
  parseReferencesFromText,
  referencesFromDiagnostics,
  referencesFromSymbols,
} from "./references";
export {
  requiresApproval,
  approvalRequestFor,
  canAutoRun,
} from "./toolApproval";
export {
  loadConversations,
  saveConversations,
  createStoredConversation,
  clearConversations,
  CONVERSATION_STORAGE_KEY,
} from "./conversationStorage";
export {
  CAPABILITIES,
  normalizeCapabilities,
  hasCapability,
  describeCapability as describeAiCapability,
  capabilityStatus,
} from "./capabilities";
export {
  CHANGESET_OPERATIONS,
  CHANGESET_STATUSES,
  createChangesetOperation,
  createChangeset,
  changesetSummary,
  approveOperation,
  rejectOperation,
  applyOperation,
  canApply,
  resetChangesetIdsForTests,
} from "./changeset";
export {
  createActionEntry,
  createActionHistory,
  resetActionIdForTests,
} from "./actionHistory";
export {
  TASK_STATES,
  STEP_STATES,
  createAgentTask,
  createAgentStep,
  createAgentSession,
  resetAgentIdsForTests,
} from "./agentTask";
export {
  rankWorkspaceContext,
} from "./relevanceRanking";
export {
  measureContextBuild,
  createContextCache,
} from "./contextPerformance";
export {
  WEBGPU_STATES,
  WEBGPU_REASONS,
  getGpuObject,
  requestAdapter,
  requestDevice,
  readAdapterInfo,
  readAdapterLimits,
  watchDeviceLost,
  detectWebGpuCapability,
  isWebGpuAvailable,
  describeCapability,
} from "./browser";
export {
  BONSAI_MODEL_TIERS,
  getModelById,
  listModels,
  modelVersionKey,
  modelDownloadBytes,
  isDownloadAllowed,
} from "./browser";
export {
  WEIGHT_CACHE_NAME,
  openWeightCache,
  hasCachedWeight,
  cacheWeight,
  removeCachedWeight,
  listCachedWeightUrls,
  weightCacheContainsModel,
  createIndexedDbStore,
  normalizeStorageError,
} from "./browser";
export {
  MODEL_STATES,
  isWebGpuCapable,
  checkModelCompatibility,
  baseModelState,
  createModelRegistry,
} from "./browser";
export {
  BONSAI_PROVIDER_ID,
  BONSAI_PROVIDER_NAME,
  BONSAI_CAPABILITIES,
  isAbortError,
  mapRuntimeError,
} from "./browser";
export { createBrowserBonsaiProvider } from "./browser";
export { createBrowserWorker, createBrowserRuntime } from "./browser";
export {
  DOWNLOAD_STATES,
  formatBytes,
  downloadPercent,
  describeDownload,
  createIdleProgress,
  isAbortedError,
  downloadModel,
} from "./browser";
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
  budgetForModel,
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