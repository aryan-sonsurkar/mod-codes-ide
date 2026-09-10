export {
  createLogger,
  setLogLevel,
  addLogHandler,
  setVersion,
  setEnvironment,
  sanitizeContext,
  sanitize,
  LEVELS,
  LEVEL_NAMES,
  SENSITIVE_KEYS,
} from "./logger.js";

export {
  captureError,
  getRecentErrors,
  getErrorCount,
  clearErrors,
  addErrorHandler,
  setVersion as setErrorCollectorVersion,
  setEnvironment as setErrorCollectorEnvironment,
  sanitizeStack,
  classifySeverity,
} from "./errorCollector.js";

export {
  initGlobalErrorHandlers,
  destroyGlobalErrorHandlers,
  isGlobalErrorHandlersInitialized,
} from "./globalHandlers.js";
