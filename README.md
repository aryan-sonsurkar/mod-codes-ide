# MODCODES

[![Release](https://img.shields.io/github/v/release/aryan-sonsurkar/mod-codes-ide)](https://github.com/aryan-sonsurkar/mod-codes-ide/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg](./LICENSE))
[![Live Demo](https://img.shields.io/badge/demo-live-00d4ff)](https://mod-codes-ide.vercel.app)

**A local-first, AI-powered software engineering workspace.** Research → PRD → Roadmap → Agent lifecycle, project memory, and approval-gated changes — with Bonsai (WebGPU) and Ollama (local) as the sole AI providers. No cloud lock-in.

🌐 **Live:** [mod-codes-ide.vercel.app](https://mod-codes-ide.vercel.app) · 📦 **Latest:** [v0.1.0 RC](https://github.com/aryan-sonsurkar/mod-codes-ide/releases/tag/v0.1.0)

---

## About

MODCODES is my flagship software engineering project: a browser IDE for
AI-assisted development, built AI-assisted. AI accelerates drafting; I own
architecture, debugging, and every shipped line.

**v0.1.0 (current):** full project lifecycle (Research → PRD → Roadmap →
Agent), `.modcodes` Markdown-first project memory, approval gates and save
gates, responsive desktop/tablet/mobile, AdSense with privacy consent.

**Quality gates at release:** 963 Vitest unit tests ·
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
- 🚧 Preparing Project IDs

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
- ✅ Integrated Terminal via local bridge
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

### Planned

- Plugin System
- Theme Engine
- Debugger
- Code Runner
- AI Code Explanation
- Multi-language Support

---

# Tech Stack

- Next.js 16 · React 19 · JavaScript
- Monaco Editor · Turbopack
- Ollama (local) · Bonsai (WebGPU)
- Vitest · ESLint
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
    │   └── project/
    ├── globals.css
    ├── layout.js
    └── page.js
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
- ⏳ Theme Engine
- ⏳ Plugin System
- ⏳ Debugger
- ⏳ Code Runner

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