"use client";
import { useState } from "react";
import { useSettings } from "../../contexts/SettingsContext";
import { createOllamaProvider } from "../../lib/ai";
import "./SettingsPage.css";

const CATEGORIES = [
  { id: "editor", label: "Editor" },
  { id: "files", label: "Files" },
  { id: "terminal", label: "Terminal" },
  { id: "ai", label: "AI & Coder" },
];

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <span className="settings-row-label">{label}</span>
        {description && (
          <span className="settings-row-description">{description}</span>
        )}
      </div>
      <button
        className={`settings-toggle${checked ? " settings-toggle-on" : ""}`}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span className="settings-toggle-thumb" />
      </button>
    </div>
  );
}

function NumberRow({ label, description, value, min, max, onChange, suffix }) {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <span className="settings-row-label">{label}</span>
        {description && (
          <span className="settings-row-description">{description}</span>
        )}
      </div>
      <div className="settings-number-control">
        <input
          className="settings-number-input"
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) {
              onChange(next);
            }
          }}
        />
        {suffix && <span className="settings-number-suffix">{suffix}</span>}
      </div>
    </div>
  );
}

function StringRow({ label, description, value, onChange }) {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <span className="settings-row-label">{label}</span>
        {description && (
          <span className="settings-row-description">{description}</span>
        )}
      </div>
      <input
        className="settings-text-input"
        type="text"
        spellCheck="false"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ConnectionRow({ value }) {
  const [state, setState] = useState({ kind: "idle" });

  const handleTest = async () => {
    setState({ kind: "checking" });
    let provider;
    try {
      provider = createOllamaProvider({ baseUrl: value });
    } catch {
      setState({ kind: "error", message: "Invalid URL. Use http://…" });
      return;
    }
    const result = await provider.testConnection();
    if (result.ok) {
      setState({
        kind: "ok",
        message: result.version ? `Connected · v${result.version}` : "Connected",
      });
    } else {
      setState({
        kind: "error",
        message:
          result.error && typeof result.error.message === "string"
            ? result.error.message
            : "Ollama is not reachable.",
      });
    }
  };

  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <span className="settings-row-label">Test connection</span>
        <span className="settings-row-description">
          Checks that Ollama is reachable at the configured URL.
        </span>
      </div>
      <div className="settings-connection-control">
        {state.kind === "ok" && (
          <span className="settings-connection-ok">{state.message}</span>
        )}
        {state.kind === "error" && (
          <span className="settings-connection-error">{state.message}</span>
        )}
        <button
          type="button"
          className="settings-connection-button"
          onClick={handleTest}
          disabled={state.kind === "checking"}
        >
          {state.kind === "checking" ? "Testing…" : "Test"}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSetting } = useSettings();
  const [activeCategory, setActiveCategory] = useState("editor");

  return (
    <section className="settings-page">
      <div className="settings-sidebar">
        <h2 className="settings-title">Settings</h2>
        <nav className="settings-nav">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              className={`settings-nav-item${
                activeCategory === category.id
                  ? " settings-nav-item-active"
                  : ""
              }`}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="settings-content">
        {activeCategory === "editor" && (
          <>
            <h3 className="settings-category-title">Editor</h3>
            <p className="settings-category-description">
              Control how code is displayed in the editor.
            </p>
            <div className="settings-group">
              <NumberRow
                label="Font size"
                description="Size of the code text."
                value={settings.editor.fontSize}
                min={10}
                max={24}
                suffix="px"
                onChange={(value) =>
                  updateSetting("editor", "fontSize", value)
                }
              />
              <NumberRow
                label="Tab size"
                description="Number of spaces used per tab."
                value={settings.editor.tabSize}
                min={2}
                max={8}
                onChange={(value) => updateSetting("editor", "tabSize", value)}
              />
              <ToggleRow
                label="Word wrap"
                description="Wrap long lines to fit the editor width."
                checked={settings.editor.wordWrap}
                onChange={(value) =>
                  updateSetting("editor", "wordWrap", value)
                }
              />
              <ToggleRow
                label="Minimap"
                description="Show a preview of the file on the side."
                checked={settings.editor.minimap}
                onChange={(value) => updateSetting("editor", "minimap", value)}
              />
              <ToggleRow
                label="Line numbers"
                description="Show line numbers in the editor."
                checked={settings.editor.lineNumbers}
                onChange={(value) =>
                  updateSetting("editor", "lineNumbers", value)
                }
              />
            </div>
          </>
        )}

        {activeCategory === "files" && (
          <>
            <h3 className="settings-category-title">Files</h3>
            <p className="settings-category-description">
              Control how files and projects behave.
            </p>
            <div className="settings-group">
              <ToggleRow
                label="Confirm before deleting files"
                description="Ask for confirmation before removing files and folders."
                checked={settings.files.confirmBeforeDelete}
                onChange={(value) =>
                  updateSetting("files", "confirmBeforeDelete", value)
                }
              />
              <ToggleRow
                label="Confirm before deleting projects"
                description="Ask for confirmation before removing projects."
                checked={settings.projects.confirmBeforeDelete}
                onChange={(value) =>
                  updateSetting("projects", "confirmBeforeDelete", value)
                }
              />
            </div>
          </>
        )}

        {activeCategory === "terminal" && (
          <>
            <h3 className="settings-category-title">Terminal</h3>
            <p className="settings-category-description">
              Control how the terminal looks.
            </p>
            <div className="settings-group">
              <NumberRow
                label="Terminal font size"
                description="Size of the text in the terminal."
                value={settings.terminal.fontSize}
                min={10}
                max={24}
                suffix="px"
                onChange={(value) =>
                  updateSetting("terminal", "fontSize", value)
                }
              />
            </div>
          </>
        )}

        {activeCategory === "ai" && (
          <>
            <h3 className="settings-category-title">AI & Coder</h3>
            <p className="settings-category-description">
              Configure the local AI provider. ModCodes talks to Ollama running
              on this machine — no cloud proxy is used.
            </p>
            <div className="settings-group">
              <StringRow
                label="Ollama base URL"
                description="Where Ollama listens. Leave at the default for local setup."
                value={settings.ai.baseUrl}
                onChange={(value) => updateSetting("ai", "baseUrl", value)}
              />
              <NumberRow
                label="Context budget"
                description="Maximum characters of editor context sent per message."
                value={settings.ai.contextBudget}
                min={2000}
                max={200000}
                suffix="chars"
                onChange={(value) =>
                  updateSetting("ai", "contextBudget", value)
                }
              />
              <NumberRow
                label="Max tool rounds"
                description="How many read-only tool requests the model may make per message."
                value={settings.ai.maxToolRounds}
                min={0}
                max={4}
                onChange={(value) =>
                  updateSetting("ai", "maxToolRounds", value)
                }
              />
              <ConnectionRow value={settings.ai.baseUrl} />
              <div className="settings-ai-note">
                Only read-only tools (current file, diagnostics, open files) are
                available to the model. The AI never receives the whole project,
                secrets, or environment variables, and cannot run commands or
                modify files.
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}