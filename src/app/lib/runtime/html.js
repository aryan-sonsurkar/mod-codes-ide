const RESOURCE_GUARD = `<!doctype html><meta charset="utf-8">`;

export function buildPreviewDocument(code) {
  const source = typeof code === "string" ? code : "";
  const guarded = /<!doctype\s+html/i.test(source)
    ? source
    : `${RESOURCE_GUARD}\n${source}`;
  return guarded;
}

export function previewSandboxPermissions() {
  return "allow-scripts allow-forms allow-modals allow-popups";
}
