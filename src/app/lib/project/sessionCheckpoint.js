"use client";
import { setSection, getSection } from "./modcodes";

const MAX_CHECKPOINTS = 50;
const PROMPT_LIMIT = 160;
const SUMMARY_LIMIT = 400;

const CHECKPOINT_KINDS = ["chat", "agent"];

function clip(text, limit) {
  const value = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return "—";
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function joinList(values) {
  const list = (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return list.length > 0 ? list.join(", ") : null;
}

export function formatCheckpointEntry({ checkpoint, now = null }) {
  if (!checkpoint || typeof checkpoint !== "object") {
    throw new TypeError("checkpoint required");
  }
  const kind = CHECKPOINT_KINDS.includes(checkpoint.kind) ? checkpoint.kind : "chat";
  const at = now || new Date().toISOString();
  const lines = [`### ${at} — ${kind === "agent" ? "Agent task" : "Chat turn"}`];
  lines.push(`- **Asked:** ${clip(checkpoint.prompt, PROMPT_LIMIT)}`);
  lines.push(`- **Result:** ${clip(checkpoint.summary, SUMMARY_LIMIT)}`);
  const provider = String(checkpoint.provider || "").trim();
  const model = String(checkpoint.model || "").trim();
  const modelLabel = [provider, model].filter(Boolean).join("/");
  if (modelLabel) lines.push(`- **Model:** ${modelLabel}`);
  const tools = joinList(checkpoint.tools);
  if (tools) lines.push(`- **Tools:** ${tools}`);
  const files = joinList(checkpoint.files);
  if (files) lines.push(`- **Files:** ${files}`);
  lines.push(`- **Status:** ${clip(checkpoint.status, 60)}`);
  return lines.join("\n");
}

function trimToCap(text) {
  const parts = String(text)
    .split(/^### /m)
    .filter(Boolean);
  if (parts.length <= MAX_CHECKPOINTS) return text;
  return `### ${parts.slice(-MAX_CHECKPOINTS).join("### ")}`;
}

export function appendSessionCheckpoint({ modcodesData, checkpoint }) {
  if (!modcodesData || typeof modcodesData !== "object") {
    throw new Error("modcodesData required");
  }
  const entry = formatCheckpointEntry({ checkpoint });
  const current = String(getSection(modcodesData, "Agent History") || "");
  const nextText = trimToCap(current ? `${current.trim()}\n\n${entry}` : entry);
  return setSection(modcodesData, "Agent History", nextText);
}

export function listCheckpoints(modcodesData) {
  const text = String(getSection(modcodesData, "Agent History") || "");
  return text
    .split(/^### /m)
    .filter(Boolean)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
