import { describe, expect, it } from "vitest";
import nextConfig from "../../../../next.config.mjs";

describe("security headers", () => {
  it("next.config exports headers function", () => {
    expect(typeof nextConfig.headers).toBe("function");
  });

  it("includes X-Frame-Options DENY", async () => {
    const headers = await nextConfig.headers();
    const globalRule = headers.find((h) => h.source === "/(.*)");
    const xFrame = globalRule.headers.find((h) => h.key === "X-Frame-Options");
    expect(xFrame.value).toBe("DENY");
  });

  it("includes X-Content-Type-Options nosniff", async () => {
    const headers = await nextConfig.headers();
    const globalRule = headers.find((h) => h.source === "/(.*)");
    const header = globalRule.headers.find((h) => h.key === "X-Content-Type-Options");
    expect(header.value).toBe("nosniff");
  });

  it("includes Referrer-Policy", async () => {
    const headers = await nextConfig.headers();
    const globalRule = headers.find((h) => h.source === "/(.*)");
    const header = globalRule.headers.find((h) => h.key === "Referrer-Policy");
    expect(header.value).toBe("strict-origin-when-cross-origin");
  });

  it("includes Permissions-Policy", async () => {
    const headers = await nextConfig.headers();
    const globalRule = headers.find((h) => h.source === "/(.*)");
    const header = globalRule.headers.find((h) => h.key === "Permissions-Policy");
    expect(header.value).toContain("camera=()");
    expect(header.value).toContain("microphone=()");
    expect(header.value).toContain("geolocation=()");
  });

  it("API routes have Cache-Control no-store", async () => {
    const headers = await nextConfig.headers();
    const apiRule = headers.find((h) => h.source === "/api/(.*)");
    const cacheHeader = apiRule.headers.find((h) => h.key === "Cache-Control");
    expect(cacheHeader.value).toBe("no-store");
  });
});
