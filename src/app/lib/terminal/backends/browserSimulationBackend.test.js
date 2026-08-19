import { describe, expect, it } from "vitest";
import { createBrowserSimulationBackend } from "./browserSimulationBackend";

function makeReadDirectory(entriesByPath) {
  return async (target) => {
    if (!(target in entriesByPath)) {
      return { ok: false, reason: "no such directory" };
    }
    return { ok: true, entries: entriesByPath[target] };
  };
}

const FIXTURE = {
  "/proj": [
    { name: "src", kind: "directory" },
    { name: "package.json", kind: "file" },
  ],
  "/proj/src": [
    { name: "a.js", kind: "file" },
    { name: "components", kind: "directory" },
  ],
};

describe("browserSimulationBackend", () => {
  const backend = createBrowserSimulationBackend({
    readDirectory: makeReadDirectory(FIXTURE),
    rootPath: "proj",
  });

  it("reports success for built-ins", async () => {
    const help = await backend.execute("help");
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("ls [path]");

    const echo = await backend.execute("echo hello");
    expect(echo).toEqual({ stdout: "hello", stderr: "", exitCode: 0 });

    const pwd = await backend.execute("pwd");
    expect(pwd.stdout).toBe("/proj");
  });

  it("lists directories, resolving relative and absolute paths", async () => {
    const root = await backend.execute("ls");
    expect(root.stdout).toContain("src/");

    const rel = await backend.execute("ls src");
    expect(rel.exitCode).toBe(0);
    expect(rel.stdout).toContain("a.js");

    const abs = await backend.execute("ls /proj/src");
    expect(abs.exitCode).toBe(0);
    expect(abs.stdout).toContain("components/");
  });

  it("fails honestly for missing directories and unknown commands", async () => {
    const missing = await backend.execute("ls nope");
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toContain("no such directory");

    const unknown = await backend.execute("rm -rf /");
    expect(unknown.exitCode).toBe(1);
    expect(unknown.stderr).toContain("Command not recognized");

    const cd = await backend.execute("cd /tmp");
    expect(cd.exitCode).toBe(1);
  });

  it("reports no readDirectory provider", async () => {
    const bare = createBrowserSimulationBackend({});
    const result = await bare.execute("ls");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("project directory");
  });
});