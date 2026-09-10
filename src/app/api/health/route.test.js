import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json(data, init) {
      return {
        status: init?.status || 200,
        body: data,
        json: async () => data,
      };
    },
  },
}));

describe("health endpoint", () => {
  it("returns status ok", async () => {
    const { GET } = await import("./route.js");
    const res = await GET();
    expect(res.body.status).toBe("ok");
  });

  it("returns version from package.json", async () => {
    const pkg = require("../../../../package.json");
    const { GET } = await import("./route.js");
    const res = await GET();
    expect(res.body.version).toBe(pkg.version);
  });

  it("returns environment", async () => {
    const { GET } = await import("./route.js");
    const res = await GET();
    expect(["development", "production", "test"]).toContain(res.body.environment);
  });

  it("returns timestamp as ISO string", async () => {
    const { GET } = await import("./route.js");
    const res = await GET();
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns uptime as non-negative integer", async () => {
    const { GET } = await import("./route.js");
    const res = await GET();
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("returns services object", async () => {
    const { GET } = await import("./route.js");
    const res = await GET();
    expect(res.body.services).toBeDefined();
    expect(["configured", "unconfigured"]).toContain(res.body.services.ads);
  });

  it("version matches package.json exactly", async () => {
    const pkg = require("../../../../package.json");
    const { GET } = await import("./route.js");
    const res = await GET();
    expect(res.body.version).toBe(pkg.version);
    expect(typeof res.body.version).toBe("string");
    expect(res.body.version.length).toBeGreaterThan(0);
  });
});
