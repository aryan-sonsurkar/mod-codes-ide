"use client";
import { useCallback, useEffect, useState } from "react";

const DEFAULT_LAYOUT = {
  leftOpen: true,
  leftTab: "explorer",
  terminalOpen: false,
  rightOpen: false,
  rightTab: "problems",
  leftWidth: 280,
  rightWidth: 300,
  terminalHeight: 220,
};

const LAYOUT_STORAGE_KEY = "modcodes.ide.layout.v1";

function loadLayoutState() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LAYOUT_STORAGE_KEY) : null;
    if (!raw) {
      return DEFAULT_LAYOUT;
    }
    return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function useWorkspaceLayout() {
  const [layout, setLayout] = useState(loadLayoutState);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // best-effort
    }
  }, [layout]);

  const toggleLeftPanel = useCallback((tab) => {
    setLayout((current) => {
      if (current.leftOpen && current.leftTab === tab) {
        return { ...current, leftOpen: false };
      }
      return { ...current, leftOpen: true, leftTab: tab };
    });
  }, []);

  const startResize = useCallback(({ horizontal, getSize, setSize }) => {
    return (event) => {
      event.preventDefault();
      const startPosition = horizontal ? event.clientY : event.clientX;
      const startSize = getSize();
      let rafId = null;
      let pendingDelta = 0;
      const flush = () => {
        rafId = null;
        setSize(startSize + pendingDelta);
      };
      const onMove = (moveEvent) => {
        pendingDelta = horizontal ? moveEvent.clientY - startPosition : moveEvent.clientX - startPosition;
        if (rafId == null) {
          rafId = window.requestAnimationFrame(flush);
        }
      };
      const onUp = () => {
        if (rafId != null) {
          window.cancelAnimationFrame(rafId);
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = horizontal ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };
  }, []);

  return { layout, setLayout, toggleLeftPanel, startResize, clamp, DEFAULT_LAYOUT, LAYOUT_STORAGE_KEY };
}
