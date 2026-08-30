import { describe, it, expect } from "vitest";
import { reconcileProjectMemory, applyReconcileAccept } from "./reconcile";
import { createEmptyModcodes } from "./modcodes";

describe("reconcile", () => {
  it("proposes stale when old", () => {
    const data = createEmptyModcodes({ name: "x" });
    data.project.updatedAt = new Date(Date.now() - 8*24*3600*1000).toISOString();
    const { proposals } = reconcileProjectMemory({ modcodesData: data, codebaseSnapshot: { fileCount: 10 } });
    expect(proposals.some(p=>p.id==="stale-memory")).toBe(true);
  });
  it("applies accept", () => {
    const data = createEmptyModcodes({ name: "y" });
    const prop = { proposedChange: { section: "Progress", append: "\n- done" } };
    const next = applyReconcileAccept({ modcodesData: data, proposal: prop });
    expect(next.sections.Progress).toContain("done");
  });
});
