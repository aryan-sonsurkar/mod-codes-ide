const DEFAULT_BRIDGE_URL = "http://127.0.0.1:8787";
const TOKEN_STORAGE_KEY = "modcodes.bridge.token";
const memoryStore = new Map();

export function getBridgeToken() {
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
      const v = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (v !== null) {
        return v;
      }
    }
  } catch {}
  return memoryStore.get(TOKEN_STORAGE_KEY) || null;
}

export function setBridgeToken(token) {
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.setItem === "function") {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  } catch {}
  if (token) {
    memoryStore.set(TOKEN_STORAGE_KEY, token);
  } else {
    memoryStore.delete(TOKEN_STORAGE_KEY);
  }
}

export function clearBridgeToken() {
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.removeItem === "function") {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {}
  memoryStore.delete(TOKEN_STORAGE_KEY);
}

export async function checkBridgeHealth(bridgeUrl = DEFAULT_BRIDGE_URL) {
  try {
    const res = await fetch(`${bridgeUrl}/health`, { method: "GET" });
    if (!res.ok) {
      return { ok: false, reason: `Bridge responded ${res.status}` };
    }
    const data = await res.json();
    return { ok: Boolean(data.ok), reason: null };
  } catch (error) {
    return { ok: false, reason: error && error.message ? error.message : "Bridge unreachable" };
  }
}

export function createSystemTerminalBackend({ bridgeUrl = DEFAULT_BRIDGE_URL, getToken = getBridgeToken, readDirectory, getRootPath } = {}) {
  let currentSessionId = null;
  let currentCwd = null;

  async function ensureSession() {
    if (currentSessionId) {
      return currentSessionId;
    }
    const token = typeof getToken === "function" ? getToken() : null;
    if (!token) {
      throw new Error("Local bridge token not set. Pair the bridge first.");
    }
    const res = await fetch(`${bridgeUrl}/terminals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bridge-token": token },
      body: JSON.stringify({ cwd: typeof getRootPath === "function" ? getRootPath() : undefined }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error ${res.status}`);
    }
    const data = await res.json();
    if (!data.ok || !data.id) {
      throw new Error(data.error || "Failed to create terminal session");
    }
    currentSessionId = data.id;
    currentCwd = data.cwd || null;
    return currentSessionId;
  }

  return {
    label: "System terminal (localhost bridge)",
    bridgeUrl,
    reset() {
      currentSessionId = null;
      currentCwd = null;
    },
    async execute(command) {
      const trimmed = typeof command === "string" ? command.trim() : "";
      if (!trimmed) {
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      // special built-ins that do not require bridge
      if (trimmed.toLowerCase() === "clear") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      const token = typeof getToken === "function" ? getToken() : null;
      if (!token) {
        return { stdout: "", stderr: "Local bridge not paired. Open Settings → Terminal and enter the bridge token from the bridge console.", exitCode: 1 };
      }
      try {
        const sessionId = await ensureSession();
        const res = await fetch(`${bridgeUrl}/terminals/${sessionId}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-bridge-token": token },
          body: JSON.stringify({ command: trimmed }),
        });
        if (!res.ok) {
          const text = await res.text();
          return { stdout: "", stderr: text || `Bridge error ${res.status}`, exitCode: 1 };
        }
        const data = await res.json();
        if (data.cwd) {
          currentCwd = data.cwd;
        }
        return { stdout: data.stdout || "", stderr: data.stderr || "", exitCode: data.exitCode ?? 0 };
      } catch (error) {
        return { stdout: "", stderr: error && error.message ? error.message : "Bridge unreachable", exitCode: 1 };
      }
    },
    async kill() {
      if (!currentSessionId) {
        return;
      }
      const token = typeof getToken === "function" ? getToken() : null;
      if (!token) {
        return;
      }
      try {
        await fetch(`${bridgeUrl}/terminals/${currentSessionId}/kill`, {
          method: "POST",
          headers: { "x-bridge-token": token },
        });
      } catch {}
      currentSessionId = null;
    },
    async getCwd() {
      return currentCwd;
    },
  };
}
