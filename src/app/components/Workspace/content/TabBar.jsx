"use client";
import { useRef } from "react";
import "./TabBar.css";

export default function TabBar({ tabs, activePath, onActivate, onClose }) {
  const tabRefs = useRef({});

  if (tabs.length === 0) {
    return null;
  }

  function focusTab(index) {
    const tab = tabs[index];
    if (tab) {
      tabRefs.current[tab.path]?.focus();
    }
  }

  function activateRelative(direction) {
    if (tabs.length === 0) {
      return;
    }
    let index = tabs.findIndex((tab) => tab.path === activePath);
    if (index === -1) {
      index = direction === 1 ? -1 : tabs.length;
    }
    const nextIndex = (index + direction + tabs.length) % tabs.length;
    onActivate(tabs[nextIndex].path);
    focusTab(nextIndex);
  }

  function handleTabKeyDown(event, index) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      activateRelative(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      activateRelative(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      onActivate(tabs[0].path);
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      const lastIndex = tabs.length - 1;
      onActivate(tabs[lastIndex].path);
      focusTab(lastIndex);
    }
  }

  return (
    <div className="tab-bar" role="tablist" aria-label="Open editors">
      {tabs.map((tab, index) => {
        const isActive = tab.path === activePath;

        return (
          <div
            key={tab.path}
            ref={(element) => {
              tabRefs.current[tab.path] = element;
            }}
            className={`tab${isActive ? " tab-active" : ""}${
              tab.dirty ? " tab-dirty" : ""
            }`}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onActivate(tab.path)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
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