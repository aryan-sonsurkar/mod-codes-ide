import { useEffect, useRef, useState } from "react";
import {
  computeAffectedPaths,
  createEmptyTab,
  isUnderPath,
  nameFromPath,
  nextActivePath,
  remapPath,
} from "../lib/editor/tabUtils";
import { DocumentManager } from "../lib/editor/documents";
import { RecentTabs } from "../lib/editor/recentTabs";

export function useTabs({ readFile, writeFile }) {
  const [manager] = useState(
    () => new DocumentManager({ readFile, writeFile })
  );
  const [tabs, setTabs] = useState(() => manager.getSnapshot());
  const [activePath, setActivePath] = useState(null);
  const [pendingClosePath, setPendingClosePath] = useState(null);
  const [batchClose, setBatchClose] = useState(null);
  const recentTabsRef = useRef(new RecentTabs());

  useEffect(() => {
    return manager.subscribe(() => {
      setTabs(manager.getSnapshot());
    });
  }, [manager]);

  function updateTab(path, changes) {
    manager.updateDocument(path, changes);
  }

  function addReadingDocs(paths) {
    const existing = new Set(manager.getSnapshot().map((tab) => tab.path));
    const toAdd = paths
      .filter((path) => !existing.has(path))
      .map((path) =>
        createEmptyTab({
          path,
          name: nameFromPath(path),
          readStatus: "reading",
        })
      );

    if (toAdd.length) {
      manager.addDocuments(toAdd);
    }
  }

  function resetEditor() {
    manager.reset();
    setActivePath(null);
    setPendingClosePath(null);
  }

  function openFile(file) {
    if (manager.get(file.path)) {
      setActivePath(file.path);
      recentTabsRef.current.record(file.path);
      return;
    }

    manager.open(file.path, file.name);
    setActivePath(file.path);
    recentTabsRef.current.record(file.path);
  }

  function switchTab(path) {
    setActivePath(path);
    recentTabsRef.current.record(path);
  }

  function switchToRecentTab() {
    if (!tabs.length) {
      return;
    }

    if (!activePath) {
      setActivePath(tabs[0].path);
      return;
    }

    const next = recentTabsRef.current.next(
      activePath,
      tabs.map((tab) => tab.path)
    );

    if (next) {
      setActivePath(next);
      recentTabsRef.current.record(next);
    }
  }

  function handleContentChange(path, content) {
    manager.update(path, content);
  }

  function saveTab(path, options) {
    return manager.save(path, options);
  }

  function reloadDocument(path) {
    return manager.reload(path);
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
    if (!manager.get(path)) {
      return;
    }

    setActivePath(nextActivePath(tabs, new Set([path]), activePath));
    manager.remove(path);
  }

  function handlePendingSave() {
    manager.save(pendingClosePath).then((result) => {
      if (result.ok && pendingClosePath) {
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

  function remapOpenTabs(oldPath, newPath) {
    manager.remap(oldPath, newPath);
    setActivePath((current) =>
      current ? remapPath(current, oldPath, newPath) : current
    );
  }

  function dropTabsForPath(path) {
    const current = manager.getSnapshot();
    const removedSet = new Set(
      current
        .filter((tab) => isUnderPath(tab.path, path))
        .map((tab) => tab.path)
    );

    if (removedSet.size === 0) {
      return;
    }

    setActivePath(nextActivePath(current, removedSet, activePath));
    manager.drop(path);
  }

  function setTabContent(path, name, content, savedContent) {
    manager.setContent(path, name, content, savedContent);
  }

  function syncTabsWithDisk() {
    return manager.syncWithDisk();
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

  function closeTabSet(pathsToClose) {
    const closeSet = new Set(pathsToClose);

    if (closeSet.size === 0) {
      return;
    }

    setActivePath(nextActivePath(tabs, closeSet, activePath));

    for (const path of closeSet) {
      recentTabsRef.current.forget(path);
    }

    manager.removeSet(pathsToClose);
  }

  function planBatchClose(mode, targetPath) {
    const target = targetPath || activePath;
    const affected = computeAffectedPaths(tabs, mode, target);

    if (affected.size === 0) {
      return;
    }

    const dirtyPaths = tabs
      .filter((tab) => tab.dirty && affected.has(tab.path))
      .map((tab) => tab.path);

    if (dirtyPaths.length === 0) {
      closeTabSet([...affected]);
      return;
    }

    setBatchClose({ mode, affected: [...affected], dirtyPaths });
  }

  function handleBatchSaveAll() {
    if (!batchClose) {
      return;
    }

    Promise.all(
      batchClose.dirtyPaths.map((path) =>
        manager.save(path).then((result) => ({ path, ok: result.ok }))
      )
    ).then((results) => {
      const failed = new Set(
        results.filter((result) => !result.ok).map((result) => result.path)
      );
      const toClose = batchClose.affected.filter(
        (path) => !failed.has(path)
      );
      closeTabSet(toClose);
      setBatchClose(null);
    });
  }

  function handleBatchDiscardAll() {
    if (!batchClose) {
      return;
    }
    closeTabSet(batchClose.affected);
    setBatchClose(null);
  }

  function handleBatchCancel() {
    setBatchClose(null);
  }

  function handleCloseOthers(targetPath) {
    planBatchClose("others", targetPath);
  }

  function handleCloseRight(targetPath) {
    planBatchClose("right", targetPath);
  }

  function handleCloseCleanTabs() {
    const cleanPaths = tabs
      .filter((tab) => !tab.dirty)
      .map((tab) => tab.path);
    closeTabSet(cleanPaths);
  }

  function closeAllTabs() {
    planBatchClose("all");
  }

  function handleTabMenuAction(action, targetPath) {
    if (action === "others") {
      handleCloseOthers(targetPath);
    } else if (action === "right") {
      handleCloseRight(targetPath);
    } else if (action === "clean") {
      handleCloseCleanTabs();
    } else if (action === "all") {
      closeAllTabs();
    }
  }

  return {
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
    handleCloseOthers,
    handleCloseRight,
    handleCloseCleanTabs,
    closeAllTabs,
    handleTabMenuAction,
  };
}