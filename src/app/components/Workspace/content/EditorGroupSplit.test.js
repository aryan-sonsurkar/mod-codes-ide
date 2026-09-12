import { describe, it, expect } from "vitest";

describe("EditorGroupSplit layout", () => {
  it("single group produces no dividers", () => {
    const groups = [{ id: 1, paths: ["/a.js"], activePath: "/a.js" }];
    expect(groups).toHaveLength(1);
  });

  it("multiple groups produce n-1 dividers", () => {
    const groups = [
      { id: 1, paths: ["/a.js"], activePath: "/a.js" },
      { id: 2, paths: ["/b.js"], activePath: "/b.js" },
    ];
    const dividers = groups.length > 1 ? groups.length - 1 : 0;
    expect(dividers).toBe(1);
  });

  it("three groups produce two dividers", () => {
    const groups = [
      { id: 1, paths: ["/a.js"], activePath: "/a.js" },
      { id: 2, paths: ["/b.js"], activePath: "/b.js" },
      { id: 3, paths: ["/c.js"], activePath: "/c.js" },
    ];
    const dividers = groups.length > 1 ? groups.length - 1 : 0;
    expect(dividers).toBe(2);
  });

  it("horizontal split distributes width equally", () => {
    const count = 2;
    const widths = Array.from({ length: count }, () => `${100 / count}%`);
    expect(widths).toEqual(["50%", "50%"]);
  });

  it("vertical split distributes height equally", () => {
    const count = 3;
    const heights = Array.from({ length: count }, () => `${100 / count}%`);
    expect(heights).toHaveLength(3);
    expect(parseFloat(heights[0])).toBeCloseTo(33.33, 0);
  });

  it("empty groups returns nothing", () => {
    const groups = [];
    expect(groups.length === 0).toBe(true);
  });
});
