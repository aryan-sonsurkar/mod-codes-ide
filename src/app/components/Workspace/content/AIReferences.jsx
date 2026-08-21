"use client";
import { FileText } from "lucide-react";
import { parseReferencesFromText } from "../../../lib/ai/references";

export default function AIReferences({ text, onNavigate }) {
  const references = parseReferencesFromText(text || "");
  if (references.length === 0) {
    return null;
  }
  const unique = [];
  const seen = new Set();
  for (const ref of references) {
    const key = `${ref.path}:${ref.line ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(ref);
    if (unique.length >= 6) {
      break;
    }
  }

  return (
    <div className="ai-references" role="list">
      {unique.map((ref) => (
        <button
          key={`${ref.path}:${ref.line ?? 0}:${ref.column ?? 0}`}
          type="button"
          className="ai-reference"
          role="listitem"
          onClick={() => onNavigate && onNavigate(ref)}
          title={`Open ${ref.path}${ref.line ? `:${ref.line}` : ""}`}
        >
          <FileText size={12} />
          {ref.label}
        </button>
      ))}
    </div>
  );
}
