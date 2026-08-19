import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileJson,
  FileText,
  FileType,
  FileCode2,
} from "lucide-react";

function iconFor(node, isExpanded) {
  if (node.kind === "directory") {
    return isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />;
  }

  const ext = (node.name.split(".").pop() || "").toLowerCase();

  if (ext === "json") {
    return <FileJson size={14} />;
  }
  if (["js", "jsx", "mjs", "cjs", "ts", "tsx", "py"].includes(ext)) {
    return <FileCode size={14} />;
  }
  if (["css", "scss", "less"].includes(ext)) {
    return <FileType size={14} />;
  }
  if (["html", "htm"].includes(ext)) {
    return <FileCode2 size={14} />;
  }
  if (["md", "markdown", "txt"].includes(ext)) {
    return <FileText size={14} />;
  }

  return <File size={14} />;
}

export default function FileTreeNode({
  node,
  expanded,
  onToggle,
  onFileSelect,
  selectedFilePath,
  onContextMenu,
  depth = 0,
  forceExpanded = false,
}) {
  const isDirectory = node.kind === "directory";
  const isExpanded = forceExpanded || expanded.has(node.path);
  const hasChildren = isDirectory && node.children.length > 0;
  const isSelected = !isDirectory && node.path === selectedFilePath;

  function handleActivate() {
    if (isDirectory) {
      onToggle(node.path);
    } else {
      onFileSelect?.(node);
    }
  }

  return (
    <div className="tree-node">
      <div
        className={`tree-row${
          isDirectory ? " tree-row-directory" : " tree-row-file"
        }${isSelected ? " tree-row-selected" : ""}`}
        data-path={node.path}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={handleActivate}
        onContextMenu={(event) => onContextMenu?.(event, node)}
        role="button"
        aria-expanded={isDirectory ? isExpanded : undefined}
        tabIndex={0}
      >
        <span className="tree-indicator">
          {isDirectory ? (isExpanded ? "▾" : "▸") : ""}
        </span>
        <span className="tree-icon">{iconFor(node, isExpanded)}</span>
        <span className="tree-name">{node.name}</span>
      </div>

      {isDirectory && isExpanded && hasChildren && (
        <div className="tree-children">
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
              onFileSelect={onFileSelect}
              selectedFilePath={selectedFilePath}
              onContextMenu={onContextMenu}
              depth={depth + 1}
              forceExpanded={forceExpanded}
            />
          ))}
        </div>
      )}

      {isDirectory && isExpanded && !hasChildren && (
        <div className="tree-empty" style={{ paddingLeft: 24 + depth * 16 }}>
          Empty
        </div>
      )}
    </div>
  );
}