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

  const handleNext = () => {
    if (step === 2) {
      completeOnboarding();
      onComplete && onComplete({ aiChoice });
      return;
    }
    setStep((s) => s + 1);
  };

  const handleSkip = () => {
    completeOnboarding();
    onSkip && onSkip();
    onComplete && onComplete({ aiChoice: "skip" });
  };

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true">
      <div className="onboarding-card">
        {step === 0 && (
          <>
            <h2>Welcome to MODCODES</h2>
            <p>Your browser-based development environment. Your files stay on your machine.</p>
            <ul className="onboarding-list">
              <li>Open a folder — your files never leave your device.</li>
              <li>Browser needs permission to read the folder; you can revoke it anytime.</li>
              <li>Works best in Chrome or Edge; WebGPU enables Browser AI.</li>
            </ul>
            <p className="onboarding-privacy">No account, no telemetry. Local-first.</p>
          </>
        )}
        {step === 1 && (
          <>
            <h2>Choose how you want AI</h2>
            <p>MODCODES works fine as an editor without AI. Pick an option:</p>
            <div className="onboarding-choices" role="radiogroup">
              <button
                type="button"
                className={`onboarding-choice ${aiChoice === "ollama" ? "onboarding-choice-active" : ""}`}
                onClick={() => setAiChoice("ollama")}
              >
                <strong>Ollama</strong>
                <span>Local server at 127.0.0.1:11434</span>
              </button>
              <button
                type="button"
                className={`onboarding-choice ${aiChoice === "bonsai" ? "onboarding-choice-active" : ""}`}
                onClick={() => setAiChoice("bonsai")}
              >
                <strong>Bonsai Browser AI</strong>
                <span>Runs on your GPU via WebGPU</span>
              </button>
              <button
                type="button"
                className={`onboarding-choice ${aiChoice === "skip" ? "onboarding-choice-active" : ""}`}
                onClick={() => setAiChoice("skip")}
              >
                <strong>Skip AI setup</strong>
                <span>Use as editor only</span>
              </button>
            </div>
            <p className="onboarding-privacy">You can change this later in Settings → AI & Coder.</p>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Ready to code</h2>
            <p>Create a project or open an existing folder.</p>
            <ul className="onboarding-list">
              <li>Terminal: browser simulation by default; optional local bridge (localhost only, explicit pairing) for system shell.</li>
              <li>All AI is local-first: Ollama or Browser AI, no cloud proxy.</li>
            </ul>
          </>
        )}
        <div className="onboarding-actions">
          <button type="button" className="onboarding-skip" onClick={handleSkip}>
            Skip
          </button>
          <button type="button" className="onboarding-next" onClick={handleNext} disabled={step === 1 && !aiChoice}>
            {step === 2 ? "Get started" : "Next"}
          </button>
        </div>
        <div className="onboarding-progress" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`onboarding-dot ${i === step ? "onboarding-dot-active" : ""} ${i < step ? "onboarding-dot-done" : ""}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
