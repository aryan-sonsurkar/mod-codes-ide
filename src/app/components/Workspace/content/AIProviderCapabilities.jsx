"use client";
import { Check, Minus } from "lucide-react";
import { CAPABILITIES, describeCapability, hasCapability } from "../../../lib/ai/capabilities";

const DISPLAY_ORDER = [
  CAPABILITIES.chat,
  CAPABILITIES.streaming,
  CAPABILITIES.cancellation,
  CAPABILITIES.tools,
  CAPABILITIES.local,
  CAPABILITIES.browser,
  CAPABILITIES.statistics,
  CAPABILITIES.vision,
  CAPABILITIES.largeContext,
  CAPABILITIES.fileEditing,
  CAPABILITIES.structuredOutput,
];

export default function AIProviderCapabilities({ provider, model }) {
  const target = model || provider;
  if (!target) {
    return null;
  }
  return (
    <div className="ai-capabilities" role="list">
      {DISPLAY_ORDER.map((capability) => {
        const supported = hasCapability(target, capability);
        return (
          <span key={capability} className={`ai-capability ${supported ? "ai-capability-yes" : "ai-capability-no"}`} role="listitem">
            {supported ? <Check size={10} /> : <Minus size={10} />}
            {describeCapability(capability)}
          </span>
        );
      })}
    </div>
  );
}
