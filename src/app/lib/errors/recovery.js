export const RECOVERY_ACTIONS = {
  retry: "retry",
  pairBridge: "pairBridge",
  checkOllama: "checkOllama",
  enableWebGPU: "enableWebGPU",
  clearCache: "clearCache",
  reloadFile: "reloadFile",
  saveConflict: "saveConflict",
  retryPermission: "retryPermission",
};

export function recoveryForError(error) {
  const code = error && error.code ? error.code : null;
  const rawMessage = error && typeof error.message === "string" ? error.message : "";
  const message = rawMessage;
  const lower = rawMessage.toLowerCase();

  if (code === "cancelled") {
    return { message: "Generation was stopped.", action: RECOVERY_ACTIONS.retry, hint: "Try again or refine your prompt." };
  }
  if (lower.includes("bridge not paired") || lower.includes("x-bridge-token")) {
    return { message: "Local terminal bridge is not paired.", action: RECOVERY_ACTIONS.pairBridge, hint: "Start the bridge (node tools/modcodes-bridge/server.js) and paste the token in Settings → Terminal." };
  }
  if (lower.includes("bridge unreachable") || lower.includes("bridge error")) {
    return { message: "Local terminal bridge is not connected.", action: RECOVERY_ACTIONS.pairBridge, hint: "Start the bridge on localhost:8787 and ensure the token matches." };
  }
  if (code === "connectionFailed" || lower.includes("ollama is not reachable")) {
    return { message: "Ollama is not reachable.", action: RECOVERY_ACTIONS.checkOllama, hint: "Run `ollama serve` and `ollama pull <model>`, then Test connection in Settings." };
  }
  if (code === "unsupported" && message.includes("WebGPU")) {
    return { message: "WebGPU is not available.", action: RECOVERY_ACTIONS.enableWebGPU, hint: "Use Chrome/Edge desktop with WebGPU enabled, or switch to Ollama." };
  }
  if (message.includes("QuotaExceeded") || lower.includes("storage")) {
    return { message: "Browser storage is full.", action: RECOVERY_ACTIONS.clearCache, hint: "Clear the AI cache in Settings → AI & Coder or free browser storage." };
  }
  if (code === "conflict" || lower.includes("conflict")) {
    return { message: "File changed outside MODCODES.", action: RECOVERY_ACTIONS.saveConflict, hint: "Reload to keep disk version or Overwrite to keep your changes." };
  }
  if (message.includes("Permission") || lower.includes("denied")) {
    return { message: "Permission was denied.", action: RECOVERY_ACTIONS.retryPermission, hint: "Grant folder access again or retry the operation." };
  }
  return { message: message || "Something went wrong.", action: RECOVERY_ACTIONS.retry, hint: "Retry the operation. If it persists, check the console for details." };
}
