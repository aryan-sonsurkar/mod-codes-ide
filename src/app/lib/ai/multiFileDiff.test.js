import { describe, expect, it, vi } from "vitest";
import { createMultiFileDiffSession } from "./diffEngine";

describe("multi-file diff", () => {
  it("adds and reviews file-by-file", () => {
    const session = createMultiFileDiffSession();
    session.add({ path: "src/a.js", original: "a", proposed: "b" });
    session.add({ path: "src/b.js", original: "x", proposed: "y" });
    expect(session.list()).toHaveLength(2);
    const dm = { setContent: vi.fn() };
    session.accept(dm, "src/a.js");
    expect(session.get("src/a.js").status).toBe("accepted");
    expect(session.summary().accepted).toBe(1);
  });

  it("acceptAll and rejectAll", () => {
    const session = createMultiFileDiffSession();
    session.add({ path: "src/a.js", original: "a", proposed: "b" });
    session.add({ path: "src/b.js", original: "a", proposed: "b" });
    const dm = { setContent: vi.fn() };
    session.acceptAll(dm);
    expect(session.summary().accepted).toBe(2);
    session.cancel();
    expect(session.list()).toHaveLength(0);
  });

  it("never writes directly to filesystem — only via DocumentManager", () => {
    const session = createMultiFileDiffSession();
    session.add({ path: "src/a.js", original: "old", proposed: "new" });
    const dm = { setContent: vi.fn() };
    session.accept(dm, "src/a.js");
    expect(dm.setContent).toHaveBeenCalled();
    expect(session.get("src/a.js").applied).toBe(true);
  });
});
