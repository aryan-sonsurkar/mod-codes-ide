import { describe, it, expect, vi } from "vitest";
import { createResearchPipeline } from "./pipeline";
import { createEmptyModcodes } from "../project/modcodes";

describe("research pipeline M133", () => {
  it("dedupe and normalize helpers", () => {
    const p = createResearchPipeline();
    const { dedupeUrls, normalizeUrl } = p._helpers;
    expect(normalizeUrl("https://example.com/#hash")).toBe("https://example.com");
    expect(dedupeUrls(["https://example.com", "https://example.com/", "https://example.com/#a"])).toEqual(["https://example.com"]);
  });

  it("extractTextFromHtml strips tags", () => {
    const { extractTextFromHtml } = createResearchPipeline()._helpers;
    expect(extractTextFromHtml("<title>Hi</title><script>bad</script><p>Hello <b>world</b></p>")).toContain("Hello world");
    expect(extractTextFromHtml("<p>Hello</p>")).not.toContain("<p>");
  });

  it("runResearch with no URLs produces ai-generated source and is incremental", async () => {
    const pipeline = createResearchPipeline();
    const base = createEmptyModcodes({ name: "Test Idea" });
    const r1 = await pipeline.runResearch({ modcodesData: base, depth: "quick", query: "AI career guidance" });
    expect(r1.sources.length).toBe(1);
    expect(r1.sources[0].status).toBe("ai-generated");
    expect(r1.data.sections.Research).toContain("Session");
    const r2 = await pipeline.runResearch({ modcodesData: r1.data, depth: "quick", query: "follow up" });
    expect(r2.data.sections.Research).toContain("Session");
    // incremental: second run appends, not overwrites first session id
    expect(r2.data.sections.Research.split("Session").length).toBe(3); // header + 2 sessions
    expect(r2.data.sections["Research History"]).toContain("R");
  });

  it("researchDeeper continues from existing", async () => {
    const pipeline = createResearchPipeline();
    const base = createEmptyModcodes({ name: "X" });
    const r1 = await pipeline.runResearch({ modcodesData: base, depth: "quick" });
    const r2 = await pipeline.researchDeeper({ modcodesData: r1.data, query: "deeper" });
    expect(r2.depth).toBe("deep");
    expect(r2.data.sections.Research).toContain(r1.sessionId);
    expect(r2.data.sections.Research).toContain(r2.sessionId);
  });

  it("handles invalid URLs as inaccessible, deduped", async () => {
    const pipeline = createResearchPipeline();
    const base = createEmptyModcodes({ name: "Y" });
    // use invalid URL that will fail normalizeUrl => filtered, so we pass malformed that normalizes but fetch will fail
    const urls = ["https://invalid.invalid.test.404.example/abc", "https://invalid.invalid.test.404.example/abc"];
    const r = await pipeline.runResearch({ modcodesData: base, query: "test", urls });
    expect(r.sources.length).toBe(1);
    expect(r.sources[0].status).toBe("inaccessible");
    expect(r.findings).toContain("Inaccessible");
  });

  it("handles duplicate sources and empty results", async () => {
    const pipeline = createResearchPipeline();
    const base = createEmptyModcodes({ name: "Z" });
    const r = await pipeline.runResearch({ modcodesData: base, query: "empty", urls: [] });
    expect(r.sources.length).toBeGreaterThan(0);
    expect(r.findings.length).toBeGreaterThan(10);
  });

  it("fetch timeout and CORS handled via helper", async () => {
    const { fetchWithTimeout } = createResearchPipeline()._helpers;
    // invalid URL should return ok:false quickly
    const res = await fetchWithTimeout("https://invalid.invalid.test.404.example/", { timeoutMs: 1000 });
    expect(res.ok).toBe(false);
  });
});
