"use client";
import { useState } from "react";
import { useSettings } from "../../contexts/SettingsContext";
import { createOllamaProvider } from "../../lib/ai";
import { checkBridgeHealth, getBridgeToken, setBridgeToken } from "../../lib/terminal/backends/systemTerminalBackend";
import "./SettingsPage.css";

const CATEGORIES = [
  { id: "editor", label: "Editor" },
  { id: "files", label: "Files" },
  { id: "terminal", label: "Terminal" },
  { id: "ai", label: "AI & Coder" },
  { id: "advanced", label: "Advanced" },
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

function SelectRow({ label, description, value, options, onChange }) {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <span className="settings-row-label">{label}</span>
        {description && (
          <span className="settings-row-description">{description}</span>
        )}
      </div>
      <select
        className="settings-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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

function ActionRow({ label, description, buttonLabel, onAction }) {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <span className="settings-row-label">{label}</span>
        {description && <span className="settings-row-description">{description}</span>}
      </div>
      <button type="button" className="settings-connection-button" onClick={onAction}>
        {buttonLabel}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSetting } = useSettings();
  const [activeCategory, setActiveCategory] = useState("editor");
  const [cacheStatus, setCacheStatus] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [bridgeToken, setBridgeTokenState] = useState(() => getBridgeToken() || "");
  const [bridgeStatus, setBridgeStatus] = useState({ kind: "idle" });

  const handleClearCache = async () => {
    try {
      if (typeof caches !== "undefined" && caches.delete) {
        await caches.delete("modcodes-ai-v1");
      }
      if (typeof localStorage !== "undefined") {
        const keys = Object.keys(localStorage).filter((k) => k.startsWith("modcodes.ai"));
        for (const key of keys) {
          localStorage.removeItem(key);
        }
      }
      setCacheStatus("Cache cleared");
      window.setTimeout(() => setCacheStatus(""), 2000);
    } catch {
      setCacheStatus("Could not clear cache");
    }
  };

  const handleClearHistory = () => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("modcodes.ai.conversations.v1");
      }
      setHistoryStatus("History cleared");
      window.setTimeout(() => setHistoryStatus(""), 2000);
    } catch {
      setHistoryStatus("Could not clear history");
    }
  };

  const handleTestBridge = async () => {
    setBridgeStatus({ kind: "checking" });
    const result = await checkBridgeHealth();
    if (result.ok) {
      setBridgeStatus({ kind: "ok", message: "Bridge connected on 127.0.0.1:8787" });
    } else {
      setBridgeStatus({ kind: "error", message: result.reason || "Bridge unreachable" });
    }
  };

  const handleResetSettings = () => {
    if (typeof window !== "undefined" && window.confirm("Reset all settings to defaults? This cannot be undone.")) {
      try {
        localStorage.removeItem("modcodes-settings");
        localStorage.removeItem("modcodes.onboarding.completed");
      } catch {}
      window.location.reload();
    }
  };

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
              <StringRow
                label="Font family"
                description="Monospace stack, e.g. Consolas. Applies immediately to Monaco."
                value={settings.editor.fontFamily}
                onChange={(value) => updateSetting("editor", "fontFamily", value)}
              />
              <NumberRow
                label="Tab size"
                description="Number of spaces used per tab."
                value={settings.editor.tabSize}
                min={1}
                max={8}
                onChange={(value) => updateSetting("editor", "tabSize", value)}
              />
              <ToggleRow
                label="Insert spaces"
                description="Use spaces instead of tabs when pressing Tab."
                checked={settings.editor.insertSpaces}
                onChange={(value) => updateSetting("editor", "insertSpaces", value)}
              />
              <SelectRow
                label="Cursor blinking"
                description="How the cursor blinks."
                value={settings.editor.cursorBlinking}
                options={[
                  { value: "blink", label: "Blink" },
                  { value: "smooth", label: "Smooth" },
                  { value: "phase", label: "Phase" },
                  { value: "expand", label: "Expand" },
                  { value: "solid", label: "Solid" },
                ]}
                onChange={(value) => updateSetting("editor", "cursorBlinking", value)}
              />
              <ToggleRow
                label="Smooth scrolling"
                description="Animate scrolling."
                checked={settings.editor.smoothScrolling}
                onChange={(value) => updateSetting("editor", "smoothScrolling", value)}
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
              Control how the terminal looks and connect the optional local system bridge.
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
              <StringRow
                label="Terminal font family"
                description="Used for the terminal panel; live."
                value={settings.terminal.fontFamily}
                onChange={(value) => updateSetting("terminal", "fontFamily", value)}
              />
              <div className="settings-row">
                <div className="settings-row-info">
                  <span className="settings-row-label">Local bridge token</span>
                  <span className="settings-row-description">
                    Paste the token from `node tools/modcodes-bridge/server.js` (localhost only). Stored as modcodes.bridge.token.
                  </span>
                </div>
                <input
                  className="settings-text-input"
                  type="password"
                  spellCheck="false"
                  value={bridgeToken}
                  onChange={(event) => {
                    const next = event.target.value;
                    setBridgeTokenState(next);
                    setBridgeToken(next);
                  }}
                  placeholder="Paste 64-char hex token"
                />
              </div>
              <div className="settings-row">
                <div className="settings-row-info">
                  <span className="settings-row-label">Test bridge</span>
                  <span className="settings-row-description">Checks http://127.0.0.1:8787/health with the stored token.</span>
                </div>
                <div className="settings-connection-control">
                  {bridgeStatus.kind === "ok" && <span className="settings-connection-ok">{bridgeStatus.message}</span>}
                  {bridgeStatus.kind === "error" && <span className="settings-connection-error">{bridgeStatus.message}</span>}
                  <button type="button" className="settings-connection-button" onClick={handleTestBridge} disabled={bridgeStatus.kind === "checking"}>
                    {bridgeStatus.kind === "checking" ? "Testing…" : "Test"}
                  </button>
                </div>
              </div>
              <div className="settings-ai-note">
                The system terminal is USER-ONLY. AI cannot execute shell commands. Bridge binds only to 127.0.0.1 and requires explicit pairing.
              </div>
            </div>
          </>
        )}

        {activeCategory === "ai" && (
          <>
            <h3 className="settings-category-title">AI & Coder</h3>
            <p className="settings-category-description">
              Configure the local AI provider. ModCodes runs the model locally —
              either through Ollama on this machine or fully in the browser on
              your GPU. No cloud proxy is used.
            </p>
            <div className="settings-group">
              <SelectRow
                label="Provider"
                description="Ollama uses a local server; Bonsai runs entirely in this browser tab."
                value={settings.ai.provider}
                options={[
                  { value: "ollama", label: "Ollama (local server)" },
                  { value: "browser-bonsai", label: "Bonsai (in this browser)" },
                ]}
                onChange={(value) => updateSetting("ai", "provider", value)}
              />
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
              <div className="settings-ai-note">
                <strong>Privacy:</strong> conversations are stored locally in this browser only. No telemetry is sent anywhere.
                Secrets (.env, keys, tokens) are never transmitted. Disable persistence by clearing history.
              </div>
              <ActionRow
                label="Clear AI cache"
                description="Removes cached Bonsai weights from this browser."
                buttonLabel="Clear cache"
                onAction={handleClearCache}
              />
              {cacheStatus && <p className="settings-inline-status">{cacheStatus}</p>}
              <ActionRow
                label="Clear conversation history"
                description="Deletes locally stored conversations."
                buttonLabel="Clear history"
                onAction={handleClearHistory}
              />
              {historyStatus && <p className="settings-inline-status">{historyStatus}</p>}
              <div className="settings-ai-note">
                The system terminal is USER-ONLY. AI cannot execute shell commands. Bridge binds only to 127.0.0.1 and requires explicit pairing.
              </div>
            </div>
          </>
        )}

        {activeCategory === "advanced" && (
          <>
            <h3 className="settings-category-title">Advanced</h3>
            <p className="settings-category-description">Danger zone and privacy controls.</p>
            <div className="settings-group">
              <ActionRow label="Reset settings" description="Restore all settings to defaults and clear onboarding. The page will reload." buttonLabel="Reset" onAction={handleResetSettings} />
              <div className="settings-ai-note">All data stays local. No cloud sync. See docs/SECURITY_PRIVACY_AUDIT.md for full audit.</div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}