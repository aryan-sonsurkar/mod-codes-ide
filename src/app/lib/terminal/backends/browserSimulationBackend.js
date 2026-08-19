const BUILTIN_HELP = [
  "Available commands (browser simulation):",
  "  help            Show this help",
  "  clear           Clear the terminal screen",
  "  echo <text>     Print the given text",
  "  pwd             Print the simulated working directory",
  "  ls [path]       List the opened project directory (real filesystem)",
  "",
  "The terminal executes only these built-ins. It is NOT connected to",
  "your operating system shell and will never run arbitrary programs.",
].join("\n");

function success(stdout = "") {
  return { stdout, stderr: "", exitCode: 0 };
}

function failure(stderr, exitCode = 1) {
  return { stdout: "", stderr, exitCode };
}

export function createBrowserSimulationBackend({ readDirectory, rootPath, getRootPath }) {
  function currentCwd() {
    const rp =
      typeof getRootPath === "function"
        ? getRootPath()
        : rootPath || null;
    return rp ? `/${rp}` : "/";
  }

  function normalizePath(input) {
    const parts = [];
    for (const part of input.split("/")) {
      if (!part || part === ".") {
        continue;
      }
      if (part === "..") {
        if (parts.length > 0) {
          parts.pop();
        }
        continue;
      }
      parts.push(part);
    }
    return parts.length === 0 ? "/" : `/${parts.join("/")}`;
  }

  function resolvePath(target) {
    if (typeof target !== "string" || target.length === 0 || target === ".") {
      return currentCwd();
    }
    if (target.startsWith("/")) {
      return normalizePath(target);
    }
    return normalizePath(`${currentCwd()}/${target}`);
  }

  async function listDirectory(rawTarget) {
    if (!readDirectory) {
      return failure("No project directory is open. Open one to use 'ls'.");
    }

    const target = resolvePath(rawTarget);
    const result = await readDirectory(target);
    if (!result.ok) {
      return failure(
        `ls: cannot access '${rawTarget}': ${result.reason || "no such directory"}`
      );
    }

    if (result.entries.length === 0) {
      return success(`(empty directory: ${target})`);
    }

    const rows = result.entries.map((entry) =>
      entry.kind === "directory"
        ? `  ${entry.name}/`
        : `  ${entry.name}`
    );
    return success(`Directory contents of ${target}:` + "\n" + rows.join("\n"));
  }

  return {
    label: "Browser simulation",
    reset() {
      // the simulated backend keeps no persistent cwd state
    },
    async execute(command) {
      const trimmed = typeof command === "string" ? command.trim() : "";
      if (!trimmed) {
        return success("");
      }

      const [name, ...args] = trimmed.split(/\s+/);
      const key = name.toLowerCase();

      switch (key) {
        case "help":
          return success(BUILTIN_HELP);
        case "clear":
          return success("");
        case "echo":
          return success(args.join(" "));
        case "pwd":
          return success(currentCwd());
        case "ls":
          return listDirectory(args[0]);
        case "cd":
          return failure("cd is not available in the browser simulation.");
        default:
          return failure(`Command not recognized: ${name}\nType 'help' for a list of available commands.`);
      }
    },
  };
}