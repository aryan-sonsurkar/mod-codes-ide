const SETTINGS_KEY = "modcodes-settings";

export const DEFAULT_AI_BASE_URL = "http://127.0.0.1:11434";

export const DEFAULT_SETTINGS = {
  editor: {
    fontSize: 13,
    tabSize: 2,
    wordWrap: false,
    minimap: false,
    lineNumbers: true,
  },
  files: {
    confirmBeforeDelete: true,
  },
  projects: {
    confirmBeforeDelete: true,
  },
  terminal: {
    fontSize: 13,
  },
  ai: {
    baseUrl: DEFAULT_AI_BASE_URL,
    defaultModel: "",
    contextBudget: 24000,
    maxToolRounds: 2,
  },
};

function mergeSettings(defaults, stored) {
  const merged = {};

  for (const [category, values] of Object.entries(defaults)) {
    const storedCategory = stored && stored[category] ? stored[category] : {};
    merged[category] = {
      ...values,
      ...(typeof storedCategory === "object" && storedCategory !== null
        ? storedCategory
        : {}),
    };
  }

  return merged;
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);

    if (raw === null) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(raw);
    return sanitizeSettings(mergeSettings(DEFAULT_SETTINGS, parsed));
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
}

function sanitizeSettings(settings) {
  const ai = settings.ai || {};
  const baseUrl =
    typeof ai.baseUrl === "string" && /^https?:\/\//i.test(ai.baseUrl.trim())
      ? ai.baseUrl.trim()
      : DEFAULT_AI_BASE_URL;
  const contextBudget = Number.isFinite(ai.contextBudget)
    ? Math.min(200000, Math.max(2000, Math.round(ai.contextBudget)))
    : DEFAULT_SETTINGS.ai.contextBudget;
  const maxToolRounds =
    Number.isFinite(ai.maxToolRounds)
      ? Math.max(0, Math.min(4, Math.round(ai.maxToolRounds)))
      : DEFAULT_SETTINGS.ai.maxToolRounds;
  const defaultModel =
    typeof ai.defaultModel === "string" ? ai.defaultModel : "";

  return {
    ...settings,
    ai: {
      baseUrl,
      defaultModel,
      contextBudget,
      maxToolRounds,
    },
  };
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}