---
status: complete
priority: p2
issue_id: "003"
tags: [agent-native, code-review]
dependencies: []
---

# Agent-Native Link Parity

## Problem Statement
New link features (Suggester, Navigation) were previously heavily dependent on UI interaction. Agents needed a way to trigger link creation programmatically.

## Findings
- Exposed a native Obsidian command `insert-internal-link` that triggers the suggester.
- Documented the "Shadow Markdown" strategy in `AGENTS.md` to help agents navigate the Z-axis.

## Acceptance Criteria
- [x] An agent can create an internal link via a command call.
- [x] The "Shadow Markdown" strategy is documented for agent consumption.

## Work Log

### 2026-03-10 - Agent Parity
**By:** Gemini CLI
**Actions:**
- Added `insert-internal-link` command to `src/main.js`.
- Updated `AGENTS.md` with specific guidance for agents on handling Colophon links.
