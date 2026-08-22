"use client";
import { memo, useEffect, useRef, useState } from "react";
import "./TabBar.css";

function TabBarInner({
  tabs,
  activePath,
  onActivate,
  onClose,
  onMenuAction,
}) {
  const tabRefs = useRef({});
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    const active = tabRefs.current[activePath];
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activePath, tabs.length]);

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

  function openMenu(event, path) {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ path, x: event.clientX, y: event.clientY });
  }

  function handleMenuAction(action) {
    const target = menu?.path;
    setMenu(null);

    if (!target) {
      return;
    }

    if (action === "close") {
      onClose(target);
    } else if (action === "others") {
      onMenuAction("others", target);
    } else if (action === "right") {
      onMenuAction("right", target);
    } else if (action === "clean") {
      onMenuAction("clean");
    } else if (action === "all") {
      onMenuAction("all");
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
            onContextMenu={(event) => openMenu(event, tab.path)}
            onMouseDown={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                onClose(tab.path);
              }
            }}
          >
            <span className="tab-name">{tab.name}</span>
            {tab.dirty && (
              <span className="tab-dirty-dot" aria-label="Unsaved changes">
                ●
              </span>
            )}
            {tab.fileStatus && tab.fileStatus !== "ok" && (
              <span className="tab-status-warning" aria-label="File status warning">
                ⚠
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

      {menu && (
        <>
          <div
            className="tab-menu-backdrop"
            onClick={() => setMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu(null);
            }}
          />
          <div
            className="tab-menu"
            role="menu"
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              className="tab-menu-item"
              role="menuitem"
              onClick={() => handleMenuAction("close")}
            >
              Close
            </button>
            <button
              className="tab-menu-item"
              role="menuitem"
              onClick={() => handleMenuAction("others")}
            >
              Close Others
            </button>
            <button
              className="tab-menu-item"
              role="menuitem"
              onClick={() => handleMenuAction("right")}
            >
              Close to the Right
            </button>
            <button
              className="tab-menu-item"
              role="menuitem"
              onClick={() => handleMenuAction("clean")}
            >
              Close All Clean Tabs
            </button>
            <button
              className="tab-menu-item"
              role="menuitem"
              onClick={() => handleMenuAction("all")}
            >
              Close All
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default memo(TabBarInner);