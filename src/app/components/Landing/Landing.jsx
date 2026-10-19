import Link from "next/link";
import "./Landing.css";

const FEATURES = [
  {
    title: "Runs in your browser",
    description:
      "No install, no admin rights, no extension. Open a tab and work — even on a locked-down college or work computer.",
  },
  {
    title: "Works offline",
    description:
      "After the first visit the app shell is cached, so the editor keeps loading on flaky Wi-Fi. Your run output is local too.",
  },
  {
    title: "Browser AI — Bonsai",
    description:
      "Run Bonsai locally in your browser via WebGPU, with a CPU fallback. No cloud proxy, no API key, no quota.",
  },
  {
    title: "Ollama Integration",
    description: "Connect to a local Ollama server for larger models, same UX.",
  },
  {
    title: "AI-Assisted Development",
    description: "Explain code, find bugs, and navigate references — all privacy-first.",
  },
  {
    title: "Verification receipts",
    description:
      "Agent edits can't be accepted until the proposed code actually ran and passed — the gate checks evidence, not vibes.",
  },
  {
    title: "Task meter that can't lie",
    description:
      "Every AI turn records a receipt: provider, tokens, and whether it ran locally for $0.00 or on an API. Export it as CSV.",
  },
  {
    title: "Protected files need typed approval",
    description:
      "Env files, manifests, databases, and project memory sit behind walls — the agent must ask, and you type the filename to confirm.",
  },
  {
    title: "Whole workspace as one file",
    description:
      "Export every file into a ZIP and import it anywhere, with an audit trail of each agent decision kept in project memory.",
  },
  {
    title: "Run JavaScript, Python and HTML",
    description:
      "Execute code in a sandboxed frame or worker and watch output stream into the Run panel. Nothing to install locally.",
  },
  {
    title: "Projects without a folder",
    description:
      "No File System Access API? Keep a project's files in this browser instead — it works on Firefox, Safari and phones.",
  },
  {
    title: "Local Project Workspace",
    description: "Open a folder and work directly against your local files.",
  },
  {
    title: "File Explorer",
    description: "Browse, create, rename, and delete files right in the browser.",
  },
  {
    title: "Monaco Editor",
    description: "The same editor engine that powers modern coding tools.",
  },
  {
    title: "Multi-file Tabs",
    description: "Keep several files open and switch between them instantly.",
  },
  {
    title: "Workspace Search",
    description: "Find anything in your project without leaving the app.",
  },
  {
    title: "Command Palette",
    description: "Drive the whole workspace from your keyboard.",
  },
  {
    title: "Local File Editing",
    description: "Read and save files directly on your machine.",
  },
];

const STEPS = [
  {
    title: "Create a project",
    description:
      "Pick a folder, or keep the files in this browser — no sign-up either way.",
  },
  {
    title: "Open the workspace",
    description: "Explorer, tabs, search and the command palette are ready immediately.",
  },
  {
    title: "Edit code",
    description: "Write and edit files in the Monaco editor, saved where you chose.",
  },
  {
    title: "Run it",
    description: "Press Run to execute JavaScript, Python, or preview HTML in the browser.",
  },
  {
    title: "Ask the local AI",
    description: "Bonsai runs on your machine, so answers cost nothing and never leave it.",
  },
];

const REASONS = [
  {
    title: "No quota, ever",
    description:
      "Local inference means no monthly chat limits, no credit meters, no “upgrade to continue.” The only ceiling is your own hardware.",
  },
  {
    title: "No account, no telemetry",
    description:
      "Open the app and start — no sign-up, no seat limits, nothing uploaded. Your code and conversations never reach a server.",
  },
  {
    title: "Installs nothing",
    description:
      "Works on lab PCs, managed work machines, and phones where you cannot install software. A browser tab is the whole install.",
  },
  {
    title: "The agent is on a leash",
    description:
      "Cloud agents get blanket access. Here, protected files need typed approval and edits land only after verification receipts pass.",
  },
  {
    title: "Usage you can audit",
    description:
      "Every AI turn writes a receipt — provider, tokens, local-or-API spend — exportable as CSV. Honest by design, not by marketing.",
  },
  {
    title: "Works offline",
    description:
      "After the first visit the app shell is cached. Flaky Wi-Fi, planes, dead zones — the editor keeps loading and your runs stay local.",
  },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <span className="landing-brand">MODCODES</span>
        <Link className="landing-nav-link" href="/projects">
          Open App
        </Link>
      </header>

      <main>
        <section className="landing-hero">
          <h1 className="landing-hero-title">
            The IDE that never says &ldquo;at capacity.&rdquo;
          </h1>
          <p className="landing-hero-subtitle">
            When cloud AI IDEs throttle, bill, or go down, this tab keeps
            working. MODCODES runs in your browser with an AI that runs on
            your machine — no install, no account, no quota, no server that
            can turn you away. Edit a real folder or keep files in the
            browser, run JavaScript, Python and HTML, and let an
            approval-gated agent work under verification receipts instead of
            vibes.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-cta landing-cta-primary" href="/projects">
              Open MODCODES
            </Link>
            <Link className="landing-cta landing-cta-secondary" href="/projects">
              View Projects
            </Link>
          </div>
        </section>

        <section className="landing-section">
          <h2 className="landing-section-title">Features</h2>
          <div className="landing-grid">
            {FEATURES.map((feature) => (
              <div className="landing-card" key={feature.title}>
                <h3 className="landing-card-title">{feature.title}</h3>
                <p className="landing-card-text">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <h2 className="landing-section-title">How It Works</h2>
          <ol className="landing-steps">
            {STEPS.map((step, index) => (
              <li className="landing-step" key={step.title}>
                <span className="landing-step-number">{index + 1}</span>
                <div>
                  <h3 className="landing-step-title">{step.title}</h3>
                  <p className="landing-card-text">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section">
          <h2 className="landing-section-title">Why MODCODES</h2>
          <div className="landing-grid">
            {REASONS.map((reason) => (
              <div className="landing-card" key={reason.title}>
                <h3 className="landing-card-title">{reason.title}</h3>
                <p className="landing-card-text">{reason.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-cta-section">
          <h2 className="landing-cta-title">Ready to code in your browser?</h2>
          <p className="landing-cta-text">
            Open MODCODES and create a project in seconds — nothing to install.
          </p>
          <Link className="landing-cta landing-cta-primary" href="/projects">
            Open MODCODES
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <p>
          MODCODES — a local-first development environment built for the
          browser. Your files stay on your machine.
        </p>
      </footer>
    </div>
  );
}
