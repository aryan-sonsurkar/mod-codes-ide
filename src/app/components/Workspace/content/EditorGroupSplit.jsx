import { memo, useCallback } from "react";
import EditorGroupComponent from "./EditorGroupComponent";

function EditorGroupSplit({
  groups,
  focusedGroupId,
  splitDirection,
  tabs,
  onActivate,
  onClose,
  onMenuAction,
  onChange,
  onSave,
  revealRequest,
  focusHandleRef,
  findHandleRef,
  selectionHandleRef,
  onNavigateDirectory,
  onFocus,
  onSplitRight,
  onSplitDown,
  onCloseGroup,
}) {
  if (groups.length === 0) {
    return null;
  }

  if (groups.length === 1) {
    return (
      <EditorGroupComponent
        group={groups[0]}
        tabs={tabs}
        isFocused={focusedGroupId === groups[0].id}
        onActivate={onActivate}
        onClose={onClose}
        onMenuAction={onMenuAction}
        onChange={onChange}
        onSave={onSave}
        revealRequest={revealRequest}
        focusHandleRef={focusHandleRef}
        findHandleRef={findHandleRef}
        selectionHandleRef={selectionHandleRef}
        onNavigateDirectory={onNavigateDirectory}
        onSplitRight={onSplitRight}
        onSplitDown={onSplitDown}
        onCloseGroup={onCloseGroup}
        onFocus={onFocus}
      />
    );
  }

  const isHorizontal = splitDirection === "horizontal";
  const containerClass = isHorizontal
    ? "editor-groups-container editor-groups-horizontal"
    : "editor-groups-container editor-groups-vertical";

  return (
    <div className={containerClass}>
      {groups.map((group, index) => (
        <div
          key={group.id}
          className="editor-group-wrapper"
          style={
            isHorizontal
              ? { width: `${100 / groups.length}%` }
              : { height: `${100 / groups.length}%` }
          }
        >
          {index > 0 && (
            <div
              className={`editor-group-divider ${
                isHorizontal ? "editor-group-divider-vertical" : "editor-group-divider-horizontal"
              }`}
              role="separator"
              aria-orientation={isHorizontal ? "vertical" : "horizontal"}
            />
          )}
          <EditorGroupComponent
            group={group}
            tabs={tabs}
            isFocused={focusedGroupId === group.id}
            onActivate={onActivate}
            onClose={onClose}
            onMenuAction={onMenuAction}
            onChange={onChange}
            onSave={onSave}
            revealRequest={revealRequest}
            focusHandleRef={
              focusedGroupId === group.id ? focusHandleRef : { current: null }
            }
            findHandleRef={
              focusedGroupId === group.id ? findHandleRef : { current: null }
            }
            selectionHandleRef={
              focusedGroupId === group.id
                ? selectionHandleRef
                : { current: null }
            }
            onNavigateDirectory={onNavigateDirectory}
            onSplitRight={onSplitRight}
            onSplitDown={onSplitDown}
            onCloseGroup={onCloseGroup}
            onFocus={onFocus}
          />
        </div>
      ))}
    </div>
  );
}

export default memo(EditorGroupSplit);
