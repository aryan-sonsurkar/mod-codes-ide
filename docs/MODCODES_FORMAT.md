# MODCODES Project Memory Format — `.modcodes`

Single file per project: `<project-root>/.modcodes`. Local, human-readable, Markdown + YAML frontmatter, Git-versionable.

## Frontmatter

```yaml
---
modcodesVersion: 1
schemaVersion: 1
project:
  name: "AI Career Guidance Platform"
  phase: "idea" # idea | research | prd | planning | development | testing | release | maintenance
  createdAt: "2026-08-30T00:00:00.000Z"
  updatedAt: "2026-08-30T00:00:00.000Z"
  source: "idea" # idea | codebase | hybrid | empty
  github: null # or "https://github.com/user/repo"
---
```

`modcodesVersion` = file envelope version. `schemaVersion` = section schema. Both uint. `phase` is advisory — user may move backward (e.g. development → research → development). `source` records New Project choice.

## Body Sections (Markdown, order-stable, all optional but recommended)

```
# Project
One-line intent.

# Problem
What problem, for whom, why now.

# Users
Primary users, personas, pain.

# Research
## Overview
## Existing Solutions
## Competitors
## Market / Context
## Technical Feasibility
## Technology Options
## Risks
## Open Questions
## Sources
## Research History

# PRD
## Problem
## Target Users
## User Pain / Jobs to be Done
## Goals / Non-Goals
## Features
## User Stories
## Functional Requirements
## Non-Functional Requirements
## UX Requirements
## Technical Constraints
## Risks
## Success Metrics
## Open Questions
## Milestones

# Architecture
Stack, boundaries, data flow.

# Decisions
ADR-style: Date — Decision — Reason — Alternatives — Status.

# Roadmap
Ordered milestones M1..Mn with {goal, tasks[], deps[], status, risks, criteria}.

# Milestones
Duplicate of Roadmap expanded for editing.

# Progress
Current milestone, tasks done/total, last session delta.

# Open Questions
Blocking questions requiring decision.

# Sources
Numbered sources with URL, accessedAt, summary.

# Agent History
Structured observations (no chain-of-thought): {at, task, plan, decisions, files, tests, outcome}.

# Project Context
Free-form context for AI (budgets, conventions, secrets-note: never secrets).
```

UI renders from `.modcodes`; advanced users edit file directly. Parser preserves unknown sections (forward-compat).

## Parsing Rules

- File is UTF-8. Starts with `---\n` frontmatter block ending `\n---\n`. Body is remaining Markdown.
- Frontmatter is strict subset YAML (scalars, nesting under `project:`). Unknown keys preserved.
- Headings are `# ` and `## `. Section lookup is case-insensitive, normalized to canonical name.
- Empty file → `createEmptyModcodes(name)` with `phase: idea`.
- Serialization always writes frontmatter then sections in canonical order, skipping empty optional sections unless `preserveEmpty`.

## Persistence Contract

- Read via `filesystem.readFile(".modcodes")`, write via dirty→Save gate (never `filesystem.writeFile` from agent directly). If permission denied → `status: denied`.
- `updatedAt` bumped on serialize.
- Validation: `name` non-empty, `phase` in enum else fallback `idea`, `createdAt/updatedAt` ISO else now.

## Isolation

Not sent to ads. Not sent to cloud. Provider context explicitly selects snippets (budgets), filters `isSecretPath`.

## Versioning

`schemaVersion` 1. Future migration: `migrateModcodes(parsed)` spreads old frontmatter, fills new sections with `""`.
