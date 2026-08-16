"use client";
import "./TabBar.css";

export default function TabBar({ tabs, activePath, onActivate, onClose }) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.path === activePath;

        return (
          <div
            key={tab.path}
            className={`tab${isActive ? " tab-active" : ""}${
              tab.dirty ? " tab-dirty" : ""
            }`}
            role="tab"
            aria-selected={isActive}
            onClick={() => onActivate(tab.path)}
          >
            <span className="tab-name">{tab.name}</span>
            {tab.dirty && (
              <span className="tab-dirty-dot" title="Unsaved changes">
                ●
              </span>
            )}
            <button
              className="tab-close"
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.path);
              }}
              aria-label={`Close ${tab.name}`}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}