const ERROR_MESSAGES = {
  unsupported:
    "Your browser does not support the File System Access API. Use a Chromium-based browser.",
  cancelled: "Folder access was cancelled.",
  denied: "MODCODES does not have permission to access this folder.",
  missing: "This item is no longer available.",
  "too-large": "This file is too large to display.",
  binary: "This file does not appear to be text.",
  exists: "An item with that name already exists.",
  "invalid-name": "That name is not allowed.",
  invalid: "The operation is not valid.",
  error: "The operation failed. Please try again.",
};

export function friendlyError(status) {
  return ERROR_MESSAGES[status] || ERROR_MESSAGES.error;
}