"use client";

const OFFLINE_HINTS = [
  "Best for mechanical tasks: renames, boilerplate, docs, test scaffolds.",
  "Complex refactors and multi-file design need a stronger model — try Ollama when you are online.",
  "Runs entirely in this browser. No account. No quota. No server.",
];

const LOCAL_OLLAMA_HINTS = [
  "Runs on your machine. Nothing leaves your network.",
  "Complex refactors and multi-file design work here.",
];

export function describeAgentScope({ providerId, ready = false, online = true } = {}) {
  if (providerId === "browser-bonsai") {
    return {
      mode: "offline",
      chip: "Offline agent — mechanical tasks",
      headline: "Offline agent (Bonsai)",
      hints: OFFLINE_HINTS,
      honestLimit: ready
        ? "Bonsai is a small on-device model. It is honest about what it is good at: mechanical edits, not architecture."
        : "Download the Bonsai model first — it runs entirely in this browser, offline.",
    };
  }

  if (providerId === "ollama") {
    if (!online) {
      return {
        mode: "offline",
        chip: "Offline — Ollama unreachable",
        headline: "Ollama unreachable",
        hints: [
          "Your machine is offline or Ollama is not running.",
          "Switch to the Bonsai provider for offline work — it runs in this browser.",
        ],
        honestLimit: "Ollama needs a local server. Bonsai keeps working with no network at all.",
      };
    }
    return {
      mode: "connected",
      chip: "Local Ollama agent",
      headline: "Local Ollama agent",
      hints: LOCAL_OLLAMA_HINTS,
      honestLimit: ready
        ? null
        : "Start the Ollama server to use the agent.",
    };
  }

  return {
    mode: "unknown",
    chip: "Agent",
    headline: "Agent",
    hints: [],
    honestLimit: null,
  };
}
