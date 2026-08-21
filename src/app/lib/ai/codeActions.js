export const CODE_ACTION_IDS = {
  explainSelection: "ai.explain-selection",
  explainFile: "ai.explain-file",
  improveCode: "ai.improve-code",
  findBug: "ai.find-bug",
  generateDocs: "ai.generate-docs",
  generateTests: "ai.generate-tests",
  refactorSelection: "ai.refactor-selection",
  askAi: "ai.ask",
};

export const CODE_ACTIONS = [
  {
    id: CODE_ACTION_IDS.explainSelection,
    title: "AI: Explain Selection",
    description: "Explain the selected code",
    requiresSelection: true,
    prompt: ({ selection, path }) =>
      `Explain what this code does:\n\nFile: ${path || "unknown"}\n\n\`\`\`\n${selection}\n\`\`\``,
  },
  {
    id: CODE_ACTION_IDS.explainFile,
    title: "AI: Explain File",
    description: "Explain the current file",
    prompt: ({ fileContent, path }) =>
      `Explain what this file does and its main responsibilities:\n\nFile: ${path || "unknown"}\n\n\`\`\`\n${(fileContent || "").slice(0, 8000)}\n\`\`\``,
  },
  {
    id: CODE_ACTION_IDS.improveCode,
    title: "AI: Improve Code",
    description: "Suggest improvements for the selection or current file",
    prompt: ({ selection, fileContent, path }) => {
      const code = selection || (fileContent || "").slice(0, 6000);
      return `Suggest improvements for this code. List specific changes and provide an improved version in a code block:\n\nFile: ${path || "unknown"}\n\n\`\`\`\n${code}\n\`\`\``;
    },
  },
  {
    id: CODE_ACTION_IDS.findBug,
    title: "AI: Find Bug",
    description: "Analyze the selection for potential bugs",
    prompt: ({ selection, fileContent, path }) => {
      const code = selection || (fileContent || "").slice(0, 6000);
      return `Analyze this code for potential bugs, edge cases, or logic errors. Explain any issues you find:\n\nFile: ${path || "unknown"}\n\n\`\`\`\n${code}\n\`\`\``;
    },
  },
  {
    id: CODE_ACTION_IDS.generateDocs,
    title: "AI: Generate Documentation",
    description: "Generate documentation for the selection",
    prompt: ({ selection, path }) =>
      `Generate documentation for this code. Include a clear description, parameters, and return values where applicable:\n\nFile: ${path || "unknown"}\n\n\`\`\`\n${selection || ""}\n\`\`\``,
  },
  {
    id: CODE_ACTION_IDS.generateTests,
    title: "AI: Generate Tests",
    description: "Generate tests for the selected code",
    prompt: ({ selection, path }) =>
      `Generate unit tests for this code. Use a common test framework style and cover edge cases:\n\nFile: ${path || "unknown"}\n\n\`\`\`\n${selection || ""}\n\`\`\``,
  },
  {
    id: CODE_ACTION_IDS.refactorSelection,
    title: "AI: Refactor Selection",
    description: "Refactor the selected code for clarity and maintainability",
    prompt: ({ selection, path }) =>
      `Refactor this code for clarity and maintainability without changing its behavior. Provide the refactored code in a code block and briefly explain the changes:\n\nFile: ${path || "unknown"}\n\n\`\`\`\n${selection || ""}\n\`\`\``,
  },
  {
    id: CODE_ACTION_IDS.askAi,
    title: "AI: Ask AI",
    description: "Ask AI about the current context",
    prompt: () => null,
  },
];

export function getCodeAction(id) {
  return CODE_ACTIONS.find((action) => action.id === id) || null;
}

export function buildCodeActionPrompt(id, context) {
  const action = getCodeAction(id);
  if (!action || typeof action.prompt !== "function") {
    return null;
  }
  return action.prompt(context);
}

export function isSelectionRequired(id) {
  const action = getCodeAction(id);
  return Boolean(action && action.requiresSelection);
}
