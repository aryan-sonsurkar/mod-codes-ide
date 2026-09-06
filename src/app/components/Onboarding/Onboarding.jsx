"use client";
import { useState } from "react";
import "./Onboarding.css";

const STORAGE_KEY = "modcodes.onboarding.completed";
let memoryCompleted = false;

export function isOnboardingCompleted() {
  if (memoryCompleted) {
    return true;
  }
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return memoryCompleted;
  }
}

export function completeOnboarding() {
  memoryCompleted = true;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  } catch {
    // best-effort
  }
}

export function clearOnboardingForTests() {
  memoryCompleted = false;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

export default function Onboarding({ onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [aiChoice, setAiChoice] = useState(null);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  const handleNext = () => {
    if (step === 2) {
      if (dontShowAgain) {
        completeOnboarding();
      }
      onComplete && onComplete({ aiChoice, dontShowAgain });
      return;
    }
    setStep((s) => s + 1);
  };

  const handleSkip = () => {
    if (dontShowAgain) {
      completeOnboarding();
    }
    onSkip && onSkip();
    onComplete && onComplete({ aiChoice: "skip", dontShowAgain });
  };

  const stepLabels = ["Welcome", "AI Setup", "Ready"];

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Welcome to MODCODES">
      <div className="onboarding-card">
        <div className="onboarding-step-label" aria-hidden="true">
          Step {step + 1} of 3: {stepLabels[step]}
        </div>

        {step === 0 && (
          <>
            <h2>Welcome to MODCODES</h2>
            <p>
              A browser-based development environment. Your files stay on your machine &mdash;
              no server, no cloud upload, no account required.
            </p>
            <ul className="onboarding-list">
              <li><strong>Open a folder</strong> &mdash; your files never leave your device.</li>
              <li><strong>Browser permission</strong> &mdash; your browser asks to read the folder; you can revoke it anytime.</li>
              <li><strong>Works best</strong> in Chrome or Edge. WebGPU enables Browser AI.</li>
            </ul>
            <p className="onboarding-privacy">No account, no telemetry. Local-first.</p>
          </>
        )}
        {step === 1 && (
          <>
            <h2>Choose your AI</h2>
            <p>
              MODCODES works fully as a code editor without AI. Pick an option
              to enable AI-assisted development:
            </p>
            <div className="onboarding-choices" role="radiogroup" aria-label="AI provider selection">
              <button
                type="button"
                className={`onboarding-choice ${aiChoice === "ollama" ? "onboarding-choice-active" : ""}`}
                onClick={() => setAiChoice("ollama")}
                role="radio"
                aria-checked={aiChoice === "ollama"}
              >
                <strong>Ollama (Local Server)</strong>
                <span>Runs on your machine at 127.0.0.1:11434. Requires Ollama installed and running.</span>
              </button>
              <button
                type="button"
                className={`onboarding-choice ${aiChoice === "bonsai" ? "onboarding-choice-active" : ""}`}
                onClick={() => setAiChoice("bonsai")}
                role="radio"
                aria-checked={aiChoice === "bonsai"}
              >
                <strong>Bonsai (Browser AI)</strong>
                <span>Runs on your GPU via WebGPU. No server needed. Requires a WebGPU-compatible browser.</span>
              </button>
              <button
                type="button"
                className={`onboarding-choice ${aiChoice === "skip" ? "onboarding-choice-active" : ""}`}
                onClick={() => setAiChoice("skip")}
                role="radio"
                aria-checked={aiChoice === "skip"}
              >
                <strong>Skip for now</strong>
                <span>Use MODCODES as a code editor. You can enable AI later in Settings.</span>
              </button>
            </div>
            <p className="onboarding-privacy">You can change this anytime in Settings &rarr; AI &amp; Coder.</p>
          </>
        )}
        {step === 2 && (
          <>
            <h2>You&apos;re ready to code</h2>
            <p>Here&apos;s what you can do:</p>
            <ul className="onboarding-list">
              <li><strong>Create a project</strong> &mdash; give it a name and point to a folder on your machine.</li>
              <li><strong>Open existing code</strong> &mdash; browse to any folder with code.</li>
              <li><strong>Terminal</strong> &mdash; browser simulation by default; optional local bridge for system shell.</li>
              <li><strong>All AI is local</strong> &mdash; Ollama or Browser AI. No cloud proxy.</li>
            </ul>
            <label className="onboarding-dont-show">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              Don&apos;t show again
            </label>
          </>
        )}
        <div className="onboarding-actions">
          <button type="button" className="onboarding-skip" onClick={handleSkip} aria-label="Skip onboarding">
            Skip
          </button>
          <button
            type="button"
            className="onboarding-next"
            onClick={handleNext}
            disabled={step === 1 && !aiChoice}
            aria-label={step === 2 ? "Get started" : "Next step"}
          >
            {step === 2 ? "Get started" : "Next"}
          </button>
        </div>
        <div className="onboarding-progress" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={3} aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`onboarding-dot ${i === step ? "onboarding-dot-active" : ""} ${i < step ? "onboarding-dot-done" : ""}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
