"use client";
import { useState } from "react";
import { useSettings } from "../../contexts/SettingsContext";
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
              AI capabilities are planned for MODCODES.
            </p>
            <div className="settings-group">
              <div className="settings-placeholder">
                This section is reserved for future AI and coding-assistant
                features. Configuration options will appear here once they
                become available.
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}