export const WORKSPACE_COMMAND_IDS = {
  explainProject: "ai.explain-project",
  findTodos: "ai.find-todos",
  findBugs: "ai.find-bugs",
  explainArchitecture: "ai.explain-architecture",
  explainDependencies: "ai.explain-dependencies",
  summarizeChanges: "ai.summarize-changes",
  generateReadme: "ai.generate-readme",
  generateDocs: "ai.generate-docs-workspace",
  analyzeDiagnostics: "ai.analyze-diagnostics",
};

export const WORKSPACE_COMMANDS = [
  {
    id: WORKSPACE_COMMAND_IDS.explainProject,
    title: "AI: Explain Project",
    description: "Summarize the project's purpose and structure",
    prompt: ({ fileTree, openDocuments }) => {
      const treeSummary = summarizeTree(fileTree, 40);
      return `Explain this project's purpose and structure. File tree:\n${treeSummary}\n\nOpen files: ${(openDocuments || []).map((d) => d.path).join(", ") || "none"}`;
    },
  },
  {
    id: WORKSPACE_COMMAND_IDS.findTodos,
    title: "AI: Find TODOs",
    description: "Find TODO/FIXME comments in the workspace",
    prompt: ({ searchResults }) => {
      const items = (searchResults || []).slice(0, 20).map((r) => `${r.path}:${r.line} ${r.text}`).join("\n");
      return `Find and summarize TODO/FIXME items in this project. Search hits:\n${items || "No direct search provided; list common TODO locations."}`;
    },
  },
  {
    id: WORKSPACE_COMMAND_IDS.findBugs,
    title: "AI: Find Potential Bugs",
    description: "Analyze diagnostics and code for potential bugs",
    prompt: ({ diagnostics }) => {
      const list = (diagnostics || []).slice(0, 30).map((d) => `[${d.severity}] ${d.path}:${d.line} ${d.message}`).join("\n");
      return `Analyze this project for potential bugs based on diagnostics and code patterns:\n${list || "No diagnostics."}`;
    },
  },
  {
    id: WORKSPACE_COMMAND_IDS.explainArchitecture,
    title: "AI: Explain Architecture",
    description: "Explain the project's architecture",
    prompt: ({ graph, fileTree }) => {
      const graphSummary = graph ? `${graph.nodes.length} files, ${graph.edges.length} edges` : "no graph";
      return `Explain the architecture of this project. Graph: ${graphSummary}\nFile tree: ${summarizeTree(fileTree, 50)}`;
    },
  },
  {
    id: WORKSPACE_COMMAND_IDS.explainDependencies,
    title: "AI: Explain Dependencies",
    description: "Explain project dependencies",
    prompt: ({ fileTree }) => `Explain the dependencies of this project based on its structure:\n${summarizeTree(fileTree, 50)}`,
  },
  {
    id: WORKSPACE_COMMAND_IDS.summarizeChanges,
    title: "AI: Summarize Changes",
    description: "Summarize unsaved changes and recent edits",
    prompt: ({ openDocuments }) => {
      const dirty = (openDocuments || []).filter((d) => d.dirty).map((d) => d.path).join(", ");
      return `Summarize the current changes in this workspace. Dirty files: ${dirty || "none"}`;
    },
  },
  {
    id: WORKSPACE_COMMAND_IDS.generateReadme,
    title: "AI: Generate README",
    description: "Generate a README draft for the project",
    prompt: ({ fileTree }) => `Generate a README.md draft for this project. File tree:\n${summarizeTree(fileTree, 60)}`,
  },
  {
    id: WORKSPACE_COMMAND_IDS.generateDocs,
    title: "AI: Generate Documentation",
    description: "Generate workspace documentation",
    prompt: ({ symbols }) => {
      const list = (symbols || []).slice(0, 20).map((s) => `${s.path}: ${s.symbols?.map((x) => x.name).join(", ")}`).join("\n");
      return `Generate documentation for this workspace. Symbols:\n${list || "none"}`;
    },
  },
  {
    id: WORKSPACE_COMMAND_IDS.analyzeDiagnostics,
    title: "AI: Analyze Diagnostics",
    description: "Analyze current diagnostics and suggest fixes",
    prompt: ({ diagnostics }) => {
      const list = (diagnostics || []).slice(0, 30).map((d) => `[${d.severity}] ${d.path}:${d.line} ${d.message}`).join("\n");
      return `Analyze these diagnostics and suggest fixes:\n${list || "No diagnostics to analyze."}`;
    },
  },
];

function summarizeTree(node, max) {
  if (!node) {
    return "No project tree available.";
  }
  const lines = [];
  function walk(current, depth) {
    if (lines.length >= max) {
      return;
    }
    lines.push(`${"  ".repeat(depth)}${current.name}${current.kind === "directory" ? "/" : ""}`);
    if (current.children && depth < 4) {
      for (const child of current.children.slice(0, 20)) {
        walk(child, depth + 1);
        if (lines.length >= max) {
          break;
        }
      }
    }
  }
  walk(node, 0);
  return lines.join("\n");
}

export function getWorkspaceCommand(id) {
  return WORKSPACE_COMMANDS.find((command) => command.id === id) || null;
}

export function buildWorkspacePrompt(id, context) {
  const command = getWorkspaceCommand(id);
  if (!command) {
    return null;
  }
  return command.prompt(context);
}
