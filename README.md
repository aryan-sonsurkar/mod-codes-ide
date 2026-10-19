# MODCODES

[![Release](https://img.shields.io/github/v/release/aryan-sonsurkar/mod-codes-ide)](https://github.com/aryan-sonsurkar/mod-codes-ide/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg](./LICENSE))
[![Live Demo](https://img.shields.io/badge/demo-live-00d4ff)](https://modcode.vercel.app)

**A local-first, AI-powered software engineering workspace.** Research → PRD → Roadmap → Agent lifecycle, project memory, and approval-gated changes — with Bonsai (WebGPU) and Ollama (local) as the sole AI providers. No cloud lock-in.

🌐 **Live:** [modcode.vercel.app](https://modcode.vercel.app) · 📦 **Latest:** [v0.2.0 RC](https://github.com/aryan-sonsurkar/mod-codes-ide/releases/tag/v0.2.0)

---

## About

MODCODES is my flagship software engineering project: a browser IDE for
AI-assisted development, built AI-assisted. AI accelerates drafting; I own
architecture, debugging, and every shipped line.

**Install-free and offline:** MODCODES runs from the browser with no
installer or account — it works on locked-down college and work machines,
stays fully usable offline as an installed PWA, and runs JavaScript, Python
and HTML previews in the browser (honestly labeled "Browser simulation"
where no system shell is available). Projects can live in a real folder or
kept in browser storage, and `.modcodes` project memory exports/imports as a
single portable file.

**v0.2.0 (current):** full project lifecycle (Research → PRD → Roadmap →
Agent), `.modcodes` Markdown-first project memory, approval gates and save
gates, in-browser runs, offline PWA, responsive desktop/tablet/mobile,
ad-free by default.

**The trust layer (what cloud IDEs can't copy):**

- **No quota, no account, no server** — runs on locked-down machines and
  fully offline; local AI providers mean no per-token bill to meter
- **Task meter that can't lie** — every AI turn gets a receipt (provider,
  model, tokens, local vs API spend) visible in-panel and exportable as CSV
- **Verification receipts** — agent changesets only unlock Accept after the
  proposed code actually ran and passed
- **Session checkpoints** — every chat turn and agent task appends an audit
  entry (asked/result/model/tools/files) to `.modcodes` Agent History
- **Blast-radius walls** — protected paths (env files, manifests, databases,
  `.modcodes`) force typed-confirmation approval before any agent access
- **Honest agent scoping** — the panel states plainly when the offline model
  is for mechanical tasks and complex work needs Ollama
- **Workspace as a file** — export/import the whole project as a ZIP
  (zip-slip guarded) plus the existing single-file `.modcodes` memory

**Quality gates:** 1100 Vitest unit tests · 176 Playwright e2e tests ·
ESLint clean · security scan clean · CI on every push.

**Stack:** Next.js 16 · React 19 · Node ≥ 20.9 · Bonsai (WebGPU) · Ollama (local).

## Quickstart

```bash
npm install
npm run dev
```

Open http://localhost:3000. For local AI, install
[Ollama](https://ollama.com) and pull a model — the app runs without it,
AI features enable when a provider is available.

---

# Current Progress

## Application Foundation

- ✅ Next.js application
- ✅ Component-based architecture
- ✅ Responsive workspace layout

---

## User Interface

- ✅ Sidebar
- ✅ Workspace
- ✅ Welcome Screen
- ✅ Quick Actions
- ✅ Recent Projects
- ✅ Chat Composer
- ✅ Create Project Modal
- ✅ Modern IDE-inspired UI
- ✅ Lucide React Icons
- ✅ Design System
- ✅ Interactive Buttons

---

## Project Management

- ✅ Create Project
- ✅ View Projects
- ✅ Delete Projects
- ✅ Local Project Persistence
- ✅ Automatic Project Loading
- ✅ Unique Project IDs
- ✅ Browser-storage projects (no folder permission needed)
- ✅ `.modcodes` export / import (portable project memory)
- ✅ Workspace ZIP export / import (whole project as one file)

---

## Engineering Concepts Practiced

- React Components & Hooks
- State Management (useState, Context)
- useEffect & Side Effects
- Component Architecture
- Flexbox & CSS Modules
- UI Engineering
- Pub/Sub Pattern
- Tool Registries
- Change Management (Changesets)
- Approval Gates
- Error Recovery & Retry Logic
- Streaming (AI responses)
- WebGPU (Bonsai)
- Local-First Architecture
- Security Headers & CSP

---

# Vision

A complete AI-powered development environment for assisting developers throughout the software development lifecycle.

### Implemented

- ✅ Monaco Editor with split panes and multi-file tabs
- ✅ File Explorer with tree view
- ✅ Workspace Tabs with editor groups
- ✅ Integrated Terminal (browser simulation by default, local bridge optional)
- ✅ In-browser Code Runner (JavaScript, Python, HTML previews)
- ✅ Offline PWA (service worker, precached app shell)
- ✅ Git Integration (read + write operations)
- ✅ AI Chat Assistant with streaming
- ✅ Ollama Integration (local inference)
- ✅ Bonsai Integration (WebGPU in-browser)
- ✅ Autonomous AI Agent with error recovery
- ✅ Command Palette
- ✅ Search across workspace
- ✅ Settings with hardware detection
- ✅ Project Memory (.modcodes Markdown)
- ✅ Research → PRD → Roadmap lifecycle
- ✅ Approval-gated changesets
- ✅ Session checkpoints in Agent History
- ✅ Verification receipts gate agent Accept
- ✅ Protected-path walls + typed tool-approval confirmations
- ✅ Task meter (honest per-turn usage receipts, CSV export)
- ✅ Honest offline agent scoping
- ✅ Workspace ZIP export / import (zip-slip guarded)

### Planned

- Plugin System
- Theme Engine
- Debugger
- AI Code Explanation
- Multi-language Support

---

# Tech Stack

- Next.js 16 · React 19 · JavaScript
- Monaco Editor · Turbopack
- Ollama (local) · Bonsai (WebGPU)
- Vitest · ESLint · Playwright
- CSS Modules

### Planned

- TypeScript
- Electron / Tauri
- SQLite / PostgreSQL

---

# Folder Structure

```text
src/
└── app/
    ├── components/
    │   ├── Sidebar/
    │   ├── Workspace/
    │   │   └── content/  (AI, Git, Terminal, Editor)
    │   ├── Settings/
    │   └── Onboarding/
    ├── hooks/           (useEditorGroups, useWorkspaceLayout)
    ├── lib/
    │   ├── ai/          (providers, tools, agent, planner)
    │   ├── git/
    │   ├── terminal/
    │   ├── editor/
    │   ├── filesystem/  (disk + browser-storage facade)
    │   ├── runtime/     (in-browser JS/Python/HTML runners)
    │   └── project/
    ├── globals.css
    ├── layout.js
    └── page.js
public/
    ├── sw.js            (offline service worker)
    └── pyodide-worker.js
tools/
    └── modcodes-bridge/ (local terminal/Git bridge)
```

---

# Learning Goals

Building MODCODES is helping me develop skills in:

- React & Next.js (App Router, Server Components)
- JavaScript (ES Modules, Async/Await)
- CSS (Modules, Responsive Design)
- UI Engineering & Component Architecture
- IDE Architecture (Monaco, Editor Groups, Tabs)
- AI Integration (Ollama, WebGPU, Streaming)
- Developer Tooling (Terminal, Git, Search)
- System Design (Security, Caching, Error Recovery)
- Product Engineering (Approval Gates, Changesets, Memory)
- Software Engineering (Testing, CI/CD, Documentation)

---

## Development Philosophy

This project is built AI-assisted. AI accelerates drafting; I own
architecture, debugging, and every shipped line.

The goal is to understand:

- Why systems are designed a certain way.
- How software evolves over time.
- How scalable architectures are created.
- How professional engineering teams build software.

Speed comes from AI, understanding comes from debugging. Shipping is
prioritized — and everything shipped is mine to explain.

---

# Roadmap

## Phase 1 — Project Management ✅

- ✅ Create Project
- ✅ View Projects
- ✅ Delete Projects
- ✅ Unique Project IDs
- ✅ Edit Project
- ✅ Search Projects

---

## Phase 2 — IDE Core ✅

- ✅ File Explorer
- ✅ Workspace Tabs
- ✅ Monaco Editor
- ✅ Integrated Terminal

---

## Phase 3 — AI Features ✅

- ✅ AI Chat
- ✅ Local AI (Ollama)
- ✅ AI Code Explanation
- ✅ AI Project Assistant
- ✅ Autonomous Agent

---

## Phase 4 — Professional Features

- ✅ Git Integration
- ✅ Settings
- ✅ Command Palette
- ✅ Search
- ✅ Code Runner (in-browser JS / Python / HTML)
- ⏳ Theme Engine
- ⏳ Plugin System
- ⏳ Debugger

---

## Phase 5 — Agent Trust & Portability ✅

- ✅ Session checkpoints (audit trail in Agent History)
- ✅ Verification receipts (run-and-pass gate before Accept)
- ✅ Protected paths (env / manifest / database / memory walls)
- ✅ Working tool approval gate (typed confirm for protected files)
- ✅ Task meter (honest per-turn usage receipts + CSV export)
- ✅ Honest offline agent scoping
- ✅ Workspace ZIP export / import

---

## Phase 6 — Local Link & Mesh (in design)

Make the deployed site talk to your own Ollama from any device — no daemon, no
extension, no account. Phase 1 is the pure-frontend win: the deployed site
reaches Ollama directly (Chrome 142's Local Network Access permission), with a
guided one-time host grant and LAN address discovery via QR. Phase 2 adds a
WebRTC mesh for cross-network and Safari users. Full architecture, security
model, and phasing in [`docs/MESH.md`](docs/MESH.md).

- ⏳ Phase 1 — Local Link: detection, per-OS grant wizard, LNA handling, LAN QR, direct transport
- ⏳ Phase 2 — Mesh v1: signaling function, host/guest bridge, chat-only, safety phrase
- ⏳ Phase 3 — Agent oracle: host-side agent + phone typed-approval remote
- ⏳ Phase 4 — Multi-hop: desktop ← laptop ← phone model fog

---

# Learning Journal

Every development session is documented inside **LEARNING.md**, where I record:

- Features built
- Engineering concepts learned
- Architectural decisions
- Mistakes encountered
- Key takeaways

This repository serves as both a software project and a public engineering journal.

---

# Author

**Aryan Sonsurkar**

Diploma in Computer Engineering (MSBTE)

Building MODCODES to master software engineering, full-stack development, systems programming, compiler engineering, and developer tooling by building everything from first principles.