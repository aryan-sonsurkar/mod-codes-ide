import { describe, expect, it } from "vitest";
import { RecentTabs } from "./recentTabs";

describe("RecentTabs", () => {
  it("records most-recent-first and dedupes", () => {
    const recent = new RecentTabs();
    recent.record("a");
    recent.record("b");
    recent.record("a");

    expect(recent.list).toEqual(["a", "b"]);
  });

  it("forgets a path", () => {
    const recent = new RecentTabs();
    recent.record("a");
    recent.record("b");
    recent.forget("a");

    expect(recent.list).toEqual(["b"]);
  });

  it("returns the next open path", () => {
    const recent = new RecentTabs();
    recent.record("a");
    recent.record("b");
    recent.record("c");

    expect(recent.next("c", new Set(["a", "b", "c"]))).toBe("b");
    expect(recent.next("b", new Set(["b"]))).toBeNull();
  });
});