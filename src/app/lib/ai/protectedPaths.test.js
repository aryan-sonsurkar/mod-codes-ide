import { describe, it, expect } from "vitest";
import {
  classifyProtectedPath,
  isProtectedPath,
  describeProtectedPath,
  basenameOf,
} from "./protectedPaths";

describe("protectedPaths", () => {
  it("classifies env files", () => {
    expect(classifyProtectedPath(".env")).toBe("env");
    expect(classifyProtectedPath("app/.env.local")).toBe("env");
    expect(classifyProtectedPath("config/.env.production")).toBe("env");
    expect(classifyProtectedPath(".env.example")).toBe("env");
  });

  it("classifies package manifests and lockfiles", () => {
    expect(classifyProtectedPath("package.json")).toBe("manifest");
    expect(classifyProtectedPath("src/package.json")).toBe("manifest");
    expect(classifyProtectedPath("package-lock.json")).toBe("manifest");
    expect(classifyProtectedPath("pnpm-lock.yaml")).toBe("manifest");
    expect(classifyProtectedPath("requirements.txt")).toBe("manifest");
  });

  it("classifies database files and migrations", () => {
    expect(classifyProtectedPath("data/app.sqlite")).toBe("database");
    expect(classifyProtectedPath("cache.db")).toBe("database");
    expect(classifyProtectedPath("db/migrations/0001_init.sql")).toBe("migration");
    expect(classifyProtectedPath("prisma/migrations/x.sql")).toBe("migration");
  });

  it("classifies project memory and git internals", () => {
    expect(classifyProtectedPath("my-app/.modcodes")).toBe("memory");
    expect(classifyProtectedPath(".git/config")).toBe("git");
  });

  it("leaves ordinary source files alone", () => {
    expect(isProtectedPath("src/app/main.js")).toBe(false);
    expect(isProtectedPath("README.md")).toBe(false);
    expect(isProtectedPath("src/styles.css")).toBe(false);
    expect(isProtectedPath("public/env.png")).toBe(false);
    expect(classifyProtectedPath(null)).toBeNull();
    expect(classifyProtectedPath("")).toBeNull();
  });

  it("describes why a path is protected", () => {
    const reason = describeProtectedPath(".env");
    expect(typeof reason).toBe("string");
    expect(reason).toMatch(/secrets/i);
    expect(describeProtectedPath("src/index.js")).toBeNull();
  });

  it("extracts basenames across separators", () => {
    expect(basenameOf("src/app/main.js")).toBe("main.js");
    expect(basenameOf("a\\b\\c.txt")).toBe("c.txt");
    expect(basenameOf("")).toBe("");
  });
});
