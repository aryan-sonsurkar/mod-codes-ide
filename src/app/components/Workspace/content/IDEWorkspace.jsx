"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "./IDEWorkspace.css";
import FileExplorer from "./FileExplorer/FileExplorer";
import EditorPane from "./EditorPane";
import TabBar from "./TabBar";
import SearchPanel from "./SearchPanel";
import ProblemsPanel from "./ProblemsPanel";
import OutlinePanel from "./OutlinePanel";
import GraphPanel from "./GraphPanel";
import GitPanel from "./GitPanel";
import AIPanel from "./AIPanel";
import CommandPalette from "./CommandPalette";
import TerminalPanel from "./TerminalPanel";
import GoToLineDialog from "./GoToLineDialog";
import GoToFileDialog from "./GoToFileDialog";
import GoToSymbolDialog from "./GoToSymbolDialog";
import { createTerminalService, createBrowserSimulationBackend } from "../../../lib/terminal";
import { createSystemTerminalBackend, checkBridgeHealth, getBridgeToken } from "../../../lib/terminal/backends/systemTerminalBackend";
import { useWorkspaceLayout } from "../../../hooks/useWorkspaceLayout";
import ProjectOverview from "./ProjectOverview";
import ResearchWorkspace from "./ResearchWorkspace";
import PRDWorkspace from "./PRDWorkspace";
import RoadmapWorkspace from "./RoadmapWorkspace";
import AgentWorkspace from "./AgentWorkspace";
import { loadModcodes, saveModcodes, ensureModcodes } from "../../../lib/project/service";
import { reconcileProjectMemory } from "../../../lib/project/reconcile";
import { useAgentWorkspace } from "../../../hooks/useAgentWorkspace";
import { createProjectLifecycleOrchestrator } from "../../../lib/project/lifecycle";
import {
  openProjectDirectory,
  readFile,
  writeFile,
  createFile,
  createDirectory,
  renameEntry,
  deleteEntry,
  rescanProjectTree,
  previewWorkspaceReplace,
} from "../../../lib/filesystem/filesystem";
import {
  loadWorkspace,
  saveWorkspace,
} from "../../../lib/workspace/workspaceStorage";
function collectFileCount(node) {
  if (!node) return 0;
  if (node.kind === "file") return 1;
  if (!node.children) return 0;
  return node.children.reduce((sum, child) => sum + collectFileCount(child), 0);
}
import { buildRecoveryPlan } from "../../../lib/workspace/workspaceRecovery";
import { collectFilePaths } from "../../../lib/diagnostics/resolve";
import { useTabs } from "../../../hooks/useTabs";
import { useDiagnostics } from "../../../hooks/useDiagnostics";
import { nameFromPath, parentPathOf } from "../../../lib/editor/tabUtils";
import {
  replaceSingleMatch,
  applyWorkspaceReplaceCore,
} from "../../../lib/editor/searchReplace";
import ConfirmDialog from "../../Dialogs/ConfirmDialog";
import { friendlyError } from "../../../lib/errors/messages";
import { useToast } from "../../../contexts/ToastContext";
import { useSettings } from "../../../contexts/SettingsContext";
import { clampBudget } from "../../../lib/ai/context/budget";
import { CODE_ACTIONS, buildCodeActionPrompt } from "../../../lib/ai/codeActions";
import { WORKSPACE_COMMANDS, buildWorkspacePrompt } from "../../../lib/ai/workspaceCommands";
import { acceptDiff } from "../../../lib/ai/diffEngine";
import { rankWorkspaceContext } from "../../../lib/ai/relevanceRanking";
import { createContextCache } from "../../../lib/ai/contextPerformance";
import { buildWorkspaceGraph, dependenciesOf, dependentsOf } from "../../../lib/workspaceGraph/graph";
import { useRankedContext } from "../../../hooks/useRankedContext";

const STATUS_MESSAGES = {
  requesting: "Requesting access to this project's folder...",
  cancelled:
    "Folder access was cancelled. ModCodes could not connect to the project directory.",
  unsupported:
    "Your browser does not support the File System Access API. Please use a Chromium-based browser (Chrome or Edge).",
  denied: "Permission to read this project's folder was denied.",
  error: "ModCodes could not read this project's folder.",
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function IdeWorkspace({ selectedProject }) {
  const router = useRouter();
  const [status, setStatus] = useState("requesting");
  const [tree, setTree] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { layout, setLayout, toggleLeftPanel, startResize } = useWorkspaceLayout();
  const [revealRequest, setRevealRequest] = useState(null);
  const [explorerRevealRequest, setExplorerRevealRequest] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newFileRequest, setNewFileRequest] = useState(null);
  const [newFolderRequest, setNewFolderRequest] = useState(null);
  const [goToLineOpen, setGoToLineOpen] = useState(false);
  const [goToFileOpen, setGoToFileOpen] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState(null);
  const [replaceConfirm, setReplaceConfirm] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [aiPrompt, setAiPrompt] = useState(null);
  const monacoFocusRef = useRef(null);
  const monacoFindRef = useRef(null);
  const monacoSelectionRef = useRef(null);
  const contextCacheRef = useRef(createContextCache({ ttlMs: 2000 }));
  const graphNeighborsRef = useRef(null);
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [modcodesData, setModcodesData] = useState(null);
  const [workspaceMode, setWorkspaceMode] = useState("code"); // code | research | prd | roadmap | agent | overview
  const [showContinue, setShowContinue] = useState(false);
  const { orchestrator: agentOrchestrator } = useAgentWorkspace();
  const lifecycleOrchestrator = useMemo(() => createProjectLifecycleOrchestrator({ agentOrchestrator }), [agentOrchestrator]);
  useEffect(() => {
    let cancelled = false;
    checkBridgeHealth().then((r) => {
      if (!cancelled) {
        setBridgeAvailable(r.ok);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  // Load .modcodes when tree is available (local-first project memory)
  useEffect(() => {
    if (!tree || !selectedProject) return;
    const rootName = tree.name;
    ensureModcodes({ rootName, projectName: selectedProject.name, phase: "idea", source: selectedProject.bringing || "idea", github: selectedProject.githubRepo ? "pending" : null }).then((res) => {
      if (res.ok && res.data) {
        setModcodesData(res.data);
        if (res.created) {
          // new project: stay in code, .modcodes created
        } else {
          // existing: show Continue experience
          setShowContinue(true);
        }
      } else if (res.ok && res.absent) {
        // no .modcodes yet
      }
    });
  }, [tree, selectedProject]);
  const terminalProvider = useMemo(() => {
    function findTreeNode(node, segments) {
      let current = node;
      for (const segment of segments) {
        if (!current || current.kind !== "directory") {
          return null;
        }
        current =
          current.children?.find((child) => child.name === segment) || null;
      }
      return current;
    }

    async function readDirectory(target) {
      if (!tree) {
        return { ok: false, reason: "no project open" };
      }
      const rootName = tree.name;
      const targetPath = typeof target === "string" && target.length > 0 ? target : `/${rootName}`;
      const segments = targetPath
        .split("/")
        .filter((part) => part && part !== ".")
        .filter((part, index, parts) => !(part === ".." && index > 0 && parts[index - 1] !== ".."));
      if (segments.some((part) => part === "..")) {
        return { ok: false, reason: "paths outside the project root are not allowed" };
      }
      if (segments[0] !== rootName) {
        return { ok: false, reason: "unknown directory" };
      }
      const node = findTreeNode(tree, segments.slice(1));
      if (!node || node.kind !== "directory") {
        return { ok: false, reason: "no such directory" };
      }
      return {
        ok: true,
        entries: (node.children || []).map((child) => ({
          name: child.name,
          kind: child.kind,
        })),
      };
    }

    const useSystem = bridgeAvailable && Boolean(getBridgeToken());
    const backend = useSystem
      ? createSystemTerminalBackend({ getToken: getBridgeToken, getRootPath: () => tree?.name || null })
      : createBrowserSimulationBackend({
          readDirectory,
          getRootPath: () => tree?.name || null,
        });
    return createTerminalService({ backend });
  }, [tree, bridgeAvailable]);
  const persistTimer = useRef(null);
  const restoreAttemptedRef = useRef(false);

  const { toast } = useToast();

  const {
    tabs,
    activePath,
    pendingClosePath,
    batchClose,
    setActivePath,
    updateTab,
    addReadingDocs,
    resetEditor,
    openFile,
    switchTab,
    switchToRecentTab,
    handleContentChange,
    saveTab,
    reloadDocument,
    handleCloseTab,
    closeTabNow,
    handlePendingSave,
    handlePendingDiscard,
    handlePendingCancel,
    remapOpenTabs,
    dropTabsForPath,
    setTabContent,
    syncTabsWithDisk,
    switchToRelativeTab,
    handleCloseTabFromKeyboard,
    handleBatchSaveAll,
    handleBatchDiscardAll,
    handleBatchCancel,
    closeAllTabs,
    handleTabMenuAction,
  } = useTabs({ readFile, writeFile });

  const { diagnostics } = useDiagnostics({ tabs, activePath, tree });

  const workspaceGraph = useMemo(() => {
    if (!tree) {
      return { nodes: [], edges: [] };
    }
    const files = collectFilePaths(tree);
    return buildWorkspaceGraph({
      files,
      getAnalysis: (path) => {
        const tab = tabs.find((t) => t.path === path);
        if (!tab || typeof tab.content !== "string") {
          return null;
        }
        const imports = [];
        const importRegex = /import\s+.*?from\s+["'](\.[^"']+)["']/g;
        let m;
        while ((m = importRegex.exec(tab.content)) !== null) {
          imports.push({ source: m[1] });
        }
        return { imports };
      },
    });
  }, [tree, tabs]);

  useEffect(() => {
    if (activePath) {
      const neighbors = [...dependenciesOf(workspaceGraph, activePath), ...dependentsOf(workspaceGraph, activePath)];
      graphNeighborsRef.current = neighbors;
    }
  }, [activePath, workspaceGraph]);

  useEffect(() => {
    return () => {
      terminalProvider.dispose();
    };
  }, [terminalProvider]);

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

      const plan = buildRecoveryPlan(saved, collectFilePaths(tree));
      if (!plan.shouldRestore) {
        return;
      }

      const { openPaths, activePath } = plan;

      addReadingDocs(openPaths);

      setActivePath((current) => (current ? current : activePath));

      for (const path of openPaths) {
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

      toast({
        message: `Restored ${openPaths.length} open tab${openPaths.length === 1 ? "" : "s"} from a previous session. Unsaved changes cannot be recovered.`,
      });
    }

    restore();

    return () => {
      ignore = true;
    };
  }, [status, selectedProject?.id, updateTab, setActivePath, addReadingDocs, tree, toast]);

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

  function retry() {
    resetEditor();
    setTree(null);
    setStatus("requesting");
  }

  async function refreshProjectTree() {
    const result = await rescanProjectTree();
    if (result.ok) {
      setTree(result.tree);
    }
    return result;
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

  async function handleRenameEntry(path, newName) {
    const result = await renameEntry(path, newName);
    if (result.ok) {
      remapOpenTabs(path, result.path);
      await refreshProjectTree();
    }
    return result;
  }

  async function handleDeleteEntry(path) {
    const result = await deleteEntry(path);
    if (result.ok) {
      dropTabsForPath(path);
      await refreshProjectTree();
    }
    return result;
  }

  const handleSave = useCallback(() => {
    if (!activePath) {
      return;
    }

    const tab = tabs.find((entry) => entry.path === activePath);

    saveTab(activePath).then((result) => {
      if (result.ok) {
        toast(`Saved ${tab?.name || "file"}`, "success");
        return;
      }

      if (result.status === "conflict") {
        setConflict({
          path: activePath,
          diskContent: result.diskContent,
          diskLastModified: result.diskLastModified,
        });
        return;
      }

      if (result.status === "missing") {
        setConflict({ path: activePath, missing: true });
        return;
      }

      toast("Could not save the file.", "error");
    });
  }, [activePath, tabs, saveTab, toast]);

  async function handleConflictReload() {
    if (!conflict) {
      return;
    }

    const result = await reloadDocument(conflict.path);

    if (result.ok) {
      setConflict(null);
    } else if (result.status === "missing") {
      setConflict({ path: conflict.path, missing: true });
    } else {
      setConflict(null);
    }
  }

  function handleConflictOverwrite() {
    if (!conflict) {
      return;
    }

    const name = nameFromPath(conflict.path);

    saveTab(conflict.path, { force: true }).then((result) => {
      if (result.ok) {
        toast(`Saved ${name}`, "success");
      } else {
        toast("Could not save the file.", "error");
      }
      setConflict(null);
    });
  }

  async function handleConflictRecreate() {
    if (!conflict) {
      return;
    }

    const parent = parentPathOf(conflict.path);

    if (!parent) {
      toast("Could not locate the file's folder.", "error");
      return;
    }

    const name = nameFromPath(conflict.path);
    const result = await createFile(parent, name);

    if (!result.ok) {
      toast(friendlyError(result.status), "error");
      return;
    }

    await refreshProjectTree();

    const saved = await saveTab(conflict.path, { force: true });

    if (saved.ok) {
      toast(`Recreated and saved ${name}`, "success");
    } else {
      toast("Could not save the recreated file.", "error");
    }
    setConflict(null);
  }

  function handleConflictClose() {
    if (!conflict) {
      return;
    }
    closeTabNow(conflict.path);
    setConflict(null);
  }

  function handleSearchSelect(match) {
    openFile({ path: match.path, name: match.name });
    setRevealRequest((current) => ({
      token: (current?.token || 0) + 1,
      path: match.path,
      line: match.line,
    }));
  }

  function handleDiagnosticSelect(diagnostic) {
    openFile({ path: diagnostic.path, name: nameFromPath(diagnostic.path) });
    setRevealRequest((current) => ({
      token: (current?.token || 0) + 1,
      path: diagnostic.path,
      line: diagnostic.line,
    }));
  }

  function handleOutlineSelect(symbol) {
    if (!activePath) {
      return;
    }
    setRevealRequest((current) => ({
      token: (current?.token || 0) + 1,
      path: activePath,
      line: symbol.line,
    }));
    monacoFocusRef.current?.focus();
  }

  function handleSymbolSelect(symbol) {
    if (symbol.path !== activePath) {
      openFile({ path: symbol.path, name: nameFromPath(symbol.path) });
    }
    setRevealRequest((current) => ({
      token: (current?.token || 0) + 1,
      path: symbol.path,
      line: symbol.line,
    }));
    setSymbolSearch(null);
    monacoFocusRef.current?.focus();
  }

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    monacoFocusRef.current?.focus();
  }, []);

  function handleGoToLine(line) {
    if (!activePath) {
      return;
    }
    setRevealRequest((current) => ({
      token: (current?.token || 0) + 1,
      path: activePath,
      line,
    }));
    setGoToLineOpen(false);
    monacoFocusRef.current?.focus();
  }

  function handleBreadcrumbNavigate(dirPath) {
    setLayout((current) => ({ ...current, leftOpen: true }));
    setExplorerRevealRequest((current) => ({
      token: (current?.token || 0) + 1,
      path: dirPath,
    }));
  }

  function handleReplaceMatch(match, query, replacement, options) {
    return replaceSingleMatch({
      getDocument: (path) => tabs.find((tab) => tab.path === path),
      read: readFile,
      setContent: setTabContent,
      match,
      replacement,
    });
  }

  async function handleReplaceAllWorkspace(query, replacement, options) {
    const result = await previewWorkspaceReplace(query, options);

    if (!result.ok) {
      toast(friendlyError(result.status), "error");
      return;
    }

    if (result.totalMatches === 0) {
      toast("No matches found.", "info");
      return;
    }

    setReplaceConfirm({
      query,
      replacement,
      options,
      files: result.files,
      totalMatches: result.totalMatches,
      totalFiles: result.totalFiles,
    });
  }

  async function applyWorkspaceReplace() {
    if (!replaceConfirm) {
      return;
    }

    const { query, replacement, options, files } = replaceConfirm;

    await applyWorkspaceReplaceCore({
      files,
      getDocument: (path) => tabs.find((tab) => tab.path === path),
      read: readFile,
      setContent: setTabContent,
      query,
      replacement,
      options,
    });

    toast(
      `Replaced matches across ${replaceConfirm.totalFiles} file${
        replaceConfirm.totalFiles === 1 ? "" : "s"
      }. Save each edited file to write the changes.`,
      "success"
    );

    setReplaceConfirm(null);
  }

  function handleReplaceCancel() {
    setReplaceConfirm(null);
  }

  const commands = [
    {
      id: "save-file",
      title: "Save File",
      shortcut: "Ctrl+S",
      execute: () => {
        handleSave();
      },
    },
    {
      id: "close-active-tab",
      title: "Close Active Tab",
      shortcut: "Ctrl+W",
      execute: () => {
        handleCloseTabFromKeyboard();
      },
    },
    {
      id: "close-all-tabs",
      title: "Close All Tabs",
      shortcut: "",
      execute: () => {
        closeAllTabs();
      },
    },
    {
      id: "switch-recent-tab",
      title: "Switch to Recent Tab",
      shortcut: "Ctrl+Tab",
      execute: () => {
        switchToRecentTab();
      },
    },
    {
      id: "refresh-explorer",
      title: "Refresh Explorer",
      shortcut: "",
      execute: () => {
        handleRefresh();
      },
    },
    {
      id: "search-workspace",
      title: "Search Workspace",
      shortcut: "",
      execute: () => {
        toggleLeftPanel("search");
      },
    },
    {
      id: "toggle-file-explorer",
      title: "Toggle File Explorer",
      shortcut: "",
      execute: () => {
        toggleLeftPanel("explorer");
      },
    },
    {
      id: "open-ai-chat",
      title: "Open AI Chat",
      shortcut: "",
      execute: () => {
        setLayout((current) => ({ ...current, rightOpen: true, rightTab: "ai" }));
      },
    },
    {
      id: "go-to-symbol-file",
      title: "Go to Symbol in File",
      shortcut: "Ctrl+Shift+O",
      execute: () => {
        if (activePath) {
          setSymbolSearch({ mode: "file" });
        }
      },
    },
    {
      id: "go-to-symbol-workspace",
      title: "Go to Symbol in Workspace",
      shortcut: "Ctrl+T",
      execute: () => {
        setSymbolSearch({ mode: "workspace" });
      },
    },
    {
      id: "new-file",
      title: "New File",
      shortcut: "",
      opensDialog: true,
      execute: () => {
        setNewFileRequest((current) => ({
          token: (current?.token || 0) + 1,
        }));
      },
    },
    {
      id: "new-folder",
      title: "New Folder",
      shortcut: "",
      opensDialog: true,
      execute: () => {
        setNewFolderRequest((current) => ({
          token: (current?.token || 0) + 1,
        }));
      },
    },
    {
      id: "go-to-file",
      title: "Go to File",
      shortcut: "Ctrl+P",
      execute: () => {
        setGoToFileOpen(true);
      },
    },
    {
      id: "go-to-line",
      title: "Go to Line",
      shortcut: "Ctrl+G",
      execute: () => {
        if (activePath) {
          setGoToLineOpen(true);
        }
      },
    },
    {
      id: "find-in-file",
      title: "Find in File",
      shortcut: "Ctrl+F",
      execute: () => {
        monacoFindRef.current?.find();
      },
    },
    ...CODE_ACTIONS.map((action) => ({
      id: action.id,
      title: action.title,
      shortcut: "",
      execute: () => triggerAiAction(action.id),
    })),
    ...WORKSPACE_COMMANDS.map((command) => ({
      id: command.id,
      title: command.title,
      shortcut: "",
      execute: () => triggerWorkspaceCommand(command.id),
    })),
  ];

  function handleCommandSelect(command) {
    command.execute();
    setPaletteOpen(false);
    if (!command.opensDialog) {
      monacoFocusRef.current?.focus();
    }
  }

  useEffect(() => {
    function onKeyDown(event) {
      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
        return;
      }

      if (paletteOpen) {
        if (event.key === "Escape") {
          closePalette();
        }
        return;
      }

      if (goToLineOpen) {
        if (event.key === "Escape") {
          setGoToLineOpen(false);
        }
        return;
      }

      if (goToFileOpen) {
        if (event.key === "Escape") {
          setGoToFileOpen(false);
        }
        return;
      }

      if (symbolSearch) {
        if (event.key === "Escape") {
          setSymbolSearch(null);
        }
        return;
      }

      if (conflict) {
        if (event.key === "Escape") {
          setConflict(null);
        }
        return;
      }

      if (status !== "ready" || pendingClosePath) {
        return;
      }

      if (mod && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setGoToFileOpen(true);
        return;
      }

      if (mod && event.key.toLowerCase() === "g") {
        event.preventDefault();
        if (activePath) {
          setGoToLineOpen(true);
        }
        return;
      }

      if (mod && event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        if (activePath) {
          setSymbolSearch({ mode: "file" });
        }
        return;
      }

      if (mod && event.key.toLowerCase() === "t") {
        event.preventDefault();
        setSymbolSearch({ mode: "workspace" });
        return;
      }

      if (mod && event.key === "Tab") {
        if (
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement
        ) {
          return;
        }
        event.preventDefault();
        switchToRecentTab();
        return;
      }

      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (activePath) {
          handleSave();
        }
        return;
      }

      if (mod && event.key.toLowerCase() === "w") {
        event.preventDefault();
        handleCloseTabFromKeyboard();
        return;
      }

      if (mod && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setLayout((current) => ({ ...current, leftOpen: !current.leftOpen }));
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
    paletteOpen,
    goToLineOpen,
    goToFileOpen,
    symbolSearch,
    conflict,
    saveTab,
    handleSave,
    switchToRecentTab,
    handleCloseTabFromKeyboard,
    switchToRelativeTab,
    handlePendingCancel,
    closePalette,
    setLayout,
  ]);

  const openPaths = tabs.map((tab) => tab.path);
  const activeTab = tabs.find((tab) => tab.path === activePath) || null;
  const pendingTab = tabs.find((tab) => tab.path === pendingClosePath) || null;

  const getSelectionForAi = useCallback(() => {
    const sel = monacoSelectionRef.current?.getSelection?.();
    if (!sel || !activePath) {
      return null;
    }
    return { path: activePath, text: sel.text, startLine: sel.startLine, endLine: sel.endLine };
  }, [activePath]);

  const getAiContext = useCallback(() => {
    const currentFile =
      activePath && typeof activeTab?.content === "string"
        ? {
            path: activePath,
            content: activeTab.content,
            language: activeTab.language || null,
          }
        : null;

    const selection = getSelectionForAi();

    const allOpen = tabs
      .filter((tab) => typeof tab.content === "string")
      .map((tab) => ({
        path: tab.path,
        name: tab.name,
        content: tab.content,
        size: tab.content.length,
        priority: 99,
      }));

    const budget = clampBudget(settings.ai?.contextBudget);
    const cacheKey = { currentFile, selection, budget, sources: ["ranked"] };
    const cached = contextCacheRef.current.get(cacheKey);
    let openDocuments;
    if (cached && cached.openDocuments) {
      openDocuments = cached.openDocuments;
    } else {
      const ranked = rankWorkspaceContext({
        candidates: allOpen,
        currentFile,
        selection,
        activePath,
        diagnostics,
        recentPaths: tabs.map((t) => t.path),
        graphNeighbors: Array.isArray(graphNeighborsRef.current) ? graphNeighborsRef.current : [],
        budget,
      });
      openDocuments = ranked.included.map((item) => {
        const original = allOpen.find((c) => c.path === item.path);
        return { path: original.path, name: original.name, content: original.content };
      });
      contextCacheRef.current.set(cacheKey, { openDocuments });
    }

    return {
      currentFile,
      selection,
      openDocuments,
      diagnostics,
      budget,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settings from context is stable and correctly triggers re-render
  }, [activePath, activeTab, tabs, diagnostics, settings, getSelectionForAi]);

  const triggerAiAction = useCallback(
    (actionId) => {
      const selection = getSelectionForAi();
      const context = {
        selection: selection?.text || null,
        fileContent: activeTab?.content || null,
        path: activePath,
      };
      const prompt = buildCodeActionPrompt(actionId, context);
      if (prompt) {
        setLayout((current) => ({ ...current, rightOpen: true, rightTab: "ai" }));
        setAiPrompt({ content: prompt, selection, token: Date.now(), actionId });
      } else {
        setLayout((current) => ({ ...current, rightOpen: true, rightTab: "ai" }));
      }
    },
    [getSelectionForAi, activeTab, activePath, setLayout]
  );

  const triggerWorkspaceCommand = useCallback(
    (commandId) => {
      const context = {
        fileTree: tree,
        openDocuments: tabs.map((tab) => ({ path: tab.path, dirty: tab.dirty })),
        diagnostics,
        graph: null,
        symbols: null,
        searchResults: null,
      };
      const prompt = buildWorkspacePrompt(commandId, context);
      if (prompt) {
        setLayout((current) => ({ ...current, rightOpen: true, rightTab: "ai" }));
        setAiPrompt({ content: prompt, token: Date.now(), actionId: commandId });
      }
    },
    [tree, tabs, diagnostics, setLayout]
  );

  const handleApplyDiff = useCallback(
    (diff) => {
      const dummyManager = {
        setContent: (path, name, content, savedContent) => {
          setTabContent(path, content);
        },
      };
      acceptDiff(dummyManager, diff);
      toast(`Applied suggestion to ${diff.path}. Save to write to disk.`, "success");
    },
    [setTabContent, toast]
  );

  const handleAiNavigate = useCallback(
    (ref) => {
      if (!ref || !ref.path) {
        return;
      }
      openFile({ path: ref.path, name: ref.path.split("/").pop() });
      if (ref.line) {
        setRevealRequest((current) => ({
          token: (current?.token || 0) + 1,
          path: ref.path,
          line: ref.line,
        }));
      }
      monacoFocusRef.current?.focus();
    },
    [openFile]
  );
  const canRetry = ["cancelled", "denied", "error"].includes(status);

  return (
    <section className="ide-workspace">
      <header className="ide-header">
        <div>
          <h1>MODCODES IDE</h1>
          <p>Project: {selectedProject?.name || "Untitled Project"}</p>
        </div>
        <div className="ide-header-actions">
          <button
            className="ide-header-button"
            title="Back to Projects"
            onClick={() => router.push("/projects")}
          >
            Projects
          </button>
          <button
            className={`ide-header-button${
              layout.leftOpen && layout.leftTab === "explorer"
                ? " ide-header-button-active"
                : ""
            }`}
            title="Toggle Explorer panel (Ctrl+B)"
            onClick={() => toggleLeftPanel("explorer")}
          >
            {layout.leftOpen && layout.leftTab === "explorer"
              ? "Close Explorer"
              : "Explorer"}
          </button>
          <button
            className={`ide-header-button${
              layout.leftOpen && layout.leftTab === "search"
                ? " ide-header-button-active"
                : ""
            }`}
            title="Toggle Search panel"
            onClick={() => toggleLeftPanel("search")}
          >
            {layout.leftOpen && layout.leftTab === "search"
              ? "Close Search"
              : "Search"}
          </button>
          <button
            className={`ide-header-button${
              layout.terminalOpen ? " ide-header-button-active" : ""
            }`}
            title="Toggle Terminal panel"
            onClick={() =>
              setLayout((current) => ({
                ...current,
                terminalOpen: !current.terminalOpen,
              }))
            }
          >
            {layout.terminalOpen ? "Close Terminal" : "Terminal"}
          </button>
          <button
            className={`ide-header-button${
              layout.rightOpen ? " ide-header-button-active" : ""
            }`}
            title="Toggle side panels"
            onClick={() =>
              setLayout((current) => ({ ...current, rightOpen: !current.rightOpen }))
            }
          >
            {layout.rightOpen ? "Hide Panels" : "Panels"}
          </button>
        </div>
      </header>
      <div className="workspace-mode-bar" style={{display:"flex",gap:6,padding:"6px 0"}}>
        {[
          ["code","Code"],
          ["overview","Overview"],
          ["research","Research"],
          ["prd","PRD"],
          ["roadmap","Roadmap"],
          ["agent","Agent"],
        ].map(([id,label])=>(
          <button key={id} className={`ide-header-button${workspaceMode===id?" ide-header-button-active":""}`} onClick={()=>setWorkspaceMode(id)}>{label}</button>
        ))}
        <span style={{marginLeft:"auto",color:"var(--secondary-text)",fontSize:12,alignSelf:"center"}}>Phase: {modcodesData?.project?.phase || "idea"} · .modcodes local</span>
      </div>

      {showContinue && modcodesData && (
        <ProjectOverview
          modcodesData={modcodesData}
          codebaseSnapshot={{ fileCount: tree ? collectFileCount(tree) : 0, filesChangedSinceLastSession: 0, depsCount: 0, prdHash: modcodesData.sections?.PRD ? "present" : null }}
          onContinue={()=>setShowContinue(false)}
          onReview={()=>setShowContinue(false)}
          onOpen={()=>setShowContinue(false)}
          onPhaseChange={(next)=>{ const updated={...modcodesData, project:{...modcodesData.project, phase: next, updatedAt:new Date().toISOString()}}; setModcodesData(updated); saveModcodes({rootName: tree.name, data: updated});}}
        />
      )}

      {status === "ready" && tree ? (
        <>
          {workspaceMode !== "code" ? (
            <div style={{flex:1, minHeight:0, overflow:"auto", background:"var(--workspace-bg)", border:"1px solid var(--border-color)", borderRadius:8}}>
              {workspaceMode==="overview" && <ProjectOverview modcodesData={modcodesData} codebaseSnapshot={{fileCount: collectFileCount(tree), filesChangedSinceLastSession:0}} onContinue={()=>setWorkspaceMode("code")} onOpen={()=>setWorkspaceMode("code")} onReview={()=>{}} onPhaseChange={(next)=>{const u={...modcodesData, project:{...modcodesData.project, phase:next, updatedAt:new Date().toISOString()}}; setModcodesData(u); saveModcodes({rootName:tree.name,data:u});}} />}
              {workspaceMode==="research" && <ResearchWorkspace modcodesData={modcodesData} onUpdate={(next)=>{setModcodesData(next); saveModcodes({rootName:tree.name,data:next});}} />}
              {workspaceMode==="prd" && <PRDWorkspace modcodesData={modcodesData} onUpdate={(next)=>{setModcodesData(next); saveModcodes({rootName:tree.name,data:next});}} />}
              {workspaceMode==="roadmap" && <RoadmapWorkspace modcodesData={modcodesData} lifecycle={lifecycleOrchestrator} tree={tree} onSwitchToAgent={()=>setWorkspaceMode("agent")} onUpdate={(next)=>{setModcodesData(next); saveModcodes({rootName:tree.name,data:next});}} />}
              {workspaceMode==="agent" && <AgentWorkspace orchestrator={agentOrchestrator} lifecycle={lifecycleOrchestrator} />}
            </div>
          ) : (
          <div className="ide-layout">
            {layout.leftOpen && (
              <>
                <div
                  className="ide-panel ide-left-panel"
                  style={{ width: layout.leftWidth }}
                >
                  <div className="ide-panel-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={layout.leftTab === "explorer"}
                      className={`ide-panel-tab${
                        layout.leftTab === "explorer"
                          ? " ide-panel-tab-active"
                          : ""
                      }`}
                      onClick={() => toggleLeftPanel("explorer")}
                    >
                      Explorer
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={layout.leftTab === "search"}
                      className={`ide-panel-tab${
                        layout.leftTab === "search" ? " ide-panel-tab-active" : ""
                      }`}
                      onClick={() => toggleLeftPanel("search")}
                    >
                      Search
                    </button>
                  </div>
                  <div className="ide-panel-content">
                    {layout.leftTab === "explorer" ? (
                      <FileExplorer
                        root={tree}
                        onFileSelect={openFile}
                        selectedFilePath={activePath}
                        onCreateFile={handleCreateFile}
                        onCreateFolder={handleCreateFolder}
                        onRename={handleRenameEntry}
                        onDelete={handleDeleteEntry}
                        onRefresh={handleRefresh}
                        newFileRequest={newFileRequest}
                        newFolderRequest={newFolderRequest}
                        revealRequest={explorerRevealRequest}
                      />
                    ) : (
                      <SearchPanel
                        onSelect={handleSearchSelect}
                        onClose={() =>
                          setLayout((current) => ({
                            ...current,
                            leftTab: "explorer",
                          }))
                        }
                        onReplaceMatch={handleReplaceMatch}
                        onReplaceAllWorkspace={handleReplaceAllWorkspace}
                      />
                    )}
                  </div>
                </div>
                <div
                  className="ide-resize-handle ide-resize-vertical"
                  role="separator"
                  aria-orientation="vertical"
                  title="Resize Explorer panel"
                  onPointerDown={startResize({
                    horizontal: false,
                    getSize: () => layout.leftWidth,
                    setSize: (size) =>
                      setLayout((current) => ({
                        ...current,
                        leftWidth: clamp(size, 180, 480),
                      })),
                  })}
                />
              </>
            )}
            <div className="editor-region">
              <TabBar
                tabs={tabs}
                activePath={activePath}
                onActivate={switchTab}
                onClose={handleCloseTab}
                onMenuAction={handleTabMenuAction}
              />
              <EditorPane
                tab={activeTab}
                openPaths={openPaths}
                onChange={handleContentChange}
                onSave={handleSave}
                revealRequest={revealRequest}
                focusHandleRef={monacoFocusRef}
                findHandleRef={monacoFindRef}
                selectionHandleRef={monacoSelectionRef}
                onNavigateDirectory={handleBreadcrumbNavigate}
              />
            </div>
            {layout.rightOpen && (
              <>
                <div
                  className="ide-resize-handle ide-resize-vertical"
                  role="separator"
                  aria-orientation="vertical"
                  title="Resize side panel"
                  onPointerDown={startResize({
                    horizontal: false,
                    getSize: () => layout.rightWidth,
                    setSize: (size) =>
                      setLayout((current) => ({
                        ...current,
                        rightWidth: clamp(size, 200, 480),
                      })),
                  })}
                />
                <div
                  className="ide-panel ide-right-panel"
                  style={{ width: layout.rightWidth }}
                >
                  <div className="ide-panel-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={layout.rightTab === "problems"}
                      className={`ide-panel-tab${
                        layout.rightTab === "problems"
                          ? " ide-panel-tab-active"
                          : ""
                      }`}
                      onClick={() =>
                        setLayout((current) => ({
                          ...current,
                          rightTab: "problems",
                        }))
                      }
                    >
                      Problems
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={layout.rightTab === "outline"}
                      className={`ide-panel-tab${
                        layout.rightTab === "outline"
                          ? " ide-panel-tab-active"
                          : ""
                      }`}
                      onClick={() =>
                        setLayout((current) => ({
                          ...current,
                          rightTab: "outline",
                        }))
                      }
                    >
                      Outline
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={layout.rightTab === "graph"}
                      className={`ide-panel-tab${
                        layout.rightTab === "graph" ? " ide-panel-tab-active" : ""
                      }`}
                      onClick={() =>
                        setLayout((current) => ({
                          ...current,
                          rightTab: "graph",
                        }))
                      }
                    >
                      Graph
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={layout.rightTab === "git"}
                      className={`ide-panel-tab${
                        layout.rightTab === "git" ? " ide-panel-tab-active" : ""
                      }`}
                      onClick={() =>
                        setLayout((current) => ({
                          ...current,
                          rightTab: "git",
                        }))
                      }
                    >
                      Git
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={layout.rightTab === "ai"}
                      className={`ide-panel-tab${
                        layout.rightTab === "ai" ? " ide-panel-tab-active" : ""
                      }`}
                      onClick={() =>
                        setLayout((current) => ({
                          ...current,
                          rightTab: "ai",
                        }))
                      }
                    >
                      AI
                    </button>
                  </div>
                  <div className="ide-panel-content">
                    {layout.rightTab === "outline" ? (
                      <OutlinePanel
                        path={activePath}
                        content={activeTab?.content}
                        contentToken={activeTab?.contentToken}
                        onSelect={handleOutlineSelect}
                      />
                    ) : layout.rightTab === "graph" ? (
                      <GraphPanel
                        activePath={activePath}
                        activeContent={activeTab?.content}
                        tree={tree}
                        tabs={tabs}
                        readFile={readFile}
                        onOpen={(path) =>
                          openFile({ path, name: nameFromPath(path) })
                        }
                      />
                    ) : layout.rightTab === "git" ? (
                      <GitPanel tree={tree} />
                    ) : layout.rightTab === "ai" ? (
                      <AIPanel
                        getContextData={getAiContext}
                        externalPrompt={aiPrompt}
                        onApplyDiff={handleApplyDiff}
                        onNavigate={handleAiNavigate}
                      />
                    ) : (
                      <ProblemsPanel
                        diagnostics={diagnostics}
                        onSelect={handleDiagnosticSelect}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          )}

          {layout.terminalOpen && (
            <div
              className="ide-terminal-area"
              style={{ height: layout.terminalHeight }}
            >
              <div
                className="ide-resize-handle ide-resize-horizontal"
                role="separator"
                aria-orientation="horizontal"
                title="Resize Terminal panel"
                onPointerDown={startResize({
                  horizontal: true,
                  getSize: () => layout.terminalHeight,
                  setSize: (size) =>
                    setLayout((current) => ({
                      ...current,
                      terminalHeight: clamp(size, 100, 480),
                    })),
                })}
              />
              <TerminalPanel
                provider={terminalProvider}
                onClose={() =>
                  setLayout((current) => ({ ...current, terminalOpen: false }))
                }
              />
            </div>
          )}

          {paletteOpen && (
            <CommandPalette
              commands={commands}
              onSelect={handleCommandSelect}
              onClose={closePalette}
            />
          )}

          {goToLineOpen && (
            <GoToLineDialog
              onGo={handleGoToLine}
              onClose={() => setGoToLineOpen(false)}
            />
          )}

          {goToFileOpen && (
            <GoToFileDialog
              tree={tree}
              onOpen={openFile}
              onClose={() => setGoToFileOpen(false)}
            />
          )}

          {symbolSearch && (
            <GoToSymbolDialog
              mode={symbolSearch.mode}
              activePath={activePath}
              activeContent={activeTab?.content}
              tabs={tabs}
              onSelect={handleSymbolSelect}
              onClose={() => setSymbolSearch(null)}
            />
          )}

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

          {batchClose && (
            <div className="unsaved-overlay">
              <div className="unsaved-dialog" role="dialog" aria-modal="true">
                <p className="unsaved-title">Unsaved changes</p>
                <p>
                  {batchClose.dirtyPaths.length} tab
                  {batchClose.dirtyPaths.length === 1 ? "" : "s"} ha
                  {batchClose.dirtyPaths.length === 1 ? "s" : "ve"} unsaved
                  changes. Save before closing?
                </p>
                <div className="unsaved-actions">
                  <button
                    className="unsaved-button unsaved-button-primary"
                    onClick={handleBatchSaveAll}
                  >
                    Save All
                  </button>
                  <button
                    className="unsaved-button unsaved-button-danger"
                    onClick={handleBatchDiscardAll}
                  >
                    Discard All
                  </button>
                  <button
                    className="unsaved-button"
                    onClick={handleBatchCancel}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {conflict && (
            <div className="unsaved-overlay">
              <div className="unsaved-dialog" role="dialog" aria-modal="true">
                <p className="unsaved-title">
                  {conflict.missing
                    ? "File no longer exists"
                    : "File changed outside MODCODES"}
                </p>
                {conflict.missing ? (
                  <p>
                    <strong>{nameFromPath(conflict.path)}</strong> was deleted
                    outside MODCODES. Your unsaved changes are kept in memory.
                    Recreate the file to save them, or close the tab to discard
                    them.
                  </p>
                ) : (
                  <p>
                    <strong>{nameFromPath(conflict.path)}</strong> was changed
                    on disk after it was opened. Overwrite to keep your
                    changes, or reload to keep the on-disk version and discard
                    your unsaved changes.
                  </p>
                )}
                <div className="unsaved-actions">
                  {conflict.missing ? (
                    <>
                      <button
                        className="unsaved-button unsaved-button-primary"
                        onClick={handleConflictRecreate}
                      >
                        Recreate & Save
                      </button>
                      <button
                        className="unsaved-button unsaved-button-danger"
                        onClick={handleConflictClose}
                      >
                        Close
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="unsaved-button unsaved-button-danger"
                        onClick={handleConflictReload}
                      >
                        Reload
                      </button>
                      <button
                        className="unsaved-button unsaved-button-primary"
                        onClick={handleConflictOverwrite}
                      >
                        Overwrite
                      </button>
                    </>
                  )}
                  <button
                    className="unsaved-button"
                    onClick={() => setConflict(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <ConfirmDialog
            open={Boolean(replaceConfirm)}
            title="Replace in workspace"
            message={
              <>
                Replace {replaceConfirm?.totalMatches} match
                {replaceConfirm?.totalMatches === 1 ? "" : "es"} across{" "}
                {replaceConfirm?.totalFiles} file
                {replaceConfirm?.totalFiles === 1 ? "" : "s"}? Affected files
                will be updated in the editor. Nothing is written to disk until
                you save each file.
              </>
            }
            confirmLabel="Replace"
            danger
            onConfirm={applyWorkspaceReplace}
            onCancel={handleReplaceCancel}
          />
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