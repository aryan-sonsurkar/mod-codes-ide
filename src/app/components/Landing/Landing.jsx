import Link from "next/link";
import "./Landing.css";

const FEATURES = [
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
  {
    title: "Terminal Foundation",
    description: "A terminal-ready architecture for future runtimes.",
  },
];

const STEPS = [
  {
    title: "Create Project",
    description: "Name your project and pick a folder.",
  },
  {
    title: "Open Workspace",
    description: "Grant folder access to connect MODCODES to your files.",
  },
  {
    title: "Browse Files",
    description: "Explore the project tree in the File Explorer.",
  },
  {
    title: "Edit Code",
    description: "Write and edit files in the Monaco editor.",
  },
  {
    title: "Save Locally",
    description: "Your changes are written straight back to disk.",
  },
];

const REASONS = [
  {
    title: "Built for the browser",
    description: "No installs. Open MODCODES and start working.",
  },
  {
    title: "Local-first",
    description: "Your files stay on your machine. Nothing is uploaded.",
  },
  {
    title: "No account required",
    description: "Pick a folder and start — that's it.",
  },
  {
    title: "Engineered for the future",
    description: "An architecture ready for AI capabilities down the line.",
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
          <h1 className="landing-hero-title">Your development environment, built for the browser.</h1>
          <p className="landing-hero-subtitle">
            MODCODES is a local-first coding workspace that connects directly
            to your files. Explore projects, edit code with Monaco, search
            your workspace, and drive everything from your keyboard.
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
            Open MODCODES and connect it to a project folder on your machine.
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