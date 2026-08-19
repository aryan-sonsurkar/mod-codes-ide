export function serializeContextItems(context) {
  const items = context && Array.isArray(context.items) ? context.items : [];
  if (items.length === 0) {
    return "";
  }

  const blocks = [];
  for (const item of items) {
    if (!item || typeof item.content !== "string") {
      continue;
    }
    const type = typeof item.type === "string" ? item.type : "context";
    const path = typeof item.path === "string" ? ` ${item.path}` : "";
    const truncated = item.truncated ? " (truncated)" : "";
    blocks.push(`[${type}${path}${truncated}]\n${item.content}`);
  }

  if (blocks.length === 0) {
    return "";
  }

  return (
    "The following editor context is attached to this conversation. " +
    "Use it only when it helps answer; do not print it back unless asked.\n\n" +
    blocks.join("\n\n")
  );
}