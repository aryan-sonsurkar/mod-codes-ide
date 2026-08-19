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
];

export function getBuiltinTool(id) {
  return (
    BUILTIN_READONLY_TOOLS.find((tool) => tool.id === id) || null
  );
}