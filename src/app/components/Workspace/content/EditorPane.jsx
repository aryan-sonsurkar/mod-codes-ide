import "./EditorPane.css";
import MonacoEditor from "./MonacoEditor";
import Breadcrumbs from "./Breadcrumbs";
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

const FILE_STATUS_MESSAGES = {
  missing: "This file is no longer available on disk. Your changes are preserved.",
  denied: "Access to this file is no longer available. Your changes are preserved.",
  changed: "This file was changed outside ModCodes. Your unsaved changes are preserved.",
  error: "ModCodes could not check this file on disk.",
};

export default function EditorPane({ tab, openPaths, onChange, onSave, revealRequest, focusHandleRef, findHandleRef, selectionHandleRef, onNavigateDirectory }) {
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
    fileStatus,
  } = tab;

  const language = getLanguageFromPath(path);
  const saving = saveStatus === "saving";
  const unavailable =
    fileStatus === "missing" ||
    fileStatus === "denied" ||
    fileStatus === "error";

  let overlayMessage = null;
  if (readStatus === "reading") {
    overlayMessage = "Reading file...";
  } else if (readStatus === "error") {
    overlayMessage =
      READ_ERROR_MESSAGES[readError] || "ModCodes could not read this file.";
  }

  let fileStatusMessage = null;
  if (fileStatus === "changed" && dirty) {
    fileStatusMessage = FILE_STATUS_MESSAGES.changed;
  } else if (unavailable) {
    fileStatusMessage =
      FILE_STATUS_MESSAGES[fileStatus] || FILE_STATUS_MESSAGES.error;
  }

  return (
    <div className="editor-pane">
      <Breadcrumbs
        path={tab.path}
        onNavigateDirectory={onNavigateDirectory}
      />
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
          disabled={saving || !dirty || readStatus !== "ready" || unavailable}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          className="editor-save-button"
          title="Find and replace in this file"
          onClick={() => findHandleRef?.current?.find()}
        >
          Find
        </button>
      </div>

      {fileStatusMessage && (
        <div className="editor-warning">{fileStatusMessage}</div>
      )}

      <div className="editor-body">
        <MonacoEditor
          file={tab}
          content={content}
          language={language}
          readStatus={readStatus}
          openPaths={openPaths}
          onChange={onChange}
          revealRequest={revealRequest}
          focusHandleRef={focusHandleRef}
          findHandleRef={findHandleRef}
          selectionHandleRef={selectionHandleRef}
        />
        {overlayMessage && (
          <div className="editor-body-overlay">{overlayMessage}</div>
        )}
      </div>
    </div>
  );
}