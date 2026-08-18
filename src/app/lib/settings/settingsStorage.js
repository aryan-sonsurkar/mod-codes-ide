const SETTINGS_KEY = "modcodes-settings";

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
    return mergeSettings(DEFAULT_SETTINGS, parsed);
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}