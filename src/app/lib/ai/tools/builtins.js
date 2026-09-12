import { PERMISSION_LEVELS } from "./tool";

export const BUILTIN_READONLY_TOOLS = [
  {
    id: "ide.current-file",
    name: "Read current file",
    description:
      "Returns the content of the file currently open and active in the editor.",
    parameters: { type: "object", properties: {}, required: [] },
    permission: PERMISSION_LEVELS.read,
    readOnly: true,
  },
  {
    id: "ide.diagnostics",
    name: "Read diagnostics",
    description:
      "Returns diagnostic (error/warning) messages for the workspace, optionally filtered to one file path.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute file path to filter diagnostics to.",
        },
      },
      required: [],
    },
    permission: PERMISSION_LEVELS.read,
    readOnly: true,
  },
  {
    id: "ide.open-files",
    name: "List open files",
    description:
      "Lists the paths of the files currently open in the editor.",
    parameters: { type: "object", properties: {}, required: [] },
    permission: PERMISSION_LEVELS.read,
    readOnly: true,
  },
  {
    id: "ide.search",
    name: "Search workspace",
    description:
      "Searches the workspace for files containing a query string. Returns matching file paths and line numbers.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query string.",
        },
      },
      required: ["query"],
    },
    permission: PERMISSION_LEVELS.read,
    readOnly: true,
  },
  {
    id: "ide.read-file",
    name: "Read file",
    description:
      "Reads the full content of a file at the given path. Use this to inspect files before modifying them.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path to read (relative to project root).",
        },
      },
      required: ["path"],
    },
    permission: PERMISSION_LEVELS.read,
    readOnly: true,
  },
];

export const BUILTIN_WRITE_TOOLS = [
  {
    id: "ide.write-file",
    name: "Write file",
    description:
      "Writes content to a file. If the file exists, it is overwritten. If it does not exist, it is created. Use this to implement code changes.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path to write (relative to project root).",
        },
        content: {
          type: "string",
          description: "The full content to write to the file.",
        },
      },
      required: ["path", "content"],
    },
    permission: PERMISSION_LEVELS.write,
    readOnly: false,
  },
  {
    id: "ide.apply-patch",
    name: "Apply patch",
    description:
      "Applies a targeted edit to a file by replacing a specific section. Use this for small, precise changes instead of rewriting the whole file.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path to patch (relative to project root).",
        },
        original: {
          type: "string",
          description: "The exact text to find and replace (must match exactly).",
        },
        replacement: {
          type: "string",
          description: "The text to replace it with.",
        },
      },
      required: ["path", "original", "replacement"],
    },
    permission: PERMISSION_LEVELS.write,
    readOnly: false,
  },
  {
    id: "ide.create-file",
    name: "Create file",
    description:
      "Creates a new file with the given content. Fails if the file already exists.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path to create (relative to project root).",
        },
        content: {
          type: "string",
          description: "The content for the new file.",
        },
      },
      required: ["path", "content"],
    },
    permission: PERMISSION_LEVELS.write,
    readOnly: false,
  },
];

export const ALL_BUILTIN_TOOLS = [...BUILTIN_READONLY_TOOLS, ...BUILTIN_WRITE_TOOLS];

export function getBuiltinTool(id) {
  return (
    ALL_BUILTIN_TOOLS.find((tool) => tool.id === id) || null
  );
}