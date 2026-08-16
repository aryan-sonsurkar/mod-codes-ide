"use client";
import { useState } from "react";
import "./FileExplorer.css";
import FileTreeNode from "./FileTreeNode";

export default function FileExplorer({ root, onFileSelect, selectedFilePath }) {
  const [expanded, setExpanded] = useState(() => new Set(root ? [root.path] : []));

  function toggleDirectory(path) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  return (
    <aside className="file-explorer">
      <header className="explorer-header">EXPLORER</header>
      <div className="explorer-tree">
        {root ? (
          <FileTreeNode
            node={root}
            expanded={expanded}
            onToggle={toggleDirectory}
            onFileSelect={onFileSelect}
            selectedFilePath={selectedFilePath}
          />
        ) : (
          <p className="explorer-empty">No files.</p>
        )}
      </div>
    </aside>
  );
}