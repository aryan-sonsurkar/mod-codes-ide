# MODCODES V1 Architecture

## System Overview

MODCODES is a local-first student software engineering workspace and browser IDE. The developer remains authoritative. AI assists rather than silently controlling the project.

## Core Principles

- Local-first project data
- Approval-gated changes
- Markdown-backed project memory (.modcodes)
- Git-versionable project state
- Explainable AI context
- Explicit verification
- Safe testing
- No silent source modification
- No hidden cloud AI dependency

## Architecture Diagram

```
                    MODCODES
                        |
       +----------------+----------------+
       |                |                |
       v                v                v
 Project Memory       Project          Providers
 (.modcodes)         Lifecycle        AI/Terminal
       |                |
       v                v
 Research → PRD → Roadmap → Agent
                         |
                         v
                    Context Intelligence
                         |
                         v
                       Agent
                         |
                         v
                     ChangeSet
                         |
                         v
                      Review
                         |
                         v
                     Testing
                         |
                         v
                    Verification
                         |
                         v
                  Memory Proposal
                         |
                         v
                      Save Gate
```

## Module Boundaries

### Project Memory (.modcodes)

**Owner:** What the project intends to be.

- Parse/serialize .modcodes (Markdown + YAML frontmatter)
- Physical codebase is source of truth for code
- .modcodes is source of truth for intent, decisions, research, PRD
- Never silently rewritten by AI, agent, lifecycle, verification, testing, or ads

### Project Lifecycle

**Owner:** What should happen next.

States: idle → preparing → inspecting → contextReady → planning → awaitingApproval → executing → validation → review → completed

- Coordinates the entire project workflow
- Never bypasses user approval
- Never silently mutates roadmap status

### Planner

**Owner:** How should it happen.

- Creates execution plans from context
- Plans require user approval before execution

### Agent

**Owner:** Execute the approved plan.

- Real orchestrator with tool registry
- Approval-gated execution
- Never silently executes destructive commands
- Never silently commits, pushes, or modifies memory
- ChangeSet tracks all proposed changes

### Context Intelligence

**Owner:** What information should the planner receive.

- Relevant, bounded (24k chars, max 14 files, 50 candidates)
- Explainable selection
- Secret-safe (excludes .env, private keys, passwords)
- Reuses relevance ranking and workspace graph

### Testing

**Owner:** What tests can safely be executed.

- Test discovery and framework detection (Vitest/Jest)
- Full suite or safe scoped testing
- Changed-file → test mapping via filename, directory, graph, imports
- Explicit user approval required
- Timeout, cancellation, output limits, secret redaction
- Concurrent modification detection
- Stale result detection and cache invalidation

### Verification

**Owner:** What evidence proves the criteria.

Evidence hierarchy:
1. Passing test
2. Failed test
3. Executable evidence
4. Structured evidence
5. Implementation evidence
6. Agent claim

Agent claims never become proof automatically.

Statuses: verified, partially_verified, failed, blocked, unknown

### Memory Proposal

**Owner:** What project memory should be proposed.

- Only Progress auto-proposed after verified milestones
- Decisions, Architecture, Research, PRD require explicit workflow
- Accept / Edit / Reject determines persistence
- Secret protection (passwords, private keys detected)
- Duplicate detection
- Concurrent modification detection

### Save Gate

**Owner:** What gets persisted.

- ONLY persistence path for .modcodes
- Never bypassed by agent, lifecycle, verification, testing, ads, or AI
- All writes go through `applyProposalViaSaveGate()`

### Developer

**Owner:** Approve, reject, edit, cancel, and ultimately control the project.

- User approval required for all AI-generated changes
- User authority for milestone completion
- User controls all persistence decisions

## Data Flow

### New Project Flow

```
New Project
  → Choose: idea / existing codebase / hybrid / empty
  → Project Inspection
  → Research
  → PRD
  → Roadmap
  → Milestone
  → Context Intelligence
  → Plan
  → USER APPROVAL
  → Agent Execution
  → ChangeSet
  → Review Changes
  → Testing
  → Verification
  → Memory Proposal
  → USER ACCEPT / EDIT / REJECT
  → Save Gate
  → Continue Project
```

### Continue Project Flow

```
Open existing project
  → Load .modcodes + live codebase + Git + workspace state
  → Show welcome, health, drift detection
  → Next recommended step with explainable reasoning
```

## AI Providers

MODCODES does NOT host AI inference.

### Supported Providers

1. **Ollama** — Local server AI (default)
2. **Browser AI (Bonsai)** — WebGPU in-browser 1.7B model

### Provider States

- Not installed
- Downloading
- Verifying
- Loading
- Ready
- Unsupported
- Failed

Provider failures are understandable:
- "Bonsai is not installed." (not "AI failed.")

### Provider Isolation

- AdService never receives source, .modcodes, prompts, terminal output, or secrets
- Provider selection is user-controlled
- No telemetry unless explicitly enabled

## Security Architecture

### Protected Resources

- `.env` files excluded from AI context, memory proposals, and git
- Private keys detected by regex patterns
- Passwords detected and redacted
- Bridge token stored as password-type input

### Write Isolation

- Agent/lifecycle code never calls writeFile directly
- 5 regression tests verify: lifecycle, memoryProposal, verification, testExecution, scopedTest never write files
- All persistence goes through Save Gate

### Command Safety

- Destructive patterns blocked: `rm -rf`, `curl|sh`, etc.
- Test commands require approval
- Terminal output bounded (500 lines)
- Secret redaction in test output

### Git Safety

- Never automatically pushes, commits, resets --hard, or discards changes
- Surfaces uncommitted changes, overlaps, conflicts before action

## Settings System

### Architecture

- SettingsContext provides settings to all components
- DEFAULT_SETTINGS provides sensible defaults
- mergeSettings deep-merges stored settings with defaults
- sanitizeSettings validates all values
- loadSettings has try/catch returning defaults on error

### Categories

- Editor (font, tab size, minimap, etc.)
- Files (confirm before delete)
- Projects (confirm before delete)
- Terminal (font size, family)
- AI (provider, baseUrl, defaultModel, contextBudget, maxToolRounds)

### Resilience

- Missing settings → defaults applied
- Corrupted settings → defaults applied
- Settings cannot crash the IDE

## Advertising Architecture

### Isolation

- AdService is isolated from project data
- Never receives: filesystem, .modcodes, agent context, prompts, source code, terminal, test output, secrets
- Only receives: placement ID, viewport size

### Placements

1. Projects dashboard
2. Research workspace
3. Non-critical workspace areas

### Avoided

- Monaco editor
- Terminal execution
- Agent approval
- Test execution
- Save Gate
- Sensitive project content

## Testing Architecture

### Test Framework

- Vitest 4.1.11
- Node environment
- 68 test files, ~610 tests

### Test Categories

- Unit tests (lib modules)
- Integration tests (releaseCandidate.test.js)
- Regression tests (regression.test.js)
- Component tests (Onboarding, AIContextInspector)

### Security Tests

- No AdService → source files
- No AdService → .modcodes
- No AdService → prompts
- No AdService → terminal
- No AdService → secrets
- No agent → direct filesystem writes
- No verification → memory mutation
- No testing → Git mutation
- No testing → Save Gate bypass

## Documentation

41 documentation files covering:

- System architecture
- Module boundaries
- Data flow
- Approval flow
- Memory flow
- AI providers
- Testing
- Verification
- Git safety
- Advertising
- Security
- Mobile
- Accessibility
- Performance

## Deployment

### Requirements

- Node.js 18+
- Chromium-based browser (Chrome/Edge) for full functionality
- Ollama installed locally for AI features (optional)
- Bridge server for terminal (optional)

### Build

```bash
npm install
npm run build
npm start
```

### Development

```bash
npm run dev
```

## Version

- Current: 0.1.0 (pre-release)
- Target: v1.0.0
