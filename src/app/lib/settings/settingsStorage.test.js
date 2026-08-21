import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  DEFAULT_AI_BASE_URL,
  loadSettings,
  saveSettings,
} from "./settingsStorage";

const SETTINGS_KEY = "modcodes-settings";

function stubStorage(initial = null) {
  const store = {};
  if (initial !== null) {
    store[SETTINGS_KEY] = initial;
  }
  global.localStorage = {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
}

beforeEach(() => {
  stubStorage();
});

afterEach(() => {
  delete global.localStorage;
});

describe("loadSettings", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("merges stored categories over defaults", () => {
    stubStorage(
      JSON.stringify({ editor: { fontSize: 16 }, ai: { baseUrl: "http://localhost:11434" } })
    );
    const settings = loadSettings();
    expect(settings.editor.fontSize).toBe(16);
    expect(settings.editor.tabSize).toBe(DEFAULT_SETTINGS.editor.tabSize);
    expect(settings.ai.baseUrl).toBe("http://localhost:11434");
  });

  it("adds missing categories from defaults", () => {
    stubStorage(JSON.stringify({ editor: { fontSize: 16 } }));
    expect(loadSettings().ai).toEqual(DEFAULT_SETTINGS.ai);
  });

  it("falls back to defaults on corrupt storage", () => {
    stubStorage("not json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe("AI settings sanitization", () => {
  it("defaults the base URL to the local Ollama endpoint", () => {
    expect(loadSettings().ai.baseUrl).toBe(DEFAULT_AI_BASE_URL);
    stubStorage(JSON.stringify({ ai: { baseUrl: "ftp://x" } }));
    expect(loadSettings().ai.baseUrl).toBe(DEFAULT_AI_BASE_URL);
    stubStorage(JSON.stringify({ ai: { baseUrl: 42 } }));
    expect(loadSettings().ai.baseUrl).toBe(DEFAULT_AI_BASE_URL);
  });

  it("keeps valid http(s) base URLs", () => {
    stubStorage(JSON.stringify({ ai: { baseUrl: "http://127.0.0.1:11434/" } }));
    expect(loadSettings().ai.baseUrl).toBe("http://127.0.0.1:11434/");
  });

  it("clamps the context budget to 2000–200000", () => {
    stubStorage(JSON.stringify({ ai: { contextBudget: 100 } }));
    expect(loadSettings().ai.contextBudget).toBe(2000);
    stubStorage(JSON.stringify({ ai: { contextBudget: 999999 } }));
    expect(loadSettings().ai.contextBudget).toBe(200000);
    stubStorage(JSON.stringify({ ai: { contextBudget: "big" } }));
    expect(loadSettings().ai.contextBudget).toBe(DEFAULT_SETTINGS.ai.contextBudget);
  });

  it("clamps tool rounds to 0–4", () => {
    stubStorage(JSON.stringify({ ai: { maxToolRounds: 99 } }));
    expect(loadSettings().ai.maxToolRounds).toBe(4);
    stubStorage(JSON.stringify({ ai: { maxToolRounds: -3 } }));
    expect(loadSettings().ai.maxToolRounds).toBe(0);
  });

  it("keeps the default model string", () => {
    stubStorage(JSON.stringify({ ai: { defaultModel: "qwen2.5-coder:7b" } }));
    expect(loadSettings().ai.defaultModel).toBe("qwen2.5-coder:7b");
  });

  it("defaults the provider to ollama and accepts browser-bonsai only", () => {
    expect(loadSettings().ai.provider).toBe("ollama");
    stubStorage(JSON.stringify({ ai: { provider: "browser-bonsai" } }));
    expect(loadSettings().ai.provider).toBe("browser-bonsai");
    stubStorage(JSON.stringify({ ai: { provider: "skynet" } }));
    expect(loadSettings().ai.provider).toBe("ollama");
    stubStorage(JSON.stringify({ ai: { provider: 42 } }));
    expect(loadSettings().ai.provider).toBe("ollama");
  });
});

describe("saveSettings", () => {
  it("persists settings to storage", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      ai: { ...DEFAULT_SETTINGS.ai, baseUrl: "http://localhost:11434" },
    };
    saveSettings(settings);
    expect(JSON.parse(global.localStorage.getItem(SETTINGS_KEY))).toEqual(settings);
  });
});