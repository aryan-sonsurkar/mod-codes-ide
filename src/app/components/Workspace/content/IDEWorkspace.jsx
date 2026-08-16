"use client";
import { useEffect, useRef, useState } from "react";
import "./IDEWorkspace.css";
import FileExplorer from "./FileExplorer/FileExplorer";
import EditorPane from "./EditorPane";
import TabBar from "./TabBar";
import {
  openProjectDirectory,
  readFile,
  writeFile,
} from "../../../lib/filesystem/filesystem";

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
};

export default function IdeWorkspace({ selectedProject }) {
  const [status, setStatus] = useState("requesting");
  const [tree, setTree] = useState(null);

  const [tabs, setTabs] = useState([]);
  const [activePath, setActivePath] = useState(null);
  const [pendingClosePath, setPendingClosePath] = useState(null);

  const saveResetTimer = useRef(null);

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

  const openPaths = tabs.map((tab) => tab.path);
  const activeTab = tabs.find((tab) => tab.path === activePath) || null;
  const pendingTab = tabs.find((tab) => tab.path === pendingClosePath) || null;
  const canRetry = ["cancelled", "denied", "error"].includes(status);

  return (
    <section className="ide-workspace">
      <header className="ide-header">
        <h1>MODCODES IDE</h1>
        <p>Project: {selectedProject?.name || "Untitled Project"}</p>
      </header>

      {status === "ready" && tree ? (
        <>
          <div className="ide-layout">
            <FileExplorer
              root={tree}
              onFileSelect={openFile}
              selectedFilePath={activePath}
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
              />
            </div>
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