import "./EditorPane.css";
import MonacoEditor from "./MonacoEditor";
import { getLanguageFromPath } from "../../../lib/monaco/monaco";

const READ_ERROR_MESSAGES = {
  missing: "This file is no longer available.",
  denied: "Permission to read this file was denied.",
  binary: "This file does not appear to be text and cannot be displayed.",
  "too-large": "This file is too large to display.",
  error: "ModCodes could not read this file.",
};

const SAVE_ERROR_MESSAGES = {
  missing: "This file is no longer available.",
  denied: "Permission to save this file was denied.",
  error: "ModCodes could not save this file.",
};

export default function EditorPane({ tab, openPaths, onChange, onSave }) {
  if (!tab) {
    return (
      <div className="editor-pane">
        <div className="editor-message">
          No file open. Click a file in the explorer to open it as a tab.
        </div>
      </div>
    );
  }

  const {
    path,
    name,
    content,
    dirty,
    readStatus,
    readError,
    saveStatus,
    saveError,
  } = tab;

  const language = getLanguageFromPath(path);
  const saving = saveStatus === "saving";

  let overlayMessage = null;
  if (readStatus === "reading") {
    overlayMessage = "Reading file...";
  } else if (readStatus === "error") {
    overlayMessage =
      READ_ERROR_MESSAGES[readError] || "ModCodes could not read this file.";
  }

  return (
    <div className="editor-pane">
      <div className="editor-toolbar">
        <div className="editor-toolbar-info">
          <span className="editor-filename">{name}</span>
          {dirty && <span className="editor-dirty">● Unsaved changes</span>}
          {saveStatus === "saved" && (
            <span className="editor-save-hint">Saved</span>
          )}
          {saveStatus === "error" && (
            <span className="editor-save-hint editor-save-error">
              {SAVE_ERROR_MESSAGES[saveError] || "Could not save this file."}
            </span>
          )}
        </div>
        <button
          className="editor-save-button"
          onClick={onSave}
          disabled={saving || !dirty || readStatus !== "ready"}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="editor-body">
        <MonacoEditor
          file={tab}
          content={content}
          language={language}
          readStatus={readStatus}
          openPaths={openPaths}
          onChange={onChange}
        />
        {overlayMessage && (
          <div className="editor-body-overlay">{overlayMessage}</div>
        )}
      </div>
    </div>
  );
}