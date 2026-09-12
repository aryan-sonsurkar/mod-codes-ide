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

**Quality gates at release:** 151/151 Playwright E2E · 845 Vitest unit tests ·
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

- React Components
- Props
- State Management
- useState
- useEffect
- Controlled Components
- Parent → Child Communication
- Child → Parent Callback Props
- Conditional Rendering
- map()
- filter()
- localStorage
- JSON
- Component Architecture
- Flexbox
- UI Engineering

---

# Vision

The long-term goal is to build a complete AI-powered development environment capable of assisting developers throughout the software development lifecycle.

Planned features include:

- Monaco Editor
- File Explorer
- Workspace Tabs
- Integrated Terminal
- Git Integration
- AI Chat Assistant
- Ollama Integration
- Plugin System
- Theme Engine
- Command Palette
- Search
- Settings
- Debugger
- Code Runner
- AI Code Explanation
- Multi-language Support

---

# Tech Stack

Current

- Next.js
- React
- JavaScript
- CSS
- Lucide React

Planned

- TypeScript
- Node.js
- Electron / Tauri
- Monaco Editor
- Ollama
- Git
- SQLite / PostgreSQL

---

# Folder Structure

```text
src/
└── app/
    ├── components/
    │   ├── Sidebar/
    │   ├── Workspace/
    │   └── CreateProjectModal/
    ├── globals.css
    ├── layout.js
    └── page.js
```

---

# Learning Goals

Building MODCODES is helping me develop skills in:

- React
- Next.js
- JavaScript
- CSS
- UI Engineering
- Component Architecture
- Software Engineering
- System Design
- Developer Tooling
- IDE Architecture
- Product Engineering

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

## Phase 1 — Project Management

- ✅ Create Project
- ✅ View Projects
- ✅ Delete Projects
- 🚧 Unique Project IDs
- ⏳ Edit Project
- ⏳ Search Projects

---

## Phase 2 — IDE Core

- File Explorer
- Workspace Tabs
- Monaco Editor
- Integrated Terminal

---

## Phase 3 — AI Features

- AI Chat
- Local AI (Ollama)
- AI Code Explanation
- AI Project Assistant

---

## Phase 4 — Professional Features

- Git Integration
- Theme Engine
- Plugin System
- Settings
- Command Palette
- Debugger
- Code Runner

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