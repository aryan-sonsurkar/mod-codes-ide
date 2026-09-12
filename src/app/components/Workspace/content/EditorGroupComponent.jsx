import { memo, useCallback, useMemo } from "react";
import TabBar from "./TabBar";
import EditorPane from "./EditorPane";
import { getLanguageFromPath } from "../../../lib/monaco/monaco";

function EditorGroupComponent({
  group,
  tabs,
  isFocused,
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
  onSplitRight,
  onSplitDown,
  onCloseGroup,
  onFocus,
}) {
  const activeTab = useMemo(
    () => tabs.find((t) => t.path === group.activePath) || null,
    [tabs, group.activePath]
  );

  const groupTabs = useMemo(
    () =>
      group.paths
        .map((path) => tabs.find((t) => t.path === path))
        .filter(Boolean),
    [group.paths, tabs]
  );

  const handleTabActivate = useCallback(
    (path) => onActivate(path, group.id),
    [group.id, onActivate]
  );

  const handleTabClose = useCallback(
    (path) => onClose(path, group.id),
    [group.id, onClose]
  );

  const handleTabMenu = useCallback(
    (action, path) => onMenuAction(action, path, group.id),
    [group.id, onMenuAction]
  );

  const handleClick = useCallback(() => {
    onFocus(group.id);
  }, [group.id, onFocus]);

  return (
    <div
      className={`editor-group${isFocused ? " editor-group-focused" : ""}`}
      onClick={handleClick}
      role="group"
      aria-label={`Editor group ${group.id}`}
    >
      <TabBar
        tabs={groupTabs}
        activePath={group.activePath}
        onActivate={handleTabActivate}
        onClose={handleTabClose}
        onMenuAction={handleTabMenu}
      />
      <EditorPane
        tab={activeTab}
        openPaths={group.paths}
        onChange={onChange}
        onSave={onSave}
        revealRequest={revealRequest}
        focusHandleRef={focusHandleRef}
        findHandleRef={findHandleRef}
        selectionHandleRef={selectionHandleRef}
        onNavigateDirectory={onNavigateDirectory}
      />
    </div>
  );
}

export default memo(EditorGroupComponent);
