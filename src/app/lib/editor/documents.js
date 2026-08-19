import {
  createEmptyTab,
  isUnderPath,
  nameFromPath,
  remapPath,
} from "./tabUtils";

export class DocumentManager {
  constructor({ readFile, writeFile }) {
    this.documents = new Map();
    this.listeners = new Set();
    this.readFile = readFile;
    this.writeFile = writeFile;
    this.saveResetTimer = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  get(path) {
    return this.documents.get(path) || null;
  }

  getSnapshot() {
    return Array.from(this.documents.values());
  }

  addDocuments(documents) {
    for (const document of documents) {
      this.documents.set(document.path, document);
    }
    this.emit();
  }

  updateDocument(path, changes) {
    const current = this.documents.get(path);
    if (!current) {
      return;
    }
    this.documents.set(path, {
      ...current,
      ...(typeof changes === "function" ? changes(current) : changes),
    });
    this.emit();
  }

  remove(path) {
    if (this.documents.delete(path)) {
      this.emit();
    }
  }

  removeSet(paths) {
    let changed = false;
    for (const path of paths) {
      changed = this.documents.delete(path) || changed;
    }
    if (changed) {
      this.emit();
    }
  }

  async open(path, name) {
    if (this.documents.has(path)) {
      return;
    }

    this.addDocuments([
      createEmptyTab({ path, name, readStatus: "reading" }),
    ]);

    const result = await this.readFile(path);

    if (!result.ok) {
      this.updateDocument(path, {
        readStatus: "error",
        readError: result.status,
      });
      return;
    }

    this.updateDocument(path, {
      content: result.content,
      savedContent: result.content,
      readStatus: "ready",
      dirty: false,
      lastModified: result.lastModified,
    });
  }

  update(path, content) {
    this.updateDocument(path, (document) => ({
      content,
      dirty: content !== document.savedContent,
      saveStatus: "idle",
      saveError: "",
    }));
  }

  setContent(path, name, content, savedContent) {
    const dirty = content !== savedContent;

    if (this.documents.has(path)) {
      this.updateDocument(path, {
        content,
        dirty,
        saveStatus: "idle",
        saveError: "",
      });
      return;
    }

    this.addDocuments([
      createEmptyTab({
        path,
        name,
        content,
        savedContent,
        dirty,
        readStatus: "ready",
      }),
    ]);
  }

  async save(path, options = {}) {
    const document = this.documents.get(path);

    if (!document || document.readStatus !== "ready") {
      return { ok: false, status: "error" };
    }

    if (document.fileStatus === "missing") {
      return { ok: false, status: "missing" };
    }

    const { force = false } = options;

    if (!force && (document.dirty || document.fileStatus === "changed")) {
      const current = await this.readFile(path);

      if (!current.ok) {
        if (current.status === "missing") {
          this.updateDocument(path, { fileStatus: "missing" });
          return { ok: false, status: "missing" };
        }
        return { ok: false, status: current.status };
      }

      const changedOnDisk =
        (document.lastModified !== undefined &&
          current.lastModified !== undefined &&
          current.lastModified !== document.lastModified) ||
        current.content !== document.savedContent;

      if (changedOnDisk) {
        return {
          ok: false,
          status: "conflict",
          diskContent: current.content,
          diskLastModified: current.lastModified,
        };
      }
    }

    const contentToSave = document.content;
    this.updateDocument(path, { saveStatus: "saving", saveError: "" });

    const result = await this.writeFile(path, contentToSave);

    if (!result.ok) {
      this.updateDocument(path, {
        saveStatus: "error",
        saveError: result.status,
      });
      return { ok: false, status: result.status };
    }

    this.updateDocument(path, {
      savedContent: contentToSave,
      dirty: false,
      saveStatus: "saved",
      fileStatus: "ok",
      lastModified: result.lastModified ?? Date.now(),
    });
    this.scheduleSaveStatusReset(path);
    return { ok: true };
  }

  async reload(path) {
    const document = this.documents.get(path);

    if (!document) {
      return { ok: false, status: "missing" };
    }

    const result = await this.readFile(path);

    if (!result.ok) {
      this.updateDocument(path, {
        readStatus: "error",
        readError: result.status,
        fileStatus: result.status,
      });
      return result;
    }

    this.updateDocument(path, {
      content: result.content,
      savedContent: result.content,
      readStatus: "ready",
      dirty: false,
      fileStatus: "ok",
      contentToken: (document.contentToken || 0) + 1,
      lastModified: result.lastModified,
    });
    return result;
  }

  scheduleSaveStatusReset(path) {
    if (this.saveResetTimer) {
      window.clearTimeout(this.saveResetTimer);
    }
    this.saveResetTimer = window.setTimeout(() => {
      this.updateDocument(path, { saveStatus: "idle", saveError: "" });
    }, 3000);
  }

  async syncWithDisk() {
    const open = Array.from(this.documents.keys());
    const results = await Promise.all(
      open.map(async (path) => ({ path, result: await this.readFile(path) }))
    );

    for (const { path, result } of results) {
      if (!result.ok) {
        this.updateDocument(path, { fileStatus: result.status });
        continue;
      }

      this.updateDocument(path, (document) => {
        if (document.dirty) {
          return {
            fileStatus:
              result.content === document.savedContent ? "ok" : "changed",
          };
        }
        return {
          content: result.content,
          savedContent: result.content,
          fileStatus: "ok",
          contentToken: (document.contentToken || 0) + 1,
          lastModified: result.lastModified,
        };
      });
    }
  }

  remap(oldPath, newPath) {
    const next = new Map();

    for (const [path, document] of this.documents) {
      const remapped = remapPath(path, oldPath, newPath);
      next.set(remapped, {
        ...document,
        path: remapped,
        name: nameFromPath(remapped),
      });
    }

    this.documents = next;
    this.emit();
  }

  drop(path) {
    const removed = Array.from(this.documents.keys()).filter((candidate) =>
      isUnderPath(candidate, path)
    );

    if (removed.length === 0) {
      return;
    }

    for (const candidate of removed) {
      this.documents.delete(candidate);
    }
    this.emit();
  }

  reset() {
    this.documents.clear();
    if (this.saveResetTimer) {
      window.clearTimeout(this.saveResetTimer);
      this.saveResetTimer = null;
    }
    this.emit();
  }
}