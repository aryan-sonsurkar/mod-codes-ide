"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import "./GoToFileDialog.css";

const MAX_ITEMS = 200;

function flattenTree(node, out = []) {
  if (!node) {
    return out;
  }

  if (node.kind === "file") {
    out.push(node);
  } else {
    for (const child of node.children || []) {
      flattenTree(child, out);
    }
  }

  return out;
}

export default function GoToFileDialog({ tree, onOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const files = useMemo(() => flattenTree(tree), [tree]);
  const trimmed = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!trimmed) {
      return files.slice(0, MAX_ITEMS);
    }
    return files
      .filter((file) => file.path.toLowerCase().includes(trimmed))
      .slice(0, MAX_ITEMS);
  }, [files, trimmed]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const item = listRef.current?.querySelector(
      ".gotofile-item-selected"
    );
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const safeIndex = Math.min(selectedIndex, Math.max(filtered.length - 1, 0));

  function openSelected() {
    const file = filtered[safeIndex];
    if (file) {
      onOpen(file);
      onClose();
    }
  }

  return (
    <div className="gotofile-overlay" onClick={onClose}>
      <div
        className="gotofile-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="gotofile-input"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              openSelected();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setSelectedIndex((current) =>
                Math.min(current + 1, Math.max(filtered.length - 1, 0))
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setSelectedIndex((current) => Math.max(current - 1, 0));
            }
          }}
          placeholder="Go to file..."
        />
        <div className="gotofile-list" ref={listRef}>
          {filtered.length === 0 && (
            <p className="gotofile-empty">No files found.</p>
          )}
          {filtered.map((file, index) => (
            <button
              key={file.path}
              className={`gotofile-item${
                index === safeIndex ? " gotofile-item-selected" : ""
              }`}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={openSelected}
            >
              <span className="gotofile-name">{file.name}</span>
              <span className="gotofile-path">{file.path}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}