"use client";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import "./FileExplorer.css";
import FileTreeNode from "./FileTreeNode";
import { useSettings } from "../../../../contexts/SettingsContext";
import { useToast } from "../../../../contexts/ToastContext";
import ConfirmDialog from "../../../Dialogs/ConfirmDialog";

const ERROR_MESSAGES = {
  "invalid-name": "That name is not allowed.",
  exists: "An item with that name already exists.",
  denied: "Permission was denied.",
  missing: "This item is no longer available.",
  error: "The operation failed.",
};

function applyFilter(node, filter) {
  const matches = !filter || node.name.toLowerCase().includes(filter);

  if (node.kind === "file") {
    return matches ? node : null;
  }

  const kids = node.children
    .map((child) => applyFilter(child, filter))
    .filter(Boolean);

  if (matches) {
    return { ...node, children: kids.length ? kids : node.children };
  }

  return kids.length ? { ...node, children: kids } : null;
}

function flattenVisible(node, expanded, forceExpanded, out = []) {
  if (!node) {
    return out;
  }

  out.push(node);

  if (node.kind === "directory" && (forceExpanded || expanded.has(node.path))) {
    for (const child of node.children) {
      flattenVisible(child, expanded, forceExpanded, out);
    }
  }

  return out;
}

function FileExplorerInner({
  root,
  onFileSelect,
  selectedFilePath,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onRefresh,
  newFileRequest,
  newFolderRequest,
  revealRequest,
}) {
  const [expanded, setExpanded] = useState(() =>
    new Set(root ? [root.path] : [])
  );
  const [contextMenu, setContextMenu] = useState(null);
  const [nameDialog, setNameDialog] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [dialogError, setDialogError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("");

  const { settings } = useSettings();
  const { toast } = useToast();

  const trimmedFilter = filter.trim().toLowerCase();

  const filteredRoot = useMemo(() => {
    if (!trimmedFilter) {
      return root;
    }
    return applyFilter(root, trimmedFilter);
  }, [root, trimmedFilter]);

  const forceExpanded = Boolean(trimmedFilter);

  const visibleNodes = useMemo(
    () => flattenVisible(filteredRoot, expanded, forceExpanded),
    [filteredRoot, expanded, forceExpanded]
  );

  async function handleRefresh() {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (newFileRequest?.token && root) {
      startCreate("create-file", root);
    }
  }, [newFileRequest?.token, root]);

  useEffect(() => {
    if (newFolderRequest?.token && root) {
      startCreate("create-folder", root);
    }
  }, [newFolderRequest?.token, root]);

  const expandPath = useCallback((path) => {
    if (!path) {
      return;
    }

    window.setTimeout(() => {
      const parts = path.split("/").filter(Boolean);
      const dirs = [];
      let acc = "";

      for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        dirs.push(acc);
      }

      setExpanded((current) => new Set([...current, ...dirs]));

      const rows = document.querySelectorAll(".tree-row[data-path]");
      let target = null;

      for (const row of rows) {
        if (row.getAttribute("data-path") === path) {
          target = row;
          break;
        }
      }

      target?.scrollIntoView({ block: "nearest" });
    }, 0);
  }, []);

  useEffect(() => {
    if (revealRequest?.token) {
      expandPath(revealRequest.path);
    }
  }, [revealRequest, expandPath]);

  useEffect(() => {
    if (selectedFilePath) {
      expandPath(selectedFilePath);
    }
  }, [selectedFilePath, expandPath]);

  function activateNode(node) {
    if (!node) {
      return;
    }
    if (node.kind === "directory") {
      toggleDirectory(node.path);
    } else {
      onFileSelect?.(node);
    }
  }

  function handleExplorerKeyDown(event) {
    const rows = Array.from(
      document.querySelectorAll(".tree-row[data-path]")
    );

    if (rows.length === 0) {
      return;
    }

    let index = rows.indexOf(document.activeElement);

    if (index === -1) {
      index = rows.findIndex(
        (row) => row.getAttribute("data-path") === selectedFilePath
      );
    }

    const node = index >= 0 ? visibleNodes[index] : null;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = rows[Math.min(index + 1, rows.length - 1)];
      next?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = rows[Math.max(index - 1, 0)];
      next?.focus();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (node?.kind === "directory" && !expanded.has(node.path)) {
        toggleDirectory(node.path);
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (node?.kind === "directory" && expanded.has(node.path)) {
        toggleDirectory(node.path);
      } else if (node?.kind === "file") {
        const parentPath =
          index > 0 ? visibleNodes[index - 1]?.path : null;
        const parentRow = rows.find(
          (row) => row.getAttribute("data-path") === parentPath
        );
        parentRow?.focus();
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateNode(node);
    }
  }

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
    if (!settings.files.confirmBeforeDelete) {
      onDelete(node.path);
      return;
    }
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

    toast(
      mode === "rename" ? `Renamed to ${trimmed}` : `Created ${trimmed}`,
      "success"
    );

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

    toast(`Deleted ${node.name}`, "info");

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
            title="Refresh Explorer"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? "..." : "↻"}
          </button>
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
      <input
        className="explorer-filter-input"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filter files..."
        aria-label="Filter files"
      />
      <div
        className="explorer-tree"
        tabIndex={0}
        onKeyDown={handleExplorerKeyDown}
      >
        {filteredRoot ? (
          <FileTreeNode
            node={filteredRoot}
            expanded={expanded}
            onToggle={toggleDirectory}
            onFileSelect={onFileSelect}
            selectedFilePath={selectedFilePath}
            onContextMenu={openContextMenu}
            forceExpanded={forceExpanded}
          />
        ) : (
          <p className="explorer-empty">No files.</p>
        )}
        {trimmedFilter && visibleNodes.length === 1 && (
          <p className="explorer-empty">No files match the filter.</p>
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

      <ConfirmDialog
        open={Boolean(confirmDialog)}
        title={`Delete ${
          confirmDialog?.node.kind === "directory" ? "folder" : "file"
        }`}
        message={
          <>
            Delete <strong>{confirmDialog?.node.name}</strong>?
            {confirmDialog?.node.kind === "directory" &&
              " Everything inside it will be deleted."}
            {dialogError && (
              <span className="explorer-dialog-error">{dialogError}</span>
            )}
          </>
        }
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setConfirmDialog(null);
          setDialogError("");
        }}
      />
    </aside>
  );
}

export default memo(FileExplorerInner);