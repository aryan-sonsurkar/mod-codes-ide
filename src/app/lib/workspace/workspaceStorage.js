const WORKSPACE_KEY = "modcodes-workspace";

export function loadWorkspace() {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

export function saveWorkspace(state) {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state));
  } catch (error) {
    // ignore storage failures (private mode, quota)
  }
}
