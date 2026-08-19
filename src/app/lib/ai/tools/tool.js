export const PERMISSION_LEVELS = {
  read: "read",
  write: "write",
  execute: "execute",
  destructive: "destructive",
};

export const PERMISSION_ORDER = ["read", "write", "execute", "destructive"];

export const AUTO_SAFE_LEVEL = PERMISSION_LEVELS.read;

export function permissionAllows(maxLevel, level) {
  const maxIndex = PERMISSION_ORDER.indexOf(maxLevel);
  const levelIndex = PERMISSION_ORDER.indexOf(level);
  if (maxIndex === -1 || levelIndex === -1) {
    return false;
  }
  return levelIndex <= maxIndex;
}

function typeMatches(type, value) {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return value && typeof value === "object" && !Array.isArray(value);
    default:
      return true;
  }
}

export function validateArgs(parameters = {}, args = {}) {
  const errors = [];
  const required = Array.isArray(parameters.required) ? parameters.required : [];
  const properties =
    parameters.properties && typeof parameters.properties === "object"
      ? parameters.properties
      : {};

  for (const key of required) {
    if (args[key] === undefined) {
      errors.push(`Missing required argument: ${key}`);
    }
  }

  for (const [key, schema] of Object.entries(properties)) {
    const value = args[key];
    if (value === undefined || !schema) {
      continue;
    }
    if (schema.type && !typeMatches(schema.type, value)) {
      errors.push(`Argument "${key}" must be a ${schema.type}.`);
    }
    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
      errors.push(`Argument "${key}" has an invalid value.`);
    }
  }

  return errors;
}

export function createTool({
  id,
  name,
  description = "",
  parameters = {},
  permission = PERMISSION_LEVELS.read,
  execute,
} = {}) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("Tool requires an id");
  }
  if (typeof name !== "string" || name.length === 0) {
    throw new TypeError("Tool requires a name");
  }
  if (typeof execute !== "function") {
    throw new TypeError(`Tool "${id}" requires an execute function`);
  }
  if (!PERMISSION_ORDER.includes(permission)) {
    throw new TypeError(`Tool "${id}" has an invalid permission level`);
  }

  return {
    id,
    name,
    description: typeof description === "string" ? description : "",
    parameters:
      parameters && typeof parameters === "object" ? parameters : {},
    permission,
    readOnly: permission === PERMISSION_LEVELS.read,
    execute,
  };
}