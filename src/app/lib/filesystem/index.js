import * as disk from "./filesystem";
import * as virtual from "./virtualFS";

let mode = "disk";

export function getWorkspaceMode() {
  return mode;
}

export function isWorkspaceVirtual() {
  return mode === "virtual";
}

export function isDirectoryAccessSupported() {
  return disk.isDirectoryAccessSupported();
}

export async function openProjectDirectory(project) {
  const wantsVirtual =
    project && (project.storage === "virtual" || project.location === "This browser");

  if (wantsVirtual) {
    mode = "virtual";
    return virtual.openVirtualWorkspace(project.name);
  }

  if (!disk.isDirectoryAccessSupported()) {
    mode = "disk";
    return { ok: false, status: "unsupported" };
  }

  mode = "disk";
  virtual.closeVirtualWorkspace();
  return disk.openProjectDirectory();
}

export function closeWorkspace() {
  if (mode === "virtual") {
    virtual.closeVirtualWorkspace();
  }
  mode = "disk";
}

export function getRootHandle() {
  return mode === "virtual" ? virtual.virtualGetRootHandle() : disk.getRootHandle();
}

export function readFile(path) {
  return mode === "virtual" ? virtual.virtualReadFile(path) : disk.readFile(path);
}

export function writeFile(path, content) {
  return mode === "virtual"
    ? virtual.virtualWriteFile(path, content)
    : disk.writeFile(path, content);
}

export function createFile(parentPath, name) {
  return mode === "virtual"
    ? virtual.virtualCreateFile(parentPath, name)
    : disk.createFile(parentPath, name);
}

export function createDirectory(parentPath, name) {
  return mode === "virtual"
    ? virtual.virtualCreateDirectory(parentPath, name)
    : disk.createDirectory(parentPath, name);
}

export function renameEntry(oldPath, newName) {
  return mode === "virtual"
    ? virtual.virtualRenameEntry(oldPath, newName)
    : disk.renameEntry(oldPath, newName);
}

export function deleteEntry(path) {
  return mode === "virtual" ? virtual.virtualDeleteEntry(path) : disk.deleteEntry(path);
}

export function rescanProjectTree() {
  return mode === "virtual"
    ? virtual.virtualRescanProjectTree()
    : disk.rescanProjectTree();
}

export function searchWorkspace(query, options) {
  return mode === "virtual"
    ? virtual.virtualSearchWorkspace(query, options)
    : disk.searchWorkspace(query, options);
}

export function previewWorkspaceReplace(query, options) {
  return mode === "virtual"
    ? virtual.virtualPreviewWorkspaceReplace(query, options)
    : disk.previewWorkspaceReplace(query, options);
}
