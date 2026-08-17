export function createSimulatedTerminalProvider() {
  let disposed = false;

  function getDisposeMessage() {
    if (disposed) {
      return "The terminal has been disposed.";
    }
    return null;
  }

  return {
    async execute(command) {
      const disposedMessage = getDisposeMessage();
      if (disposedMessage) {
        return disposedMessage;
      }

      const trimmed = typeof command === "string" ? command.trim() : "";
      if (!trimmed) {
        return "";
      }

      const [name, ...args] = trimmed.split(/\s+/);

      switch (name.toLowerCase()) {
        case "help":
          return [
            "Available commands (browser simulation):",
            "  help            Show this help",
            "  clear           Clear the terminal screen",
            "  echo <text>     Print the given text",
            "  pwd             Print the simulated working directory",
            "",
            "This terminal is a browser-based simulation. It is NOT",
            "connected to your operating system or project filesystem.",
          ].join("\n");
        case "clear":
          return "";
        case "echo":
          return args.join(" ");
        case "pwd":
          return "/modcodes/browser-demo (simulated; not a real OS working directory)";
        default:
          return `Command not recognized: ${name}\nType 'help' for a list of available commands.`;
      }
    },
    clear() {
      // the simulated provider keeps no persistent state
    },
    dispose() {
      disposed = true;
    },
  };
}