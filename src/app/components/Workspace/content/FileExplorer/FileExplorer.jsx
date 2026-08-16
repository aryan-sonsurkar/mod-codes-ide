"use client";
import { useState } from "react";
import "./FileExplorer.css";
import FileTreeNode from "./FileTreeNode";

const ERROR_MESSAGES = {
  "invalid-name": "That name is not allowed.",
  exists: "An item with that name already exists.",
  denied: "Permission was denied.",
  missing: "This item is no longer available.",
  error: "The operation failed.",
};

export default function FileExplorer({
  root,
  onFileSelect,
  selectedFilePath,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
}) {
  const [expanded, setExpanded] = useState(() =>
    new Set(root ? [root.path] : [])
  );
  const [contextMenu, setContextMenu] = useState(null);
  const [nameDialog, setNameDialog] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [dialogError, setDialogError] = useState("");

  function toggleDirectory(path) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function parentDirPathOf(node) {
    const index = node.path.lastIndexOf("/");
    return index === -1 ? node.path : node.path.slice(0, index);
  }

  function targetDirPath(node) {
    return node.kind === "directory" ? node.path : parentDirPathOf(node);
  }

  function openContextMenu(event, node) {
    event.preventDefault();
    setDialogError("");
    setContextMenu({ x: event.clientX, y: event.clientY, node });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function startCreate(mode, node) {
    setDialogError("");
    setNameInput("");
    setContextMenu(null);
    setNameDialog({ mode, node });
  }

  function startRename(node) {
    setDialogError("");
    setNameInput(node.name);
    setContextMenu(null);
    setNameDialog({ mode: "rename", node });
  }

  function startDelete(node) {
    setDialogError("");
    setContextMenu(null);
    setConfirmDialog({ node });
  }

  function expandParent(path) {
    setExpanded((current) => new Set(current).add(path));
  }

  async function handleNameSubmit() {
    if (!nameDialog) {
      return;
    }

    const { mode, node } = nameDialog;
    const trimmed = nameInput.trim();

    if (!trimmed) {
      setDialogError("Please enter a name.");
      return;
    }

    let result;
    if (mode === "create-file") {
      const dir = targetDirPath(node);
      result = await onCreateFile(dir, trimmed);
      if (result.ok) {
        expandParent(dir);
      }
    } else if (mode === "create-folder") {
      const dir = targetDirPath(node);
      result = await onCreateFolder(dir, trimmed);
      if (result.ok) {
        expandParent(dir);
      }
    } else {
      result = await onRename(node.path, trimmed);
    }

    if (!result.ok) {
      setDialogError(ERROR_MESSAGES[result.status] || "The operation failed.");
      return;
    }

    setNameDialog(null);
    setNameInput("");
    setDialogError("");
  }

  async function handleDeleteConfirm() {
    if (!confirmDialog) {
      return;
    }

    const { node } = confirmDialog;
    const result = await onDelete(node.path);

    if (!result.ok) {
      setDialogError(ERROR_MESSAGES[result.status] || "The operation failed.");
      return;
    }

    setConfirmDialog(null);
    setDialogError("");
  }

  const isRoot = Boolean(contextMenu) && contextMenu.node.path === root?.path;

  return (
    <aside className="file-explorer">
      <header className="explorer-header">
        <span className="explorer-title">EXPLORER</span>
        <div className="explorer-actions">
          <button
            className="explorer-action-button"
            title="New File"
            onClick={() => startCreate("create-file", root)}
          >
            + File
          </button>
          <button
            className="explorer-action-button"
            title="New Folder"
            onClick={() => startCreate("create-folder", root)}
          >
            + Folder
          </button>
        </div>
      </header>
      <div className="explorer-tree">
        {root ? (
          <FileTreeNode
            node={root}
            expanded={expanded}
            onToggle={toggleDirectory}
            onFileSelect={onFileSelect}
            selectedFilePath={selectedFilePath}
            onContextMenu={openContextMenu}
          />
        ) : (
          <p className="explorer-empty">No files.</p>
        )}
      </div>

      {contextMenu && (
        <>
          <div
            className="explorer-menu-backdrop"
            onClick={closeContextMenu}
            onContextMenu={(event) => {
              event.preventDefault();
              closeContextMenu();
            }}
          />
          <div
            className="explorer-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="explorer-menu-item"
              onClick={() => startCreate("create-file", contextMenu.node)}
            >
              New File
            </button>
            <button
              className="explorer-menu-item"
              onClick={() => startCreate("create-folder", contextMenu.node)}
            >
              New Folder
            </button>
            {!isRoot && (
              <>
                <button
                  className="explorer-menu-item"
                  onClick={() => startRename(contextMenu.node)}
                >
                  Rename
                </button>
                <button
                  className="explorer-menu-item explorer-menu-danger"
                  onClick={() => startDelete(contextMenu.node)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </>
      )}

      {nameDialog && (
        <div className="explorer-overlay">
          <div className="explorer-dialog" role="dialog" aria-modal="true">
            <p className="explorer-dialog-title">
              {nameDialog.mode === "rename"
                ? "Rename"
                : nameDialog.mode === "create-folder"
                  ? "New folder"
                  : "New file"}
            </p>
            <input
              className="explorer-dialog-input"
              autoFocus
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleNameSubmit();
                }
                if (event.key === "Escape") {
                  setNameDialog(null);
                }
              }}
              placeholder={
                nameDialog.mode === "rename" ? "New name" : "Name"
              }
            />
            {dialogError && (
              <p className="explorer-dialog-error">{dialogError}</p>
            )}
            <div className="explorer-dialog-actions">
              <button
                className="explorer-dialog-button"
                onClick={() => setNameDialog(null)}
              >
                Cancel
              </button>
              <button
                className="explorer-dialog-button explorer-dialog-primary"
                onClick={handleNameSubmit}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="explorer-overlay">
          <div
            className="explorer-dialog"
            role="dialog"
            aria-modal="true"
          >
            <p className="explorer-dialog-title">
              Delete{" "}
              {confirmDialog.node.kind === "directory" ? "folder" : "file"}
            </p>
            <p>
              Delete <strong>{confirmDialog.node.name}</strong>?
              {confirmDialog.node.kind === "directory" &&
                " Everything inside it will be deleted."}
            </p>
            {dialogError && (
              <p className="explorer-dialog-error">{dialogError}</p>
            )}
            <div className="explorer-dialog-actions">
              <button
                className="explorer-dialog-button"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </button>
              <button
                className="explorer-dialog-button explorer-dialog-danger"
                onClick={handleDeleteConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}