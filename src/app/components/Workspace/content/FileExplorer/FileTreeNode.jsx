export default function FileTreeNode({
  node,
  expanded,
  onToggle,
  onFileSelect,
  selectedFilePath,
  onContextMenu,
  depth = 0,
}) {
  const isDirectory = node.kind === "directory";
  const isExpanded = expanded.has(node.path);
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
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={handleActivate}
        onContextMenu={(event) => onContextMenu?.(event, node)}
        role="button"
        aria-expanded={isDirectory ? isExpanded : undefined}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleActivate();
          }
        }}
      >
        <span className="tree-indicator">
          {isDirectory ? (isExpanded ? "▾" : "▸") : ""}
        </span>
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