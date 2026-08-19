import { describe, expect, it } from "vitest";
import { createBrowserSimulationBackend } from "./backends/browserSimulationBackend";
import { createTerminalService } from "./TerminalService";

describe("createTerminalService", () => {
  it("delegates execute and exposes the backend name", async () => {
    const backend = createBrowserSimulationBackend({ rootPath: "proj" });
    const service = createTerminalService({ backend });

    expect(service.name).toBe("Browser simulation");

    const result = await service.execute("echo hi");
    expect(result).toEqual({ stdout: "hi", stderr: "", exitCode: 0 });
  });

  it("guards against execution after disposal", async () => {
    const service = createTerminalService({
      backend: createBrowserSimulationBackend({}),
    });

    service.dispose();

    const result = await service.execute("echo hi");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("disposed");
  });

  it("resets the backend cwd", async () => {
    const backend = createBrowserSimulationBackend({ rootPath: "proj" });
    const service = createTerminalService({ backend });

    service.reset();

    const result = await service.execute("pwd");
    expect(result.stdout).toBe("/proj");
  });
});