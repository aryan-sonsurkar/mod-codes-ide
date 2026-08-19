import { WORKSPACE_VERSION, normalizeWorkspace } from "./workspaceRecovery";

const WORKSPACE_KEY = "modcodes.ide.workspace.v2";
const LEGACY_WORKSPACE_KEY = "modcodes-workspace";

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // ignore storage failures (private mode, quota)
  }
}

export function loadWorkspace() {
  const current = normalizeWorkspace(readJson(WORKSPACE_KEY));

  if (current) {
    return current;
  }

  const legacy = normalizeWorkspace(readJson(LEGACY_WORKSPACE_KEY));
  if (legacy) {
    writeJson(WORKSPACE_KEY, legacy);
  }

  return legacy;
}

export function saveWorkspace(state) {
  const normalized = normalizeWorkspace({
    ...state,
    savedAt: Date.now(),
  });
  if (!normalized) {
    return;
  }

  writeJson(WORKSPACE_KEY, {
    ...normalized,
    version: WORKSPACE_VERSION,
  });
}