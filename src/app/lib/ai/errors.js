export const AI_ERRORS = {
  unavailable: "unavailable",
  connectionFailed: "connectionFailed",
  modelNotFound: "modelNotFound",
  unsupported: "unsupported",
  timeout: "timeout",
  rateLimited: "rateLimited",
  invalidRequest: "invalidRequest",
  cancelled: "cancelled",
};

export class AiError extends Error {
  constructor(code, message, { retryable = false, cause = null } = {}) {
    super(message || code);
    this.name = "AiError";
    this.code = code;
    this.retryable = retryable;
    this.cause = cause;
  }
}

export function aiError(code, message, options) {
  return new AiError(code, message, options);
}

export function isAiError(error) {
  return error instanceof AiError;
}

export function normalizeAiError(error, fallbackCode = AI_ERRORS.invalidRequest) {
  if (isAiError(error)) {
    return error;
  }

  const message =
    error && typeof error.message === "string"
      ? error.message
      : String(error || "Unknown AI error");

  return new AiError(fallbackCode, message, { cause: error });
}