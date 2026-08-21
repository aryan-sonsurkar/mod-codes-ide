const SETTINGS_KEY = "modcodes-settings";

export const DEFAULT_AI_BASE_URL = "http://127.0.0.1:11434";

export const DEFAULT_SETTINGS = {
  editor: {
    fontSize: 13,
    fontFamily: 'Consolas, "Courier New", monospace',
    tabSize: 2,
    insertSpaces: true,
    wordWrap: false,
    minimap: false,
    lineNumbers: true,
    cursorBlinking: "blink",
    smoothScrolling: false,
  },
  files: {
    confirmBeforeDelete: true,
  },
  projects: {
    confirmBeforeDelete: true,
  },
  terminal: {
    fontSize: 13,
    fontFamily: 'Consolas, "Courier New", monospace',
  },
  ai: {
    provider: "ollama",
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
  const provider =
    ai.provider === "browser-bonsai" ? "browser-bonsai" : "ollama";

  const editor = settings.editor || {};
  const terminal = settings.terminal || {};
  const sanitizedEditor = {
    fontSize: Number.isFinite(editor.fontSize) ? Math.min(24, Math.max(10, Math.round(editor.fontSize))) : DEFAULT_SETTINGS.editor.fontSize,
    fontFamily: typeof editor.fontFamily === "string" && editor.fontFamily.trim().length > 0 ? editor.fontFamily.trim().slice(0, 120) : DEFAULT_SETTINGS.editor.fontFamily,
    tabSize: Number.isFinite(editor.tabSize) ? Math.min(8, Math.max(1, Math.round(editor.tabSize))) : DEFAULT_SETTINGS.editor.tabSize,
    insertSpaces: typeof editor.insertSpaces === "boolean" ? editor.insertSpaces : DEFAULT_SETTINGS.editor.insertSpaces,
    wordWrap: typeof editor.wordWrap === "boolean" ? editor.wordWrap : DEFAULT_SETTINGS.editor.wordWrap,
    minimap: typeof editor.minimap === "boolean" ? editor.minimap : DEFAULT_SETTINGS.editor.minimap,
    lineNumbers: typeof editor.lineNumbers === "boolean" ? editor.lineNumbers : DEFAULT_SETTINGS.editor.lineNumbers,
    cursorBlinking: ["blink", "smooth", "phase", "expand", "solid"].includes(editor.cursorBlinking) ? editor.cursorBlinking : DEFAULT_SETTINGS.editor.cursorBlinking,
    smoothScrolling: typeof editor.smoothScrolling === "boolean" ? editor.smoothScrolling : DEFAULT_SETTINGS.editor.smoothScrolling,
  };
  const sanitizedTerminal = {
    fontSize: Number.isFinite(terminal.fontSize) ? Math.min(24, Math.max(10, Math.round(terminal.fontSize))) : DEFAULT_SETTINGS.terminal.fontSize,
    fontFamily: typeof terminal.fontFamily === "string" && terminal.fontFamily.trim().length > 0 ? terminal.fontFamily.trim().slice(0, 120) : DEFAULT_SETTINGS.terminal.fontFamily,
  };

  return {
    ...settings,
    editor: sanitizedEditor,
    terminal: sanitizedTerminal,
    ai: {
      provider,
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