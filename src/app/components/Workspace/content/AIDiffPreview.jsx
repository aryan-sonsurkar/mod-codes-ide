"use client";
import { Check, Copy, X } from "lucide-react";
import { computeChangedRanges } from "../../../lib/ai/diffEngine";

function extractCodeBlocks(text) {
  const pattern = /```(\w*)\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    blocks.push({ lang: match[1] || "text", code: match[2] });
  }
  return blocks;
}

export function hasCodeBlock(text) {
  return /```/.test(text);
}

export default function AIDiffPreview({ message, original, onAccept, onReject, onCopy }) {
  const blocks = extractCodeBlocks(message.content || "");
  if (blocks.length === 0) {
    return null;
  }
  const proposed = blocks[0].code;
  const ranges = computeChangedRanges(original || "", proposed);

  return (
    <div className="ai-diff-preview" role="region" aria-label="Suggested change">
      <div className="ai-diff-header">
        <strong>Suggested change</strong>
        <span className="ai-diff-meta">
          {ranges.length} range{ranges.length === 1 ? "" : "s"} · {proposed.length.toLocaleString()} chars
        </span>
      </div>
      <div className="ai-diff-columns">
        <div className="ai-diff-column">
          <div className="ai-diff-column-title">Original</div>
          <pre className="ai-diff-code">{(original || "").slice(0, 4000) || "—"}</pre>
        </div>
        <div className="ai-diff-column">
          <div className="ai-diff-column-title">Suggested</div>
          <pre className="ai-diff-code ai-diff-code-proposed">{proposed.slice(0, 4000)}</pre>
        </div>
      </div>
      <div className="ai-diff-actions">
        <button type="button" className="ai-diff-accept" onClick={() => onAccept && onAccept(proposed)}>
          <Check size={12} />
          Accept
        </button>
        <button type="button" className="ai-diff-reject" onClick={() => onReject && onReject()}>
          <X size={12} />
          Reject
        </button>
        <button type="button" className="ai-diff-copy" onClick={() => onCopy && onCopy(proposed)}>
          <Copy size={12} />
          Copy
        </button>
      </div>
    </div>
  );
}

export { extractCodeBlocks };
