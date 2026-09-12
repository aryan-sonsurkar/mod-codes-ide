import { useCallback, useMemo, useRef, useState } from "react";

let nextGroupId = 1;

function createGroup(initialPath) {
  return {
    id: nextGroupId++,
    paths: initialPath ? [initialPath] : [],
    activePath: initialPath || null,
  };
}

export function useEditorGroups({ tabs, openFile }) {
  const [groups, setGroups] = useState(() => [createGroup(null)]);
  const [focusedGroupId, setFocusedGroupId] = useState(() => groups[0].id);
  const [splitDirection, setSplitDirection] = useState("horizontal");

  const focusedGroup = useMemo(
    () => groups.find((g) => g.id === focusedGroupId) || groups[0],
    [groups, focusedGroupId]
  );

  const openInGroup = useCallback(
    (path, name, groupId) => {
      openFile({ path, name });

      const targetId = groupId || focusedGroupId;

      setGroups((current) =>
        current.map((group) => {
          if (group.id !== targetId) return group;
          if (group.paths.includes(path)) {
            return { ...group, activePath: path };
          }
          return { ...group, paths: [...group.paths, path], activePath: path };
        })
      );

      setFocusedGroupId(targetId);
    },
    [focusedGroupId, openFile]
  );

  const closeInGroup = useCallback(
    (path, groupId) => {
      const targetId = groupId || focusedGroupId;

      setGroups((current) => {
        const next = current.map((group) => {
          if (group.id !== targetId) return group;
          const idx = group.paths.indexOf(path);
          if (idx === -1) return group;
          const nextPaths = group.paths.filter((p) => p !== path);
          let nextActive = group.activePath;
          if (nextActive === path) {
            if (nextPaths.length > 0) {
              const nextIdx = Math.min(idx, nextPaths.length - 1);
              nextActive = nextPaths[nextIdx];
            } else {
              nextActive = null;
            }
          }
          return { ...group, paths: nextPaths, activePath: nextActive };
        });
        return next.filter((g) => g.paths.length > 0 || g === current[0]);
      });
    },
    [focusedGroupId]
  );

  const activateInGroup = useCallback(
    (path, groupId) => {
      const targetId = groupId || focusedGroupId;
      setGroups((current) =>
        current.map((group) =>
          group.id === targetId ? { ...group, activePath: path } : group
        )
      );
      setFocusedGroupId(targetId);
    },
    [focusedGroupId]
  );

  const splitRight = useCallback(() => {
    const source = focusedGroup;
    if (!source || !source.activePath) return;

    const newGroup = createGroup(source.activePath);
    setGroups((current) => [...current, newGroup]);
    setFocusedGroupId(newGroup.id);
    setSplitDirection("horizontal");
  }, [focusedGroup]);

  const splitDown = useCallback(() => {
    const source = focusedGroup;
    if (!source || !source.activePath) return;

    const newGroup = createGroup(source.activePath);
    setGroups((current) => [...current, newGroup]);
    setFocusedGroupId(newGroup.id);
    setSplitDirection("vertical");
  }, [focusedGroup]);

  const closeGroup = useCallback(
    (groupId) => {
      setGroups((current) => {
        const next = current.filter((g) => g.id !== groupId);
        return next.length > 0 ? next : [createGroup(null)];
      });
      setFocusedGroupId((current) => {
        if (current === groupId) {
          setGroups((prev) => {
            if (prev.length > 0) setFocusedGroupId(prev[0].id);
            return prev;
          });
          return current;
        }
        return current;
      });
    },
    []
  );

  const focusGroup = useCallback((groupId) => {
    setFocusedGroupId(groupId);
  }, []);

  const moveTab = useCallback(
    (path, fromGroupId, toGroupId) => {
      setGroups((current) =>
        current.map((group) => {
          if (group.id === fromGroupId) {
            const nextPaths = group.paths.filter((p) => p !== path);
            return {
              ...group,
              paths: nextPaths,
              activePath:
                group.activePath === path
                  ? nextPaths[0] || null
                  : group.activePath,
            };
          }
          if (group.id === toGroupId) {
            if (group.paths.includes(path)) {
              return { ...group, activePath: path };
            }
            return {
              ...group,
              paths: [...group.paths, path],
              activePath: path,
            };
          }
          return group;
        })
      );
    },
    []
  );

  const remapPath = useCallback((oldPath, newPath) => {
    setGroups((current) =>
      current.map((group) => {
        const paths = group.paths.map((p) => (p === oldPath ? newPath : p));
        const activePath =
          group.activePath === oldPath ? newPath : group.activePath;
        return { ...group, paths, activePath };
      })
    );
  }, []);

  const dropPath = useCallback((path) => {
    setGroups((current) =>
      current.map((group) => {
        if (!group.paths.includes(path)) return group;
        const paths = group.paths.filter((p) => p !== path);
        const activePath =
          group.activePath === path ? paths[0] || null : group.activePath;
        return { ...group, paths, activePath };
      })
    );
  }, []);

  const getGroupLayout = useCallback(() => {
    return {
      groups: groups.map((g) => ({
        id: g.id,
        paths: g.paths,
        activePath: g.activePath,
      })),
      focusedGroupId,
      splitDirection,
    };
  }, [groups, focusedGroupId, splitDirection]);

  const focusNextGroup = useCallback(() => {
    const idx = groups.findIndex((g) => g.id === focusedGroupId);
    const nextIdx = (idx + 1) % groups.length;
    setFocusedGroupId(groups[nextIdx].id);
  }, [groups, focusedGroupId]);

  const focusPreviousGroup = useCallback(() => {
    const idx = groups.findIndex((g) => g.id === focusedGroupId);
    const prevIdx = (idx - 1 + groups.length) % groups.length;
    setFocusedGroupId(groups[prevIdx].id);
  }, [groups, focusedGroupId]);

  return {
    groups,
    focusedGroupId,
    focusedGroup,
    splitDirection,
    openInGroup,
    closeInGroup,
    activateInGroup,
    splitRight,
    splitDown,
    closeGroup,
    focusGroup,
    moveTab,
    remapPath,
    dropPath,
    getGroupLayout,
    focusNextGroup,
    focusPreviousGroup,
  };
}
