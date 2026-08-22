"use client";
import { useCallback, useEffect, useRef } from "react";
import "./MonacoEditor.css";
import { loadMonaco } from "../../../lib/monaco/monaco";
import { useSettings } from "../../../contexts/SettingsContext";

function modelUriForPath(monaco, path) {
  return monaco.Uri.parse("modcodes://model/" + encodeURIComponent(path));
}

export default function MonacoEditor({
  file,
  content,
  language,
  readStatus,
  openPaths,
  onChange,
  revealRequest,
  focusHandleRef,
  findHandleRef,
  selectionHandleRef,
}) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const modelsRef = useRef(new Map());
  const currentPathRef = useRef(null);
  const viewStatesRef = useRef(new Map());
  const pendingRevealRef = useRef(null);

  const { settings } = useSettings();

  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  });

  const fileRef = useRef(file);
  const contentRef = useRef(content);
  const readStatusRef = useRef(readStatus);
  const languageRef = useRef(language);
  const onChangeRef = useRef(onChange);
  const contentTokenRef = useRef(0);
  const revealRef = useRef(null);

  useEffect(() => {
    fileRef.current = file;
    contentRef.current = content;
    readStatusRef.current = readStatus;
    languageRef.current = language;
    onChangeRef.current = onChange;
    contentTokenRef.current = file?.contentToken || 0;
    revealRef.current = revealRequest;
  });

  const openPathsKey = Array.isArray(openPaths) ? openPaths.join("\n") : "";

  function applyReveal() {
    const editor = editorRef.current;
    const pending = pendingRevealRef.current;

    if (!editor || !pending) {
      return;
    }

    if (currentPathRef.current !== pending.path) {
      return;
    }

    editor.revealLineInCenter(pending.line);
    editor.setPosition({ lineNumber: pending.line, column: 1 });
    editor.focus();
    pendingRevealRef.current = null;
  }

  const syncActiveModel = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !monacoRef.current) {
      return;
    }

    const path = fileRef.current?.path || null;
    const ready = Boolean(path) && readStatusRef.current === "ready";

    if (!ready) {
      if (editorRef.current && currentPathRef.current) {
        try {
          viewStatesRef.current.set(currentPathRef.current, editor.saveViewState());
        } catch {}
      }
      editor.setModel(null);
      currentPathRef.current = null;
      return;
    }

    if (currentPathRef.current && currentPathRef.current !== path && editor) {
      try {
        viewStatesRef.current.set(currentPathRef.current, editor.saveViewState());
      } catch {}
    }

    let model = modelsRef.current.get(path);

    if (!model) {
      model = monacoRef.current.editor.createModel(
        contentRef.current,
        languageRef.current,
        modelUriForPath(monacoRef.current, path)
      );
      modelsRef.current.set(path, model);
    } else if (model.getLanguageId() !== languageRef.current) {
      monacoRef.current.editor.setModelLanguage(model, languageRef.current);
    }

    editor.setModel(model);
    const saved = viewStatesRef.current.get(path);
    if (saved) {
      try {
        editor.restoreViewState(saved);
      } catch {}
    }
    editor.focus();
    currentPathRef.current = path;
    applyReveal();
  }, []);

  useEffect(() => {
    const models = modelsRef.current;
    let disposed = false;
    let editor = null;

    loadMonaco().then((monaco) => {
      if (disposed) {
        return;
      }

      monacoRef.current = monaco;

      if (!editor && containerRef.current) {
        const editorSettings = settingsRef.current.editor;
        editor = monaco.editor.create(containerRef.current, {
          value: "",
          language: "plaintext",
          theme: "vs-dark",
          automaticLayout: true,
          minimap: { enabled: editorSettings.minimap },
          fontSize: editorSettings.fontSize,
          fontFamily: editorSettings.fontFamily,
          tabSize: editorSettings.tabSize,
          insertSpaces: editorSettings.insertSpaces,
          wordWrap: editorSettings.wordWrap ? "on" : "off",
          lineNumbers: editorSettings.lineNumbers ? "on" : "off",
          cursorBlinking: editorSettings.cursorBlinking,
          smoothScrolling: editorSettings.smoothScrolling,
          scrollBeyondLastLine: false,
        });
        editorRef.current = editor;

        editor.onDidChangeModelContent(() => {
          const path = currentPathRef.current;
          if (!path) {
            return;
          }
          onChangeRef.current(path, editor.getValue());
        });
      }

      syncActiveModel();
    });

    return () => {
      disposed = true;
      if (editor) {
        editor.dispose();
        editorRef.current = null;
      }
      for (const [, model] of models) {
        model.dispose();
      }
      models.clear();
      currentPathRef.current = null;
      monacoRef.current = null;
    };
  }, [syncActiveModel]);

  useEffect(() => {
    syncActiveModel();
  }, [file?.path, readStatus, syncActiveModel]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    editor.updateOptions({
      minimap: { enabled: settings.editor.minimap },
      fontSize: settings.editor.fontSize,
      fontFamily: settings.editor.fontFamily,
      tabSize: settings.editor.tabSize,
      insertSpaces: settings.editor.insertSpaces,
      wordWrap: settings.editor.wordWrap ? "on" : "off",
      lineNumbers: settings.editor.lineNumbers ? "on" : "off",
      cursorBlinking: settings.editor.cursorBlinking,
      smoothScrolling: settings.editor.smoothScrolling,
    });
    // also update model options for tabSize/insertSpaces live
    const model = editor.getModel();
    if (model && typeof model.updateOptions === "function") {
      model.updateOptions({
        tabSize: settings.editor.tabSize,
        insertSpaces: settings.editor.insertSpaces,
      });
    }
  }, [
    settings.editor.fontSize,
    settings.editor.fontFamily,
    settings.editor.tabSize,
    settings.editor.insertSpaces,
    settings.editor.wordWrap,
    settings.editor.minimap,
    settings.editor.lineNumbers,
    settings.editor.cursorBlinking,
    settings.editor.smoothScrolling,
  ]);

  useEffect(() => {
    const token = fileRef.current?.contentToken || 0;
    const path = fileRef.current?.path;

    if (!token || !path) {
      return;
    }

    const model = modelsRef.current.get(path);
    const editor = editorRef.current;

    if (model && editor && editor.getModel() === model) {
      model.setValue(contentRef.current);
    }
  }, [file?.contentToken]);

  useEffect(() => {
    const request = revealRef.current;
    if (!request) {
      return;
    }

    pendingRevealRef.current = {
      path: request.path,
      line: request.line,
    };
    applyReveal();
  }, [revealRequest?.token]);

  useEffect(() => {
    if (!focusHandleRef) {
      return;
    }

    focusHandleRef.current = {
      focus: () => editorRef.current?.focus(),
    };

    return () => {
      focusHandleRef.current = null;
    };
  }, [focusHandleRef]);

  useEffect(() => {
    if (!findHandleRef) {
      return;
    }

    findHandleRef.current = {
      find: () =>
        editorRef.current?.trigger("modcodes", "actions.find", null),
    };

    return () => {
      findHandleRef.current = null;
    };
  }, [findHandleRef]);

  useEffect(() => {
    if (!selectionHandleRef) {
      return;
    }

    selectionHandleRef.current = {
      getSelection: () => {
        const editor = editorRef.current;
        if (!editor) {
          return null;
        }
        const selection = editor.getSelection();
        if (!selection) {
          return null;
        }
        const model = editor.getModel();
        if (!model) {
          return null;
        }
        const text = model.getValueInRange(selection);
        if (!text) {
          return null;
        }
        return {
          text,
          startLine: selection.startLineNumber,
          endLine: selection.endLineNumber,
        };
      },
    };

    return () => {
      selectionHandleRef.current = null;
    };
  }, [selectionHandleRef]);

  useEffect(() => {
    const openSet = new Set(openPathsKey === "" ? [] : openPathsKey.split("\n"));

    for (const [path, model] of modelsRef.current) {
      if (!openSet.has(path) && currentPathRef.current !== path) {
        model.dispose();
        modelsRef.current.delete(path);
      }
    }
  }, [openPathsKey]);

  return <div className="monaco-editor-host" ref={containerRef} />;
}