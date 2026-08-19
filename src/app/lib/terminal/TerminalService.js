export function createTerminalService({ backend }) {
  let disposed = false;

  return {
    get name() {
      return backend.label || "Terminal";
    },
    reset() {
      if (!disposed && typeof backend.reset === "function") {
        backend.reset();
      }
    },
    async execute(command) {
      if (disposed) {
        return { stdout: "", stderr: "The terminal has been disposed.", exitCode: 1 };
      }
      return backend.execute(command);
    },
    dispose() {
      disposed = true;
    },
  };
}