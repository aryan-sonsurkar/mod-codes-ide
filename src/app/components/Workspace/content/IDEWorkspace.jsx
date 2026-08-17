"use client";
import { useEffect, useRef, useState } from "react";
import "./IDEWorkspace.css";
import FileExplorer from "./FileExplorer/FileExplorer";
import EditorPane from "./EditorPane";
import TabBar from "./TabBar";
import SearchPanel from "./SearchPanel";
import {
  openProjectDirectory,
  readFile,
  writeFile,
  createFile,
  createDirectory,
  renameEntry,
  deleteEntry,
  rescanProjectTree,
} from "../../../lib/filesystem/filesystem";
import {
  loadWorkspace,
  saveWorkspace,
} from "../../../lib/workspace/workspaceStorage";

const STATUS_MESSAGES = {
  requesting: "Requesting access to this project's folder...",
  cancelled:
    "Folder access was cancelled. ModCodes could not connect to the project directory.",
  unsupported:
    "Your browser does not support the File System Access API. Please use a Chromium-based browser (Chrome or Edge).",
  denied: "Permission to read this project's folder was denied.",
  error: "ModCodes could not read this project's folder.",
};

const EMPTY_TAB = {
  path: "",
  name: "",
  content: "",
  savedContent: "",
  dirty: false,
  readStatus: "idle",
  readError: "",
  saveStatus: "idle",
  saveError: "",
  fileStatus: "ok",
  contentToken: 0,
};

export default function IdeWorkspace({ selectedProject }) {
  const [status, setStatus] = useState("requesting");
  const [tree, setTree] = useState(null);

  const [tabs, setTabs] = useState([]);
  const [activePath, setActivePath] = useState(null);
  const [pendingClosePath, setPendingClosePath] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [revealRequest, setRevealRequest] = useState(null);

  const saveResetTimer = useRef(null);
  const persistTimer = useRef(null);
  const restoreAttemptedRef = useRef(false);

  useEffect(() => {
    if (status !== "requesting") {
      return;
    }

    let ignore = false;

    async function loadDirectory() {
      const result = await openProjectDirectory();

      if (ignore) {
        return;
      }

      if (!result.ok) {
        setStatus(result.status);
        return;
      }

      setTree(result.tree);
      setStatus("ready");
    }

    loadDirectory();

    return () => {
      ignore = true;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "ready" || restoreAttemptedRef.current) {
      return;
    }

    restoreAttemptedRef.current = true;

    let ignore = false;

    async function restore() {
      const saved = loadWorkspace();
      if (!saved || saved.projectId !== selectedProject?.id) {
        return;
      }

      const savedTabs = Array.isArray(saved.openTabs) ? saved.openTabs : [];
      const paths = savedTabs
        .map((entry) => (typeof entry?.path === "string" ? entry.path : null))
        .filter(Boolean);

      if (paths.length === 0) {
        return;
      }

      setTabs((current) => {
        const existing = new Set(current.map((tab) => tab.path));
        const added = paths
          .filter((path) => !existing.has(path))
          .map((path) => ({
            ...EMPTY_TAB,
            path,
            name: nameFromPath(path),
            readStatus: "reading",
          }));
        return [...current, ...added];
      });

      setActivePath((current) => {
        if (current) {
          return current;
        }
        return paths.includes(saved.activePath) ? saved.activePath : paths[0];
      });

      for (const path of paths) {
        const result = await readFile(path);
        if (ignore) {
          return;
        }

        if (!result.ok) {
          updateTab(path, { readStatus: "error", readError: result.status });
          continue;
        }

        updateTab(path, (tab) => ({
          content: result.content,
          savedContent: result.content,
          readStatus: "ready",
          dirty: false,
        }));
      }
    }

    restore();

    return () => {
      ignore = true;
    };
  }, [status, selectedProject?.id, updateTab, nameFromPath]);

  useEffect(() => {
    if (status !== "ready" || !selectedProject?.id) {
      return;
    }

    if (persistTimer.current) {
      window.clearTimeout(persistTimer.current);
    }

    persistTimer.current = window.setTimeout(() => {
      saveWorkspace({
        projectId: selectedProject.id,
        openTabs: tabs.map((tab) => ({ path: tab.path, name: tab.name })),
        activePath,
      });
    }, 300);

    return () => {
      if (persistTimer.current) {
        window.clearTimeout(persistTimer.current);
      }
    };
  }, [status, tabs, activePath, selectedProject?.id]);

  function updateTab(path, changes) {
    setTabs((current) =>
      current.map((tab) =>
        tab.path === path
          ? {
              ...tab,
              ...(typeof changes === "function" ? changes(tab) : changes),
            }
          : tab
      )
    );
  }

  function resetEditor() {
    setTabs([]);
    setActivePath(null);
    setPendingClosePath(null);
    if (saveResetTimer.current) {
      window.clearTimeout(saveResetTimer.current);
      saveResetTimer.current = null;
    }
  }

  function retry() {
    resetEditor();
    setTree(null);
    setStatus("requesting");
  }

  function openFile(file) {
    const existing = tabs.find((tab) => tab.path === file.path);

    if (existing) {
      setActivePath(file.path);
      return;
    }

    setTabs((current) => {
      if (current.some((tab) => tab.path === file.path)) {
        return current;
      }
      return [
        ...current,
        {
          ...EMPTY_TAB,
          path: file.path,
          name: file.name,
          readStatus: "reading",
        },
      ];
    });
    setActivePath(file.path);

    readFile(file.path).then((result) => {
      if (!result.ok) {
        updateTab(file.path, { readStatus: "error", readError: result.status });
        return;
      }

      updateTab(file.path, (tab) => ({
        content: result.content,
        savedContent: result.content,
        readStatus: "ready",
        dirty: false,
      }));
    });
  }

  function switchTab(path) {
    setActivePath(path);
  }

  function handleContentChange(path, content) {
    updateTab(path, (tab) => ({
      content,
      dirty: content !== tab.savedContent,
      saveStatus: "idle",
      saveError: "",
    }));
  }

  function handleSave() {
    if (!activePath) {
      return;
    }
    saveTab(activePath);
  }

  function saveTab(path) {
    const tab = tabs.find((entry) => entry.path === path);

    if (!tab || tab.readStatus !== "ready") {
      return Promise.resolve(false);
    }

    if (tab.fileStatus === "missing") {
      return Promise.resolve(false);
    }

    const contentToSave = tab.content;
    updateTab(path, { saveStatus: "saving", saveError: "" });

    return writeFile(path, contentToSave).then((result) => {
      if (!result.ok) {
        updateTab(path, { saveStatus: "error", saveError: result.status });
        return false;
      }

      updateTab(path, {
        savedContent: contentToSave,
        dirty: false,
        saveStatus: "saved",
      });
      scheduleSaveStatusReset(path);
      return true;
    });
  }

  function scheduleSaveStatusReset(path) {
    if (saveResetTimer.current) {
      window.clearTimeout(saveResetTimer.current);
    }
    saveResetTimer.current = window.setTimeout(() => {
      updateTab(path, { saveStatus: "idle", saveError: "" });
    }, 3000);
  }

  function handleCloseTab(path) {
    const tab = tabs.find((entry) => entry.path === path);

    if (!tab) {
      return;
    }

    if (tab.dirty) {
      setPendingClosePath(path);
      return;
    }

    closeTabNow(path);
  }

  function closeTabNow(path) {
    const index = tabs.findIndex((tab) => tab.path === path);
    if (index === -1) {
      return;
    }

    const remaining = tabs.filter((tab) => tab.path !== path);

    if (activePath === path) {
      const neighbor = remaining[Math.min(index, remaining.length - 1)];
      setActivePath(neighbor ? neighbor.path : null);
    }

    setTabs(remaining);
  }

  function handlePendingSave() {
    saveTab(pendingClosePath).then((ok) => {
      if (ok && pendingClosePath) {
        closeTabNow(pendingClosePath);
        setPendingClosePath(null);
      }
    });
  }

  function handlePendingDiscard() {
    closeTabNow(pendingClosePath);
    setPendingClosePath(null);
  }

  function handlePendingCancel() {
    setPendingClosePath(null);
  }

  function nameFromPath(path) {
    const index = path.lastIndexOf("/");
    return index === -1 ? path : path.slice(index + 1);
  }

  async function refreshProjectTree() {
    const result = await rescanProjectTree();
    if (result.ok) {
      setTree(result.tree);
    }
    return result;
  }

  async function syncTabsWithDisk() {
    const open = tabs.map((tab) => tab.path);
    const results = await Promise.all(
      open.map(async (path) => ({ path, result: await readFile(path) }))
    );

    for (const { path, result } of results) {
      if (!result.ok) {
        updateTab(path, { fileStatus: result.status });
        continue;
      }

      updateTab(path, (tab) => {
        if (tab.dirty) {
          return {
            fileStatus: result.content === tab.savedContent ? "ok" : "changed",
          };
        }
        return {
          content: result.content,
          savedContent: result.content,
          fileStatus: "ok",
          contentToken: (tab.contentToken || 0) + 1,
        };
      });
    }
  }

  async function handleRefresh() {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    const result = await refreshProjectTree();
    if (result.ok) {
      await syncTabsWithDisk();
    }
    setRefreshing(false);
    return result;
  }

  async function handleCreateFile(parentPath, name) {
    const result = await createFile(parentPath, name);
    if (result.ok) {
      await refreshProjectTree();
    }
    return result;
  }

  async function handleCreateFolder(parentPath, name) {
    const result = await createDirectory(parentPath, name);
    if (result.ok) {
      await refreshProjectTree();
    }
    return result;
  }

  function remapOpenTabs(oldPath, newPath) {
    const prefix = oldPath + "/";

    setTabs((current) =>
      current.map((tab) => {
        if (tab.path === oldPath) {
          return { ...tab, path: newPath, name: nameFromPath(newPath) };
        }
        if (tab.path.startsWith(prefix)) {
          const nextPath = newPath + tab.path.slice(oldPath.length);
          return { ...tab, path: nextPath, name: nameFromPath(nextPath) };
        }
        return tab;
      })
    );

    setActivePath((current) => {
      if (current === oldPath) {
        return newPath;
      }
      if (current && current.startsWith(prefix)) {
        return newPath + current.slice(oldPath.length);
      }
      return current;
    });
  }

  async function handleRenameEntry(path, newName) {
    const result = await renameEntry(path, newName);
    if (result.ok) {
      remapOpenTabs(path, result.path);
      await refreshProjectTree();
    }
    return result;
  }

  function dropTabsForPath(path) {
    const prefix = path + "/";
    const removed = tabs.filter(
      (tab) => tab.path === path || tab.path.startsWith(prefix)
    );

    if (removed.length === 0) {
      return;
    }

    const removedSet = new Set(removed.map((tab) => tab.path));
    const remaining = tabs.filter((tab) => !removedSet.has(tab.path));

    if (activePath && removedSet.has(activePath)) {
      const index = tabs.findIndex((tab) => tab.path === activePath);
      const neighbor = remaining[Math.min(index, remaining.length - 1)];
      setActivePath(neighbor ? neighbor.path : null);
    }

    setTabs(remaining);
  }

  async function handleDeleteEntry(path) {
    const result = await deleteEntry(path);
    if (result.ok) {
      dropTabsForPath(path);
      await refreshProjectTree();
    }
    return result;
  }

  function handleSearchSelect(match) {
    openFile({ path: match.path, name: match.name });
    setRevealRequest((current) => ({
      token: (current?.token || 0) + 1,
      path: match.path,
      line: match.line,
    }));
  }

  function switchToRelativeTab(direction) {
    if (!tabs.length) {
      setActivePath(null);
      return;
    }

    const index = tabs.findIndex((tab) => tab.path === activePath);
    const nextIndex = (index + direction + tabs.length) % tabs.length;
    setActivePath(tabs[nextIndex].path);
  }

  function handleCloseTabFromKeyboard() {
    if (activePath) {
      handleCloseTab(activePath);
    }
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (status !== "ready" || pendingClosePath) {
        return;
      }

      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (activePath) {
          saveTab(activePath);
        }
        return;
      }

      if (mod && event.key.toLowerCase() === "w") {
        event.preventDefault();
        handleCloseTabFromKeyboard();
        return;
      }

      if (mod && event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        switchToRelativeTab(-1);
        return;
      }

      if (mod && event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        switchToRelativeTab(1);
        return;
      }

      if (event.key === "Escape") {
        handlePendingCancel();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    status,
    activePath,
    tabs,
    pendingClosePath,
    saveTab,
    handleCloseTabFromKeyboard,
    switchToRelativeTab,
    handlePendingCancel,
  ]);

  const openPaths = tabs.map((tab) => tab.path);
  const activeTab = tabs.find((tab) => tab.path === activePath) || null;
  const pendingTab = tabs.find((tab) => tab.path === pendingClosePath) || null;
  const canRetry = ["cancelled", "denied", "error"].includes(status);

  return (
    <section className="ide-workspace">
      <header className="ide-header">
        <div>
          <h1>MODCODES IDE</h1>
          <p>Project: {selectedProject?.name || "Untitled Project"}</p>
        </div>
        <button
          className="ide-header-button"
          onClick={() => setSearchOpen((current) => !current)}
        >
          {searchOpen ? "Close Search" : "Search"}
        </button>
      </header>

      {status === "ready" && tree ? (
        <>
          <div className="ide-layout">
            <FileExplorer
              root={tree}
              onFileSelect={openFile}
              selectedFilePath={activePath}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onRename={handleRenameEntry}
              onDelete={handleDeleteEntry}
              onRefresh={handleRefresh}
            />
            <div className="editor-region">
              <TabBar
                tabs={tabs}
                activePath={activePath}
                onActivate={switchTab}
                onClose={handleCloseTab}
              />
              <EditorPane
                tab={activeTab}
                openPaths={openPaths}
                onChange={handleContentChange}
                onSave={handleSave}
                revealRequest={revealRequest}
              />
            </div>
            {searchOpen && (
              <SearchPanel
                onSelect={handleSearchSelect}
                onClose={() => setSearchOpen(false)}
              />
            )}
          </div>

          {pendingTab && (
            <div className="unsaved-overlay">
              <div className="unsaved-dialog" role="dialog" aria-modal="true">
                <p className="unsaved-title">Unsaved changes</p>
                <p>
                  Save changes to {pendingTab.name} before closing?
                </p>
                <div className="unsaved-actions">
                  <button
                    className="unsaved-button unsaved-button-primary"
                    onClick={handlePendingSave}
                  >
                    Save
                  </button>
                  <button
                    className="unsaved-button unsaved-button-danger"
                    onClick={handlePendingDiscard}
                  >
                    Discard
                  </button>
                  <button
                    className="unsaved-button"
                    onClick={handlePendingCancel}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="ide-status">
          <p>{STATUS_MESSAGES[status] || "Preparing..."}</p>
          {canRetry && (
            <button className="ide-retry-button" onClick={retry}>
              Request Access
            </button>
          )}
        </div>
      )}
    </section>
  );
}